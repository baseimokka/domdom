// backend/controllers/mysql/orderController.js  (MySQL / Prisma)
const path         = require('path');
const fs           = require('fs');
const multer       = require('multer');
const prisma       = require('../../config/prisma');
const EGYPT_CITIES = require('../../config/cities');
const { FREE_SHIPPING_THRESHOLD, applyMarkup } = require('../../config/pricing');
const { validateCoupon } = require('./couponController');
const { mapOrder } = require('../../data/map');

// Free-shipping threshold is admin-configurable via Settings; the pricing
// constant is the fallback when the setting is missing or invalid.
async function getFreeShippingThreshold() {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'free_shipping_threshold' } });
    const n = parseFloat(s?.value);
    return Number.isFinite(n) && n >= 0 ? n : FREE_SHIPPING_THRESHOLD;
  } catch { return FREE_SHIPPING_THRESHOLD; }
}

// ── Multer for payment proof uploads
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/payment-proofs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const ALLOWED_PROOF_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PROOF_EXTS  = ['.jpg', '.jpeg', '.png', '.webp'];
exports.proofUpload = multer({
  storage: proofStorage,
  fileFilter: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    (ALLOWED_PROOF_EXTS.includes(ext) && ALLOWED_PROOF_MIMES.includes(mime))
      ? cb(null, true)
      : cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

function deleteProofFile(relPath) {
  if (!relPath) return;
  try {
    const abs = path.join(__dirname, '../..', relPath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
}

function getShippingFee(cityName) {
  if (!cityName) return 95;
  const city = EGYPT_CITIES.find(c => c.name.toLowerCase() === cityName.toLowerCase().trim());
  return city ? city.fee : 95;
}

function genOrderNumber() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

const VALID_PAYMENT_METHODS = ['COD', 'InstaPay', 'VodafoneCash'];

// POST /api/orders
exports.create = async (req, res, next) => {
  try {
    const { items, shippingAddress, couponCode, paymentMethod: rawMethod } = req.body;
    const paymentMethod = VALID_PAYMENT_METHODS.includes(rawMethod) ? rawMethod : 'COD';

    const requiredFields = ['fullName', 'phone', 'email', 'city', 'address'];
    for (const f of requiredFields) {
      if (!shippingAddress?.[f]?.trim()) {
        return res.status(400).json({ error: `Shipping field required: ${f}` });
      }
    }
    if (!items?.length) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }

    // Validate coupon early
    let couponResult = null;
    if (couponCode?.trim()) {
      couponResult = await validateCoupon(couponCode.trim());
      if (!couponResult.valid) return res.status(400).json({ error: couponResult.message });
    }

    // Read + validate all items first (no writes yet). One product may appear
    // as several lines (one per color), so stock is checked on the per-product
    // total, not per line.
    let subtotal = 0;
    const orderItems = [];
    const qtyByProduct = new Map();   // productId → total quantity ordered
    const productCache = new Map();   // productId → product row (with colors)
    for (const item of items) {
      // Quantity must be a positive whole number. Guards against negative
      // quantities (which would invert the stock decrement and the subtotal),
      // zero, fractional, and non-numeric values.
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be a positive whole number' });
      }

      let product = productCache.get(item.productId);
      if (!product) {
        product = await prisma.product.findUnique({
          where: { id: item.productId }, include: { colors: true }
        });
        if (!product) return res.status(404).json({ error: `Product not found: ${item.productId}` });
        productCache.set(item.productId, product);
      }

      const colors     = (product.colors || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      // Prefer the stable variant id; fall back to name for older clients.
      const matchColor = (item.colorId && colors.find(c => c.id === item.colorId))
                      || colors.find(c => c.name === item.colorName);
      const finalPrice = applyMarkup(product.price);
      const lineTotal  = +(finalPrice * quantity).toFixed(2);
      subtotal += lineTotal;

      qtyByProduct.set(product.id, (qtyByProduct.get(product.id) || 0) + quantity);
      orderItems.push({
        productId:    product.id,
        productName:  product.name,
        productEmoji: product.emoji || '✨',
        productPhoto: (matchColor || colors[0])?.images?.[0] || null,
        colorName:    matchColor?.name || item.colorName || '',
        colorHex:     matchColor?.hex || colors[0]?.hex || '',
        price:        finalPrice,
        quantity,
        lineTotal
      });
    }

    // Validate stock against the combined quantity per product
    const stockOps = [];
    for (const [productId, qty] of qtyByProduct) {
      const product = productCache.get(productId);
      if (product.stock < qty)
        return res.status(400).json({ error: `Not enough stock for: ${product.name}` });
      stockOps.push({ id: productId, qty });
    }

    let discountAmount = 0;
    if (couponResult?.valid) {
      const { coupon } = couponResult;
      if (coupon.discountType === 'percentage')
        discountAmount = +(subtotal * coupon.discountValue / 100).toFixed(2);
      else
        discountAmount = +Math.min(coupon.discountValue, +subtotal.toFixed(2)).toFixed(2);
    }

    const freeShipThreshold = await getFreeShippingThreshold();
    const shippingCost = subtotal >= freeShipThreshold ? 0 : getShippingFee(shippingAddress.city);
    const discountedSubtotal = Math.max(0, +subtotal.toFixed(2) - discountAmount);
    const total              = +(discountedSubtotal + shippingCost).toFixed(2);
    const userId             = req.user?.id || null;
    const paymentStatus      = paymentMethod === 'COD' ? 'Pending' : 'PendingVerification';

    // Atomic writes: decrement stock, create order, bump coupon usage
    const order = await prisma.$transaction(async tx => {
      for (const op of stockOps) {
        await tx.product.update({ where: { id: op.id }, data: { stock: { decrement: op.qty } } });
      }
      const created = await tx.order.create({
        data: {
          orderNumber: genOrderNumber(),
          userId,
          guestEmail:  shippingAddress.email,
          subtotal:     +subtotal.toFixed(2),
          shippingCost,
          discount:     discountAmount,
          discountCode: couponResult?.valid ? couponResult.coupon.code : '',
          total,
          paymentMethod,
          paymentStatus,
          orderStatus:  'Pending',
          adminNotes:        '',
          verificationNotes: '',
          shippingFullName:   shippingAddress.fullName.trim(),
          shippingPhone:      shippingAddress.phone.trim(),
          shippingEmail:      shippingAddress.email.trim(),
          shippingCity:       shippingAddress.city.trim(),
          shippingArea:       shippingAddress.area?.trim()       || '',
          shippingAddress:    shippingAddress.address.trim(),
          shippingPostalCode: shippingAddress.postalCode?.trim() || '',
          shippingNotes:      shippingAddress.notes?.trim()      || '',
          items: { create: orderItems }
        },
        include: { items: true }
      });
      if (couponResult?.valid) {
        await tx.coupon.update({ where: { id: couponResult.coupon.id }, data: { usedCount: { increment: 1 } } });
      }
      // Backfill the customer's profile phone from checkout if they never set one,
      // so it shows up in the admin Customers table and their profile.
      if (userId) {
        const phone = shippingAddress.phone.trim();
        if (phone) {
          await tx.user.updateMany({ where: { id: userId, phone: '' }, data: { phone } });
        }
      }
      return created;
    });

    return res.status(201).json({ success: true, order: mapOrder(order) });
  } catch (e) {
    console.error('❌ ORDER CREATE ERROR:', e);
    next(e);
  }
};

// POST /api/orders/:id/payment-proof
exports.uploadPaymentProof = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      if (req.file) deleteProofFile(`/uploads/payment-proofs/${req.file.filename}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    const userId = String(req.user?.id || '');
    if (order.userId && userId && String(order.userId) !== userId && req.user?.role !== 'admin') {
      if (req.file) deleteProofFile(`/uploads/payment-proofs/${req.file.filename}`);
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!req.file) return res.status(400).json({ error: 'Payment proof image is required' });

    if (!['InstaPay', 'VodafoneCash'].includes(order.paymentMethod)) {
      deleteProofFile(`/uploads/payment-proofs/${req.file.filename}`);
      return res.status(400).json({ error: 'This payment method does not require a proof image' });
    }

    if (order.paymentProof) deleteProofFile(order.paymentProof);

    const updated = await prisma.order.update({
      where: { id: order.id },
      data:  { paymentProof: `/uploads/payment-proofs/${req.file.filename}` },
      include: { items: true }
    });
    return res.json({ success: true, order: mapOrder(updated) });
  } catch (e) { next(e); }
};

// PATCH /api/orders/:id/verify-payment  (admin)
exports.verifyPayment = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!['Verified', 'Rejected'].includes(status))
      return res.status(400).json({ error: 'status must be "Verified" or "Rejected"' });

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['InstaPay', 'VodafoneCash'].includes(order.paymentMethod))
      return res.status(400).json({ error: 'This order does not use manual payment' });

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus:     status,
        verificationDate:  new Date(),
        verificationNotes: notes?.trim() || '',
        verifiedById:      req.user.id
      },
      include: { items: true }
    });
    return res.json({ success: true, order: mapOrder(updated) });
  } catch (e) { next(e); }
};

// GET /api/orders — my orders
exports.myOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user   = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const or = [{ userId }];
    if (user?.email) or.push({ guestEmail: user.email });

    const orders = await prisma.order.findMany({
      where: { OR: or }, orderBy: { createdAt: 'desc' }, include: { items: true }
    });
    return res.json({ success: true, orders: orders.map(mapOrder) });
  } catch (e) { next(e); }
};

// GET /api/orders/:id
exports.getOne = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // Guest orders (no userId) must not be readable by arbitrary logged-in users —
    // only the owner or an admin may view an order.
    const isOwner = order.userId && String(order.userId) === String(req.user.id);
    if (!isOwner && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized' });
    return res.json({ success: true, order: mapOrder(order) });
  } catch (e) { next(e); }
};

// PATCH /api/orders/:id/cancel
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Guest orders (no userId) must not be cancellable by arbitrary logged-in
    // users — only the owner or an admin may cancel.
    const isOwner = order.userId && String(order.userId) === String(req.user.id);
    if (!isOwner && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized to cancel this order' });

    if (!['Pending', 'Processing'].includes(order.orderStatus))
      return res.status(400).json({ error: `Cannot cancel an order that is already ${order.orderStatus}` });

    const updated = await prisma.$transaction(async tx => {
      for (const item of order.items) {
        if (item.productId)
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } }).catch(() => {});
      }
      if (order.discountCode) {
        // restore coupon usage only if usedCount > 0
        await tx.coupon.updateMany({
          where: { code: order.discountCode, usedCount: { gt: 0 } },
          data:  { usedCount: { decrement: 1 } }
        });
      }
      return tx.order.update({ where: { id: order.id }, data: { orderStatus: 'Cancelled' }, include: { items: true } });
    });

    return res.json({ success: true, order: mapOrder(updated) });
  } catch (e) { next(e); }
};

// DELETE /api/orders/:id  (admin — permanent hard delete)
// Removes the order record and its line items (OrderItem cascades via schema)
// plus the payment-proof image from disk. Does NOT adjust product stock — to
// return inventory, Cancel the order first (which restocks), then delete.
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.paymentProof) deleteProofFile(order.paymentProof);
    await prisma.order.delete({ where: { id: order.id } });

    return res.json({ success: true, message: 'Order deleted' });
  } catch (e) { next(e); }
};

// GET /api/orders/admin/:id
exports.getAdminOne = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({ success: true, order: mapOrder(order) });
  } catch (e) { next(e); }
};

// GET /api/orders/admin/all
exports.allOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: { select: { id: true, name: true, email: true } } }
    });
    return res.json({ success: true, count: orders.length, orders: orders.map(mapOrder) });
  } catch (e) { next(e); }
};

// PATCH /api/orders/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const { orderStatus, paymentStatus, adminNotes } = req.body;
    const validOrder   = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const validPayment = ['Pending', 'Paid', 'Refunded', 'PendingVerification', 'Verified', 'Rejected'];
    const data = {};
    if (orderStatus) {
      if (!validOrder.includes(orderStatus)) return res.status(400).json({ error: 'Invalid orderStatus' });
      data.orderStatus = orderStatus;
    }
    if (paymentStatus) {
      if (!validPayment.includes(paymentStatus)) return res.status(400).json({ error: 'Invalid paymentStatus' });
      data.paymentStatus = paymentStatus;
    }
    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    const order = await prisma.order.update({ where: { id: req.params.id }, data, include: { items: true } })
      .catch(err => { if (err.code === 'P2025') return null; throw err; });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({ success: true, order: mapOrder(order) });
  } catch (e) { next(e); }
};

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [totalProducts, totalOrders, totalUsers, salesAgg, recentOrdersRaw, lowStock, pendingVerification] =
      await Promise.all([
        prisma.product.count({ where: { active: true } }),
        prisma.order.count(),
        prisma.user.count({ where: { role: 'user' } }),
        prisma.order.aggregate({ _sum: { total: true } }),
        prisma.order.findMany({
          orderBy: { createdAt: 'desc' }, take: 5,
          include: { items: true, user: { select: { id: true, name: true, email: true } } }
        }),
        prisma.$queryRawUnsafe(
          'SELECT id, name, stock, lowStockThreshold, emoji, sku FROM products WHERE active = true AND stock <= lowStockThreshold LIMIT 10'
        ),
        prisma.order.count({ where: { paymentStatus: 'PendingVerification' } })
      ]);

    return res.json({
      success: true,
      stats: {
        totalProducts, totalOrders, totalUsers,
        totalSales: +((salesAgg._sum.total || 0)).toFixed(2),
        pendingVerification
      },
      recentOrders: recentOrdersRaw.map(mapOrder),
      lowStock: lowStock.map(p => ({
        _id: p.id, name: p.name, stock: p.stock,
        lowStockThreshold: p.lowStockThreshold, emoji: p.emoji, sku: p.sku
      }))
    });
  } catch (e) { next(e); }
};

// GET /api/shipping/cities
exports.getCities = (req, res) => {
  res.json({ success: true, cities: EGYPT_CITIES });
};
