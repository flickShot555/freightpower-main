import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyClzYECMNer89EjBs_h12hb5tDIghUslMM",
    authDomain: "freightpowerai-e90fe.firebaseapp.com",
    projectId: "freightpowerai-e90fe",
    storageBucket: "freightpowerai-e90fe.firebasestorage.app",
    messagingSenderId: "529930908639",
    appId: "1:529930908639:web:e86b1112c5a80f60248a6a"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ⚠️ THESE EXPORTS ARE CRITICAL
export const auth = getAuth(app);       // <--- MUST have 'export'
export const db = getFirestore(app);    // <--- MUST have 'export'
export const storage = getStorage(app);
export default app;