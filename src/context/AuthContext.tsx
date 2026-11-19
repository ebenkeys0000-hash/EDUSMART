import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiRequest, setFirebaseTokenProvider, setMemoryAuthToken } from '../lib/api.ts';
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

  useEffect(() => {
    setFirebaseTokenProvider(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return await current.getIdToken();
    });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          setMemoryAuthToken(null); // rely on Firebase ID token provider
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setSchool(data.school);
            if (data.user?.preferredLang) setLangState(data.user.preferredLang);
          }
        } catch (err) {
          console.error('Firebase session sync error:', err);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

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
    if (data.user.preferredLang) setLangState(data.user.preferredLang);
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
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setMemoryAuthToken(null);
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Google authentication failed.');
    }
    setUser(data.user);
    setSchool(data.school);
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
