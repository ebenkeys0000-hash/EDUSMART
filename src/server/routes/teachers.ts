import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  classes,
  classSubjects,
  idCards,
  subjects,
  teacherAttendance,
  teachers,
} from '../../db/schema.ts';
import {
  AuthRequest,
  requireActiveSubscriptionForWrites,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';
import { logActivity } from '../helpers.ts';
import { ensureTeacherIdCard } from '../idCardService.ts';

const router = Router();
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

async function syncTeacherAssignments(
  schoolId: number,
  teacherId: number,
  assignedClassIds?: number[],
  assignedSubjectIds?: number[]
) {
  if (!Array.isArray(assignedClassIds) || !Array.isArray(assignedSubjectIds)) return;
  const classIds = assignedClassIds.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const subjectIds = assignedSubjectIds.map(Number).filter((n) => Number.isFinite(n) && n > 0);

  await db
    .delete(classSubjects)
    .where(and(eq(classSubjects.schoolId, schoolId), eq(classSubjects.teacherId, teacherId)));

  if (classIds.length === 0 || subjectIds.length === 0) return;

  const rows: {
    schoolId: number;
    classId: number;
    subjectId: number;
    teacherId: number;
    weeklyHours: number;
  }[] = [];
  for (const cid of classIds) {
    for (const sid of subjectIds) {
      rows.push({
        schoolId,
        classId: cid,
        subjectId: sid,
        teacherId,
        weeklyHours: 4,
      });
    }
  }
  if (rows.length > 0) {
    await db.insert(classSubjects).values(rows);
  }
}

// List teachers with assigned subjects, classes & ID cards
router.get('/', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const [allTeachers, allAssignments, allClasses, allSubjects, recentAttendance, allCards] =
      await Promise.all([
        db
          .select()
          .from(teachers)
          .where(eq(teachers.schoolId, schoolId))
          .orderBy(desc(teachers.id)),
        db.select().from(classSubjects).where(eq(classSubjects.schoolId, schoolId)),
        db.select().from(classes).where(eq(classes.schoolId, schoolId)),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
        db
          .select()
          .from(teacherAttendance)
          .where(eq(teacherAttendance.schoolId, schoolId))
          .orderBy(desc(teacherAttendance.date))
          .limit(50),
        db
          .select()
          .from(idCards)
          .where(and(eq(idCards.schoolId, schoolId), eq(idCards.cardType, 'teacher'))),
      ]);

    const classMap = new Map(allClasses.map((c) => [c.id, c.name]));
    const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));
    const cardMap = new Map(allCards.map((c) => [c.teacherId, c]));

    const items = allTeachers.map((t) => {
      const assigned = allAssignments.filter((a) => a.teacherId === t.id);
      const assignedClassIds = Array.from(new Set(assigned.map((a) => a.classId)));
      const assignedSubjectIds = Array.from(new Set(assigned.map((a) => a.subjectId)));
      const assignedClasses = assignedClassIds.map((cid) => classMap.get(cid)).filter(Boolean);
      const assignedSubjects = assignedSubjectIds.map((sid) => subjectMap.get(sid)).filter(Boolean);
      const attendanceRecords = recentAttendance.filter((a) => a.teacherId === t.id);

      return {
        ...t,
        assignedClassIds,
        assignedSubjectIds,
        assignedClasses,
        assignedSubjects,
        attendanceRecords,
        idCard: cardMap.get(t.id) || null,
      };
    });

    res.json({ items });
  } catch (error) {
    console.error('List teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers.' });
  }
});

// Create teacher with mandatory photo & automatic Teacher ID Card generation
router.post(
  '/',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        firstName,
        lastName,
        gender = 'M',
        dateOfBirth = '',
        email = '',
        phone = '',
        address = '',
        photoUrl = '',
        qualification = '',
        specialization = '',
        employmentType = 'full_time',
        hireDate = new Date().toISOString().slice(0, 10),
        baseSalary = 0,
        status = 'active',
        assignedClassIds,
        assignedSubjectIds,
      } = req.body || {};

      if (!firstName || !lastName) {
        return res.status(400).json({ error: 'First name and last name are required.' });
      }
      const cleanPhotoUrl = String(photoUrl || '').trim();
      if (!cleanPhotoUrl) {
        return res.status(400).json({
          error: 'Teacher photograph is mandatory for registration and ID card generation.',
        });
      }

      const existing = await db
        .select({ id: teachers.id })
        .from(teachers)
        .where(eq(teachers.schoolId, schoolId));
      const employeeCode = `TCH-${String(1001 + existing.length)}`;

      const [created] = await db
        .insert(teachers)
        .values({
          schoolId,
          employeeCode,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          gender: gender === 'F' ? 'F' : 'M',
          dateOfBirth: String(dateOfBirth),
          email: String(email),
          phone: String(phone),
          address: String(address),
          photoUrl: cleanPhotoUrl,
          qualification: String(qualification),
          specialization: String(specialization),
          employmentType: String(employmentType),
          hireDate: String(hireDate),
          baseSalary: Number(baseSalary) || 0,
          status: String(status),
        })
        .returning();

      await syncTeacherAssignments(schoolId, created.id, assignedClassIds, assignedSubjectIds);

      // Automatically generate Teacher/Staff ID Card
      const { card: idCard } = await ensureTeacherIdCard(created, schoolId, false);

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Recrutement enseignant & Carte générée',
        'teacher',
        `${created.firstName} ${created.lastName} (${created.specialization || created.employeeCode})`
      );

      res.status(201).json({
        teacher: {
          ...created,
          idCard,
        },
        idCard,
      });
    } catch (error) {
      console.error('Create teacher error:', error);
      res.status(500).json({ error: 'Failed to create teacher.' });
    }
  }
);

// Update teacher and sync ID card
router.put(
  '/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const found = await db
        .select()
        .from(teachers)
        .where(and(eq(teachers.id, id), eq(teachers.schoolId, schoolId)))
        .limit(1);
      if (found.length === 0) return res.status(404).json({ error: 'Teacher not found.' });

      const cur = found[0];
      const b = req.body || {};
      const nextPhotoUrl = b.photoUrl !== undefined ? String(b.photoUrl).trim() : cur.photoUrl;
      if (!nextPhotoUrl) {
        return res.status(400).json({ error: 'Teacher photograph cannot be empty.' });
      }

      const [updated] = await db
        .update(teachers)
        .set({
          firstName: b.firstName !== undefined ? String(b.firstName).trim() : cur.firstName,
          lastName: b.lastName !== undefined ? String(b.lastName).trim() : cur.lastName,
          gender: b.gender === 'F' ? 'F' : b.gender === 'M' ? 'M' : cur.gender,
          dateOfBirth: b.dateOfBirth !== undefined ? String(b.dateOfBirth) : cur.dateOfBirth,
          email: b.email !== undefined ? String(b.email) : cur.email,
          phone: b.phone !== undefined ? String(b.phone) : cur.phone,
          address: b.address !== undefined ? String(b.address) : cur.address,
          photoUrl: nextPhotoUrl,
          qualification:
            b.qualification !== undefined ? String(b.qualification) : cur.qualification,
          specialization:
            b.specialization !== undefined ? String(b.specialization) : cur.specialization,
          employmentType:
            b.employmentType !== undefined ? String(b.employmentType) : cur.employmentType,
          hireDate: b.hireDate !== undefined ? String(b.hireDate) : cur.hireDate,
          baseSalary: b.baseSalary !== undefined ? Number(b.baseSalary) || 0 : cur.baseSalary,
          status: b.status !== undefined ? String(b.status) : cur.status,
        })
        .where(and(eq(teachers.id, id), eq(teachers.schoolId, schoolId)))
        .returning();

      if (b.assignedClassIds !== undefined || b.assignedSubjectIds !== undefined) {
        await syncTeacherAssignments(
          schoolId,
          id,
          b.assignedClassIds || [],
          b.assignedSubjectIds || []
        );
      }

      const { card: idCard } = await ensureTeacherIdCard(updated, schoolId, false);

      res.json({
        teacher: {
          ...updated,
          idCard,
        },
        idCard,
      });
    } catch (error) {
      console.error('Update teacher error:', error);
      res.status(500).json({ error: 'Failed to update teacher.' });
    }
  }
);

// Record teacher attendance
router.post(
  '/attendance',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { teacherId, date, status = 'present', remarks = '' } = req.body || {};
      if (!teacherId || !date) {
        return res.status(400).json({ error: 'Teacher and date are required.' });
      }

      const [record] = await db
        .insert(teacherAttendance)
        .values({
          schoolId,
          teacherId: Number(teacherId),
          date: String(date),
          status: String(status),
          remarks: String(remarks),
        })
        .returning();

      res.status(201).json({ record });
    } catch (error) {
      console.error('Teacher attendance error:', error);
      res.status(500).json({ error: 'Failed to record teacher attendance.' });
    }
  }
);

// Delete teacher
router.delete(
  '/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db.delete(teachers).where(and(eq(teachers.id, id), eq(teachers.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete teacher error:', error);
      res.status(500).json({ error: 'Failed to remove teacher.' });
    }
  }
);

export default router;
