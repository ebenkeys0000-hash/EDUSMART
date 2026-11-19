import { Router } from 'express';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  academicSeries,
  academicYears,
  classes,
  classSubjects,
  curriculumProfiles,
  grades,
  idCards,
  specializations,
  students,
  subjectCoefficients,
  subjects,
  teachers,
  terms,
} from '../../db/schema.ts';
import {
  AuthRequest,
  requireActiveSubscriptionForWrites,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';
import { logActivity } from '../helpers.ts';
import { ensureClassIdCard } from '../idCardService.ts';
import {
  AFRICAN_COUNTRIES,
  AFRICAN_SUBJECT_LIBRARY,
  STANDARD_ACADEMIC_SERIES,
  STANDARD_BILINGUAL_CLASSES,
  TECHNICAL_VOCATIONAL_TRACKS,
} from '../../lib/africanCurriculumCatalog.ts';

const router = Router();
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

function safeParseLevels(raw?: string | null): string[] {
  if (!raw) return ['preschool', 'primary', 'junior_secondary', 'senior_secondary'];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ['preschool', 'primary', 'junior_secondary', 'senior_secondary'];
  } catch {
    return ['preschool', 'primary', 'junior_secondary', 'senior_secondary'];
  }
}

async function ensureCurriculumProfile(school: NonNullable<AuthRequest['school']>) {
  const existing = await db
    .select()
    .from(curriculumProfiles)
    .where(eq(curriculumProfiles.schoolId, school.id))
    .limit(1);
  if (existing[0]) return existing[0];

  const matchedCountry =
    AFRICAN_COUNTRIES.find(
      (c) =>
        c.nameFr.toLowerCase() === (school.country || '').toLowerCase() ||
        c.nameEn.toLowerCase() === (school.country || '').toLowerCase()
    ) || AFRICAN_COUNTRIES[0];

  const [created] = await db
    .insert(curriculumProfiles)
    .values({
      schoolId: school.id,
      countryCode: matchedCountry.code,
      countryName: matchedCountry.nameEn,
      systemType: school.academicSystem || matchedCountry.defaultSystem,
      gradingScale: matchedCountry.defaultScale,
      passMark: matchedCountry.defaultPassMark,
      enabledLevelsJson: JSON.stringify([
        'preschool',
        'primary',
        'junior_secondary',
        'senior_secondary',
      ]),
      notes: 'Configurable school curriculum template — verify weights against applicable national standards.',
    })
    .returning();
  return created;
}

// Full academic structure snapshot
router.get('/structure', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const [
      years,
      allTerms,
      allClasses,
      allSubjects,
      assignments,
      allTeachers,
      allStudents,
      profile,
      allSeries,
      allSpecs,
      allCoeffs,
      classCards,
    ] = await Promise.all([
      db
        .select()
        .from(academicYears)
        .where(eq(academicYears.schoolId, schoolId))
        .orderBy(desc(academicYears.id)),
      db.select().from(terms).where(eq(terms.schoolId, schoolId)).orderBy(terms.id),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)).orderBy(classes.id),
      db.select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(subjects.name),
      db.select().from(classSubjects).where(eq(classSubjects.schoolId, schoolId)),
      db.select().from(teachers).where(eq(teachers.schoolId, schoolId)),
      db.select().from(students).where(eq(students.schoolId, schoolId)),
      ensureCurriculumProfile(req.school!),
      db
        .select()
        .from(academicSeries)
        .where(eq(academicSeries.schoolId, schoolId))
        .orderBy(academicSeries.id),
      db
        .select()
        .from(specializations)
        .where(eq(specializations.schoolId, schoolId))
        .orderBy(specializations.id),
      db
        .select()
        .from(subjectCoefficients)
        .where(eq(subjectCoefficients.schoolId, schoolId))
        .orderBy(desc(subjectCoefficients.id)),
      db
        .select()
        .from(idCards)
        .where(and(eq(idCards.schoolId, schoolId), eq(idCards.cardType, 'class'))),
    ]);

    const teacherMap = new Map(allTeachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));
    const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));
    const seriesMap = new Map(allSeries.map((s) => [s.id, s]));
    const specMap = new Map(allSpecs.map((s) => [s.id, s]));
    const yearMap = new Map(years.map((y) => [y.id, y.name]));
    const cardMap = new Map(classCards.map((c) => [c.classId, c]));

    const enrichedClasses = allClasses.map((c) => {
      const activeStudents = allStudents.filter((s) => s.classId === c.id && s.status === 'active');
      const totalAssignedStudents = allStudents.filter((s) => s.classId === c.id).length;
      const clsSubjects = assignments
        .filter((a) => a.classId === c.id)
        .map((a) => {
          const sub = subjectMap.get(a.subjectId);
          return {
            ...a,
            subjectName: sub?.nameFr || sub?.name || '',
            subjectNameFr: sub?.nameFr || sub?.name || '',
            subjectNameEn: sub?.nameEn || sub?.name || '',
            subjectCode: sub?.code || '',
            coefficient: a.coefficient || sub?.coefficient || 1,
            teacherName: a.teacherId ? teacherMap.get(a.teacherId) || '' : 'Non assigné',
          };
        });

      const ser = c.seriesId ? seriesMap.get(c.seriesId) : null;
      const spec = c.specializationId ? specMap.get(c.specializationId) : null;

      return {
        ...c,
        classCode: c.classCode || `CLS-${1000 + c.id}`,
        nameEn: c.nameEn || c.name,
        levelKey: c.levelKey || 'junior_secondary',
        studentCount: activeStudents.length,
        totalAssignedStudents,
        enrolledStudents: activeStudents.map((s) => ({
          id: s.id,
          registrationNumber: s.registrationNumber,
          firstName: s.firstName,
          lastName: s.lastName,
          gender: s.gender,
          photoUrl: s.photoUrl,
        })),
        homeroomTeacherName: c.homeroomTeacherId
          ? teacherMap.get(c.homeroomTeacherId) || ''
          : 'Non assigné',
        academicYearName: c.academicYearId ? yearMap.get(c.academicYearId) || '' : years[0]?.name || '2026-2027',
        seriesNameFr: ser?.nameFr || '',
        seriesNameEn: ser?.nameEn || '',
        seriesCode: ser?.code || '',
        specializationNameFr: spec?.nameFr || '',
        specializationNameEn: spec?.nameEn || '',
        subjects: clsSubjects,
        idCard: cardMap.get(c.id) || null,
      };
    });

    const enrichedSubjects = allSubjects.map((s) => {
      const linked = assignments.filter((a) => a.subjectId === s.id);
      const uniqueTeachers = Array.from(
        new Set(linked.map((a) => (a.teacherId ? teacherMap.get(a.teacherId) : null)).filter(Boolean))
      ) as string[];
      return {
        ...s,
        nameFr: s.nameFr || s.name,
        nameEn: s.nameEn || s.name,
        assignedClassesCount: new Set(linked.map((a) => a.classId)).size,
        assignedTeachers: uniqueTeachers,
      };
    });

    res.json({
      academicYears: years,
      terms: allTerms,
      classes: enrichedClasses,
      subjects: enrichedSubjects,
      assignments,
      curriculumProfile: {
        ...profile,
        enabledLevels: safeParseLevels(profile.enabledLevelsJson),
      },
      academicSeries: allSeries,
      specializations: allSpecs,
      subjectCoefficients: allCoeffs,
    });
  } catch (error) {
    console.error('Academic structure error:', error);
    res.status(500).json({ error: 'Failed to load academic structure.' });
  }
});

// Update school country & curriculum configuration profile
router.put(
  '/curriculum-profile',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const cur = await ensureCurriculumProfile(req.school!);
      const {
        countryCode,
        countryName,
        systemType,
        gradingScale,
        passMark,
        enabledLevels,
        notes,
      } = req.body || {};

      const levelsJson = Array.isArray(enabledLevels)
        ? JSON.stringify(enabledLevels)
        : cur.enabledLevelsJson;

      const [updated] = await db
        .update(curriculumProfiles)
        .set({
          countryCode: countryCode ? String(countryCode) : cur.countryCode,
          countryName: countryName ? String(countryName) : cur.countryName,
          systemType: systemType ? String(systemType) : cur.systemType,
          gradingScale: gradingScale ? Number(gradingScale) : cur.gradingScale,
          passMark: passMark !== undefined ? Number(passMark) : cur.passMark,
          enabledLevelsJson: levelsJson,
          notes: notes !== undefined ? String(notes) : cur.notes,
          updatedAt: new Date(),
        })
        .where(eq(curriculumProfiles.id, cur.id))
        .returning();

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Configuration programme',
        'curriculum',
        `${updated.countryName} (${updated.systemType})`
      );

      res.json({
        curriculumProfile: {
          ...updated,
          enabledLevels: safeParseLevels(updated.enabledLevelsJson),
        },
      });
    } catch (error) {
      console.error('Update curriculum profile error:', error);
      res.status(500).json({ error: 'Failed to update curriculum profile.' });
    }
  }
);

// Auto-provision bilingual classes (Petite Section -> Terminale / Nursery 1 -> Grade 13) for enabled educational levels
router.post(
  '/classes/auto-provision',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        levels = ['preschool', 'primary', 'junior_secondary', 'senior_secondary'],
        academicYearId = null,
        generateCards = true,
      } = req.body || {};

      const activeLevelSet = new Set<string>(Array.isArray(levels) ? levels : []);
      const profile = await ensureCurriculumProfile(req.school!);
      await db
        .update(curriculumProfiles)
        .set({
          enabledLevelsJson: JSON.stringify(Array.from(activeLevelSet)),
          updatedAt: new Date(),
        })
        .where(eq(curriculumProfiles.id, profile.id));

      const [existingClasses, years] = await Promise.all([
        db.select().from(classes).where(eq(classes.schoolId, schoolId)),
        db
          .select()
          .from(academicYears)
          .where(eq(academicYears.schoolId, schoolId))
          .orderBy(desc(academicYears.id)),
      ]);

      const targetYearId =
        academicYearId ? Number(academicYearId) : years.find((y) => y.isCurrent)?.id || years[0]?.id || null;

      const existingNames = new Set(existingClasses.map((c) => c.name.trim().toLowerCase()));
      let nextSeq = existingClasses.length + 1;
      const createdList: (typeof classes.$inferSelect)[] = [];

      for (const tmpl of STANDARD_BILINGUAL_CLASSES) {
        if (!activeLevelSet.has(tmpl.levelKey)) continue;
        if (existingNames.has(tmpl.nameFr.toLowerCase())) continue;

        const classCode = `CLS-${String(1000 + nextSeq++)}`;
        const [created] = await db
          .insert(classes)
          .values({
            schoolId,
            classCode,
            academicYearId: targetYearId,
            name: tmpl.nameFr,
            nameEn: tmpl.nameEn,
            level: tmpl.levelFr,
            levelKey: tmpl.levelKey,
            section: tmpl.defaultSection,
            capacity: tmpl.defaultCapacity,
            room: '',
            status: 'active',
          })
          .returning();

        createdList.push(created);
        existingNames.add(tmpl.nameFr.toLowerCase());

        if (generateCards) {
          await ensureClassIdCard(created, schoolId, false);
        }
      }

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Génération structure classes',
        'class',
        `${createdList.length} classes bilingues générées automatiquement`
      );

      res.status(201).json({
        createdCount: createdList.length,
        classes: createdList,
      });
    } catch (error) {
      console.error('Auto-provision classes error:', error);
      res.status(500).json({ error: 'Failed to provision standard classes.' });
    }
  }
);

// Academic Year CRUD
router.post('/years', requireRole(['school_admin', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const { name, startDate, endDate, isCurrent = false } = req.body || {};
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, start date, and end date are required.' });
    }
    if (isCurrent) {
      await db
        .update(academicYears)
        .set({ isCurrent: false })
        .where(eq(academicYears.schoolId, schoolId));
    }
    const [created] = await db
      .insert(academicYears)
      .values({
        schoolId,
        name: String(name).trim(),
        startDate: String(startDate),
        endDate: String(endDate),
        isCurrent: Boolean(isCurrent),
      })
      .returning();
    res.status(201).json({ academicYear: created });
  } catch (error) {
    console.error('Create academic year error:', error);
    res.status(500).json({ error: 'Failed to create academic year.' });
  }
});

router.patch(
  '/years/:id/activate',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db
        .update(academicYears)
        .set({ isCurrent: false })
        .where(eq(academicYears.schoolId, schoolId));
      const [updated] = await db
        .update(academicYears)
        .set({ isCurrent: true })
        .where(and(eq(academicYears.id, id), eq(academicYears.schoolId, schoolId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Academic year not found.' });
      res.json({ academicYear: updated });
    } catch (error) {
      console.error('Activate academic year error:', error);
      res.status(500).json({ error: 'Failed to switch active academic year.' });
    }
  }
);

// Term / Semester CRUD
router.post('/terms', requireRole(['school_admin', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const { academicYearId, name, startDate, endDate, isCurrent = false } = req.body || {};
    if (!academicYearId || !name || !startDate || !endDate) {
      return res.status(400).json({ error: 'All term fields are required.' });
    }
    if (isCurrent) {
      await db.update(terms).set({ isCurrent: false }).where(eq(terms.schoolId, schoolId));
    }
    const [created] = await db
      .insert(terms)
      .values({
        schoolId,
        academicYearId: Number(academicYearId),
        name: String(name).trim(),
        startDate: String(startDate),
        endDate: String(endDate),
        isCurrent: Boolean(isCurrent),
      })
      .returning();
    res.status(201).json({ term: created });
  } catch (error) {
    console.error('Create term error:', error);
    res.status(500).json({ error: 'Failed to create term.' });
  }
});

// Classes CRUD
router.post('/classes', requireRole(['school_admin', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const {
      name,
      nameEn = '',
      level = 'Collège',
      levelKey = 'junior_secondary',
      section = 'A',
      capacity = 40,
      room = '',
      academicYearId = null,
      homeroomTeacherId = null,
      seriesId = null,
      specializationId = null,
      status = 'active',
    } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Class name is required.' });

    const existingCount = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.schoolId, schoolId));
    const classCode = `CLS-${String(1001 + existingCount.length)}`;

    const [created] = await db
      .insert(classes)
      .values({
        schoolId,
        classCode,
        academicYearId: academicYearId ? Number(academicYearId) : null,
        name: String(name).trim(),
        nameEn: String(nameEn || name).trim(),
        level: String(level),
        levelKey: String(levelKey || 'junior_secondary'),
        section: String(section),
        seriesId: seriesId ? Number(seriesId) : null,
        specializationId: specializationId ? Number(specializationId) : null,
        capacity: Number(capacity) || 40,
        room: String(room),
        homeroomTeacherId: homeroomTeacherId ? Number(homeroomTeacherId) : null,
        status: status === 'inactive' ? 'inactive' : 'active',
      })
      .returning();

    const { card: idCard } = await ensureClassIdCard(created, schoolId, false);

    await logActivity(schoolId, req.dbUser!.fullName, 'Création classe', 'class', `${created.name} (${classCode})`);
    res.status(201).json({ classItem: created, idCard });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class.' });
  }
});

router.put('/classes/:id', requireRole(['school_admin', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const id = Number(req.params.id);
    const found = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.schoolId, schoolId)))
      .limit(1);
    if (found.length === 0) return res.status(404).json({ error: 'Class not found.' });

    const cur = found[0];
    const b = req.body || {};

    const [updated] = await db
      .update(classes)
      .set({
        name: b.name !== undefined ? String(b.name).trim() : cur.name,
        nameEn: b.nameEn !== undefined ? String(b.nameEn).trim() : cur.nameEn,
        level: b.level !== undefined ? String(b.level) : cur.level,
        levelKey: b.levelKey !== undefined ? String(b.levelKey) : cur.levelKey,
        section: b.section !== undefined ? String(b.section) : cur.section,
        capacity: b.capacity !== undefined ? Number(b.capacity) || 40 : cur.capacity,
        room: b.room !== undefined ? String(b.room) : cur.room,
        academicYearId:
          b.academicYearId !== undefined
            ? b.academicYearId
              ? Number(b.academicYearId)
              : null
            : cur.academicYearId,
        homeroomTeacherId:
          b.homeroomTeacherId !== undefined
            ? b.homeroomTeacherId
              ? Number(b.homeroomTeacherId)
              : null
            : cur.homeroomTeacherId,
        seriesId:
          b.seriesId !== undefined ? (b.seriesId ? Number(b.seriesId) : null) : cur.seriesId,
        specializationId:
          b.specializationId !== undefined
            ? b.specializationId
              ? Number(b.specializationId)
              : null
            : cur.specializationId,
        status: b.status !== undefined ? String(b.status) : cur.status,
      })
      .where(and(eq(classes.id, id), eq(classes.schoolId, schoolId)))
      .returning();

    const { card: idCard } = await ensureClassIdCard(updated, schoolId, false);
    res.json({ classItem: updated, idCard });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class.' });
  }
});

// Safe Class Deletion (blocked when students are assigned)
router.delete(
  '/classes/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);

      const assignedStudents = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.classId, id)))
        .limit(1);

      if (assignedStudents.length > 0) {
        return res.status(409).json({
          error:
            'Impossible de supprimer cette classe car des élèves y sont inscrits. Réaffectez les élèves ou désactivez la classe.',
        });
      }

      await db.delete(classes).where(and(eq(classes.id, id), eq(classes.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete class error:', error);
      res.status(500).json({ error: 'Failed to delete class.' });
    }
  }
);

// Subjects CRUD (Bilingual)
router.post(
  '/subjects',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        name,
        nameFr,
        nameEn,
        code,
        category = 'Mathematics',
        levelScope = 'general',
        descriptionFr = '',
        descriptionEn = '',
        coefficient = 2,
        department = 'Général',
        status = 'active',
      } = req.body || {};

      const cleanFr = String(nameFr || name || '').trim();
      const cleanEn = String(nameEn || name || nameFr || '').trim();
      const cleanCode = String(code || '').trim().toUpperCase();

      if (!cleanFr || !cleanCode) {
        return res.status(400).json({ error: 'Subject name and unique code are required.' });
      }

      const duplicate = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(and(eq(subjects.schoolId, schoolId), eq(subjects.code, cleanCode)))
        .limit(1);
      if (duplicate.length > 0) {
        return res.status(409).json({ error: `A subject with code ${cleanCode} already exists.` });
      }

      const [created] = await db
        .insert(subjects)
        .values({
          schoolId,
          name: cleanFr,
          nameFr: cleanFr,
          nameEn: cleanEn,
          code: cleanCode,
          category: String(category),
          levelScope: String(levelScope),
          descriptionFr: String(descriptionFr),
          descriptionEn: String(descriptionEn),
          coefficient: Number(coefficient) || 1,
          department: String(department || category),
          status: status === 'inactive' ? 'inactive' : 'active',
        })
        .returning();
      res.status(201).json({ subject: created });
    } catch (error) {
      console.error('Create subject error:', error);
      res.status(500).json({ error: 'Failed to create subject.' });
    }
  }
);

router.put(
  '/subjects/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      const found = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, id), eq(subjects.schoolId, schoolId)))
        .limit(1);
      if (found.length === 0) return res.status(404).json({ error: 'Subject not found.' });

      const cur = found[0];
      const b = req.body || {};
      const nextFr = b.nameFr !== undefined ? String(b.nameFr).trim() : b.name ? String(b.name).trim() : cur.nameFr || cur.name;
      const nextEn = b.nameEn !== undefined ? String(b.nameEn).trim() : cur.nameEn || nextFr;

      const [updated] = await db
        .update(subjects)
        .set({
          name: nextFr,
          nameFr: nextFr,
          nameEn: nextEn,
          code: b.code !== undefined ? String(b.code).trim().toUpperCase() : cur.code,
          category: b.category !== undefined ? String(b.category) : cur.category,
          levelScope: b.levelScope !== undefined ? String(b.levelScope) : cur.levelScope,
          descriptionFr: b.descriptionFr !== undefined ? String(b.descriptionFr) : cur.descriptionFr,
          descriptionEn: b.descriptionEn !== undefined ? String(b.descriptionEn) : cur.descriptionEn,
          coefficient: b.coefficient !== undefined ? Number(b.coefficient) || 1 : cur.coefficient,
          department: b.department !== undefined ? String(b.department) : cur.department,
          status: b.status !== undefined ? String(b.status) : cur.status,
        })
        .where(and(eq(subjects.id, id), eq(subjects.schoolId, schoolId)))
        .returning();
      res.json({ subject: updated });
    } catch (error) {
      console.error('Update subject error:', error);
      res.status(500).json({ error: 'Failed to update subject.' });
    }
  }
);

// Import subjects from African Subjects Library or custom CSV/JSON payload (deduplicated)
router.post(
  '/subjects/import-library',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { codes, customItems } = req.body || {};

      const existing = await db
        .select({ code: subjects.code })
        .from(subjects)
        .where(eq(subjects.schoolId, schoolId));
      const existingCodes = new Set(existing.map((s) => s.code.trim().toUpperCase()));

      const toInsert: typeof subjects.$inferInsert[] = [];

      if (Array.isArray(codes) && codes.length > 0) {
        const wanted = new Set(codes.map((c: string) => String(c).trim().toUpperCase()));
        for (const item of AFRICAN_SUBJECT_LIBRARY) {
          if (!wanted.has(item.code.toUpperCase())) continue;
          if (existingCodes.has(item.code.toUpperCase())) continue;
          existingCodes.add(item.code.toUpperCase());
          toInsert.push({
            schoolId,
            name: item.nameFr,
            nameFr: item.nameFr,
            nameEn: item.nameEn,
            code: item.code.toUpperCase(),
            category: item.category,
            levelScope: item.levelScope,
            descriptionFr: item.descriptionFr,
            descriptionEn: item.descriptionEn,
            coefficient: item.suggestedCoeff,
            department: item.category,
            status: 'active',
          });
        }
      }

      if (Array.isArray(customItems) && customItems.length > 0) {
        for (const raw of customItems) {
          const cleanCode = String(raw.code || '').trim().toUpperCase();
          const cleanFr = String(raw.nameFr || raw.name || '').trim();
          const cleanEn = String(raw.nameEn || raw.name || cleanFr).trim();
          if (!cleanCode || !cleanFr || existingCodes.has(cleanCode)) continue;
          existingCodes.add(cleanCode);
          toInsert.push({
            schoolId,
            name: cleanFr,
            nameFr: cleanFr,
            nameEn: cleanEn,
            code: cleanCode,
            category: String(raw.category || 'General'),
            levelScope: String(raw.levelScope || 'general'),
            descriptionFr: String(raw.descriptionFr || ''),
            descriptionEn: String(raw.descriptionEn || ''),
            coefficient: Number(raw.coefficient) || 2,
            department: String(raw.category || 'General'),
            status: 'active',
          });
        }
      }

      const inserted =
        toInsert.length > 0 ? await db.insert(subjects).values(toInsert).returning() : [];

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Import matières',
        'subject',
        `${inserted.length} matières ajoutées au référentiel`
      );

      res.status(201).json({ importedCount: inserted.length, subjects: inserted });
    } catch (error) {
      console.error('Import subjects error:', error);
      res.status(500).json({ error: 'Failed to import subjects.' });
    }
  }
);

// Safe Subject Deletion (prevent deleting if grades exist)
router.delete(
  '/subjects/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);

      const usedInGrades = await db
        .select({ id: grades.id })
        .from(grades)
        .where(and(eq(grades.schoolId, schoolId), eq(grades.subjectId, id)))
        .limit(1);

      if (usedInGrades.length > 0) {
        return res.status(409).json({
          error:
            'Impossible de supprimer cette matière car des notes d’examen y sont associées. Désactivez-la plutôt.',
        });
      }

      await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete subject error:', error);
      res.status(500).json({ error: 'Failed to delete subject.' });
    }
  }
);

// Assign subject & teacher to class
router.post(
  '/class-subjects',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        classId,
        subjectId,
        teacherId = null,
        weeklyHours = 4,
        coefficient,
        academicYearId = null,
        isExamSubject = true,
        subjectGroup = 'Core',
        seriesId = null,
        specializationId = null,
      } = req.body || {};
      if (!classId || !subjectId) {
        return res.status(400).json({ error: 'Class and subject are required.' });
      }

      const subRow = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, Number(subjectId)), eq(subjects.schoolId, schoolId)))
        .limit(1);
      const effCoeff = Number(coefficient) || subRow[0]?.coefficient || 2;

      const [created] = await db
        .insert(classSubjects)
        .values({
          schoolId,
          academicYearId: academicYearId ? Number(academicYearId) : null,
          classId: Number(classId),
          subjectId: Number(subjectId),
          teacherId: teacherId ? Number(teacherId) : null,
          seriesId: seriesId ? Number(seriesId) : null,
          specializationId: specializationId ? Number(specializationId) : null,
          coefficient: effCoeff,
          weeklyHours: Number(weeklyHours) || 2,
          isExamSubject: Boolean(isExamSubject),
          subjectGroup: String(subjectGroup || 'Core'),
        })
        .returning();
      res.status(201).json({ assignment: created });
    } catch (error) {
      console.error('Assign subject error:', error);
      res.status(500).json({ error: 'Failed to assign subject to class.' });
    }
  }
);

// Bulk assign subjects to class or classes
router.post(
  '/class-subjects/bulk',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        classIds = [],
        subjectIds = [],
        teacherId = null,
        weeklyHours = 3,
        academicYearId = null,
        isExamSubject = true,
        subjectGroup = 'Core',
      } = req.body || {};

      const cIds = Array.isArray(classIds) ? classIds.map(Number).filter(Boolean) : [];
      const sIds = Array.isArray(subjectIds) ? subjectIds.map(Number).filter(Boolean) : [];
      if (cIds.length === 0 || sIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one class and one subject.' });
      }

      const [existing, allSubs] = await Promise.all([
        db.select().from(classSubjects).where(eq(classSubjects.schoolId, schoolId)),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
      ]);
      const subMap = new Map(allSubs.map((s) => [s.id, s]));
      const existingPairs = new Set(existing.map((e) => `${e.classId}:${e.subjectId}`));

      const toInsert: (typeof classSubjects.$inferInsert)[] = [];
      for (const cid of cIds) {
        for (const sid of sIds) {
          if (existingPairs.has(`${cid}:${sid}`)) continue;
          existingPairs.add(`${cid}:${sid}`);
          toInsert.push({
            schoolId,
            academicYearId: academicYearId ? Number(academicYearId) : null,
            classId: cid,
            subjectId: sid,
            teacherId: teacherId ? Number(teacherId) : null,
            coefficient: subMap.get(sid)?.coefficient || 2,
            weeklyHours: Number(weeklyHours) || 3,
            isExamSubject: Boolean(isExamSubject),
            subjectGroup: String(subjectGroup || 'Core'),
          });
        }
      }

      const inserted =
        toInsert.length > 0 ? await db.insert(classSubjects).values(toInsert).returning() : [];
      res.status(201).json({ assignedCount: inserted.length, assignments: inserted });
    } catch (error) {
      console.error('Bulk assign error:', error);
      res.status(500).json({ error: 'Failed to bulk assign subjects.' });
    }
  }
);

router.delete(
  '/class-subjects/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db
        .delete(classSubjects)
        .where(and(eq(classSubjects.id, id), eq(classSubjects.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Remove assignment error:', error);
      res.status(500).json({ error: 'Failed to remove class subject assignment.' });
    }
  }
);

// Educational Series & Vocational Specializations Starter Pack
router.post(
  '/series/starter',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { includeSeries = true, includeTracks = true } = req.body || {};

      const [curSeries, curSpecs] = await Promise.all([
        db.select().from(academicSeries).where(eq(academicSeries.schoolId, schoolId)),
        db.select().from(specializations).where(eq(specializations.schoolId, schoolId)),
      ]);

      const seriesCodes = new Set(curSeries.map((s) => s.code.toUpperCase()));
      const specCodes = new Set(curSpecs.map((s) => s.code.toUpperCase()));

      let insertedSeries: (typeof academicSeries.$inferSelect)[] = [];
      if (includeSeries) {
        const rows = STANDARD_ACADEMIC_SERIES.filter(
          (s) => !seriesCodes.has(s.code.toUpperCase())
        ).map((s) => ({
          schoolId,
          code: s.code,
          nameFr: s.nameFr,
          nameEn: s.nameEn,
          category: s.category,
          levelScope: s.levelScope,
          descriptionFr: s.descriptionFr,
          descriptionEn: s.descriptionEn,
          status: 'active',
        }));
        if (rows.length > 0) {
          insertedSeries = await db.insert(academicSeries).values(rows).returning();
        }
      }

      const allSeriesNow = [...curSeries, ...insertedSeries];
      const techSeries =
        allSeriesNow.find((s) => s.category === 'technical') ||
        allSeriesNow.find((s) => s.category === 'vocational') ||
        null;

      let insertedSpecs: (typeof specializations.$inferSelect)[] = [];
      if (includeTracks) {
        const rows = TECHNICAL_VOCATIONAL_TRACKS.filter(
          (t) => !specCodes.has(t.code.toUpperCase())
        ).map((t) => ({
          schoolId,
          seriesId: techSeries?.id ?? null,
          code: t.code,
          nameFr: t.nameFr,
          nameEn: t.nameEn,
          sector: t.sector,
          descriptionFr: t.descriptionFr,
          descriptionEn: t.descriptionEn,
          status: 'active',
        }));
        if (rows.length > 0) {
          insertedSpecs = await db.insert(specializations).values(rows).returning();
        }
      }

      res.status(201).json({
        createdSeriesCount: insertedSeries.length,
        createdSpecializationsCount: insertedSpecs.length,
      });
    } catch (error) {
      console.error('Starter series error:', error);
      res.status(500).json({ error: 'Failed to provision series & vocational tracks.' });
    }
  }
);

// Custom Series CRUD
router.post('/series', requireRole(['school_admin', 'super_admin']), async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const {
      code,
      nameFr,
      nameEn,
      category = 'general',
      levelScope = 'senior_secondary',
      descriptionFr = '',
      descriptionEn = '',
    } = req.body || {};
    if (!code || !nameFr) {
      return res.status(400).json({ error: 'Series code and name are required.' });
    }
    const [created] = await db
      .insert(academicSeries)
      .values({
        schoolId,
        code: String(code).trim().toUpperCase(),
        nameFr: String(nameFr).trim(),
        nameEn: String(nameEn || nameFr).trim(),
        category: String(category),
        levelScope: String(levelScope),
        descriptionFr: String(descriptionFr),
        descriptionEn: String(descriptionEn),
        status: 'active',
      })
      .returning();
    res.status(201).json({ series: created });
  } catch (error) {
    console.error('Create series error:', error);
    res.status(500).json({ error: 'Failed to create academic series.' });
  }
});

router.delete(
  '/series/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db
        .delete(academicSeries)
        .where(and(eq(academicSeries.id, id), eq(academicSeries.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete series error:', error);
      res.status(500).json({ error: 'Failed to delete academic series.' });
    }
  }
);

// Custom Vocational Specializations CRUD
router.post(
  '/specializations',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        code,
        nameFr,
        nameEn,
        sector = 'custom',
        seriesId = null,
        descriptionFr = '',
        descriptionEn = '',
      } = req.body || {};
      if (!code || !nameFr) {
        return res.status(400).json({ error: 'Specialization code and name are required.' });
      }
      const [created] = await db
        .insert(specializations)
        .values({
          schoolId,
          seriesId: seriesId ? Number(seriesId) : null,
          code: String(code).trim().toUpperCase(),
          nameFr: String(nameFr).trim(),
          nameEn: String(nameEn || nameFr).trim(),
          sector: String(sector),
          descriptionFr: String(descriptionFr),
          descriptionEn: String(descriptionEn),
          status: 'active',
        })
        .returning();
      res.status(201).json({ specialization: created });
    } catch (error) {
      console.error('Create specialization error:', error);
      res.status(500).json({ error: 'Failed to create specialization.' });
    }
  }
);

router.delete(
  '/specializations/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db
        .delete(specializations)
        .where(and(eq(specializations.id, id), eq(specializations.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete specialization error:', error);
      res.status(500).json({ error: 'Failed to delete specialization.' });
    }
  }
);

// Auto-associate subjects to a class based on its series / specialization / level
router.post(
  '/classes/:id/auto-assign-subjects',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const classId = Number(req.params.id);
      const { academicYearId = null } = req.body || {};

      const [clsRows, existingSubjects, existingAssigns, allSeries, allSpecs] = await Promise.all([
        db
          .select()
          .from(classes)
          .where(and(eq(classes.id, classId), eq(classes.schoolId, schoolId)))
          .limit(1),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
        db
          .select()
          .from(classSubjects)
          .where(and(eq(classSubjects.schoolId, schoolId), eq(classSubjects.classId, classId))),
        db.select().from(academicSeries).where(eq(academicSeries.schoolId, schoolId)),
        db.select().from(specializations).where(eq(specializations.schoolId, schoolId)),
      ]);
      if (!clsRows[0]) return res.status(404).json({ error: 'Class not found.' });
      const cls = clsRows[0];

      const specObj = cls.specializationId ? allSpecs.find((s) => s.id === cls.specializationId) : null;
      const serObj = cls.seriesId ? allSeries.find((s) => s.id === cls.seriesId) : null;

      let targetCodes: string[] = [];
      if (specObj) {
        const tmpl = TECHNICAL_VOCATIONAL_TRACKS.find(
          (t) => t.code.toUpperCase() === specObj.code.toUpperCase()
        );
        if (tmpl) targetCodes = tmpl.subjectCodes;
      }
      if (targetCodes.length === 0 && serObj) {
        const tmpl = STANDARD_ACADEMIC_SERIES.find(
          (s) => s.code.toUpperCase() === serObj.code.toUpperCase()
        );
        if (tmpl) targetCodes = tmpl.subjectCodes;
      }
      if (targetCodes.length === 0) {
        if (cls.levelKey === 'preschool') targetCodes = ['EVL', 'NUM', 'MOT', 'ART'];
        else if (cls.levelKey === 'primary') targetCodes = ['LECT', 'MATH', 'EST', 'ECM', 'EPS'];
        else if (cls.levelKey === 'junior_secondary')
          targetCodes = ['FR', 'MATH', 'ENG', 'PC', 'SVT', 'HG', 'INFO', 'EPS'];
        else targetCodes = ['FR', 'MATH', 'ENG', 'PC', 'SVT', 'HG', 'PHILO', 'EPS'];
      }

      // Ensure library subjects exist in school subjects table
      const subByCode = new Map(existingSubjects.map((s) => [s.code.toUpperCase(), s]));
      for (const code of targetCodes) {
        if (subByCode.has(code)) continue;
        const lib = AFRICAN_SUBJECT_LIBRARY.find((l) => l.code === code);
        if (!lib) continue;
        const [ins] = await db
          .insert(subjects)
          .values({
            schoolId,
            name: lib.nameFr,
            nameFr: lib.nameFr,
            nameEn: lib.nameEn,
            code: lib.code,
            category: lib.category,
            levelScope: lib.levelScope,
            descriptionFr: lib.descriptionFr,
            descriptionEn: lib.descriptionEn,
            coefficient: lib.suggestedCoeff,
            department: lib.category,
            status: 'active',
          })
          .returning();
        subByCode.set(code, ins);
      }

      const assignedSubIds = new Set(existingAssigns.map((a) => a.subjectId));
      const rows: (typeof classSubjects.$inferInsert)[] = [];
      for (const code of targetCodes) {
        const sub = subByCode.get(code);
        if (!sub || assignedSubIds.has(sub.id)) continue;
        assignedSubIds.add(sub.id);
        rows.push({
          schoolId,
          academicYearId: academicYearId ? Number(academicYearId) : cls.academicYearId,
          classId: cls.id,
          subjectId: sub.id,
          seriesId: cls.seriesId,
          specializationId: cls.specializationId,
          coefficient: sub.coefficient || 2,
          weeklyHours: 4,
          isExamSubject: true,
          subjectGroup: 'Core',
        });
      }

      const inserted =
        rows.length > 0 ? await db.insert(classSubjects).values(rows).returning() : [];
      res.json({ assignedCount: inserted.length });
    } catch (error) {
      console.error('Auto-assign class subjects error:', error);
      res.status(500).json({ error: 'Failed to auto-associate subjects with class.' });
    }
  }
);

// Coefficient Configuration Matrix (Year + Class + Series + Subject; preserves historical grades)
router.post(
  '/coefficients',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        academicYearId = null,
        classId = null,
        seriesId = null,
        specializationId = null,
        subjectId,
        coefficient,
        weeklyHours = 3,
        isExamSubject = true,
        countryCode = '',
      } = req.body || {};

      if (!subjectId || !coefficient) {
        return res.status(400).json({ error: 'Subject and coefficient are required.' });
      }

      const aYearId = academicYearId ? Number(academicYearId) : null;
      const cId = classId ? Number(classId) : null;
      const serId = seriesId ? Number(seriesId) : null;
      const specId = specializationId ? Number(specializationId) : null;
      const subId = Number(subjectId);

      // Check existing scoped coefficient row
      const conditions = [
        eq(subjectCoefficients.schoolId, schoolId),
        eq(subjectCoefficients.subjectId, subId),
        aYearId ? eq(subjectCoefficients.academicYearId, aYearId) : isNull(subjectCoefficients.academicYearId),
        cId ? eq(subjectCoefficients.classId, cId) : isNull(subjectCoefficients.classId),
        serId ? eq(subjectCoefficients.seriesId, serId) : isNull(subjectCoefficients.seriesId),
        specId
          ? eq(subjectCoefficients.specializationId, specId)
          : isNull(subjectCoefficients.specializationId),
      ];

      const existing = await db
        .select()
        .from(subjectCoefficients)
        .where(and(...conditions))
        .limit(1);

      let savedRow: typeof subjectCoefficients.$inferSelect;
      if (existing[0]) {
        const [u] = await db
          .update(subjectCoefficients)
          .set({
            coefficient: Number(coefficient),
            weeklyHours: Number(weeklyHours) || existing[0].weeklyHours,
            isExamSubject: Boolean(isExamSubject),
            countryCode: String(countryCode),
            updatedAt: new Date(),
          })
          .where(eq(subjectCoefficients.id, existing[0].id))
          .returning();
        savedRow = u;
      } else {
        const [ins] = await db
          .insert(subjectCoefficients)
          .values({
            schoolId,
            academicYearId: aYearId,
            classId: cId,
            seriesId: serId,
            specializationId: specId,
            subjectId: subId,
            coefficient: Number(coefficient),
            weeklyHours: Number(weeklyHours) || 3,
            isExamSubject: Boolean(isExamSubject),
            countryCode: String(countryCode),
          })
          .returning();
        savedRow = ins;
      }

      // Sync class_subjects.coefficient for current assignments on that class (does NOT touch historical grades!)
      if (cId) {
        await db
          .update(classSubjects)
          .set({
            coefficient: Number(coefficient),
            weeklyHours: Number(weeklyHours) || 3,
            isExamSubject: Boolean(isExamSubject),
          })
          .where(
            and(
              eq(classSubjects.schoolId, schoolId),
              eq(classSubjects.classId, cId),
              eq(classSubjects.subjectId, subId)
            )
          );
      }

      res.status(201).json({ coefficientConfig: savedRow });
    } catch (error) {
      console.error('Save coefficient config error:', error);
      res.status(500).json({ error: 'Failed to save coefficient configuration.' });
    }
  }
);

router.post(
  '/coefficients/import',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { entries = [], academicYearId = null } = req.body || {};
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'Provide coefficient entries to import.' });
      }

      const [allSubs, allClasses, allSeries] = await Promise.all([
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
        db.select().from(classes).where(eq(classes.schoolId, schoolId)),
        db.select().from(academicSeries).where(eq(academicSeries.schoolId, schoolId)),
      ]);
      const subByCode = new Map(allSubs.map((s) => [s.code.toUpperCase(), s.id]));
      const clsByName = new Map(allClasses.map((c) => [c.name.toLowerCase(), c.id]));
      const serByCode = new Map(allSeries.map((s) => [s.code.toUpperCase(), s.id]));

      let imported = 0;
      for (const entry of entries) {
        const subId = entry.subjectId
          ? Number(entry.subjectId)
          : subByCode.get(String(entry.subjectCode || '').trim().toUpperCase());
        const coeff = Number(entry.coefficient);
        if (!subId || !Number.isFinite(coeff) || coeff < 1) continue;

        const cId = entry.classId
          ? Number(entry.classId)
          : clsByName.get(String(entry.className || '').trim().toLowerCase()) || null;
        const serId = entry.seriesId
          ? Number(entry.seriesId)
          : serByCode.get(String(entry.seriesCode || '').trim().toUpperCase()) || null;

        await db.insert(subjectCoefficients).values({
          schoolId,
          academicYearId: entry.academicYearId ? Number(entry.academicYearId) : academicYearId ? Number(academicYearId) : null,
          classId: cId,
          seriesId: serId,
          specializationId: entry.specializationId ? Number(entry.specializationId) : null,
          subjectId: subId,
          coefficient: coeff,
          weeklyHours: Number(entry.weeklyHours) || 3,
          isExamSubject: entry.isExamSubject !== false,
          countryCode: String(entry.countryCode || ''),
        });
        imported++;
      }

      res.status(201).json({ importedCount: imported });
    } catch (error) {
      console.error('Import coefficients error:', error);
      res.status(500).json({ error: 'Failed to import coefficient entries.' });
    }
  }
);

router.delete(
  '/coefficients/:id',
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db
        .delete(subjectCoefficients)
        .where(and(eq(subjectCoefficients.id, id), eq(subjectCoefficients.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete coefficient error:', error);
      res.status(500).json({ error: 'Failed to delete coefficient rule.' });
    }
  }
);

export default router;
