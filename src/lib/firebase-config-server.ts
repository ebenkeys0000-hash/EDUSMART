import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  let fileJson: Partial<ServerFirebaseConfig> = {};
  const candidates = [
    path.resolve(currentDir, '../../firebase-applet-config.json'),
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

  const envFirebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim() || '';
  const envViteProjectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim() || '';
  if (envFirebaseProjectId && envViteProjectId && envFirebaseProjectId !== envViteProjectId) {
    throw new Error(
      `Conflicting server/client Firebase project IDs: FIREBASE_PROJECT_ID="${envFirebaseProjectId}" vs VITE_FIREBASE_PROJECT_ID="${envViteProjectId}".`
    );
  }

  const overrideProjectId = envFirebaseProjectId || envViteProjectId;
  const isCustomProject = Boolean(
    overrideProjectId && fileJson.projectId && overrideProjectId !== fileJson.projectId
  );

  if (isCustomProject) {
    cachedConfig = {
      projectId: overrideProjectId,
      appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '',
      apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      firestoreDatabaseId:
        process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
        process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
        '(default)',
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId:
        process.env.FIREBASE_MESSAGING_SENDER_ID ||
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
        '',
      measurementId: '',
      oAuthClientId: '',
    };
    return cachedConfig;
  }

  cachedConfig = {
    projectId: overrideProjectId || fileJson.projectId || '',
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
