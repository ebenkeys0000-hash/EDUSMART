import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  schools,
  students,
  subscriptionPayments,
  subscriptionPlans,
  supportRequests,
  teachers,
  users,
} from '../../db/schema.ts';
import { generateCode } from '../../lib/auth-crypto.ts';
import {
  BillingCycle,
  computeAnnualPricing,
  computeTrialAndSubscriptionState,
  normalizePlanKey,
} from '../../lib/subscriptionCatalog.ts';
import { AuthRequest, requireAuth, requireRole } from '../../middleware/auth.ts';
import { logActivity, sanitizeUser } from '../helpers.ts';
import {
  ensureDefaultSubscriptionPlans,
  getPlanFromDb,
  mapDbPlanToConfig,
  syncSchoolSubscriptionStatus,
} from '../subscriptionService.ts';

const router = Router();
router.use(requireAuth);

// Bootstrap initial super admin ONLY when zero super_admin exists in the entire platform
router.post('/bootstrap', async (req: AuthRequest, res) => {
  try {
    const existingSuperAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, 'super_admin'))
      .limit(1);

    if (existingSuperAdmins.length > 0 && req.dbUser!.role !== 'super_admin') {
      return res.status(403).json({ error: 'A platform Super Administrator already exists.' });
    }

    const [updated] = await db
      .update(users)
      .set({ role: 'super_admin' })
      .where(eq(users.id, req.dbUser!.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Super admin bootstrap error:', error);
    res.status(500).json({ error: 'Failed to activate Super Admin.' });
  }
});

// Platform-wide Super Admin overview (schools, trial/active/expired status, SaaS payments, revenue & editable pricing plans)
router.get('/overview', requireRole(['super_admin']), async (_req: AuthRequest, res) => {
  try {
    const [plans, rawSchools, allUsers, allStudents, allTeachers, allTickets, allPayments] =
      await Promise.all([
        ensureDefaultSubscriptionPlans(),
        db.select().from(schools).orderBy(desc(schools.id)),
        db.select().from(users).orderBy(desc(users.id)),
        db.select().from(students),
        db.select().from(teachers),
        db.select().from(supportRequests).orderBy(desc(supportRequests.id)),
        db.select().from(subscriptionPayments).orderBy(desc(subscriptionPayments.id)),
      ]);

    const planMap = new Map(plans.map((p) => [p.planKey, p]));

    // Sync any expired statuses automatically so reporting is 100% consistent
    const syncedSchools = await Promise.all(
      rawSchools.map(async (s) => {
        const synced = await syncSchoolSubscriptionStatus(s);
        return synced.school;
      })
    );

    const enrichedSchools = syncedSchools.map((s) => {
      const studentCount = allStudents.filter((st) => st.schoolId === s.id).length;
      const teacherCount = allTeachers.filter((t) => t.schoolId === s.id).length;
      const userCount = allUsers.filter((u) => u.schoolId === s.id).length;
      const state = computeTrialAndSubscriptionState(s);
      const planCfg = planMap.get(state.planKey);
      const monthlyEquivXof =
        state.status === 'active'
          ? state.billingCycle === 'annual'
            ? Math.round((planCfg?.annualPriceXof || 0) / 12)
            : planCfg?.monthlyPriceXof || 0
          : 0;

      return {
        ...s,
        normalizedPlanKey: state.planKey,
        effectiveStatus: state.status,
        trialDaysRemaining: state.trialDaysRemaining,
        isTrialActive: state.isTrialActive,
        isTrialExpiringSoon: state.isTrialExpiringSoon,
        studentCount,
        teacherCount,
        userCount,
        monthlyRevenue: monthlyEquivXof,
      };
    });

    const totalMonthlyRecurringRevenue = enrichedSchools.reduce(
      (sum, s) => sum + s.monthlyRevenue,
      0
    );
    const totalAnnualRecurringRevenue = totalMonthlyRecurringRevenue * 12;

    const collectedTotalXof = allPayments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amountXof || 0), 0);

    const pendingPaymentsCount = allPayments.filter((p) => p.status === 'pending').length;

    const schoolNameMap = new Map(syncedSchools.map((s) => [s.id, s.name]));
    const enrichedPayments = allPayments.map((p) => ({
      ...p,
      schoolName: schoolNameMap.get(p.schoolId) || `École #${p.schoolId}`,
    }));

    res.json({
      metrics: {
        totalSchools: enrichedSchools.length,
        trialSchools: enrichedSchools.filter((s) => s.effectiveStatus === 'trial').length,
        activeSchools: enrichedSchools.filter((s) => s.effectiveStatus === 'active').length,
        expiredSchools: enrichedSchools.filter(
          (s) => s.effectiveStatus === 'expired' || s.effectiveStatus === 'past_due'
        ).length,
        suspendedSchools: enrichedSchools.filter((s) => s.effectiveStatus === 'suspended').length,
        totalUsers: allUsers.length,
        totalStudentsPlatform: allStudents.length,
        totalMonthlyRecurringRevenue,
        totalAnnualRecurringRevenue,
        collectedTotalXof,
        pendingPaymentsCount,
        openSupportTickets: allTickets.filter((t) => t.status !== 'resolved').length,
      },
      plans,
      schools: enrichedSchools,
      payments: enrichedPayments,
      users: allUsers.map(sanitizeUser),
      supportRequests: allTickets,
    });
  } catch (error) {
    console.error('Super admin overview error:', error);
    res.status(500).json({ error: 'Failed to load platform metrics.' });
  }
});

// Super Admin ONLY: Edit SaaS Plan pricing, discount %, names or status
router.put('/plans/:planKey', requireRole(['super_admin']), async (req: AuthRequest, res) => {
  try {
    await ensureDefaultSubscriptionPlans();
    const planKey = normalizePlanKey(req.params.planKey);
    const found = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.planKey, planKey))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ error: 'Subscription plan not found.' });
    }

    const current = found[0];
    const {
      monthlyPriceXof,
      annualDiscountPercent,
      nameFr,
      nameEn,
      subtitleFr,
      subtitleEn,
      isActive,
      isPopular,
    } = req.body || {};

    const nextMonthly =
      monthlyPriceXof !== undefined
        ? Math.max(0, Math.round(Number(monthlyPriceXof) || 0))
        : current.monthlyPriceXof;
    const nextDiscount =
      annualDiscountPercent !== undefined
        ? Math.min(90, Math.max(0, Math.round(Number(annualDiscountPercent) || 0)))
        : current.annualDiscountPercent;

    const { annualPriceXof } = computeAnnualPricing(nextMonthly, nextDiscount);

    const [updated] = await db
      .update(subscriptionPlans)
      .set({
        monthlyPriceXof: nextMonthly,
        annualDiscountPercent: nextDiscount,
        annualPriceXof,
        nameFr: nameFr ? String(nameFr).trim() : current.nameFr,
        nameEn: nameEn ? String(nameEn).trim() : current.nameEn,
        subtitleFr: subtitleFr !== undefined ? String(subtitleFr).trim() : current.subtitleFr,
        subtitleEn: subtitleEn !== undefined ? String(subtitleEn).trim() : current.subtitleEn,
        isActive: isActive !== undefined ? Boolean(isActive) : current.isActive,
        isPopular: isPopular !== undefined ? Boolean(isPopular) : current.isPopular,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, current.id))
      .returning();

    res.json({ plan: mapDbPlanToConfig(updated) });
  } catch (error) {
    console.error('Update SaaS plan error:', error);
    res.status(500).json({ error: 'Failed to update subscription plan pricing.' });
  }
});

// Super Admin: Update school subscription plan, billing cycle, status, dates or trigger manual renewal
router.put('/schools/:id', requireRole(['super_admin']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const {
      subscriptionPlan,
      subscriptionStatus,
      billingCycle,
      subscriptionRenewsAt,
      action,
    } = req.body || {};

    const found = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'School not found.' });
    const current = found[0];

    const today = new Date();
    let nextPlan = subscriptionPlan ? normalizePlanKey(String(subscriptionPlan)) : current.subscriptionPlan;
    let nextCycle: BillingCycle =
      billingCycle === 'annual' || billingCycle === 'monthly'
        ? billingCycle
        : current.billingCycle === 'annual'
          ? 'annual'
          : 'monthly';
    let nextStatus = subscriptionStatus ? String(subscriptionStatus) : current.subscriptionStatus;
    let nextRenewsAt =
      subscriptionRenewsAt !== undefined
        ? String(subscriptionRenewsAt)
        : current.subscriptionRenewsAt;
    let nextStartedAt = current.subscriptionStartedAt;

    if (action === 'renew') {
      const days = nextCycle === 'annual' ? 365 : 30;
      const baseDate =
        current.subscriptionRenewsAt && Date.parse(current.subscriptionRenewsAt) > today.getTime()
          ? new Date(current.subscriptionRenewsAt)
          : today;
      nextStatus = 'active';
      nextStartedAt = current.subscriptionStartedAt || today.toISOString().slice(0, 10);
      nextRenewsAt = new Date(baseDate.getTime() + days * 86400 * 1000)
        .toISOString()
        .slice(0, 10);
    } else if (nextStatus === 'active' && !nextStartedAt) {
      nextStartedAt = today.toISOString().slice(0, 10);
      if (!nextRenewsAt || Date.parse(nextRenewsAt) < today.getTime()) {
        const days = nextCycle === 'annual' ? 365 : 30;
        nextRenewsAt = new Date(today.getTime() + days * 86400 * 1000).toISOString().slice(0, 10);
      }
    }

    // Enforce single trial per school: never reset trialStartedAt or trialEndsAt once used
    const [updated] = await db
      .update(schools)
      .set({
        subscriptionPlan: nextPlan,
        billingCycle: nextCycle,
        subscriptionStatus: nextStatus,
        subscriptionRenewsAt: nextRenewsAt,
        subscriptionStartedAt: nextStartedAt,
      })
      .where(eq(schools.id, id))
      .returning();

    await logActivity(
      id,
      req.dbUser!.fullName,
      'Administration SaaS',
      'subscription',
      `Statut: ${updated.subscriptionStatus}, Plan: ${updated.subscriptionPlan} (${updated.billingCycle})`
    );

    res.json({ school: updated });
  } catch (error) {
    console.error('Super admin update school error:', error);
    res.status(500).json({ error: 'Failed to update school subscription.' });
  }
});

// Super Admin: Record manual SaaS payment & optionally activate immediately
router.post('/payments', requireRole(['super_admin']), async (req: AuthRequest, res) => {
  try {
    const {
      schoolId,
      planKey,
      billingCycle = 'monthly',
      paymentMethod = 'bank_transfer',
      paymentReference = '',
      status = 'paid',
      notes = '',
    } = req.body || {};

    const sid = Number(schoolId);
    const foundSchool = await db.select().from(schools).where(eq(schools.id, sid)).limit(1);
    if (foundSchool.length === 0) {
      return res.status(404).json({ error: 'Target school not found.' });
    }

    const plan = await getPlanFromDb(String(planKey || foundSchool[0].subscriptionPlan));
    const cycle: BillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly';
    const pricing = computeAnnualPricing(plan.monthlyPriceXof, plan.annualDiscountPercent);
    const amountXof = cycle === 'annual' ? plan.annualPriceXof : plan.monthlyPriceXof;
    const discountAmountXof = cycle === 'annual' ? pricing.savingsXof : 0;

    const today = new Date();
    const periodStart = today.toISOString().slice(0, 10);
    const periodDays = cycle === 'annual' ? 365 : 30;
    const periodEnd = new Date(today.getTime() + periodDays * 86400 * 1000)
      .toISOString()
      .slice(0, 10);
    const invoiceNumber = `SUB-${today.getFullYear()}-${generateCode(5)}`;
    const cleanStatus = ['pending', 'paid', 'cancelled', 'refunded'].includes(String(status))
      ? String(status)
      : 'paid';

    const [created] = await db
      .insert(subscriptionPayments)
      .values({
        schoolId: sid,
        planKey: plan.planKey,
        billingCycle: cycle,
        amountXof,
        discountAmountXof,
        paymentMethod: String(paymentMethod || 'bank_transfer'),
        paymentReference: String(paymentReference || `ADM-${generateCode(4)}`),
        invoiceNumber,
        status: cleanStatus,
        authorizedByUserId: req.dbUser!.id,
        authorizedExplicitly: true,
        periodStart,
        periodEnd,
        paidAt: cleanStatus === 'paid' ? periodStart : '',
        notes: String(notes || 'Enregistré par Super Admin'),
      })
      .returning();

    if (cleanStatus === 'paid') {
      await db
        .update(schools)
        .set({
          subscriptionPlan: plan.planKey,
          billingCycle: cycle,
          subscriptionStatus: 'active',
          subscriptionStartedAt: foundSchool[0].subscriptionStartedAt || periodStart,
          subscriptionRenewsAt: periodEnd,
        })
        .where(eq(schools.id, sid));
    }

    res.status(201).json({ payment: created });
  } catch (error) {
    console.error('Create SaaS payment error:', error);
    res.status(500).json({ error: 'Failed to record subscription payment.' });
  }
});

// Super Admin: Confirm / update SaaS payment status (confirming 'paid' activates school subscription)
router.put('/payments/:id', requireRole(['super_admin']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body || {};
    const found = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.id, id))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ error: 'Subscription payment record not found.' });
    }
    const payment = found[0];
    const nextStatus = ['pending', 'paid', 'cancelled', 'refunded'].includes(String(status))
      ? String(status)
      : payment.status;
    const todayIso = new Date().toISOString().slice(0, 10);

    const [updatedPayment] = await db
      .update(subscriptionPayments)
      .set({
        status: nextStatus,
        paidAt: nextStatus === 'paid' ? payment.paidAt || todayIso : payment.paidAt,
        notes: notes !== undefined ? String(notes) : payment.notes,
      })
      .where(eq(subscriptionPayments.id, id))
      .returning();

    if (nextStatus === 'paid') {
      const targetSchool = await db
        .select()
        .from(schools)
        .where(eq(schools.id, payment.schoolId))
        .limit(1);
      const existingSchool = targetSchool[0];
      if (existingSchool) {
        const periodDays = payment.billingCycle === 'annual' ? 365 : 30;
        const baseMs =
          existingSchool.subscriptionRenewsAt &&
          Date.parse(existingSchool.subscriptionRenewsAt) > Date.now() &&
          existingSchool.subscriptionStatus === 'active'
            ? Date.parse(existingSchool.subscriptionRenewsAt)
            : Date.now();
        const nextRenewsAt = new Date(baseMs + periodDays * 86400 * 1000)
          .toISOString()
          .slice(0, 10);

        await db
          .update(schools)
          .set({
            subscriptionPlan: normalizePlanKey(payment.planKey),
            billingCycle: payment.billingCycle === 'annual' ? 'annual' : 'monthly',
            subscriptionStatus: 'active',
            subscriptionStartedAt: existingSchool.subscriptionStartedAt || todayIso,
            subscriptionRenewsAt: nextRenewsAt,
          })
          .where(eq(schools.id, existingSchool.id));

        await logActivity(
          existingSchool.id,
          req.dbUser!.fullName,
          'Abonnement activé',
          'subscription',
          `Facture ${payment.invoiceNumber} validée (${payment.amountXof} FCFA) jusqu’au ${nextRenewsAt}`
        );
      }
    }

    res.json({ payment: updatedPayment });
  } catch (error) {
    console.error('Update SaaS payment error:', error);
    res.status(500).json({ error: 'Failed to update subscription payment.' });
  }
});

// Update support ticket status
router.put('/support/:id', requireRole(['super_admin']), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const [updated] = await db
      .update(supportRequests)
      .set({ status: status || 'resolved' })
      .where(eq(supportRequests.id, id))
      .returning();

    res.json({ ticket: updated });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update support request.' });
  }
});

export default router;
