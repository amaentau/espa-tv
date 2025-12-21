const express = require('express');
const cors = require('cors');
const path = require('path');
const { TableClient } = require('@azure/data-tables');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

// --- Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod-123';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY; // SMTP Password
const SMTP_HOST = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER; // Brevo Login Email
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@espa-tv.com';
const TABLE_NAME_ENTRIES = process.env.TABLE_NAME || 'bbsEntries';
const TABLE_NAME_USERS = 'bbsUsers'; 
const TABLE_NAME_CONFIG = 'bbsConfig';
const STORAGE_CONNECTION_STRING = process.env.STORAGE_CONNECTION_STRING;

// Setup Nodemailer Transporter
let mailTransporter = null;
if (SENDGRID_API_KEY && SMTP_USER) {
  mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SENDGRID_API_KEY,
    },
  });
} else {
  console.warn('⚠️ SMTP Credentials (SMTP_USER/SENDGRID_API_KEY) not found. Email sending will be mocked.');
}

// Basic Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MOCK STORAGE IMPLEMENTATION ---
const mockDb = {
  [TABLE_NAME_ENTRIES]: [],
  [TABLE_NAME_USERS]: [],
  [TABLE_NAME_CONFIG]: []
};

// Default Config
mockDb[TABLE_NAME_CONFIG].push({
  partitionKey: 'global',
  rowKey: 'coordinates',
  config: JSON.stringify({
    1280: { play: { x: 63, y: 681 }, fullscreen: { x: 1136, y: 678 } },
    1920: { play: { x: 87, y: 1032 }, fullscreen: { x: 1771, y: 1032 } },
    3840: { play: { x: 114, y: 2124 }, fullscreen: { x: 3643, y: 2122 } }
  })
});

class MockTableClient {
  constructor(tableName) { this.tableName = tableName; }
  async createTable() { return true; }
  
  async getEntity(partitionKey, rowKey) {
    const item = mockDb[this.tableName].find(i => i.partitionKey === partitionKey && i.rowKey === rowKey);
    if (!item) {
      const err = new Error('Not Found');
      err.statusCode = 404;
      throw err;
    }
    return { ...item };
  }

  async upsertEntity(entity) {
    const idx = mockDb[this.tableName].findIndex(i => i.partitionKey === entity.partitionKey && i.rowKey === entity.rowKey);
    if (idx >= 0) mockDb[this.tableName][idx] = { ...mockDb[this.tableName][idx], ...entity };
    else mockDb[this.tableName].push(entity);
  }

  async updateEntity(entity, mode) {
    await this.upsertEntity(entity);
  }

  async deleteEntity(partitionKey, rowKey) {
    const idx = mockDb[this.tableName].findIndex(i => i.partitionKey === partitionKey && i.rowKey === rowKey);
    if (idx >= 0) mockDb[this.tableName].splice(idx, 1);
  }

  async *listEntities({ queryOptions }) {
    let items = mockDb[this.tableName];
    if (queryOptions && queryOptions.filter) {
      const match = queryOptions.filter.match(/PartitionKey eq '(.+?)'/);
      if (match) {
        const key = match[1].replace(/''/g, "'");
        items = items.filter(i => i.partitionKey === key);
      }
    }
    for (const item of items) yield item;
  }
}

// --- Azure Tables Helpers ---
function getTableClient(tableName) {
  if (!STORAGE_CONNECTION_STRING) {
    return new MockTableClient(tableName);
  }
  return TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, tableName);
}

async function ensureTablesExist() {
  const tables = [TABLE_NAME_ENTRIES, TABLE_NAME_USERS, TABLE_NAME_CONFIG];
  for (const t of tables) {
    try {
      const client = getTableClient(t);
      await client.createTable();
    } catch (err) {
      if (!/TableAlreadyExists/i.test(err.message)) console.error(`Error ensuring table ${t}:`, err);
    }
  }
}

async function isFirstUser() {
  const client = getTableClient(TABLE_NAME_USERS);
  const iter = client.listEntities({ queryOptions: { filter: "RowKey eq 'profile'" } });
  const first = await iter.next();
  return first.done; 
}

if (!STORAGE_CONNECTION_STRING) {
  console.warn('⚠️ No STORAGE_CONNECTION_STRING. Using In-Memory Mock Database.');
} else {
  ensureTablesExist();
}

// --- Helper Functions ---
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

async function sendEmail(to, subject, text) {
  if (!mailTransporter) {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`);
    return;
  }
  
  try {
    await mailTransporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Espa TV Auth'}" <${SENDGRID_FROM_EMAIL}>`, // Use configured sender
      to,
      subject,
      text,
      html: `<strong>${text}</strong>`,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (error) {
    console.error('❌ SMTP Error:', error);
    throw new Error('Email sending failed');
  }
}

// --- Middleware: Verify JWT ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Auth API Endpoints ---

// 1. Lookup
app.post('/auth/lookup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const client = getTableClient(TABLE_NAME_USERS);
    const user = await client.getEntity(email, 'profile');
    return res.json({ exists: true, isAdmin: !!user.isAdmin });
  } catch (err) {
    if (err.statusCode === 404) return res.json({ exists: false });
    console.error('Lookup error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// 2. Send OTP
app.post('/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const otp = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000; 

  try {
    const client = getTableClient(TABLE_NAME_USERS);
    await client.upsertEntity({
      partitionKey: email,
      rowKey: 'otp',
      code: otp,
      expires
    });

    await sendEmail(email, 'Your Espa TV Code', `Your verification code is: ${otp}`);
    return res.json({ ok: true, message: 'OTP sent' });
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// 3. Verify OTP
app.post('/auth/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Missing fields' });

  try {
    const client = getTableClient(TABLE_NAME_USERS);
    const otpEntity = await client.getEntity(email, 'otp');

    if (!otpEntity || String(otpEntity.code) !== String(code)) {
      return res.status(401).json({ error: 'Invalid code' });
    }
    if (Date.now() > otpEntity.expires) {
      return res.status(401).json({ error: 'Code expired' });
    }

    const setupToken = jwt.sign({ email, purpose: 'setup' }, JWT_SECRET, { expiresIn: '15m' });
    await client.deleteEntity(email, 'otp');

    return res.json({ ok: true, setupToken });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// 4. Set PIN
app.post('/auth/set-pin', async (req, res) => {
  const { pin, setupToken } = req.body;
  if (!pin || !setupToken) return res.status(400).json({ error: 'Missing fields' });
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' });

  try {
    const decoded = jwt.verify(setupToken, JWT_SECRET);
    if (decoded.purpose !== 'setup') return res.status(403).json({ error: 'Invalid token purpose' });

    const email = decoded.email;
    const pinHash = await bcrypt.hash(pin, 10);

    const client = getTableClient(TABLE_NAME_USERS);
    
    // Check if this is the FIRST user ever
    const makeAdmin = await isFirstUser();

    // Create Profile
    await client.upsertEntity({
      partitionKey: email,
      rowKey: 'profile',
      pinHash,
      isAdmin: makeAdmin, // Set admin flag if first user
      failedAttempts: 0,
      lockedUntil: 0
    });

    const token = jwt.sign({ email, isAdmin: makeAdmin }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ ok: true, token, email, isAdmin: makeAdmin });

  } catch (err) {
    console.error('Set PIN error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
});

// 5. Login
app.post('/auth/login', async (req, res) => {
  const { email, pin } = req.body;
  if (!email || !pin) return res.status(400).json({ error: 'Missing fields' });

  try {
    const client = getTableClient(TABLE_NAME_USERS);
    const user = await client.getEntity(email, 'profile');

    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      const waitMinutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Account locked. Try again in ${waitMinutes} minutes.` });
    }

    const match = await bcrypt.compare(pin, user.pinHash);
    
    if (!match) {
      const attempts = (user.failedAttempts || 0) + 1;
      let lockedUntil = user.lockedUntil || 0;
      if (attempts >= 3) lockedUntil = Date.now() + 15 * 60 * 1000;

      await client.updateEntity({
        partitionKey: email,
        rowKey: 'profile',
        failedAttempts: attempts,
        lockedUntil: lockedUntil
      }, "Merge");

      return res.status(401).json({ error: attempts >= 3 ? 'Locked. Too many failed attempts.' : 'Invalid PIN' });
    }

    // Success
    if (user.failedAttempts > 0) {
      await client.updateEntity({ partitionKey: email, rowKey: 'profile', failedAttempts: 0, lockedUntil: 0 }, "Merge");
    }

    const token = jwt.sign({ email, isAdmin: !!user.isAdmin }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ ok: true, token, email, isAdmin: !!user.isAdmin });

  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'User not found' });
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});


// --- Config Endpoints (Coordinates) ---

// GET /config/coordinates (Public for RPi, but could be auth'd)
app.get('/config/coordinates', async (req, res) => {
  try {
    const client = getTableClient(TABLE_NAME_CONFIG);
    const entity = await client.getEntity('global', 'coordinates');
    // Azure tables stores JSON as string, parse it back
    return res.json(JSON.parse(entity.config));
  } catch (err) {
    // Return defaults if not found
    return res.json({
      1280: { play: { x: 63, y: 681 }, fullscreen: { x: 1136, y: 678 } },
      1920: { play: { x: 87, y: 1032 }, fullscreen: { x: 1771, y: 1032 } },
      3840: { play: { x: 114, y: 2124 }, fullscreen: { x: 3643, y: 2122 } }
    });
  }
});

// POST /config/coordinates (Admin Only)
app.post('/config/coordinates', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) return res.sendStatus(403);
  
  const newConfig = req.body; // Expect full JSON object
  if (!newConfig || !newConfig['1920']) return res.status(400).json({ error: 'Invalid config format' });

  try {
    const client = getTableClient(TABLE_NAME_CONFIG);
    await client.upsertEntity({
      partitionKey: 'global',
      rowKey: 'coordinates',
      config: JSON.stringify(newConfig)
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Config save error:', err);
    return res.status(500).json({ error: 'Failed to save config' });
  }
});


// --- App Endpoints ---
app.post('/entry', authenticateToken, async (req, res) => {
  try {
    const { key, value1, value2 } = req.body || {};
    if (!key || !value1) return res.status(400).json({ error: 'key and value1 required' });

    const title = (typeof value2 === 'string') ? value2.trim() : '';
    const timestamp = new Date().toISOString(); 
    const rowKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; 

    const client = getTableClient(TABLE_NAME_ENTRIES);
    await client.createEntity({
      partitionKey: key,
      rowKey,
      timestamp,
      value1,
      value2: title,
      createdBy: req.user.email
    });

    return res.status(201).json({ ok: true, timestamp });
  } catch (err) {
    console.error('POST /entry error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/entries/:key', authenticateToken, async (req, res) => {
  try {
    const key = req.params.key;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const client = getTableClient(TABLE_NAME_ENTRIES);
    const filter = `PartitionKey eq '${key.replace(/'/g, "''")}'`;
    
    const results = [];
    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      results.push({
        value1: entity.value1,
        value2: entity.value2,
        timestamp: entity.timestamp
      });
      if (results.length >= 200) break; 
    }

    results.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    return res.json(results.slice(0, 10));
  } catch (err) {
    console.error('GET /entries/:key error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`BBS listening on port ${port}`);
});
