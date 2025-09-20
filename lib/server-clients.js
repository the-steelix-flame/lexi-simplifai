// lib/server-clients.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { Storage } from "@google-cloud/storage";

// These variables will hold our initialized clients so we don't create them more than once.
let adminApp = null;
let visionClient = null;
let storage = null;

// This is our single, master function to get all server-side clients.
export function getClients() {
  // If clients are already initialized, return them immediately.
  if (adminApp && visionClient && storage) {
    return {
      adminDb: getFirestore(),
      adminAuth: getAuth(),
      visionClient,
      storage,
    };
  }

  // If not initialized, create them.
  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY is not set in environment variables.');
  }
  const credentials = JSON.parse(serviceAccountKey);

  // Initialize Firebase Admin (only if it doesn't exist)
  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert(credentials)
    });
  } else {
    adminApp = getApps()[0];
  }

  // Initialize Google Cloud Clients
  visionClient = new ImageAnnotatorClient({ credentials });
  storage = new Storage({ credentials });

  return {
    adminDb: getFirestore(),
    adminAuth: getAuth(),
    visionClient,
    storage,
  };
}