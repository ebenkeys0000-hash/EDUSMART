import { Router } from 'express';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  activityLogs,
  attendance,
  classes,
  examinations,
  grades,
  invoices,
  payments,
  schools,
  students,
  teachers,
  users,
} from '../../db/schema.ts';
import { generateCode } from '../../lib/auth-crypto.ts';
import { normalizePlanKey } from '../../lib/subscriptionCatalog.ts';
import { AuthRequest, requireAuth, requireRole, requireSchool } from '../../middleware/auth.ts';
import {
  bootstrapSchoolDefaults,
  logActivity,
  sanitizeUser,
  seedSampleWestAfricanSchool,
} from '../helpers.ts';
import { buildNewTrialWindow } from '../subscriptionService.ts';

const router = Router();

// Onboarding: Create or attach school for newly authenticated user (e.g. Google Sign-In)
router.post('/setup', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });

    const {
      mode = 'create',
      schoolCode,
      name,
      country = 'Bénin',
      city = 'Cotonou',
      address = '',
      phone = '',
      email = '',
      website = '',
      currency = 'XOF',
      academicSystem = 'Francophone',
      subscriptionPlan = 'multi_niveaux',
      billingCycle = 'monthly',
      loadSampleData = false,
    } = req.body || {};

    if (mode === 'join' && schoolCode) {
      const found = await db
        .select()
        .from(schools)
        .where(eq(schools.code, String(schoolCode).trim().toUpperCase()))
        .limit(1);
      if (found.length === 0) {
        return res.status(404).json({ error: 'Invalid institution code.' });
      }
      const [updatedUser] = await db
        .update(users)
        .set({ schoolId: found[0].id, role: 'teacher' })
        .where(eq(users.id, req.dbUser.id))
        .returning();

      return res.json({ school: found[0], user: sanitizeUser(updatedUser) });
    }

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'School name is required.' });
    }

    if (req.dbUser.schoolId) {
      const [updated] = await db
        .update(schools)
        .set({
          name: String(name).trim(),
          country: String(country),
          city: String(city),
          address: String(address),
          phone: String(phone),
          email: String(email || req.dbUser.email),
          website: String(website),
          currency: String(currency),
          academicSystem: String(academicSystem),
          profileCompleted: true,
        })
        .where(eq(schools.id, req.dbUser.schoolId))
        .returning();

      if (loadSampleData) {
        await seedSampleWestAfricanSchool(updated.id, req.dbUser.fullName);
      }

      return res.json({ school: updated, user: sanitizeUser(req.dbUser) });
    }

    const slugBase = String(name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    const code = `${slugBase || 'EDU'}-${generateCode(4)}`;
    const trialWindow = buildNewTrialWindow();

    const [createdSchool] = await db
      .insert(schools)
      .values({
        name: String(name).trim(),
        code,
        country: String(country),
        city: String(city),
        address: String(address),
        phone: String(phone),
        email: String(email || req.dbUser.email),
        website: String(website),
        currency: String(currency),
        academicSystem: String(academicSystem),
        subscriptionPlan: normalizePlanKey(String(subscriptionPlan || 'multi_niveaux')),
        billingCycle: billingCycle === 'annual' ? 'annual' : 'monthly',
        subscriptionStatus: trialWindow.subscriptionStatus,
        trialStartedAt: trialWindow.trialStartedAt,
        trialEndsAt: trialWindow.trialEndsAt,
        trialUsed: trialWindow.trialUsed,
        subscriptionRenewsAt: trialWindow.subscriptionRenewsAt,
        profileCompleted: true,
      })
      .returning();

    const [updatedUser] = await db
      .update(users)
      .set({ schoolId: createdSchool.id, role: 'school_admin' })
      .where(eq(users.id, req.dbUser.id))
      .returning();

    await bootstrapSchoolDefaults(createdSchool.id, req.dbUser.fullName);
    if (loadSampleData) {
      await seedSampleWestAfricanSchool(createdSchool.id, req.dbUser.fullName);
    }

    res.status(201).json({ school: createdSchool, user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('School setup error:', error);
    res.status(500).json({ error: 'Failed to configure school profile.' });
  }
});

// Get current school
router.get('/current', requireAuth, requireSchool, async (req: AuthRequest, res) => {
  res.json({ school: req.school });
});

// Update current school settings / subscription plan
router.put(
  '/current',
  requireAuth,
  requireSchool,
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        name,
        country,
        city,
        address,
        phone,
        email,
        website,
        currency,
        academicSystem,
        subscriptionPlan,
        billingCycle,
        logoUrl,
      } = req.body || {};

      const [updated] = await db
        .update(schools)
        .set({
          name: name ? String(name).trim() : req.school!.name,
          country: country ? String(country) : req.school!.country,
          city: city ? String(city) : req.school!.city,
          address: address !== undefined ? String(address) : req.school!.address,
          phone: phone !== undefined ? String(phone) : req.school!.phone,
          email: email !== undefined ? String(email) : req.school!.email,
          website: website !== undefined ? String(website) : req.school!.website,
          currency: currency ? String(currency) : req.school!.currency,
          academicSystem: academicSystem ? String(academicSystem) : req.school!.academicSystem,
          subscriptionPlan: subscriptionPlan
            ? normalizePlanKey(String(subscriptionPlan))
            : req.school!.subscriptionPlan,
          billingCycle:
            billingCycle === 'annual' || billingCycle === 'monthly'
              ? billingCycle
              : req.school!.billingCycle,
          logoUrl: logoUrl !== undefined ? String(logoUrl) : req.school!.logoUrl,
          profileCompleted: true,
        })
        .where(eq(schools.id, schoolId))
        .returning();

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Mise à jour',
        'school',
        `Paramètres de l'établissement mis à jour`
      );

      res.json({ school: updated });
    } catch (error) {
      console.error('Update school error:', error);
      res.status(500).json({ error: 'Failed to update school profile.' });
    }
  }
);

// Populate starter curriculum & sample records for this school
router.post(
  '/seed-curriculum',
  requireAuth,
  requireSchool,
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const result = await seedSampleWestAfricanSchool(req.school!.id, req.dbUser!.fullName);
      res.json({
        success: true,
        alreadySeeded: result.alreadySeeded,
      });
    } catch (error) {
      console.error('Seed curriculum error:', error);
      res.status(500).json({ error: 'Failed to populate sample academic records.' });
    }
  }
);

// Dashboard overview real aggregated statistics
router.get('/dashboard', requireAuth, requireSchool, async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;

    const [
      allStudents,
      allTeachers,
      allClasses,
      allInvoices,
      allPayments,
      allAttendance,
      allExams,
      allGrades,
      recentLogs,
    ] = await Promise.all([
      db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.status, 'active'))),
      db.select().from(teachers).where(eq(teachers.schoolId, schoolId)),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)),
      db.select().from(invoices).where(eq(invoices.schoolId, schoolId)),
      db
        .select()
        .from(payments)
        .where(eq(payments.schoolId, schoolId))
        .orderBy(desc(payments.id))
        .limit(10),
      db.select().from(attendance).where(eq(attendance.schoolId, schoolId)),
      db
        .select()
        .from(examinations)
        .where(eq(examinations.schoolId, schoolId))
        .orderBy(desc(examinations.id)),
      db.select().from(grades).where(eq(grades.schoolId, schoolId)),
      db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.schoolId, schoolId))
        .orderBy(desc(activityLogs.id))
        .limit(10),
    ]);

    const totalRevenue = allInvoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
    const totalBilled = allInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const outstandingFees = Math.max(0, totalBilled - totalRevenue);

    // Attendance breakdown
    const attendanceStats = {
      total: allAttendance.length,
      present: allAttendance.filter((a) => a.status === 'present').length,
      absent: allAttendance.filter((a) => a.status === 'absent').length,
      late: allAttendance.filter((a) => a.status === 'late').length,
      excused: allAttendance.filter((a) => a.status === 'excused').length,
      rate:
        allAttendance.length > 0
          ? Math.round(
              ((allAttendance.filter((a) => a.status === 'present' || a.status === 'late').length /
                allAttendance.length) *
                100) *
                10
            ) / 10
          : 0,
    };

    // Student map for payment enrichment
    const studentMap = new Map(allStudents.map((s) => [s.id, s]));
    const recentPayments = allPayments.slice(0, 6).map((p) => {
      const st = studentMap.get(p.studentId);
      return {
        ...p,
        studentName: st ? `${st.firstName} ${st.lastName}` : `Élève #${p.studentId}`,
      };
    });

    // Academic performance by class (real average /20)
    const performanceByClass = allClasses.map((cls) => {
      const clsGrades = allGrades.filter((g) => g.classId === cls.id);
      const avg =
        clsGrades.length > 0
          ? Math.round(
              (clsGrades.reduce((sum, g) => sum + (g.score / (g.maxScore || 20)) * 20, 0) /
                clsGrades.length) *
                100
            ) / 100
          : 0;
      const enrolled = allStudents.filter((s) => s.classId === cls.id).length;
      return {
        classId: cls.id,
        className: cls.name,
        enrolled,
        averageOutOf20: avg,
        gradesCount: clsGrades.length,
      };
    });

    // Monthly revenue series from real payments
    const monthlyMap = new Map<string, number>();
    for (const p of allPayments) {
      const month = (p.paidAt || '').slice(0, 7) || new Date().toISOString().slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + p.amount);
    }
    const monthlyRevenue = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    res.json({
      kpis: {
        totalStudents: allStudents.length,
        totalTeachers: allTeachers.length,
        totalClasses: allClasses.length,
        totalRevenue,
        totalBilled,
        outstandingFees,
      },
      attendanceStats,
      recentPayments,
      recentActivities: recentLogs,
      upcomingExams: allExams.slice(0, 5),
      performanceByClass,
      monthlyRevenue,
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics.' });
  }
});

export default router;
