/**
 * ============================================================================
 * PCW Eats Full-Stack Server Entry Point (server.ts)
 * ============================================================================
 * 
 * Architecture:
 * - Express.js backend server handling REST API routes and hardware integration.
 * - Vite dev server middleware mounted in development mode (`npm run dev`).
 * - Serves optimized production build from `dist/` in production mode.
 * - Runs on Port 3000 (binds to 0.0.0.0 for container and local network access).
 * 
 * Hardware Integration:
 * - Mounts the ZKTeco MB360 biometric reader service at `/api/zkteco`.
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { db } from './server/db/store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  }));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  }));

  app.use(morgan(isProduction ? 'combined' : 'dev'));

  // Request body parsing middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.originalUrl.startsWith('/api')) {
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        db.persistState();
        return originalJson(body as any);
      }) as typeof res.json;
    }
    next();
  });

  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json') && req.body !== undefined && typeof req.body !== 'object') {
        res.status(400).json({ success: false, message: 'JSON body must be an object.' });
        return;
      }
    }
    next();
  });

  // Mount central API router under /api
  app.use('/api', apiRouter);

  // Frontend integration: Vite middleware in development, static dist in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route not found: ${req.originalUrl}`,
    });
  });

  app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`Request error on ${req.method} ${req.originalUrl}:`, err);
    res.status(err.status || 500).json({
      success: false,
      message: isProduction ? 'Something went wrong.' : err.message,
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`🚀 PCW Eats Server running on http://localhost:${PORT}`);
    console.log(`📡 API Endpoints live at http://localhost:${PORT}/api`);
    console.log(`🫆 ZKTeco MB360 Bridge online at /api/zkteco`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
