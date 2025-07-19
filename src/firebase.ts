import { initializeApp } from "firebase/app";
import { getAuth,GoogleAuthProvider  } from "firebase/auth";

/*const firebaseConfig = {
  apiKey: import.meta.env.VITE_REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_REACT_APP_FIREBASE_APP_ID,

};*/

const firebaseConfig = {
  apiKey: 'AIzaSyAd9Yfb8PEGtYVHA-FltFEgoaM4vB2TLBA',
  authDomain: 'kplor-7aded.firebaseapp.com',
  projectId: 'kplor-7aded',
  storageBucket: 'kplor-7aded.firebasestorage.app',
  messagingSenderId: '549165637830',
  appId: '1:549165637830:web:f7cd632ed84503ba6377c7',

};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };