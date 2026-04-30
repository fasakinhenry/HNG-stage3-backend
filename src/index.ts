import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDatabase } from './config/database';
import { config } from './config/env';
import { requestLogger } from './middleware/logger';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profiles.routes';
import userRoutes from './routes/users.routes';

const app = express();
// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['X-API-Version'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/users', userRoutes);

// Legacy v1 routes for backwards compatibility
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/users', userRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await connectDatabase();
  app.listen(config.port, () => {
    console.log(`🚀 Insighta Labs+ API running on http://localhost:${config.port}`);
    console.log(`📦 API Base: http://localhost:${config.port}/api/v1`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
