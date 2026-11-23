import { Router } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { schools, users } from '../../db/schema.ts';
import { generateCode, hashPassword, signAppToken, verifyPassword } from '../../lib/auth-crypto.ts';
import { normalizePlanKey } from '../../lib/subscriptionCatalog.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { bootstrapSchoolDefaults, logActivity, sanitizeUser } from '../helpers.ts';
import { buildNewTrialWindow, syncSchoolSubscriptionStatus } from '../subscriptionService.ts';

const router = Router();

// Register School + School Admin OR Register user into existing School via schoolCode
router.post('/register', async (req, res) => {
  let newlyCreatedSchoolId: number | null = null;
  try {
    const {
      mode = 'create_school', // 'create_school' | 'join_school'
      fullName,
      email,
      password,
      phone = '',
      schoolName,
      country = 'Bénin',
      city = 'Cotonou',
      currency = 'XOF',
      academicSystem = 'Francophone',
      schoolCode,
      role = 'school_admin',
      preferredLang = 'fr',
      subscriptionPlan = 'multi_niveaux',
      billingCycle = 'monthly',
    } = req.body || {};

    const trimmedFullName = String(fullName || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!trimmedFullName || !cleanEmail || !password || !String(password).trim()) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const verificationToken = generateCode(6);
    const passwordHash = hashPassword(String(password));
    const uid = `local_${crypto.randomUUID()}`;

    let assignedSchool: typeof schools.$inferSelect | null = null;
    let assignedRole = 'school_admin';

    if (mode === 'create_school') {
      const trimmedSchoolName = String(schoolName || '').trim();
      if (trimmedSchoolName.length < 2) {
        return res.status(400).json({ error: 'School name is required to create an institution.' });
      }
      const slugBase = trimmedSchoolName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
      const uniqueCode = `${slugBase || 'EDU'}-${generateCode(4)}`;
      const trialWindow = buildNewTrialWindow();

      const [createdSchool] = await db
        .insert(schools)
        .values({
          name: trimmedSchoolName,
          code: uniqueCode,
          country: String(country || 'Bénin').trim() || 'Bénin',
          city: String(city || 'Cotonou').trim() || 'Cotonou',
          email: cleanEmail,
          phone: String(phone || '').trim(),
          currency: String(currency || 'XOF').trim() || 'XOF',
          academicSystem: String(academicSystem || 'Francophone').trim() || 'Francophone',
          subscriptionPlan: normalizePlanKey(String(subscriptionPlan || 'multi_niveaux')),
          billingCycle: billingCycle === 'annual' ? 'annual' : 'monthly',
          subscriptionStatus: trialWindow.subscriptionStatus,
          trialStartedAt: trialWindow.trialStartedAt,
          trialEndsAt: trialWindow.trialEndsAt,
          trialUsed: trialWindow.trialUsed,
          subscriptionRenewsAt: trialWindow.subscriptionRenewsAt,
          profileCompleted: true,
        })
        .returning();

      newlyCreatedSchoolId = createdSchool.id;
      assignedSchool = createdSchool;
      assignedRole = 'school_admin';
      await bootstrapSchoolDefaults(createdSchool.id, trimmedFullName);
    } else {
      if (!schoolCode) {
        return res.status(400).json({ error: 'School code is required to join an existing school.' });
      }
      const foundSchool = await db
        .select()
        .from(schools)
        .where(eq(schools.code, String(schoolCode).trim().toUpperCase()))
        .limit(1);
      if (foundSchool.length === 0) {
        return res.status(404).json({ error: 'No school found with that institution code.' });
      }
      assignedSchool = foundSchool[0];
      const allowedJoinRoles = ['teacher', 'parent', 'student', 'accountant'];
      assignedRole = allowedJoinRoles.includes(role) ? role : 'teacher';
    }

    const [createdUser] = await db
      .insert(users)
      .values({
        uid,
        schoolId: assignedSchool.id,
        email: cleanEmail,
        passwordHash,
        fullName: trimmedFullName,
        phone: String(phone || '').trim(),
        role: assignedRole,
        status: 'active',
        emailVerified: false,
        verificationToken,
        preferredLang: preferredLang === 'en' ? 'en' : 'fr',
      })
      .returning();

    newlyCreatedSchoolId = null;

    await logActivity(
      assignedSchool.id,
      createdUser.fullName,
      'Inscription',
      'user',
      `Nouveau compte ${assignedRole} créé (${cleanEmail})`
    );

    const token = signAppToken({
      uid: createdUser.uid,
      userId: createdUser.id,
      email: createdUser.email,
    });

    res.status(201).json({
      token,
      user: sanitizeUser(createdUser),
      school: assignedSchool,
      verificationCodePreview: verificationToken,
    });
  } catch (error) {
    if (newlyCreatedSchoolId !== null) {
      await db
        .delete(schools)
        .where(eq(schools.id, newlyCreatedSchoolId))
        .catch((cleanupErr) => console.error('School rollback failed:', cleanupErr));
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register account. Please try again.' });
  }
});

// Login with email & password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    const user = found[0];

    if (!user || !user.passwordHash || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended.' });
    }

    let school: typeof schools.$inferSelect | null = null;
    if (user.schoolId) {
      const s = await db.select().from(schools).where(eq(schools.id, user.schoolId)).limit(1);
      if (s[0]) {
        const synced = await syncSchoolSubscriptionStatus(s[0]);
        school = synced.school;
      }
      if (school && school.subscriptionStatus === 'suspended' && user.role !== 'super_admin') {
        return res.status(403).json({ error: 'School account is suspended. Contact EDUSMART support.' });
      }
    }

    const token = signAppToken({
      uid: user.uid,
      userId: user.id,
      email: user.email,
    });

    res.json({
      token,
      user: sanitizeUser(user),
      school,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

// Verify Firebase Google session & fetch DB profile
router.post('/google', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({
      user: sanitizeUser(req.dbUser),
      school: req.school || null,
    });
  } catch (error) {
    console.error('Google sync error:', error);
    res.status(500).json({ error: 'Failed to synchronize Google account.' });
  }
});

// Verify email code
router.post('/verify-email', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body || {};
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });

    if (!code || String(code).trim() !== req.dbUser.verificationToken) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    const [updated] = await db
      .update(users)
      .set({ emailVerified: true, verificationToken: '' })
      .where(eq(users.id, req.dbUser.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// Resend verification code
router.post('/resend-verification', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const newCode = generateCode(6);
    await db
      .update(users)
      .set({ verificationToken: newCode })
      .where(eq(users.id, req.dbUser.id));

    res.json({
      message: 'Verification code generated.',
      verificationCodePreview: newCode,
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to generate verification code.' });
  }
});

// Forgot password -> generate reset token
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

    if (found.length === 0) {
      return res.json({
        message: 'If an account matches this email, a reset code has been issued.',
      });
    }

    const resetToken = generateCode(6);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await db
      .update(users)
      .set({ resetToken, resetTokenExpiresAt: expiresAt })
      .where(eq(users.id, found[0].id));

    res.json({
      message: 'Password reset code generated.',
      resetCodePreview: resetToken,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to initiate password reset.' });
  }
});

// Reset password with code
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, reset code, and new password are required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    const user = found[0];

    if (
      !user ||
      !user.resetToken ||
      user.resetToken !== String(code).trim() ||
      !user.resetTokenExpiresAt ||
      new Date(user.resetTokenExpiresAt).getTime() < Date.now()
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(String(newPassword)),
        resetToken: '',
        resetTokenExpiresAt: '',
      })
      .where(eq(users.id, user.id));

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Current authenticated user + school
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    user: sanitizeUser(req.dbUser),
    school: req.school || null,
  });
});

// Update user profile / language preference
router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const { fullName, phone, preferredLang } = req.body || {};

    const [updated] = await db
      .update(users)
      .set({
        fullName: fullName ? String(fullName).trim() : req.dbUser.fullName,
        phone: phone !== undefined ? String(phone) : req.dbUser.phone,
        preferredLang: preferredLang === 'en' ? 'en' : preferredLang === 'fr' ? 'fr' : req.dbUser.preferredLang,
      })
      .where(eq(users.id, req.dbUser.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

export default router;
