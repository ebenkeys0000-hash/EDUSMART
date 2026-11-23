import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { SchoolOnboarding } from './components/SchoolOnboarding.tsx';
import { AppShell } from './components/AppShell.tsx';
import { IdCardVerificationPage } from './components/IdCardVerificationPage.tsx';
import { BrandLogo } from './components/ui/BrandLogo.tsx';
import { BillingCycle, SubscriptionPlanKey } from './lib/subscriptionCatalog.ts';

function getInitialVerifyCode(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const q = params.get('verify');
  if (q && q.trim()) return q.trim();
  const pathMatch = /^\/verify\/([^/]+)/i.exec(window.location.pathname);
  if (pathMatch && pathMatch[1]) return decodeURIComponent(pathMatch[1]);
  return null;
}

const RootRouter: React.FC = () => {
  const { user, school, loading, authError } = useAuth();
  const [authModalState, setAuthModalState] = useState<{
    mode: 'login' | 'register';
    planKey?: SubscriptionPlanKey;
    billingCycle?: BillingCycle;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState<string | null>(() => getInitialVerifyCode());

  useEffect(() => {
    const onPop = () => setVerifyCode(getInitialVerifyCode());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!loading && !user && authError && !authModalState) {
      setAuthModalState({ mode: 'login' });
    }
  }, [loading, user, authError, authModalState]);

  if (verifyCode) {
    return (
      <IdCardVerificationPage
        verificationCode={verifyCode}
        onExit={() => {
          setVerifyCode(null);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-slate-950">
        <div className="text-center space-y-3">
          <div className="mx-auto flex justify-center">
            <BrandLogo size="xl" />
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Chargement de votre espace sécurisé EduSmart...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode, opts) =>
            setAuthModalState({
              mode,
              planKey: opts?.planKey,
              billingCycle: opts?.billingCycle,
            })
          }
        />
        {authModalState && (
          <AuthModal
            initialMode={authModalState.mode}
            initialPlanKey={authModalState.planKey}
            initialBillingCycle={authModalState.billingCycle}
            onClose={() => setAuthModalState(null)}
          />
        )}
      </>
    );
  }

  if ((!user.schoolId || !school || !school.profileCompleted) && user.role !== 'super_admin') {
    return <SchoolOnboarding />;
  }

  return <AppShell />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
