require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./emailService');


const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('C:\\inetpub\\wwwroot'));

// ── DATABASE ──────────────────────────────────────
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const JWT_SECRET = process.env.JWT_SECRET;
const ADMINS = ['AbdulazizAlwabel', 'Abdulaziz'];

// ── HELPERS ───────────────────────────────────────
function createToken(userId, type, expiresInMinutes) {
  return new Promise((resolve, reject) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    db.query(
      'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
      [userId, token, type, expiresAt],
      (err) => { if (err) reject(err); else resolve(token); }
    );
  });
}

// ── MIDDLEWARE ────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!ADMINS.includes(decoded.username))
      return res.status(403).json({ error: 'Access denied' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ── AUTH ROUTES ───────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const hashed = await bcrypt.hash(password, 12);
    db.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashed],
      async (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Username or email already exists' });
          return res.status(500).json({ error: 'Database error' });
        }

        const newUserId = result.insertId;

        // Send verification email via Resend
        try {
          const verifyToken = await createToken(newUserId, 'verify_email', 1440); // 24h
          await sendVerificationEmail(email, username, verifyToken);
          console.log(`[Register] Verification email sent to ${email}`);
        } catch (mailErr) {
          console.error('[Register] Email failed:', mailErr.message);
        }

        res.json({ message: 'Account created! Check your email to verify.' });
      }
    );
  } catch (err) {
    console.error('[Register] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ message: 'Login successful', username: user.username });
  });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// ── EMAIL VERIFICATION ────────────────────────────
app.get('/api/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  db.query(
    'SELECT * FROM tokens WHERE token = ? AND type = "verify_email" AND used = 0 AND expires_at > NOW()',
    [token],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0)
        return res.status(400).json({ error: 'Invalid or expired link' });

      const { user_id, id } = results[0];
      db.query('UPDATE users SET verified = 1 WHERE id = ?', [user_id], (err2) => {
        if (err2) return res.status(500).json({ error: 'Database error' });
        db.query('UPDATE tokens SET used = 1 WHERE id = ?', [id]);
        res.redirect('https://nicelydone.qd.je?verified=1');
      });
    }
  );
});

// ── PASSWORD RESET ────────────────────────────────
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Always return same message to prevent email enumeration
  res.json({ message: 'If that email exists, a reset link has been sent.' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) return;
    const user = results[0];
    try {
      const resetToken = await createToken(user.id, 'reset_password', 60); // 1h
      await sendPasswordResetEmail(email, user.username, resetToken);
      console.log(`[ForgotPassword] Reset email sent to ${email}`);
    } catch (mailErr) {
      console.error('[ForgotPassword] Email failed:', mailErr.message);
    }
  });
});

app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  db.query(
    'SELECT * FROM tokens WHERE token = ? AND type = "reset_password" AND used = 0 AND expires_at > NOW()',
    [token],
    async (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0)
        return res.status(400).json({ error: 'Invalid or expired link' });

      const { user_id, id } = results[0];
      const hashed = await bcrypt.hash(password, 12);
      db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user_id], (err2) => {
        if (err2) return res.status(500).json({ error: 'Database error' });
        db.query('UPDATE tokens SET used = 1 WHERE id = ?', [id]);
        res.json({ message: 'Password reset successfully' });
      });
    }
  );
});

// ── PROFILE ROUTES ────────────────────────────────
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

app.get('/api/profile', authMiddleware, (req, res) => {
  db.query(
    'SELECT id, username, email, verified, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(results[0]);
    }
  );
});

app.put('/api/profile/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both fields are required' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });

  db.query('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const match = await bcrypt.compare(currentPassword, results[0].password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Password updated successfully' });
    });
  });
});

// ── ADMIN ROUTES ──────────────────────────────────
app.get('/api/admin/users', adminMiddleware, (req, res) => {
  db.query(
    'SELECT id, username, email, verified, created_at FROM users ORDER BY created_at DESC',
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results);
    }
  );
});

app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  });
});

app.put('/api/admin/users/:id/verify', adminMiddleware, (req, res) => {
  const { id } = req.params;
  db.query('UPDATE users SET verified = 1 WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User verified' });
  });
});

app.get('/api/admin/tokens', adminMiddleware, (req, res) => {
  db.query(
    `SELECT t.id, t.type, t.used, t.expires_at, t.created_at,
            u.username, u.email
     FROM tokens t
     JOIN users u ON t.user_id = u.id
     ORDER BY t.created_at DESC
     LIMIT 100`,
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(results);
    }
  );
});

// ── START ─────────────────────────────────────────
app.listen(process.env.PORT, () => {
  console.log(`[PassForge] Server running on port ${process.env.PORT}`);
});
