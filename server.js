// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== STORAGE =====
const ITEMS_FILE = path.join(__dirname, 'items.json');
let items = [];

// Load items from JSON if exists
if (fs.existsSync(ITEMS_FILE)) {
  items = JSON.parse(fs.readFileSync(ITEMS_FILE));
}

// Save items to JSON
function saveItems() {
  fs.writeFileSync(ITEMS_FILE, JSON.stringify(items, null, 2));
}

// In-memory cart (reset on server restart)
let cart = [];

// ===== ROUTES =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cart.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ===== ADMIN LOGIN (NO SESSION) =====
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "password123";

app.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.redirect('/admin');
  }
  res.send('Invalid credentials');
});

// ===== API =====

// Get items
app.get('/api/items', (req, res) => res.json(items));

// Add item
app.post('/api/items/add', (req, res) => {
  const { name, description, price, image } = req.body;
  if (!name || !description || !price || !image)
    return res.status(400).json({ error: 'All fields are required' });

  const newItem = { _id: Date.now().toString(), name, description, price, image };
  items.push(newItem);
  saveItems();
  res.json({ success: true, item: newItem });
});

// Delete item
app.post('/api/items/delete', (req, res) => {
  const { id } = req.body;
  items = items.filter(item => item._id !== id);
  saveItems();
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

// Get cart
app.get('/api/cart', (req, res) => res.json(cart));

// Clear cart
app.post('/api/cart/clear', (req, res) => { cart = []; res.json({ success: true }); });

// ===== START SERVER =====
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));