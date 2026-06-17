// backend/controllers/mysql/contactController.js  (MySQL / Prisma)
const prisma = require('../../config/prisma');
const { mapContactMessage } = require('../../data/map');

// Cap stored lengths so an abusive submission can't bloat the table.
const MAX = { name: 120, email: 160, subject: 160, message: 5000 };

// POST /api/contact  (public — storefront "Send us a message" form)
exports.create = async (req, res, next) => {
  try {
    const name    = (req.body.name    || '').trim();
    const email   = (req.body.email   || '').trim();
    const subject = (req.body.subject || '').trim();
    const message = (req.body.message || '').trim();

    if (!name || !email || !message)
      return res.status(400).json({ error: 'Name, email and message are required' });
    if (!email.includes('@'))
      return res.status(400).json({ error: 'A valid email is required' });

    await prisma.contactMessage.create({
      data: {
        name:    name.slice(0, MAX.name),
        email:   email.slice(0, MAX.email),
        subject: subject.slice(0, MAX.subject),
        message: message.slice(0, MAX.message)
      }
    });
    res.status(201).json({ success: true, message: 'Thanks! Your message has been received.' });
  } catch (e) { next(e); }
};

// GET /api/admin/contact-messages  (admin)
exports.getAll = async (req, res, next) => {
  try {
    const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
    const unread = rows.reduce((n, r) => n + (r.read ? 0 : 1), 0);
    res.json({ success: true, count: rows.length, unread, messages: rows.map(mapContactMessage) });
  } catch (e) { next(e); }
};

// GET /api/admin/contact-messages/unread-count  (admin — for the nav badge)
exports.unreadCount = async (req, res, next) => {
  try {
    const count = await prisma.contactMessage.count({ where: { read: false } });
    res.json({ success: true, count });
  } catch (e) { next(e); }
};

// PATCH /api/admin/contact-messages/:id/read  (admin — set/toggle read flag)
exports.setRead = async (req, res, next) => {
  try {
    const read = req.body.read !== false && req.body.read !== 'false';
    const row = await prisma.contactMessage
      .update({ where: { id: req.params.id }, data: { read } })
      .catch(err => { if (err.code === 'P2025') return null; throw err; });
    if (!row) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, message: mapContactMessage(row) });
  } catch (e) { next(e); }
};

// DELETE /api/admin/contact-messages/:id  (admin — permanent)
exports.remove = async (req, res, next) => {
  try {
    const row = await prisma.contactMessage
      .delete({ where: { id: req.params.id } })
      .catch(err => { if (err.code === 'P2025') return null; throw err; });
    if (!row) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, message: 'Message deleted' });
  } catch (e) { next(e); }
};
