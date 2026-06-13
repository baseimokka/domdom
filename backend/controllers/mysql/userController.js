// backend/controllers/mysql/userController.js  (MySQL / Prisma)
const prisma = require('../../config/prisma');
const { mapUser } = require('../../data/map');

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'user' },
      orderBy: { createdAt: 'desc' },
      include: { addresses: true, wishlist: true }
    });

    // Order counts per customer. An order belongs to a customer when it was
    // placed while logged in (userId) OR as a guest with their email — same
    // rule as "my orders", deduped so each order counts at most once.
    // We also pull shippingPhone so the Customers table can show a phone for
    // people who entered one at checkout but never set a profile phone/address.
    const orders = await prisma.order.findMany({
      select: { userId: true, guestEmail: true, shippingPhone: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    const belongsTo = (o, u) => {
      const email = (u.email || '').toLowerCase();
      return (o.userId && o.userId === u.id) ||
             (o.guestEmail && o.guestEmail.toLowerCase() === email);
    };
    const orderCountFor = (u) => orders.reduce((n, o) => n + (belongsTo(o, u) ? 1 : 0), 0);
    // Most recent order phone for this customer (orders already sorted desc).
    const lastOrderPhoneFor = (u) =>
      orders.find(o => belongsTo(o, u) && o.shippingPhone)?.shippingPhone || '';

    const mapped = users.map(u => {
      const m = mapUser(u); // password never included
      const phone = m.phone || (m.addresses || []).find(a => a.isDefault)?.phone
                            || (m.addresses || [])[0]?.phone || lastOrderPhoneFor(u);
      return { ...m, phone, orderCount: orderCountFor(u) };
    });
    res.json({ success: true, count: mapped.length, users: mapped });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'Cannot delete your own account' });
    await prisma.user.delete({ where: { id: req.params.id } }).catch(() => {});
    res.json({ success: true, message: 'User deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
