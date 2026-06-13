// backend/controllers/mysql/couponController.js  (MySQL / Prisma)
const prisma = require('../../config/prisma');
const { mapCoupon } = require('../../data/map');

// Shared validation helper — also used by orderController. Returns the raw
// Prisma coupon row (has `.id`) so callers can increment usedCount.
async function validateCoupon(code, subtotal = 0) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase().trim() } });
  if (!coupon)        return { valid: false, message: 'Coupon code not found' };
  if (!coupon.active) return { valid: false, message: 'This coupon is inactive' };

  const now = new Date();
  if (coupon.validFrom  && coupon.validFrom  > now) return { valid: false, message: 'This coupon is not yet valid' };
  if (coupon.validUntil && coupon.validUntil < now) return { valid: false, message: 'This coupon has expired' };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
    return { valid: false, message: 'Coupon usage limit has been reached' };

  const sub = +subtotal || 0;
  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = +(sub * coupon.discountValue / 100).toFixed(2);
  } else {
    discountAmount = +Math.min(coupon.discountValue, sub).toFixed(2);
  }

  return {
    valid: true,
    coupon,
    discountAmount,
    message: coupon.discountType === 'percentage'
      ? `${coupon.discountValue}% discount applied`
      : `${coupon.discountValue} EGP discount applied`
  };
}

// POST /api/coupons/validate
exports.validate = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    if (!code?.trim()) return res.status(400).json({ valid: false, message: 'Coupon code is required' });

    const result = await validateCoupon(code, +subtotal || 0);
    if (!result.valid) return res.status(400).json({ valid: false, message: result.message });

    return res.json({
      valid:          true,
      discountType:   result.coupon.discountType,
      discountValue:  result.coupon.discountValue,
      discountAmount: result.discountAmount,
      message:        result.message
    });
  } catch (e) { next(e); }
};

// GET /api/coupons/admin/all
exports.getAll = async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, coupons: coupons.map(mapCoupon) });
  } catch (e) { next(e); }
};

// POST /api/coupons
exports.create = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, maxUses, validFrom, validUntil, active } = req.body;
    if (!code?.trim())                     return res.status(400).json({ error: 'Coupon code is required' });
    if (!discountType)                     return res.status(400).json({ error: 'Discount type is required' });
    if (discountValue == null || +discountValue < 0) return res.status(400).json({ error: 'Discount value must be 0 or greater' });
    if (discountType === 'percentage' && +discountValue > 100)
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });

    const coupon = await prisma.coupon.create({
      data: {
        code:          code.toUpperCase().trim(),
        discountType,
        discountValue: +discountValue,
        maxUses:       (maxUses !== undefined && maxUses !== null && maxUses !== '') ? +maxUses : null,
        validFrom:     validFrom  ? new Date(validFrom)  : null,
        validUntil:    validUntil ? new Date(validUntil) : null,
        active:        active !== false && active !== 'false'
      }
    });
    return res.status(201).json({ success: true, coupon: mapCoupon(coupon) });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'A coupon with this code already exists' });
    next(e);
  }
};

// PUT /api/coupons/:id
exports.update = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, maxUses, validFrom, validUntil, active } = req.body;
    const data = {};
    if (code          !== undefined) data.code          = code.toUpperCase().trim();
    if (discountType  !== undefined) data.discountType  = discountType;
    if (discountValue !== undefined) {
      if (discountType === 'percentage' && +discountValue > 100)
        return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
      data.discountValue = +discountValue;
    }
    if (maxUses    !== undefined) data.maxUses    = (maxUses !== null && maxUses !== '') ? +maxUses : null;
    if (validFrom  !== undefined) data.validFrom  = validFrom  ? new Date(validFrom)  : null;
    if (validUntil !== undefined) data.validUntil = validUntil ? new Date(validUntil) : null;
    if (active     !== undefined) data.active     = active !== false && active !== 'false';

    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data }).catch(err => {
      if (err.code === 'P2025') return null;
      throw err;
    });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    return res.json({ success: true, coupon: mapCoupon(coupon) });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'A coupon with this code already exists' });
    next(e);
  }
};

// DELETE /api/coupons/:id
exports.remove = async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.delete({ where: { id: req.params.id } }).catch(err => {
      if (err.code === 'P2025') return null;
      throw err;
    });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    return res.json({ success: true, message: 'Coupon deleted' });
  } catch (e) { next(e); }
};

exports.validateCoupon = validateCoupon;
