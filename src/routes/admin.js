import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) return callback(Object.assign(new Error('Format image non accepté.'), { status: 400 }));
    return callback(null, true);
  }
});
const productSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category_id: z.coerce.number().int().positive(),
  format: z.string().trim().min(1).max(100),
  description: z.string().trim().min(10).max(3000),
  safety_note: z.string().trim().max(1200).nullable().optional(),
  image_url: z.string().trim().max(1000).nullable().optional(),
  is_active: z.boolean().optional()
});
const statusSchema = z.object({ status: z.enum(['new', 'contacted', 'closed']) });

router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name FROM products p
      JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC
    `);
    return res.json(rows);
  } catch (error) { return next(error); }
});

router.post('/products', requireAdmin, async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Données produit invalides.', details: parsed.error.flatten().fieldErrors });
    const p = parsed.data;
    const { rows } = await pool.query(`
      INSERT INTO products (name, slug, category_id, format, description, safety_note, image_url, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [p.name, p.slug, p.category_id, p.format, p.description, p.safety_note || null, p.image_url || null, p.is_active ?? true]);
    return res.status(201).json(rows[0]);
  } catch (error) { return next(error); }
});

router.put('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Données produit invalides.', details: parsed.error.flatten().fieldErrors });
    const p = parsed.data;
    const { rows } = await pool.query(`
      UPDATE products SET name=$1, slug=$2, category_id=$3, format=$4, description=$5,
        safety_note=$6, image_url=$7, is_active=$8
      WHERE id=$9 RETURNING *
    `, [p.name, p.slug, p.category_id, p.format, p.description, p.safety_note || null, p.image_url || null, p.is_active ?? true, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Produit introuvable.' });
    return res.json(rows[0]);
  } catch (error) { return next(error); }
});

router.delete('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Produit introuvable.' });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.post('/upload', requireAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(503).json({ error: 'Le stockage des images n’est pas configuré sur le serveur.' });
  }
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: 'food-transfert/products',
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif']
      }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(req.file.buffer);
    });
    return res.status(201).json({ image_url: result.secure_url });
  } catch (error) {
    console.error('Échec du téléversement Cloudinary :', error.message);
    return res.status(502).json({ error: 'Le téléversement a échoué. Réessayez.' });
  }
});

router.get('/quotes', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status;
    const validStatus = ['new', 'contacted', 'closed'].includes(status) ? status : null;
    const { rows } = await pool.query(`
      SELECT q.id, q.product_id, q.name, q.email, q.phone, q.quantity, q.message,
        q.status, q.created_at, p.name AS product_name FROM quote_requests q
      LEFT JOIN products p ON p.id = q.product_id
      WHERE ($1::text IS NULL OR q.status = $1) ORDER BY q.created_at DESC
    `, [validStatus]);
    return res.json(rows);
  } catch (error) { return next(error); }
});

router.patch('/quotes/:id', requireAdmin, async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Statut invalide.' });
    const { rows } = await pool.query('UPDATE quote_requests SET status=$1 WHERE id=$2 RETURNING *', [parsed.data.status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Demande introuvable.' });
    return res.json(rows[0]);
  } catch (error) { return next(error); }
});

router.delete('/quotes/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM quote_requests WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Demande introuvable.' });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

export default router;
