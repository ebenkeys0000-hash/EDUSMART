import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { announcements, supportRequests } from '../../db/schema.ts';
import {
  AuthRequest,
  requireActiveSubscription,
  requireAuth,
  requireRole,
  requireSchool,
} from '../../middleware/auth.ts';
import { logActivity } from '../helpers.ts';

const router = Router();
router.use(requireAuth, requireSchool);

// List school announcements
router.get('/announcements', async (req: AuthRequest, res) => {
  try {
    const schoolId = req.school!.id;
    const role = req.dbUser!.role;

    const all = await db
      .select()
      .from(announcements)
      .where(eq(announcements.schoolId, schoolId))
      .orderBy(desc(announcements.id));

    const filtered = all.filter((a) => {
      if (role === 'school_admin' || role === 'super_admin') return true;
      if (a.audience === 'all') return true;
      if (role === 'teacher' && a.audience === 'teachers') return true;
      if (role === 'parent' && a.audience === 'parents') return true;
      if (role === 'student' && a.audience === 'students') return true;
      return false;
    });

    res.json({ items: filtered });
  } catch (error) {
    console.error('List announcements error:', error);
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

// Create announcement / event (with email & SMS integration readiness)
router.post(
  '/announcements',
  requireActiveSubscription,
  requireRole(['school_admin', 'super_admin', 'teacher']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const {
        title,
        content,
        audience = 'all',
        channel = 'portal',
        eventDate = '',
        priority = 'normal',
      } = req.body || {};

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and message content are required.' });
      }

      const [created] = await db
        .insert(announcements)
        .values({
          schoolId,
          title: String(title).trim(),
          content: String(content).trim(),
          audience: String(audience),
          channel: String(channel),
          eventDate: String(eventDate),
          priority: String(priority),
          authorName: req.dbUser!.fullName,
        })
        .returning();

      await logActivity(
        schoolId,
        req.dbUser!.fullName,
        'Communication',
        'announcement',
        `${created.title} (${created.audience})`
      );

      res.status(201).json({ announcement: created });
    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({ error: 'Failed to publish announcement.' });
    }
  }
);

// Delete announcement
router.delete(
  '/announcements/:id',
  requireActiveSubscription,
  requireRole(['school_admin', 'super_admin']),
  async (req: AuthRequest, res) => {
    try {
      const schoolId = req.school!.id;
      const id = Number(req.params.id);
      await db
        .delete(announcements)
        .where(and(eq(announcements.id, id), eq(announcements.schoolId, schoolId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({ error: 'Failed to delete announcement.' });
    }
  }
);

// Submit support request to EDUSMART platform team
router.post('/support', async (req: AuthRequest, res) => {
  try {
    const { subject, message } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }
    const [created] = await db
      .insert(supportRequests)
      .values({
        schoolId: req.school!.id,
        userId: req.dbUser!.id,
        schoolName: req.school!.name,
        requesterEmail: req.dbUser!.email,
        subject: String(subject).trim(),
        message: String(message).trim(),
        status: 'open',
      })
      .returning();

    res.status(201).json({ request: created });
  } catch (error) {
    console.error('Support request error:', error);
    res.status(500).json({ error: 'Failed to submit support request.' });
  }
});

export default router;
