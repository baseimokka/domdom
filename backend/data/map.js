// backend/data/map.js
// Mappers: convert Prisma rows → the exact JSON shape the old Mongoose models
// produced (top-level `_id`, nested `_id`s, computed `finalPrice`, reconstructed
// embedded objects). This is what guarantees frontend API compatibility.
const { applyMarkup } = require('../config/pricing');

// Generic: expose Prisma `id` as `_id`, drop the raw `id`.
function withId(row) {
  if (!row) return row;
  const { id, ...rest } = row;
  return { _id: id, ...rest };
}

// ── Product (+ colors, + finalPrice virtual)
function mapProduct(p) {
  if (!p) return p;
  const colors = (p.colors || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(c => ({
      _id:    c.id,
      name:   c.name,
      hex:    c.hex,
      images: Array.isArray(c.images) ? c.images : (c.images || [])
    }));

  return {
    _id:               p.id,
    name:              p.name,
    brand:             p.brand,
    category:          p.category,
    price:             p.price,
    oldPrice:          p.oldPrice,
    description:       p.description,
    details:           Array.isArray(p.details) ? p.details : (p.details || []),
    badge:             p.badge,
    emoji:             p.emoji,
    sku:               p.sku,
    stock:             p.stock,
    lowStockThreshold: p.lowStockThreshold,
    rating:            p.rating,
    reviewCount:       p.reviewCount,
    active:            p.active,
    colors,
    createdAt:         p.createdAt,
    updatedAt:         p.updatedAt,
    finalPrice:        applyMarkup(p.price)
  };
}

// Lean product (no colors join needed) — used by aggregations/lists where colors absent
function mapProductLean(p) {
  return mapProduct(p);
}

// ── User. `wishlist` may be: array of productIds (strings) or populated products.
function mapUser(u, { wishlistProducts } = {}) {
  if (!u) return u;
  const addresses = (u.addresses || []).map(a => ({
    fullName:   a.fullName,
    phone:      a.phone,
    city:       a.city,
    area:       a.area,
    address:    a.address,
    postalCode: a.postalCode,
    isDefault:  a.isDefault
  }));

  let wishlist;
  if (wishlistProducts) {
    wishlist = wishlistProducts; // already mapped
  } else if (u.wishlist) {
    // array of WishlistItem rows → array of productId strings (ObjectId-ref parity)
    wishlist = u.wishlist.map(w => w.productId);
  } else {
    wishlist = [];
  }

  return {
    _id:       u.id,
    name:      u.name,
    email:     u.email,
    role:      u.role,
    phone:     u.phone,
    wishlist,
    addresses,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
}

// ── Order (+ items, reconstructed shippingAddress, optional populated user/verifiedBy)
function mapOrder(o) {
  if (!o) return o;

  const items = (o.items || []).map(it => ({
    product:      it.productId || null,
    productName:  it.productName,
    productEmoji: it.productEmoji,
    productPhoto: it.productPhoto,
    colorName:    it.colorName,
    colorHex:     it.colorHex,
    price:        it.price,
    quantity:     it.quantity,
    lineTotal:    it.lineTotal
  }));

  // user: populated object {_id,name,email} when included, else id string or null
  let user = null;
  if (o.user && typeof o.user === 'object') {
    user = { _id: o.user.id, name: o.user.name, email: o.user.email };
  } else if (o.userId) {
    user = o.userId;
  }

  return {
    _id:         o.id,
    orderNumber: o.orderNumber,
    user,
    guestEmail:  o.guestEmail,
    items,
    shippingAddress: {
      fullName:   o.shippingFullName,
      phone:      o.shippingPhone,
      email:      o.shippingEmail,
      city:       o.shippingCity,
      area:       o.shippingArea,
      address:    o.shippingAddress,
      postalCode: o.shippingPostalCode,
      notes:      o.shippingNotes
    },
    subtotal:          o.subtotal,
    shippingCost:      o.shippingCost,
    discount:          o.discount,
    total:             o.total,
    paymentMethod:     o.paymentMethod,
    paymentStatus:     o.paymentStatus,
    orderStatus:       o.orderStatus,
    discountCode:      o.discountCode,
    adminNotes:        o.adminNotes,
    paymentProof:      o.paymentProof,
    verificationDate:  o.verificationDate,
    verificationNotes: o.verificationNotes,
    verifiedBy:        o.verifiedById || null,
    createdAt:         o.createdAt,
    updatedAt:         o.updatedAt
  };
}

// ── Simple entities
const mapCategory         = withId;
const mapCoupon           = withId;
const mapBanner           = withId;
const mapSetting          = withId;
const mapHomepageCategory = withId;

function mapReview(r) {
  if (!r) return r;
  return {
    _id:       r.id,
    product:   r.productId,
    user:      r.userId || null,
    author:    r.author,
    avatar:    r.avatar,
    rating:    r.rating,
    text:      r.text,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}

module.exports = {
  withId,
  mapProduct,
  mapProductLean,
  mapUser,
  mapOrder,
  mapCategory,
  mapCoupon,
  mapBanner,
  mapSetting,
  mapHomepageCategory,
  mapReview
};
