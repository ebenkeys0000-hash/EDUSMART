import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  academicYears,
  activityLogs,
  announcements,
  attendance,
  classes,
  classSubjects,
  examinations,
  feeCategories,
  grades,
  invoices,
  parents,
  payments,
  schools,
  staffPayroll,
  students,
  subjects,
  teachers,
  terms,
  timetables,
  users,
} from '../db/schema.ts';

export type SafeUser = Omit<
  typeof users.$inferSelect,
  'passwordHash' | 'verificationToken' | 'resetToken' | 'resetTokenExpiresAt'
>;

export function sanitizeUser(user: typeof users.$inferSelect): SafeUser {
  const {
    passwordHash: _p,
    verificationToken: _v,
    resetToken: _r,
    resetTokenExpiresAt: _e,
    ...safe
  } = user;
  return safe;
}

export async function logActivity(
  schoolId: number,
  actorName: string,
  action: string,
  entityType: string,
  details: string
) {
  try {
    await db.insert(activityLogs).values({
      schoolId,
      actorName,
      action,
      entityType,
      details,
    });
  } catch (err) {
    console.error('Activity log write failed:', err);
  }
}

export async function bootstrapSchoolDefaults(schoolId: number, actorName: string) {
  const existingYears = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId));
  if (existingYears.length > 0) return;

  const [year] = await db
    .insert(academicYears)
    .values({
      schoolId,
      name: '2026-2027',
      startDate: '2026-09-14',
      endDate: '2027-06-30',
      isCurrent: true,
    })
    .returning();

  await db.insert(terms).values([
    {
      schoolId,
      academicYearId: year.id,
      name: 'Trimestre 1',
      startDate: '2026-09-14',
      endDate: '2026-12-18',
      isCurrent: true,
    },
    {
      schoolId,
      academicYearId: year.id,
      name: 'Trimestre 2',
      startDate: '2027-01-05',
      endDate: '2027-03-26',
      isCurrent: false,
    },
    {
      schoolId,
      academicYearId: year.id,
      name: 'Trimestre 3',
      startDate: '2027-04-06',
      endDate: '2027-06-30',
      isCurrent: false,
    },
  ]);

  await db.insert(feeCategories).values([
    {
      schoolId,
      name: 'Frais de Scolarité Annuelle',
      type: 'tuition',
      defaultAmount: 185000,
      frequency: 'annual',
      description: 'Écolage annuel payable en trois tranches',
    },
    {
      schoolId,
      name: "Frais d'Inscription & Dossier",
      type: 'registration',
      defaultAmount: 25000,
      frequency: 'once',
      description: 'Frais administratifs de rentrée scolaire',
    },
    {
      schoolId,
      name: "Frais d'Examen & Compositions",
      type: 'exam',
      defaultAmount: 15000,
      frequency: 'annual',
      description: 'Examens blancs, BEPC / BAC et livrets scolaires',
    },
  ]);

  await logActivity(
    schoolId,
    actorName,
    'Initialisation',
    'school',
    'Année académique 2026-2027, trimestres et catégories de frais créés'
  );
}

export async function seedSampleWestAfricanSchool(schoolId: number, actorName: string) {
  const existingStudents = await db
    .select()
    .from(students)
    .where(eq(students.schoolId, schoolId))
    .limit(1);
  if (existingStudents.length > 0) {
    return { alreadySeeded: true };
  }

  await bootstrapSchoolDefaults(schoolId, actorName);

  const [year] = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId))
    .limit(1);
  const [term] = await db.select().from(terms).where(eq(terms.schoolId, schoolId)).limit(1);
  const cats = await db
    .select()
    .from(feeCategories)
    .where(eq(feeCategories.schoolId, schoolId));

  // Teachers
  const insertedTeachers = await db
    .insert(teachers)
    .values([
      {
        schoolId,
        employeeCode: 'TCH-1001',
        firstName: 'Koffi',
        lastName: 'Agbodjan',
        gender: 'M',
        email: 'k.agbodjan@ecole.bj',
        phone: '+229 97 11 22 33',
        qualification: 'CAPES Mathématiques',
        specialization: 'Mathématiques',
        employmentType: 'full_time',
        hireDate: '2022-09-01',
        baseSalary: 195000,
        status: 'active',
      },
      {
        schoolId,
        employeeCode: 'TCH-1002',
        firstName: 'Afi',
        lastName: 'Mensah',
        gender: 'F',
        email: 'a.mensah@ecole.tg',
        phone: '+228 90 44 55 66',
        qualification: 'Master Lettres Modernes',
        specialization: 'Français & Littérature',
        employmentType: 'full_time',
        hireDate: '2021-10-01',
        baseSalary: 185000,
        status: 'active',
      },
      {
        schoolId,
        employeeCode: 'TCH-1003',
        firstName: 'Sèna',
        lastName: 'Dossou',
        gender: 'M',
        email: 's.dossou@ecole.bj',
        phone: '+229 96 77 88 99',
        qualification: 'Licence Physique-Chimie',
        specialization: 'Sciences Physiques',
        employmentType: 'full_time',
        hireDate: '2023-09-15',
        baseSalary: 175000,
        status: 'active',
      },
      {
        schoolId,
        employeeCode: 'TCH-1004',
        firstName: 'Nadège',
        lastName: 'Kouassi',
        gender: 'F',
        email: 'n.kouassi@ecole.bj',
        phone: '+229 95 23 41 10',
        qualification: 'B.A. English Studies',
        specialization: 'Anglais',
        employmentType: 'part_time',
        hireDate: '2024-09-10',
        baseSalary: 140000,
        status: 'active',
      },
    ])
    .returning();

  // Classes
  const insertedClasses = await db
    .insert(classes)
    .values([
      {
        schoolId,
        academicYearId: year?.id ?? null,
        name: '6ème A',
        level: 'Collège',
        section: 'A',
        capacity: 42,
        room: 'Salle B-101',
        homeroomTeacherId: insertedTeachers[1].id,
      },
      {
        schoolId,
        academicYearId: year?.id ?? null,
        name: '3ème A',
        level: 'Collège',
        section: 'A',
        capacity: 40,
        room: 'Salle B-204',
        homeroomTeacherId: insertedTeachers[0].id,
      },
      {
        schoolId,
        academicYearId: year?.id ?? null,
        name: 'Terminale D',
        level: 'Lycée',
        section: 'Sciences',
        capacity: 38,
        room: 'Salle L-301',
        homeroomTeacherId: insertedTeachers[2].id,
      },
    ])
    .returning();

  // Subjects
  const insertedSubjects = await db
    .insert(subjects)
    .values([
      { schoolId, name: 'Mathématiques', code: 'MATH', coefficient: 4, department: 'Sciences' },
      { schoolId, name: 'Français', code: 'FR', coefficient: 3, department: 'Lettres' },
      { schoolId, name: 'Physique-Chimie', code: 'PC', coefficient: 4, department: 'Sciences' },
      { schoolId, name: 'Anglais', code: 'ANG', coefficient: 2, department: 'Langues' },
      { schoolId, name: 'SVT', code: 'SVT', coefficient: 3, department: 'Sciences' },
    ])
    .returning();

  // Class-subject assignments
  await db.insert(classSubjects).values([
    {
      schoolId,
      classId: insertedClasses[1].id,
      subjectId: insertedSubjects[0].id,
      teacherId: insertedTeachers[0].id,
      weeklyHours: 5,
    },
    {
      schoolId,
      classId: insertedClasses[1].id,
      subjectId: insertedSubjects[1].id,
      teacherId: insertedTeachers[1].id,
      weeklyHours: 4,
    },
    {
      schoolId,
      classId: insertedClasses[1].id,
      subjectId: insertedSubjects[2].id,
      teacherId: insertedTeachers[2].id,
      weeklyHours: 4,
    },
    {
      schoolId,
      classId: insertedClasses[2].id,
      subjectId: insertedSubjects[0].id,
      teacherId: insertedTeachers[0].id,
      weeklyHours: 5,
    },
    {
      schoolId,
      classId: insertedClasses[2].id,
      subjectId: insertedSubjects[3].id,
      teacherId: insertedTeachers[3].id,
      weeklyHours: 3,
    },
  ]);

  // Parents & Students
  const insertedParents = await db
    .insert(parents)
    .values([
      {
        schoolId,
        fullName: 'M. Rodrigue Hounkpè',
        relationship: 'Père',
        phone: '+229 97 30 45 12',
        email: 'rodrigue.hounkpe@mail.bj',
        occupation: 'Ingénieur Civil',
        address: 'Cadjèhoun, Cotonou',
      },
      {
        schoolId,
        fullName: 'Mme Akossiwa Lawson',
        relationship: 'Mère',
        phone: '+228 90 12 88 34',
        email: 'akossiwa.lawson@mail.tg',
        occupation: 'Pharmacienne',
        address: 'Tokoin, Lomé',
      },
      {
        schoolId,
        fullName: 'M. Brice Zinsou',
        relationship: 'Père',
        phone: '+229 96 54 11 09',
        email: 'brice.zinsou@mail.bj',
        occupation: 'Commerçant',
        address: 'Akpakpa, Cotonou',
      },
    ])
    .returning();

  const insertedStudents = await db
    .insert(students)
    .values([
      {
        schoolId,
        registrationNumber: 'EDU-2026-0001',
        firstName: 'Kévin',
        lastName: 'Hounkpè',
        gender: 'M',
        dateOfBirth: '2011-04-12',
        placeOfBirth: 'Cotonou',
        address: 'Cadjèhoun, Cotonou',
        classId: insertedClasses[1].id,
        parentId: insertedParents[0].id,
        parentName: insertedParents[0].fullName,
        parentPhone: insertedParents[0].phone,
        parentEmail: insertedParents[0].email || '',
        emergencyContact: '+229 97 30 45 12',
        academicHistory: 'Admis en 3ème avec mention Bien (14.6/20)',
        enrollmentDate: '2026-09-14',
        status: 'active',
      },
      {
        schoolId,
        registrationNumber: 'EDU-2026-0002',
        firstName: 'Clarisse',
        lastName: 'Lawson',
        gender: 'F',
        dateOfBirth: '2009-09-23',
        placeOfBirth: 'Lomé',
        address: 'Tokoin, Lomé',
        classId: insertedClasses[2].id,
        parentId: insertedParents[1].id,
        parentName: insertedParents[1].fullName,
        parentPhone: insertedParents[1].phone,
        parentEmail: insertedParents[1].email || '',
        emergencyContact: '+228 90 12 88 34',
        academicHistory: 'Première de classe en 1ère D (16.2/20)',
        enrollmentDate: '2026-09-14',
        status: 'active',
      },
      {
        schoolId,
        registrationNumber: 'EDU-2026-0003',
        firstName: 'Jules',
        lastName: 'Zinsou',
        gender: 'M',
        dateOfBirth: '2014-01-19',
        placeOfBirth: 'Porto-Novo',
        address: 'Akpakpa, Cotonou',
        classId: insertedClasses[0].id,
        parentId: insertedParents[2].id,
        parentName: insertedParents[2].fullName,
        parentPhone: insertedParents[2].phone,
        parentEmail: insertedParents[2].email || '',
        emergencyContact: '+229 96 54 11 09',
        academicHistory: 'CEP obtenu avec 15.1/20',
        enrollmentDate: '2026-09-14',
        status: 'active',
      },
      {
        schoolId,
        registrationNumber: 'EDU-2026-0004',
        firstName: 'Mireille',
        lastName: 'Gbèdo',
        gender: 'F',
        dateOfBirth: '2011-08-05',
        placeOfBirth: 'Abomey-Calavi',
        address: 'Godomey, Abomey-Calavi',
        classId: insertedClasses[1].id,
        parentId: insertedParents[0].id,
        parentName: 'M. Serge Gbèdo',
        parentPhone: '+229 94 22 18 77',
        parentEmail: 'serge.gbedo@mail.bj',
        emergencyContact: '+229 94 22 18 77',
        academicHistory: 'Passage régulier en 3ème',
        enrollmentDate: '2026-09-15',
        status: 'active',
      },
      {
        schoolId,
        registrationNumber: 'EDU-2026-0005',
        firstName: 'Yannick',
        lastName: 'Amoussou',
        gender: 'M',
        dateOfBirth: '2008-11-30',
        placeOfBirth: 'Parakou',
        address: 'Fidjrossè, Cotonou',
        classId: insertedClasses[2].id,
        parentId: insertedParents[2].id,
        parentName: 'Mme Irène Amoussou',
        parentPhone: '+229 97 81 02 44',
        parentEmail: 'irene.amoussou@mail.bj',
        emergencyContact: '+229 97 81 02 44',
        academicHistory: 'Série scientifique D',
        enrollmentDate: '2026-09-14',
        status: 'active',
      },
    ])
    .returning();

  // Attendance for today
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(attendance).values([
    {
      schoolId,
      classId: insertedClasses[1].id,
      studentId: insertedStudents[0].id,
      date: today,
      status: 'present',
      remarks: '',
    },
    {
      schoolId,
      classId: insertedClasses[1].id,
      studentId: insertedStudents[3].id,
      date: today,
      status: 'present',
      remarks: '',
    },
    {
      schoolId,
      classId: insertedClasses[2].id,
      studentId: insertedStudents[1].id,
      date: today,
      status: 'present',
      remarks: '',
    },
    {
      schoolId,
      classId: insertedClasses[2].id,
      studentId: insertedStudents[4].id,
      date: today,
      status: 'late',
      remarks: 'Arrivé à 07h45',
    },
    {
      schoolId,
      classId: insertedClasses[0].id,
      studentId: insertedStudents[2].id,
      date: today,
      status: 'present',
      remarks: '',
    },
  ]);

  // Invoices & Payments
  const tuitionCat = cats[0];
  const insertedInvoices = await db
    .insert(invoices)
    .values([
      {
        schoolId,
        invoiceNumber: 'FAC-2026-0001',
        studentId: insertedStudents[0].id,
        academicYearId: year?.id ?? null,
        feeCategoryId: tuitionCat?.id ?? null,
        title: 'Scolarité 2026-2027 (3ème A)',
        totalAmount: 185000,
        paidAmount: 185000,
        dueDate: '2026-10-30',
        status: 'paid',
      },
      {
        schoolId,
        invoiceNumber: 'FAC-2026-0002',
        studentId: insertedStudents[1].id,
        academicYearId: year?.id ?? null,
        feeCategoryId: tuitionCat?.id ?? null,
        title: 'Scolarité 2026-2027 (Terminale D)',
        totalAmount: 225000,
        paidAmount: 150000,
        dueDate: '2026-11-30',
        status: 'partial',
      },
      {
        schoolId,
        invoiceNumber: 'FAC-2026-0003',
        studentId: insertedStudents[2].id,
        academicYearId: year?.id ?? null,
        feeCategoryId: tuitionCat?.id ?? null,
        title: 'Scolarité 2026-2027 (6ème A)',
        totalAmount: 165000,
        paidAmount: 85000,
        dueDate: '2026-11-30',
        status: 'partial',
      },
      {
        schoolId,
        invoiceNumber: 'FAC-2026-0004',
        studentId: insertedStudents[3].id,
        academicYearId: year?.id ?? null,
        feeCategoryId: tuitionCat?.id ?? null,
        title: 'Scolarité 2026-2027 (3ème A)',
        totalAmount: 185000,
        paidAmount: 0,
        dueDate: '2026-11-10',
        status: 'overdue',
      },
    ])
    .returning();

  await db.insert(payments).values([
    {
      schoolId,
      receiptNumber: 'REC-2026-0001',
      invoiceId: insertedInvoices[0].id,
      studentId: insertedStudents[0].id,
      amount: 185000,
      paymentMethod: 'fedapay',
      paymentProviderRef: 'FDP-992841',
      paidAt: '2026-09-16',
      notes: 'Paiement intégral via FedaPay Mobile Money',
    },
    {
      schoolId,
      receiptNumber: 'REC-2026-0002',
      invoiceId: insertedInvoices[1].id,
      studentId: insertedStudents[1].id,
      amount: 150000,
      paymentMethod: 'kkiapay',
      paymentProviderRef: 'KKP-551029',
      paidAt: '2026-10-04',
      notes: '1ère et 2ème tranche via Kkiapay',
    },
    {
      schoolId,
      receiptNumber: 'REC-2026-0003',
      invoiceId: insertedInvoices[2].id,
      studentId: insertedStudents[2].id,
      amount: 85000,
      paymentMethod: 'cash',
      paymentProviderRef: '',
      paidAt: '2026-10-12',
      notes: 'Acompte versé à la caisse',
    },
  ]);

  // Examinations & Grades
  const [exam1, exam2] = await db
    .insert(examinations)
    .values([
      {
        schoolId,
        academicYearId: year?.id ?? null,
        termId: term?.id ?? null,
        classId: insertedClasses[1].id,
        title: 'Composition Trimestre 1 — 3ème A',
        examType: 'term_exam',
        examDate: '2026-12-08',
        maxScore: 20,
        status: 'completed',
      },
      {
        schoolId,
        academicYearId: year?.id ?? null,
        termId: term?.id ?? null,
        classId: insertedClasses[2].id,
        title: 'Devoir Surveillé Sciences — Terminale D',
        examType: 'midterm',
        examDate: '2026-11-28',
        maxScore: 20,
        status: 'scheduled',
      },
    ])
    .returning();

  await db.insert(grades).values([
    {
      schoolId,
      examinationId: exam1.id,
      studentId: insertedStudents[0].id,
      subjectId: insertedSubjects[0].id,
      classId: insertedClasses[1].id,
      score: 16.5,
      maxScore: 20,
      coefficient: 4,
      teacherComment: 'Très bon raisonnement logique',
    },
    {
      schoolId,
      examinationId: exam1.id,
      studentId: insertedStudents[0].id,
      subjectId: insertedSubjects[1].id,
      classId: insertedClasses[1].id,
      score: 14.0,
      maxScore: 20,
      coefficient: 3,
      teacherComment: 'Bonne maîtrise rédactionnelle',
    },
    {
      schoolId,
      examinationId: exam1.id,
      studentId: insertedStudents[0].id,
      subjectId: insertedSubjects[2].id,
      classId: insertedClasses[1].id,
      score: 15.5,
      maxScore: 20,
      coefficient: 4,
      teacherComment: 'Excellent travail pratique',
    },
    {
      schoolId,
      examinationId: exam1.id,
      studentId: insertedStudents[3].id,
      subjectId: insertedSubjects[0].id,
      classId: insertedClasses[1].id,
      score: 13.5,
      maxScore: 20,
      coefficient: 4,
      teacherComment: 'En progrès régulier',
    },
    {
      schoolId,
      examinationId: exam1.id,
      studentId: insertedStudents[3].id,
      subjectId: insertedSubjects[1].id,
      classId: insertedClasses[1].id,
      score: 15.0,
      maxScore: 20,
      coefficient: 3,
      teacherComment: 'Expression soignée',
    },
    {
      schoolId,
      examinationId: exam1.id,
      studentId: insertedStudents[3].id,
      subjectId: insertedSubjects[2].id,
      classId: insertedClasses[1].id,
      score: 12.5,
      maxScore: 20,
      coefficient: 4,
      teacherComment: 'Efforts soutenus',
    },
  ]);

  // Timetable
  await db.insert(timetables).values([
    {
      schoolId,
      classId: insertedClasses[1].id,
      subjectId: insertedSubjects[0].id,
      teacherId: insertedTeachers[0].id,
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      room: 'Salle B-204',
    },
    {
      schoolId,
      classId: insertedClasses[1].id,
      subjectId: insertedSubjects[1].id,
      teacherId: insertedTeachers[1].id,
      dayOfWeek: 1,
      startTime: '10:15',
      endTime: '12:15',
      room: 'Salle B-204',
    },
    {
      schoolId,
      classId: insertedClasses[1].id,
      subjectId: insertedSubjects[2].id,
      teacherId: insertedTeachers[2].id,
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '10:00',
      room: 'Labo Sciences 1',
    },
    {
      schoolId,
      classId: insertedClasses[2].id,
      subjectId: insertedSubjects[0].id,
      teacherId: insertedTeachers[0].id,
      dayOfWeek: 2,
      startTime: '10:15',
      endTime: '12:15',
      room: 'Salle L-301',
    },
  ]);

  // Payroll
  const currentMonth = new Date().toISOString().slice(0, 7);
  await db.insert(staffPayroll).values(
    insertedTeachers.map((t, i) => ({
      schoolId,
      teacherId: t.id,
      staffName: `${t.firstName} ${t.lastName}`,
      roleTitle: `Enseignant — ${t.specialization}`,
      month: currentMonth,
      baseSalary: t.baseSalary,
      allowances: i === 0 ? 15000 : 10000,
      deductions: 0,
      netSalary: t.baseSalary + (i === 0 ? 15000 : 10000),
      status: i < 2 ? 'paid' : 'pending',
      paidAt: i < 2 ? today : '',
      paymentMethod: 'bank_transfer',
    }))
  );

  // Announcements
  await db.insert(announcements).values([
    {
      schoolId,
      title: 'Conseil de classe & Remise des bulletins — Trimestre 1',
      content:
        'Les parents et tuteurs sont conviés à la journée portes ouvertes et à la remise officielle des bulletins scolaires samedi prochain à 09h00 dans la grande salle.',
      audience: 'all',
      channel: 'portal',
      eventDate: '2026-12-19',
      priority: 'important',
      authorName: actorName,
    },
    {
      schoolId,
      title: 'Rappel échéance deuxième tranche de scolarité',
      content:
        'La deuxième tranche des frais de scolarité est ouverte au règlement par caisse, virement, FedaPay ou Kkiapay.',
      audience: 'parents',
      channel: 'sms_ready',
      eventDate: '2026-11-30',
      priority: 'normal',
      authorName: 'Économat',
    },
  ]);

  await logActivity(
    schoolId,
    actorName,
    'Déploiement modèle',
    'school',
    'Structure académique complète (classes, enseignants, élèves, frais, examens) initialisée'
  );

  return { alreadySeeded: false };
}

export async function clearSchoolReferencesCheck() {
  // Helper export check only
  return { schools };
}
