// server.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// ===== SESSION =====
app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: true
}));

// ===== STORAGE =====
let items = []; // Admin will add items
let cart = [];

// ===== ROUTES =====

// Home page
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Login page
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// Cart page
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cart.html')));

// Admin login page
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));

// Admin panel page
app.get('/admin', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin-login');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin login POST
const ADMIN_USERNAME = "admin";       // change your admin username
const ADMIN_PASSWORD = "password123"; // change your admin password

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
  if (!name || !description || !price || !image) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const newItem = {
    _id: Date.now().toString(),
    name,
    description,
    price,
    image
  };
  items.push(newItem);
  res.json({ success: true, item: newItem });
});

// Delete item (admin only)
app.post('/api/items/delete', (req, res) => {
  if (!req.session.admin) return res.status(403).json({ error: 'Not authorized' });
  const { id } = req.body;
  items = items.filter(item => item._id !== id);
  res.json({ success: true });
});

// Add to cart
app.post('/api/cart/add', (req, res) => {
  const { id } = req.body;
  const item = items.find(i => i._id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  cart.push(item);
  res.json({ success: true, cart });
});

// Get cart items
app.get('/api/cart', (req, res) => res.json(cart));

// Clear cart
app.post('/api/cart/clear', (req, res) => { cart = []; res.json({ success: true }); });

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});