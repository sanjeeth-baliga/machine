import React, { useState, useMemo, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Minus, 
  Share2, 
  Book, 
  Search,
  ArrowUpDown,
  X,
  Copy,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  Upload,
  
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth, googleProvider } from "../firebase"; // auth and googleProvider for Firebase
import axios from 'axios';
import { googleDriveService } from '@/lib/google-drive';


// Course interface
interface Course {
  college: string;
  semester: number;
  course: string;
  department: string;
  requestCount: number;
  status: 'active' | 'progress' | 'inactive';
  id: string;
}

// User interface
interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthForm {
  name: string;
  email: string;
  password: string;
}

// Define the type for course details passed to the modal
interface UploadModalCourse {
  course: string;
  college: string;
  department: string;
  requestCount: number;
}

interface UploadDialogProps {
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (open: boolean) => void;
  uploadModalCourse?: UploadModalCourse;
}

// Mock data
/*const mockCourses: Course[] = [
  { id: '1', college: 'Stanford University', semester: 1, course: 'Introduction to AI', department: 'Computer Science', requestCount: 18, status: 'inactive' },
  { id: '2', college: 'Stanford University', semester: 2, course: 'Machine Learning', department: 'Computer Science', requestCount: 25, status: 'active' },
  { id: '3', college: 'Stanford University', semester: 1, course: 'Data Structures', department: 'Computer Science', requestCount: 12, status: 'progress' },
  { id: '4', college: 'MIT', semester: 1, course: 'Calculus I', department: 'Mathematics', requestCount: 22, status: 'inactive' },
  { id: '5', college: 'MIT', semester: 2, course: 'Physics I', department: 'Physics', requestCount: 15, status: 'active' },
  { id: '6', college: 'MIT', semester: 1, course: 'Chemistry Basics', department: 'Chemistry', requestCount: 8, status: 'inactive' },
  { id: '7', college: 'Harvard University', semester: 1, course: 'Psychology 101', department: 'Psychology', requestCount: 30, status: 'active' },
  { id: '8', college: 'Harvard University', semester: 2, course: 'Business Ethics', department: 'Business', requestCount: 14, status: 'progress' },
  { id: '9', college: 'Harvard University', semester: 1, course: 'Philosophy of Mind', department: 'Philosophy', requestCount: 7, status: 'inactive' },
  { id: '10', college: 'UC Berkeley', semester: 1, course: 'Environmental Science', department: 'Environmental Studies', requestCount: 19, status: 'inactive' },
  { id: '11', college: 'UC Berkeley', semester: 2, course: 'Organic Chemistry', department: 'Chemistry', requestCount: 26, status: 'active' },
  { id: '12', college: 'UC Berkeley', semester: 1, course: 'Linear Algebra', department: 'Mathematics', requestCount: 11, status: 'progress' },
  { id: '13', college: 'Princeton University', semester: 1, course: 'Art History', department: 'Art', requestCount: 9, status: 'inactive' },
  { id: '14', college: 'Princeton University', semester: 2, course: 'Economics 101', department: 'Economics', requestCount: 23, status: 'active' },
  { id: '15', college: 'Princeton University', semester: 1, course: 'Creative Writing', department: 'English', requestCount: 16, status: 'progress' }
];*/

const CourseCatalog = () => {
  //const [courses, setCourses] = useState<Course[]>(mockCourses);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedColleges, setExpandedColleges] = useState<Set<string>>(new Set());
  const [collegeFilter, setCollegeFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'requests'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [userRequests, setUserRequests] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalCourse, setShareModalCourse] = useState<Course | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  // New state to store the course ID that triggered the authentication request
  const [courseIdForAuth, setCourseIdForAuth] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [processingCourseId, setProcessingCourseId] = useState<string | null>(null);
  const [pendingCourseRequest, setPendingCourseRequest] = useState<null | typeof modalForm>(null);
  const [courseRequestLoading, setCourseRequestLoading] = useState(false);

  const { toast } = useToast();
  
  // Column filters for expanded view
  const [departmentFilter, setDepartmentFilter] = useState<{[college: string]: string}>({});
  const [semesterFilter, setSemesterFilter] = useState<{[college: string]: string}>({});
  const [courseNameFilter, setCourseNameFilter] = useState<{[college: string]: string}>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<{college: string, column: string} | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Upload functionality states
  const [requestedCourses, setRequestedCourses] = useState<Set<string>>(new Set());
  const [newlySubmittedCourses, setNewlySubmittedCourses] = useState<Set<string>>(new Set());

  // Helper function to update requested courses and persist to sessionStorage
  const updateRequestedCourses = useCallback((courseId: string) => {
    setRequestedCourses(prev => {
      const newSet = new Set([...prev, courseId]);
      sessionStorage.setItem('requestedCourses', JSON.stringify([...newSet]));
      return newSet;
    });
  }, []);

  // Helper function to clear requested courses from sessionStorage
  const clearRequestedCourses = useCallback(() => {
    setRequestedCourses(new Set());
    setNewlySubmittedCourses(new Set());
    sessionStorage.removeItem('requestedCourses');
    sessionStorage.removeItem('newlySubmittedCourses');
  }, []);

  // Helper function to track newly submitted courses
  const trackNewlySubmittedCourse = useCallback((courseKey: string) => {
    setNewlySubmittedCourses(prev => {
      const newSet = new Set([...prev, courseKey]);
      sessionStorage.setItem('newlySubmittedCourses', JSON.stringify([...newSet]));
      return newSet;
    });
  }, []);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalCourse, setUploadModalCourse] = useState<Course | null>(null);
  const [showUploadTooltip, setShowUploadTooltip] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);


  // Modal form states
  const [modalForm, setModalForm] = useState({
    college: '',
    semester: '',
    courseName: '',
    department: ''
  });
  
  const [showCollegeSuggestions, setShowCollegeSuggestions] = useState(false);
  
  // Get filtered college suggestions
  const getCollegeSuggestions = () => {
    if (!modalForm.college) return [];
    return Array.from(new Set(courses.map(c => c.college)))
      .filter(college => 
        college.toLowerCase().includes(modalForm.college.toLowerCase()) &&
        college.toLowerCase() !== modalForm.college.toLowerCase()
      )
      .slice(0, 5); // Limit to 5 suggestions
  };
  
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: ''
  });



  const googleAppScriptURL = "https://script.google.com/macros/s/AKfycbxEQuqd8x5Ze4l8suXR5v4yTGzDp9AwWO62xvwzS8aDIzUKVFw3d1AriUXad0Xp2G3MoQ/exec";

  const courseSubmitScriptURL = "https://script.google.com/macros/s/AKfycbwbNoOloyMyfQojQl_sqF6KXV1fASrODftA9Oy9nlOoVLa-7glEEEhOqNdv6Q5-ljmAKg/exec";
  // Fetch data from Google Sheets API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const googleSheetURL = 'https://script.google.com/macros/s/AKfycbyYa9j2szWppeP5uz2uP9KI3UTHGvG0iyQj0vJ2rq1FdZJJCsBv5vk_CxnHBFwo7XyiPA/exec'; // Your script URL
      const urlWithParams = new URL(googleSheetURL);
      urlWithParams.searchParams.append('sheetName', 'Dashboard_Feed'); // Assuming your sheet name is 'Courses'

      const response = await fetch(urlWithParams.toString());
      const data = await response.json();

      if (data.error) {
        console.error("Error fetching data from Google Sheets:", data.error);
      } else {
        setCourses(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // On component mount, check sessionStorage for user and requested courses
  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    
    const storedRequestedCourses = sessionStorage.getItem('requestedCourses');
    if (storedRequestedCourses) {
      setRequestedCourses(new Set(JSON.parse(storedRequestedCourses)));
    }

    const storedNewlySubmittedCourses = sessionStorage.getItem('newlySubmittedCourses');
    if (storedNewlySubmittedCourses) {
      setNewlySubmittedCourses(new Set(JSON.parse(storedNewlySubmittedCourses)));
    }
  }, []);

  // After login/signup, if a course request was pending, trigger it
  /*useEffect(() => {
    if (currentUser && courseIdForAuth) {
      handleRequest(courseIdForAuth);
      setIsAuthModalOpen(false);
      setCourseIdForAuth(null);
    }
  }, [currentUser, courseIdForAuth]);*/

  // Get unique colleges and their data
  const collegeData = useMemo(() => {
    const filtered = courses.filter(course => 
      course.college.toLowerCase().includes(collegeFilter.toLowerCase())
    );
    
    const grouped = filtered.reduce((acc, course) => {
      if (!acc[course.college]) {
        acc[course.college] = [];
      }
      acc[course.college].push(course);
      return acc;
    }, {} as Record<string, Course[]>);

    const collegeList = Object.entries(grouped).map(([college, collegeCourses]) => ({
      name: college,
      courses: collegeCourses,
      totalRequests: collegeCourses.reduce((sum, course) => sum + course.requestCount, 0)
    }));

    // Sort colleges
    collegeList.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        return sortOrder === 'asc' 
          ? a.totalRequests - b.totalRequests
          : b.totalRequests - a.totalRequests;
      }
    });

    return collegeList;
  }, [courses, collegeFilter, sortBy, sortOrder]);

  const toggleCollege = (collegeName: string) => {
    const newExpanded = new Set<string>();
    if (!expandedColleges.has(collegeName)) {
      newExpanded.add(collegeName);
    }
    setExpandedColleges(newExpanded);
  };

  const handleRequest = async (courseId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      setCourseIdForAuth(courseId); // Store the courseId before opening auth modal
      
      return;
    }

    setProcessingCourseId(courseId);
    try {
      const response = await fetch(googleAppScriptURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'sheetName': 'Responses',
          'id': courseId,
          'name': currentUser.name,
          'email': currentUser.email,
        }).toString(),
      });
      const data = await response.json();
      if (data.result && data.result.startsWith('Error')) {
        toast({
          title: 'Request Failed',
          description: `Failed to add your request: ${data.result}`,
          variant: 'destructive',
        });
      } else if(data.result.startsWith('Skipped')){
        toast({
          title: 'Hey..One Quick Thing!',
          description: 'I guess you have already requested for this course',
        });
      } else {
        setCourses(prev => prev.map(course =>
          course.id === courseId
            ? { ...course, requestCount: course.requestCount + 1 }
            : course
        ));
        // Add course to requested courses and show upload tooltip
        updateRequestedCourses(courseId);
        setShowUploadTooltip(courseId);
        // Auto-hide tooltip after 5 seconds
        setTimeout(() => setShowUploadTooltip(null), 5000);
        toast({
          title: 'Great Job!',
          description: 'Your request is registered successfully! You are one step closer to unlocking your course',
        });
      }
      fetchData();
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Could not connect to the request service.',
        variant: 'destructive',
      });
    } finally {
      setProcessingCourseId(null);
    }
  };

  const handleShare = (course: Course) => {
    setShareModalCourse(course);
    setIsShareModalOpen(true);
  };

  const handleUpload = (course: Course) => {
    setUploadModalCourse(course);
    setIsUploadModalOpen(true);
  };

  const copyToClipboard = () => {
    if (shareModalCourse) {
      let message = '';
      
      if (shareModalCourse.status === 'active') {
        message = `I have found a cheat code to crack "${shareModalCourse.course}" at ${shareModalCourse.college}. You can directly access it and find out for yourself: ${window.location.href}`;
      } else {
        message = `I have found a cheat code to crack "${shareModalCourse.course}" at the college ${shareModalCourse.college}! Currently ${shareModalCourse.requestCount} folks have voted to unlock it. I need your support in voting to unlock it: ${window.location.href}`;
      }
      
      navigator.clipboard.writeText(message).then(() => {
        toast({
          title: "Copied!",
          description: "Your request has been copied to clipboard.",
        });
      });
    }
  };

  const handleNativeShare = () => {
    if (navigator.share && shareModalCourse) {
      let shareText = '';
      
      if (shareModalCourse.status === 'active') {
        shareText = `I have found a cheat code to crack "${shareModalCourse.course}" at ${shareModalCourse.college}. You can directly access it and find out for yourself: ${window.location.href}`;
      } else {
        shareText = `I have found a cheat code to crack "${shareModalCourse.course}" at the college ${shareModalCourse.college}! Currently ${shareModalCourse.requestCount} folks have voted to unlock it. I need your support in voting to unlock it: ${window.location.href}`;
      }
      
      navigator.share({
        title: `${shareModalCourse.status === 'active' ? 'Join' : 'Request'} ${shareModalCourse.course}`,
        text: shareText,
        url: window.location.href
      }).catch(console.error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!authForm.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(authForm.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!authForm.password) {
      newErrors.password = 'Password is required';
    } else if (authForm.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (authMode === 'signup' && !authForm.name) {
      newErrors.name = 'Name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async () => {
    let mockUser: User;
    if (!validateForm()) return;
    if (authMode === 'signin') {
      // Mock signin
      mockUser = { id:'',name: '', email: authForm.email }; // Using a generic ID and name for mock
      
      try {
        // Sign in using Firebase
        const userCredential = await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
        const firebaseUser = userCredential.user;
        if (!firebaseUser.emailVerified) {
          console.log("User email not verified. Logging out...");
          await auth.signOut();  // Logout unverified user
          throw new Error("Please verify your email before logging in.");
        }

        const user_email = firebaseUser.email;
        //const user_name = firebaseUser.displayName;

        if (!user_email) {
          // Email is crucial for your backend according to the plan
          throw new Error("Firebase authentication failed: email not available.");
        }
        console.log("Login successful with Firebase:", user_email);
        
        mockUser.name = firebaseUser.displayName || '';
        console.log("Mock user name has been set to:", mockUser.name);

        setCurrentUser(mockUser);
        sessionStorage.setItem('user', JSON.stringify(mockUser));
        toast({
          title: 'Congratulations!',
          description: 'Your request is registered. You are now a step closer to unlocking a new course',
        });
        
      } catch (err: any) {
        // Handle friendly Firebase errors
        const newErrors: Record<string, string> = {};
        let friendlyMessage = "An error occurred during login.";
  
        if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
          friendlyMessage = "Incorrect email or password.";
        } else if (err.code === "auth/user-not-found") {
          friendlyMessage = "No user found with this email.";
        } else if (err.code === "auth/too-many-requests") {
          friendlyMessage = "Too many failed attempts. Try again later.";
        } else if (err.code === "auth/invalid-email") {
          friendlyMessage = "Please enter a valid email address.";
        } else if (err.message.includes("verify your email")) {
          friendlyMessage = err.message;
        }
        
        newErrors.password = friendlyMessage;
        setErrors(newErrors);
        return;
      }
      
      
    } else {
      // Mock signup
      mockUser = { id:'',name: authForm.name, email: authForm.email };
      try {
        
        const userCredential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        const user = userCredential.user;

        // Send email verification
        await sendEmailVerification(user);

        // Signup successful
        console.log("Signup successful. Verification mail has been sent");
        
        setCurrentUser(mockUser);
        sessionStorage.setItem('user', JSON.stringify(mockUser));
        toast({
          title: 'Congratulations!',
          description: 'Your request is registered. You are now a step closer to unlocking a new course',
        });
        
      } catch (err: any) {
        let friendlyMessage = "An error occurred during signup.";
        const newErrors: Record<string, string> = {};

        if (err.code === "auth/email-already-in-use") {
          friendlyMessage = "This email is already registered. Try logging in.";
        } else if (err.code === "auth/weak-password") {
          friendlyMessage = "Password entered is too weak. Please use a stronger one.";
        } else if (err.code === "auth/invalid-email") {
          friendlyMessage = "Please enter a valid email address.";
        } else if (err.code === "auth/operation-not-allowed") {
          friendlyMessage = "Signup is temporarily disabled. Please try again later.";
        } else {
          friendlyMessage = "Password entered is incorrect or invalid.";
        }
        newErrors.password = friendlyMessage;
        setErrors(newErrors);
        return;
      }
      
    }

    if (!courseIdForAuth && !pendingCourseRequest) {
      toast({
        title: 'Authentication Error',
        description: 'Could not determine which course was requested.',
        variant: 'destructive',
      });
      setIsAuthModalOpen(false);
      return;
    }

    // If this was a course request from the modal, submit it now
    if (pendingCourseRequest) {
      await submitCourseRequest(pendingCourseRequest);
      setPendingCourseRequest(null);
      setIsAuthModalOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
      return;
    }

    // If this was a course request from the main table, continue as before
    if (courseIdForAuth) {
      try {
        const response = await fetch(googleAppScriptURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'sheetName': 'Responses',
            'id': courseIdForAuth,
            'name': mockUser.name,
            'email': mockUser.email,
          }).toString(),
        });
        const data = await response.json();

        if (data.result.startsWith('Error')) {
          console.error('Error updating Google Sheets:', data.result);
          toast({
            title: 'Update Failed',
            description: `Failed to authenticate: ${data.result}`,
            variant: 'destructive',
          });
        } else if (data.result.startsWith('Skipped')) { 
          toast({
            title: 'Hey..One Quick Thing!',
            description: 'I guess you have already requested for this course',
          });
        } else {
          console.log('Google Sheets updated successfully:', data.result);
          // Add course to requested courses and show upload tooltip
          updateRequestedCourses(courseIdForAuth);
          setShowUploadTooltip(courseIdForAuth);
          // Auto-hide tooltip after 5 seconds
          setTimeout(() => setShowUploadTooltip(null), 5000);
          toast({
            title: 'Behold!',
            description: 'You have logged in successfully',
          });
        }
        fetchData();

      } catch (error) {
        console.error('Error during Google Sheets API call:', error);
        toast({
          title: 'Network Error',
          description: 'Could not connect to the internal server',
          variant: 'destructive',
        });
      } finally {
        setIsAuthModalOpen(false);
        setAuthForm({ name: '', email: '', password: '' });
        setCourseIdForAuth(null);
      }
      return;
    }

    setIsAuthModalOpen(false);
    setAuthForm({ name: '', email: '', password: '' });
    setCourseIdForAuth(null);
  };

  /*const handleLogout = () => {
    setCurrentUser(null);
    setUserRequests(new Set());
    clearRequestedCourses();
    sessionStorage.removeItem('user');
    toast({
      title: 'Logged out',
      description: 'You have been logged out successfully.',
    });

  };*/

  // Effect to re-trigger handleRequest after successful authentication
  /*useEffect(() => {
    if (currentUser && courseIdForAuth) {
      // If the user just logged in/signed up due to a request,
      // re-run the handleRequest logic for that course.
      handleRequest(courseIdForAuth);
      setIsAuthModalOpen(false);
      setCourseIdForAuth(null); // Clear the ID as it's been processed
    }
  }, [currentUser, courseIdForAuth]); // Depend on currentUser and courseIdForAuth*/

  const getFilteredCourses = (collegeCourses: Course[], collegeName: string) => {
    return collegeCourses.filter(course => {
      const deptFilter = departmentFilter[collegeName] || '';
      const semFilter = semesterFilter[collegeName] || '';
      const courseFilter = courseNameFilter[collegeName] || '';
      
      return (
        course.department.toLowerCase().includes(deptFilter.toLowerCase()) &&
        course.semester.toString().includes(semFilter) &&
        course.course.toLowerCase().includes(courseFilter.toLowerCase())
      );
    });
  };

  const handleSort = (type: 'name' | 'requests') => {
    if (sortBy === type) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  const submitCourseRequest = async (form: typeof modalForm) => {
    setCourseRequestLoading(true);
    const storedUser = sessionStorage.getItem('user');
    const user: User | null = storedUser ? JSON.parse(storedUser) : null;

    try {
      const response = await fetch(courseSubmitScriptURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          college: form.college,
          semester: form.semester,
          course: form.courseName,
          department: form.department,
          name: user?.name || '',
          email: user?.email || '',
        }).toString(),
      });
      const data = await response.json();
      if (data.result && data.result.startsWith('Error')) {
        toast({
          title: 'Request Failed',
          description: `Failed to submit your course request: ${data.result}`,
          variant: 'destructive',
        });
      } else {
        // Create a unique key for the newly submitted course
        const courseKey = `${form.college}-${form.department}-${form.courseName}-${form.semester}`;
        trackNewlySubmittedCourse(courseKey);
        
        toast({
          title: "Congratulations!",
          description: "You have added a new course. Please invite your friends to request and unlock it",
        });
        setIsModalOpen(false);
        setModalForm({ college: '', semester: '', courseName: '', department: '' });
        fetchData().then(() => {
          // After data is refreshed, find the newly submitted course and show tooltip
          const courseKey = `${form.college}-${form.department}-${form.courseName}-${form.semester}`;
          const newlySubmittedCourse = courses.find(course => 
            `${course.college}-${course.department}-${course.course}-${course.semester}` === courseKey
          );
          if (newlySubmittedCourse) {
            setShowUploadTooltip(newlySubmittedCourse.id);
            setTimeout(() => setShowUploadTooltip(null), 5000);
          }
        });
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Could not connect to the request service.',
        variant: 'destructive',
      });
    } finally {
      setCourseRequestLoading(false);
    }
  };

  const handleModalSubmit = () => {
    if (!currentUser) { //
      setPendingCourseRequest({ ...modalForm });
      setIsAuthModalOpen(true);
      return;
    }
    submitCourseRequest(modalForm);
  };

  const handleFilterClick = (college: string, column: string) => {
    setActiveFilterColumn({ college, column });
  };

  const handleFilterChange = (college: string, column: string, value: string) => {
    if (column === 'department') {
      setDepartmentFilter(prev => ({ ...prev, [college]: value }));
    } else if (column === 'semester') {
      setSemesterFilter(prev => ({ ...prev, [college]: value }));
    } else if (column === 'courseName') {
      setCourseNameFilter(prev => ({ ...prev, [college]: value }));
    }
  };

  const clearFilter = (college: string, column: string) => {
    handleFilterChange(college, column, '');
    setActiveFilterColumn(null);
  };

  const renderFilterableHeader = (college: string, column: string, title: string) => {
    const isActive = activeFilterColumn?.college === college && activeFilterColumn?.column === column;
    
    if (isActive) {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={
              column === 'department' ? departmentFilter[college] || '' :
              column === 'semester' ? semesterFilter[college] || '' :
              courseNameFilter[college] || ''
            }
            onChange={(e) => handleFilterChange(college, column, e.target.value)}
            placeholder={`Filter ${title.toLowerCase()}...`}
            className="h-8 text-sm"
            autoFocus
            onBlur={() => setActiveFilterColumn(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setActiveFilterColumn(null);
              }
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearFilter(college, column)}
            className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <button
        onClick={() => handleFilterClick(college, column)}
        className="flex items-center gap-1 text-left hover:text-primary transition-colors"
      >
        {title}
        <Search className="h-3 w-3 opacity-50" />
      </button>
    );
  };

  // Add Google sign-in handler
  const handleGoogleSignIn = async() => {
    // TODO: Implement Google OAuth logic here
    let mockUser: User;
    try {
      // Step 1: Sign in with Firebase Google Popup
      
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      if (!firebaseUser) {
        throw new Error("Firebase authentication failed: no user data returned.");
      }

      const email = firebaseUser.email;
      const name = firebaseUser.displayName;

      if (!email) {
        // Email is crucial for your backend according to the plan
        throw new Error("Firebase authentication failed: email not available.");
      }

      console.log("Firebase Google Login successful. User:", name, email);
      mockUser = { id:'',name: name, email: email };
      setCurrentUser(mockUser);
      sessionStorage.setItem('user', JSON.stringify(mockUser));
        

    } catch (err:any) {
      console.error("Error in handleGoogleLogin:", err);
      const newErrors: Record<string, string> = {};
      let friendlyMessage = "An unexpected error occurred during Google login";

      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        friendlyMessage = "Incorrect email or password";
      } else if (err.code === "auth/user-not-found") {
        friendlyMessage = "No user found with this email";
      } else if (err.code === "auth/too-many-requests") {
        friendlyMessage = "Too many failed attempts. Try again later";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address";
      } else if (err.code === 'auth/popup-closed-by-user') {
          newErrors.name = "Google Sign-In was cancelled";
      } else if (err.message.includes("verify your email")) {
        friendlyMessage = err.message;
      }
      newErrors.password = friendlyMessage;
      setErrors(newErrors);
      return;
    }

    if (!courseIdForAuth && !pendingCourseRequest) {
      toast({
        title: 'Authentication Error',
        description: 'Could not determine which course was requested.',
        variant: 'destructive',
      });
      setIsAuthModalOpen(false);
      return;
    }

    // If this was a course request from the modal, submit it now
    if (pendingCourseRequest) {
      await submitCourseRequest(pendingCourseRequest);
      setPendingCourseRequest(null);
      setIsAuthModalOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
      return;
    }

    if (courseIdForAuth) {
      try {
        const response = await fetch(googleAppScriptURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'sheetName': 'Responses',
            'id': courseIdForAuth,
            'name': mockUser.name,
            'email': mockUser.email,
          }).toString(),
        });
        const data = await response.json();

        if (data.result.startsWith('Error')) {
          console.error('Error updating Google Sheets:', data.result);
          toast({
            title: 'Update Failed',
            description: `Failed to authenticate: ${data.result}`,
            variant: 'destructive',
          });
        } else if (data.result.startsWith('Skipped')) { 
          toast({
            title: 'Hey..One Quick Thing!',
            description: 'I guess you have already requested for this course',
          });
        } else {
          console.log('Google Sheets updated successfully:', data.result);
          // Add course to requested courses and show upload tooltip
          updateRequestedCourses(courseIdForAuth);
          setShowUploadTooltip(courseIdForAuth);
          // Auto-hide tooltip after 5 seconds
          setTimeout(() => setShowUploadTooltip(null), 5000);
          toast({
            title: 'Behold!',
            description: 'You have logged in successfully',
          });
        }
        fetchData();
      } catch (error) {
        console.error('Error during Google Sheets API call:', error);
        toast({
          title: 'Network Error',
          description: 'Could not connect to the sheet update service.',
          variant: 'destructive',
        });
      } finally {
        setIsAuthModalOpen(false);
        setAuthForm({ name: '', email: '', password: '' });
        setCourseIdForAuth(null);
      }
      
    }

    setIsAuthModalOpen(false);
    setAuthForm({ name: '', email: '', password: '' });
    setCourseIdForAuth(null);

    /*toast({
      title: 'Google Sign-In',
      description: 'Google sign-in clicked (implement OAuth logic).',
    });*/
    return;
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(prev => {
        const newFiles = Array.from(event.target.files);
        // Avoid duplicates by name
        const existingNames = new Set(prev.map(f => f.name));
        const filtered = newFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...filtered];
      });
    }
  };
  
  const handleUploadDocs = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select one or more files to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!uploadModalCourse) {
      toast({
        title: 'Course Information Missing',
        description: 'Unable to determine course information for upload.',
        variant: 'destructive',
      });
      return;
    }
  
    setUploading(true);

    try {
      // Use Google Drive API to upload files
      const result = await googleDriveService.uploadFilesToCourseDirectory(
        selectedFiles,
        uploadModalCourse.id,
        uploadModalCourse.course
      );

      if (result.success) {
        const successMessage = result.uploadedFiles.length === selectedFiles.length
          ? 'All files have been uploaded successfully!'
          : `${result.uploadedFiles.length} out of ${selectedFiles.length} files uploaded successfully.`;

        toast({
          title: 'Upload Successful',
          description: successMessage,
        });

        // Show errors if any files failed to upload
        if (result.errors.length > 0) {
          console.warn('Some files failed to upload:', result.errors);
          toast({
            title: 'Partial Upload',
            description: `${result.errors.length} files failed to upload. Check console for details.`,
            variant: 'destructive',
          });
        }

        setSelectedFiles([]);
        setIsUploadModalOpen(false);
      } else {
        throw new Error('No files were uploaded successfully');
      }
    } catch (error) {
      console.error('Upload failed', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'There was a problem uploading your files. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };
  

  return (
    <div className="min-h-screen bg-gradient-background">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground bg-gradient-primary bg-clip-text text-transparent">
              Course Popularity Leaderboard
            </h1>
            <p className="text-muted-foreground mt-2">Discover and request courses from top universities</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/*{currentUser ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground hidden sm:inline">Welcome, {currentUser.name}</span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsAuthModalOpen(true)} variant="outline">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            )}*/}
            
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground font-medium px-4 lg:px-6 py-3 rounded-lg shadow-elegant">
                  <Plus className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Request a Course</span>
                  <span className="sm:hidden">Request</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add College / Course</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      University Name
                    </label>
                    <div className="relative">
                      <Input
                        value={modalForm.college}
                        onChange={(e) => {
                          setModalForm(prev => ({ ...prev, college: e.target.value }));
                          setShowCollegeSuggestions(e.target.value.length > 0);
                        }}
                        onFocus={() => setShowCollegeSuggestions(modalForm.college.length > 0)}
                        onBlur={() => {
                          // Delay hiding suggestions to allow for clicks
                          setTimeout(() => setShowCollegeSuggestions(false), 200);
                        }}
                        placeholder="Type university name..."
                        className="w-full"
                      />
                      
                      {/* Suggestions Dropdown */}
                      {showCollegeSuggestions && getCollegeSuggestions().length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {getCollegeSuggestions().map((college) => (
                            <button
                              key={college}
                              type="button"
                              onClick={() => {
                                setModalForm(prev => ({ ...prev, college }));
                                setShowCollegeSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
                            >
                              {college}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Semester
                    </label>
                    <Select 
                      value={modalForm.semester} 
                      onValueChange={(value) => setModalForm(prev => ({ ...prev, semester: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select semester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Semester 1</SelectItem>
                        <SelectItem value="2">Semester 2</SelectItem>
                        <SelectItem value="3">Semester 3</SelectItem>
                        <SelectItem value="4">Semester 4</SelectItem>
                        <SelectItem value="5">Semester 5</SelectItem>
                        <SelectItem value="6">Semester 6</SelectItem>
                        <SelectItem value="7">Semester 7</SelectItem>
                        <SelectItem value="8">Semester 8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Course Name
                    </label>
                    <Input
                      value={modalForm.courseName}
                      onChange={(e) => setModalForm(prev => ({ ...prev, courseName: e.target.value }))}
                      placeholder="Enter course name"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Department
                    </label>
                    <Input
                      value={modalForm.department}
                      onChange={(e) => setModalForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter department"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <Button 
                      onClick={handleModalSubmit}
                      className="flex-1"
                      disabled={!modalForm.college || !modalForm.semester || !modalForm.courseName || !modalForm.department || courseRequestLoading}
                    >
                      {courseRequestLoading ? (
                        <span className="flex items-center">
                          <span className="animate-spin mr-2 h-4 w-4 border-2 border-t-transparent border-white rounded-full inline-block align-middle"></span>
                          Submitting...
                        </span>
                      ) : (
                        'Submit Request'
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Controls */}
        <Card className="p-4 lg:p-6 mb-6 shadow-card">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter colleges..."
                  value={collegeFilter}
                  onChange={(e) => setCollegeFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleSort('name')}
                className={`${sortBy === 'name' ? 'bg-accent' : ''} text-sm`}
                size="sm"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">College Name</span>
                <span className="sm:hidden">Name</span>
                {sortBy === 'name' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleSort('requests')}
                className={`${sortBy === 'requests' ? 'bg-accent' : ''} text-sm`}
                size="sm"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Total Requests</span>
                <span className="sm:hidden">Requests</span>
                {sortBy === 'requests' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </Button>
            </div>
          </div>
        </Card>

        {/* College List */}
        <div className="space-y-4">
          {collegeData.map(({ name: collegeName, courses: collegeCourses, totalRequests }) => (
            <Card key={collegeName} className="overflow-visible shadow-card">
              {/* College Header */}
              <button
                onClick={() => toggleCollege(collegeName)}
                className="w-full px-4 lg:px-6 py-4 bg-card hover:bg-accent transition-colors text-left flex items-center justify-between"
              >
                <div>
                  <h3 className="text-lg lg:text-xl font-semibold text-foreground">{collegeName}</h3>
                  <p className="text-muted-foreground mt-1 text-sm lg:text-base">
                    Total requests: {totalRequests}
                  </p>
                </div>
                {expandedColleges.has(collegeName) ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {/* Expanded Content */}
              {expandedColleges.has(collegeName) && (
                <div className="border-t">
                  {/* Mobile Filters */}
                  <div className="md:hidden p-4 border-b bg-muted/50">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Department..."
                        value={departmentFilter[collegeName] || ''}
                        onChange={(e) => handleFilterChange(collegeName, 'department', e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        placeholder="Semester..."
                        value={semesterFilter[collegeName] || ''}
                        onChange={(e) => handleFilterChange(collegeName, 'semester', e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        placeholder="Course..."
                        value={courseNameFilter[collegeName] || ''}
                        onChange={(e) => handleFilterChange(collegeName, 'courseName', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Desktop Table Layout */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">
                            {renderFilterableHeader(collegeName, 'department', 'Department')}
                          </th>
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">
                            {renderFilterableHeader(collegeName, 'semester', 'Semester')}
                          </th>
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">
                            {renderFilterableHeader(collegeName, 'courseName', 'Course Name')}
                          </th>
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">Course Status</th>
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">Request Progress</th>
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredCourses(collegeCourses, collegeName).map(course => {
                          const progressPercentage = Math.min((course.requestCount / 25) * 100, 100);
                          const isComplete = course.requestCount >= 25;
                          // const hasRequested = userRequests.has(course.id); // No longer needed

                          return (
                            <tr key={course.id} className="border-b last:border-b-0 hover:bg-accent/50 transition-colors">
                              <td className="p-4 text-foreground text-sm">{course.department}</td>
                              <td className="p-4 text-foreground text-sm">{course.semester}</td>
                              <td className="p-4 text-foreground font-medium text-sm">{course.course}</td>
                              <td className="p-4">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                  course.status === 'active' ? 'bg-success/20 text-success' :
                                  course.status === 'progress' ? 'bg-info/20 text-info' :
                                  'bg-warning/20 text-warning'
                                }`}>
                                  {course.status === 'active' ? 'Active' :
                                   course.status === 'progress' ? 'In Pipeline' :
                                   'Request Needed'}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="space-y-2 min-w-[120px]">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span className="font-medium text-foreground">
                                      {course.requestCount}/25
                                    </span>
                                  </div>
                                  <Progress 
                                    value={progressPercentage} 
                                    className={`h-2 ${isComplete ? 'bg-progress-complete/20' : 'bg-progress-incomplete/20'}`}
                                  />
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleRequest(course.id)}
                                    className={"transform hover:scale-105 transition-all duration-200 shadow-md bg-gradient-primary hover:opacity-90 text-primary-foreground"}
                                    disabled={processingCourseId === course.id}
                                  >
                                    {processingCourseId === course.id ? (
                                      <span className="flex items-center">
                                        <span className="animate-spin mr-2 h-4 w-4 border-2 border-t-transparent border-white rounded-full inline-block align-middle"></span>
                                        Processing...
                                      </span>
                                    ) : (
                                      "Request"
                                    )}
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleShare(course)}
                                    className="hover:bg-info hover:text-info-foreground"
                                  >
                                    <Share2 className="h-4 w-4" />
                                  </Button>

                                  {/* Upload Button - only active after request */}
                                  <div className="relative">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUpload(course)}
                                                                        className={`hover:bg-upload hover:text-upload-foreground transition-all duration-200 ${
                                    requestedCourses.has(course.id) || newlySubmittedCourses.has(`${course.college}-${course.department}-${course.course}-${course.semester}`)
                                      ? 'bg-upload/10 text-upload border-upload/30' 
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                                  disabled={!requestedCourses.has(course.id) && !newlySubmittedCourses.has(`${course.college}-${course.department}-${course.course}-${course.semester}`)}
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                    
                                    {/* Upload Tooltip */}
                                    {showUploadTooltip === course.id && (requestedCourses.has(course.id) || newlySubmittedCourses.has(`${course.college}-${course.department}-${course.course}-${course.semester}`)) && (
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-upload text-upload-foreground text-xs rounded-lg shadow-lg whitespace-nowrap z-50 animate-in fade-in-0 zoom-in-95 duration-200 max-w-xs break-words">
                                        Can you upload some course materials?
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-upload"></div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {course.status === 'active' && (
                                    <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground">
                                      <Book className="h-4 w-4 mr-2" />
                                      Learn Now
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                   {/* Mobile Layout */}
                   <div className="md:hidden">
                     {getFilteredCourses(collegeCourses, collegeName).map(course => {
                       const progressPercentage = Math.min((course.requestCount / 25) * 100, 100);
                       const isComplete = course.requestCount >= 25;
                       // const hasRequested = userRequests.has(course.id); // No longer needed

                       return (
                         <div key={course.id} className="border-b last:border-b-0 hover:bg-accent/50 transition-colors p-4 space-y-3">
                           <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <h4 className="font-medium text-foreground">{course.course}</h4>
                               <p className="text-sm text-muted-foreground">{course.department} • Semester {course.semester}</p>
                               <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full mt-1 ${
                                 course.status === 'active' ? 'bg-success/20 text-success' :
                                 course.status === 'progress' ? 'bg-info/20 text-info' :
                                 'bg-warning/20 text-warning'
                               }`}>
                                 {course.status === 'active' ? 'Active' :
                                  course.status === 'progress' ? 'In Pipeline' :
                                  'Request Needed'}
                               </span>
                             </div>
                           </div>
                           
                           {/* Mobile Progress */}
                           <div className="space-y-2">
                             <div className="flex justify-between text-sm">
                               <span className="text-muted-foreground">Progress</span>
                               <span className="font-medium text-foreground">
                                 {course.requestCount}/25
                               </span>
                             </div>
                             <Progress 
                               value={progressPercentage} 
                               className={`h-2 ${isComplete ? 'bg-progress-complete/20' : 'bg-progress-incomplete/20'}`}
                             />
                           </div>

                            {/* Mobile Actions */}
                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                size="sm"
                                onClick={() => handleRequest(course.id)}
                                className={"transform hover:scale-105 transition-all duration-200 shadow-md flex-1 bg-gradient-primary hover:opacity-90 text-primary-foreground"}
                                disabled={processingCourseId === course.id}
                              >
                                {processingCourseId === course.id ? (
                                  <span className="flex items-center">
                                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-t-transparent border-white rounded-full inline-block align-middle"></span>
                                    Processing...
                                  </span>
                                ) : (
                                  "Request"
                                )}
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleShare(course)}
                                className="hover:bg-info hover:text-info-foreground"
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>

                              {/* Mobile Upload Button */}
                              <div className="relative">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpload(course)}
                                  className={`hover:bg-upload hover:text-upload-foreground transition-all duration-200 ${
                                    requestedCourses.has(course.id) || newlySubmittedCourses.has(`${course.college}-${course.department}-${course.course}-${course.semester}`)
                                      ? 'bg-upload/10 text-upload border-upload/30' 
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                                  disabled={!requestedCourses.has(course.id) && !newlySubmittedCourses.has(`${course.college}-${course.department}-${course.course}-${course.semester}`)}
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                                
                                {/* Mobile Upload Tooltip */}
                                {showUploadTooltip === course.id && (requestedCourses.has(course.id) || newlySubmittedCourses.has(`${course.college}-${course.department}-${course.course}-${course.semester}`)) && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-upload text-upload-foreground text-xs rounded-lg shadow-lg whitespace-nowrap z-50 animate-in fade-in-0 zoom-in-95 duration-200 max-w-xs break-words">
                                    Can you upload some course materials?
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-upload"></div>
                                  </div>
                                )}
                              </div>
                              
                              {course.status === 'active' && (
                                <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground">
                                  <Book className="h-4 w-4 mr-2" />
                                  Learn Now
                                </Button>
                              )}
                            </div>
                         </div>
                       );
                     })}
                   </div>
                  
                  {getFilteredCourses(collegeCourses, collegeName).length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No courses match the current filters.
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
          
          {collegeData.length === 0 && (
            <Card className="p-8 text-center">
              {loading ? (
                  <p className="text-muted-foreground">Loading courses...</p>
                ) : (
                  <p className="text-muted-foreground">No courses found.</p>
                )}
            </Card>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {authMode === 'signup' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={authForm.name}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    className="pl-10"
                  />
                </div>
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email"
                  className="pl-10"
                />
              </div>
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your password"
                  className="pl-10"
                />
              </div>
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleAuth}
                className="flex-1 bg-gradient-primary hover:opacity-90"
                disabled={!authForm.email || !authForm.password || (authMode === 'signup' && !authForm.name)}
              >
                {authMode === 'signin' ? (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </div>
            {/* Separator */}
            <div className="flex items-center my-2">
              <div className="flex-1 h-px bg-muted" />
              <span className="mx-2 text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-muted" />
            </div>
            {/* Continue with Google Button */}
            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border border-gray-300"
            >
              {/*<Google className="h-4 w-4" />*/}
              Continue with Google
            </Button>
            <div className="text-center">
              <button
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="text-sm text-primary hover:underline"
              >
                {authMode === 'signin' 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share this Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Share this with your friends and classmates to request this course. 
              You will receive your personalized course hack once the request count crosses 25!
            </p>
            
            {shareModalCourse && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium text-foreground">{shareModalCourse.course}</h4>
                <p className="text-sm text-muted-foreground">
                  {shareModalCourse.college} • {shareModalCourse.department}
                </p>
                <p className="text-sm text-foreground mt-2">
                  Current requests: {shareModalCourse.requestCount}/25
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Input 
                value={shareModalCourse ? (
                  shareModalCourse.status === 'active' 
                    ? `I have found a cheat code to crack "${shareModalCourse.course}" at ${shareModalCourse.college}. You can directly access it and find out for yourself: ${window.location.href}`
                    : `I have found a cheat code to crack "${shareModalCourse.course}" at the college ${shareModalCourse.college}! Currently ${shareModalCourse.requestCount} folks have voted to unlock it. I need your support in voting to unlock it: ${window.location.href}`
                ) : window.location.href}
                readOnly 
                className="flex-1"
              />
              <Button onClick={copyToClipboard} size="icon" variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            {navigator.share && (
              <Button 
                onClick={handleNativeShare} 
                className="w-full" 
                variant="outline"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share via Apps
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Course Materials</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Accelerate the course unlock by sharing your course curriculum, class notes, question papers and reference book soft copies.
              This will enable stronger customization
            </p>
            
            {uploadModalCourse && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium text-foreground">{uploadModalCourse.course}</h4>
                <p className="text-sm text-muted-foreground">
                  {uploadModalCourse.college} • {uploadModalCourse.department}
                </p>
                <p className="text-sm text-foreground mt-2">
                  Current requests: {uploadModalCourse.requestCount}/25
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-upload/50 transition-colors cursor-pointer"
                onClick={handleFileClick}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const droppedFiles = Array.from(e.dataTransfer.files);
                  setSelectedFiles(prev => {
                    const existingNames = new Set(prev.map(f => f.name));
                    const filtered = droppedFiles.filter(f => !existingNames.has(f.name));
                    return [...prev, ...filtered];
                  });
                }}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOC, PPT, Images (Max 10MB each)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                  multiple
                  hidden
                  onChange={handleFileChange}
                />
              </div>

              {selectedFiles.length > 0 && (
                <ul className="text-sm text-foreground">
                  {selectedFiles.map((file, idx) => (
                    <li key={idx} className="truncate">
                      {file.name}
                    </li>
                  ))}
                </ul>
              )}
              
              <div className="text-xs text-muted-foreground">
                <p>• Accepted formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG</p>
                <p>• Maximum file size: 10MB per file</p>
                <p>• You can upload multiple files</p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                className="flex-1 bg-upload hover:bg-upload/90 text-upload-foreground"
                disabled={selectedFiles.length === 0 || uploading}
                onClick={handleUploadDocs}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsUploadModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseCatalog;
