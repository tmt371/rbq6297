// 04-core-code/config/firebase-config.example.js---

// [EXISTING] This is your saved configuration
const firebaseConfig = {
    apiKey: "[在此貼上您的 Google API 金鑰]",
    authDomain: "ezblinds-quote-system.firebaseapp.com",
    projectId: "ezblinds-quote-system",
    storageBucket: "ezblinds-quote-system.firebasestorage.app",
    messagingSenderId: "53955635800",
    appId: "1:53955635800:web:1ff29c52d663de0c8fb82d"
};

// [MODIFIED] Add Firebase initialization logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; // [NEW]

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the Firestore database service
export const db = getFirestore(app);

// [NEW] Export the Auth service
export const auth = getAuth(app);

// [MODIFIED] Export the config as well
export { firebaseConfig };