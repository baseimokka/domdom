// backend/controllers/mysql/reviewController.js  (MySQL / Prisma)
const prisma = require('../../config/prisma');
const { mapReview } = require('../../data/map');

exports.getAll = async (req, res) => {
  try {
    const where = {};
    if (req.query.productId) where.productId = req.query.productId;
    const reviews = await prisma.review.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, reviews: reviews.map(mapReview) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { productId, rating, text } = req.body;
    if (!productId || !rating || !text)
      return res.status(400).json({ error: 'productId, rating, and text are required' });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // One review per user per product — prevents rating manipulation via
    // repeated submissions.
    const existing = await prisma.review.findFirst({ where: { productId, userId: req.user.id } });
    if (existing) return res.status(409).json({ error: 'You have already reviewed this product' });

    const review = await prisma.review.create({
      data: {
        productId,
        userId: req.user.id,
        author: req.user.name,
        avatar: '👤',
        rating: parseInt(rating),
        text:   text.trim()
      }
    });

    // Recalculate product rating
    const allReviews = await prisma.review.findMany({ where: { productId } });
    const avg = +(allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1);
    await prisma.product.update({
      where: { id: productId },
      data: { rating: avg, reviewCount: allReviews.length }
    });

    res.status(201).json({ success: true, review: mapReview(review) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (String(review.userId) !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized' });
    await prisma.review.delete({ where: { id: review.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
