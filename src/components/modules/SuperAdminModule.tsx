import React, { useEffect, useState } from 'react';
import {
  Building2,
  Users,
  Wallet,
  LifeBuoy,
  CheckCircle2,
  RefreshCw,
  Tag,
  Clock,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import { computeAnnualPricing, SubscriptionPlanConfig } from '../../lib/subscriptionCatalog.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  AlertBanner,
  SegmentedTabs,
  AnimatedNumber,
  TableSkeleton,
  ModalDialog,
  inputBaseClass,
} from '../ui/DesignSystem.tsx';
import { BrandLogo } from '../ui/BrandLogo.tsx';

export const SuperAdminModule: React.FC = () => {
  const { lang } = useAuth();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'schools' | 'payments' | 'plans' | 'users' | 'support'>('schools');
  const [schoolFilter, setSchoolFilter] = useState<'all' | 'trial' | 'active' | 'expired' | 'suspended'>('all');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Plan editor drafts
  const [planEdits, setPlanEdits] = useState<
    Record<string, { monthlyPriceXof: number; annualDiscountPercent: number; isActive: boolean }>
  >({});

  // Manual Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paySchoolId, setPaySchoolId] = useState('');
  const [payPlanKey, setPayPlanKey] = useState('multi_niveaux');
  const [payCycle, setPayCycle] = useState<'monthly' | 'annual'>('monthly');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payRef, setPayRef] = useState('');

  const load = async () => {
    try {
      const res = await apiRequest<any>('/api/superadmin/overview');
      setData(res);
      const drafts: Record<
        string,
        { monthlyPriceXof: number; annualDiscountPercent: number; isActive: boolean }
      > = {};
      for (const p of res.plans || []) {
        drafts[p.planKey] = {
          monthlyPriceXof: p.monthlyPriceXof,
          annualDiscountPercent: p.annualDiscountPercent,
          isActive: p.isActive,
        };
      }
      setPlanEdits(drafts);
      if (!paySchoolId && res.schools?.length) {
        setPaySchoolId(String(res.schools[0].id));
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateSchool = async (id: number, patch: Record<string, any>) => {
    setFeedback(null);
    await apiRequest(`/api/superadmin/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    setFeedback(lang === 'fr' ? 'Abonnement établissement mis à jour.' : 'School subscription updated.');
    await load();
  };

  const updatePlanPricing = async (planKey: string) => {
    const draft = planEdits[planKey];
    if (!draft) return;
    setFeedback(null);
    await apiRequest(`/api/superadmin/plans/${planKey}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    });
    setFeedback(
      lang === 'fr'
        ? `Tarif du forfait « ${planKey} » mis à jour sur toute la plateforme.`
        : `Pricing for "${planKey}" updated across platform.`
    );
    await load();
  };

  const updatePaymentStatus = async (paymentId: number, status: string) => {
    setFeedback(null);
    await apiRequest(`/api/superadmin/payments/${paymentId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setFeedback(
      status === 'paid'
        ? 'Paiement validé et abonnement activé.'
        : `Statut du paiement passé à ${status}.`
    );
    await load();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/superadmin/payments', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: Number(paySchoolId),
        planKey: payPlanKey,
        billingCycle: payCycle,
        paymentMethod: payMethod,
        paymentReference: payRef,
        status: 'paid',
      }),
    });
    setPaymentModalOpen(false);
    setPayRef('');
    setFeedback('Paiement enregistré et abonnement école activé.');
    await load();
  };

  const resolveTicket = async (id: number, status: string) => {
    await apiRequest(`/api/superadmin/support/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  if (error) {
    return <AlertBanner type="error">{error}</AlertBanner>;
  }
  if (!data) {
    return (
      <SurfaceCard padding="none">
        <TableSkeleton rows={5} cols={4} />
      </SurfaceCard>
    );
  }

  const filteredSchools = (data.schools || []).filter((s: any) => {
    if (schoolFilter === 'all') return true;
    if (schoolFilter === 'expired') {
      return s.effectiveStatus === 'expired' || s.effectiveStatus === 'past_due';
    }
    return s.effectiveStatus === schoolFilter;
  });

  const statusBadgeCls = (status: string) => {
    if (status === 'active') {
      return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
    }
    if (status === 'trial') {
      return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    return 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === 'fr' ? 'Super Administration Plateforme' : 'SaaS Super Admin Console'}
        subtitle="Supervision multi-écoles, essais gratuits 30 jours, paiements SaaS, revenus & grille tarifaire"
        actions={<BrandLogo size="sm" />}
      />

      {feedback && <AlertBanner type="success">{feedback}</AlertBanner>}

      {/* Platform Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SurfaceCard>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Établissements inscrits</span>
            <Building2 className="h-4 w-4 text-[#082F5E] dark:text-blue-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-[#082F5E] dark:text-white">
            <AnimatedNumber value={data.metrics.totalSchools} />
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {data.metrics.trialSchools} essai 30j · {data.metrics.activeSchools} actifs ·{' '}
            {data.metrics.expiredSchools} expirés · {data.metrics.suspendedSchools} suspendus
          </p>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Revenus SaaS (MRR / ARR)</span>
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-xl font-bold text-emerald-700 dark:text-emerald-400">
            <AnimatedNumber
              value={data.metrics.totalMonthlyRecurringRevenue}
              formatter={(v) => formatCurrency(v, 'XOF')}
            />{' '}
            <span className="text-xs font-normal text-slate-400">/ mois</span>
          </p>
          <p className="mt-0.5 font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
            ARR : {formatCurrency(data.metrics.totalAnnualRecurringRevenue, 'XOF')} · Encaissé :{' '}
            {formatCurrency(data.metrics.collectedTotalXof || 0, 'XOF')}
          </p>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Utilisateurs & Élèves</span>
            <Users className="h-4 w-4 text-[#082F5E] dark:text-blue-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-[#082F5E] dark:text-white">
            <AnimatedNumber value={data.metrics.totalUsers} />
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {data.metrics.totalStudentsPlatform} élèves gérés sur EduSmart
          </p>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Validation & Support</span>
            <LifeBuoy className="h-4 w-4 text-[#E89E0E]" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-[#E89E0E]">
            <AnimatedNumber value={data.metrics.pendingPaymentsCount || 0} />{' '}
            <span className="text-xs font-normal text-slate-500">paiements en attente</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {data.metrics.openSupportTickets} ticket(s) support ouverts
          </p>
        </SurfaceCard>
      </div>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'schools', label: `Établissements (${data.schools.length})` },
          { id: 'payments', label: `Paiements SaaS (${(data.payments || []).length})` },
          { id: 'plans', label: 'Grille Tarifaire (Super Admin)' },
          { id: 'users', label: `Utilisateurs (${data.users.length})` },
          { id: 'support', label: `Support (${data.supportRequests.length})` },
        ]}
      />

      {tab === 'schools' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { id: 'all', label: `Tous (${data.schools.length})` },
              { id: 'trial', label: `Essai 30j (${data.metrics.trialSchools})` },
              { id: 'active', label: `Actifs (${data.metrics.activeSchools})` },
              { id: 'expired', label: `Expirés (${data.metrics.expiredSchools})` },
              { id: 'suspended', label: `Suspendus (${data.metrics.suspendedSchools})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSchoolFilter(f.id as any)}
                className={`rounded-lg border px-3 py-1.5 font-semibold cursor-pointer transition-colors ${
                  schoolFilter === f.id
                    ? 'border-[#082F5E] bg-[#082F5E] text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Établissement</th>
                    <th className="px-4 py-3 font-semibold">Forfait & Cycle</th>
                    <th className="px-4 py-3 font-semibold">Dates (Début / Fin)</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSchools.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {s.code} · {s.city}, {s.country} · {s.studentCount} él. / {s.teacherCount} ens.
                        </p>
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <select
                          value={s.normalizedPlanKey}
                          onChange={(e) => updateSchool(s.id, { subscriptionPlan: e.target.value })}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-slate-800 dark:text-slate-200"
                        >
                          {(data.plans || []).map((p: SubscriptionPlanConfig) => (
                            <option key={p.planKey} value={p.planKey}>
                              {p.nameFr}
                            </option>
                          ))}
                        </select>
                        <select
                          value={s.billingCycle || 'monthly'}
                          onChange={(e) => updateSchool(s.id, { billingCycle: e.target.value })}
                          className="ml-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-slate-700 dark:text-slate-300"
                        >
                          <option value="monthly">Mensuel</option>
                          <option value="annual">Annuel (-20%)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-[11px]">
                        {s.effectiveStatus === 'trial' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
                              <Clock className="h-3 w-3" />
                              {s.trialDaysRemaining} j restants
                            </span>
                            <p className="text-slate-500">
                              {(s.trialStartedAt || '').slice(0, 10) || '—'} →{' '}
                              {(s.trialEndsAt || '').slice(0, 10) || '—'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-slate-700 dark:text-slate-300">
                              Début : {s.subscriptionStartedAt || (s.trialStartedAt || '').slice(0, 10) || '—'}
                            </p>
                            <p className="text-slate-500">
                              Échéance : {s.subscriptionRenewsAt || '—'}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusBadgeCls(
                            s.effectiveStatus
                          )}`}
                        >
                          {s.effectiveStatus === 'trial'
                            ? 'Essai 30j'
                            : s.effectiveStatus === 'active'
                              ? 'Actif'
                              : s.effectiveStatus === 'suspended'
                                ? 'Suspendu'
                                : 'Expiré'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSchool(s.id, { action: 'renew' })}
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Renouveler</span>
                        </Button>
                        <Button
                          size="sm"
                          variant={s.effectiveStatus === 'suspended' ? 'emerald' : 'danger'}
                          onClick={() =>
                            updateSchool(s.id, {
                              subscriptionStatus:
                                s.effectiveStatus === 'suspended' ? 'active' : 'suspended',
                            })
                          }
                        >
                          {s.effectiveStatus === 'suspended' ? 'Réactiver' : 'Suspendre'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setPaymentModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span>Enregistrer un paiement / renouvellement</span>
            </Button>
          </div>
          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Facture</th>
                    <th className="px-4 py-3 font-semibold">École</th>
                    <th className="px-4 py-3 font-semibold">Forfait</th>
                    <th className="px-4 py-3 font-semibold">Montant</th>
                    <th className="px-4 py-3 font-semibold">Méthode & Réf.</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data.payments || []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono-tabular font-bold">{p.invoiceNumber}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {p.schoolName}
                      </td>
                      <td className="px-4 py-3">
                        {p.planKey} ({p.billingCycle === 'annual' ? 'Annuel' : 'Mensuel'})
                      </td>
                      <td className="px-4 py-3 font-mono-tabular font-bold">
                        {formatCurrency(p.amountXof, 'XOF')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="uppercase">{p.paymentMethod}</span> ·{' '}
                        <span className="font-mono-tabular text-slate-500">{p.paymentReference}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold capitalize">{p.status}</td>
                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        {p.status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="emerald"
                            onClick={() => updatePaymentStatus(p.id, 'paid')}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Valider & Activer</span>
                          </Button>
                        )}
                        {p.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePaymentStatus(p.id, 'cancelled')}
                          >
                            Annuler
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!data.payments || data.payments.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">
                        Aucun paiement d’abonnement enregistré pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      )}

      {tab === 'plans' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {(data.plans || []).map((p: SubscriptionPlanConfig) => {
            const draft = planEdits[p.planKey] || {
              monthlyPriceXof: p.monthlyPriceXof,
              annualDiscountPercent: p.annualDiscountPercent,
              isActive: p.isActive,
            };
            const preview = computeAnnualPricing(draft.monthlyPriceXof, draft.annualDiscountPercent);

            return (
              <SurfaceCard key={p.planKey}>
                <div className="space-y-4 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#082F5E] dark:text-white flex items-center gap-2">
                        <Tag className="h-4 w-4 text-[#0068C9]" />
                        <span>{p.nameFr}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Clé technique : <span className="font-mono-tabular">{p.planKey}</span>
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(e) =>
                          setPlanEdits((prev) => ({
                            ...prev,
                            [p.planKey]: { ...draft, isActive: e.target.checked },
                          }))
                        }
                      />
                      <span>Actif</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Tarif Mensuel (FCFA)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={draft.monthlyPriceXof}
                        onChange={(e) =>
                          setPlanEdits((prev) => ({
                            ...prev,
                            [p.planKey]: {
                              ...draft,
                              monthlyPriceXof: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className={`${inputBaseClass} font-mono-tabular`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Remise Annuelle (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={draft.annualDiscountPercent}
                        onChange={(e) =>
                          setPlanEdits((prev) => ({
                            ...prev,
                            [p.planKey]: {
                              ...draft,
                              annualDiscountPercent: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className={`${inputBaseClass} font-mono-tabular`}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 flex items-center justify-between text-[11px]">
                    <span>
                      Annuel plein :{' '}
                      <strong className="font-mono-tabular">
                        {formatCurrency(preview.regularAnnualXof, 'XOF')}
                      </strong>
                    </span>
                    <span>
                      Tarif annuel remisé :{' '}
                      <strong className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(preview.annualPriceXof, 'XOF')}
                      </strong>
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => updatePlanPricing(p.planKey)}
                    >
                      Enregistrer ce tarif
                    </Button>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {tab === 'users' && (
        <SurfaceCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nom</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Rôle</th>
                  <th className="px-4 py-3 font-semibold">École ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {u.fullName}
                    </td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3 font-mono-tabular">{u.role}</td>
                    <td className="px-4 py-3 font-mono-tabular">{u.schoolId || 'Plateforme'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      {tab === 'support' && (
        <div className="space-y-3">
          {data.supportRequests.map((t: any) => (
            <SurfaceCard key={t.id} className="text-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-[#082F5E] dark:text-white">{t.subject}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.schoolName} · {t.requesterEmail}
                  </p>
                  <p className="mt-2 text-slate-700 dark:text-slate-300">{t.message}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    resolveTicket(t.id, t.status === 'resolved' ? 'open' : 'resolved')
                  }
                >
                  {t.status === 'resolved' ? 'Résolu (Rouvrir)' : 'Marquer résolu'}
                </Button>
              </div>
            </SurfaceCard>
          ))}
          {data.supportRequests.length === 0 && (
            <SurfaceCard className="p-8 text-center text-xs text-slate-400">
              Aucune demande de support ouverte.
            </SurfaceCard>
          )}
        </div>
      )}

      {/* Manual Payment / Activation Modal */}
      <ModalDialog
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Enregistrer un paiement SaaS"
        subtitle="Active immédiatement l'abonnement de l'établissement sélectionné"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">Établissement</label>
            <select
              required
              value={paySchoolId}
              onChange={(e) => setPaySchoolId(e.target.value)}
              className={inputBaseClass}
            >
              {(data.schools || []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Forfait</label>
              <select
                value={payPlanKey}
                onChange={(e) => setPayPlanKey(e.target.value)}
                className={inputBaseClass}
              >
                {(data.plans || []).map((p: SubscriptionPlanConfig) => (
                  <option key={p.planKey} value={p.planKey}>
                    {p.nameFr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Cycle</label>
              <select
                value={payCycle}
                onChange={(e) => setPayCycle(e.target.value as any)}
                className={inputBaseClass}
              >
                <option value="monthly">Mensuel</option>
                <option value="annual">Annuel (-20 %)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Méthode</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className={inputBaseClass}
              >
                <option value="bank_transfer">Virement Bancaire</option>
                <option value="fedapay">FedaPay</option>
                <option value="kkiapay">Kkiapay</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="cash">Espèces</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Référence</label>
              <input
                required
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="VIR-2026-001"
                className={inputBaseClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary">
              Valider & Activer
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
