import 'dotenv/config';
import express from 'express';
import { pool } from '../db/index.ts';
import { ensureDatabaseSchema } from '../db/bootstrapSchema.ts';
import authRoutes from './routes/auth.ts';
import schoolRoutes from './routes/school.ts';
import academicsRoutes from './routes/academics.ts';
import studentsRoutes from './routes/students.ts';
import teachersRoutes from './routes/teachers.ts';
import attendanceRoutes from './routes/attendance.ts';
import financeRoutes from './routes/finance.ts';
import examsRoutes from './routes/exams.ts';
import timetableRoutes from './routes/timetable.ts';
import payrollRoutes from './routes/payroll.ts';
import communicationRoutes from './routes/communication.ts';
import usersRoutes from './routes/users.ts';
import superadminRoutes from './routes/superadmin.ts';
import mediaRoutes from './routes/media.ts';
import idCardsRoutes from './routes/idCards.ts';
import subscriptionsRoutes from './routes/subscriptions.ts';

export function createApiApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Allow Firebase signInWithPopup to communicate cleanly across origins on Vercel & Cloud Run
  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  // Health & DB connectivity check
  app.get('/api/health', async (_req, res) => {
    try {
      await ensureDatabaseSchema();
      await pool.query('SELECT 1');
      res.json({ status: 'ok', service: 'edusmart', database: 'connected' });
    } catch (err: any) {
      console.error('Database health check failed:', err);
      res.status(503).json({
        status: 'degraded',
        service: 'edusmart',
        database: 'disconnected',
        error: err?.message || 'Database connection error',
      });
    }
  });

  // Ensure PostgreSQL schema exists before any API route runs (important for fresh Vercel DBs)
  app.use('/api', async (_req, res, next) => {
    try {
      await ensureDatabaseSchema();
      next();
    } catch (err: any) {
      console.error('Database initialization error:', err);
      res.status(503).json({
        error: 'Database unavailable. Check DATABASE_URL / SQL connection environment variables.',
      });
    }
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/academics', academicsRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/teachers', teachersRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/exams', examsRoutes);
  app.use('/api/timetables', timetableRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/communication', communicationRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/superadmin', superadminRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/id-cards', idCardsRoutes);

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl || req.url}`,
    });
  });

  return app;
}
