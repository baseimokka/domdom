# DomDom — MongoDB → MySQL Migration Report

**Date:** 2026-06-11  ·  **Approach:** Safe parallel migration, then Phase D cutover/cleanup
**Status:** ✅ **Complete.** App runs on MySQL/Prisma only (validated 56/56 + smoke test on :3000). MongoDB code removed; full snapshot preserved in backup folder.

---

## 1. Final architecture

The app now uses **MySQL + Prisma exclusively**. Controllers live in
`backend/controllers/mysql/`, wired in `routes/index.js`. `server.js` no longer
connects to MongoDB. The migration was performed via a reversible `DB_DRIVER`
switch (parallel layers); after validation, Phase D removed the Mongo path.

**Rollback (if ever needed):** restore from `C:\Users\Basse\domdom_backup_pre-mysql`
(complete pre-migration snapshot, MongoDB intact).

---

## 2. Project audit (source of truth)

8 Mongoose collections, 9 controllers, 1 routes file, JWT auth, Multer uploads.

| Mongo feature | Location | MySQL handling |
|---|---|---|
| Embedded subdocs | User.addresses, Product.colors, Order.items, Order.shippingAddress | child tables (`addresses`, `product_colors`, `order_items`) + denormalized shipping columns |
| `wishlist: ObjectId[]` (N:N) | User ↔ Product | `wishlist_items` join table (`@@unique([userId,productId])`) |
| `populate()` | me, orders, wishlist | Prisma `include` |
| Aggregation `$group/$sum/$expr` | categories/list, stats | `groupBy`, `aggregate`, one `$queryRaw` for low-stock (`stock <= lowStockThreshold`) |
| `$regex` search | products.getAll | `contains` filter (`OR`) |
| `$inc` | restock, stock, coupon usedCount | `increment` / `decrement` |
| `pre('save')` hooks | password hash, orderNumber, slug | explicit code in repos |
| `virtual finalPrice` | Product | computed in mapper (`applyMarkup`) |
| `ObjectId.isValid` guards | product, banner, wishlist | replaced by presence check + not-found → 404 |

### Relationship map
- User 1→N Address, 1→N Order, 1→N Review, N↔N Product (wishlist)
- Product 1→N ProductColor, 1→N OrderItem, 1→N Review; N→1 Category **by slug string** (loose, unchanged)
- Order 1→N OrderItem; shippingAddress = snapshot columns
- Coupon linked from Order by `discountCode` string (no FK), `verifiedBy` → User

---

## 3. ID strategy (API compatibility)

Frontend reads **`_id`** in ~70 places (admin pages have no `id` fallback). Therefore:
- Prisma PKs are `cuid()` **strings**.
- The **mapper layer** (`backend/data/map.js`) exposes every row's `id` as `_id`,
  including nested `colors[]._id`, and reconstructs `shippingAddress` and `items[]`
  exactly as Mongoose produced them, plus the `finalPrice` virtual.
- Result: **API responses are shape-identical** — frontend untouched.

---

## 4. Risk assessment & outcome

| Risk | Mitigation | Validated |
|---|---|---|
| Frontend `_id` dependency | mapper injects `_id` everywhere incl. nested | ✅ |
| `ObjectId.isValid` → cuid | presence check; bad id → 404 (same status) | ✅ |
| Aggregations | groupBy/aggregate/$queryRaw | ✅ stats, categories/list |
| `finalPrice` 5% markup | centralized mapper | ✅ price*1.05 |
| Wishlist N:N | join table; toggle/count parity | ✅ |
| Order stock + coupon | wrapped in `$transaction` (stronger than old sequential saves) | ✅ decrement + discount |
| Manual-payment 2-step upload | Multer + filesystem unchanged | ✅ verify flow |

---

## 5. Validation report (56/56 passed)

Auth (login/register/me, bad-password 401, short-pw 400) · Products (list, `_id`,
`finalPrice`, nested color `_id`, details array) · search/filter/sort · categories
aggregation · getOne + related + bad-id 404 · wishlist add/get/remove · coupon
create+validate(+reject) · **order create** (orderNumber, items, shipping snapshot,
PendingVerification, 10% discount, stock −2) · out-of-stock 400 · admin orders list ·
verify-payment · admin getOne · status update · admin stats (+lowStock `_id`) ·
category CRUD · settings public/admin/persist · authz (user→admin 403, no-token 401) ·
hero-banners · reviews create/list + product rating recalculation.

---

## 6. Files

**New (MySQL layer — additive):**
- `backend/prisma/schema.prisma`
- `backend/config/prisma.js`
- `backend/config/seed.mysql.js`
- `backend/data/map.js`
- `backend/controllers/mysql/*.js` (auth, product, order, review, user, category, wishlist, coupon, heroBanner, setting)

**Modified:**
- `backend/routes/index.js` — require controllers from `controllers/mysql/`
- `backend/server.js` — removed Mongo connect
- `backend/.env` — `DATABASE_URL` (removed `MONGO_URI`)
- `backend/package.json` — added `@prisma/client`/`prisma`, removed `mongoose`/`mongodb`

**Deleted in Phase D (preserved in backup):**
- `backend/models/*` (all 8 Mongoose models)
- original `backend/controllers/*.js` (10 Mongo controllers)
- `backend/config/db.js`, `backend/config/seed.js`

**Untouched (100% preserved):** `middleware/auth.js`, `config/{pricing,cities}.js`,
and the **entire `frontend/`**.

**Backup:** `C:\Users\Basse\domdom_backup_pre-mysql` (pre-migration snapshot, Mongo intact).

---

## 7. Operations

```bash
# Apply schema to a fresh MySQL DB
cd backend && npx prisma db push

# Seed admin + sample products
node config/seed.mysql.js

# Run (MySQL)        -> DB_DRIVER=mysql in .env
npm start

# Instant rollback  -> set DB_DRIVER=mongo in .env, ensure MongoDB running, npm start
```

**MySQL:** local `MySQL80`, db `domdom`, user `domdom`. Connection in `backend/.env`.

---

## 8. Phase D — completed (2026-06-11)

Cutover and cleanup done: removed `mongoose`/`mongodb` (package.json + node_modules),
deleted all Mongoose models, original Mongo controllers, `config/db.js`, `config/seed.js`,
and the `DB_DRIVER` switch. App verified running MySQL-only on `http://localhost:3000`.
The backup folder remains the rollback path.
