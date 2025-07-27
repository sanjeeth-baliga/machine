// Google Drive API configuration
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const PARENT_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_PARENT_FOLDER_ID || '';

// Debug logging for environment variables
console.log('Environment variables check:', {
  CLIENT_ID: CLIENT_ID ? CLIENT_ID : 'Missing',
  API_KEY: API_KEY ? API_KEY : 'Missing',
  PARENT_FOLDER_ID: PARENT_FOLDER_ID ? 'Set' : 'Missing',
  allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
});

// Validate environment variables on module load
if (!CLIENT_ID) {
  console.error('❌ VITE_GOOGLE_CLIENT_ID is not set. Please create a .env file with your Google OAuth2 Client ID.');
}
if (!PARENT_FOLDER_ID) {
  console.error('❌ VITE_GOOGLE_DRIVE_PARENT_FOLDER_ID is not set. Please create a .env file with your Google Drive parent folder ID.');
}

// Scopes required for Google Drive access
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export interface GoogleDriveService {
  authenticate(): Promise<void>;
  createDirectory(folderName: string, parentId?: string): Promise<string>;
  uploadFile(file: File, folderId: string): Promise<string>;
  findOrCreateDirectory(folderName: string, parentId?: string): Promise<string>;
  uploadFilesToCourseDirectory(
    files: File[], 
    courseId: string, 
    courseName: string
  ): Promise<{ success: boolean; uploadedFiles: string[]; errors: string[] }>;
}

class GoogleDriveServiceImpl implements GoogleDriveService {
  private accessToken: string | null = null;
  private isAuthenticated = false;

  async authenticate(): Promise<void> {
    if (this.isAuthenticated && this.accessToken) return;

    // Validate that CLIENT_ID is set
    if (!CLIENT_ID) {
      throw new Error('Missing required parameter client_id. Please check your .env file and ensure VITE_GOOGLE_CLIENT_ID is set.');
    }

    return new Promise((resolve, reject) => {
      // Check if Google Identity Services is loaded
      if (typeof window.google === 'undefined' || !window.google.accounts) {
        reject(new Error('Google Identity Services not loaded. Please check your internet connection.'));
        return;
      }

      window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: (response) => {
          if (response.error) {
            reject(new Error(`Authentication failed: ${response.error}`));
            return;
          }
          
          this.accessToken = response.access_token;
          this.isAuthenticated = true;
          resolve();
        },
      }).requestAccessToken();
    });
  }

  private async makeDriveRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.isAuthenticated || !this.accessToken) {
      await this.authenticate();
    }

    const url = `https://www.googleapis.com/drive/v3${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async createDirectory(folderName: string, parentId: string = PARENT_FOLDER_ID): Promise<string> {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };

    try {
      const response = await this.makeDriveRequest('/files', {
        method: 'POST',
        body: JSON.stringify(fileMetadata),
      });

      return response.id;
    } catch (error) {
      console.error('Error creating directory:', error);
      throw new Error(`Failed to create directory: ${error}`);
    }
  }

  async findDirectory(folderName: string, parentId: string = PARENT_FOLDER_ID): Promise<string | null> {
    try {
      const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
      const response = await this.makeDriveRequest(`/files?q=${query}&fields=files(id,name)`);

      const folders = response.files;
      return folders && folders.length > 0 ? folders[0].id : null;
    } catch (error) {
      console.error('Error finding directory:', error);
      return null;
    }
  }

  async findOrCreateDirectory(folderName: string, parentId: string = PARENT_FOLDER_ID): Promise<string> {
    // First try to find existing directory
    const existingFolderId = await this.findDirectory(folderName, parentId);
    
    if (existingFolderId) {
      return existingFolderId;
    }

    // If not found, create new directory
    return await this.createDirectory(folderName, parentId);
  }

  async uploadFile(file: File, folderId: string): Promise<string> {
    // For file uploads, we need to use the upload endpoint
    const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    
    if (!this.isAuthenticated || !this.accessToken) {
      await this.authenticate();
    }

    // Create multipart form data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const fileMetadata = {
      name: file.name,
      parents: [folderId],
    };

    // Create FormData for proper file handling
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    formData.append('file', file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file ${file.name}: ${error}`);
    }
  }

  async uploadFilesToCourseDirectory(
    files: File[], 
    courseId: string, 
    courseName: string
  ): Promise<{ success: boolean; uploadedFiles: string[]; errors: string[] }> {
    try {
      // Create directory name in format: <id>_<course_name>
      const folderName = `${courseId}_${courseName}`;
      
      // Find or create the directory
      const folderId = await this.findOrCreateDirectory(folderName);
      
      const uploadedFiles: string[] = [];
      const errors: string[] = [];

      // Upload each file to the directory
      for (const file of files) {
        try {
          const fileId = await this.uploadFile(file, folderId);
          uploadedFiles.push(fileId);
        } catch (error) {
          errors.push(`Failed to upload ${file.name}: ${error}`);
        }
      }

      return {
        success: uploadedFiles.length > 0,
        uploadedFiles,
        errors,
      };
    } catch (error) {
      console.error('Error in uploadFilesToCourseDirectory:', error);
      throw new Error(`Failed to upload files to course directory: ${error}`);
    }
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveServiceImpl(); 