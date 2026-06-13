// backend/controllers/mysql/wishlistController.js  (MySQL / Prisma)
const prisma = require('../../config/prisma');
const { applyMarkup } = require('../../config/pricing');

// product shape parity with old .populate(... select 'name price emoji colors badge rating reviewCount category oldPrice _id')
function mapWishlistProduct(p) {
  return {
    _id:         p.id,
    name:        p.name,
    price:       p.price,
    emoji:       p.emoji,
    colors:      (p.colors || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                   .map(c => ({ _id: c.id, name: c.name, hex: c.hex, images: c.images || [] })),
    badge:       p.badge,
    rating:      p.rating,
    reviewCount: p.reviewCount,
    category:    p.category,
    oldPrice:    p.oldPrice,
    finalPrice:  applyMarkup(p.price)
  };
}

// GET /api/wishlist
exports.getWishlist = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id, product: { active: true } },
      include: { product: { include: { colors: true } } }
    });
    res.json({ success: true, wishlist: items.map(w => mapWishlistProduct(w.product)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/wishlist/:productId  — toggle
exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ error: 'Invalid product ID' });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId: req.user.id, productId } }
    });

    let action;
    if (!existing) {
      await prisma.wishlistItem.create({ data: { userId: req.user.id, productId } });
      action = 'added';
    } else {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      action = 'removed';
    }

    const wishlistCount = await prisma.wishlistItem.count({ where: { userId: req.user.id } });
    res.json({ success: true, action, wishlistCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// DELETE /api/wishlist/:productId
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    await prisma.wishlistItem.deleteMany({ where: { userId: req.user.id, productId } });
    const wishlistCount = await prisma.wishlistItem.count({ where: { userId: req.user.id } });
    res.json({ success: true, wishlistCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
