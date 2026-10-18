import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      format TEXT NOT NULL DEFAULT 'Nous consulter',
      description TEXT NOT NULL,
      safety_note TEXT,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS quote_requests (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      quantity TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    UPDATE products SET format = 'Nous consulter' WHERE format = 'À confirmer sur devis';
    UPDATE products
    SET description = CASE
      WHEN slug = 'soude-caustique-en-paillettes' THEN 'La soude caustique en paillettes est un produit très corrosif. Consultez sa fiche de données de sécurité avant toute utilisation ; conserver au sec dans son emballage scellé, hors de portée des enfants.'
      ELSE regexp_replace(description, ' ?(Son format de [0-9]+ kg est |Le bidon de [0-9]+ kg est |Conditionné en vrac, il est |)pratique et économique pour les professionnels comme pour les gros consommateurs\\.?', '', 'gi')
    END
    WHERE description ~* 'professionnels|gros consommateurs|nettoyage industriel|usages industriels|personnel formé'
  `);
}
