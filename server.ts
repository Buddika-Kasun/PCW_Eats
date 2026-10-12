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

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Request body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS support for local machine network access (e.g. tablet POS terminals & MB360 device)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Logging middleware in dev
  if (!isProduction) {
    app.use((req, res, next) => {
      if (req.url.startsWith('/api')) {
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
      }
      next();
    });
  }

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

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`====================================================`);
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
