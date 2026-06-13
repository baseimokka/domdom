// backend/controllers/mysql/authController.js  (MySQL / Prisma)
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { mapUser } = require('../../data/map');
const { applyMarkup } = require('../../config/pricing');

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const hash = pw => bcrypt.hash(pw, 12); // parity with old Mongoose pre-save (cost 12)

// wishlist mini-shape for /auth/me (parity with .populate('wishlist','name price emoji colors _id'))
function miniProduct(p) {
  return {
    _id:    p.id,
    name:   p.name,
    price:  p.price,
    emoji:  p.emoji,
    colors: (p.colors || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map(c => ({ _id: c.id, name: c.name, hex: c.hex, images: c.images || [] })),
    finalPrice: applyMarkup(p.price)
  };
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const normEmail = email.toLowerCase().trim();
    if (await prisma.user.findUnique({ where: { email: normEmail } }))
      return res.status(409).json({ error: 'Email already registered' });

    const user = await prisma.user.create({
      data: { name: name.trim(), email: normEmail, password: await hash(password) }
    });
    const token = signToken(user);
    res.status(201).json({
      success: true, token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    res.json({
      success: true, token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        addresses: true,
        wishlist: { include: { product: { include: { colors: true } } } }
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const wishlistProducts = user.wishlist.map(w => miniProduct(w.product));
    res.json({ success: true, user: mapUser(user, { wishlistProducts }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, email, city, area, address, postalCode } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { addresses: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const data = {};
    if (name)  data.name  = name.trim();
    if (phone) data.phone = phone.trim();
    if (email && email !== user.email) {
      const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (exists) return res.status(409).json({ error: 'Email already in use' });
      data.email = email.trim();
    }
    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: user.id }, data });
    }

    // Update or create default address
    if (city || address) {
      const addrData = {
        fullName:   name  || user.name,
        phone:      phone || user.phone,
        city:       city || '',
        area:       area || '',
        address:    address || '',
        postalCode: postalCode || '',
        isDefault:  true
      };
      const def = user.addresses.find(a => a.isDefault);
      if (def) await prisma.address.update({ where: { id: def.id }, data: addrData });
      else     await prisma.address.create({ data: { ...addrData, userId: user.id } });
    }

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const newToken = signToken(fresh);
    res.json({
      success: true,
      token: newToken,
      user: { id: fresh.id, name: fresh.name, email: fresh.email, role: fresh.role, phone: fresh.phone }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(401).json({ error: 'Current password is incorrect' });

    await prisma.user.update({ where: { id: user.id }, data: { password: await hash(newPassword) } });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
