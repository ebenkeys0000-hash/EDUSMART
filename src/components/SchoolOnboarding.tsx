import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogOut, Sun, Moon, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { AlertBanner, inputBaseClass } from './ui/DesignSystem.tsx';
import { BrandLogo } from './ui/BrandLogo.tsx';
import { DEFAULT_SUBSCRIPTION_PLANS, SubscriptionPlanKey } from '../lib/subscriptionCatalog.ts';

export const SchoolOnboarding: React.FC = () => {
  const { user, lang, setLang, refreshSession, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('Bénin');
  const [city, setCity] = useState('Cotonou');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('XOF');
  const [academicSystem, setAcademicSystem] = useState('Francophone');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanKey>('multi_niveaux');
  const [schoolCode, setSchoolCode] = useState('');
  const [loadSampleData, setLoadSampleData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest('/api/schools/setup', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          name,
          country,
          city,
          address,
          phone,
          currency,
          academicSystem,
          subscriptionPlan,
          schoolCode,
          loadSampleData,
        }),
      });
      await refreshSession();
    } catch (err: any) {
      setError(err.message || 'Impossible de configurer l’établissement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 px-6 py-10 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mx-auto mb-6 flex max-w-2xl items-center justify-end gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-[#082F5E]" />
          )}
          <span>{theme === 'dark' ? (lang === 'fr' ? 'Clair' : 'Light') : lang === 'fr' ? 'Sombre' : 'Dark'}</span>
        </button>
        <button
          type="button"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold cursor-pointer"
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <BrandLogo size="sm" />
            <div>
              <h1 className="font-display text-xl font-bold text-[#082F5E] dark:text-white">
                {lang === 'fr'
                  ? 'Configuration de votre établissement'
                  : 'Complete Your School Profile'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user?.email} ·{' '}
                {lang === 'fr'
                  ? 'Isolé dans votre propre espace Cloud SQL'
                  : 'Provisioned in an isolated Cloud SQL tenant'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{lang === 'fr' ? 'Quitter' : 'Sign Out'}</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`rounded-lg py-2 text-xs font-semibold cursor-pointer transition-colors ${
              mode === 'create'
                ? 'bg-white dark:bg-slate-900 text-[#082F5E] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {lang === 'fr' ? 'Créer un nouvel établissement' : 'Create New School'}
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`rounded-lg py-2 text-xs font-semibold cursor-pointer transition-colors ${
              mode === 'join'
                ? 'bg-white dark:bg-slate-900 text-[#082F5E] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {lang === 'fr' ? 'Rejoindre avec un code' : 'Join via School Code'}
          </button>
        </div>

        {mode === 'create' && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
            <Sparkles className="h-4 w-4 shrink-0 text-[#E89E0E] mt-0.5" />
            <div>
              <p className="font-bold">
                {lang === 'fr'
                  ? '30 jours d’essai gratuit activés dès la création'
                  : '30-Day Free Trial Activated Immediately'}
              </p>
              <p className="text-[11px] opacity-90">
                {lang === 'fr'
                  ? 'Aucun moyen de paiement exigé. Vous ne paierez que si vous choisissez un forfait.'
                  : 'No credit card required. You only pay if you choose a plan afterwards.'}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <AlertBanner type="error">{error}</AlertBanner>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'create' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'fr' ? "Nom officiel de l'établissement" : 'Official School Name'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Collège Privé Les Palmiers"
                  className={inputBaseClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    className={inputBaseClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'fr' ? 'Adresse / Quartier' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Haie Vive, Cotonou"
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
                    placeholder="+229 21 30 00 00"
                    className={inputBaseClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'fr' ? 'Devise principale' : 'Primary Currency'}
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
                    {lang === 'fr' ? 'Système éducatif' : 'Academic System'}
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'fr' ? 'Forfait envisagé' : 'Target Plan'}
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
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loadSampleData}
                  onChange={(e) => setLoadSampleData(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#082F5E]"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {lang === 'fr'
                      ? 'Initialiser une structure scolaire modèle (classes 6ème/3ème/Tle, matières, élèves et factures FCFA)'
                      : 'Populate starter school structure (classes, subjects, sample students & XOF invoices)'}
                  </p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    {lang === 'fr'
                      ? 'Recommandé pour explorer tous les tableaux de bord immédiatement avec de vraies données en base.'
                      : 'Recommended to explore dashboards, report cards, and fee receipts immediately with live PostgreSQL rows.'}
                  </p>
                </div>
              </label>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'fr' ? "Code unique de l'établissement" : 'School Institution Code'}
              </label>
              <input
                type="text"
                required
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="PALM-4821"
                className={`${inputBaseClass} uppercase`}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#082F5E] dark:bg-[#0068C9] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F2744] dark:hover:bg-[#1E40AF] transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy
              ? lang === 'fr'
                ? 'Initialisation en cours...'
                : 'Setting up...'
              : lang === 'fr'
              ? 'Activer mon essai gratuit (30 jours) et accéder'
              : 'Activate 30-Day Free Trial & Launch'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
