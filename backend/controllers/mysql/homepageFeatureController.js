// backend/controllers/mysql/homepageFeatureController.js  (MySQL / Prisma)
// Curates the homepage "Best Sellers" and "New Arrivals" product rows.
// When a section has no curated picks yet, it falls back to a sensible
// automatic selection so the homepage is never empty.
const prisma = require('../../config/prisma');
const { mapProduct } = require('../../data/map');

const SECTIONS = ['bestsellers', 'new-arrivals'];
const DEFAULT_MAX = 8;

function maxKey(section) { return `homepage_${section}_max`; }

async function getMax(section) {
  const row = await prisma.setting.findUnique({ where: { key: maxKey(section) } });
  const n = parseInt(row?.value, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX;
}

// Lightweight product summary for the admin list
function productSummary(p) {
  return {
    _id:      p.id,
    name:     p.name,
    brand:    p.brand,
    category: p.category,
    price:    p.price,
    badge:    p.badge,
    active:   p.active,
    stock:    p.stock,
    image:    p.colors?.[0]?.images?.[0] || null,
    emoji:    p.emoji
  };
}

// Auto fallback selection when nothing is curated for a section
async function autoProducts(section, max) {
  const orderBy = section === 'new-arrivals'
    ? { createdAt: 'desc' }
    : [{ reviewCount: 'desc' }, { rating: 'desc' }];
  const rows = await prisma.product.findMany({
    where: { active: true },
    include: { colors: true },
    orderBy,
    take: max
  });
  return rows.map(mapProduct);
}

// GET /api/homepage/:section  (public)
exports.getSectionPublic = async (req, res) => {
  try {
    const { section } = req.params;
    if (!SECTIONS.includes(section)) return res.status(404).json({ error: 'Unknown section' });

    const max = await getMax(section);
    const features = await prisma.homepageFeature.findMany({
      where: { section, active: true, product: { active: true } },
      include: { product: { include: { colors: true } } },
      orderBy: { order: 'asc' },
      take: max
    });

    if (features.length) {
      return res.json({ success: true, products: features.map(f => mapProduct(f.product)), curated: true, max });
    }
    // Fallback — keep the section populated out of the box
    const products = await autoProducts(section, max);
    res.json({ success: true, products, curated: false, max });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/admin/homepage/:section  (admin)
exports.getSectionAdmin = async (req, res) => {
  try {
    const { section } = req.params;
    if (!SECTIONS.includes(section)) return res.status(404).json({ error: 'Unknown section' });

    const [features, max] = await Promise.all([
      prisma.homepageFeature.findMany({
        where: { section },
        include: { product: { include: { colors: true } } },
        orderBy: { order: 'asc' }
      }),
      getMax(section)
    ]);

    const items = features.map(f => ({
      _id:     f.id,
      section: f.section,
      order:   f.order,
      active:  f.active,
      product: f.product ? productSummary(f.product) : null
    }));
    res.json({ success: true, items, max });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/admin/homepage/:section  (admin)  body: { productId }
exports.addFeature = async (req, res) => {
  try {
    const { section } = req.params;
    if (!SECTIONS.includes(section)) return res.status(404).json({ error: 'Unknown section' });
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = await prisma.homepageFeature.findUnique({
      where: { section_productId: { section, productId } }
    });
    if (existing) return res.status(409).json({ error: 'Product already in this section' });

    const last = await prisma.homepageFeature.findFirst({
      where: { section }, orderBy: { order: 'desc' }
    });
    const feature = await prisma.homepageFeature.create({
      data: { section, productId, order: (last?.order ?? -1) + 1, active: true }
    });
    res.status(201).json({ success: true, feature: { _id: feature.id } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// DELETE /api/admin/homepage/:section/:id  (admin)
exports.removeFeature = async (req, res) => {
  try {
    const feature = await prisma.homepageFeature.findUnique({ where: { id: req.params.id } });
    if (!feature) return res.status(404).json({ error: 'Item not found' });
    await prisma.homepageFeature.delete({ where: { id: feature.id } });
    res.json({ success: true, message: 'Removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PATCH /api/admin/homepage/:section/:id/toggle  (admin)
exports.toggleFeature = async (req, res) => {
  try {
    const feature = await prisma.homepageFeature.findUnique({ where: { id: req.params.id } });
    if (!feature) return res.status(404).json({ error: 'Item not found' });
    const updated = await prisma.homepageFeature.update({
      where: { id: feature.id }, data: { active: !feature.active }
    });
    res.json({ success: true, active: updated.active });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PATCH /api/admin/homepage/:section/reorder  (admin)  body: { items:[{id,order}] }
exports.reorderFeatures = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    await Promise.all(
      items.map(({ id, order }) =>
        prisma.homepageFeature.update({ where: { id }, data: { order: parseInt(order) || 0 } }).catch(() => {})
      )
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PUT /api/admin/homepage/:section/max  (admin)  body: { max }
exports.setMax = async (req, res) => {
  try {
    const { section } = req.params;
    if (!SECTIONS.includes(section)) return res.status(404).json({ error: 'Unknown section' });
    const max = parseInt(req.body.max, 10);
    if (!Number.isFinite(max) || max < 1) return res.status(400).json({ error: 'max must be a positive number' });

    await prisma.setting.upsert({
      where:  { key: maxKey(section) },
      update: { value: String(max) },
      create: { key: maxKey(section), value: String(max), label: `Homepage ${section} max` }
    });
    res.json({ success: true, max });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
