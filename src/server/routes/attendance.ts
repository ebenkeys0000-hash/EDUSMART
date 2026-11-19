import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { attendance, classes, idCards, students } from '../../db/schema.ts';
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

// Fetch attendance register for a class + date
router.get('/', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const classId = Number(req.query.classId || 0);
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));

    if (!classId) {
      return res.json({ items: [], students: [] });
    }

    const [classStudents, records] = await Promise.all([
      db
        .select()
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.classId, classId),
            eq(students.status, 'active')
          )
        ),
      db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.schoolId, schoolId),
            eq(attendance.classId, classId),
            eq(attendance.date, date)
          )
        ),
    ]);

    const recordMap = new Map(records.map((r) => [r.studentId, r]));
    const items = classStudents.map((st) => {
      const rec = recordMap.get(st.id);
      return {
        studentId: st.id,
        registrationNumber: st.registrationNumber,
        studentName: `${st.firstName} ${st.lastName}`,
        status: rec?.status || 'present',
        remarks: rec?.remarks || '',
        recorded: Boolean(rec),
      };
    });

    res.json({ items, date, classId });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to load attendance register.' });
  }
});

// Save batch attendance for class & date
router.post(
  '/batch',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { classId, date, entries } = req.body || {};

      if (!classId || !date || !Array.isArray(entries)) {
        return res.status(400).json({ error: 'Class, date, and attendance entries are required.' });
      }

      await db
        .delete(attendance)
        .where(
          and(
            eq(attendance.schoolId, schoolId),
            eq(attendance.classId, Number(classId)),
            eq(attendance.date, String(date))
          )
        );

      if (entries.length > 0) {
        await db.insert(attendance).values(
          entries.map((e: { studentId: number; status: string; remarks?: string }) => ({
            schoolId,
            classId: Number(classId),
            studentId: Number(e.studentId),
            date: String(date),
            status: ['present', 'absent', 'late', 'excused'].includes(e.status)
              ? e.status
              : 'present',
            remarks: String(e.remarks || ''),
            recordedByUserId: req.dbUser!.id,
          }))
        );
      }

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Appel quotidien',
        'attendance',
        `${entries.length} élèves enregistrés le ${date}`
      );

      res.json({ saved: true, count: entries.length });
    } catch (error) {
      console.error('Save attendance error:', error);
      res.status(500).json({ error: 'Failed to save attendance.' });
    }
  }
);

// Attendance reports (monthly & class breakdown)
router.get('/reports', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));

    const [allRecords, allClasses, allStudents] = await Promise.all([
      db.select().from(attendance).where(eq(attendance.schoolId, schoolId)),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)),
      db.select().from(students).where(eq(students.schoolId, schoolId)),
    ]);

    const monthRecords = allRecords.filter((r) => r.date.startsWith(month));
    const classStats = allClasses.map((cls) => {
      const recs = monthRecords.filter((r) => r.classId === cls.id);
      const present = recs.filter((r) => r.status === 'present').length;
      const absent = recs.filter((r) => r.status === 'absent').length;
      const late = recs.filter((r) => r.status === 'late').length;
      const excused = recs.filter((r) => r.status === 'excused').length;
      const total = recs.length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;
      return {
        classId: cls.id,
        className: cls.name,
        present,
        absent,
        late,
        excused,
        total,
        rate,
      };
    });

    const studentMap = new Map(allStudents.map((s) => [s.id, s]));
    const studentStatsMap = new Map<
      number,
      { studentId: number; name: string; reg: string; present: number; absent: number; late: number; excused: number }
    >();

    for (const r of monthRecords) {
      const st = studentMap.get(r.studentId);
      if (!st) continue;
      if (!studentStatsMap.has(st.id)) {
        studentStatsMap.set(st.id, {
          studentId: st.id,
          name: `${st.firstName} ${st.lastName}`,
          reg: st.registrationNumber,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        });
      }
      const entry = studentStatsMap.get(st.id)!;
      if (r.status === 'present') entry.present++;
      else if (r.status === 'absent') entry.absent++;
      else if (r.status === 'late') entry.late++;
      else if (r.status === 'excused') entry.excused++;
    }

    res.json({
      month,
      summary: {
        total: monthRecords.length,
        present: monthRecords.filter((r) => r.status === 'present').length,
        absent: monthRecords.filter((r) => r.status === 'absent').length,
        late: monthRecords.filter((r) => r.status === 'late').length,
        excused: monthRecords.filter((r) => r.status === 'excused').length,
      },
      classStats,
      studentStats: Array.from(studentStatsMap.values()),
    });
  } catch (error) {
    console.error('Attendance reports error:', error);
    res.status(500).json({ error: 'Failed to compute attendance reports.' });
  }
});

// Verify Student School ID QR code and mark daily attendance
router.post(
  '/scan-qr',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        qrData,
        date = new Date().toISOString().slice(0, 10),
        status = 'present',
      } = req.body || {};

      const raw = String(qrData || '').trim();
      if (!raw) {
        return res.status(400).json({ error: 'Code QR vide ou illisible.' });
      }

      let regNumber = raw.toUpperCase();

      // Check if QR contains a verification URL (?verify=EDU-VRF-...) or raw verification code
      let verifyToken = '';
      if (raw.includes('verify=')) {
        try {
          const parsedUrl = new URL(raw.startsWith('http') ? raw : `https://edusmart.app/${raw}`);
          verifyToken = (parsedUrl.searchParams.get('verify') || '').trim();
        } catch {
          const m = /verify=([^&\s]+)/i.exec(raw);
          if (m) verifyToken = m[1].trim();
        }
      } else if (raw.toUpperCase().startsWith('EDU-VRF-')) {
        verifyToken = raw.trim();
      }

      if (verifyToken) {
        const cardRows = await db
          .select()
          .from(idCards)
          .where(eq(idCards.verificationCode, verifyToken))
          .limit(1);

        if (cardRows.length === 0) {
          return res.status(404).json({ error: 'Carte QR introuvable ou code expiré.' });
        }
        const card = cardRows[0];
        if (card.schoolId !== schoolId) {
          return res.status(403).json({
            error: 'Carte invalide : appartient à un autre établissement.',
          });
        }
        if (card.status !== 'active') {
          return res.status(400).json({
            error: `Cette carte a été marquée "${card.status}" et ne peut pas être utilisée.`,
          });
        }
        if (card.cardType !== 'student') {
          return res.status(400).json({
            error: 'Cette carte appartient à un membre du corps enseignant.',
          });
        }
        regNumber = card.holderCode.toUpperCase();
      } else if (raw.toUpperCase().startsWith('EDUSMART:')) {
        const parts = raw.split(':');
        const scannedSchoolCode = (parts[1] || '').trim().toUpperCase();
        regNumber = (parts[2] || '').trim().toUpperCase();
        if (scannedSchoolCode && scannedSchoolCode !== req.school!.code.toUpperCase()) {
          return res.status(403).json({
            error: `Carte invalide : appartient à un autre établissement (${scannedSchoolCode}).`,
          });
        }
      }

      const foundStudents = await db
        .select()
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.registrationNumber, regNumber)))
        .limit(1);

      if (foundStudents.length === 0) {
        return res.status(404).json({
          error: `Aucun élève enregistré avec le matricule "${regNumber}".`,
        });
      }

      const student = foundStudents[0];
      if (student.status !== 'active') {
        return res.status(400).json({
          error: `Carte inactive : le dossier de ${student.firstName} ${student.lastName} est "${student.status}".`,
        });
      }

      if (!student.classId) {
        return res.status(400).json({
          error: `${student.firstName} ${student.lastName} n'est assigné(e) à aucune classe pour le pointage.`,
        });
      }

      const clsList = await db
        .select()
        .from(classes)
        .where(and(eq(classes.id, student.classId), eq(classes.schoolId, schoolId)))
        .limit(1);

      const targetDate = String(date);
      const targetStatus = status === 'late' ? 'late' : 'present';
      const timeStr = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const remark =
        targetStatus === 'late'
          ? `Scan carte QR (Retard à ${timeStr})`
          : `Scan carte QR à ${timeStr}`;

      const existing = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.schoolId, schoolId),
            eq(attendance.studentId, student.id),
            eq(attendance.date, targetDate)
          )
        )
        .limit(1);

      let saved;
      let alreadyMarked = false;
      if (existing.length > 0) {
        alreadyMarked = true;
        const [updated] = await db
          .update(attendance)
          .set({
            status: targetStatus,
            remarks: remark,
            recordedByUserId: req.dbUser!.id,
          })
          .where(and(eq(attendance.id, existing[0].id), eq(attendance.schoolId, schoolId)))
          .returning();
        saved = updated;
      } else {
        const [inserted] = await db
          .insert(attendance)
          .values({
            schoolId,
            classId: student.classId,
            studentId: student.id,
            date: targetDate,
            status: targetStatus,
            remarks: remark,
            recordedByUserId: req.dbUser!.id,
          })
          .returning();
        saved = inserted;
      }

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Scan Carte QR',
        'attendance',
        `${student.firstName} ${student.lastName} (${student.registrationNumber}) — ${targetStatus}`
      );

      res.json({
        verified: true,
        alreadyMarked,
        scannedAt: timeStr,
        attendance: saved,
        student: {
          ...student,
          className: clsList[0]?.name || 'Classe',
        },
      });
    } catch (error) {
      console.error('QR attendance scan error:', error);
      res.status(500).json({ error: 'Erreur lors de la vérification du QR code.' });
    }
  }
);

export default router;
