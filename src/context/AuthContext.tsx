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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (payload: Record<string, unknown>) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const googleSyncPromiseRef = useRef<Promise<void> | null>(null);

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

    const run = (async () => {
      setMemoryAuthToken(null);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Google authentication synchronization failed.');
      }
      setUser(data.user);
      setSchool(data.school);
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

    // Process any pending OAuth redirect return first
    getRedirectResult(auth)
      .then(async (result) => {
        if (!cancelled && result?.user) {
          const token = await result.user.getIdToken();
          await syncFirebaseUserWithBackend(token);
        }
      })
      .catch((err) => {
        console.error('Firebase redirect sign-in error:', err);
      });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const token = await fbUser.getIdToken();
          await syncFirebaseUserWithBackend(token);
        } else {
          // Restore persisted email/password session if present
          const existingLocalToken = await getActiveAuthToken();
          if (existingLocalToken) {
            await refreshSession();
          }
        }
      } catch (err) {
        console.error('Session initialization sync error:', err);
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
    const data = await apiRequest<{
      token: string;
      user: UserProfile;
      school: SchoolProfile | null;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setMemoryAuthToken(data.token);
    setUser(data.user);
    setSchool(data.school);
    if (data.user.preferredLang === 'en' || data.user.preferredLang === 'fr') {
      setLangState(data.user.preferredLang);
    }
  };

  const registerWithEmail = async (payload: Record<string, unknown>) => {
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
    if (data.verificationCodePreview) {
      setVerificationCodePreview(data.verificationCodePreview);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      await syncFirebaseUserWithBackend(idToken);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        throw new Error(
          lang === 'fr'
            ? `Domaine non autorisé dans Firebase (${host}). Ajoutez-le dans Firebase Console → Authentication → Settings → Authorized domains.`
            : `Unauthorized Firebase domain (${host}). Add it in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error(
          lang === 'fr'
            ? 'Fenêtre Google fermée avant la fin de la connexion.'
            : 'Google sign-in popup was closed before completing.'
        );
      }
      throw err;
    }
  };

  const logout = async () => {
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
