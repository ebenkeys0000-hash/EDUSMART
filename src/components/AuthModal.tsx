import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { inputBaseClass } from './ui/DesignSystem.tsx';
import { BrandLogo } from './ui/BrandLogo.tsx';
import {
  BillingCycle,
  DEFAULT_SUBSCRIPTION_PLANS,
  SubscriptionPlanKey,
} from '../lib/subscriptionCatalog.ts';

interface AuthModalProps {
  initialMode: 'login' | 'register';
  initialPlanKey?: SubscriptionPlanKey;
  initialBillingCycle?: BillingCycle;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode,
  initialPlanKey = 'multi_niveaux',
  initialBillingCycle = 'monthly',
  onClose,
}) => {
  const { lang, loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [registerType, setRegisterType] = useState<'create_school' | 'join_school'>('create_school');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resetPreview, setResetPreview] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [country, setCountry] = useState('Bénin');
  const [city, setCity] = useState('Cotonou');
  const [currency, setCurrency] = useState('XOF');
  const [academicSystem, setAcademicSystem] = useState('Francophone');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanKey>(initialPlanKey);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const [schoolCode, setSchoolCode] = useState('');
  const [joinRole, setJoinRole] = useState('teacher');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginWithEmail(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await registerWithEmail({
        mode: registerType,
        fullName,
        email,
        password,
        phone,
        schoolName,
        country,
        city,
        currency,
        academicSystem,
        subscriptionPlan,
        billingCycle,
        schoolCode,
        role: joinRole,
        preferredLang: lang,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Connexion Google interrompue.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string; resetCodePreview?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setSuccessMsg(res.message);
      if (res.resetCodePreview) setResetPreview(res.resetCodePreview);
      setMode('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: resetCode, newPassword }),
      });
      setSuccessMsg(res.message);
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative my-8 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-2xl text-slate-900 dark:text-slate-100"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-5 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3.5 pr-8">
          <BrandLogo size="sm" />
          <div>
            <h2 className="font-display text-xl font-bold text-[#082F5E] dark:text-white">
              {mode === 'login' && (lang === 'fr' ? 'Connexion à EduSmart' : 'Sign in to EduSmart')}
              {mode === 'register' &&
                (lang === 'fr' ? 'Créer un compte établissement' : 'Create School Account')}
              {mode === 'forgot' &&
                (lang === 'fr' ? 'Mot de passe oublié' : 'Forgot Password')}
              {mode === 'reset' &&
                (lang === 'fr' ? 'Réinitialiser le mot de passe' : 'Reset Password')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fr'
                ? 'Accès sécurisé et isolé par établissement'
                : 'Secure tenant-isolated school workspace'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p>{successMsg}</p>
              {resetPreview && (
                <p className="mt-1 font-mono-tabular font-bold">
                  Code de réinitialisation : {resetPreview}
                </p>
              )}
            </div>
          </div>
        )}

        {(mode === 'login' || mode === 'register') && (
          <div className="mt-5">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>{lang === 'fr' ? 'Continuer avec Google' : 'Continue with Google'}</span>
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">
                {lang === 'fr' ? 'ou par e-mail' : 'or with email'}
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="direction@ecole.bj"
                className={inputBaseClass}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Mot de passe' : 'Password'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('forgot');
                  }}
                  className="text-xs font-medium text-[#0068C9] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {lang === 'fr' ? 'Mot de passe oublié ?' : 'Forgot password?'}
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputBaseClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#082F5E] dark:bg-[#0068C9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2744] dark:hover:bg-[#1E40AF] transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy
                ? lang === 'fr'
                  ? 'Connexion...'
                  : 'Signing in...'
                : lang === 'fr'
                ? 'Se connecter'
                : 'Sign In'}
            </button>
            <p className="text-center text-xs text-slate-600 dark:text-slate-400">
              {lang === 'fr' ? 'Nouvel établissement ?' : 'New school?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className="font-semibold text-[#082F5E] dark:text-blue-400 hover:underline cursor-pointer"
              >
                {lang === 'fr' ? 'Essai gratuit 30 jours' : 'Start 30-day free trial'}
              </button>
            </p>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setRegisterType('create_school')}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  registerType === 'create_school'
                    ? 'bg-white dark:bg-slate-900 text-[#082F5E] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'fr' ? 'Nouvelle École' : 'New School'}
              </button>
              <button
                type="button"
                onClick={() => setRegisterType('join_school')}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  registerType === 'join_school'
                    ? 'bg-white dark:bg-slate-900 text-[#082F5E] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'fr' ? 'Rejoindre une École' : 'Join Existing School'}
              </button>
            </div>

            {registerType === 'create_school' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Sparkles className="h-4 w-4 shrink-0 text-[#E89E0E] mt-0.5" />
                <div>
                  <p className="font-bold">
                    {lang === 'fr'
                      ? 'Essai gratuit complet de 30 jours inclus'
                      : '30-Day Full Free Trial Included'}
                  </p>
                  <p className="text-[11px] opacity-90">
                    {lang === 'fr'
                      ? '0 FCFA requis aujourd’hui · Aucun débit automatique après les 30 jours.'
                      : '0 FCFA due today · Zero automatic billing after your 30-day trial.'}
                  </p>
                </div>
              </div>
            )}

            {registerType === 'create_school' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'fr' ? "Nom de l'établissement" : 'School Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Collège Privé Excellence Cotonou"
                    className={inputBaseClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'fr' ? 'Pays' : 'Country'}
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={inputBaseClass}
                    >
                      <option value="Bénin">Bénin</option>
                      <option value="Togo">Togo</option>
                      <option value="Côte d'Ivoire">Côte d&apos;Ivoire</option>
                      <option value="Sénégal">Sénégal</option>
                      <option value="Cameroun">Cameroun</option>
                      <option value="Gabon">Gabon</option>
                      <option value="International">International</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'fr' ? 'Ville' : 'City'}
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Cotonou"
                      className={inputBaseClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'fr' ? 'Devise' : 'Currency'}
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className={inputBaseClass}
                    >
                      <option value="XOF">XOF (FCFA UEMOA)</option>
                      <option value="XAF">XAF (FCFA CEMAC)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'fr' ? 'Système scolaire' : 'Academic System'}
                    </label>
                    <select
                      value={academicSystem}
                      onChange={(e) => setAcademicSystem(e.target.value)}
                      className={inputBaseClass}
                    >
                      <option value="Francophone">Francophone</option>
                      <option value="Anglophone">Anglophone</option>
                      <option value="Bilingual">Bilingue</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'fr' ? 'Forfait envisagé (après essai)' : 'Target Plan (Post-Trial)'}
                    </label>
                    <select
                      value={subscriptionPlan}
                      onChange={(e) => setSubscriptionPlan(e.target.value as SubscriptionPlanKey)}
                      className={inputBaseClass}
                    >
                      {DEFAULT_SUBSCRIPTION_PLANS.map((p) => (
                        <option key={p.planKey} value={p.planKey}>
                          {lang === 'fr' ? p.nameFr : p.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'fr' ? 'Rythme' : 'Billing Cycle'}
                    </label>
                    <select
                      value={billingCycle}
                      onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                      className={inputBaseClass}
                    >
                      <option value="monthly">{lang === 'fr' ? 'Mensuel' : 'Monthly'}</option>
                      <option value="annual">{lang === 'fr' ? 'Annuel (-20 %)' : 'Annual (-20%)'}</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'fr' ? 'Code École' : 'School Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    placeholder="EXCELL-1234"
                    className={`${inputBaseClass} uppercase`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'fr' ? 'Rôle' : 'Role'}
                  </label>
                  <select
                    value={joinRole}
                    onChange={(e) => setJoinRole(e.target.value)}
                    className={inputBaseClass}
                  >
                    <option value="teacher">{lang === 'fr' ? 'Enseignant' : 'Teacher'}</option>
                    <option value="accountant">{lang === 'fr' ? 'Comptable' : 'Accountant'}</option>
                    <option value="parent">Parent</option>
                    <option value="student">{lang === 'fr' ? 'Élève' : 'Student'}</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'fr' ? 'Nom complet' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Koffi Mensah"
                  className={inputBaseClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'fr' ? 'Téléphone' : 'Phone'}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+229 97 00 00 00"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ecole.bj"
                  className={inputBaseClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'fr' ? 'Mot de passe (min 6)' : 'Password (min 6)'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#082F5E] dark:bg-[#0068C9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2744] dark:hover:bg-[#1E40AF] transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy
                ? lang === 'fr'
                  ? 'Activation de l’essai gratuit...'
                  : 'Activating Free Trial...'
                : registerType === 'create_school'
                ? lang === 'fr'
                  ? 'Démarrer mes 30 jours gratuits'
                  : 'Start My 30-Day Free Trial'
                : lang === 'fr'
                ? 'Finaliser l’inscription'
                : 'Create Account'}
            </button>
            <p className="text-center text-xs text-slate-600 dark:text-slate-400">
              {lang === 'fr' ? 'Déjà inscrit ?' : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className="font-semibold text-[#082F5E] dark:text-blue-400 hover:underline cursor-pointer"
              >
                {lang === 'fr' ? 'Se connecter' : 'Log in'}
              </button>
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ecole.bj"
                className={inputBaseClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#082F5E] dark:bg-[#0068C9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2744] dark:hover:bg-[#1E40AF] cursor-pointer"
            >
              {lang === 'fr' ? 'Générer un code de réinitialisation' : 'Generate Reset Code'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[#082F5E] dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{lang === 'fr' ? 'Retour à la connexion' : 'Back to login'}</span>
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputBaseClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'fr' ? 'Code à 6 chiffres' : '6-digit Reset Code'}
              </label>
              <input
                type="text"
                required
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className={`${inputBaseClass} font-mono-tabular`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'fr' ? 'Nouveau mot de passe' : 'New Password'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputBaseClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#082F5E] dark:bg-[#0068C9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F2744] dark:hover:bg-[#1E40AF] cursor-pointer"
            >
              {lang === 'fr' ? 'Mettre à jour le mot de passe' : 'Update Password'}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
};
