import '../env.js';
import bcrypt from 'bcryptjs';
import { ensureSchema, pool } from './pool.js';

const categories = [
  { name: 'Produits alimentaires', slug: 'produits-alimentaires' },
  { name: 'Acides', slug: 'acides' },
  { name: 'Produits chimiques', slug: 'produits-chimiques' }
];

const products = [
  {
    name: 'Lait en poudre', slug: 'lait-en-poudre', category: 'produits-alimentaires', format: 'Sac de 25 kg',
    description: 'Idéal pour la pâtisserie, il apporte une texture moelleuse et une saveur lactée aux gâteaux et desserts. Facile à doser, il se dissout rapidement et s’intègre aux recettes sucrées comme salées ; conserver au sec, dans son sac bien fermé.'
  },
  {
    name: 'Cacao en poudre Premium', slug: 'cacao-en-poudre-premium', category: 'produits-alimentaires', format: 'Sac de 25 kg',
    description: 'Idéal pour la pâtisserie, ce cacao premium apporte une couleur brun profond, un goût intense et de l’onctuosité aux gâteaux, crèmes, glaçages et desserts. Sa poudre fine se mélange facilement dans les boissons chaudes comme dans les recettes sucrées ; conserver au sec, sac refermé après usage.'
  },
  {
    name: 'Amidon de maïs', slug: 'amidon-de-mais', category: 'produits-alimentaires', format: 'Nous consulter',
    description: 'Idéal en pâtisserie et en cuisine, l’amidon de maïs épaissit crèmes, flans, sauces, soupes et desserts pour une texture lisse et onctueuse. Sa poudre neutre et facile à doser apporte aussi légèreté et moelleux aux gâteaux ; conserver au sec dans son emballage fermé.'
  },
  {
    name: 'Dextrose en poudre', slug: 'dextrose-en-poudre', category: 'produits-alimentaires', format: 'Nous consulter',
    description: 'Idéal en pâtisserie, boulangerie et glacerie, le dextrose apporte une douceur légère et améliore la texture des glaces, sorbets et crèmes. Il favorise aussi la coloration des viennoiseries et la fermentation ; sa poudre se dissout rapidement et se dose facilement. À conserver au sec et à l’abri de l’humidité.'
  },
  {
    name: 'Acide citrique en vrac', slug: 'acide-citrique-en-vrac', category: 'acides', format: 'Vrac',
    description: 'Idéal en pâtisserie, confiserie et préparation de boissons, l’acide citrique apporte une acidité franche et une note fraîche et citronnée. Il rehausse sirops, confitures et desserts, et convient aussi au nettoyage et au détartrage ; conserver au sec dans un emballage fermé.'
  },
  {
    name: 'Acide acétique glacial alimentaire (Food Grade)', slug: 'acide-acetique-glacial-alimentaire', category: 'acides', format: 'Bidon de 50 kg',
    description: 'De qualité alimentaire, l’acide acétique glacial convient à la préparation de vinaigres, sauces, cornichons et marinades. Très concentré, il s’utilise après dilution et apporte une acidité franche ; conserver au frais, dans un local ventilé et dans son bidon fermé.',
    safety_note: 'Produit corrosif : porter des gants résistants aux produits chimiques et des lunettes de protection. Garder le bidon hermétiquement fermé, à l’écart des enfants et des matières incompatibles. Manipuler uniquement selon la fiche de données de sécurité et les procédures du site.'
  },
  {
    name: 'Sorbate de potassium alimentaire', slug: 'sorbate-de-potassium-alimentaire', category: 'produits-chimiques', format: 'Nous consulter',
    description: 'Le sorbate de potassium alimentaire est un conservateur adapté aux pâtisseries, boissons, sauces et produits laitiers, selon la réglementation et le dosage applicables. Il aide à limiter le développement des moisissures et des levures sans altérer le goût ni la couleur ; il se dissout bien dans l’eau et se dose facilement. À conserver au sec et bien fermé.'
  },
  {
    name: 'Phosphate disodique anhydre (DSP) alimentaire', slug: 'phosphate-disodique-anhydre-dsp-alimentaire', category: 'produits-chimiques', format: 'Sac de 25 kg',
    description: 'De qualité alimentaire, le phosphate disodique anhydre (DSP) est utilisé dans les préparations, notamment en charcuterie, produits laitiers et pâtisserie. Régulateur d’acidité et émulsifiant, il aide à stabiliser les textures et à obtenir des préparations homogènes ; conserver au frais et au sec, sac bien refermé.'
  },
  {
    name: 'Soude caustique en paillettes (Caustic soda flakes)', slug: 'soude-caustique-en-paillettes', category: 'produits-chimiques', format: 'Nous consulter',
    description: 'La soude caustique en paillettes est un produit très corrosif. Consultez sa fiche de données de sécurité avant toute utilisation ; conserver au sec dans son emballage scellé, hors de portée des enfants.',
    safety_note: 'Produit corrosif : porter des gants résistants aux produits chimiques et des lunettes de protection. Garder l’emballage hermétiquement fermé, au sec et hors de portée des enfants. Éviter tout contact avec la peau et les yeux, et manipuler selon la fiche de données de sécurité.'
  }
];

async function seed() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans le fichier .env.');
  }
  await ensureSchema();
  const categoryIds = new Map();
  for (const category of categories) {
    const { rows } = await pool.query(`
      INSERT INTO categories (name, slug) VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id
    `, [category.name, category.slug]);
    categoryIds.set(category.slug, rows[0].id);
  }

  for (const product of products) {
    await pool.query(`
      INSERT INTO products (name, slug, category_id, format, description, safety_note)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, category_id=EXCLUDED.category_id,
        format=EXCLUDED.format, description=EXCLUDED.description, safety_note=EXCLUDED.safety_note
    `, [product.name, product.slug, categoryIds.get(product.category), product.format, product.description, product.safety_note || null]);
  }

  const email = process.env.ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await pool.query(`
    INSERT INTO admins (email, password_hash) VALUES ($1, $2)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `, [email, passwordHash]);
  console.log(`Seed terminé : ${categories.length} catégories, ${products.length} produits, administrateur ${email}.`);
}

seed().catch((error) => {
  console.error('Échec du seed :', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
