// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

// optionalAuth — lets request through whether logged in or not
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (header) {
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // token invalid — continue as guest
    }
  }
  next(); // always call next — this is a guest-friendly middleware
}

module.exports = { authMiddleware, adminMiddleware, optionalAuth };
