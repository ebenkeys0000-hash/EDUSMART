import { Request, Response, NextFunction } from 'express';
import { eq, or } from 'drizzle-orm';
import { verifyFirebaseIdToken } from '../lib/firebase-admin.ts';
import { verifyAppToken } from '../lib/auth-crypto.ts';
import { db } from '../db/index.ts';
import { ensureDatabaseSchema } from '../db/bootstrapSchema.ts';
import { schools, users } from '../db/schema.ts';
import { computeTrialAndSubscriptionState } from '../lib/subscriptionCatalog.ts';
import { syncSchoolSubscriptionStatus } from '../server/subscriptionService.ts';

export type DbUser = typeof users.$inferSelect;
export type DbSchool = typeof schools.$inferSelect;

export interface AuthRequest extends Request {
  dbUser?: DbUser;
  school?: DbSchool | null;
}

export async function upsertFirebaseUser(
  uid: string,
  email: string,
  name?: string,
  picture?: string
): Promise<DbUser> {
  if (!uid || !uid.trim()) {
    throw new Error('Firebase token is missing a valid user UID.');
  }

  const cleanUid = uid.trim();
  const cleanEmail = (email || `${cleanUid}@firebase.local`).trim().toLowerCase();

  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.uid, cleanUid), eq(users.email, cleanEmail)))
    .limit(2);

  if (existing.length > 0) {
    // Prefer an exact UID match first; otherwise link the matching email account
    const current = existing.find((row) => row.uid === cleanUid) || existing[0];
    const needsUidUpdate = current.uid !== cleanUid;
    const needsVerified = !current.emailVerified;
    const needsAvatar = !current.avatarUrl && Boolean(picture);
    const needsName = !current.fullName && Boolean(name);

    if (needsUidUpdate || needsVerified || needsAvatar || needsName) {
      const [updated] = await db
        .update(users)
        .set({
          uid: cleanUid,
          emailVerified: true,
          avatarUrl: current.avatarUrl || picture || '',
          fullName: current.fullName || name || cleanEmail.split('@')[0],
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated;
    }
    return current;
  }

  // Race-safe insert when concurrent Firebase auth requests arrive for a first-time Google user
  await db
    .insert(users)
    .values({
      uid: cleanUid,
      email: cleanEmail,
      fullName: name || cleanEmail.split('@')[0],
      avatarUrl: picture || '',
      role: 'school_admin',
      status: 'active',
      emailVerified: true,
    })
    .onConflictDoNothing();

  const resolved = await db
    .select()
    .from(users)
    .where(or(eq(users.uid, cleanUid), eq(users.email, cleanEmail)))
    .limit(1);

  if (resolved.length === 0) {
    throw new Error('Failed to resolve authenticated Firebase account in database.');
  }

  const row = resolved[0];
  if (row.uid !== cleanUid || !row.emailVerified) {
    const [updated] = await db
      .update(users)
      .set({
        uid: cleanUid,
        emailVerified: true,
        avatarUrl: row.avatarUrl || picture || '',
        fullName: row.fullName || name || cleanEmail.split('@')[0],
      })
      .where(eq(users.id, row.id))
      .returning();
    return updated;
  }

  return row;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty authentication token' });
  }

  // Phase 1: Ensure database schema is ready
  try {
    await ensureDatabaseSchema();
  } catch (dbInitError: any) {
    console.error('Database initialization failed during authentication:', dbInitError);
    return res.status(503).json({
      error: `Database unavailable during authentication: ${dbInitError?.message || 'Connection error'}`,
    });
  }

  // Phase 2: Verify local app token OR Firebase ID token (only cryptographic/token errors return 401)
  const appPayload = verifyAppToken(token);
  let firebaseIdentity: Awaited<ReturnType<typeof verifyFirebaseIdToken>> | null = null;

  if (!appPayload) {
    try {
      firebaseIdentity = await verifyFirebaseIdToken(token);
    } catch (tokenError: any) {
      const code = tokenError?.code ? ` (${tokenError.code})` : '';
      const detail = tokenError?.message || 'Invalid or expired Firebase ID token';
      console.error('Firebase token verification failed:', code, detail);
      return res.status(401).json({
        error: `Unauthorized: Token verification failed${code}: ${detail}`,
      });
    }
  }

  // Phase 3: Synchronize authenticated identity with PostgreSQL user & school tenant
  try {
    let dbUser: DbUser | undefined;

    if (appPayload) {
      const found = await db.select().from(users).where(eq(users.id, appPayload.userId)).limit(1);
      dbUser = found[0];
    } else if (firebaseIdentity) {
      dbUser = await upsertFirebaseUser(
        firebaseIdentity.uid,
        firebaseIdentity.email,
        firebaseIdentity.name,
        firebaseIdentity.picture
      );
    }

    if (!dbUser) {
      return res.status(401).json({ error: 'Unauthorized: Account not found' });
    }

    if (dbUser.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact your administrator.' });
    }

    let school: DbSchool | null = null;
    if (dbUser.schoolId) {
      const foundSchool = await db
        .select()
        .from(schools)
        .where(eq(schools.id, dbUser.schoolId))
        .limit(1);
      if (foundSchool[0]) {
        const synced = await syncSchoolSubscriptionStatus(foundSchool[0]);
        school = synced.school;
      }
      if (school && school.subscriptionStatus === 'suspended' && dbUser.role !== 'super_admin') {
        return res.status(403).json({
          error: 'School subscription is currently suspended. Contact EDUSMART support.',
        });
      }
    }

    req.dbUser = dbUser;
    req.school = school;
    next();
  } catch (syncError: any) {
    console.error('Authentication database synchronization failed:', syncError);
    return res.status(500).json({
      error: `Account synchronization failed: ${syncError?.message || 'Internal database error'}`,
    });
  }
};

export const requireSchool = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.dbUser?.schoolId || !req.school) {
    return res.status(403).json({ error: 'School profile setup required before accessing workspace.' });
  }
  next();
};

export const requireActiveSubscription = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.dbUser?.role === 'super_admin') {
    return next();
  }
  if (!req.school) {
    return res.status(403).json({ error: 'School profile required.' });
  }
  const state = computeTrialAndSubscriptionState(req.school);
  if (!state.hasSubscriberAccess) {
    return res.status(402).json({
      code: 'SUBSCRIPTION_EXPIRED',
      error:
        'Votre essai gratuit de 30 jours ou votre abonnement a expiré. Veuillez choisir et activer un forfait pour continuer.',
      subscriptionState: state,
    });
  }
  next();
};

export const requireActiveSubscriptionForWrites = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  return requireActiveSubscription(req, res, next);
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }
    next();
  };
};
