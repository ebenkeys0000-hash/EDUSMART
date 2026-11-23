import { initializeApp, getApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getServerFirebaseConfig } from './firebase-config-server.ts';

const firebaseConfig = getServerFirebaseConfig();

function getOrInitAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountRaw) {
    try {
      const parsed = JSON.parse(serviceAccountRaw);
      return initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || firebaseConfig.projectId,
      });
    } catch (err) {
      console.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON provided; falling back to projectId init:', err);
    }
  }

  if (!firebaseConfig.projectId) {
    throw new Error(
      'Firebase server configuration is missing projectId. Ensure firebase-applet-config.json or FIREBASE_PROJECT_ID is configured.'
    );
  }

  return initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminApp = getOrInitAdminApp();
export const adminAuth = getAuth(adminApp);

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
}

/**
 * Verifies a Firebase ID token cleanly in both AI Studio and Vercel Serverless.
 * Uses firebase-admin verifyIdToken() first (signature/issuer/audience check via Google certs),
 * and falls back to Google Identity Toolkit accounts:lookup if an environment blocks cert fetch.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: (decoded.email || `${decoded.uid}@firebase.local`).trim().toLowerCase(),
      name: decoded.name,
      picture: decoded.picture,
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch (adminErr: any) {
    // Do NOT swallow invalid/expired token errors if Identity Toolkit API key isn't available
    const apiKey = firebaseConfig.apiKey;
    const msg = String(adminErr?.message || '');
    const isLikelyInvalidToken =
      adminErr?.code === 'auth/id-token-expired' ||
      adminErr?.code === 'auth/argument-error' ||
      msg.includes('Firebase ID token has expired') ||
      msg.includes('Decoding Firebase ID token failed');

    if (!apiKey || isLikelyInvalidToken) {
      throw adminErr;
    }

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) {
      const lookupErr = await res.json().catch(() => null);
      const lookupMsg = lookupErr?.error?.message;
      if (lookupMsg) {
        throw new Error(`${msg || 'Firebase token verification failed'} (${lookupMsg})`);
      }
      throw adminErr;
    }

    const data = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        displayName?: string;
        photoUrl?: string;
        emailVerified?: boolean;
      }>;
    };

    const fbUser = data.users?.[0];
    if (!fbUser?.localId) {
      throw adminErr;
    }

    return {
      uid: fbUser.localId,
      email: (fbUser.email || `${fbUser.localId}@firebase.local`).trim().toLowerCase(),
      name: fbUser.displayName,
      picture: fbUser.photoUrl,
      emailVerified: Boolean(fbUser.emailVerified),
    };
  }
}
