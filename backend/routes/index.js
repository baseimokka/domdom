// backend/routes/index.js
const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();

// ── Rate limiters
// Tight limit on auth endpoints to blunt credential brute-force & enumeration.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' }
});
// Moderate limit on public write endpoints (coupon probing, newsletter spam).
const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

// ── Data layer: MySQL (Prisma). Controllers live in controllers/mysql/.
const ctrl = name => require(`../controllers/mysql/${name}`);
console.log('🗄️  Data layer: MySQL (Prisma)');

const authCtrl     = ctrl('authController');
const prodCtrl     = ctrl('productController');
const orderCtrl    = ctrl('orderController');
const reviewCtrl   = ctrl('reviewController');
const userCtrl     = ctrl('userController');
const catCtrl      = ctrl('categoryController');
const wishlistCtrl = ctrl('wishlistController');
const couponCtrl   = ctrl('couponController');
const bannerCtrl   = ctrl('heroBannerController');
const homeCatCtrl  = ctrl('homepageCategoryController');
const homeFeatCtrl = ctrl('homepageFeatureController');
const settingCtrl  = ctrl('settingController');
const contactCtrl  = ctrl('contactController');
const { authMiddleware, adminMiddleware, optionalAuth } = require('../middleware/auth');

// ── AUTH
router.post('/auth/register',        authLimiter, authCtrl.register);
router.post('/auth/login',           authLimiter, authCtrl.login);
router.get('/auth/me',               authMiddleware, authCtrl.me);
router.put('/auth/profile',          authMiddleware, authCtrl.updateProfile);
router.post('/auth/change-password', authMiddleware, authCtrl.changePassword);

// ── CATEGORIES
router.get('/categories',            catCtrl.getAll);
router.get('/categories/admin/all',  adminMiddleware, catCtrl.getAllAdmin);
router.post('/categories',           adminMiddleware, catCtrl.create);
router.put('/categories/:id',        adminMiddleware, catCtrl.update);
router.delete('/categories/:id',     adminMiddleware, catCtrl.remove);

// ── PRODUCTS — specific routes BEFORE :id
router.get('/products',                  prodCtrl.getAll);
router.get('/products/categories/list',  prodCtrl.getCategories);
router.get('/products/admin/all',        adminMiddleware, prodCtrl.getAllAdmin);
router.get('/products/:id',              prodCtrl.getOne);
router.post('/products',                 adminMiddleware, prodCtrl.upload.any(), prodCtrl.create);
router.put('/products/:id',              adminMiddleware, prodCtrl.upload.any(), prodCtrl.update);
router.delete('/products/:id',           adminMiddleware, prodCtrl.remove);
router.patch('/products/:id/restock',    adminMiddleware, prodCtrl.restock);

// ── SHIPPING CITIES (public — used by checkout page)
router.get('/shipping/cities', orderCtrl.getCities);

// ── SETTINGS (public read, admin write)
router.get('/settings',              settingCtrl.getPublic);
router.get('/admin/settings',        adminMiddleware, settingCtrl.getAll);
router.put('/admin/settings',        adminMiddleware, settingCtrl.update);

// ── ORDERS — specific routes MUST come before /orders/:id
router.post('/orders',                   optionalAuth,    orderCtrl.create);
router.get('/orders',                    authMiddleware,  orderCtrl.myOrders);
router.get('/orders/admin/all',          adminMiddleware, orderCtrl.allOrders);
router.get('/orders/admin/:id',          adminMiddleware, orderCtrl.getAdminOne);
router.get('/orders/:id',                authMiddleware,  orderCtrl.getOne);
router.patch('/orders/:id/cancel',       authMiddleware,  orderCtrl.cancelOrder);
router.patch('/orders/:id/status',       adminMiddleware, orderCtrl.updateStatus);
router.post('/orders/:id/payment-proof', optionalAuth,    orderCtrl.proofUpload.single('proof'), orderCtrl.uploadPaymentProof);
router.patch('/orders/:id/verify-payment', adminMiddleware, orderCtrl.verifyPayment);
router.delete('/orders/:id',             adminMiddleware, orderCtrl.deleteOrder);

// ── REVIEWS
router.get('/reviews',               reviewCtrl.getAll);
router.post('/reviews',              authMiddleware,  reviewCtrl.create);
router.delete('/reviews/:id',        authMiddleware,  reviewCtrl.remove);

// ── WISHLIST
router.get('/wishlist',              authMiddleware,  wishlistCtrl.getWishlist);
router.post('/wishlist/:productId',  authMiddleware,  wishlistCtrl.toggleWishlist);
router.delete('/wishlist/:productId',authMiddleware,  wishlistCtrl.removeFromWishlist);

// ── ADMIN
router.get('/admin/stats',           adminMiddleware, orderCtrl.getStats);
router.get('/admin/users',           adminMiddleware, userCtrl.getAllUsers);
router.delete('/admin/users/:id',    adminMiddleware, userCtrl.deleteUser);

// ── COUPONS — validate before :id routes
router.post('/coupons/validate',     publicWriteLimiter, couponCtrl.validate);
router.get('/coupons/admin/all',     adminMiddleware, couponCtrl.getAll);
router.post('/coupons',              adminMiddleware, couponCtrl.create);
router.put('/coupons/:id',           adminMiddleware, couponCtrl.update);
router.delete('/coupons/:id',        adminMiddleware, couponCtrl.remove);

// ── HERO BANNERS — public
router.get('/hero-banners', bannerCtrl.getActiveBanners);

// ── HERO BANNERS — admin (specific routes BEFORE :id)
router.get('/admin/hero-banners',              adminMiddleware, bannerCtrl.getAllBanners);
router.post('/admin/hero-banners',             adminMiddleware, bannerCtrl.upload.single('image'), bannerCtrl.createBanner);
router.patch('/admin/hero-banners/reorder',    adminMiddleware, bannerCtrl.reorderBanners);
router.put('/admin/hero-banners/:id',          adminMiddleware, bannerCtrl.upload.single('image'), bannerCtrl.updateBanner);
router.delete('/admin/hero-banners/:id',       adminMiddleware, bannerCtrl.deleteBanner);
router.patch('/admin/hero-banners/:id/toggle', adminMiddleware, bannerCtrl.toggleBanner);

// ── HOMEPAGE CATEGORIES — public
router.get('/homepage-categories', homeCatCtrl.getActive);

// ── HOMEPAGE CATEGORIES — admin (specific routes BEFORE :id)
router.get('/admin/homepage-categories',              adminMiddleware, homeCatCtrl.getAll);
router.post('/admin/homepage-categories',             adminMiddleware, homeCatCtrl.upload.single('image'), homeCatCtrl.create);
router.patch('/admin/homepage-categories/reorder',    adminMiddleware, homeCatCtrl.reorder);
router.put('/admin/homepage-categories/:id',          adminMiddleware, homeCatCtrl.upload.single('image'), homeCatCtrl.update);
router.delete('/admin/homepage-categories/:id',       adminMiddleware, homeCatCtrl.remove);
router.patch('/admin/homepage-categories/:id/toggle', adminMiddleware, homeCatCtrl.toggle);

// ── HOMEPAGE FEATURES (Best Sellers / New Arrivals) — public
router.get('/homepage/:section', homeFeatCtrl.getSectionPublic);

// ── HOMEPAGE FEATURES — admin (specific routes BEFORE :id)
router.get('/admin/homepage/:section',                 adminMiddleware, homeFeatCtrl.getSectionAdmin);
router.post('/admin/homepage/:section',                adminMiddleware, homeFeatCtrl.addFeature);
router.put('/admin/homepage/:section/max',             adminMiddleware, homeFeatCtrl.setMax);
router.patch('/admin/homepage/:section/reorder',       adminMiddleware, homeFeatCtrl.reorderFeatures);
router.patch('/admin/homepage/:section/:id/toggle',    adminMiddleware, homeFeatCtrl.toggleFeature);
router.delete('/admin/homepage/:section/:id',          adminMiddleware, homeFeatCtrl.removeFeature);

// ── CONTACT MESSAGES — public submit, admin manage (specific routes BEFORE :id)
router.post('/contact',                            publicWriteLimiter, contactCtrl.create);
router.get('/admin/contact-messages',              adminMiddleware,    contactCtrl.getAll);
router.get('/admin/contact-messages/unread-count', adminMiddleware,    contactCtrl.unreadCount);
router.patch('/admin/contact-messages/:id/read',   adminMiddleware,    contactCtrl.setRead);
router.delete('/admin/contact-messages/:id',       adminMiddleware,    contactCtrl.remove);

// ── NEWSLETTER
router.post('/newsletter/subscribe', publicWriteLimiter, (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@'))
    return res.status(400).json({ error: 'Valid email required' });
  res.json({ success: true, message: 'Subscribed! Use code DOMDOM15 for 15% off', code: 'DOMDOM15' });
});

module.exports = router;
