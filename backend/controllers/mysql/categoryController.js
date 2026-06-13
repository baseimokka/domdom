// backend/controllers/mysql/categoryController.js  (MySQL / Prisma)
const prisma = require('../../config/prisma');
const { mapCategory } = require('../../data/map');

const slugify = name => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const ORDER = [{ sortOrder: 'asc' }, { name: 'asc' }];

// GET /api/categories  (public)
exports.getAll = async (req, res) => {
  try {
    const cats = await prisma.category.findMany({ where: { active: true }, orderBy: ORDER });
    res.json({ success: true, categories: cats.map(mapCategory) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/categories/admin/all  (admin)
exports.getAllAdmin = async (req, res) => {
  try {
    const cats = await prisma.category.findMany({ orderBy: ORDER });
    res.json({ success: true, categories: cats.map(mapCategory) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/categories  (admin)
exports.create = async (req, res) => {
  try {
    const { name, emoji, sortOrder } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name required' });
    const slug = slugify(name.trim());
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) return res.status(409).json({ error: 'Category already exists' });
    const cat = await prisma.category.create({
      data: { name: name.trim(), slug, emoji: emoji || '✨', sortOrder: sortOrder ? parseInt(sortOrder) : 0 }
    });
    res.status(201).json({ success: true, category: mapCategory(cat) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PUT /api/categories/:id  (admin)
exports.update = async (req, res) => {
  try {
    const { name, emoji, sortOrder, active } = req.body;
    const cat = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const data = {};
    if (name) { data.name = name.trim(); data.slug = slugify(name.trim()); } // mirror pre-save slug regen
    if (emoji !== undefined) data.emoji = emoji;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);
    if (active !== undefined) data.active = active === true || active === 'true';

    const updated = await prisma.category.update({ where: { id: cat.id }, data });
    res.json({ success: true, category: mapCategory(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// DELETE /api/categories/:id  (admin)
exports.remove = async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } }).catch(() => {});
    res.json({ success: true, message: 'Category deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
