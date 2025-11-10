const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'cardslawpsecret',
  resave: false,
  saveUninitialized: true
}));

// ===== DATABASE =====
const db = new sqlite3.Database(path.join(__dirname, 'items.db'), (err) => {
  if (err) console.error(err);
  else console.log('✅ Connected to SQLite database.');
});

// Create table if not exists
db.run(`
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  description TEXT,
  price TEXT,
  image TEXT
)
`);

// ===== ADMIN LOGIN =====
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "password123";

app.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.send('Invalid credentials');
});

// ===== ROUTES =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cart.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin', (req, res) => {
  if (req.session.admin) res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  else res.redirect('/admin-login');
});

// ===== API =====

// Get all items
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add item
app.post('/api/items/add', (req, res) => {
  const { name, description, price, image } = req.body;
  if (!name || !description || !price || !image)
    return res.status(400).json({ error: 'All fields required' });

  db.run(
    'INSERT INTO items (name, description, price, image) VALUES (?, ?, ?, ?)',
    [name, description, price, image],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Delete item
app.post('/api/items/delete', (req, res) => {
  const { id } = req.body;
  db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ===== CART (IN-MEMORY) =====
let cart = [];

app.post('/api/cart/add', (req, res) => {
  const { id } = req.body;
  db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Item not found' });
    cart.push(row);
    res.json({ success: true, cart });
  });
});

app.get('/api/cart', (req, res) => res.json(cart));
app.post('/api/cart/clear', (req, res) => { cart = []; res.json({ success: true }); });

// ===== START SERVER =====
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));