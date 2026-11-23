import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function resolveClientFirebaseConfig() {
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || '';
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() || '';
  const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '';
  const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || '';
  const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '';
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '';
  const envDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim() || '';

  const hasCustomOverride = Boolean(envProjectId && envProjectId !== firebaseConfig.projectId);

  if (hasCustomOverride) {
    if (!envApiKey || !envAuthDomain || !envAppId) {
      throw new Error(
        `Incomplete custom Firebase override for project "${envProjectId}". Provide all matching VITE_FIREBASE_* variables without mixing with "${firebaseConfig.projectId}".`
      );
    }
    return {
      apiKey: envApiKey,
      authDomain: envAuthDomain,
      projectId: envProjectId,
      storageBucket: envStorageBucket,
      messagingSenderId: envMessagingSenderId,
      appId: envAppId,
      firestoreDatabaseId: envDatabaseId || '(default)',
    };
  }

  // Prevent accidentally overriding individual credentials from another Firebase project
  if (
    (envApiKey && envApiKey !== firebaseConfig.apiKey) ||
    (envAppId && envAppId !== firebaseConfig.appId) ||
    (envAuthDomain && envAuthDomain !== firebaseConfig.authDomain)
  ) {
    throw new Error(
      `Detected partial VITE_FIREBASE_* credentials that do not match project "${firebaseConfig.projectId}". Set matching VITE_FIREBASE_PROJECT_ID and full config to avoid mixing Firebase projects.`
    );
  }

  return {
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    firestoreDatabaseId: envDatabaseId || firebaseConfig.firestoreDatabaseId || '(default)',
  };
}

const resolvedFirebaseConfig = resolveClientFirebaseConfig();

const app = getApps().length ? getApp() : initializeApp(resolvedFirebaseConfig);

export const db =
  resolvedFirebaseConfig.firestoreDatabaseId &&
  resolvedFirebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
