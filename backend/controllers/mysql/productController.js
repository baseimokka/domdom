// backend/controllers/mysql/productController.js  (MySQL / Prisma)
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const prisma  = require('../../config/prisma');
const { mapProduct } = require('../../data/map');

// ── Multer (identical to Mongo version — storage is DB-agnostic)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/products');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
exports.upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
      .includes(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Images only'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Identical distribution logic as the Mongo controller.
function distributeFiles(files, colors) {
  if (!files || !files.length) return colors;
  const perColor = {};
  const legacy   = [];
  files.forEach(f => {
    const m = f.fieldname.match(/^color_(\d+)_photos$/);
    if (m) {
      const idx = parseInt(m[1], 10);
      (perColor[idx] = perColor[idx] || []).push(`/uploads/products/${f.filename}`);
    } else {
      legacy.push(`/uploads/products/${f.filename}`);
    }
  });
  Object.entries(perColor).forEach(([idx, paths]) => {
    const i = parseInt(idx, 10);
    if (i < colors.length) colors[i].images = [...(colors[i].images || []), ...paths];
  });
  if (legacy.length) {
    if (!colors.length) colors = [{ name: 'Default', hex: '', images: legacy }];
    else                colors[0].images = [...(colors[0].images || []), ...legacy];
  }
  return colors;
}

// colors[] → Prisma nested-create rows (preserve order via sortOrder)
const colorRows = colors => (colors || []).map((c, i) => ({
  name:      c.name,
  hex:       c.hex || '',
  images:    Array.isArray(c.images) ? c.images : [],
  sortOrder: i
}));

// GET /api/products  (public)
exports.getAll = async (req, res) => {
  try {
    const { category, badge, search, sort, minPrice, maxPrice } = req.query;
    const where = { active: true };

    if (category && category !== 'all') where.category = category;
    if (badge) where.badge = badge;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (search) {
      where.OR = [
        { name:        { contains: search } },
        { description: { contains: search } },
        { sku:         { contains: search } }
      ];
    }

    let orderBy;
    if (sort === 'price_asc')       orderBy = { price: 'asc' };
    else if (sort === 'price_desc') orderBy = { price: 'desc' };
    else if (sort === 'rating')     orderBy = { rating: 'desc' };
    else                            orderBy = { createdAt: 'desc' };

    const rows = await prisma.product.findMany({ where, orderBy, include: { colors: true } });
    const products = rows.map(mapProduct);
    res.json({ success: true, count: products.length, products });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/products/admin/all  (admin)
exports.getAllAdmin = async (req, res) => {
  try {
    const rows = await prisma.product.findMany({ orderBy: { createdAt: 'desc' }, include: { colors: true } });
    const products = rows.map(mapProduct);
    res.json({ success: true, count: products.length, products });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/products/categories/list  (public — counts from products)
exports.getCategories = async (req, res) => {
  try {
    const grouped = await prisma.product.groupBy({
      by: ['category'],
      where: { active: true },
      _count: { _all: true },
      orderBy: { category: 'asc' }
    });
    res.json({ success: true, categories: grouped.map(g => ({ name: g.category, count: g._count._all })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/products/:id
exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(404).json({ error: 'Product not found — invalid ID' });

    const raw = await prisma.product.findUnique({ where: { id }, include: { colors: true } });
    if (!raw) return res.status(404).json({ error: 'Product not found' });
    const product = mapProduct(raw);

    const relatedRows = await prisma.product.findMany({
      where: { category: product.category, id: { not: product._id }, active: true },
      take: 4,
      include: { colors: true }
    });
    res.json({ success: true, product, related: relatedRows.map(mapProduct) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/products  (admin)
exports.create = async (req, res) => {
  try {
    const { name, brand, category, price, oldPrice, badge, emoji, stock, lowStockThreshold, sku, description } = req.body;
    if (!name || !category || !price)
      return res.status(400).json({ error: 'name, category, price are required' });

    let colors = [];
    if (req.body.colors) { try { colors = JSON.parse(req.body.colors); } catch {} }
    colors = distributeFiles(req.files, colors);

    let details = [];
    if (req.body.details) { try { details = JSON.parse(req.body.details); } catch { details = [req.body.details]; } }

    const created = await prisma.product.create({
      data: {
        name, brand: brand || 'DomDom', category,
        price: parseFloat(price),
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        badge: badge || null,
        emoji: emoji || '✨',
        stock: parseInt(stock) || 0,
        lowStockThreshold: parseInt(lowStockThreshold) || 10,
        sku: sku || `DD-${Date.now()}`,
        description: description || '',
        details,
        active: true,
        colors: { create: colorRows(colors) }
      },
      include: { colors: true }
    });
    res.status(201).json({ success: true, product: mapProduct(created) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PUT /api/products/:id  (admin)
exports.update = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { colors: true } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const data = {};
    ['name', 'brand', 'category', 'badge', 'emoji', 'sku', 'description'].forEach(f => {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    });
    if (req.body.price    !== undefined) data.price    = parseFloat(req.body.price);
    if (req.body.oldPrice !== undefined) data.oldPrice = req.body.oldPrice ? parseFloat(req.body.oldPrice) : null;
    if (req.body.stock    !== undefined) data.stock    = parseInt(req.body.stock);
    if (req.body.lowStockThreshold)      data.lowStockThreshold = parseInt(req.body.lowStockThreshold);
    if (req.body.active !== undefined)   data.active   = req.body.active === 'true' || req.body.active === true;
    if (req.body.details) { try { data.details = JSON.parse(req.body.details); } catch {} }

    // Colors: replace set when provided (mirrors Mongo overwrite of subdoc array)
    let newColors = null;
    if (req.body.colors) {
      let colors = [];
      try { colors = JSON.parse(req.body.colors); } catch {}
      newColors = distributeFiles(req.files, colors);
    } else if (req.files && req.files.length) {
      const existing = product.colors
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(c => ({ name: c.name, hex: c.hex, images: c.images || [] }));
      newColors = distributeFiles(req.files, existing);
    }

    const updated = await prisma.$transaction(async tx => {
      if (newColors) {
        await tx.productColor.deleteMany({ where: { productId: product.id } });
        data.colors = { create: colorRows(newColors) };
      }
      return tx.product.update({ where: { id: product.id }, data, include: { colors: true } });
    });

    res.json({ success: true, product: mapProduct(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// DELETE /api/products/:id  (admin — soft delete)
exports.remove = async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { active: false } }).catch(() => {});
    res.json({ success: true, message: 'Product deactivated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PATCH /api/products/:id/restock  (admin)
exports.restock = async (req, res) => {
  try {
    const qty = parseInt(req.body.quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Positive quantity required' });
    const exists = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: 'Product not found' });
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { stock: { increment: qty } },
      include: { colors: true }
    });
    res.json({ success: true, product: mapProduct(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
