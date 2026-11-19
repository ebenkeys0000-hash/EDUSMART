import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  classes,
  classSubjects,
  idCards,
  schools,
  students,
  subjects,
  teachers,
} from '../../db/schema.ts';
import {
  AuthRequest,
  requireActiveSubscriptionForWrites,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';
import {
  ensureClassIdCard,
  ensureStudentIdCard,
  ensureTeacherIdCard,
  generateVerificationCode,
} from '../idCardService.ts';
import { logActivity } from '../helpers.ts';

const router = Router();

function safeParseMeta(raw?: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// PUBLIC SECURE QR VERIFICATION ENDPOINT
// Never exposes sensitive personal information (phone, address, DOB, parent info, salary, email, student lists)
router.get('/verify/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code || code.length < 6) {
      return res.status(400).json({ valid: false, error: 'Code de vérification invalide.' });
    }

    const found = await db
      .select()
      .from(idCards)
      .where(eq(idCards.verificationCode, code))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({
        valid: false,
        error: 'Carte introuvable ou code de vérification invalide.',
      });
    }

    const card = found[0];
    const [schoolRows, studentRows, teacherRows, classRows] = await Promise.all([
      db
        .select({
          name: schools.name,
          code: schools.code,
          city: schools.city,
          country: schools.country,
          logoUrl: schools.logoUrl,
          phone: schools.phone,
        })
        .from(schools)
        .where(eq(schools.id, card.schoolId))
        .limit(1),
      card.studentId
        ? db
            .select({ status: students.status })
            .from(students)
            .where(eq(students.id, card.studentId))
            .limit(1)
        : Promise.resolve([]),
      card.teacherId
        ? db
            .select({ status: teachers.status })
            .from(teachers)
            .where(eq(teachers.id, card.teacherId))
            .limit(1)
        : Promise.resolve([]),
      card.classId
        ? db
            .select({
              status: classes.status,
              name: classes.name,
              nameEn: classes.nameEn,
              level: classes.level,
              room: classes.room,
              capacity: classes.capacity,
            })
            .from(classes)
            .where(eq(classes.id, card.classId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const school = schoolRows[0] || null;
    let effectiveStatus: 'active' | 'inactive' | 'lost' =
      card.status === 'lost' ? 'lost' : card.status === 'inactive' ? 'inactive' : 'active';

    // Reflect inactive holder/class status
    if (effectiveStatus === 'active') {
      if (card.cardType === 'student' && studentRows[0] && studentRows[0].status !== 'active') {
        effectiveStatus = 'inactive';
      }
      if (card.cardType === 'teacher' && teacherRows[0] && teacherRows[0].status !== 'active') {
        effectiveStatus = 'inactive';
      }
      if (card.cardType === 'class' && classRows[0] && classRows[0].status !== 'active') {
        effectiveStatus = 'inactive';
      }
    }

    const parsedMeta = safeParseMeta(card.metaJson);

    res.json({
      valid: effectiveStatus === 'active',
      card: {
        cardType: card.cardType,
        cardNumber: card.cardNumber,
        fullName: card.holderName,
        uniqueId: card.holderCode,
        designationOrClass: card.designationOrClass,
        academicYearOrStatus: card.academicYearOrStatus,
        photoUrl: card.photoUrl || '',
        status: effectiveStatus,
        issuedAt: card.issuedAt,
        classMeta:
          card.cardType === 'class'
            ? {
                classNameFr: classRows[0]?.name || parsedMeta.classNameFr || card.holderName,
                classNameEn: classRows[0]?.nameEn || parsedMeta.classNameEn || card.holderName,
                level: classRows[0]?.level || parsedMeta.level || '',
                room: classRows[0]?.room || parsedMeta.room || '',
                capacity: classRows[0]?.capacity || parsedMeta.capacity || 40,
                studentCount: parsedMeta.studentCount ?? 0,
                teacherName: parsedMeta.teacherName || 'Non assigné',
                seriesName: parsedMeta.seriesName || '',
                specializationName: parsedMeta.specializationName || '',
              }
            : undefined,
      },
      school: school
        ? {
            name: school.name,
            code: school.code,
            city: school.city,
            country: school.country,
            logoUrl: school.logoUrl || '',
            phone: school.phone || '',
          }
        : null,
    });
  } catch (error) {
    console.error('ID Card verification error:', error);
    res.status(500).json({ valid: false, error: 'Verification service temporarily unavailable.' });
  }
});

// AUTHENTICATED & SCHOOL-ISOLATED ROUTES BELOW
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

// List all ID cards (student, teacher, class) for the current school
router.get('/', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const cardTypeFilter = String(req.query.cardType || 'all');
    const statusFilter = String(req.query.status || 'all');
    const classIdFilter = req.query.classId ? Number(req.query.classId) : null;
    const search = String(req.query.search || '').trim().toLowerCase();

    const [allCards, allStudents, allTeachers, allClasses, allAssignments, allSubjects] =
      await Promise.all([
        db
          .select()
          .from(idCards)
          .where(eq(idCards.schoolId, schoolId))
          .orderBy(desc(idCards.id)),
        db.select().from(students).where(eq(students.schoolId, schoolId)),
        db.select().from(teachers).where(eq(teachers.schoolId, schoolId)),
        db.select().from(classes).where(eq(classes.schoolId, schoolId)),
        db.select().from(classSubjects).where(eq(classSubjects.schoolId, schoolId)),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
      ]);

    const studentMap = new Map(allStudents.map((s) => [s.id, s]));
    const teacherMap = new Map(allTeachers.map((t) => [t.id, t]));
    const classMap = new Map(allClasses.map((c) => [c.id, c]));
    const subjectMap = new Map(allSubjects.map((s) => [s.id, s.nameFr || s.name]));

    let enriched = allCards.map((c) => {
      if (c.cardType === 'student' && c.studentId) {
        const st = studentMap.get(c.studentId);
        const cls = st?.classId ? classMap.get(st.classId) : null;
        return {
          ...c,
          classId: st?.classId ?? null,
          className: cls?.name || c.designationOrClass,
          gender: st?.gender || 'M',
          dateOfBirth: st?.dateOfBirth || '',
          parentName: st?.parentName || '',
          parentPhone: st?.parentPhone || '',
          emergencyContact: st?.emergencyContact || '',
        };
      }
      if (c.cardType === 'teacher' && c.teacherId) {
        const tch = teacherMap.get(c.teacherId);
        const tchAssigns = allAssignments.filter((a) => a.teacherId === c.teacherId);
        const assignedClasses = Array.from(
          new Set(tchAssigns.map((a) => classMap.get(a.classId)?.name).filter(Boolean))
        ) as string[];
        const assignedSubjects = Array.from(
          new Set(tchAssigns.map((a) => subjectMap.get(a.subjectId)).filter(Boolean))
        ) as string[];
        return {
          ...c,
          classId: null,
          gender: tch?.gender || 'M',
          dateOfBirth: tch?.dateOfBirth || '',
          qualification: tch?.qualification || '',
          specialization: tch?.specialization || '',
          hireDate: tch?.hireDate || '',
          employmentType: tch?.employmentType || 'full_time',
          assignedClasses,
          assignedSubjects,
        };
      }
      if (c.cardType === 'class' && c.classId) {
        const cls = classMap.get(c.classId);
        const parsedMeta = safeParseMeta(c.metaJson);
        return {
          ...c,
          classId: c.classId,
          classMeta: {
            ...parsedMeta,
            classNameFr: cls?.name || parsedMeta.classNameFr || c.holderName,
            classNameEn: cls?.nameEn || parsedMeta.classNameEn || c.holderName,
            level: cls?.level || parsedMeta.level || '',
            room: cls?.room || parsedMeta.room || '',
            capacity: cls?.capacity || parsedMeta.capacity || 40,
          },
        };
      }
      return { ...c, classId: c.classId ?? null };
    });

    if (cardTypeFilter !== 'all') {
      enriched = enriched.filter((c) => c.cardType === cardTypeFilter);
    }
    if (statusFilter !== 'all') {
      enriched = enriched.filter((c) => c.status === statusFilter);
    }
    if (classIdFilter) {
      enriched = enriched.filter((c) => c.classId === classIdFilter);
    }
    if (search) {
      enriched = enriched.filter(
        (c) =>
          c.holderName.toLowerCase().includes(search) ||
          c.holderCode.toLowerCase().includes(search) ||
          c.cardNumber.toLowerCase().includes(search) ||
          c.designationOrClass.toLowerCase().includes(search)
      );
    }

    res.json({
      items: enriched,
      summary: {
        total: allCards.length,
        studentCards: allCards.filter((c) => c.cardType === 'student').length,
        teacherCards: allCards.filter((c) => c.cardType === 'teacher').length,
        classCards: allCards.filter((c) => c.cardType === 'class').length,
        activeCards: allCards.filter((c) => c.status === 'active').length,
        inactiveCards: allCards.filter((c) => c.status !== 'active').length,
      },
      studentsWithoutCard: allStudents.filter(
        (s) => !allCards.some((c) => c.cardType === 'student' && c.studentId === s.id)
      ).length,
      teachersWithoutCard: allTeachers.filter(
        (t) => !allCards.some((c) => c.cardType === 'teacher' && c.teacherId === t.id)
      ).length,
      classesWithoutCard: allClasses.filter(
        (cl) => !allCards.some((c) => c.cardType === 'class' && c.classId === cl.id)
      ).length,
    });
  } catch (error) {
    console.error('List ID cards error:', error);
    res.status(500).json({ error: 'Failed to load ID cards.' });
  }
});

// Generate ID cards (single student, single teacher, single class card, whole class students, all teachers, all classes)
router.post(
  '/generate',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { targetType, studentId, teacherId, classId } = req.body || {};

      if (targetType === 'student' && studentId) {
        const found = await db
          .select()
          .from(students)
          .where(and(eq(students.id, Number(studentId)), eq(students.schoolId, schoolId)))
          .limit(1);
        if (found.length === 0) return res.status(404).json({ error: 'Student not found.' });
        const result = await ensureStudentIdCard(found[0], schoolId, false);
        return res.json({ cards: [result.card], createdCount: result.created ? 1 : 0 });
      }

      if (targetType === 'teacher' && teacherId) {
        if (!['school_admin', 'super_admin'].includes(req.dbUser!.role)) {
          return res.status(403).json({ error: 'Only school administrators can generate staff cards.' });
        }
        const found = await db
          .select()
          .from(teachers)
          .where(and(eq(teachers.id, Number(teacherId)), eq(teachers.schoolId, schoolId)))
          .limit(1);
        if (found.length === 0) return res.status(404).json({ error: 'Teacher not found.' });
        const result = await ensureTeacherIdCard(found[0], schoolId, false);
        return res.json({ cards: [result.card], createdCount: result.created ? 1 : 0 });
      }

      if (targetType === 'single_class' && classId) {
        const found = await db
          .select()
          .from(classes)
          .where(and(eq(classes.id, Number(classId)), eq(classes.schoolId, schoolId)))
          .limit(1);
        if (found.length === 0) return res.status(404).json({ error: 'Class not found.' });
        const result = await ensureClassIdCard(found[0], schoolId, false);
        return res.json({ cards: [result.card], createdCount: result.created ? 1 : 0, totalCount: 1 });
      }

      if (targetType === 'all_classes') {
        const schoolClasses = await db
          .select()
          .from(classes)
          .where(eq(classes.schoolId, schoolId));
        const cards = [];
        let createdCount = 0;
        for (const cls of schoolClasses) {
          const r = await ensureClassIdCard(cls, schoolId, false);
          cards.push(r.card);
          if (r.created) createdCount++;
        }
        await logActivity(
          schoolId,
          req.dbUser!.fullName,
          'Génération cartes classes',
          'id_card',
          `${cards.length} cartes de classe générées/mises à jour`
        );
        return res.json({ cards, createdCount, totalCount: cards.length });
      }

      if (targetType === 'class' && classId) {
        const classStudents = await db
          .select()
          .from(students)
          .where(
            and(
              eq(students.schoolId, schoolId),
              eq(students.classId, Number(classId)),
              eq(students.status, 'active')
            )
          );
        const cards = [];
        let createdCount = 0;
        for (const st of classStudents) {
          const r = await ensureStudentIdCard(st, schoolId, false);
          cards.push(r.card);
          if (r.created) createdCount++;
        }
        await logActivity(
          schoolId,
          req.dbUser!.fullName,
          'Génération cartes en masse',
          'id_card',
          `${cards.length} cartes élèves générées/mises à jour pour la classe #${classId}`
        );
        return res.json({ cards, createdCount, totalCount: cards.length });
      }

      if (targetType === 'all_teachers') {
        if (!['school_admin', 'super_admin'].includes(req.dbUser!.role)) {
          return res.status(403).json({ error: 'Only school administrators can generate staff cards.' });
        }
        const schoolTeachers = await db
          .select()
          .from(teachers)
          .where(eq(teachers.schoolId, schoolId));
        const cards = [];
        let createdCount = 0;
        for (const tch of schoolTeachers) {
          const r = await ensureTeacherIdCard(tch, schoolId, false);
          cards.push(r.card);
          if (r.created) createdCount++;
        }
        await logActivity(
          schoolId,
          req.dbUser!.fullName,
          'Génération cartes enseignants',
          'id_card',
          `${cards.length} cartes personnel générées/mises à jour`
        );
        return res.json({ cards, createdCount, totalCount: cards.length });
      }

      if (targetType === 'all_students') {
        const allStudents = await db
          .select()
          .from(students)
          .where(and(eq(students.schoolId, schoolId), eq(students.status, 'active')));
        const cards = [];
        let createdCount = 0;
        for (const st of allStudents) {
          const r = await ensureStudentIdCard(st, schoolId, false);
          cards.push(r.card);
          if (r.created) createdCount++;
        }
        return res.json({ cards, createdCount, totalCount: cards.length });
      }

      res.status(400).json({ error: 'Invalid ID card generation parameters.' });
    } catch (error) {
      console.error('Generate ID cards error:', error);
      res.status(500).json({ error: 'Failed to generate ID cards.' });
    }
  }
);

// Regenerate card (rotates QR verification token, restores active status)
router.post(
  '/:id/regenerate',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const found = await db
        .select()
        .from(idCards)
        .where(and(eq(idCards.id, id), eq(idCards.schoolId, schoolId)))
        .limit(1);
      if (found.length === 0) return res.status(404).json({ error: 'ID Card not found.' });

      const cur = found[0];
      let updatedCard = cur;

      if (cur.cardType === 'student' && cur.studentId) {
        const st = await db
          .select()
          .from(students)
          .where(and(eq(students.id, cur.studentId), eq(students.schoolId, schoolId)))
          .limit(1);
        if (st[0]) {
          const r = await ensureStudentIdCard(st[0], schoolId, true);
          updatedCard = r.card;
        }
      } else if (cur.cardType === 'teacher' && cur.teacherId) {
        const tch = await db
          .select()
          .from(teachers)
          .where(and(eq(teachers.id, cur.teacherId), eq(teachers.schoolId, schoolId)))
          .limit(1);
        if (tch[0]) {
          const r = await ensureTeacherIdCard(tch[0], schoolId, true);
          updatedCard = r.card;
        }
      } else if (cur.cardType === 'class' && cur.classId) {
        const cls = await db
          .select()
          .from(classes)
          .where(and(eq(classes.id, cur.classId), eq(classes.schoolId, schoolId)))
          .limit(1);
        if (cls[0]) {
          const r = await ensureClassIdCard(cls[0], schoolId, true);
          updatedCard = r.card;
        }
      } else {
        const [u] = await db
          .update(idCards)
          .set({
            verificationCode: generateVerificationCode(),
            status: 'active',
            issuedAt: new Date().toISOString().slice(0, 10),
          })
          .where(and(eq(idCards.id, id), eq(idCards.schoolId, schoolId)))
          .returning();
        updatedCard = u;
      }

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Régénération carte',
        'id_card',
        `Nouveau QR généré pour ${updatedCard.holderName} (${updatedCard.holderCode})`
      );

      res.json({ card: updatedCard });
    } catch (error) {
      console.error('Regenerate card error:', error);
      res.status(500).json({ error: 'Failed to regenerate ID card.' });
    }
  }
);

// Reprint card (increments reprint counter & updates timestamp)
router.post(
  '/:id/reprint',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const found = await db
        .select()
        .from(idCards)
        .where(and(eq(idCards.id, id), eq(idCards.schoolId, schoolId)))
        .limit(1);
      if (found.length === 0) return res.status(404).json({ error: 'ID Card not found.' });

      const cur = found[0];
      const [updated] = await db
        .update(idCards)
        .set({
          reprintCount: (cur.reprintCount || 0) + 1,
          lastPrintedAt: new Date().toISOString().slice(0, 10),
          status: cur.status === 'lost' ? 'active' : cur.status,
        })
        .where(and(eq(idCards.id, id), eq(idCards.schoolId, schoolId)))
        .returning();

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Réimpression carte',
        'id_card',
        `Carte réimprimée (#${updated.reprintCount}) pour ${updated.holderName}`
      );

      res.json({ card: updated });
    } catch (error) {
      console.error('Reprint card error:', error);
      res.status(500).json({ error: 'Failed to record card reprint.' });
    }
  }
);

// Toggle status (active, inactive, lost)
router.patch(
  '/:id/status',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const status = String(req.body?.status || '').trim();
      if (!['active', 'inactive', 'lost'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Allowed: active, inactive, lost.' });
      }

      const [updated] = await db
        .update(idCards)
        .set({ status })
        .where(and(eq(idCards.id, id), eq(idCards.schoolId, schoolId)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'ID Card not found.' });

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Statut carte modifié',
        'id_card',
        `${updated.holderName} (${updated.holderCode}) → ${status}`
      );

      res.json({ card: updated });
    } catch (error) {
      console.error('Update card status error:', error);
      res.status(500).json({ error: 'Failed to update ID card status.' });
    }
  }
);

export default router;
