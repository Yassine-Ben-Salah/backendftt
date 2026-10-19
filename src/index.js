import './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureSchema, pool } from './db/pool.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import quoteRoutes from './routes/quotes.js';
import adminRoutes from './routes/admin.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
// Render proxies requests to the service; trust one hop so rate limits use the client IP.
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 4000);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(currentDir, '../uploads');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET doit être défini dans le fichier .env.');
app.use(helmet());
const configuredClientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === configuredClientOrigin || /^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', index: false }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/quotes', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', catalogRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }), authRoutes);
app.use('/api/admin', adminRoutes);
// Keep the compact admin API paths from the project brief available as well.
app.use('/api', adminRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use(notFound);
app.use(errorHandler);

await ensureSchema();
const server = app.listen(port, () => console.log(`API Food Transfert à l'écoute sur http://localhost:${port}`));

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
