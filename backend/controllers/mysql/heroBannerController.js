// backend/controllers/mysql/heroBannerController.js  (MySQL / Prisma)
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const prisma   = require('../../config/prisma');
const { mapBanner } = require('../../data/map');

// ── Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/banners');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `banner-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
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

// GET /api/hero-banners  (public)
exports.getActiveBanners = async (req, res) => {
  try {
    const banners = await prisma.heroBanner.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
    res.json({ success: true, banners: banners.map(mapBanner) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/admin/hero-banners  (admin)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await prisma.heroBanner.findMany({ orderBy: { order: 'asc' } });
    res.json({ success: true, banners: banners.map(mapBanner) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/admin/hero-banners  (admin)
exports.createBanner = async (req, res) => {
  try {
    const { title, subtitle, buttonText, buttonLink, active, order } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const image = req.file ? `/uploads/banners/${req.file.filename}` : '';
    const banner = await prisma.heroBanner.create({
      data: {
        title,
        subtitle:   subtitle   || '',
        image,
        buttonText: buttonText || '',
        buttonLink: buttonLink || '',
        active:     active === 'false' ? false : true,
        order:      parseInt(order) || 0
      }
    });
    res.status(201).json({ success: true, banner: mapBanner(banner) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PUT /api/admin/hero-banners/:id  (admin)
exports.updateBanner = async (req, res) => {
  try {
    const banner = await prisma.heroBanner.findUnique({ where: { id: req.params.id } });
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    const { title, subtitle, buttonText, buttonLink, active, order, removeImage } = req.body;
    const data = {};
    if (title      !== undefined) data.title      = title;
    if (subtitle   !== undefined) data.subtitle   = subtitle;
    if (buttonText !== undefined) data.buttonText = buttonText;
    if (buttonLink !== undefined) data.buttonLink = buttonLink;
    if (order      !== undefined) data.order      = parseInt(order) || 0;
    if (active     !== undefined) data.active     = active === 'false' ? false : true;

    if (req.file) {
      deleteFile(banner.image);
      data.image = `/uploads/banners/${req.file.filename}`;
    } else if (removeImage === 'true') {
      deleteFile(banner.image);
      data.image = '';
    }

    const updated = await prisma.heroBanner.update({ where: { id: banner.id }, data });
    res.json({ success: true, banner: mapBanner(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// DELETE /api/admin/hero-banners/:id  (admin)
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await prisma.heroBanner.findUnique({ where: { id: req.params.id } });
    if (!banner) return res.status(404).json({ error: 'Banner not found' });
    deleteFile(banner.image);
    await prisma.heroBanner.delete({ where: { id: banner.id } });
    res.json({ success: true, message: 'Banner deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PATCH /api/admin/hero-banners/:id/toggle  (admin)
exports.toggleBanner = async (req, res) => {
  try {
    const banner = await prisma.heroBanner.findUnique({ where: { id: req.params.id } });
    if (!banner) return res.status(404).json({ error: 'Banner not found' });
    const updated = await prisma.heroBanner.update({
      where: { id: banner.id }, data: { active: !banner.active }
    });
    res.json({ success: true, banner: mapBanner(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PATCH /api/admin/hero-banners/reorder  (admin)
exports.reorderBanners = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    await Promise.all(
      items.map(({ id, order }) =>
        prisma.heroBanner.update({ where: { id }, data: { order: parseInt(order) || 0 } }).catch(() => {})
      )
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
