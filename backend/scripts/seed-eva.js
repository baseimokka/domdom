// backend/scripts/seed-eva.js
// ---------------------------------------------------------------------------
// Seed the "Eva" brand catalogue (Body Splash + Body Care lines) into MySQL
// via Prisma. Does NOT touch existing Product CRUD.
//
// Run:  node backend/scripts/seed-eva.js
//
// Idempotent: a product is matched by (name + brand) before insert; if it
// already exists it is skipped, so the script is safe to re-run.
// ---------------------------------------------------------------------------

const path = require('path');
// Load env explicitly from backend/.env so DATABASE_URL resolves no matter
// which directory the script is launched from (the documented run command is
// executed from the project root). dotenv never overrides an already-set env.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../config/prisma');

const BRAND = 'Eva';
const MARKUP_RATE = 0.05; // keep in sync with backend/config/pricing.js

// The store applies applyMarkup(base) = ceil(base * 1.05) to every product's
// stored `price` at display AND order time (see backend/config/pricing.js).
// To make the customer see an exact target price we therefore store a REDUCED
// base that ceils back up to that target: floor(target / 1.05, 2 decimals).
//   e.g. target 188 -> base 179.04 -> ceil(179.04 * 1.05) = ceil(187.992) = 188
const baseFor = (target) => Math.floor((target / (1 + MARKUP_RATE)) * 100) / 100;

// ── Reusable copy templates (no per-product duplication of description/details)
const templates = {
  'Body Splash': {
    description:
      'A light, refreshing body splash that wraps your skin in a long-lasting ' +
      'signature scent. Formulated for everyday wear, it delivers an instant ' +
      'burst of freshness without feeling heavy or sticky.',
    details: [
      'Long-lasting, layerable fragrance',
      'Lightweight, fast-drying formula',
      'Refreshing mist for an instant lift',
      'Perfect for daily wear and on-the-go touch-ups',
    ],
  },
  'Body Serum': {
    description:
      'A fast-absorbing body care serum that deeply nourishes and smooths the ' +
      'skin. Enriched with lightweight conditioning agents, it leaves the body ' +
      'soft, supple and delicately scented.',
    details: [
      'Fast-absorbing, non-greasy formula',
      'Deeply hydrates and smooths skin texture',
      'Leaves a soft, radiant finish',
      'Subtle, long-lasting fragrance',
    ],
  },
  'Body Lotion': {
    description:
      'A rich yet lightweight body lotion that locks in moisture for all-day ' +
      'softness. Its silky formula absorbs quickly to leave skin nourished, ' +
      'smooth and lightly perfumed.',
    details: [
      '24-hour lasting hydration',
      'Silky, quick-absorbing texture',
      'Softens and conditions dry skin',
      'Delicately fragranced for a fresh finish',
    ],
  },
  'Shower Cream': {
    description:
      'A gentle, creamy shower cream that cleanses while caring for your skin. ' +
      'Its rich lather rinses away impurities and leaves the body feeling soft, ' +
      'clean and refreshed.',
    details: [
      'Gentle daily cleansing formula',
      'Rich, creamy lather',
      'Cleanses without stripping moisture',
      'Leaves skin soft and delicately scented',
    ],
  },
};

// ── Product groups: shared category / pricing / template + the item names.
// `suffix` is appended to each name so items that repeat across lines stay
// unique (and the name+brand duplicate check behaves correctly).
const groups = [
  {
    category: 'body-splash',
    template: 'Body Splash',
    suffix: '',
    target: 188,
    oldTarget: 220,
    items: [
      'In The Clouds', 'Gold Spell', 'Spring Lilies', 'Summer Twist', 'Red Glamour',
      'Love Tale', 'Mystic Orchid', 'Night Out', 'Cozy Dream', 'Morning Blossom',
    ],
  },
  {
    category: 'body-care',
    template: 'Body Serum',
    suffix: 'Body Serum',
    target: 145,
    oldTarget: 170,
    items: ['Cozy Dream', 'Morning Blossom', 'Summer Twist', 'Spring Lilies', 'In The Clouds'],
  },
  {
    category: 'body-care',
    template: 'Body Lotion',
    suffix: 'Body Lotion',
    target: 102,
    oldTarget: 120,
    items: ['Summer Twist', 'Gold Spell', 'In The Clouds', 'Tropical'],
  },
  {
    category: 'body-care',
    template: 'Shower Cream',
    suffix: 'Shower Cream',
    target: 85,
    oldTarget: 100,
    items: ['Summer Twist', 'Gold Spell', 'In The Clouds', 'Tropical'],
  },
];

// ── SKU generator — replicated from backend/controllers/mysql/productController.js
// so the seed produces the same clean, sequential DD-XXX-### scheme without
// importing controller code. Queries fresh each call, so numbering stays correct
// as products are created one at a time within this run.
const SKU_RE = /^(DD-[A-Z0-9]+)-(\d+)$/i;
async function generateSku(category) {
  const all = await prisma.product.findMany({ select: { sku: true, category: true } });

  // Adopt the prefix the category already uses, if any of its products have a parseable SKU
  let prefix = null;
  for (const p of all) {
    if (p.category !== category) continue;
    const m = (p.sku || '').match(SKU_RE);
    if (m) { prefix = m[1].toUpperCase(); break; }
  }
  if (!prefix) {
    const code = String(category || 'GEN').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
    prefix = `DD-${code}`;
  }

  // Next number = highest existing for this prefix + 1 (scan all SKUs to avoid collisions)
  const taken = new Set();
  let maxNum = 0;
  for (const p of all) {
    const sku = (p.sku || '').toUpperCase();
    taken.add(sku);
    const m = sku.match(SKU_RE);
    if (m && m[1] === prefix) maxNum = Math.max(maxNum, parseInt(m[2], 10));
  }

  let n = maxNum + 1, sku;
  do { sku = `${prefix}-${String(n++).padStart(3, '0')}`; } while (taken.has(sku.toUpperCase()));
  return sku;
}

async function seed() {
  let added = 0;
  let skipped = 0;

  for (const group of groups) {
    const tpl = templates[group.template];
    if (!tpl) throw new Error(`Missing template for group: ${group.template}`);

    for (const item of group.items) {
      const name = group.suffix ? `${item} ${group.suffix}` : item;

      // ── Duplicate protection: match on name + brand
      const existing = await prisma.product.findFirst({ where: { name, brand: BRAND } });
      if (existing) {
        console.log(`Skipped: ${name}`);
        skipped++;
        continue;
      }

      const sku = await generateSku(group.category);

      await prisma.product.create({
        data: {
          name,
          brand: BRAND,
          category: group.category,
          price: baseFor(group.target),
          oldPrice: baseFor(group.oldTarget),
          description: tpl.description,
          details: tpl.details,
          badge: null,
          emoji: '✨',
          sku,
          stock: 100,
          lowStockThreshold: 10,
          rating: 0,
          reviewCount: 0,
          active: true,
          colors: {
            create: [{ name: 'Default', hex: '', images: [], sortOrder: 0 }],
          },
        },
      });

      console.log(`Added:   ${name}  (${sku})`);
      added++;
    }
  }

  console.log('\n====================================\n');
  console.log(`Added: ${added}`);
  console.log('');
  console.log(`Skipped: ${skipped}`);
  console.log('');
  console.log('Finished Successfully');
  console.log('\n====================================');
}

seed()
  .catch((err) => {
    console.error('❌ Eva seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
