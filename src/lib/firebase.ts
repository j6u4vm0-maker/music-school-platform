import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA-Wb8TrrajxIFh4NOE23hr3qyY0nxSckE",
  authDomain: "musicschoolsystem-e3557.firebaseapp.com",
  projectId: "musicschoolsystem-e3557",
  storageBucket: "musicschoolsystem-e3557.firebasestorage.app",
  messagingSenderId: "766592247498",
  appId: "1:766592247498:web:e8cc2def908de850aaf633",
  measurementId: "G-FEFE64V41H"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

// Force LocalStorage persistence so Playwright can capture it in storageState
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence);
}
