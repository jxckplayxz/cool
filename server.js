// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cookieParser());

// Simple in-memory data (demo)
let PRODUCTS = [
  {
    id: 'amazon-25',
    name: 'Amazon Gift Card $25',
    price_cents: 2500,
    currency: 'usd',
    image: 'https://www.citypng.com/public/uploads/preview/set-of-25-50-75-amazon-gift-cards-png-1676489543x4h3h0.png'
  },
  {
    id: 'roblox-20',
    name: 'Roblox Gift Card $20',
    price_cents: 2000,
    currency: 'usd',
    image: 'https://www.pngegg.com/en/png-photos-uploads/41/8641369130qqtneqc9g0.png'
  },
  {
    id: 'google-15',
    name: 'Google Play $15',
    price_cents: 1500,
    currency: 'usd',
    image: 'https://www.pngegg.com/en/png-photos-uploads/73/11162398463o6p4y7fbmv.png'
  }
];

// In-memory users & verification codes (demo)
const SESSIONS = {}; // sessionId -> { email, phone, verifiedEmail, verifiedPhone }
const CODES = {}; // email/phone -> code

// Nodemailer setup (use env vars)
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  console.log('[mail] SMTP configured');
} else {
  console.log('[mail] SMTP not configured - email sending will be mocked');
}

// Twilio (SMS) client (optional)
let twilioClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
  twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('[sms] Twilio configured');
} else {
  console.log('[sms] Twilio not configured - SMS will be mocked');
}

// PayPal environment
let paypalClient = null;
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  const Environment = process.env.PAYPAL_MODE === 'live'
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;
  paypalClient = new paypal.core.PayPalHttpClient(
    new Environment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
  );
  console.log('[paypal] configured');
} else {
  console.log('[paypal] not configured - PayPal will fail until configured');
}

// Utility: create or get session via cookie
function getSession(req, res) {
  let sid = req.cookies['cardslawp_sid'];
  if (!sid || !SESSIONS[sid]) {
    sid = uuidv4();
    SESSIONS[sid] = { email: null, phone: null, verifiedEmail: false, verifiedPhone: false };
    res.cookie('cardslawp_sid', sid, { httpOnly: true });
  }
  return { sid, data: SESSIONS[sid] };
}

// --- API endpoints ---

// Get products
app.get('/api/products', (req, res) => {
  res.json(PRODUCTS);
});

// Add product (admin only)
app.post('/api/admin/add-product', (req, res) => {
  const { sid, data } = getSession(req, res);
  if (data.email !== 'admin@cardslawp.com') return res.status(403).json({ error: 'forbidden' });
  const { name, price_cents, currency, image } = req.body;
  const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random()*10000);
  const product = { id, name, price_cents: Number(price_cents), currency: currency || 'usd', image };
  PRODUCTS.push(product);
  res.json({ ok: true, product });
});

// Login (set email in session)
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  const { sid, data } = getSession(req, res);
  data.email = email;
  data.verifiedEmail = false;
  // generate code & send
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  CODES[email] = code;
  if (mailer) {
    mailer.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@cardslawp.com',
      to: email,
      subject: 'Your CardsLawP verification code',
      text: `Your verification code is: ${code}`
    }).catch(err => console.error('mail err', err));
    res.json({ ok: true, sent: true, message: 'Verification email sent (SMTP)' });
  } else {
    // mocked - return code in response for demo
    res.json({ ok: true, sent: false, code, message: 'SMTP not configured - code returned for demo' });
  }
});

// Verify email code
app.post('/api/verify-email', (req, res) => {
  const { code } = req.body;
  const { sid, data } = getSession(req, res);
  const stored = CODES[data.email];
  if (stored && stored === code) {
    data.verifiedEmail = true;
    delete CODES[data.email];
    return res.json({ ok: true });
  }
  return res.status(400).json({ error: 'invalid code' });
});

// Send phone code
app.post('/api/send-sms', (req, res) => {
  const { phone } = req.body;
  const { sid, data } = getSession(req, res);
  data.phone = phone;
  data.verifiedPhone = false;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  CODES[phone] = code;
  if (twilioClient) {
    twilioClient.messages.create({
      body: `Your CardsLawP verification code: ${code}`,
      from: process.env.TWILIO_FROM,
      to: phone
    }).then(() => res.json({ ok: true, sent: true })).catch(err => {
      console.error('twilio err', err);
      res.status(500).json({ ok: false, error: 'twilio error' });
    });
  } else {
    res.json({ ok: true, sent: false, code, message: 'Twilio not configured - code returned for demo' });
  }
});

// Verify phone
app.post('/api/verify-phone', (req, res) => {
  const { code } = req.body;
  const { sid, data } = getSession(req, res);
  const stored = CODES[data.phone];
  if (stored && stored === code) {
    data.verifiedPhone = true;
    delete CODES[data.phone];
    return res.json({ ok: true });
  }
  return res.status(400).json({ error: 'invalid code' });
});

// Create Stripe Checkout session for line items (expects array of {id,quantity})
app.post('/api/create-stripe-session', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const { items } = req.body;
  const line_items = items.map(it => {
    const p = PRODUCTS.find(x => x.id === it.id);
    return {
      price_data: {
        currency: p.currency,
        product_data: { name: p.name, images: [p.image] },
        unit_amount: p.price_cents
      },
      quantity: it.quantity || 1
    };
  });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: (process.env.SUCCESS_URL || 'http://localhost:3000') + '?success=true&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: (process.env.CANCEL_URL || 'http://localhost:3000') + '?canceled=true'
    });
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('stripe create err', err);
    res.status(500).json({ error: 'stripe error', details: err.message });
  }
});

// Create PayPal order
app.post('/api/create-paypal-order', async (req, res) => {
  if (!paypalClient) return res.status(500).json({ error: 'PayPal not configured' });
  const { items } = req.body;
  const purchase_units = [
    {
      amount: {
        currency_code: 'USD',
        value: (items.reduce((s, it) => {
          const p = PRODUCTS.find(x => x.id === it.id);
          return s + (p.price_cents/100) * (it.quantity || 1);
        }, 0)).toFixed(2),
        breakdown: {
          item_total: {
            currency_code: 'USD',
            value: (items.reduce((s, it) => {
              const p = PRODUCTS.find(x => x.id === it.id);
              return s + (p.price_cents/100) * (it.quantity || 1);
            }, 0)).toFixed(2)
          }
        }
      },
      items: items.map(it => {
        const p = PRODUCTS.find(x => x.id === it.id);
        return {
          name: p.name,
          unit_amount: { currency_code: 'USD', value: (p.price_cents/100).toFixed(2) },
          quantity: (it.quantity || 1).toString()
        };
      })
    }
  ];
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units
  });
  try {
    const order = await paypalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error('paypal create err', err);
    res.status(500).json({ error: 'paypal error', details: err.message });
  }
});

// Capture PayPal order (after client approval)
app.post('/api/capture-paypal-order', async (req, res) => {
  if (!paypalClient) return res.status(500).json({ error: 'PayPal not configured' });
  const { orderID } = req.body;
  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});
  try {
    const capture = await paypalClient.execute(request);
    res.json({ ok: true, capture: capture.result });
  } catch (err) {
    console.error('paypal capture', err);
    res.status(500).json({ error: 'capture failed', details: err.message });
  }
});

// get session info
app.get('/api/session', (req, res) => {
  const { sid, data } = getSession(req, res);
  res.json({ sid, data });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CardsLawP server running on port ${PORT}`);
});