/**
 * KALA-MITRA Firebase Configuration for Free SMS OTP Authentication
 * Provides 10,000 FREE SMS messages per month worldwide (including India +91).
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Real Firebase Configuration for project: kala-mitra-74afb
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAV3Oalok1_9nyTkr1KHIAwfjFGU8pJ-Lk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "kala-mitra-74afb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "kala-mitra-74afb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "kala-mitra-74afb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "506498684056",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:506498684056:web:209b4f0a58484334e62ced",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-4LC84Y08ZB"
};

let app;
let auth;

export function initFirebase() {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  auth.useDeviceLanguage();
  return { app, auth };
}

export function getFirebaseAuth() {
  if (!auth) {
    initFirebase();
  }
  return auth;
}

/**
 * Initializes invisible reCAPTCHA for Firebase Phone Auth
 */
export function setupRecaptcha(containerId = 'recaptcha-container') {
  const authInstance = getFirebaseAuth();
  let container = document.getElementById(containerId);
  
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  // Clear existing verifier if any to prevent duplicate widget errors
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch(e) {}
    window.recaptchaVerifier = null;
  }

  try {
    window.recaptchaVerifier = new RecaptchaVerifier(authInstance, containerId, {
      'size': 'invisible',
      'callback': (response) => {
        console.log('Firebase Invisible reCAPTCHA solved.');
      },
      'expired-callback': () => {
        console.warn('Firebase reCAPTCHA expired, resetting...');
      }
    });
  } catch (e) {
    console.error('RecaptchaVerifier setup error:', e);
  }
  return window.recaptchaVerifier;
}

export { signInWithPhoneNumber };
