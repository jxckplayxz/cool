const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Admin Password =====
const ADMIN_PASSWORD = "Cardslawp123."; // change this

// ===== MySQL Connection =====
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "cards",       // your MySQL password
  database: "cardslawp" // make sure DB exists
});

db.connect(err=>{
  if(err) console.error("DB connection error:", err);
  else console.log("Connected to MySQL DB!");
});

// ===== Middleware =====
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'cardslawp-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// ===== Routes =====

// Home page
app.get('/', (req,res)=> res.sendFile(path.join(__dirname, 'public/index.html')));

// Cart page
app.get('/cart', (req,res)=> res.sendFile(path.join(__dirname, 'public/cart.html')));

// Admin login page
app.get('/admin', (req,res)=>{
  if(req.session.isAdmin) return res.sendFile(path.join(__dirname, 'public/admin.html'));
  res.send(`
    <form method="POST" action="/admin">
      <h2>Admin Login</h2>
      <input type="password" name="password" placeholder="Enter password" required/>
      <button type="submit">Login</button>
    </form>
  `);
});

// Admin login POST
app.post('/admin', (req,res)=>{
  const { password } = req.body;
  if(password === ADMIN_PASSWORD){
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.send('❌ Wrong password!');
});

// ===== API =====

// Get all items
app.get('/api/items', (req,res)=>{
  db.query('SELECT * FROM items', (err, results)=>{
    if(err) return res.json({success:false,error:err});
    res.json(results);
  });
});

// Add new item (Admin only)
app.post('/api/items/add', (req,res)=>{
  if(!req.session.isAdmin) return res.json({success:false,error:"Unauthorized"});
  
  const { name, description, price, image } = req.body;
  if(!name || !description || !price || !image) 
    return res.json({success:false,error:"Missing fields"});

  const sql = 'INSERT INTO items (name, description, price, image) VALUES (?,?,?,?)';
  db.query(sql, [name, description, price, image], (err, result)=>{
    if(err) return res.json({success:false,error:err});
    res.json({success:true, item: {id: result.insertId, name, description, price, image}});
  });
});

app.listen(PORT, ()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});