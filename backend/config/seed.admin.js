// backend/config/seed.admin.js
// PRODUCTION seed — creates ONLY the admin user. No sample products, no
// homepage category cards. Add your own products/categories via the admin panel.
//
// Run once on the server:  node config/seed.admin.js
//
// Reads credentials from the environment (set these in backend/.env):
//   ADMIN_EMAIL     (default: admin@domdom.com)
//   ADMIN_PASSWORD  (REQUIRED — no insecure default in production)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@domdom.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 8) {
    console.error('❌ ADMIN_PASSWORD must be set in .env (min 8 characters) before seeding the admin.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✅ Admin already exists (${email}) — skipping. Delete the user first if you need to reset it.`);
    return;
  }

  await prisma.user.create({
    data: { name: 'Admin', email, password: await bcrypt.hash(password, 12), role: 'admin' }
  });
  console.log(`✅ Admin created: ${email}`);
  console.log('🔐 Log in at /pages/admin.html and add your products.');
}

seedAdmin()
  .catch(err => { console.error('❌ Admin seed failed:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
