import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  attendance,
  classes,
  grades,
  idCards,
  invoices,
  parents,
  payments,
  students,
} from '../../db/schema.ts';
import {
  AuthRequest,
  requireActiveSubscriptionForWrites,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';
import { logActivity } from '../helpers.ts';
import { ensureStudentIdCard, getCurrentAcademicYearLabel } from '../idCardService.ts';

const router = Router();
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

// List students with search, classId, status, pagination
router.get('/', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const search = String(req.query.search || '').trim().toLowerCase();
    const classIdParam = req.query.classId ? Number(req.query.classId) : null;
    const statusParam = String(req.query.status || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize || 20)));

    const [allStudents, allClasses, allCards] = await Promise.all([
      db
        .select()
        .from(students)
        .where(eq(students.schoolId, schoolId))
        .orderBy(desc(students.id)),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)),
      db
        .select()
        .from(idCards)
        .where(and(eq(idCards.schoolId, schoolId), eq(idCards.cardType, 'student'))),
    ]);

    const classMap = new Map(allClasses.map((c) => [c.id, c.name]));
    const cardMap = new Map(allCards.map((c) => [c.studentId, c]));

    let filtered = allStudents.map((s) => ({
      ...s,
      className: s.classId ? classMap.get(s.classId) || 'Non assigné' : 'Non assigné',
      idCard: cardMap.get(s.id) || null,
    }));

    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.firstName.toLowerCase().includes(search) ||
          s.lastName.toLowerCase().includes(search) ||
          s.registrationNumber.toLowerCase().includes(search) ||
          (s.parentName || '').toLowerCase().includes(search)
      );
    }
    if (classIdParam) {
      filtered = filtered.filter((s) => s.classId === classIdParam);
    }
    if (statusParam && statusParam !== 'all') {
      filtered = filtered.filter((s) => s.status === statusParam);
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('List students error:', error);
    res.status(500).json({ error: 'Failed to load students.' });
  }
});

// Get single student full profile (academic history, attendance, invoices, grades)
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid student ID.' });

    const found = await db
      .select()
      .from(students)
      .where(and(eq(students.id, id), eq(students.schoolId, schoolId)))
      .limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Student not found.' });

    const student = found[0];
    const [studentAttendance, studentInvoices, studentPayments, studentGrades, cls, cardRows] =
      await Promise.all([
        db
          .select()
          .from(attendance)
          .where(and(eq(attendance.schoolId, schoolId), eq(attendance.studentId, id)))
          .orderBy(desc(attendance.date))
          .limit(30),
        db
          .select()
          .from(invoices)
          .where(and(eq(invoices.schoolId, schoolId), eq(invoices.studentId, id))),
        db
          .select()
          .from(payments)
          .where(and(eq(payments.schoolId, schoolId), eq(payments.studentId, id)))
          .orderBy(desc(payments.id)),
        db
          .select()
          .from(grades)
          .where(and(eq(grades.schoolId, schoolId), eq(grades.studentId, id))),
        student.classId
          ? db
              .select()
              .from(classes)
              .where(and(eq(classes.schoolId, schoolId), eq(classes.id, student.classId)))
              .limit(1)
          : Promise.resolve([]),
        db
          .select()
          .from(idCards)
          .where(
            and(
              eq(idCards.schoolId, schoolId),
              eq(idCards.cardType, 'student'),
              eq(idCards.studentId, id)
            )
          )
          .limit(1),
      ]);

    res.json({
      student: {
        ...student,
        className: cls[0]?.name || 'Non assigné',
        idCard: cardRows[0] || null,
      },
      attendance: studentAttendance,
      invoices: studentInvoices,
      payments: studentPayments,
      grades: studentGrades,
    });
  } catch (error) {
    console.error('Student profile error:', error);
    res.status(500).json({ error: 'Failed to load student profile.' });
  }
});

// Create student with mandatory photo, auto-generated ID, and automatic ID card generation
router.post(
  '/',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        firstName,
        lastName,
        gender = 'M',
        dateOfBirth = '',
        placeOfBirth = '',
        address = '',
        photoUrl = '',
        classId = null,
        academicYearId = null,
        academicYearName = '',
        parentName = '',
        parentPhone = '',
        parentEmail = '',
        emergencyContact = '',
        academicHistory = '',
        enrollmentDate = new Date().toISOString().slice(0, 10),
        status = 'active',
      } = req.body || {};

      if (!firstName || !lastName) {
        return res.status(400).json({ error: 'First name and last name are required.' });
      }
      const cleanPhotoUrl = String(photoUrl || '').trim();
      if (!cleanPhotoUrl) {
        return res.status(400).json({
          error: 'Student photograph is mandatory for registration and ID card generation.',
        });
      }
      if (cleanPhotoUrl.length > 2_000_000) {
        return res.status(400).json({ error: 'Photo size exceeds 1.5MB limit.' });
      }

      const existingCount = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.schoolId, schoolId));
      const year = new Date().getFullYear();
      const seq = String(existingCount.length + 1).padStart(4, '0');
      const registrationNumber = `EDU-${year}-${seq}`;

      const yearInfo = await getCurrentAcademicYearLabel(
        schoolId,
        academicYearId ? Number(academicYearId) : null,
        String(academicYearName || '')
      );

      let parentId: number | null = null;
      if (parentName && parentPhone) {
        const [createdParent] = await db
          .insert(parents)
          .values({
            schoolId,
            fullName: String(parentName).trim(),
            relationship: 'Parent / Tuteur',
            phone: String(parentPhone).trim(),
            email: String(parentEmail || ''),
            address: String(address || ''),
          })
          .returning();
        parentId = createdParent.id;
      }

      const [created] = await db
        .insert(students)
        .values({
          schoolId,
          registrationNumber,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          gender: gender === 'F' ? 'F' : 'M',
          dateOfBirth: String(dateOfBirth),
          placeOfBirth: String(placeOfBirth),
          address: String(address),
          photoUrl: cleanPhotoUrl,
          classId: classId ? Number(classId) : null,
          academicYearId: yearInfo.id,
          academicYearName: yearInfo.name,
          parentId,
          parentName: String(parentName),
          parentPhone: String(parentPhone),
          parentEmail: String(parentEmail),
          emergencyContact: String(emergencyContact || parentPhone),
          academicHistory: String(academicHistory),
          enrollmentDate: String(enrollmentDate),
          status: String(status || 'active'),
        })
        .returning();

      // Automatically generate Student ID Card immediately
      const { card: idCard } = await ensureStudentIdCard(created, schoolId, false);

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Inscription élève & Carte générée',
        'student',
        `${created.firstName} ${created.lastName} (${created.registrationNumber})`
      );

      res.status(201).json({
        student: {
          ...created,
          className: idCard.designationOrClass,
          idCard,
        },
        idCard,
      });
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ error: 'Failed to create student.' });
    }
  }
);

// Update student and sync ID card
router.put(
  '/:id',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid student ID.' });

      const existing = await db
        .select()
        .from(students)
        .where(and(eq(students.id, id), eq(students.schoolId, schoolId)))
        .limit(1);
      if (existing.length === 0) return res.status(404).json({ error: 'Student not found.' });

      const cur = existing[0];
      const b = req.body || {};
      const nextPhotoUrl = b.photoUrl !== undefined ? String(b.photoUrl).trim() : cur.photoUrl;
      if (!nextPhotoUrl) {
        return res.status(400).json({ error: 'Student photograph cannot be empty.' });
      }

      const yearInfo =
        b.academicYearId !== undefined || b.academicYearName !== undefined
          ? await getCurrentAcademicYearLabel(
              schoolId,
              b.academicYearId ? Number(b.academicYearId) : cur.academicYearId,
              b.academicYearName !== undefined ? String(b.academicYearName) : cur.academicYearName || ''
            )
          : { id: cur.academicYearId, name: cur.academicYearName || '2026-2027' };

      const [updated] = await db
        .update(students)
        .set({
          firstName: b.firstName !== undefined ? String(b.firstName).trim() : cur.firstName,
          lastName: b.lastName !== undefined ? String(b.lastName).trim() : cur.lastName,
          gender: b.gender === 'F' ? 'F' : b.gender === 'M' ? 'M' : cur.gender,
          dateOfBirth: b.dateOfBirth !== undefined ? String(b.dateOfBirth) : cur.dateOfBirth,
          placeOfBirth: b.placeOfBirth !== undefined ? String(b.placeOfBirth) : cur.placeOfBirth,
          address: b.address !== undefined ? String(b.address) : cur.address,
          photoUrl: nextPhotoUrl,
          classId: b.classId !== undefined ? (b.classId ? Number(b.classId) : null) : cur.classId,
          academicYearId: yearInfo.id,
          academicYearName: yearInfo.name,
          parentName: b.parentName !== undefined ? String(b.parentName) : cur.parentName,
          parentPhone: b.parentPhone !== undefined ? String(b.parentPhone) : cur.parentPhone,
          parentEmail: b.parentEmail !== undefined ? String(b.parentEmail) : cur.parentEmail,
          emergencyContact:
            b.emergencyContact !== undefined ? String(b.emergencyContact) : cur.emergencyContact,
          academicHistory:
            b.academicHistory !== undefined ? String(b.academicHistory) : cur.academicHistory,
          status: b.status !== undefined ? String(b.status) : cur.status,
        })
        .where(and(eq(students.id, id), eq(students.schoolId, schoolId)))
        .returning();

      const { card: idCard } = await ensureStudentIdCard(updated, schoolId, false);

      res.json({
        student: {
          ...updated,
          className: idCard.designationOrClass,
          idCard,
        },
        idCard,
      });
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ error: 'Failed to update student.' });
    }
  }
);

// Delete or archive student
router.delete(
  '/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const permanent = req.query.permanent === 'true';

      const existing = await db
        .select()
        .from(students)
        .where(and(eq(students.id, id), eq(students.schoolId, schoolId)))
        .limit(1);
      if (existing.length === 0) return res.status(404).json({ error: 'Student not found.' });

      if (permanent) {
        await db
          .delete(students)
          .where(and(eq(students.id, id), eq(students.schoolId, schoolId)));
        return res.json({ deleted: true });
      }

      const [archived] = await db
        .update(students)
        .set({ status: 'archived' })
        .where(and(eq(students.id, id), eq(students.schoolId, schoolId)))
        .returning();

      res.json({ student: archived, archived: true });
    } catch (error) {
      console.error('Delete student error:', error);
      res.status(500).json({ error: 'Failed to remove student.' });
    }
  }
);

export default router;
