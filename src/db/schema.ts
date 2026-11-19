import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Schools (Tenant Root)
export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  country: text('country').notNull().default('Bénin'),
  city: text('city').notNull().default('Cotonou'),
  address: text('address').default(''),
  phone: text('phone').default(''),
  email: text('email').default(''),
  website: text('website').default(''),
  logoUrl: text('logo_url').default(''),
  currency: text('currency').notNull().default('XOF'), // XOF, XAF, EUR, USD
  academicSystem: text('academic_system').notNull().default('Francophone'), // Francophone, Anglophone, Bilingual
  subscriptionPlan: text('subscription_plan').notNull().default('multi_niveaux'), // maternelle_primaire, college, lycee, multi_niveaux
  subscriptionStatus: text('subscription_status').notNull().default('trial'), // trial, active, expired, suspended, past_due
  subscriptionRenewsAt: text('subscription_renews_at').default(''),
  billingCycle: text('billing_cycle').notNull().default('monthly'), // monthly, annual
  trialStartedAt: text('trial_started_at').default(''),
  trialEndsAt: text('trial_ends_at').default(''),
  trialUsed: boolean('trial_used').notNull().default(true),
  subscriptionStartedAt: text('subscription_started_at').default(''),
  profileCompleted: boolean('profile_completed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Users & Roles (Multi-role RBAC + Firebase Auth / Password Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  schoolId: integer('school_id').references(() => schools.id, { onDelete: 'set null' }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').default(''),
  fullName: text('full_name').notNull().default(''),
  phone: text('phone').default(''),
  avatarUrl: text('avatar_url').default(''),
  role: text('role').notNull().default('school_admin'), // super_admin, school_admin, accountant, teacher, parent, student
  status: text('status').notNull().default('active'), // active, pending_verification, suspended
  emailVerified: boolean('email_verified').notNull().default(false),
  verificationToken: text('verification_token').default(''),
  resetToken: text('reset_token').default(''),
  resetTokenExpiresAt: text('reset_token_expires_at').default(''),
  linkedTeacherId: integer('linked_teacher_id'),
  linkedParentId: integer('linked_parent_id'),
  linkedStudentId: integer('linked_student_id'),
  preferredLang: text('preferred_lang').notNull().default('fr'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Academic Years
export const academicYears = pgTable('academic_years', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // e.g., 2025-2026
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Terms / Semesters
export const terms = pgTable('terms', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  academicYearId: integer('academic_year_id')
    .references(() => academicYears.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(), // Trimestre 1, Semestre 1, etc.
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Teachers
export const teachers = pgTable('teachers', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  employeeCode: text('employee_code').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender').notNull().default('M'),
  email: text('email').default(''),
  phone: text('phone').notNull().default(''),
  dateOfBirth: text('date_of_birth').default(''),
  address: text('address').default(''),
  photoUrl: text('photo_url').default(''),
  qualification: text('qualification').default(''),
  specialization: text('specialization').default(''),
  employmentType: text('employment_type').notNull().default('full_time'), // full_time, part_time, contract
  hireDate: text('hire_date').default(''),
  baseSalary: integer('base_salary').notNull().default(0),
  status: text('status').notNull().default('active'), // active, on_leave, inactive
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Classes & Sections
export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  classCode: text('class_code').default(''),
  academicYearId: integer('academic_year_id').references(() => academicYears.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(), // Primary / French display name e.g. 6ème A, Terminale D
  nameEn: text('name_en').default(''), // English class name e.g. Grade 7 A, Grade 13 D
  level: text('level').notNull().default('Collège'), // Maternelle, Primaire, Collège, Lycée, Technique
  levelKey: text('level_key').default('junior_secondary'), // preschool, primary, junior_secondary, senior_secondary, technical_vocational
  section: text('section').notNull().default('A'),
  seriesId: integer('series_id'),
  specializationId: integer('specialization_id'),
  capacity: integer('capacity').notNull().default(40),
  room: text('room').default(''),
  homeroomTeacherId: integer('homeroom_teacher_id').references(() => teachers.id, {
    onDelete: 'set null',
  }),
  status: text('status').notNull().default('active'), // active, inactive
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Subjects
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  nameFr: text('name_fr').default(''),
  nameEn: text('name_en').default(''),
  code: text('code').notNull(),
  category: text('category').default('Mathematics'),
  levelScope: text('level_scope').default('general'),
  descriptionFr: text('description_fr').default(''),
  descriptionEn: text('description_en').default(''),
  coefficient: integer('coefficient').notNull().default(2),
  department: text('department').default('Sciences'),
  status: text('status').notNull().default('active'), // active, inactive
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Class-Subject-Teacher Assignments
export const classSubjects = pgTable('class_subjects', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  academicYearId: integer('academic_year_id'),
  classId: integer('class_id')
    .references(() => classes.id, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  seriesId: integer('series_id'),
  specializationId: integer('specialization_id'),
  coefficient: integer('coefficient').notNull().default(2),
  weeklyHours: integer('weekly_hours').notNull().default(4),
  isExamSubject: boolean('is_exam_subject').notNull().default(true),
  subjectGroup: text('subject_group').default('Core'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Parents / Guardians
export const parents = pgTable('parents', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  relationship: text('relationship').notNull().default('Tuteur'),
  phone: text('phone').notNull(),
  email: text('email').default(''),
  occupation: text('occupation').default(''),
  address: text('address').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Students
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  registrationNumber: text('registration_number').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender').notNull().default('M'), // M, F
  dateOfBirth: text('date_of_birth').default(''),
  placeOfBirth: text('place_of_birth').default(''),
  address: text('address').default(''),
  photoUrl: text('photo_url').default(''),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  academicYearId: integer('academic_year_id').references(() => academicYears.id, { onDelete: 'set null' }),
  academicYearName: text('academic_year_name').default(''),
  parentId: integer('parent_id').references(() => parents.id, { onDelete: 'set null' }),
  parentName: text('parent_name').default(''),
  parentPhone: text('parent_phone').default(''),
  parentEmail: text('parent_email').default(''),
  emergencyContact: text('emergency_contact').default(''),
  academicHistory: text('academic_history').default(''),
  enrollmentDate: text('enrollment_date').default(''),
  status: text('status').notNull().default('active'), // active, archived, graduated, transferred
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. Student Attendance
export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  classId: integer('class_id')
    .references(() => classes.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: integer('student_id')
    .references(() => students.id, { onDelete: 'cascade' })
    .notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  status: text('status').notNull().default('present'), // present, absent, late, excused
  remarks: text('remarks').default(''),
  recordedByUserId: integer('recorded_by_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 12. Teacher Attendance
export const teacherAttendance = pgTable('teacher_attendance', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  teacherId: integer('teacher_id')
    .references(() => teachers.id, { onDelete: 'cascade' })
    .notNull(),
  date: text('date').notNull(),
  status: text('status').notNull().default('present'), // present, absent, late, on_leave
  remarks: text('remarks').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 13. Fee Categories
export const feeCategories = pgTable('fee_categories', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('tuition'), // tuition, registration, exam, transport, canteen, other
  defaultAmount: integer('default_amount').notNull().default(0),
  frequency: text('frequency').notNull().default('annual'), // annual, term, monthly, once
  description: text('description').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 14. Student Invoices
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  studentId: integer('student_id')
    .references(() => students.id, { onDelete: 'cascade' })
    .notNull(),
  academicYearId: integer('academic_year_id').references(() => academicYears.id, {
    onDelete: 'set null',
  }),
  feeCategoryId: integer('fee_category_id').references(() => feeCategories.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  totalAmount: integer('total_amount').notNull().default(0),
  paidAmount: integer('paid_amount').notNull().default(0),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('unpaid'), // unpaid, partial, paid, overdue
  createdAt: timestamp('created_at').defaultNow(),
});

// 15. Fee Payments (Supports Cash, Bank Transfer, FedaPay, Kkiapay)
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  receiptNumber: text('receipt_number').notNull(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: integer('student_id')
    .references(() => students.id, { onDelete: 'cascade' })
    .notNull(),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'), // cash, bank_transfer, mobile_money, fedapay, kkiapay, check
  paymentProviderRef: text('payment_provider_ref').default(''),
  paidAt: text('paid_at').notNull(),
  notes: text('notes').default(''),
  recordedByUserId: integer('recorded_by_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 16. Examinations
export const examinations = pgTable('examinations', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  academicYearId: integer('academic_year_id').references(() => academicYears.id, {
    onDelete: 'set null',
  }),
  termId: integer('term_id').references(() => terms.id, { onDelete: 'set null' }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  examType: text('exam_type').notNull().default('term_exam'), // continuous, midterm, term_exam, mock_exam
  examDate: text('exam_date').notNull(),
  maxScore: integer('max_score').notNull().default(20),
  status: text('status').notNull().default('scheduled'), // scheduled, ongoing, completed
  createdAt: timestamp('created_at').defaultNow(),
});

// 17. Grades & Results
export const grades = pgTable('grades', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  examinationId: integer('examination_id')
    .references(() => examinations.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: integer('student_id')
    .references(() => students.id, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  classId: integer('class_id')
    .references(() => classes.id, { onDelete: 'cascade' })
    .notNull(),
  score: doublePrecision('score').notNull().default(0),
  maxScore: integer('max_score').notNull().default(20),
  coefficient: integer('coefficient').notNull().default(1),
  teacherComment: text('teacher_comment').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 18. Timetables
export const timetables = pgTable('timetables', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  classId: integer('class_id')
    .references(() => classes.id, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  teacherId: integer('teacher_id')
    .references(() => teachers.id, { onDelete: 'cascade' })
    .notNull(),
  dayOfWeek: integer('day_of_week').notNull().default(1), // 1=Mon ... 6=Sat
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(), // HH:MM
  room: text('room').notNull().default('Salle 101'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 19. Staff & Payroll
export const staffPayroll = pgTable('staff_payroll', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  staffName: text('staff_name').notNull(),
  roleTitle: text('role_title').notNull().default('Enseignant'),
  month: text('month').notNull(), // YYYY-MM
  baseSalary: integer('base_salary').notNull().default(0),
  allowances: integer('allowances').notNull().default(0),
  deductions: integer('deductions').notNull().default(0),
  netSalary: integer('net_salary').notNull().default(0),
  status: text('status').notNull().default('pending'), // pending, paid
  paidAt: text('paid_at').default(''),
  paymentMethod: text('payment_method').notNull().default('bank_transfer'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 20. Announcements & Notifications
export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  audience: text('audience').notNull().default('all'), // all, teachers, parents, students, admins
  channel: text('channel').notNull().default('portal'), // portal, email_ready, sms_ready
  eventDate: text('event_date').default(''),
  priority: text('priority').notNull().default('normal'), // normal, important, urgent
  authorName: text('author_name').notNull().default('Direction'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 21. Support Requests (Super Admin Panel)
export const supportRequests = pgTable('support_requests', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  schoolName: text('school_name').notNull().default(''),
  requesterEmail: text('requester_email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'), // open, in_progress, resolved
  createdAt: timestamp('created_at').defaultNow(),
});

// 22. Activity Logs (Recent Activities on Dashboard)
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 23. Media Files (Uploaded & Cropped Photos stored persistently)
export const mediaFiles = pgTable('media_files', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  publicToken: text('public_token').notNull().unique(),
  ownerType: text('owner_type').notNull().default('photo'), // student, teacher, school_logo
  mimeType: text('mime_type').notNull().default('image/jpeg'),
  sizeBytes: integer('size_bytes').notNull().default(0),
  dataBase64: text('data_base64').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 24. Student, Teacher & Class ID Cards with Secure QR Verification
export const idCards = pgTable('id_cards', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  cardType: text('card_type').notNull().default('student'), // student, teacher, class
  studentId: integer('student_id').references(() => students.id, { onDelete: 'cascade' }),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'cascade' }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'cascade' }),
  cardNumber: text('card_number').notNull(),
  holderName: text('holder_name').notNull(),
  holderCode: text('holder_code').notNull(),
  designationOrClass: text('designation_or_class').notNull().default(''),
  academicYearOrStatus: text('academic_year_or_status').notNull().default(''),
  photoUrl: text('photo_url').default(''),
  metaJson: text('meta_json').default(''),
  verificationCode: text('verification_code').notNull().unique(),
  status: text('status').notNull().default('active'), // active, inactive, lost
  reprintCount: integer('reprint_count').notNull().default(0),
  issuedAt: text('issued_at').notNull().default(''),
  lastPrintedAt: text('last_printed_at').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 25. School Curriculum & Country Configuration Profile
export const curriculumProfiles = pgTable('curriculum_profiles', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  countryCode: text('country_code').notNull().default('BJ'),
  countryName: text('country_name').notNull().default('Benin'),
  systemType: text('system_type').notNull().default('Francophone'), // Francophone, Anglophone, Bilingual, Technical
  gradingScale: integer('grading_scale').notNull().default(20),
  passMark: doublePrecision('pass_mark').notNull().default(10),
  enabledLevelsJson: text('enabled_levels_json')
    .notNull()
    .default('["preschool","primary","junior_secondary","senior_secondary"]'),
  notes: text('notes').default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 26. Educational Series (Série A, C, D, Scientific, Literary, Technical, Vocational...)
export const academicSeries = pgTable('academic_series', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  code: text('code').notNull(),
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en').notNull(),
  category: text('category').notNull().default('general'), // general, scientific, literary, economic, technical, vocational
  levelScope: text('level_scope').notNull().default('senior_secondary'),
  descriptionFr: text('description_fr').default(''),
  descriptionEn: text('description_en').default(''),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 27. Technical & Vocational Specializations
export const specializations = pgTable('specializations', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  seriesId: integer('series_id').references(() => academicSeries.id, { onDelete: 'set null' }),
  code: text('code').notNull(),
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en').notNull(),
  sector: text('sector').notNull().default('engineering'),
  descriptionFr: text('description_fr').default(''),
  descriptionEn: text('description_en').default(''),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 28. Configurable Academic Coefficient Matrix (Scoped by Year, Class, Series, Specialization)
export const subjectCoefficients = pgTable('subject_coefficients', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  academicYearId: integer('academic_year_id').references(() => academicYears.id, {
    onDelete: 'cascade',
  }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'cascade' }),
  seriesId: integer('series_id').references(() => academicSeries.id, { onDelete: 'cascade' }),
  specializationId: integer('specialization_id').references(() => specializations.id, {
    onDelete: 'cascade',
  }),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  coefficient: integer('coefficient').notNull().default(2),
  weeklyHours: integer('weekly_hours').notNull().default(3),
  isExamSubject: boolean('is_exam_subject').notNull().default(true),
  countryCode: text('country_code').default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 29. SaaS Subscription Pricing Catalog (Editable only by Super Admin)
export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  planKey: text('plan_key').notNull().unique(), // maternelle_primaire, college, lycee, multi_niveaux
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en').notNull(),
  subtitleFr: text('subtitle_fr').default(''),
  subtitleEn: text('subtitle_en').default(''),
  monthlyPriceXof: integer('monthly_price_xof').notNull(),
  annualDiscountPercent: integer('annual_discount_percent').notNull().default(20),
  annualPriceXof: integer('annual_price_xof').notNull(),
  featuresFrJson: text('features_fr_json').notNull().default('[]'),
  featuresEnJson: text('features_en_json').notNull().default('[]'),
  levelsJson: text('levels_json').notNull().default('[]'),
  isPopular: boolean('is_popular').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(1),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 30. SaaS Subscription Invoices & Payments Ledger
export const subscriptionPayments = pgTable('subscription_payments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id, { onDelete: 'cascade' })
    .notNull(),
  planKey: text('plan_key').notNull(),
  billingCycle: text('billing_cycle').notNull().default('monthly'), // monthly, annual
  amountXof: integer('amount_xof').notNull(),
  discountAmountXof: integer('discount_amount_xof').notNull().default(0),
  paymentMethod: text('payment_method').notNull().default('fedapay'), // fedapay, kkiapay, bank_transfer, mobile_money, cash
  paymentReference: text('payment_reference').default(''),
  invoiceNumber: text('invoice_number').notNull(),
  status: text('status').notNull().default('pending'), // pending, paid, cancelled, refunded
  authorizedByUserId: integer('authorized_by_user_id'),
  authorizedExplicitly: boolean('authorized_explicitly').notNull().default(true),
  periodStart: text('period_start').default(''),
  periodEnd: text('period_end').default(''),
  paidAt: text('paid_at').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});


