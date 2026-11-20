import { pool } from './index.ts';

declare global {
  var _edusmartSchemaReadyPromise: Promise<void> | undefined;
}

/**
 * Idempotent PostgreSQL schema bootstrap so fresh deployments (Vercel + Neon/Supabase/Postgres)
 * automatically initialize all 30 EDUSMART tables without touching existing Cloud SQL rows.
 */
async function runBootstrapSchema(): Promise<void> {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      country TEXT NOT NULL DEFAULT 'Bénin',
      city TEXT NOT NULL DEFAULT 'Cotonou',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      website TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'XOF',
      academic_system TEXT NOT NULL DEFAULT 'Francophone',
      subscription_plan TEXT NOT NULL DEFAULT 'multi_niveaux',
      subscription_status TEXT NOT NULL DEFAULT 'trial',
      subscription_renews_at TEXT DEFAULT '',
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      trial_started_at TEXT DEFAULT '',
      trial_ends_at TEXT DEFAULT '',
      trial_used BOOLEAN NOT NULL DEFAULT true,
      subscription_started_at TEXT DEFAULT '',
      profile_completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_started_at TEXT DEFAULT ''`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_ends_at TEXT DEFAULT ''`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_started_at TEXT DEFAULT ''`,

    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT DEFAULT '',
      full_name TEXT NOT NULL DEFAULT '',
      phone TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'school_admin',
      status TEXT NOT NULL DEFAULT 'active',
      email_verified BOOLEAN NOT NULL DEFAULT false,
      verification_token TEXT DEFAULT '',
      reset_token TEXT DEFAULT '',
      reset_token_expires_at TEXT DEFAULT '',
      linked_teacher_id INTEGER,
      linked_parent_id INTEGER,
      linked_student_id INTEGER,
      preferred_lang TEXT NOT NULL DEFAULT 'fr',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS academic_years (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS terms (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      employee_code TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'M',
      email TEXT DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      date_of_birth TEXT DEFAULT '',
      address TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      qualification TEXT DEFAULT '',
      specialization TEXT DEFAULT '',
      employment_type TEXT NOT NULL DEFAULT 'full_time',
      hire_date TEXT DEFAULT '',
      base_salary INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_code TEXT DEFAULT '',
      academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      name_en TEXT DEFAULT '',
      level TEXT NOT NULL DEFAULT 'Collège',
      level_key TEXT DEFAULT 'junior_secondary',
      section TEXT NOT NULL DEFAULT 'A',
      series_id INTEGER,
      specialization_id INTEGER,
      capacity INTEGER NOT NULL DEFAULT 40,
      room TEXT DEFAULT '',
      homeroom_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      name_fr TEXT DEFAULT '',
      name_en TEXT DEFAULT '',
      code TEXT NOT NULL,
      category TEXT DEFAULT 'Mathematics',
      level_scope TEXT DEFAULT 'general',
      description_fr TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      coefficient INTEGER NOT NULL DEFAULT 2,
      department TEXT DEFAULT 'Sciences',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS class_subjects (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id INTEGER,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      series_id INTEGER,
      specialization_id INTEGER,
      coefficient INTEGER NOT NULL DEFAULT 2,
      weekly_hours INTEGER NOT NULL DEFAULT 4,
      is_exam_subject BOOLEAN NOT NULL DEFAULT true,
      subject_group TEXT DEFAULT 'Core',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS parents (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      relationship TEXT NOT NULL DEFAULT 'Tuteur',
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      occupation TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      registration_number TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'M',
      date_of_birth TEXT DEFAULT '',
      place_of_birth TEXT DEFAULT '',
      address TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
      academic_year_name TEXT DEFAULT '',
      parent_id INTEGER REFERENCES parents(id) ON DELETE SET NULL,
      parent_name TEXT DEFAULT '',
      parent_phone TEXT DEFAULT '',
      parent_email TEXT DEFAULT '',
      emergency_contact TEXT DEFAULT '',
      academic_history TEXT DEFAULT '',
      enrollment_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      remarks TEXT DEFAULT '',
      recorded_by_user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS teacher_attendance (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      remarks TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS fee_categories (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'tuition',
      default_amount INTEGER NOT NULL DEFAULT 0,
      frequency TEXT NOT NULL DEFAULT 'annual',
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
      fee_category_id INTEGER REFERENCES fee_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      total_amount INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      receipt_number TEXT NOT NULL,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_provider_ref TEXT DEFAULT '',
      paid_at TEXT NOT NULL,
      notes TEXT DEFAULT '',
      recorded_by_user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS examinations (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
      term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      exam_type TEXT NOT NULL DEFAULT 'term_exam',
      exam_date TEXT NOT NULL,
      max_score INTEGER NOT NULL DEFAULT 20,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS grades (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      examination_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      score DOUBLE PRECISION NOT NULL DEFAULT 0,
      max_score INTEGER NOT NULL DEFAULT 20,
      coefficient INTEGER NOT NULL DEFAULT 1,
      teacher_comment TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS timetables (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL DEFAULT 1,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT NOT NULL DEFAULT 'Salle 101',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS staff_payroll (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      staff_name TEXT NOT NULL,
      role_title TEXT NOT NULL DEFAULT 'Enseignant',
      month TEXT NOT NULL,
      base_salary INTEGER NOT NULL DEFAULT 0,
      allowances INTEGER NOT NULL DEFAULT 0,
      deductions INTEGER NOT NULL DEFAULT 0,
      net_salary INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at TEXT DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'all',
      channel TEXT NOT NULL DEFAULT 'portal',
      event_date TEXT DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'normal',
      author_name TEXT NOT NULL DEFAULT 'Direction',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS support_requests (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      school_name TEXT NOT NULL DEFAULT '',
      requester_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS media_files (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      public_token TEXT NOT NULL UNIQUE,
      owner_type TEXT NOT NULL DEFAULT 'photo',
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS id_cards (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      card_type TEXT NOT NULL DEFAULT 'student',
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      card_number TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      holder_code TEXT NOT NULL,
      designation_or_class TEXT NOT NULL DEFAULT '',
      academic_year_or_status TEXT NOT NULL DEFAULT '',
      photo_url TEXT DEFAULT '',
      meta_json TEXT DEFAULT '',
      verification_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      reprint_count INTEGER NOT NULL DEFAULT 0,
      issued_at TEXT NOT NULL DEFAULT '',
      last_printed_at TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS curriculum_profiles (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
      country_code TEXT NOT NULL DEFAULT 'BJ',
      country_name TEXT NOT NULL DEFAULT 'Benin',
      system_type TEXT NOT NULL DEFAULT 'Francophone',
      grading_scale INTEGER NOT NULL DEFAULT 20,
      pass_mark DOUBLE PRECISION NOT NULL DEFAULT 10,
      enabled_levels_json TEXT NOT NULL DEFAULT '["preschool","primary","junior_secondary","senior_secondary"]',
      notes TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS academic_series (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      name_en TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      level_scope TEXT NOT NULL DEFAULT 'senior_secondary',
      description_fr TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS specializations (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      series_id INTEGER REFERENCES academic_series(id) ON DELETE SET NULL,
      code TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      name_en TEXT NOT NULL,
      sector TEXT NOT NULL DEFAULT 'engineering',
      description_fr TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS subject_coefficients (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      series_id INTEGER REFERENCES academic_series(id) ON DELETE CASCADE,
      specialization_id INTEGER REFERENCES specializations(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      coefficient INTEGER NOT NULL DEFAULT 2,
      weekly_hours INTEGER NOT NULL DEFAULT 3,
      is_exam_subject BOOLEAN NOT NULL DEFAULT true,
      country_code TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id SERIAL PRIMARY KEY,
      plan_key TEXT NOT NULL UNIQUE,
      name_fr TEXT NOT NULL,
      name_en TEXT NOT NULL,
      subtitle_fr TEXT DEFAULT '',
      subtitle_en TEXT DEFAULT '',
      monthly_price_xof INTEGER NOT NULL,
      annual_discount_percent INTEGER NOT NULL DEFAULT 20,
      annual_price_xof INTEGER NOT NULL,
      features_fr_json TEXT NOT NULL DEFAULT '[]',
      features_en_json TEXT NOT NULL DEFAULT '[]',
      levels_json TEXT NOT NULL DEFAULT '[]',
      is_popular BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS subscription_payments (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      plan_key TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      amount_xof INTEGER NOT NULL,
      discount_amount_xof INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'fedapay',
      payment_reference TEXT DEFAULT '',
      invoice_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      authorized_by_user_id INTEGER,
      authorized_explicitly BOOLEAN NOT NULL DEFAULT true,
      period_start TEXT DEFAULT '',
      period_end TEXT DEFAULT '',
      paid_at TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  ];

  // Fast probe first: skip 30+ DDL statements if key tables already exist
  const probe = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('public.subscription_payments') IS NOT NULL AS exists`
  );
  if (probe.rows[0]?.exists) {
    return;
  }

  for (const sql of ddlStatements) {
    await pool.query(sql);
  }
}

export function ensureDatabaseSchema(): Promise<void> {
  if (!global._edusmartSchemaReadyPromise) {
    global._edusmartSchemaReadyPromise = runBootstrapSchema().catch((err) => {
      global._edusmartSchemaReadyPromise = undefined;
      throw err;
    });
  }
  return global._edusmartSchemaReadyPromise;
}
