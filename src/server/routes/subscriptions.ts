import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { schools, subscriptionPayments } from '../../db/schema.ts';
import { generateCode } from '../../lib/auth-crypto.ts';
import {
  BillingCycle,
  computeAnnualPricing,
  normalizePlanKey,
} from '../../lib/subscriptionCatalog.ts';
import { AuthRequest, requireAuth, requireRole, requireSchool } from '../../middleware/auth.ts';
import { logActivity } from '../helpers.ts';
import {
  ensureDefaultSubscriptionPlans,
  getPlanFromDb,
  syncSchoolSubscriptionStatus,
} from '../subscriptionService.ts';

const router = Router();

// Public catalog endpoint: returns dynamic DB pricing & trial info for Landing Page & Auth
router.get('/plans', async (_req, res) => {
  try {
    const plans = await ensureDefaultSubscriptionPlans();
    res.json({
      plans: plans.filter((p) => p.isActive),
      trialDays: 30,
    });
  } catch (error) {
    console.error('Fetch subscription plans error:', error);
    res.status(500).json({ error: 'Failed to load subscription plans.' });
  }
});

// Authenticated school subscription summary, plans & billing history
router.get('/current', requireAuth, requireSchool, async (req: AuthRequest, res) => {
  try {
    const { school, state } = await syncSchoolSubscriptionStatus(req.school!);
    const [plans, paymentsHistory] = await Promise.all([
      ensureDefaultSubscriptionPlans(),
      db
        .select()
        .from(subscriptionPayments)
        .where(eq(subscriptionPayments.schoolId, school.id))
        .orderBy(desc(subscriptionPayments.id)),
    ]);

    res.json({
      school,
      subscriptionState: state,
      plans: plans.filter((p) => p.isActive),
      payments: paymentsHistory,
    });
  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({ error: 'Failed to load school subscription details.' });
  }
});

// Update selected plan preference & billing cycle during trial (no automatic billing)
router.post(
  '/plan-preference',
  requireAuth,
  requireSchool,
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const { school, state } = await syncSchoolSubscriptionStatus(req.school!);
      const { planKey, billingCycle = 'monthly' } = req.body || {};

      if (!planKey) {
        return res.status(400).json({ error: 'planKey is required.' });
      }

      const plan = await getPlanFromDb(String(planKey));
      const cycle: BillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly';

      const [updated] = await db
        .update(schools)
        .set({
          subscriptionPlan: plan.planKey,
          billingCycle: cycle,
        })
        .where(eq(schools.id, school.id))
        .returning();

      await logActivity(
        school.id,
        req.dbUser!.fullName,
        'Forfait sélectionné',
        'subscription',
        `${plan.nameFr} (${cycle === 'annual' ? 'Annuel -20%' : 'Mensuel'}) — aucune facturation automatique`
      );

      res.json({
        school: updated,
        subscriptionState: {
          ...state,
          planKey: plan.planKey,
          billingCycle: cycle,
        },
      });
    } catch (error) {
      console.error('Update plan preference error:', error);
      res.status(500).json({ error: 'Failed to save selected plan.' });
    }
  }
);

// Explicit subscription checkout submission (creates verified pending invoice — never simulates instant live charge or auto-bills without consent)
router.post(
  '/checkout',
  requireAuth,
  requireSchool,
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const { school } = await syncSchoolSubscriptionStatus(req.school!);
      const {
        planKey,
        billingCycle = 'monthly',
        paymentMethod = 'fedapay',
        paymentReference = '',
        notes = '',
        explicitAuthorization = false,
      } = req.body || {};

      if (explicitAuthorization !== true) {
        return res.status(400).json({
          error:
            'Explicit authorization is required. EDUSMART never bills automatically without your confirmation.',
        });
      }

      if (!planKey) {
        return res.status(400).json({ error: 'Please select a subscription plan.' });
      }

      const allowedMethods = ['fedapay', 'kkiapay', 'mobile_money', 'bank_transfer', 'cash'];
      const cleanMethod = allowedMethods.includes(String(paymentMethod))
        ? String(paymentMethod)
        : 'fedapay';

      const cleanRef = String(paymentReference || '').trim();
      if (!cleanRef) {
        return res.status(400).json({
          error: 'A payment transaction reference or transfer slip ID is required.',
        });
      }

      const plan = await getPlanFromDb(String(planKey));
      const cycle: BillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly';
      const pricing = computeAnnualPricing(plan.monthlyPriceXof, plan.annualDiscountPercent);

      // Authoritative server-side price calculation (never trusts client amounts)
      const amountXof = cycle === 'annual' ? plan.annualPriceXof : plan.monthlyPriceXof;
      const discountAmountXof = cycle === 'annual' ? pricing.savingsXof : 0;

      const today = new Date();
      const periodDays = cycle === 'annual' ? 365 : 30;
      const periodEnd = new Date(today.getTime() + periodDays * 86400 * 1000)
        .toISOString()
        .slice(0, 10);

      const invoiceNumber = `SUB-${today.getFullYear()}-${generateCode(5)}`;

      const [payment] = await db
        .insert(subscriptionPayments)
        .values({
          schoolId: school.id,
          planKey: normalizePlanKey(plan.planKey),
          billingCycle: cycle,
          amountXof,
          discountAmountXof,
          paymentMethod: cleanMethod,
          paymentReference: cleanRef,
          invoiceNumber,
          status: 'pending',
          authorizedByUserId: req.dbUser!.id,
          authorizedExplicitly: true,
          periodStart: today.toISOString().slice(0, 10),
          periodEnd,
          notes: String(notes || '').trim(),
        })
        .returning();

      // Store user's chosen plan preference on school without modifying active/expired entitlement until confirmed
      await db
        .update(schools)
        .set({
          subscriptionPlan: plan.planKey,
          billingCycle: cycle,
        })
        .where(eq(schools.id, school.id));

      await logActivity(
        school.id,
        req.dbUser!.fullName,
        'Demande d’abonnement',
        'subscription',
        `Facture ${invoiceNumber} (${plan.nameFr}, ${amountXof} FCFA via ${cleanMethod}, Réf: ${cleanRef})`
      );

      res.status(201).json({
        payment,
        message:
          'Subscription checkout recorded. Your invoice is pending payment validation by EDUSMART billing administration.',
      });
    } catch (error) {
      console.error('Subscription checkout error:', error);
      res.status(500).json({ error: 'Failed to submit subscription checkout.' });
    }
  }
);

export default router;
