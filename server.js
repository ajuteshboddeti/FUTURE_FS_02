require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'supersecret123';

// -------------------------------------------------------------
// Cross-Origin Resource Sharing (CORS)
// Allows external websites (like your portfolio) to submit leads
// -------------------------------------------------------------
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-key']
}));

// -------------------------------------------------------------
// Security Headers Middleware
// -------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// -------------------------------------------------------------
// Body Parsing & Static Middleware
// -------------------------------------------------------------
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter for contact submission: 20 submissions per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this IP. Please try again later.' }
});

// Admin authentication middleware via x-admin-key header
function requireAdmin(req, res, next) {
  const clientKey = (req.headers['x-admin-key'] || '').toString().trim();
  const configuredKey = (process.env.ADMIN_KEY || ADMIN_KEY || 'supersecret123').toString().trim();

  if (!clientKey || clientKey !== configuredKey) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing x-admin-key header.'
    });
  }
  next();
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Direct route for /admin -> admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin verification endpoint
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ ok: true, message: 'Admin authentication valid.' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. POST /api/contact - Public contact form submission (accessible from portfolio)
app.post('/api/contact', contactLimiter, (req, res) => {
  try {
    const { name, email, message, _gotcha, hp, website } = req.body;

    // Honeypot check: If bot-trap fields are filled, return 200 without inserting
    if (_gotcha || hp || website) {
      return res.status(200).json({
        success: true,
        message: 'Your message has been sent successfully.'
      });
    }

    const cleanName = (typeof name === 'string' ? name : '').trim();
    const cleanEmail = (typeof email === 'string' ? email : '').trim();
    const cleanMessage = (typeof message === 'string' ? message : '').trim();

    // Field validation & length constraints
    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({
        error: 'Name is required (between 2 and 100 characters).'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || cleanEmail.length > 255 || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        error: 'A valid email address is required (maximum 255 characters).'
      });
    }

    if (cleanMessage.length > 2000) {
      return res.status(400).json({
        error: 'Message is too long (maximum 2000 characters).'
      });
    }

    // Parameterized insert
    const insertStmt = db.prepare(`
      INSERT INTO leads (name, email, message, status)
      VALUES (?, ?, ?, 'new')
    `);
    const info = insertStmt.run(cleanName, cleanEmail, cleanMessage);

    return res.status(201).json({
      success: true,
      message: 'Your message has been received! We will get back to you shortly.',
      leadId: info.lastInsertRowid
    });
  } catch (err) {
    console.error('Error inserting lead:', err);
    return res.status(500).json({ error: 'Internal server error while saving lead.' });
  }
});

// 2. GET /api/leads - Admin only: List all leads, newest first + counts
app.get('/api/leads', requireAdmin, (req, res) => {
  try {
    const leads = db.prepare(`
      SELECT id, name, email, message, status, created_at
      FROM leads
      ORDER BY datetime(created_at) DESC, id DESC
    `).all();

    const counts = {
      all: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      closed: leads.filter(l => l.status === 'closed').length
    };

    return res.json({ leads, counts });
  } catch (err) {
    console.error('Error fetching leads:', err);
    return res.status(500).json({ error: 'Internal server error while retrieving leads.' });
  }
});

// 3. PATCH /api/leads/:id - Admin only: Update status (new | contacted | qualified | closed)
app.patch('/api/leads/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['new', 'contacted', 'qualified', 'closed'];

    const leadId = Number(id);
    if (!Number.isInteger(leadId) || leadId <= 0) {
      return res.status(400).json({ error: 'Invalid lead ID parameter.' });
    }

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
      });
    }

    const updateStmt = db.prepare(`
      UPDATE leads
      SET status = ?
      WHERE id = ?
    `);
    const info = updateStmt.run(status, leadId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const updatedLead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId);
    return res.json({
      success: true,
      lead: updatedLead
    });
  } catch (err) {
    console.error('Error updating lead status:', err);
    return res.status(500).json({ error: 'Internal server error while updating lead status.' });
  }
});

// 4. DELETE /api/leads/completed - Admin only: Delete all completed/closed leads
app.delete('/api/leads/completed', requireAdmin, (req, res) => {
  try {
    const deleteStmt = db.prepare(`DELETE FROM leads WHERE status = 'closed'`);
    const info = deleteStmt.run();

    return res.json({
      success: true,
      message: `Successfully deleted ${info.changes} completed lead(s).`,
      deletedCount: Number(info.changes)
    });
  } catch (err) {
    console.error('Error deleting completed leads:', err);
    return res.status(500).json({ error: 'Internal server error while deleting completed leads.' });
  }
});

// 5. DELETE /api/leads/:id - Admin only: Delete a single lead by ID
app.delete('/api/leads/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const leadId = Number(id);
    if (!Number.isInteger(leadId) || leadId <= 0) {
      return res.status(400).json({ error: 'Invalid lead ID parameter.' });
    }

    const deleteStmt = db.prepare(`DELETE FROM leads WHERE id = ?`);
    const info = deleteStmt.run(leadId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    return res.json({
      success: true,
      message: `Lead #${leadId} deleted successfully.`,
      deletedId: leadId
    });
  } catch (err) {
    console.error('Error deleting lead:', err);
    return res.status(500).json({ error: 'Internal server error while deleting lead.' });
  }
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// Start the server if executed directly (e.g., node server.js or npm start)
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`LeadFlow CRM server running on http://localhost:${PORT}`);
  });
}

// Export app and dependencies for serverless handlers (Vercel) & tests
module.exports = app;
module.exports.app = app;
module.exports.server = server;
module.exports.db = db;

