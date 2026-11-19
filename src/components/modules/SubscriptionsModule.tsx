import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import { exportSubscriptionInvoicePdf } from '../../lib/exports.ts';
import {
  BillingCycle,
  DEFAULT_SUBSCRIPTION_PLANS,
  getDefaultPlanByKey,
  normalizePlanKey,
  SubscriptionPlanConfig,
  SubscriptionRuntimeState,
} from '../../lib/subscriptionCatalog.ts';
import {
  AlertBanner,
  Button,
  ModalDialog,
  PageHeader,
  SurfaceCard,
  TableSkeleton,
  inputBaseClass,
} from '../ui/DesignSystem.tsx';
import { BrandLogo } from '../ui/BrandLogo.tsx';

interface SubscriptionPaymentRow {
  id: number;
  planKey: string;
  billingCycle: string;
  amountXof: number;
  discountAmountXof: number;
  paymentMethod: string;
  paymentReference: string;
  invoiceNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
  notes: string;
  createdAt?: string;
}

export const SubscriptionsModule: React.FC = () => {
  const { school, subscriptionState, lang, refreshSession } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(DEFAULT_SUBSCRIPTION_PLANS);
  const [payments, setPayments] = useState<SubscriptionPaymentRow[]>([]);
  const [runtimeState, setRuntimeState] = useState<SubscriptionRuntimeState>(subscriptionState);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    school?.billingCycle === 'annual' ? 'annual' : 'monthly'
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Explicit Authorization Checkout Modal
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlanConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('fedapay');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [explicitAuthorization, setExplicitAuthorization] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        school: any;
        subscriptionState: SubscriptionRuntimeState;
        plans: SubscriptionPlanConfig[];
        payments: SubscriptionPaymentRow[];
      }>('/api/subscriptions/current');
      if (res.plans?.length) setPlans(res.plans);
      if (res.subscriptionState) {
        setRuntimeState(res.subscriptionState);
        setBillingCycle(res.subscriptionState.billingCycle);
      }
      setPayments(res.payments || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Impossible de charger l’abonnement.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentPlanObj =
    plans.find((p) => p.planKey === runtimeState.planKey) || getDefaultPlanByKey(runtimeState.planKey);

  const handleSavePreference = async (plan: SubscriptionPlanConfig) => {
    setMessage(null);
    try {
      await apiRequest('/api/subscriptions/plan-preference', {
        method: 'POST',
        body: JSON.stringify({ planKey: plan.planKey, billingCycle }),
      });
      await Promise.all([load(), refreshSession()]);
      setMessage({
        type: 'success',
        text:
          lang === 'fr'
            ? `Forfait « ${plan.nameFr} » (${billingCycle === 'annual' ? 'Annuel -20%' : 'Mensuel'}) sélectionné. Aucun prélèvement automatique.`
            : `Plan "${plan.nameEn}" saved as your preferred package. No automatic billing.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ payment: SubscriptionPaymentRow; message: string }>(
        '/api/subscriptions/checkout',
        {
          method: 'POST',
          body: JSON.stringify({
            planKey: checkoutPlan.planKey,
            billingCycle,
            paymentMethod,
            paymentReference,
            notes,
            explicitAuthorization,
          }),
        }
      );
      setCheckoutPlan(null);
      setPaymentReference('');
      setNotes('');
      setExplicitAuthorization(false);
      await Promise.all([load(), refreshSession()]);
      setMessage({
        type: 'success',
        text:
          lang === 'fr'
            ? `Facture ${res.payment.invoiceNumber} enregistrée (${formatCurrency(
                res.payment.amountXof,
                'XOF'
              )}). Elle est en attente de validation par la facturation EduSmart.`
            : res.message,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SurfaceCard padding="none">
        <TableSkeleton rows={4} cols={4} />
      </SurfaceCard>
    );
  }

  const statusMeta: Record<
    string,
    { labelFr: string; labelEn: string; cls: string }
  > = {
    trial: {
      labelFr: `Essai gratuit (${runtimeState.trialDaysRemaining} j restants)`,
      labelEn: `Free Trial (${runtimeState.trialDaysRemaining}d left)`,
      cls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
    active: {
      labelFr: 'Abonnement Actif',
      labelEn: 'Active Subscription',
      cls: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    expired: {
      labelFr: 'Expiré — Activation requise',
      labelEn: 'Expired — Activation Required',
      cls: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    },
    suspended: {
      labelFr: 'Suspendu',
      labelEn: 'Suspended',
      cls: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    },
    past_due: {
      labelFr: 'Paiement en attente',
      labelEn: 'Past Due',
      cls: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    },
  };

  const currentStatusUi = statusMeta[runtimeState.status] || statusMeta.trial;

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === 'fr' ? 'Abonnement, Essai Gratuit & Tarifs' : 'Subscription, Free Trial & Plans'}
        subtitle={
          lang === 'fr'
            ? 'Gérez votre période d’essai de 30 jours, comparez les forfaits mensuels ou annuels (-20 %) et téléchargez vos factures officielles.'
            : 'Manage your 30-day free trial, compare monthly or annual (-20%) plans, and download official SaaS invoices.'
        }
      />

      {message && <AlertBanner type={message.type}>{message.text}</AlertBanner>}

      {runtimeState.isSubscriptionExpired && (
        <AlertBanner type="warning">
          {lang === 'fr'
            ? 'Votre période d’essai gratuit de 30 jours ou votre abonnement a expiré. Vos données restent intactes en lecture seule ; sélectionnez un forfait ci-dessous et soumettez votre autorisation de paiement pour réactiver toutes les opérations.'
            : 'Your 30-day free trial or subscription has expired. Existing records remain safely readable; select a plan and authorize payment below to reactivate writes.'}
        </AlertBanner>
      )}

      {/* Current Subscription Status Card */}
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <BrandLogo size="md" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-[#082F5E] dark:text-white">
                  {lang === 'fr' ? currentPlanObj.nameFr : currentPlanObj.nameEn}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${currentStatusUi.cls}`}
                >
                  {runtimeState.status === 'active' ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : runtimeState.status === 'trial' ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  <span>{lang === 'fr' ? currentStatusUi.labelFr : currentStatusUi.labelEn}</span>
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {lang === 'fr' ? 'Cycle actuel : ' : 'Current cycle: '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {runtimeState.billingCycle === 'annual'
                      ? lang === 'fr'
                        ? 'Annuel (-20 %)'
                        : 'Annual (-20%)'
                      : lang === 'fr'
                        ? 'Mensuel'
                        : 'Monthly'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                {runtimeState.status === 'trial' ? (
                  <span>
                    {lang === 'fr' ? 'Fin de l’essai gratuit : ' : 'Trial ends: '}
                    <strong className="font-mono-tabular text-[#082F5E] dark:text-amber-300">
                      {runtimeState.trialEndsAt.slice(0, 10)} ({runtimeState.trialDaysRemaining} / 30 j)
                    </strong>
                  </span>
                ) : (
                  <span>
                    {lang === 'fr' ? 'Échéance / Renouvellement : ' : 'Renews on: '}
                    <strong className="font-mono-tabular text-[#082F5E] dark:text-blue-300">
                      {runtimeState.renewsAt || '—'}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1.5 text-xs">
            <p className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5 text-[#E89E0E]" />
              <span>
                {lang === 'fr'
                  ? 'Aucun débit automatique sans votre autorisation explicite'
                  : 'Zero automatic charge without explicit consent'}
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {school?.name} ({school?.code})
            </p>
          </div>
        </div>
      </SurfaceCard>

      {/* Billing Cycle Toggle + 4 FCFA Plans */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-bold text-[#082F5E] dark:text-white">
            {lang === 'fr' ? 'Choisir votre forfait EduSmart' : 'Choose Your EduSmart Plan'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'fr'
              ? 'Tarifs officiels en Francs CFA — économisez 20 % avec l’abonnement annuel'
              : 'Official FCFA rates — save 20% with annual billing'}
          </p>
        </div>

        <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-lg px-4 py-1.5 transition-colors cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-slate-900 text-[#082F5E] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {lang === 'fr' ? 'Mensuel' : 'Monthly'}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`rounded-lg px-4 py-1.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-[#082F5E] dark:bg-[#0068C9] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <span>{lang === 'fr' ? 'Annuel' : 'Annual'}</span>
            <span className="rounded bg-[#E89E0E] px-1.5 py-0.5 text-[10px] font-bold text-white">
              -20%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = runtimeState.planKey === plan.planKey;
          const activePrice = billingCycle === 'annual' ? plan.annualPriceXof : plan.monthlyPriceXof;
          const features = lang === 'fr' ? plan.featuresFr : plan.featuresEn;

          return (
            <div
              key={plan.planKey}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                plan.isPopular
                  ? 'border-[#082F5E] bg-[#082F5E] text-white shadow-md'
                  : isCurrent
                    ? 'border-[#0068C9] bg-blue-50/40 dark:bg-blue-950/20 text-slate-900 dark:text-slate-100'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-display text-base font-bold leading-snug">
                    {lang === 'fr' ? plan.nameFr : plan.nameEn}
                  </h4>
                  {plan.isPopular && (
                    <span className="rounded bg-[#E89E0E] px-2 py-0.5 text-[10px] font-bold uppercase text-white shrink-0">
                      Multi-Niveaux
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1 text-xs ${
                    plan.isPopular ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {lang === 'fr' ? plan.subtitleFr : plan.subtitleEn}
                </p>

                <div className="mt-4">
                  {billingCycle === 'annual' && (
                    <p
                      className={`font-mono-tabular text-xs line-through ${
                        plan.isPopular ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(plan.regularAnnualXof, 'XOF')} / {lang === 'fr' ? 'an' : 'yr'}
                    </p>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono-tabular text-2xl font-bold">
                      {formatCurrency(activePrice, 'XOF')}
                    </span>
                    <span
                      className={`text-xs ${
                        plan.isPopular ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {billingCycle === 'annual'
                        ? lang === 'fr'
                          ? '/ an'
                          : '/ yr'
                        : lang === 'fr'
                          ? '/ mois'
                          : '/ mo'}
                    </span>
                  </div>
                  {billingCycle === 'annual' ? (
                    <p
                      className={`mt-1 font-mono-tabular text-[11px] font-semibold ${
                        plan.isPopular ? 'text-amber-300' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {lang === 'fr'
                        ? `Économie de ${formatCurrency(plan.savingsXof, 'XOF')} (-${plan.annualDiscountPercent}%)`
                        : `Save ${formatCurrency(plan.savingsXof, 'XOF')} (-${plan.annualDiscountPercent}%)`}
                    </p>
                  ) : (
                    <p
                      className={`mt-1 text-[11px] ${
                        plan.isPopular ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {lang === 'fr'
                        ? `Annuel : ${formatCurrency(plan.annualPriceXof, 'XOF')} (-${plan.annualDiscountPercent}%)`
                        : `Annual: ${formatCurrency(plan.annualPriceXof, 'XOF')} (-${plan.annualDiscountPercent}%)`}
                    </p>
                  )}
                </div>

                <ul className="mt-4 space-y-2 border-t border-current/10 pt-4 text-xs">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 leading-snug">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                          plan.isPopular ? 'text-[#E89E0E]' : 'text-[#0068C9] dark:text-blue-400'
                        }`}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-2">
                <Button
                  variant={plan.isPopular ? 'gold' : 'primary'}
                  className="w-full"
                  onClick={() => {
                    setCheckoutPlan(plan);
                    setExplicitAuthorization(false);
                  }}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>
                    {runtimeState.status === 'active' && isCurrent
                      ? lang === 'fr'
                        ? 'Renouveler ce forfait'
                        : 'Renew This Plan'
                      : lang === 'fr'
                        ? 'Choisir et Activer'
                        : 'Select & Activate'}
                  </span>
                </Button>
                {runtimeState.status === 'trial' && (
                  <button
                    type="button"
                    onClick={() => handleSavePreference(plan)}
                    className={`w-full rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                      plan.isPopular
                        ? 'border-white/25 text-white hover:bg-white/10'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isCurrent
                      ? lang === 'fr'
                        ? 'Forfait sélectionné (essai en cours)'
                        : 'Currently Selected (Trial)'
                      : lang === 'fr'
                        ? 'Pré-sélectionner sans payer'
                        : 'Pre-select Without Paying'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription Invoices & Payments Ledger */}
      <SurfaceCard padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-[#082F5E] dark:text-white">
              {lang === 'fr'
                ? 'Historique des factures & paiements d’abonnement'
                : 'Subscription Invoices & Payment History'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'fr'
                ? 'Factures générées uniquement suite à votre autorisation explicite.'
                : 'Invoices issued strictly upon your explicit checkout authorization.'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">N° Facture</th>
                <th className="px-4 py-3 font-semibold">Forfait & Cycle</th>
                <th className="px-4 py-3 font-semibold">Montant</th>
                <th className="px-4 py-3 font-semibold">Méthode & Réf.</th>
                <th className="px-4 py-3 font-semibold">Période</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 text-right font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => {
                const planObj =
                  plans.find((pl) => pl.planKey === normalizePlanKey(p.planKey)) ||
                  getDefaultPlanByKey(p.planKey);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono-tabular font-bold text-[#082F5E] dark:text-blue-400">
                      {p.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {lang === 'fr' ? planObj.nameFr : planObj.nameEn}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {p.billingCycle === 'annual' ? 'Annuel (-20%)' : 'Mensuel'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular font-bold text-slate-900 dark:text-white">
                      {formatCurrency(p.amountXof, 'XOF')}
                      {p.discountAmountXof > 0 && (
                        <span className="block text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                          Économie -{formatCurrency(p.discountAmountXof, 'XOF')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="uppercase font-semibold">{p.paymentMethod}</span>
                      <span className="block font-mono-tabular text-[11px] text-slate-500">
                        {p.paymentReference || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-[11px] text-slate-600 dark:text-slate-300">
                      {p.periodStart || '—'} → {p.periodEnd || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          p.status === 'paid'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : p.status === 'pending'
                              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status === 'paid'
                          ? 'Payée'
                          : p.status === 'pending'
                            ? 'En attente'
                            : p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportSubscriptionInvoicePdf(
                            {
                              ...p,
                              planName: lang === 'fr' ? planObj.nameFr : planObj.nameEn,
                            },
                            {
                              name: school?.name || 'Établissement',
                              code: school?.code,
                              email: school?.email,
                              city: school?.city,
                              country: school?.country,
                            }
                          )
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">
                    {lang === 'fr'
                      ? 'Aucune facture d’abonnement émise pour le moment.'
                      : 'No subscription invoices generated yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* Explicit Authorization Checkout Modal */}
      <ModalDialog
        open={Boolean(checkoutPlan)}
        onClose={() => setCheckoutPlan(null)}
        title={
          lang === 'fr'
            ? `Activer : ${checkoutPlan?.nameFr || ''}`
            : `Activate: ${checkoutPlan?.nameEn || ''}`
        }
        subtitle={
          lang === 'fr'
            ? 'Autorisation explicite de facturation et enregistrement de la référence de paiement'
            : 'Explicit billing authorization and payment reference submission'
        }
      >
        {checkoutPlan && (
          <form onSubmit={handleSubmitCheckout} className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Forfait choisi</span>
                <span className="font-bold text-[#082F5E] dark:text-white">
                  {lang === 'fr' ? checkoutPlan.nameFr : checkoutPlan.nameEn}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Cycle de facturation</span>
                <span className="font-semibold">
                  {billingCycle === 'annual' ? 'Annuel (-20 %)' : 'Mensuel'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">Montant total dû</span>
                <span className="font-mono-tabular text-base font-bold text-[#082F5E] dark:text-amber-300">
                  {formatCurrency(
                    billingCycle === 'annual'
                      ? checkoutPlan.annualPriceXof
                      : checkoutPlan.monthlyPriceXof,
                    'XOF'
                  )}
                </span>
              </div>
              {billingCycle === 'annual' && (
                <p className="text-right font-mono-tabular text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Économie incluse : -{formatCurrency(checkoutPlan.savingsXof, 'XOF')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mode de paiement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputBaseClass}
                >
                  <option value="fedapay">FedaPay (MTN / Moov / Carte)</option>
                  <option value="kkiapay">Kkiapay (Mobile Money / Carte)</option>
                  <option value="mobile_money">Mobile Money Direct</option>
                  <option value="bank_transfer">Virement Bancaire</option>
                  <option value="cash">Espèces / Règlement Agence</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Référence de transaction / bordereau *
                </label>
                <input
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ex: FDP-2026-99104 ou VIR-883"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes complémentaires (optionnel)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Numéro payeur, banque émettrice..."
                className={inputBaseClass}
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 cursor-pointer">
              <input
                type="checkbox"
                checked={explicitAuthorization}
                onChange={(e) => setExplicitAuthorization(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#082F5E]"
              />
              <span className="text-[11px] leading-relaxed text-slate-800 dark:text-slate-200">
                <strong>Autorisation explicite :</strong>{' '}
                {lang === 'fr'
                  ? `Je confirme souhaiter souscrire au « ${checkoutPlan.nameFr} » (${
                      billingCycle === 'annual' ? 'Annuel -20 %' : 'Mensuel'
                    }) pour un montant de ${formatCurrency(
                      billingCycle === 'annual'
                        ? checkoutPlan.annualPriceXof
                        : checkoutPlan.monthlyPriceXof,
                      'XOF'
                    )} et j'atteste avoir initié ce règlement.`
                  : `I explicitly authorize subscribing to "${checkoutPlan.nameEn}" (${billingCycle}) and confirm initiating this payment.`}
              </span>
            </label>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="outline" onClick={() => setCheckoutPlan(null)}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !explicitAuthorization || !paymentReference.trim()}
              >
                {submitting
                  ? '...'
                  : lang === 'fr'
                    ? 'Soumettre pour activation'
                    : 'Submit for Activation'}
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
};
