// backend/controllers/mysql/homepageCategoryController.js  (MySQL / Prisma)
// Manages the category cards shown on the homepage "Shop by Category" section.
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const prisma = require('../../config/prisma');
const { mapHomepageCategory } = require('../../data/map');

// ── Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/homepage-categories');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `homecat-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
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

function deleteFile(relPath) {
  if (!relPath) return;
  try {
    const abs = path.join(__dirname, '../..', relPath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
}

// GET /api/homepage-categories  (public)
exports.getActive = async (req, res) => {
  try {
    const cats = await prisma.homepageCategory.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
    res.json({ success: true, categories: cats.map(mapHomepageCategory) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/admin/homepage-categories  (admin)
exports.getAll = async (req, res) => {
  try {
    const cats = await prisma.homepageCategory.findMany({ orderBy: { order: 'asc' } });
    res.json({ success: true, categories: cats.map(mapHomepageCategory) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/admin/homepage-categories  (admin)
exports.create = async (req, res) => {
  try {
    const { title, subtitle, linkCategory, active, order } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const image = req.file ? `/uploads/homepage-categories/${req.file.filename}` : '';
    const cat = await prisma.homepageCategory.create({
      data: {
        title,
        subtitle:     subtitle     || '',
        image,
        linkCategory: linkCategory || '',
        active:       active === 'false' ? false : true,
        order:        parseInt(order) || 0
      }
    });
    res.status(201).json({ success: true, category: mapHomepageCategory(cat) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PUT /api/admin/homepage-categories/:id  (admin)
exports.update = async (req, res) => {
  try {
    const cat = await prisma.homepageCategory.findUnique({ where: { id: req.params.id } });
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const { title, subtitle, linkCategory, active, order, removeImage } = req.body;
    const data = {};
    if (title        !== undefined) data.title        = title;
    if (subtitle     !== undefined) data.subtitle     = subtitle;
    if (linkCategory !== undefined) data.linkCategory = linkCategory;
    if (order        !== undefined) data.order        = parseInt(order) || 0;
    if (active       !== undefined) data.active       = active === 'false' ? false : true;

    if (req.file) {
      deleteFile(cat.image);
      data.image = `/uploads/homepage-categories/${req.file.filename}`;
    } else if (removeImage === 'true') {
      deleteFile(cat.image);
      data.image = '';
    }

    const updated = await prisma.homepageCategory.update({ where: { id: cat.id }, data });
    res.json({ success: true, category: mapHomepageCategory(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// DELETE /api/admin/homepage-categories/:id  (admin)
exports.remove = async (req, res) => {
  try {
    const cat = await prisma.homepageCategory.findUnique({ where: { id: req.params.id } });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    deleteFile(cat.image);
    await prisma.homepageCategory.delete({ where: { id: cat.id } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PATCH /api/admin/homepage-categories/:id/toggle  (admin)
exports.toggle = async (req, res) => {
  try {
    const cat = await prisma.homepageCategory.findUnique({ where: { id: req.params.id } });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const updated = await prisma.homepageCategory.update({
      where: { id: cat.id }, data: { active: !cat.active }
    });
    res.json({ success: true, category: mapHomepageCategory(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PATCH /api/admin/homepage-categories/reorder  (admin)
exports.reorder = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    await Promise.all(
      items.map(({ id, order }) =>
        prisma.homepageCategory.update({ where: { id }, data: { order: parseInt(order) || 0 } }).catch(() => {})
      )
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
