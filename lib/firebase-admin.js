// lib/firebase-admin.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function initializeAdmin() {
  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountKey) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY is not set in environment variables.');
  }

  if (getApps().length > 0) {
    return {
      adminDb: getFirestore(),
      adminAuth: getAuth(),
    };
  }

  // ✅ **THE FIX IS HERE: We parse the key from the env var and pass the object to cert()**
  const serviceAccount = JSON.parse(serviceAccountKey);
  initializeApp({
    credential: cert(serviceAccount) // Use the parsed object
  });

  return {
    adminDb: getFirestore(),
    adminAuth: getAuth(),
  };
}

export const getFirebaseAdmin = initializeAdmin;