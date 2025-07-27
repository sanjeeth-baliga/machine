# Google Drive API Setup Guide

This guide will help you set up the Google Drive API integration for the course dashboard.

## Prerequisites

1. A Google account
2. Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your Project ID

## Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Select "Web application" as the application type
4. Add your domain to "Authorized JavaScript origins":
   - For development: `http://localhost:5173` (or your dev server port)
   - For production: `https://yourdomain.com`
5. Click "Create"
6. Copy the **Client ID** (you'll need this)

## Step 4: Create API Key (Optional but Recommended)

1. In "Credentials", click "Create Credentials" > "API Key"
2. Copy the **API Key**
3. (Optional) Restrict the API key to Google Drive API only

## Step 5: Create Parent Folder in Google Drive

1. Go to [Google Drive](https://drive.google.com/)
2. Create a new folder where you want to store course materials
3. Right-click the folder and select "Share"
4. Copy the folder ID from the URL (it's the long string after `/folders/`)

## Step 6: Configure Environment Variables

1. Copy `env.example` to `.env`
2. Fill in the values:

```env
VITE_GOOGLE_CLIENT_ID=your_client_id_from_step_3
VITE_GOOGLE_API_KEY=your_api_key_from_step_4
VITE_GOOGLE_DRIVE_PARENT_FOLDER_ID=your_folder_id_from_step_5
```

## Step 7: Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to the course dashboard
3. Request a course
4. Try uploading files - you should see a Google OAuth popup
5. After authentication, files should be uploaded to the course-specific folder

## Folder Structure

The integration creates folders in this format:
```
Parent Folder/
├── course_id_1_course_name_1/
│   ├── file1.pdf
│   ├── file2.docx
│   └── ...
├── course_id_2_course_name_2/
│   ├── file1.pdf
│   └── ...
└── ...
```

## Troubleshooting

### Common Issues

1. **"Authentication failed" error**
   - Check that your Client ID is correct
   - Ensure your domain is in the authorized origins
   - Make sure you're using HTTPS in production

2. **"Failed to create directory" error**
   - Verify the Parent Folder ID is correct
   - Ensure the Google account has write permissions to the parent folder

3. **"Failed to upload file" error**
   - Check file size limits (Google Drive has a 5TB limit per file)
   - Ensure the file type is supported
   - Verify network connectivity

### Debug Mode

To enable debug logging, add this to your `.env`:
```env
VITE_DEBUG_GOOGLE_DRIVE=true
```

## Security Notes

- Never commit your `.env` file to version control
- The API key and Client ID are safe to use in client-side code
- OAuth tokens are temporary and automatically managed
- Users will need to authenticate with their Google account to upload files

## API Limits

- Google Drive API has rate limits (10,000 requests per 100 seconds per user)
- File upload size limit: 5TB per file
- Maximum files per folder: No limit (practical limit is around 500,000)

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Test with a simple file upload first
4. Check Google Cloud Console for API usage and errors 