import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { classes, feeCategories, invoices, payments, students } from '../../db/schema.ts';
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

// Finance overview: categories, invoices, payments, financial summary
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const [cats, allInvoices, allPayments, allStudents, allClasses] = await Promise.all([
      db.select().from(feeCategories).where(eq(feeCategories.schoolId, schoolId)),
      db
        .select()
        .from(invoices)
        .where(eq(invoices.schoolId, schoolId))
        .orderBy(desc(invoices.id)),
      db
        .select()
        .from(payments)
        .where(eq(payments.schoolId, schoolId))
        .orderBy(desc(payments.id)),
      db.select().from(students).where(eq(students.schoolId, schoolId)),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)),
    ]);

    const studentMap = new Map(allStudents.map((s) => [s.id, s]));
    const classMap = new Map(allClasses.map((c) => [c.id, c.name]));

    const enrichedInvoices = allInvoices.map((inv) => {
      const st = studentMap.get(inv.studentId);
      const balance = Math.max(0, inv.totalAmount - inv.paidAmount);
      return {
        ...inv,
        balance,
        studentName: st ? `${st.firstName} ${st.lastName}` : `Élève #${inv.studentId}`,
        registrationNumber: st?.registrationNumber || '',
        className: st?.classId ? classMap.get(st.classId) || '' : '',
      };
    });

    const enrichedPayments = allPayments.map((p) => {
      const st = studentMap.get(p.studentId);
      return {
        ...p,
        studentName: st ? `${st.firstName} ${st.lastName}` : `Élève #${p.studentId}`,
        registrationNumber: st?.registrationNumber || '',
      };
    });

    const totalExpected = allInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollected = allInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalOutstanding = Math.max(0, totalExpected - totalCollected);

    res.json({
      categories: cats,
      invoices: enrichedInvoices,
      payments: enrichedPayments,
      summary: {
        totalExpected,
        totalCollected,
        totalOutstanding,
        collectionRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
      },
      paymentGateways: {
        fedapay: { ready: true, mode: 'integration_ready', supportedCurrencies: ['XOF', 'XAF'] },
        kkiapay: { ready: true, mode: 'integration_ready', supportedCurrencies: ['XOF', 'XAF'] },
      },
    });
  } catch (error) {
    console.error('Finance overview error:', error);
    res.status(500).json({ error: 'Failed to load financial records.' });
  }
});

// Create fee category
router.post(
  '/categories',
  requireRole(['school_admin', 'super_admin', 'accountant']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { name, type = 'tuition', defaultAmount = 0, frequency = 'annual', description = '' } =
        req.body || {};
      if (!name) return res.status(400).json({ error: 'Category name is required.' });

      const [created] = await db
        .insert(feeCategories)
        .values({
          schoolId,
          name: String(name).trim(),
          type: String(type),
          defaultAmount: Number(defaultAmount) || 0,
          frequency: String(frequency),
          description: String(description),
        })
        .returning();

      res.status(201).json({ category: created });
    } catch (error) {
      console.error('Create fee category error:', error);
      res.status(500).json({ error: 'Failed to create fee category.' });
    }
  }
);

// Create invoice (single student or entire class)
router.post(
  '/invoices',
  requireRole(['school_admin', 'super_admin', 'accountant']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { studentId, classId, feeCategoryId = null, title, totalAmount, dueDate } =
        req.body || {};

      if (!title || !totalAmount || !dueDate) {
        return res.status(400).json({ error: 'Title, amount, and due date are required.' });
      }

      let targetStudentIds: number[] = [];
      if (studentId) {
        targetStudentIds = [Number(studentId)];
      } else if (classId) {
        const clsStudents = await db
          .select()
          .from(students)
          .where(
            and(
              eq(students.schoolId, schoolId),
              eq(students.classId, Number(classId)),
              eq(students.status, 'active')
            )
          );
        targetStudentIds = clsStudents.map((s) => s.id);
      }

      if (targetStudentIds.length === 0) {
        return res.status(400).json({ error: 'No target active students selected.' });
      }

      const existingCount = await db
        .select()
        .from(invoices)
        .where(eq(invoices.schoolId, schoolId));
      const year = new Date().getFullYear();

      const rows = targetStudentIds.map((stId, idx) => ({
        schoolId,
        invoiceNumber: `FAC-${year}-${String(existingCount.length + idx + 1).padStart(4, '0')}`,
        studentId: stId,
        feeCategoryId: feeCategoryId ? Number(feeCategoryId) : null,
        title: String(title).trim(),
        totalAmount: Number(totalAmount),
        paidAmount: 0,
        dueDate: String(dueDate),
        status: 'unpaid',
      }));

      const created = await db.insert(invoices).values(rows).returning();

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Facturation',
        'invoice',
        `${created.length} facture(s) émise(s) — ${title}`
      );

      res.status(201).json({ invoices: created });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ error: 'Failed to create invoice.' });
    }
  }
);

// Record payment (supports partial payments + receipt generation + FedaPay/Kkiapay reference)
router.post(
  '/payments',
  requireRole(['school_admin', 'super_admin', 'accountant']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        invoiceId,
        amount,
        paymentMethod = 'cash',
        paymentProviderRef = '',
        paidAt = new Date().toISOString().slice(0, 10),
        notes = '',
      } = req.body || {};

      const payAmount = Number(amount);
      if (!invoiceId || !payAmount || payAmount <= 0) {
        return res.status(400).json({ error: 'Valid invoice and positive payment amount required.' });
      }

      const foundInv = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, Number(invoiceId)), eq(invoices.schoolId, schoolId)))
        .limit(1);
      if (foundInv.length === 0) {
        return res.status(404).json({ error: 'Invoice not found.' });
      }

      const inv = foundInv[0];
      const remaining = Math.max(0, inv.totalAmount - inv.paidAmount);
      if (payAmount > remaining) {
        return res.status(400).json({
          error: `Payment exceeds remaining balance (${remaining}).`,
        });
      }

      const existingPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.schoolId, schoolId));
      const receiptNumber = `REC-${new Date().getFullYear()}-${String(
        existingPayments.length + 1
      ).padStart(4, '0')}`;

      const [createdPayment] = await db
        .insert(payments)
        .values({
          schoolId,
          receiptNumber,
          invoiceId: inv.id,
          studentId: inv.studentId,
          amount: payAmount,
          paymentMethod: String(paymentMethod),
          paymentProviderRef: String(paymentProviderRef),
          paidAt: String(paidAt),
          notes: String(notes),
          recordedByUserId: req.dbUser!.id,
        })
        .returning();

      const newPaidAmount = inv.paidAmount + payAmount;
      const newStatus = newPaidAmount >= inv.totalAmount ? 'paid' : 'partial';

      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          paidAmount: newPaidAmount,
          status: newStatus,
        })
        .where(and(eq(invoices.id, inv.id), eq(invoices.schoolId, schoolId)))
        .returning();

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Encaissement',
        'payment',
        `Reçu ${receiptNumber} — ${payAmount.toLocaleString('fr-FR')} ${req.school!.currency} (${paymentMethod})`
      );

      res.status(201).json({ payment: createdPayment, invoice: updatedInvoice });
    } catch (error) {
      console.error('Record payment error:', error);
      res.status(500).json({ error: 'Failed to record payment.' });
    }
  }
);

export default router;
