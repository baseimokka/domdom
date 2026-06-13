// backend/config/seed.mysql.js
// Run once: node config/seed.mysql.js   (MySQL / Prisma equivalent of seed.js)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

const SAMPLE_PRODUCTS = [
  { name: 'Velvet Matte Lipstick', brand: 'DomDom', category: 'lips', price: 24.99, badge: 'bestseller', emoji: '💄', stock: 45, lowStockThreshold: 10, sku: 'DD-LIP-001',
    description: 'Long-lasting velvet matte finish that keeps lips moisturized all day. Our best-selling lipstick in 12 stunning shades.',
    details: ['12 hour wear', 'Moisturizing formula', '12 shades available', 'Cruelty-free & vegan'],
    colors: [ { name: 'Classic Red', hex: '#C8506E', images: [] }, { name: 'Deep Plum', hex: '#8B2E47', images: [] }, { name: 'Dusty Rose', hex: '#E8899A', images: [] }, { name: 'Nude Pink', hex: '#F4C5CB', images: [] } ] },
  { name: 'Smokey Eye Palette', brand: 'DomDom', category: 'eyes', price: 42.00, badge: 'new', emoji: '✨', stock: 30, lowStockThreshold: 8, sku: 'DD-EYE-001',
    description: '18-shade palette for endless smokey eye looks from day to night. Includes matte, shimmer and glitter finishes.',
    details: ['18 shades', 'Matte + shimmer + glitter', 'Mirror included', 'Long-lasting'],
    colors: [ { name: 'Smokey Neutrals', hex: '#2A2323', images: [] }, { name: 'Purple Haze', hex: '#9B7EC8', images: [] } ] },
  { name: 'Glow Foundation SPF30', brand: 'DomDom', category: 'face', price: 28.99, oldPrice: 38.00, badge: 'sale', emoji: '🌟', stock: 7, lowStockThreshold: 10, sku: 'DD-FAC-001',
    description: 'Lightweight buildable coverage with SPF30 for a natural glow finish. Suitable for all skin types.',
    details: ['SPF 30 protection', 'Buildable coverage', '20 shade range', 'All skin types'],
    colors: [ { name: 'Ivory', hex: '#F4D6DF', images: [] }, { name: 'Golden Beige', hex: '#E8C47A', images: [] }, { name: 'Warm Sand', hex: '#C4A882', images: [] }, { name: 'Espresso', hex: '#8B6455', images: [] } ] },
  { name: 'Rose Hydration Serum', brand: 'DomDom', category: 'skincare', price: 54.00, badge: null, emoji: '🌹', stock: 22, lowStockThreshold: 5, sku: 'DD-SKN-001',
    description: 'Concentrated rose extract serum for deep hydration and luminous skin. Visible results in 2 weeks.',
    details: ['Pure rose extract', 'Deep hydration', 'All skin types', 'Fragrance-free'],
    colors: [ { name: 'Rose', hex: '#F4D6DF', images: [] } ] },
  { name: 'Precision Liquid Liner', brand: 'DomDom', category: 'eyes', price: 18.50, badge: null, emoji: '🖊️', stock: 80, lowStockThreshold: 15, sku: 'DD-EYE-002',
    description: 'Ultra-fine tip for perfect cat-eye lines. 24-hour waterproof and smudge-proof formula.',
    details: ['Ultra-fine tip', '24hr waterproof', 'Smudge-proof', 'Intense black'],
    colors: [ { name: 'Jet Black', hex: '#2A2323', images: [] }, { name: 'Navy', hex: '#534AB7', images: [] } ] },
  { name: 'Plump Gloss Tint', brand: 'DomDom', category: 'lips', price: 19.99, badge: 'new', emoji: '💋', stock: 55, lowStockThreshold: 10, sku: 'DD-LIP-002',
    description: 'Plumping lip gloss with hyaluronic acid for fuller-looking lips.',
    details: ['Plumping effect', 'Hyaluronic acid', 'Sheer tint', 'Glossy finish'],
    colors: [ { name: 'Berry Gloss', hex: '#C8506E', images: [] }, { name: 'Baby Pink', hex: '#F4C5CB', images: [] } ] },
  { name: 'Blush & Bronzer Duo', brand: 'DomDom', category: 'face', price: 32.00, badge: null, emoji: '🌸', stock: 38, lowStockThreshold: 8, sku: 'DD-FAC-002',
    description: 'Perfectly paired blush and bronzer for a sun-kissed sculpted look.',
    details: ['2-in-1 compact', 'Silky formula', 'Easy blending', 'Travel-friendly'],
    colors: [ { name: 'Peachy Glow', hex: '#E8C47A', images: [] } ] },
  { name: 'Vitamin C Brightening Cream', brand: 'DomDom', category: 'skincare', price: 35.00, oldPrice: 48.00, badge: 'sale', emoji: '🍊', stock: 0, lowStockThreshold: 5, sku: 'DD-SKN-002',
    description: 'Daily brightening cream with 15% Vitamin C to reduce dark spots.',
    details: ['15% Vitamin C', 'Reduces dark spots', 'Daily moisturizer', 'Brightening'],
    colors: [ { name: 'Citrus', hex: '#F0E3B8', images: [] } ] }
];

async function seed() {
  // ── Admin user
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@domdom.com' } });
  if (existingAdmin) {
    console.log('✅ Admin already exists — skipping admin creation');
  } else {
    await prisma.user.create({
      data: { name: 'Admin', email: 'admin@domdom.com', password: await bcrypt.hash('password123', 12), role: 'admin' }
    });
    console.log('✅ Admin created: admin@domdom.com / password123');
  }

  // ── Sample products (only if none exist)
  const productCount = await prisma.product.count();
  if (productCount > 0) {
    console.log(`✅ ${productCount} products already in database — skipping product seed`);
  } else {
    for (const p of SAMPLE_PRODUCTS) {
      const { colors, ...rest } = p;
      await prisma.product.create({
        data: {
          ...rest,
          oldPrice: rest.oldPrice ?? null,
          colors: { create: colors.map((c, i) => ({ name: c.name, hex: c.hex, images: c.images, sortOrder: i })) }
        }
      });
    }
    console.log(`✅ ${SAMPLE_PRODUCTS.length} sample products created`);
  }

  // ── Homepage category cards (only if none exist)
  const homeCatCount = await prisma.homepageCategory.count();
  if (homeCatCount > 0) {
    console.log(`✅ ${homeCatCount} homepage categories already exist — skipping`);
  } else {
    const HOME_CATS = [
      { title: 'Lips',     subtitle: 'Lipsticks, Glosses & Liners',  image: '/images/cat-lips.jpg',     linkCategory: 'lips' },
      { title: 'Eyes',     subtitle: 'Palettes, Liners & Mascara',   image: '/images/cat-eyes.jpg',     linkCategory: 'eyes' },
      { title: 'Face',     subtitle: 'Foundation, Blush & Contour',  image: '/images/cat-face.jpg',     linkCategory: 'face' },
      { title: 'Skincare', subtitle: 'Serums, Creams & SPF',         image: '/images/cat-skincare.jpg', linkCategory: 'skincare' }
    ];
    for (let i = 0; i < HOME_CATS.length; i++) {
      await prisma.homepageCategory.create({ data: { ...HOME_CATS[i], order: i, active: true } });
    }
    console.log(`✅ ${HOME_CATS.length} homepage categories created`);
  }

  console.log('\n🌸 MySQL database ready! Start server with: npm start\n');
}

seed()
  .catch(err => { console.error('❌ Seed failed:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
