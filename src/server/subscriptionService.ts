import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { schools, subscriptionPlans } from '../db/schema.ts';
import {
  computeAnnualPricing,
  computeTrialAndSubscriptionState,
  DEFAULT_SUBSCRIPTION_PLANS,
  normalizePlanKey,
  SubscriptionPlanConfig,
  SubscriptionPlanKey,
  SubscriptionRuntimeState,
  TRIAL_DURATION_DAYS,
} from '../lib/subscriptionCatalog.ts';

function safeJsonArray(raw: string | null | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

export function mapDbPlanToConfig(row: typeof subscriptionPlans.$inferSelect): SubscriptionPlanConfig {
  const fallback =
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.planKey === row.planKey) || DEFAULT_SUBSCRIPTION_PLANS[3];
  const pricing = computeAnnualPricing(row.monthlyPriceXof, row.annualDiscountPercent);
  return {
    id: row.id,
    planKey: normalizePlanKey(row.planKey),
    nameFr: row.nameFr,
    nameEn: row.nameEn,
    subtitleFr: row.subtitleFr || fallback.subtitleFr,
    subtitleEn: row.subtitleEn || fallback.subtitleEn,
    monthlyPriceXof: row.monthlyPriceXof,
    annualDiscountPercent: row.annualDiscountPercent,
    annualPriceXof: row.annualPriceXof || pricing.annualPriceXof,
    regularAnnualXof: pricing.regularAnnualXof,
    savingsXof: pricing.regularAnnualXof - (row.annualPriceXof || pricing.annualPriceXof),
    featuresFr: safeJsonArray(row.featuresFrJson, fallback.featuresFr),
    featuresEn: safeJsonArray(row.featuresEnJson, fallback.featuresEn),
    levels: safeJsonArray(row.levelsJson, fallback.levels),
    isPopular: row.isPopular,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export async function ensureDefaultSubscriptionPlans(): Promise<SubscriptionPlanConfig[]> {
  const existing = await db
    .select()
    .from(subscriptionPlans)
    .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.id));

  const existingKeys = new Set(existing.map((r) => r.planKey));
  const missing = DEFAULT_SUBSCRIPTION_PLANS.filter((p) => !existingKeys.has(p.planKey));

  if (missing.length > 0) {
    for (const plan of missing) {
      await db
        .insert(subscriptionPlans)
        .values({
          planKey: plan.planKey,
          nameFr: plan.nameFr,
          nameEn: plan.nameEn,
          subtitleFr: plan.subtitleFr,
          subtitleEn: plan.subtitleEn,
          monthlyPriceXof: plan.monthlyPriceXof,
          annualDiscountPercent: plan.annualDiscountPercent,
          annualPriceXof: plan.annualPriceXof,
          featuresFrJson: JSON.stringify(plan.featuresFr),
          featuresEnJson: JSON.stringify(plan.featuresEn),
          levelsJson: JSON.stringify(plan.levels),
          isPopular: plan.isPopular,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
        })
        .onConflictDoNothing({ target: subscriptionPlans.planKey });
    }
  }

  const finalRows = await db
    .select()
    .from(subscriptionPlans)
    .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.id));

  return finalRows.map(mapDbPlanToConfig);
}

export async function getPlanFromDb(planKey: string): Promise<SubscriptionPlanConfig> {
  const plans = await ensureDefaultSubscriptionPlans();
  const normalized: SubscriptionPlanKey = normalizePlanKey(planKey);
  return plans.find((p) => p.planKey === normalized) || plans[plans.length - 1];
}

export function buildNewTrialWindow(now = new Date()) {
  const trialStartedAt = now.toISOString();
  const trialEndsDate = new Date(now.getTime() + TRIAL_DURATION_DAYS * 86400 * 1000);
  const trialEndsAt = trialEndsDate.toISOString();
  return {
    subscriptionStatus: 'trial' as const,
    trialStartedAt,
    trialEndsAt,
    trialUsed: true,
    subscriptionRenewsAt: trialEndsAt.slice(0, 10),
  };
}

export async function syncSchoolSubscriptionStatus(
  school: typeof schools.$inferSelect
): Promise<{
  school: typeof schools.$inferSelect;
  state: SubscriptionRuntimeState;
}> {
  const state = computeTrialAndSubscriptionState(school);
  let current = school;

  // Persist automatic expiration transition (never resets trialStartedAt/trialEndsAt)
  if (
    state.status === 'expired' &&
    school.subscriptionStatus !== 'expired' &&
    school.subscriptionStatus !== 'suspended'
  ) {
    const [updated] = await db
      .update(schools)
      .set({ subscriptionStatus: 'expired' })
      .where(eq(schools.id, school.id))
      .returning();
    if (updated) current = updated;
  }

  return { school: current, state };
}
