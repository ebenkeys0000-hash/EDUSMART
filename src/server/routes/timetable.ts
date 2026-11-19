import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { classes, subjects, teachers, timetables } from '../../db/schema.ts';
import {
  AuthRequest,
  requireActiveSubscriptionForWrites,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';

const router = Router();
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
  const a1 = timeToMinutes(s1);
  const b1 = timeToMinutes(e1);
  const a2 = timeToMinutes(s2);
  const b2 = timeToMinutes(e2);
  return a1 < b2 && a2 < b1;
}

// List timetable entries
router.get('/', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const [entries, allClasses, allSubjects, allTeachers] = await Promise.all([
      db.select().from(timetables).where(eq(timetables.schoolId, schoolId)),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)),
      db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
      db.select().from(teachers).where(eq(teachers.schoolId, schoolId)),
    ]);

    const classMap = new Map(allClasses.map((c) => [c.id, c.name]));
    const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));
    const teacherMap = new Map(allTeachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

    const items = entries
      .map((e) => ({
        ...e,
        className: classMap.get(e.classId) || '',
        subjectName: subjectMap.get(e.subjectId)?.name || '',
        subjectCode: subjectMap.get(e.subjectId)?.code || '',
        teacherName: teacherMap.get(e.teacherId) || '',
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

    res.json({ items });
  } catch (error) {
    console.error('List timetable error:', error);
    res.status(500).json({ error: 'Failed to load timetable.' });
  }
});

// Create timetable slot with server-side conflict detection (class, teacher, room)
router.post(
  '/',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room } = req.body || {};

      if (!classId || !subjectId || !teacherId || !dayOfWeek || !startTime || !endTime || !room) {
        return res.status(400).json({ error: 'All timetable fields are required.' });
      }
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }

      const dayNum = Number(dayOfWeek);
      const sameDayEntries = await db
        .select()
        .from(timetables)
        .where(and(eq(timetables.schoolId, schoolId), eq(timetables.dayOfWeek, dayNum)));

      const conflicts: string[] = [];
      for (const existing of sameDayEntries) {
        if (!overlaps(startTime, endTime, existing.startTime, existing.endTime)) continue;
        if (existing.classId === Number(classId)) {
          conflicts.push(`Class already has a session (${existing.startTime}–${existing.endTime})`);
        }
        if (existing.teacherId === Number(teacherId)) {
          conflicts.push(
            `Teacher is already scheduled (${existing.startTime}–${existing.endTime})`
          );
        }
        if (existing.room.trim().toLowerCase() === String(room).trim().toLowerCase()) {
          conflicts.push(`Room "${existing.room}" is occupied (${existing.startTime}–${existing.endTime})`);
        }
      }

      if (conflicts.length > 0) {
        return res.status(409).json({
          error: `Schedule conflict detected: ${conflicts[0]}`,
          conflicts,
        });
      }

      const [created] = await db
        .insert(timetables)
        .values({
          schoolId,
          classId: Number(classId),
          subjectId: Number(subjectId),
          teacherId: Number(teacherId),
          dayOfWeek: dayNum,
          startTime: String(startTime),
          endTime: String(endTime),
          room: String(room).trim(),
        })
        .returning();

      res.status(201).json({ slot: created });
    } catch (error) {
      console.error('Create timetable slot error:', error);
      res.status(500).json({ error: 'Failed to create timetable slot.' });
    }
  }
);

// Delete timetable slot
router.delete(
  '/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db.delete(timetables).where(and(eq(timetables.id, id), eq(timetables.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete timetable slot error:', error);
      res.status(500).json({ error: 'Failed to delete timetable slot.' });
    }
  }
);

export default router;
