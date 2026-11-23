import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  apiRequest,
  getActiveAuthToken,
  setFirebaseTokenProvider,
  setMemoryAuthToken,
} from '../lib/api.ts';
import { Lang } from '../lib/i18n.ts';
import {
  computeTrialAndSubscriptionState,
  SubscriptionRuntimeState,
} from '../lib/subscriptionCatalog.ts';

export interface UserProfile {
  id: number;
  uid: string;
  schoolId: number | null;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  role: 'super_admin' | 'school_admin' | 'accountant' | 'teacher' | 'parent' | 'student';
  status: string;
  emailVerified: boolean;
  linkedTeacherId: number | null;
  linkedParentId: number | null;
  linkedStudentId: number | null;
  preferredLang: Lang;
}

export interface SchoolProfile {
  id: number;
  name: string;
  code: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  currency: string;
  academicSystem: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionRenewsAt: string;
  billingCycle?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialUsed?: boolean;
  subscriptionStartedAt?: string;
  createdAt?: string;
  profileCompleted: boolean;
}

interface AuthContextValue {
  user: UserProfile | null;
  school: SchoolProfile | null;
  subscriptionState: SubscriptionRuntimeState;
  loading: boolean;
  lang: Lang;
  setLang: (lang: Lang) => void;
  verificationCodePreview: string | null;
  setVerificationCodePreview: (code: string | null) => void;
  authError: string | null;
  clearAuthError: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (payload: Record<string, unknown>) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatFirebaseAuthError(err: any, currentLang: Lang): Error {
  const code = String(err?.code || '');
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return new Error(
      currentLang === 'fr'
        ? `Domaine non autorisé dans Firebase (${host}). Ajoutez-le dans Firebase Console → Authentication → Settings → Authorized domains.`
        : `Unauthorized Firebase domain (${host}). Add it in Firebase Console → Authentication → Settings → Authorized domains.`
    );
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error(
      currentLang === 'fr'
        ? 'La connexion Google n’est pas activée dans Firebase Console (Authentication → Sign-in method → Google).'
        : 'Google sign-in provider is not enabled in Firebase Console (Authentication → Sign-in method → Google).'
    );
  }
  if (code === 'auth/network-request-failed') {
    return new Error(
      currentLang === 'fr'
        ? 'Erreur réseau lors de la communication avec Firebase Authentication. Vérifiez votre connexion.'
        : 'Network error communicating with Firebase Authentication. Please check your connection.'
    );
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return new Error(
      currentLang === 'fr'
        ? 'Un compte existe déjà avec cette adresse e-mail via un autre fournisseur de connexion.'
        : 'An account already exists with this email using a different sign-in provider.'
    );
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return new Error(
      currentLang === 'fr'
        ? 'Fenêtre Google fermée avant la fin de la connexion.'
        : 'Google sign-in popup was closed before completing.'
    );
  }
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err || 'Google authentication failed.'));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = window.localStorage.getItem('edusmart_lang');
      if (saved === 'en' || saved === 'fr') return saved;
    } catch {
      // ignore
    }
    return 'fr';
  });
  const [verificationCodePreview, setVerificationCodePreview] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const googleSyncPromiseRef = useRef<Promise<void> | null>(null);
  const langRef = useRef<Lang>(lang);
  langRef.current = lang;

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        window.localStorage.setItem('edusmart_lang', next);
      } catch {
        // ignore
      }
      if (user) {
        apiRequest('/api/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ preferredLang: next }),
        }).catch(() => {});
      }
    },
    [user]
  );

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: UserProfile; school: SchoolProfile | null }>(
        '/api/auth/me'
      );
      setUser(data.user);
      setSchool(data.school);
      if (data.user.preferredLang === 'en' || data.user.preferredLang === 'fr') {
        setLangState(data.user.preferredLang);
      }
    } catch {
      setUser(null);
      setSchool(null);
    }
  }, []);

  const syncFirebaseUserWithBackend = useCallback(async (idToken: string) => {
    if (googleSyncPromiseRef.current) {
      return googleSyncPromiseRef.current;
    }

    const postSync = async (tokenToSend: string) => {
      return fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToSend}`,
        },
      });
    };

    const run = (async () => {
      setMemoryAuthToken(null);
      setAuthError(null);

      let res = await postSync(idToken);
      if (res.status === 401 && auth.currentUser) {
        const refreshedToken = await auth.currentUser.getIdToken(true);
        if (refreshedToken && refreshedToken !== idToken) {
          res = await postSync(refreshedToken);
        }
      }

      const rawText = await res.text();
      let data: any = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        const serverDetail =
          data?.error ||
          (rawText ? `${rawText.replace(/<[^>]+>/g, ' ').trim().slice(0, 180)}` : '');
        const message = serverDetail
          ? serverDetail
          : `Google authentication synchronization failed (HTTP ${res.status}).`;
        if (res.status === 401 || res.status === 403) {
          await signOut(auth).catch(() => {});
        }
        throw new Error(message);
      }

      if (!data?.user) {
        throw new Error('Google synchronization succeeded but returned no user profile.');
      }

      setUser(data.user);
      setSchool(data.school ?? null);
      if (data.user?.preferredLang === 'en' || data.user?.preferredLang === 'fr') {
        setLangState(data.user.preferredLang);
      }
    })();

    googleSyncPromiseRef.current = run;
    try {
      await run;
    } finally {
      googleSyncPromiseRef.current = null;
    }
  }, []);

  useEffect(() => {
    setFirebaseTokenProvider(async (forceRefresh = false) => {
      const current = auth.currentUser;
      if (!current) return null;
      return await current.getIdToken(forceRefresh);
    });

    let cancelled = false;

    const redirectPromise = getRedirectResult(auth)
      .then(async (result) => {
        if (!cancelled && result?.user) {
          const token = await result.user.getIdToken();
          await syncFirebaseUserWithBackend(token);
        }
      })
      .catch((err) => {
        console.error('Firebase redirect sign-in error:', err);
        if (!cancelled) {
          setAuthError(formatFirebaseAuthError(err, langRef.current).message);
        }
      });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        await redirectPromise;
        if (fbUser) {
          const token = await fbUser.getIdToken();
          await syncFirebaseUserWithBackend(token);
        } else {
          const existingLocalToken = await getActiveAuthToken();
          if (existingLocalToken) {
            await refreshSession();
          }
        }
      } catch (err: any) {
        console.error('Session initialization sync error:', err);
        if (!cancelled && fbUser) {
          setAuthError(formatFirebaseAuthError(err, langRef.current).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [refreshSession, syncFirebaseUserWithBackend]);

  const loginWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    const data = await apiRequest<{
      token: string;
      user: UserProfile;
      school: SchoolProfile | null;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    setMemoryAuthToken(data.token);
    setUser(data.user);
    setSchool(data.school);
    if (data.user.preferredLang === 'en' || data.user.preferredLang === 'fr') {
      setLangState(data.user.preferredLang);
    }
  };

  const registerWithEmail = async (payload: Record<string, unknown>) => {
    setAuthError(null);
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    const data = await apiRequest<{
      token: string;
      user: UserProfile;
      school: SchoolProfile | null;
      verificationCodePreview?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMemoryAuthToken(data.token);
    setUser(data.user);
    setSchool(data.school);
    if (data.user.preferredLang === 'en' || data.user.preferredLang === 'fr') {
      setLangState(data.user.preferredLang);
    }
    if (data.verificationCodePreview) {
      setVerificationCodePreview(data.verificationCodePreview);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken(true);
      await syncFirebaseUserWithBackend(idToken);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      throw formatFirebaseAuthError(err, lang);
    }
  };

  const logout = async () => {
    setAuthError(null);
    setMemoryAuthToken(null);
    setUser(null);
    setSchool(null);
    setVerificationCodePreview(null);
    await signOut(auth).catch(() => {});
  };

  const subscriptionState = computeTrialAndSubscriptionState(school);

  return (
    <AuthContext.Provider
      value={{
        user,
        school,
        subscriptionState,
        loading,
        lang,
        setLang,
        verificationCodePreview,
        setVerificationCodePreview,
        authError,
        clearAuthError,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
