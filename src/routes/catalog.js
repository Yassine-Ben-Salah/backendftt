import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, slug FROM categories ORDER BY id');
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const values = [];
    const conditions = ['p.is_active = TRUE'];
    if (category) {
      values.push(category);
      conditions.push(`c.slug = $${values.length}`);
    }
    if (search) {
      values.push(`%${String(search).slice(0, 100)}%`);
      conditions.push(`p.name ILIKE $${values.length}`);
    }
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.slug, p.format, p.description, p.safety_note,
        p.image_url, p.is_active, p.created_at, c.name AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE ${conditions.join(' AND ')} ORDER BY p.created_at DESC, p.name
    `, values);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get('/products/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.slug, p.format, p.description, p.safety_note, p.image_url,
        c.name AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.slug = $1 AND p.is_active = TRUE
    `, [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Produit introuvable.' });
    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

export default router;
