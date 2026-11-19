import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { staffPayroll, teachers } from '../../db/schema.ts';
import {
  AuthRequest,
  requireActiveSubscriptionForWrites,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';
import { logActivity } from '../helpers.ts';

const router = Router();
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

// List payroll records
router.get(
  '/',
  requireRole(['school_admin', 'super_admin', 'accountant']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const items = await db
        .select()
        .from(staffPayroll)
        .where(eq(staffPayroll.schoolId, schoolId))
        .orderBy(desc(staffPayroll.id));

      const totalPaid = items
        .filter((i) => i.status === 'paid')
        .reduce((s, i) => s + i.netSalary, 0);
      const totalPending = items
        .filter((i) => i.status === 'pending')
        .reduce((s, i) => s + i.netSalary, 0);

      res.json({ items, summary: { totalPaid, totalPending } });
    } catch (error) {
      console.error('List payroll error:', error);
      res.status(500).json({ error: 'Failed to load payroll records.' });
    }
  }
);

// Create payroll entry
router.post(
  '/',
  requireRole(['school_admin', 'super_admin', 'accountant']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        teacherId = null,
        staffName,
        roleTitle = 'Enseignant',
        month = new Date().toISOString().slice(0, 7),
        baseSalary = 0,
        allowances = 0,
        deductions = 0,
        paymentMethod = 'bank_transfer',
      } = req.body || {};

      if (!staffName) return res.status(400).json({ error: 'Staff name is required.' });

      const base = Number(baseSalary) || 0;
      const allow = Number(allowances) || 0;
      const deduct = Number(deductions) || 0;
      const netSalary = Math.max(0, base + allow - deduct);

      const [created] = await db
        .insert(staffPayroll)
        .values({
          schoolId,
          teacherId: teacherId ? Number(teacherId) : null,
          staffName: String(staffName).trim(),
          roleTitle: String(roleTitle),
          month: String(month),
          baseSalary: base,
          allowances: allow,
          deductions: deduct,
          netSalary,
          status: 'pending',
          paymentMethod: String(paymentMethod),
        })
        .returning();

      res.status(201).json({ record: created });
    } catch (error) {
      console.error('Create payroll error:', error);
      res.status(500).json({ error: 'Failed to create payroll entry.' });
    }
  }
);

// Generate monthly payroll for all active teachers
router.post(
  '/generate-month',
  requireRole(['school_admin', 'super_admin', 'accountant']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const month = String(req.body?.month || new Date().toISOString().slice(0, 7));

      const [activeTeachers, existingMonth] = await Promise.all([
        db
          .select()
          .from(teachers)
          .where(and(eq(teachers.schoolId, schoolId), eq(teachers.status, 'active'))),
        db
          .select()
          .from(staffPayroll)
          .where(and(eq(staffPayroll.schoolId, schoolId), eq(staffPayroll.month, month))),
      ]);

      const existingTeacherIds = new Set(existingMonth.map((e) => e.teacherId).filter(Boolean));
      const toInsert = activeTeachers.filter((t) => !existingTeacherIds.has(t.id));

      if (toInsert.length === 0) {
        return res.json({ createdCount: 0, message: 'Payroll already generated for this month.' });
      }

      const created = await db
        .insert(staffPayroll)
        .values(
          toInsert.map((t) => ({
            schoolId,
            teacherId: t.id,
            staffName: `${t.firstName} ${t.lastName}`,
            roleTitle: `Enseignant — ${t.specialization || 'Général'}`,
            month,
            baseSalary: t.baseSalary,
            allowances: 0,
            deductions: 0,
            netSalary: t.baseSalary,
            status: 'pending',
            paymentMethod: 'bank_transfer',
          }))
        )
        .returning();

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Paie générée',
        'payroll',
        `${created.length} fiches de paie générées pour ${month}`
      );

      res.status(201).json({ createdCount: created.length });
    } catch (error) {
      console.error('Generate payroll error:', error);
      res.status(500).json({ error: 'Failed to generate monthly payroll.' });
    }
  }
);

// Mark payroll entry as paid
router.post(
  '/:id/pay',
  requireRole(['school_admin', 'super_admin', 'accountant']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const today = new Date().toISOString().slice(0, 10);

      const [updated] = await db
        .update(staffPayroll)
        .set({ status: 'paid', paidAt: today })
        .where(and(eq(staffPayroll.id, id), eq(staffPayroll.schoolId, schoolId)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Payroll record not found.' });
      res.json({ record: updated });
    } catch (error) {
      console.error('Pay payroll error:', error);
      res.status(500).json({ error: 'Failed to mark payroll as paid.' });
    }
  }
);

export default router;
