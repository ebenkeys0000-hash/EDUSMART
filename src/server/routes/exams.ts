import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  academicSeries,
  academicYears,
  classes,
  classSubjects,
  curriculumProfiles,
  examinations,
  grades,
  students,
  subjectCoefficients,
  subjects,
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

const router = Router();
router.use(requireAuth, requireSchool, requireActiveSubscriptionForWrites);

async function resolveEffectiveCoefficient(params: {
  schoolId: number;
  subjectId: number;
  classId: number;
  academicYearId?: number | null;
  seriesId?: number | null;
}) {
  const { schoolId, subjectId, classId, academicYearId = null, seriesId = null } = params;

  const [matrixRows, clsAssignRows, subRows] = await Promise.all([
    db
      .select()
      .from(subjectCoefficients)
      .where(
        and(eq(subjectCoefficients.schoolId, schoolId), eq(subjectCoefficients.subjectId, subjectId))
      ),
    db
      .select()
      .from(classSubjects)
      .where(
        and(
          eq(classSubjects.schoolId, schoolId),
          eq(classSubjects.classId, classId),
          eq(classSubjects.subjectId, subjectId)
        )
      )
      .limit(1),
    db
      .select()
      .from(subjects)
      .where(and(eq(subjects.schoolId, schoolId), eq(subjects.id, subjectId)))
      .limit(1),
  ]);

  // Priority scoring on matrix rules so most-specific (year+class+series) wins
  let bestScore = -1;
  let bestCoeff: number | null = null;
  for (const row of matrixRows) {
    if (row.academicYearId && academicYearId && row.academicYearId !== academicYearId) continue;
    if (row.classId && row.classId !== classId) continue;
    if (row.seriesId && seriesId && row.seriesId !== seriesId) continue;
    if (row.seriesId && !seriesId) continue;

    const specificity =
      (row.academicYearId && row.academicYearId === academicYearId ? 4 : 0) +
      (row.classId === classId ? 2 : 0) +
      (row.seriesId && row.seriesId === seriesId ? 1 : 0);

    if (specificity > bestScore) {
      bestScore = specificity;
      bestCoeff = row.coefficient;
    }
  }

  if (bestCoeff !== null) return bestCoeff;
  if (clsAssignRows[0]?.coefficient) return clsAssignRows[0].coefficient;
  return subRows[0]?.coefficient || 1;
}

// List examinations
router.get('/', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const [allExams, allClasses, allTerms, allYears] = await Promise.all([
      db
        .select()
        .from(examinations)
        .where(eq(examinations.schoolId, schoolId))
        .orderBy(desc(examinations.id)),
      db.select().from(classes).where(eq(classes.schoolId, schoolId)),
      db.select().from(terms).where(eq(terms.schoolId, schoolId)),
      db.select().from(academicYears).where(eq(academicYears.schoolId, schoolId)),
    ]);

    const classMap = new Map(allClasses.map((c) => [c.id, c]));
    const termMap = new Map(allTerms.map((t) => [t.id, t]));
    const yearMap = new Map(allYears.map((y) => [y.id, y.name]));

    const items = allExams.map((e) => {
      const cls = e.classId ? classMap.get(e.classId) : null;
      const trm = e.termId ? termMap.get(e.termId) : null;
      const yrId = e.academicYearId || trm?.academicYearId || null;
      return {
        ...e,
        academicYearId: yrId,
        academicYearName: yrId ? yearMap.get(yrId) || '' : '',
        className: cls ? cls.name : 'Toutes classes',
        classNameEn: cls ? cls.nameEn || cls.name : 'All classes',
        termName: trm ? trm.name : '',
      };
    });

    res.json({ items });
  } catch (error) {
    console.error('List exams error:', error);
    res.status(500).json({ error: 'Failed to load examinations.' });
  }
});

// Create examination
router.post(
  '/',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        title,
        classId = null,
        termId = null,
        academicYearId = null,
        examType = 'term_exam',
        examDate,
        maxScore = 20,
        status = 'scheduled',
      } = req.body || {};

      if (!title || !examDate) {
        return res.status(400).json({ error: 'Examination title and date are required.' });
      }

      let resolvedYearId = academicYearId ? Number(academicYearId) : null;
      if (!resolvedYearId && termId) {
        const t = await db
          .select({ academicYearId: terms.academicYearId })
          .from(terms)
          .where(and(eq(terms.id, Number(termId)), eq(terms.schoolId, schoolId)))
          .limit(1);
        resolvedYearId = t[0]?.academicYearId ?? null;
      }

      const [created] = await db
        .insert(examinations)
        .values({
          schoolId,
          academicYearId: resolvedYearId,
          classId: classId ? Number(classId) : null,
          termId: termId ? Number(termId) : null,
          title: String(title).trim(),
          examType: String(examType),
          examDate: String(examDate),
          maxScore: Number(maxScore) || 20,
          status: String(status),
        })
        .returning();

      await logActivity(schoolId, req.dbUser!.fullName, 'Examen planifié', 'exam', created.title);
      res.status(201).json({ examination: created });
    } catch (error) {
      console.error('Create exam error:', error);
      res.status(500).json({ error: 'Failed to create examination.' });
    }
  }
);

// Get grades for an exam + subject + class
router.get('/grades', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const examinationId = Number(req.query.examinationId || 0);
    const classId = Number(req.query.classId || 0);
    const subjectId = Number(req.query.subjectId || 0);

    if (!examinationId || !classId || !subjectId) {
      return res.json({ items: [] });
    }

    const [clsStudents, existingGrades, examRows, clsRows, termRows] = await Promise.all([
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
        .from(grades)
        .where(
          and(
            eq(grades.schoolId, schoolId),
            eq(grades.examinationId, examinationId),
            eq(grades.classId, classId),
            eq(grades.subjectId, subjectId)
          )
        ),
      db
        .select()
        .from(examinations)
        .where(and(eq(examinations.id, examinationId), eq(examinations.schoolId, schoolId)))
        .limit(1),
      db
        .select()
        .from(classes)
        .where(and(eq(classes.id, classId), eq(classes.schoolId, schoolId)))
        .limit(1),
      db.select().from(terms).where(eq(terms.schoolId, schoolId)),
    ]);

    const exam = examRows[0];
    const cls = clsRows[0];
    const termYearId = exam?.termId
      ? termRows.find((t) => t.id === exam.termId)?.academicYearId ?? null
      : null;
    const effectiveYearId = exam?.academicYearId || termYearId || cls?.academicYearId || null;

    const effectiveCoeff = await resolveEffectiveCoefficient({
      schoolId,
      subjectId,
      classId,
      academicYearId: effectiveYearId,
      seriesId: cls?.seriesId ?? null,
    });

    const gradeMap = new Map(existingGrades.map((g) => [g.studentId, g]));

    const items = clsStudents.map((st) => {
      const g = gradeMap.get(st.id);
      return {
        studentId: st.id,
        registrationNumber: st.registrationNumber,
        studentName: `${st.firstName} ${st.lastName}`,
        score: g ? g.score : '',
        maxScore: g ? g.maxScore : exam?.maxScore || 20,
        // Preserve snapshot coefficient if grade already saved; otherwise use current configured matrix coefficient
        coefficient: g ? g.coefficient : effectiveCoeff,
        teacherComment: g ? g.teacherComment : '',
      };
    });

    res.json({ items, resolvedCoefficient: effectiveCoeff });
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ error: 'Failed to load grades.' });
  }
});

// Save batch grades (snapshots effective coefficient on grade row to protect historical results)
router.post(
  '/grades/batch',
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { examinationId, classId, subjectId, maxScore = 20, entries } = req.body || {};

      if (!examinationId || !classId || !subjectId || !Array.isArray(entries)) {
        return res.status(400).json({ error: 'Examination, class, subject, and entries required.' });
      }

      const [examRows, clsRows] = await Promise.all([
        db
          .select()
          .from(examinations)
          .where(and(eq(examinations.id, Number(examinationId)), eq(examinations.schoolId, schoolId)))
          .limit(1),
        db
          .select()
          .from(classes)
          .where(and(eq(classes.id, Number(classId)), eq(classes.schoolId, schoolId)))
          .limit(1),
      ]);

      const exam = examRows[0];
      const cls = clsRows[0];
      const resolvedCoeff = await resolveEffectiveCoefficient({
        schoolId,
        subjectId: Number(subjectId),
        classId: Number(classId),
        academicYearId: exam?.academicYearId || cls?.academicYearId || null,
        seriesId: cls?.seriesId ?? null,
      });

      await db
        .delete(grades)
        .where(
          and(
            eq(grades.schoolId, schoolId),
            eq(grades.examinationId, Number(examinationId)),
            eq(grades.classId, Number(classId)),
            eq(grades.subjectId, Number(subjectId))
          )
        );

      const validEntries = entries.filter(
        (e: { score: string | number }) => e.score !== '' && e.score !== null && e.score !== undefined
      );

      const effectiveScale = Number(maxScore) || exam?.maxScore || 20;

      if (validEntries.length > 0) {
        await db.insert(grades).values(
          validEntries.map(
            (e: {
              studentId: number;
              score: number;
              coefficient?: number;
              teacherComment?: string;
            }) => ({
              schoolId,
              examinationId: Number(examinationId),
              studentId: Number(e.studentId),
              subjectId: Number(subjectId),
              classId: Number(classId),
              score: Math.min(effectiveScale, Math.max(0, Number(e.score))),
              maxScore: effectiveScale,
              coefficient: Number(e.coefficient) || resolvedCoeff || 1,
              teacherComment: String(e.teacherComment || ''),
            })
          )
        );
      }

      await db
        .update(examinations)
        .set({ status: 'completed' })
        .where(and(eq(examinations.id, Number(examinationId)), eq(examinations.schoolId, schoolId)));

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Saisie des notes',
        'grades',
        `${validEntries.length} notes enregistrées`
      );

      res.json({ saved: true, count: validEntries.length });
    } catch (error) {
      console.error('Save grades error:', error);
      res.status(500).json({ error: 'Failed to save grades.' });
    }
  }
);

// Compute Class Rankings & Report Cards (uses historical snapshot coefficient stored on each grade)
router.get('/report-cards', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const examinationId = Number(req.query.examinationId || 0);
    const classId = Number(req.query.classId || 0);

    if (!examinationId || !classId) {
      return res.json({ rankings: [], classAverage: 0, gradingScale: 20 });
    }

    const [clsStudents, clsGrades, allSubjects, examList, clsList, profileList, allSeries] =
      await Promise.all([
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
          .from(grades)
          .where(
            and(
              eq(grades.schoolId, schoolId),
              eq(grades.examinationId, examinationId),
              eq(grades.classId, classId)
            )
          ),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
        db
          .select()
          .from(examinations)
          .where(and(eq(examinations.id, examinationId), eq(examinations.schoolId, schoolId)))
          .limit(1),
        db
          .select()
          .from(classes)
          .where(and(eq(classes.id, classId), eq(classes.schoolId, schoolId)))
          .limit(1),
        db
          .select()
          .from(curriculumProfiles)
          .where(eq(curriculumProfiles.schoolId, schoolId))
          .limit(1),
        db.select().from(academicSeries).where(eq(academicSeries.schoolId, schoolId)),
      ]);

    const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));
    const gradingScale = profileList[0]?.gradingScale || examList[0]?.maxScore || 20;
    const cls = clsList[0];
    const ser = cls?.seriesId ? allSeries.find((s) => s.id === cls.seriesId) : null;

    const reportCards = clsStudents.map((st) => {
      const stGrades = clsGrades.filter((g) => g.studentId === st.id);
      let weightedSum = 0;
      let totalCoeff = 0;

      const subjectsBreakdown = stGrades.map((g) => {
        const sub = subjectMap.get(g.subjectId);
        const normalized = (g.score / (g.maxScore || 20)) * gradingScale;
        const coeff = g.coefficient || sub?.coefficient || 1;
        weightedSum += normalized * coeff;
        totalCoeff += coeff;
        return {
          subjectId: g.subjectId,
          subjectName: sub?.nameFr || sub?.name || `Matière #${g.subjectId}`,
          subjectNameFr: sub?.nameFr || sub?.name || `Matière #${g.subjectId}`,
          subjectNameEn: sub?.nameEn || sub?.name || `Subject #${g.subjectId}`,
          subjectCode: sub?.code || '',
          score: g.score,
          maxScore: g.maxScore,
          coefficient: coeff,
          weightedPoints: Math.round(normalized * coeff * 100) / 100,
          teacherComment: g.teacherComment || '',
        };
      });

      const average = totalCoeff > 0 ? Math.round((weightedSum / totalCoeff) * 100) / 100 : 0;
      const ratio = gradingScale > 0 ? average / gradingScale : 0;
      let mention = 'Insuffisant';
      if (ratio >= 0.8) mention = 'Très Bien';
      else if (ratio >= 0.7) mention = 'Bien';
      else if (ratio >= 0.6) mention = 'Assez Bien';
      else if (ratio >= 0.5) mention = 'Passable';

      return {
        studentId: st.id,
        registrationNumber: st.registrationNumber,
        studentName: `${st.firstName} ${st.lastName}`,
        gender: st.gender,
        className: cls?.name || '',
        classNameEn: cls?.nameEn || cls?.name || '',
        seriesName: ser?.nameFr || '',
        examinationTitle: examList[0]?.title || '',
        examDate: examList[0]?.examDate || '',
        subjects: subjectsBreakdown,
        totalCoeff,
        weightedSum: Math.round(weightedSum * 100) / 100,
        average,
        gradingScale,
        mention,
        rank: 0,
      };
    });

    reportCards.sort((a, b) => b.average - a.average);
    reportCards.forEach((rc, idx) => {
      rc.rank = idx + 1;
    });

    const gradedStudents = reportCards.filter((r) => r.subjects.length > 0);
    const classAverage =
      gradedStudents.length > 0
        ? Math.round(
            (gradedStudents.reduce((s, r) => s + r.average, 0) / gradedStudents.length) * 100
          ) / 100
        : 0;

    res.json({
      rankings: reportCards,
      classAverage,
      gradingScale,
      examination: examList[0] || null,
      classInfo: cls || null,
    });
  } catch (error) {
    console.error('Report cards error:', error);
    res.status(500).json({ error: 'Failed to generate report cards.' });
  }
});

// Term Averages, Annual Averages & Series Academic Performance Analytics
router.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const academicYearId = req.query.academicYearId ? Number(req.query.academicYearId) : null;
    const termId = req.query.termId ? Number(req.query.termId) : null;

    const [allExams, allGrades, allClasses, allStudents, allSeries, allTerms, profileList] =
      await Promise.all([
        db.select().from(examinations).where(eq(examinations.schoolId, schoolId)),
        db.select().from(grades).where(eq(grades.schoolId, schoolId)),
        db.select().from(classes).where(eq(classes.schoolId, schoolId)),
        db
          .select()
          .from(students)
          .where(and(eq(students.schoolId, schoolId), eq(students.status, 'active'))),
        db.select().from(academicSeries).where(eq(academicSeries.schoolId, schoolId)),
        db.select().from(terms).where(eq(terms.schoolId, schoolId)),
        db
          .select()
          .from(curriculumProfiles)
          .where(eq(curriculumProfiles.schoolId, schoolId))
          .limit(1),
      ]);

    const gradingScale = profileList[0]?.gradingScale || 20;
    const termMap = new Map(allTerms.map((t) => [t.id, t]));
    const classMap = new Map(allClasses.map((c) => [c.id, c]));
    const seriesMap = new Map(allSeries.map((s) => [s.id, s]));

    // Filter exams by academicYearId & termId if given
    const relevantExams = allExams.filter((ex) => {
      const yrId = ex.academicYearId || (ex.termId ? termMap.get(ex.termId)?.academicYearId : null);
      if (academicYearId && yrId && yrId !== academicYearId) return false;
      if (termId && ex.termId !== termId) return false;
      return true;
    });
    const relevantExamIds = new Set(relevantExams.map((e) => e.id));
    const relevantGrades = allGrades.filter((g) => relevantExamIds.has(g.examinationId));

    // Compute per-student Term & Annual weighted averages
    const studentSummaries = allStudents
      .map((st) => {
        const stGrades = relevantGrades.filter((g) => g.studentId === st.id);
        if (stGrades.length === 0) return null;

        let wSum = 0;
        let cSum = 0;
        for (const g of stGrades) {
          const norm = (g.score / (g.maxScore || 20)) * gradingScale;
          const coeff = g.coefficient || 1;
          wSum += norm * coeff;
          cSum += coeff;
        }
        const avg = cSum > 0 ? Math.round((wSum / cSum) * 100) / 100 : 0;
        const cls = st.classId ? classMap.get(st.classId) : null;
        const ser = cls?.seriesId ? seriesMap.get(cls.seriesId) : null;
        return {
          studentId: st.id,
          registrationNumber: st.registrationNumber,
          studentName: `${st.firstName} ${st.lastName}`,
          classId: st.classId,
          className: cls?.name || '—',
          classNameEn: cls?.nameEn || cls?.name || '—',
          seriesId: ser?.id || null,
          seriesNameFr: ser?.nameFr || 'Tronc Commun',
          seriesNameEn: ser?.nameEn || 'Common Core',
          gradesCount: stGrades.length,
          average: avg,
        };
      })
      .filter(Boolean) as {
      studentId: number;
      registrationNumber: string;
      studentName: string;
      classId: number | null;
      className: string;
      classNameEn: string;
      seriesId: number | null;
      seriesNameFr: string;
      seriesNameEn: string;
      gradesCount: number;
      average: number;
    }[];

    studentSummaries.sort((a, b) => b.average - a.average);

    // Series-specific academic performance rollup
    const seriesBuckets = new Map<
      string,
      { seriesNameFr: string; seriesNameEn: string; sumAvg: number; count: number }
    >();
    for (const s of studentSummaries) {
      const key = s.seriesId ? String(s.seriesId) : 'common';
      const cur = seriesBuckets.get(key) || {
        seriesNameFr: s.seriesNameFr,
        seriesNameEn: s.seriesNameEn,
        sumAvg: 0,
        count: 0,
      };
      cur.sumAvg += s.average;
      cur.count += 1;
      seriesBuckets.set(key, cur);
    }

    const seriesPerformance = Array.from(seriesBuckets.values()).map((b) => ({
      seriesNameFr: b.seriesNameFr,
      seriesNameEn: b.seriesNameEn,
      studentCount: b.count,
      average: b.count > 0 ? Math.round((b.sumAvg / b.count) * 100) / 100 : 0,
    }));

    res.json({
      gradingScale,
      studentRankings: studentSummaries.slice(0, 50),
      seriesPerformance,
    });
  } catch (error) {
    console.error('Exam analytics error:', error);
    res.status(500).json({ error: 'Failed to compute exam analytics.' });
  }
});

export default router;
