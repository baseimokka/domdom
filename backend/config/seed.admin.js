// backend/config/seed.admin.js
// PRODUCTION seed — creates the admin user and the homepage category cards.
// Does NOT insert sample products: add your own products via the admin panel.
//
// Run once on the server:  node config/seed.admin.js
//
// Reads credentials from the environment (set these in backend/.env):
//   ADMIN_EMAIL     (default: admin@domdom.com)
//   ADMIN_PASSWORD  (REQUIRED — no insecure default in production)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

// Homepage category cards (the "Categories" section). Images live in
// frontend/images/ and are tracked in git. Edit titles/images later in the admin panel.
const HOME_CATS = [
  { title: 'Lips',     subtitle: 'Lipsticks, Glosses & Liners', image: '/images/cat-lips.jpg',     linkCategory: 'lips' },
  { title: 'Eyes',     subtitle: 'Palettes, Liners & Mascara',  image: '/images/cat-eyes.jpg',     linkCategory: 'eyes' },
  { title: 'Face',     subtitle: 'Foundation, Blush & Contour',  image: '/images/cat-face.jpg',     linkCategory: 'face' },
  { title: 'Skincare', subtitle: 'Serums, Creams & SPF',        image: '/images/cat-skincare.jpg', linkCategory: 'skincare' }
];

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@domdom.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 8) {
    console.error('❌ ADMIN_PASSWORD must be set in .env (min 8 characters) before seeding the admin.');
    process.exit(1);
  }

  // ── Admin user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✅ Admin already exists (${email}) — skipping.`);
  } else {
    await prisma.user.create({
      data: { name: 'Admin', email, password: await bcrypt.hash(password, 12), role: 'admin' }
    });
    console.log(`✅ Admin created: ${email}`);
  }

  // ── Homepage category cards (only if none exist)
  const homeCatCount = await prisma.homepageCategory.count();
  if (homeCatCount > 0) {
    console.log(`✅ ${homeCatCount} homepage categories already exist — skipping.`);
  } else {
    for (let i = 0; i < HOME_CATS.length; i++) {
      await prisma.homepageCategory.create({ data: { ...HOME_CATS[i], order: i, active: true } });
    }
    console.log(`✅ ${HOME_CATS.length} homepage categories created`);
  }

  console.log('🔐 Log in at /pages/admin.html and add your products.');
}

seedAdmin()
  .catch(err => { console.error('❌ Admin seed failed:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
