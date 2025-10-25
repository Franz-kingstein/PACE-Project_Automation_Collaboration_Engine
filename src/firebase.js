// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcwvPLdKoK3MJF2nCfe3kcX5cTc5pYXC4",
  authDomain: "pace-cd877.firebaseapp.com",
  projectId: "pace-cd877",
  storageBucket: "pace-cd877.firebasestorage.app",
  messagingSenderId: "891538602468",
  appId: "1:891538602468:web:55e758135152510950eff1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

// Export the instances
export { auth, googleProvider, db, storage };