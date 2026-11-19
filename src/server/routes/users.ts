import { Router } from 'express';
import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  announcements,
  attendance,
  classes,
  examinations,
  grades,
  invoices,
  payments,
  students,
  subjects,
  timetables,
  users,
} from '../../db/schema.ts';
import { hashPassword } from '../../lib/auth-crypto.ts';
import {
  AuthRequest,
  requireActiveSubscriptionForWrites,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';
import { sanitizeUser } from '../helpers.ts';

const router = Router();
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

// List school users (for School Admin RBAC management)
router.get(
  '/school-users',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const items = await db
        .select()
        .from(users)
        .where(eq(users.schoolId, schoolId))
        .orderBy(desc(users.id));
      res.json({ items: items.map(sanitizeUser) });
    } catch (error) {
      console.error('List school users error:', error);
      res.status(500).json({ error: 'Failed to load school users.' });
    }
  }
);

// Create a staff, teacher, accountant, parent, or student portal account inside this school
router.post(
  '/school-users',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        fullName,
        email,
        password,
        phone = '',
        role = 'teacher',
        linkedStudentId = null,
        linkedTeacherId = null,
      } = req.body || {};

      if (!fullName || !email || !password) {
        return res.status(400).json({ error: 'Full name, email, and password are required.' });
      }
      const allowedRoles = ['school_admin', 'accountant', 'teacher', 'parent', 'student'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role selected.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const existing = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Email is already registered.' });
      }

      const [created] = await db
        .insert(users)
        .values({
          uid: `local_${crypto.randomUUID()}`,
          schoolId,
          email: cleanEmail,
          passwordHash: hashPassword(String(password)),
          fullName: String(fullName).trim(),
          phone: String(phone),
          role,
          status: 'active',
          emailVerified: true,
          linkedStudentId: linkedStudentId ? Number(linkedStudentId) : null,
          linkedTeacherId: linkedTeacherId ? Number(linkedTeacherId) : null,
        })
        .returning();

      res.status(201).json({ user: sanitizeUser(created) });
    } catch (error) {
      console.error('Create school user error:', error);
      res.status(500).json({ error: 'Failed to create user account.' });
    }
  }
);

// Update user role or status
router.put(
  '/school-users/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const { role, status, linkedStudentId } = req.body || {};

      const found = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.schoolId, schoolId)))
        .limit(1);
      if (found.length === 0) return res.status(404).json({ error: 'User not found.' });

      const cur = found[0];
      const [updated] = await db
        .update(users)
        .set({
          role: role || cur.role,
          status: status || cur.status,
          linkedStudentId:
            linkedStudentId !== undefined
              ? linkedStudentId
                ? Number(linkedStudentId)
                : null
              : cur.linkedStudentId,
        })
        .where(and(eq(users.id, id), eq(users.schoolId, schoolId)))
        .returning();

      res.json({ user: sanitizeUser(updated) });
    } catch (error) {
      console.error('Update school user error:', error);
      res.status(500).json({ error: 'Failed to update user.' });
    }
  }
);

// Parent & Student Portal summary
router.get('/portal', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const user = req.dbUser!;

    let schoolStudents = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.status, 'active')));

    // Filter to linked student if parent/student role has a linkedStudentId or matching parent email
    let targetStudents = schoolStudents;
    if (user.role === 'student' || user.role === 'parent') {
      if (user.linkedStudentId) {
        targetStudents = schoolStudents.filter((s) => s.id === user.linkedStudentId);
      } else {
        const byEmail = schoolStudents.filter(
          (s) => (s.parentEmail || '').toLowerCase() === user.email.toLowerCase()
        );
        if (byEmail.length > 0) {
          targetStudents = byEmail;
        } else {
          targetStudents = schoolStudents.slice(0, 1);
        }
      }
    } else if (req.query.studentId) {
      targetStudents = schoolStudents.filter((s) => s.id === Number(req.query.studentId));
    } else {
      targetStudents = schoolStudents.slice(0, 1);
    }

    const activeStudent = targetStudents[0] || null;
    if (!activeStudent) {
      const schoolAnnouncements = await db
        .select()
        .from(announcements)
        .where(eq(announcements.schoolId, schoolId))
        .orderBy(desc(announcements.id));
      return res.json({
        student: null,
        availableStudents: schoolStudents,
        grades: [],
        attendance: [],
        invoices: [],
        payments: [],
        timetable: [],
        announcements: schoolAnnouncements,
      });
    }

    const [
      stGrades,
      stAttendance,
      stInvoices,
      stPayments,
      allSubjects,
      allExams,
      allClasses,
      clsTimetable,
      schoolAnnouncements,
    ] = await Promise.all([
      db
        .select()
        .from(grades)
        .where(and(eq(grades.schoolId, schoolId), eq(grades.studentId, activeStudent.id))),
      db
        .select()
        .from(attendance)
        .where(and(eq(attendance.schoolId, schoolId), eq(attendance.studentId, activeStudent.id)))
        .orderBy(desc(attendance.date)),
      db
        .select()
        .from(invoices)
        .where(and(eq(invoices.schoolId, schoolId), eq(invoices.studentId, activeStudent.id))),
      db
        .select()
        .from(payments)
        .where(and(eq(payments.schoolId, schoolId), eq(payments.studentId, activeStudent.id)))
        .orderBy(desc(payments.id)),
      db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
      db.select().from(examinations).where(eq(examinations.schoolId, schoolId)),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)),
      activeStudent.classId
        ? db
            .select()
            .from(timetables)
            .where(
              and(eq(timetables.schoolId, schoolId), eq(timetables.classId, activeStudent.classId))
            )
        : Promise.resolve([]),
      db
        .select()
        .from(announcements)
        .where(eq(announcements.schoolId, schoolId))
        .orderBy(desc(announcements.id)),
    ]);

    const subMap = new Map(allSubjects.map((s) => [s.id, s]));
    const examMap = new Map(allExams.map((e) => [e.id, e]));
    const classMap = new Map(allClasses.map((c) => [c.id, c.name]));

    res.json({
      student: {
        ...activeStudent,
        className: activeStudent.classId ? classMap.get(activeStudent.classId) || '' : '',
      },
      availableStudents:
        user.role === 'parent' || user.role === 'student' ? targetStudents : schoolStudents,
      grades: stGrades.map((g) => ({
        ...g,
        subjectName: subMap.get(g.subjectId)?.name || '',
        examTitle: examMap.get(g.examinationId)?.title || '',
        examDate: examMap.get(g.examinationId)?.examDate || '',
      })),
      attendance: stAttendance,
      invoices: stInvoices,
      payments: stPayments,
      timetable: clsTimetable.map((t) => ({
        ...t,
        subjectName: subMap.get(t.subjectId)?.name || '',
      })),
      announcements: schoolAnnouncements,
    });
  } catch (error) {
    console.error('Portal summary error:', error);
    res.status(500).json({ error: 'Failed to load portal data.' });
  }
});

export default router;
