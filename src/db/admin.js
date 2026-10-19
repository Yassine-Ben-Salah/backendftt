import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

export async function syncAdminFromEnv() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email && !password) return;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must both be configured.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(`
    INSERT INTO admins (email, password_hash) VALUES ($1, $2)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `, [email, passwordHash]);
}
