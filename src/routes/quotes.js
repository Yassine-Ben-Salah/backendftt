import { Router } from 'express';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { pool } from '../db/pool.js';

const router = Router();
const quoteSchema = z.object({
  productId: z.preprocess((value) => value === '' || value === null ? null : value, z.coerce.number().int().positive().nullable().optional()),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(6).max(40),
  quantity: z.preprocess((value) => typeof value !== 'string' || !value.trim() ? 'Non précisée' : value, z.string().trim().max(100)),
  message: z.string().trim().max(2000).default('')
});

async function sendNotification(quote, productName) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_TO) {
    console.warn('SMTP non configuré : notification de demande non envoyée.');
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.SMTP_TO,
    replyTo: quote.email,
    subject: `Nouvelle demande d’information - ${quote.name}`,
    text: `Client : ${quote.name}\nE-mail : ${quote.email}\nTéléphone : ${quote.phone}\nProduit : ${productName || 'Non précisé'}\nQuantité : ${quote.quantity}\nMessage : ${quote.message || 'Aucun message'}`
  });
  return true;
}

router.post('/', async (req, res, next) => {
  try {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Veuillez vérifier les champs du formulaire.', details: parsed.error.flatten().fieldErrors });
    const quote = parsed.data;
    let productName = null;
    if (quote.productId) {
      const product = await pool.query('SELECT name FROM products WHERE id = $1 AND is_active = TRUE', [quote.productId]);
      if (!product.rows[0]) return res.status(400).json({ error: 'Le produit sélectionné est indisponible.' });
      productName = product.rows[0].name;
    }
    const result = await pool.query(`
      INSERT INTO quote_requests (product_id, name, company, email, phone, quantity, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [quote.productId || null, quote.name, 'Particulier', quote.email.toLowerCase(), quote.phone, quote.quantity, quote.message]);
    let emailSent = false;
    try {
      emailSent = await sendNotification(quote, productName);
    } catch (mailError) {
      console.error('Notification e-mail échouée :', mailError.message);
    }
    return res.status(201).json({ message: 'Votre demande a bien été enregistrée.', id: result.rows[0].id, emailSent });
  } catch (error) {
    return next(error);
  }
});

export default router;
