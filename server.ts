import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './src/server/routes/auth.ts';
import schoolRoutes from './src/server/routes/school.ts';
import academicsRoutes from './src/server/routes/academics.ts';
import studentsRoutes from './src/server/routes/students.ts';
import teachersRoutes from './src/server/routes/teachers.ts';
import attendanceRoutes from './src/server/routes/attendance.ts';
import financeRoutes from './src/server/routes/finance.ts';
import examsRoutes from './src/server/routes/exams.ts';
import timetableRoutes from './src/server/routes/timetable.ts';
import payrollRoutes from './src/server/routes/payroll.ts';
import communicationRoutes from './src/server/routes/communication.ts';
import usersRoutes from './src/server/routes/users.ts';
import superadminRoutes from './src/server/routes/superadmin.ts';
import mediaRoutes from './src/server/routes/media.ts';
import idCardsRoutes from './src/server/routes/idCards.ts';
import subscriptionsRoutes from './src/server/routes/subscriptions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '5mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'edusmart' });
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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`EDUSMART server running on http://0.0.0.0:${port}`);
  });
}

startServer();
