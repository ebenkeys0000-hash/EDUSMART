export const EDUSMART_LOGO_URL =
  '/assets/aistudio/file_000000002cc08210b0aa2b465dfc936e_959948bd.png';

export type SubscriptionPlanKey =
  | 'maternelle_primaire'
  | 'college'
  | 'lycee'
  | 'multi_niveaux';

export type BillingCycle = 'monthly' | 'annual';

export type EffectiveSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'past_due';

export interface SubscriptionPlanConfig {
  id?: number;
  planKey: SubscriptionPlanKey;
  nameFr: string;
  nameEn: string;
  subtitleFr: string;
  subtitleEn: string;
  monthlyPriceXof: number;
  annualDiscountPercent: number;
  annualPriceXof: number;
  regularAnnualXof: number;
  savingsXof: number;
  featuresFr: string[];
  featuresEn: string[];
  levels: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

export const TRIAL_DURATION_DAYS = 30;

export function computeAnnualPricing(
  monthlyPriceXof: number,
  annualDiscountPercent = 20
): {
  regularAnnualXof: number;
  annualPriceXof: number;
  savingsXof: number;
} {
  const safeMonthly = Math.max(0, Math.round(Number(monthlyPriceXof) || 0));
  const safeDiscount = Math.min(90, Math.max(0, Math.round(Number(annualDiscountPercent) || 0)));
  const regularAnnualXof = safeMonthly * 12;
  const annualPriceXof = Math.round((regularAnnualXof * (100 - safeDiscount)) / 100);
  const savingsXof = Math.max(0, regularAnnualXof - annualPriceXof);
  return { regularAnnualXof, annualPriceXof, savingsXof };
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    planKey: 'maternelle_primaire',
    nameFr: 'Plan Maternelle & Primaire',
    nameEn: 'Preschool & Primary Plan',
    subtitleFr: 'Écoles maternelles et primaires (Petite Section au CM2)',
    subtitleEn: 'Nursery & primary schools (Nursery 1 to Primary 6)',
    monthlyPriceXof: 5000,
    annualDiscountPercent: 20,
    ...computeAnnualPricing(5000, 20),
    featuresFr: [
      'Classes bilingues Petite Section à CM2',
      'Fiches élèves, photos & cartes scolaires QR',
      'Suivi des présences & appel quotidien',
      'Facturation FCFA, tranches & reçus PDF',
      'Bulletins scolaires & portail parents',
    ],
    featuresEn: [
      'Bilingual Nursery 1 to Primary 6 classes',
      'Student records, photos & QR ID cards',
      'Daily attendance & QR arrival scan',
      'FCFA tuition invoicing & PDF receipts',
      'Report cards & dedicated parent portal',
    ],
    levels: ['preschool', 'primary'],
    isPopular: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    planKey: 'college',
    nameFr: 'Plan Collège',
    nameEn: 'Junior Secondary Plan',
    subtitleFr: 'Collèges d’enseignement général (6e à 3e / Grade 7 à 10)',
    subtitleEn: 'Junior secondary colleges (6e to 3e / Grade 7 to 10)',
    monthlyPriceXof: 10000,
    annualDiscountPercent: 20,
    ...computeAnnualPricing(10000, 20),
    featuresFr: [
      'Classes de 6e à 3e & coefficients par matière',
      'Cartes élèves, enseignants & cartes de classe QR',
      'Emplois du temps avec détection de conflits',
      'Examens, classements & bulletins pondérés PDF',
      'Gestion des frais scolaires & paie enseignants',
    ],
    featuresEn: [
      '6e to 3e classes & subject coefficient rules',
      'Student, teacher & class QR ID cards',
      'Conflict-aware class timetables',
      'Weighted exam averages, rankings & PDF reports',
      'Tuition collection & teacher payroll',
    ],
    levels: ['junior_secondary'],
    isPopular: false,
    isActive: true,
    sortOrder: 2,
  },
  {
    planKey: 'lycee',
    nameFr: 'Plan Lycée',
    nameEn: 'Senior High Plan',
    subtitleFr: 'Lycées généraux, techniques & professionnels (2nde à Tle)',
    subtitleEn: 'Senior secondary & TVET high schools (Grade 11 to 13)',
    monthlyPriceXof: 15000,
    annualDiscountPercent: 20,
    ...computeAnnualPricing(15000, 20),
    featuresFr: [
      'Séries A, C, D & 14 filières techniques/pro',
      'Matrice avancée des coefficients par série',
      'Statistiques par trimestre, année & série',
      'Cartes officielles QR & contrôle d’accès',
      'Finances complètes, paie & exportations Excel/PDF',
    ],
    featuresEn: [
      'Academic Series (A, C, D) & 14 TVET tracks',
      'Advanced coefficient matrix by series',
      'Term, annual & series performance analytics',
      'Official QR ID cards & access verification',
      'Full finance, payroll & Excel/PDF exports',
    ],
    levels: ['senior_secondary', 'technical_vocational'],
    isPopular: false,
    isActive: true,
    sortOrder: 3,
  },
  {
    planKey: 'multi_niveaux',
    nameFr: 'Plan Établissement Multi-Niveaux',
    nameEn: 'Multi-Level Institution Plan',
    subtitleFr: 'Maternelle, Primaire, Collège et Lycée dans un seul abonnement',
    subtitleEn: 'Preschool, Primary, Junior & Senior High in one unified plan',
    monthlyPriceXof: 20000,
    annualDiscountPercent: 20,
    ...computeAnnualPricing(20000, 20),
    featuresFr: [
      'Tous les cycles : Maternelle, Primaire, Collège & Lycée',
      'Plateforme unifiée avec un seul abonnement',
      'Élèves, classes, enseignants & utilisateurs illimités',
      'Séries, filières TVET, cartes QR & bulletins complets',
      'Tableau de bord direction consolidé & support prioritaire',
    ],
    featuresEn: [
      'All levels: Preschool, Primary, Junior & Senior High',
      'Manage every cycle under one single subscription',
      'Unlimited students, classes, teachers & accounts',
      'Full curriculum, TVET tracks, QR cards & report cards',
      'Consolidated executive analytics & priority support',
    ],
    levels: ['preschool', 'primary', 'junior_secondary', 'senior_secondary', 'technical_vocational'],
    isPopular: true,
    isActive: true,
    sortOrder: 4,
  },
];

export function normalizePlanKey(raw?: string | null): SubscriptionPlanKey {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'maternelle_primaire' || clean === 'free') return 'maternelle_primaire';
  if (clean === 'college' || clean === 'starter') return 'college';
  if (clean === 'lycee' || clean === 'professional') return 'lycee';
  if (clean === 'multi_niveaux' || clean === 'enterprise') return 'multi_niveaux';
  return 'multi_niveaux';
}

export function getDefaultPlanByKey(planKey?: string | null): SubscriptionPlanConfig {
  const key = normalizePlanKey(planKey);
  return (
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.planKey === key) || DEFAULT_SUBSCRIPTION_PLANS[3]
  );
}

export interface SubscriptionRuntimeState {
  planKey: SubscriptionPlanKey;
  billingCycle: BillingCycle;
  status: EffectiveSubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  trialUsed: boolean;
  trialDaysRemaining: number;
  trialTotalDays: number;
  isTrialActive: boolean;
  isTrialExpiringSoon: boolean;
  isTrialExpired: boolean;
  isSubscriptionExpired: boolean;
  hasSubscriberAccess: boolean;
  renewsAt: string;
  subscriptionStartedAt: string;
}

export function computeTrialAndSubscriptionState(school?: {
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionRenewsAt?: string | null;
  billingCycle?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  trialUsed?: boolean | null;
  subscriptionStartedAt?: string | null;
  createdAt?: string | Date | null;
} | null): SubscriptionRuntimeState {
  if (!school) {
    return {
      planKey: 'multi_niveaux',
      billingCycle: 'monthly',
      status: 'trial',
      trialStartedAt: '',
      trialEndsAt: '',
      trialUsed: false,
      trialDaysRemaining: TRIAL_DURATION_DAYS,
      trialTotalDays: TRIAL_DURATION_DAYS,
      isTrialActive: false,
      isTrialExpiringSoon: false,
      isTrialExpired: false,
      isSubscriptionExpired: false,
      hasSubscriberAccess: true,
      renewsAt: '',
      subscriptionStartedAt: '',
    };
  }

  const nowMs = Date.now();
  const planKey = normalizePlanKey(school.subscriptionPlan);
  const billingCycle: BillingCycle = school.billingCycle === 'annual' ? 'annual' : 'monthly';
  const rawStatus = String(school.subscriptionStatus || 'trial').toLowerCase();

  const createdIso = school.createdAt
    ? new Date(school.createdAt).toISOString()
    : new Date(nowMs).toISOString();
  const trialStartedAt = school.trialStartedAt || createdIso;
  const trialStartMs = Date.parse(trialStartedAt) || nowMs;
  const trialEndsAt =
    school.trialEndsAt ||
    new Date(trialStartMs + TRIAL_DURATION_DAYS * 86400 * 1000).toISOString();
  const trialEndMs = Date.parse(trialEndsAt) || trialStartMs + TRIAL_DURATION_DAYS * 86400 * 1000;

  const msRemaining = trialEndMs - nowMs;
  const trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (86400 * 1000)));

  let status: EffectiveSubscriptionStatus = 'trial';
  if (rawStatus === 'suspended') {
    status = 'suspended';
  } else if (rawStatus === 'active') {
    const renewsAtMs = school.subscriptionRenewsAt
      ? Date.parse(`${school.subscriptionRenewsAt.slice(0, 10)}T23:59:59Z`)
      : 0;
    if (renewsAtMs && nowMs > renewsAtMs) {
      status = 'expired';
    } else {
      status = 'active';
    }
  } else if (rawStatus === 'expired' || rawStatus === 'past_due') {
    status = rawStatus === 'past_due' ? 'past_due' : 'expired';
  } else {
    // 'trial'
    if (msRemaining <= 0) {
      status = 'expired';
    } else {
      status = 'trial';
    }
  }

  const isTrialActive = status === 'trial' && trialDaysRemaining > 0;
  const isTrialExpiringSoon = isTrialActive && trialDaysRemaining <= 7;
  const isTrialExpired = rawStatus === 'trial' && status === 'expired';
  const isSubscriptionExpired = status === 'expired' || status === 'past_due';
  const hasSubscriberAccess = status === 'trial' || status === 'active';

  return {
    planKey,
    billingCycle,
    status,
    trialStartedAt,
    trialEndsAt,
    trialUsed: school.trialUsed !== false,
    trialDaysRemaining,
    trialTotalDays: TRIAL_DURATION_DAYS,
    isTrialActive,
    isTrialExpiringSoon,
    isTrialExpired,
    isSubscriptionExpired,
    hasSubscriberAccess,
    renewsAt: school.subscriptionRenewsAt || trialEndsAt.slice(0, 10),
    subscriptionStartedAt: school.subscriptionStartedAt || '',
  };
}
