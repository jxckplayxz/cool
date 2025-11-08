// === CardsLawp Gift Card Store ===
// Express server with Stripe + PayPal checkout
// No verification required (clean + deployable)

import express from "express";
import path from "path";
import bodyParser from "body-parser";
import session from "express-session";
import Stripe from "stripe";
import paypal from "@paypal/checkout-server-sdk";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// === Stripe Setup ===
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// === PayPal Setup ===
const Environment =
  process.env.PAYPAL_MODE === "live"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;
const paypalClient = new paypal.core.PayPalHttpClient(
  new Environment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
);

// === Middleware ===
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(express.static("public"));

// === Simulated Database (JSON file) ===
const dataFile = path.join("data", "giftcards.json");
if (!fs.existsSync("data")) fs.mkdirSync("data");
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf-8");

function readCards() {
  return JSON.parse(fs.readFileSync(dataFile, "utf-8"));
}
function saveCards(cards) {
  fs.writeFileSync(dataFile, JSON.stringify(cards, null, 2));
}

// === Routes ===

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// API to get all cards
app.get("/api/cards", (req, res) => {
  res.json(readCards());
});

// Admin login (simple)
app.post("/login", (req, res) => {
  const { email } = req.body;
  if (email === process.env.ADMIN_EMAIL) {
    req.session.admin = true;
    return res.json({ success: true, message: "Admin logged in" });
  }
  req.session.admin = false;
  res.json({ success: true, message: "Logged in as user" });
});

// Add new gift card (admin only)
app.post("/api/add-card", (req, res) => {
  if (!req.session.admin)
    return res.status(403).json({ error: "Not authorized" });

  const { name, image, price } = req.body;
  const cards = readCards();
  const newCard = {
    id: Date.now(),
    name,
    image,
    price: parseFloat(price),
  };
  cards.push(newCard);
  saveCards(cards);
  res.json({ success: true, card: newCard });
});

// === Stripe Checkout ===
app.post("/api/checkout/stripe", async (req, res) => {
  try {
    const { items } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      success_url: `${process.env.SITE_URL}/success.html`,
      cancel_url: `${process.env.SITE_URL}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: "Payment failed" });
  }
});

// === PayPal Checkout ===
app.post("/api/checkout/paypal", async (req, res) => {
  const { items } = req.body;

  const total = items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  ).toFixed(2);

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: { currency_code: "USD", value: total },
      },
    ],
  });

  try {
    const order = await paypalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PayPal checkout failed" });
  }
});

// === Success / Cancel pages ===
app.get("/success", (req, res) => {
  res.send("<h1>✅ Payment Successful! Thank you for shopping with CardsLawp.</h1>");
});

app.get("/cancel", (req, res) => {
  res.send("<h1>❌ Payment canceled. You can try again.</h1>");
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`CardsLawp server running on port ${PORT}`);
});