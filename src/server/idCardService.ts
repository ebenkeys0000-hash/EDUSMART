import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  academicSeries,
  academicYears,
  classes,
  classSubjects,
  idCards,
  schools,
  specializations,
  students,
  subjects,
  teachers,
} from '../db/schema.ts';

export function generateVerificationCode(): string {
  return `EDU-VRF-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

export async function getCurrentAcademicYearLabel(
  schoolId: number,
  explicitYearId?: number | null,
  explicitYearName?: string
): Promise<{ id: number | null; name: string }> {
  if (explicitYearName && explicitYearName.trim()) {
    return { id: explicitYearId ?? null, name: explicitYearName.trim() };
  }
  const years = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId))
    .orderBy(desc(academicYears.id));

  if (explicitYearId) {
    const matched = years.find((y) => y.id === explicitYearId);
    if (matched) return { id: matched.id, name: matched.name };
  }
  const current = years.find((y) => y.isCurrent) || years[0];
  return {
    id: current?.id ?? null,
    name: current?.name || '2026-2027',
  };
}

export async function ensureStudentIdCard(
  student: typeof students.$inferSelect,
  schoolId: number,
  forceRegenerate = false
) {
  let className = 'Non assigné';
  if (student.classId) {
    const cls = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, student.classId), eq(classes.schoolId, schoolId)))
      .limit(1);
    if (cls[0]) {
      className = cls[0].nameEn ? `${cls[0].name} (${cls[0].nameEn})` : cls[0].name;
    }
  }

  const yearInfo = await getCurrentAcademicYearLabel(
    schoolId,
    student.academicYearId,
    student.academicYearName || ''
  );

  const holderName = `${student.firstName} ${student.lastName}`.trim();
  const existing = await db
    .select()
    .from(idCards)
    .where(
      and(
        eq(idCards.schoolId, schoolId),
        eq(idCards.cardType, 'student'),
        eq(idCards.studentId, student.id)
      )
    )
    .orderBy(desc(idCards.id))
    .limit(1);

  const today = new Date().toISOString().slice(0, 10);

  if (existing.length > 0 && !forceRegenerate) {
    const [synced] = await db
      .update(idCards)
      .set({
        holderName,
        holderCode: student.registrationNumber,
        designationOrClass: className,
        academicYearOrStatus: yearInfo.name,
        photoUrl: student.photoUrl || existing[0].photoUrl || '',
      })
      .where(eq(idCards.id, existing[0].id))
      .returning();
    return { card: synced, created: false };
  }

  if (existing.length > 0 && forceRegenerate) {
    const [regenerated] = await db
      .update(idCards)
      .set({
        holderName,
        holderCode: student.registrationNumber,
        designationOrClass: className,
        academicYearOrStatus: yearInfo.name,
        photoUrl: student.photoUrl || existing[0].photoUrl || '',
        verificationCode: generateVerificationCode(),
        status: student.status === 'active' ? 'active' : 'inactive',
        issuedAt: today,
      })
      .where(eq(idCards.id, existing[0].id))
      .returning();
    return { card: regenerated, created: false };
  }

  const cardNumber = `STU-${student.registrationNumber}`;
  const [created] = await db
    .insert(idCards)
    .values({
      schoolId,
      cardType: 'student',
      studentId: student.id,
      teacherId: null,
      classId: null,
      cardNumber,
      holderName,
      holderCode: student.registrationNumber,
      designationOrClass: className,
      academicYearOrStatus: yearInfo.name,
      photoUrl: student.photoUrl || '',
      verificationCode: generateVerificationCode(),
      status: student.status === 'active' ? 'active' : 'inactive',
      reprintCount: 0,
      issuedAt: today,
    })
    .returning();

  return { card: created, created: true };
}

export async function getTeacherDesignation(teacher: typeof teachers.$inferSelect, schoolId: number) {
  const [assignments, allSubjects] = await Promise.all([
    db
      .select()
      .from(classSubjects)
      .where(and(eq(classSubjects.schoolId, schoolId), eq(classSubjects.teacherId, teacher.id))),
    db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
  ]);
  const subjectMap = new Map(allSubjects.map((s) => [s.id, s.nameFr || s.name]));
  const assignedSubjNames = Array.from(
    new Set(assignments.map((a) => subjectMap.get(a.subjectId)).filter(Boolean))
  ) as string[];

  const subjectLine =
    assignedSubjNames.length > 0
      ? assignedSubjNames.slice(0, 2).join(', ')
      : teacher.specialization || teacher.qualification || 'Enseignant';

  return `Enseignant · ${subjectLine}`;
}

export function formatTeacherStatusLabel(status: string, employmentType: string): string {
  const statusMap: Record<string, string> = {
    active: 'Actif',
    on_leave: 'En congé',
    inactive: 'Inactif',
  };
  const contractMap: Record<string, string> = {
    full_time: 'Temps plein',
    part_time: 'Vacataire',
    contract: 'Contractuel',
  };
  const s = statusMap[status] || status;
  const c = contractMap[employmentType] || employmentType;
  return `${s} · ${c}`;
}

export async function ensureTeacherIdCard(
  teacher: typeof teachers.$inferSelect,
  schoolId: number,
  forceRegenerate = false
) {
  const designation = await getTeacherDesignation(teacher, schoolId);
  const statusLabel = formatTeacherStatusLabel(teacher.status, teacher.employmentType);
  const holderName = `${teacher.firstName} ${teacher.lastName}`.trim();

  const existing = await db
    .select()
    .from(idCards)
    .where(
      and(
        eq(idCards.schoolId, schoolId),
        eq(idCards.cardType, 'teacher'),
        eq(idCards.teacherId, teacher.id)
      )
    )
    .orderBy(desc(idCards.id))
    .limit(1);

  const today = new Date().toISOString().slice(0, 10);

  if (existing.length > 0 && !forceRegenerate) {
    const [synced] = await db
      .update(idCards)
      .set({
        holderName,
        holderCode: teacher.employeeCode,
        designationOrClass: designation,
        academicYearOrStatus: statusLabel,
        photoUrl: teacher.photoUrl || existing[0].photoUrl || '',
      })
      .where(eq(idCards.id, existing[0].id))
      .returning();
    return { card: synced, created: false };
  }

  if (existing.length > 0 && forceRegenerate) {
    const [regenerated] = await db
      .update(idCards)
      .set({
        holderName,
        holderCode: teacher.employeeCode,
        designationOrClass: designation,
        academicYearOrStatus: statusLabel,
        photoUrl: teacher.photoUrl || existing[0].photoUrl || '',
        verificationCode: generateVerificationCode(),
        status: teacher.status === 'active' ? 'active' : 'inactive',
        issuedAt: today,
      })
      .where(eq(idCards.id, existing[0].id))
      .returning();
    return { card: regenerated, created: false };
  }

  const cardNumber = `STF-${teacher.employeeCode}`;
  const [created] = await db
    .insert(idCards)
    .values({
      schoolId,
      cardType: 'teacher',
      studentId: null,
      teacherId: teacher.id,
      classId: null,
      cardNumber,
      holderName,
      holderCode: teacher.employeeCode,
      designationOrClass: designation,
      academicYearOrStatus: statusLabel,
      photoUrl: teacher.photoUrl || '',
      verificationCode: generateVerificationCode(),
      status: teacher.status === 'active' ? 'active' : 'inactive',
      reprintCount: 0,
      issuedAt: today,
    })
    .returning();

  return { card: created, created: true };
}

export async function ensureClassIdCard(
  cls: typeof classes.$inferSelect,
  schoolId: number,
  forceRegenerate = false
) {
  const [schoolRows, teacherRows, enrolledStudents, yearInfo, seriesRows, specRows] =
    await Promise.all([
      db.select({ logoUrl: schools.logoUrl }).from(schools).where(eq(schools.id, schoolId)).limit(1),
      cls.homeroomTeacherId
        ? db
            .select()
            .from(teachers)
            .where(and(eq(teachers.id, cls.homeroomTeacherId), eq(teachers.schoolId, schoolId)))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.classId, cls.id),
            eq(students.status, 'active')
          )
        ),
      getCurrentAcademicYearLabel(schoolId, cls.academicYearId),
      cls.seriesId
        ? db
            .select()
            .from(academicSeries)
            .where(and(eq(academicSeries.id, cls.seriesId), eq(academicSeries.schoolId, schoolId)))
            .limit(1)
        : Promise.resolve([]),
      cls.specializationId
        ? db
            .select()
            .from(specializations)
            .where(
              and(
                eq(specializations.id, cls.specializationId),
                eq(specializations.schoolId, schoolId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

  let classCode = (cls.classCode || '').trim();
  if (!classCode) {
    classCode = `CLS-${String(1000 + cls.id)}`;
    await db
      .update(classes)
      .set({ classCode })
      .where(and(eq(classes.id, cls.id), eq(classes.schoolId, schoolId)));
  }

  const teacherName = teacherRows[0]
    ? `${teacherRows[0].firstName} ${teacherRows[0].lastName}`.trim()
    : 'Non assigné';
  const studentCount = enrolledStudents.length;
  const bilingualTitle =
    cls.nameEn && cls.nameEn.trim() && cls.nameEn.trim() !== cls.name.trim()
      ? `${cls.name} / ${cls.nameEn}`
      : cls.name;

  const metaPayload = JSON.stringify({
    classNameFr: cls.name,
    classNameEn: cls.nameEn || cls.name,
    level: cls.level,
    levelKey: cls.levelKey || '',
    room: cls.room || '',
    capacity: cls.capacity || 40,
    studentCount,
    teacherName,
    seriesName: seriesRows[0] ? `${seriesRows[0].nameFr} (${seriesRows[0].code})` : '',
    specializationName: specRows[0] ? specRows[0].nameFr : '',
    classStatus: cls.status || 'active',
  });

  const existing = await db
    .select()
    .from(idCards)
    .where(
      and(
        eq(idCards.schoolId, schoolId),
        eq(idCards.cardType, 'class'),
        eq(idCards.classId, cls.id)
      )
    )
    .orderBy(desc(idCards.id))
    .limit(1);

  const today = new Date().toISOString().slice(0, 10);
  const schoolLogo = schoolRows[0]?.logoUrl || '';
  const designationLine = `${teacherName} · ${studentCount}/${cls.capacity} élèves`;

  if (existing.length > 0 && !forceRegenerate) {
    const [synced] = await db
      .update(idCards)
      .set({
        holderName: bilingualTitle,
        holderCode: classCode,
        designationOrClass: designationLine,
        academicYearOrStatus: yearInfo.name,
        photoUrl: schoolLogo || existing[0].photoUrl || '',
        metaJson: metaPayload,
      })
      .where(eq(idCards.id, existing[0].id))
      .returning();
    return { card: synced, created: false };
  }

  if (existing.length > 0 && forceRegenerate) {
    const [regenerated] = await db
      .update(idCards)
      .set({
        holderName: bilingualTitle,
        holderCode: classCode,
        designationOrClass: designationLine,
        academicYearOrStatus: yearInfo.name,
        photoUrl: schoolLogo || existing[0].photoUrl || '',
        metaJson: metaPayload,
        verificationCode: generateVerificationCode(),
        status: cls.status === 'inactive' ? 'inactive' : 'active',
        issuedAt: today,
      })
      .where(eq(idCards.id, existing[0].id))
      .returning();
    return { card: regenerated, created: false };
  }

  const cardNumber = `CARD-${classCode}`;
  const [created] = await db
    .insert(idCards)
    .values({
      schoolId,
      cardType: 'class',
      studentId: null,
      teacherId: null,
      classId: cls.id,
      cardNumber,
      holderName: bilingualTitle,
      holderCode: classCode,
      designationOrClass: designationLine,
      academicYearOrStatus: yearInfo.name,
      photoUrl: schoolLogo,
      metaJson: metaPayload,
      verificationCode: generateVerificationCode(),
      status: cls.status === 'inactive' ? 'inactive' : 'active',
      reprintCount: 0,
      issuedAt: today,
    })
    .returning();

  return { card: created, created: true };
}
