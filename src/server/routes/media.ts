import crypto from 'node:crypto';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { mediaFiles } from '../../db/schema.ts';
import { AuthRequest, requireAuth, requireRole, requireSchool } from '../../middleware/auth.ts';

const router = Router();

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024; // 2MB decoded limit

// Upload validated & cropped image to persistent storage
router.post(
  '/upload',
  requireAuth,
  requireSchool,
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const { dataUrl, ownerType = 'photo' } = req.body || {};
      const raw = String(dataUrl || '').trim();

      const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(raw);
      if (!match) {
        return res.status(400).json({
          error: 'Invalid image format. Please upload a valid JPEG, PNG, or WEBP photo.',
        });
      }

      const rawMime = match[1].toLowerCase();
      const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
      if (!ALLOWED_MIME.has(rawMime)) {
        return res.status(400).json({
          error: 'Unsupported image format. Allowed formats: JPEG, PNG, WEBP.',
        });
      }

      const base64Payload = match[2];
      const buffer = Buffer.from(base64Payload, 'base64');
      if (buffer.length < 100) {
        return res.status(400).json({ error: 'Uploaded photo appears empty or corrupted.' });
      }
      if (buffer.length > MAX_BYTES) {
        return res.status(400).json({
          error: 'Image file size exceeds the 2MB limit. Please crop or choose a smaller image.',
        });
      }

      const safeOwner = ['student', 'teacher', 'school_logo', 'photo'].includes(String(ownerType))
        ? String(ownerType)
        : 'photo';

      const publicToken = crypto.randomBytes(18).toString('hex');

      const [stored] = await db
        .insert(mediaFiles)
        .values({
          schoolId,
          publicToken,
          ownerType: safeOwner,
          mimeType,
          sizeBytes: buffer.length,
          dataBase64: base64Payload,
        })
        .returning({
          id: mediaFiles.id,
          publicToken: mediaFiles.publicToken,
          mimeType: mediaFiles.mimeType,
          sizeBytes: mediaFiles.sizeBytes,
        });

      res.status(201).json({
        id: stored.id,
        token: stored.publicToken,
        url: `/api/media/${stored.publicToken}`,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      });
    } catch (error) {
      console.error('Media upload error:', error);
      res.status(500).json({ error: 'Failed to store uploaded photo.' });
    }
  }
);

// Publicly stream image bytes by unguessable publicToken (for ID card rendering & QR verification page)
router.get('/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
      return res.status(404).end();
    }

    const found = await db
      .select({
        mimeType: mediaFiles.mimeType,
        dataBase64: mediaFiles.dataBase64,
      })
      .from(mediaFiles)
      .where(eq(mediaFiles.publicToken, token))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).end();
    }

    const buffer = Buffer.from(found[0].dataBase64, 'base64');
    res.setHeader('Content-Type', found[0].mimeType || 'image/jpeg');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (error) {
    console.error('Media serve error:', error);
    res.status(500).end();
  }
});

export default router;
