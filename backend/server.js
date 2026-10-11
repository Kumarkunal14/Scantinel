require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const scanRoutes = require('./routes/scans');
const chatRoutes = require('./routes/chat');

const app = express(); // trigger restart

// Configure trust proxy. Use explicit 'loopback' by default to avoid a permissive
// setting while still supporting local proxy setups. Can be overridden with
// the TRUST_PROXY env var (e.g. '127.0.0.1' or a comma-separated list).
const TRUST_PROXY = process.env.TRUST_PROXY || 'loopback';
app.set('trust proxy', TRUST_PROXY);

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Rate limiting ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 20,
  message: { error: 'Too many scan requests. Please wait before scanning again.' },
  standardHeaders: true,
  legacyHeaders: false
});
// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting (apply only to POST scan requests) ─────────────────────────────
app.use('/api/scans', (req, res, next) => {
  if (req.method === 'POST') return limiter(req, res, next);
  return next();
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/scans', scanRoutes);
app.use('/api/chat', chatRoutes);

// ── URL reachability check (DNS + TCP — cloud-safe) ───────────────────────────
const dns = require('dns').promises;
const net = require('net');

function tcpConnect(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => { sock.destroy(); resolve(true);  });
    sock.on('error',   () => {                 resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

app.get('/api/check', async (req, res) => {
  const raw = (req.query.url || '').trim();
  if (!raw || raw.length < 3) return res.status(400).json({ error: 'URL required.' });

  // Extract clean hostname (strip protocol + path + port)
  const hostname = raw
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .trim();

  if (!hostname) return res.status(400).json({ error: 'Invalid URL.' });

  // Block private / loopback addresses
  const blockedPatterns = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
  ];
  for (const p of blockedPatterns) {
    if (p.test(hostname)) return res.json({ reachable: false, reason: 'private' });
  }

  // ── Step 1: DNS resolution ─────────────────────────────────────────────────
  // If DNS fails the domain genuinely does not exist — definitively unreachable.
  let dnsResult;
  try {
    dnsResult = await dns.lookup(hostname);
  } catch {
    return res.json({ reachable: false, reason: 'dns' });
  }

  // ── Step 2: TCP port check (best-effort) ───────────────────────────────────
  // TCP connect confirms the server is actively listening.
  // However on many cloud/serverless hosts outbound TCP is restricted —
  // if TCP fails but DNS resolved we still consider the site reachable,
  // because DNS proof is enough to know the domain is valid and live.
  const httpsOk = await tcpConnect(hostname, 443);
  if (httpsOk) return res.json({ reachable: true, protocol: 'https' });

  const httpOk = await tcpConnect(hostname, 80);
  if (httpOk) return res.json({ reachable: true, protocol: 'http' });

  // DNS resolved but TCP timed out — likely a cloud egress restriction.
  // The domain IS real; return reachable so we don't block valid scans.
  if (dnsResult) return res.json({ reachable: true, protocol: 'unknown' });

  return res.json({ reachable: false, reason: 'tcp' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Database + start ───────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/scantinel';
const PORT = parseInt(process.env.PORT) || 5000;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`✓ MongoDB connected: ${MONGO_URI}`);
    app.listen(PORT, () => {
      console.log(`✓ Scantinel API running on http://localhost:${PORT}`);
      console.log(`  Health: http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
