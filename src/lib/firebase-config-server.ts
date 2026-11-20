import fs from 'node:fs';
import path from 'node:path';

export interface ServerFirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
}

let cachedConfig: ServerFirebaseConfig | null = null;

/**
 * Loads Firebase config cleanly across AI Studio, Node.js ESM, and Vercel Serverless
 * without relying on Node ESM JSON import attributes (`with { type: 'json' }`).
 */
export function getServerFirebaseConfig(): ServerFirebaseConfig {
  if (cachedConfig) return cachedConfig;

  let fileJson: Partial<ServerFirebaseConfig> = {};
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        break;
      }
    } catch {
      // continue checking fallback paths / env vars
    }
  }

  cachedConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || fileJson.projectId || '',
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || fileJson.appId || '',
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || fileJson.apiKey || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || fileJson.authDomain || '',
    firestoreDatabaseId:
      process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
      process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
      fileJson.firestoreDatabaseId ||
      '(default)',
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || fileJson.storageBucket || '',
    messagingSenderId:
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      fileJson.messagingSenderId ||
      '',
    measurementId: fileJson.measurementId || '',
    oAuthClientId: fileJson.oAuthClientId || '',
  };

  return cachedConfig;
}
