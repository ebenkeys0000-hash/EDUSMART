import crypto from 'node:crypto';
import { getServerFirebaseConfig } from './firebase-config-server.ts';

const getSigningSecret = (): string => {
  if (process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.length >= 16) {
    return process.env.AUTH_SESSION_SECRET;
  }
  const firebaseConfig = getServerFirebaseConfig();
  return crypto
    .createHash('sha256')
    .update(`edusmart:${firebaseConfig.projectId}:${firebaseConfig.appId}`)
    .digest('hex');
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export interface AppTokenPayload {
  uid: string;
  userId: number;
  email: string;
  exp: number;
}

export function signAppToken(payload: Omit<AppTokenPayload, 'exp'>, ttlHours = 72): string {
  const fullPayload: AppTokenPayload = {
    ...payload,
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `esm.${encoded}.${sig}`;
}

export function verifyAppToken(token: string): AppTokenPayload | null {
  if (!token.startsWith('esm.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AppTokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateCode(length = 6): string {
  const digits = '0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += digits[crypto.randomInt(0, digits.length)];
  }
  return out;
}
