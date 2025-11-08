import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "cardslawp_secret",
    resave: false,
    saveUninitialized: true,
  })
);

// Temporary in-memory database
let giftCards = [];
let giftRequests = [];

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Get all cards
app.get("/api/cards", (req, res) => {
  res.json(giftCards);
});

// Submit gift card request (non-admin)
app.post("/api/request", (req, res) => {
  const { name, image, description } = req.body;
  if (!name || !image || !description)
    return res.status(400).json({ error: "Missing fields" });

  giftRequests.push({
    id: Date.now(),
    name,
    image,
    description,
    approved: false,
  });
  res.json({ message: "Request submitted for admin approval" });
});

// Admin login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "admin.cardslawp.com" && password === "admin123") {
    req.session.admin = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Invalid login" });
});

// Admin adds approved card
app.post("/api/admin/add", (req, res) => {
  if (!req.session.admin)
    return res.status(403).json({ error: "Unauthorized" });

  const { name, image, description } = req.body;
  if (!name || !image || !description)
    return res.status(400).json({ error: "Missing fields" });

  giftCards.push({ id: Date.now(), name, image, description });
  res.json({ message: "Gift card added!" });
});

// Admin view requests
app.get("/api/admin/requests", (req, res) => {
  if (!req.session.admin)
    return res.status(403).json({ error: "Unauthorized" });
  res.json(giftRequests);
});

// Approve request
app.post("/api/admin/approve/:id", (req, res) => {
  if (!req.session.admin)
    return res.status(403).json({ error: "Unauthorized" });

  const reqId = parseInt(req.params.id);
  const request = giftRequests.find((r) => r.id === reqId);
  if (!request) return res.status(404).json({ error: "Request not found" });

  request.approved = true;
  giftCards.push({
    id: Date.now(),
    name: request.name,
    image: request.image,
    description: request.description,
  });

  res.json({ message: "Request approved!" });
});

// Deny request
app.post("/api/admin/deny/:id", (req, res) => {
  if (!req.session.admin)
    return res.status(403).json({ error: "Unauthorized" });
  giftRequests = giftRequests.filter((r) => r.id !== parseInt(req.params.id));
  res.json({ message: "Request denied and removed" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CardsLawp running on port ${PORT}`));