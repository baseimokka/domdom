// backend/server.js
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const path      = require('path');
const routes    = require('./routes/index');

// ── Fail fast if required secrets are missing — never sign tokens with an
// undefined secret or start the API without a database connection string.
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET is shorter than 32 characters — use a long, random secret in production.');
}

const app  = express();
const PORT = process.env.PORT || 3000;

// When deployed behind a reverse proxy (nginx, load balancer), trust the
// first proxy hop so rate limiting & logging see the real client IP.
// Set TRUST_PROXY=1 (or the hop count) in production.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// Data layer is MySQL via Prisma — the client connects lazily on first query.

// ── Security headers (helmet). Frontend loads Google Fonts and uses inline
// scripts/handlers, so the CSP is scoped to allow those. scriptSrc still needs
// 'unsafe-inline' until the inline onclick handlers are refactored out — the
// XSS sinks themselves are now escaped at render, so CSP here is defence-in-depth.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'"],
      // The pages use inline onclick/handler attributes throughout; allow them
      // until those are refactored to addEventListener.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));

// CORS — restrict to configured origins in production via CORS_ORIGIN
// (comma-separated). Falls back to reflecting the request origin when unset.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API routes
app.use('/api', routes);

// ── Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date() })
);

// ── Global error handler — MUST come before SPA fallback
// Must have 4 params for Express to recognise it as an error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── SPA fallback — LAST, only for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log('\n🌸 DomDom Store:   http://localhost:' + PORT);
  console.log('📦 API:            http://localhost:' + PORT + '/api\n');
});
