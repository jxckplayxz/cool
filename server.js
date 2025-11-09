const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session for admin login
app.use(session({
  secret: 'supersecretkey', 
  resave: false, 
  saveUninitialized: true
}));

// ===== IN-MEMORY STORAGE =====
let items = [];
let cart = [];

// ===== ROUTES =====

// Home page
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Login page
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// Cart page
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'cart.html')));

// Admin page (add items)
app.get('/admin', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin-login');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin login page
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));

// Admin login POST
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "password123"; // change this

app.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.send('Invalid credentials');
});

// Admin logout
app.get('/admin-logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ===== API =====

// Get items
app.get('/api/items', (req, res) => res.json(items));

// Add item (admin only)
app.post('/api/items/add', (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: 'Not authorized' });
  const { name, description, price, image } = req.body;
  const newItem = {
    _id: Date.now().toString(),
    name, description, price, image
  };
  items.push(newItem);
  res.json({ success: true, item: newItem });
});

// Cart API
app.post('/api/cart/add', (req, res) => {
  const { id } = req.body;
  const item = items.find(i => i._id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  cart.push(item);
  res.json({ success: true, cart });
});

app.get('/api/cart', (req, res) => res.json(cart));
app.post('/api/cart/clear', (req, res) => { cart = []; res.json({ success: true }); });

// ===== START SERVER =====
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));