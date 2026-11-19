import React, { useState } from 'react';
import { CreditCard, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import { getDefaultPlanByKey } from '../../lib/subscriptionCatalog.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
} from '../ui/DesignSystem.tsx';
import { PhotoCaptureCropper } from '../ui/PhotoCaptureCropper.tsx';
import { BrandLogo } from '../ui/BrandLogo.tsx';

export const SchoolSettingsModule: React.FC<{ onNavigate?: (tab: string) => void }> = ({
  onNavigate,
}) => {
  const { school, subscriptionState, user, lang, refreshSession } = useAuth();
  const [name, setName] = useState(school?.name || '');
  const [country, setCountry] = useState(school?.country || 'Bénin');
  const [city, setCity] = useState(school?.city || 'Cotonou');
  const [address, setAddress] = useState(school?.address || '');
  const [phone, setPhone] = useState(school?.phone || '');
  const [logoUrl, setLogoUrl] = useState(school?.logoUrl || '');
  const [currency, setCurrency] = useState(school?.currency || 'XOF');
  const [academicSystem, setAcademicSystem] = useState(school?.academicSystem || 'Francophone');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planObj = getDefaultPlanByKey(subscriptionState.planKey);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      await apiRequest('/api/schools/current', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          country,
          city,
          address,
          phone,
          logoUrl,
          currency,
          academicSystem,
        }),
      });
      await refreshSession();
      setSavedMsg(
        lang === 'fr' ? 'Profil établissement enregistré.' : 'School settings updated.'
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClaimSuperAdmin = async () => {
    setError(null);
    try {
      await apiRequest('/api/superadmin/bootstrap', { method: 'POST' });
      await refreshSession();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={lang === 'fr' ? 'Profil de l’Établissement' : 'School Institution Profile'}
        subtitle={
          <>
            Code d&apos;établissement :{' '}
            <span className="font-mono-tabular font-bold text-[#082F5E] dark:text-blue-400">
              {school?.code}
            </span>{' '}
            · Statut :{' '}
            <span className="font-semibold capitalize">{subscriptionState.status}</span>
          </>
        }
        actions={<BrandLogo size="sm" />}
      />

      {savedMsg && <AlertBanner type="success">{savedMsg}</AlertBanner>}
      {error && <AlertBanner type="error">{error}</AlertBanner>}

      {/* Subscription Summary Bridge */}
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#082F5E] dark:text-blue-400">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-[#082F5E] dark:text-white">
                {lang === 'fr' ? planObj.nameFr : planObj.nameEn} ·{' '}
                {subscriptionState.billingCycle === 'annual'
                  ? `${formatCurrency(planObj.annualPriceXof, 'XOF')} / an (-20%)`
                  : `${formatCurrency(planObj.monthlyPriceXof, 'XOF')} / mois`}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {subscriptionState.status === 'trial'
                  ? lang === 'fr'
                    ? `Essai gratuit 30 jours : ${subscriptionState.trialDaysRemaining} jours restants (fin le ${subscriptionState.trialEndsAt.slice(0, 10)})`
                    : `30-day free trial: ${subscriptionState.trialDaysRemaining} days left`
                  : lang === 'fr'
                    ? `Statut : ${subscriptionState.status} · Échéance : ${subscriptionState.renewsAt || '—'}`
                    : `Status: ${subscriptionState.status} · Renews: ${subscriptionState.renewsAt || '—'}`}
              </p>
            </div>
          </div>
          {onNavigate && (
            <Button variant="primary" size="sm" onClick={() => onNavigate('subscription')}>
              {lang === 'fr' ? 'Gérer l’abonnement & factures' : 'Manage Subscription'}
            </Button>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <form onSubmit={handleSave} className="space-y-5 text-xs">
          <PhotoCaptureCropper
            value={logoUrl}
            onChange={setLogoUrl}
            ownerType="school_logo"
            required={false}
            label={
              lang === 'fr'
                ? "Logo de l'établissement (affiché sur les cartes et bulletins)"
                : 'School Logo (displayed on ID cards & report cards)'
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Nom de l&apos;établissement
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Téléphone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Pays</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Ville</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Adresse</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Devise</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="XOF">XOF (FCFA UEMOA)</option>
                <option value="XAF">XAF (FCFA CEMAC)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Système éducatif
              </label>
              <select
                value={academicSystem}
                onChange={(e) => setAcademicSystem(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="Francophone">Francophone</option>
                <option value="Anglophone">Anglophone</option>
                <option value="Bilingual">Bilingue</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} variant="primary" size="lg">
              {saving ? '...' : lang === 'fr' ? 'Enregistrer les modifications' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      {user?.role !== 'super_admin' && (
        <SurfaceCard>
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#082F5E] dark:text-blue-400">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-[#082F5E] dark:text-white">
                  Gouvernance Plateforme (Super Admin)
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Si aucun Super Administrateur n&apos;est encore désigné sur cette instance, vous
                  pouvez activer le rôle plateforme pour gérer toutes les écoles, tarifs et abonnements.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleClaimSuperAdmin}>
              Activer Super Admin
            </Button>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
};
