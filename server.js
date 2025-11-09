import express from "express";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import paypal from "@paypal/checkout-server-sdk";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(express.static("public"));
app.use(bodyParser.json());

const productsPath = path.join(__dirname, "products.json");
const ordersPath = path.join(__dirname, "orders.json");
if (!fs.existsSync(productsPath)) fs.writeFileSync(productsPath, "[]");
if (!fs.existsSync(ordersPath)) fs.writeFileSync(ordersPath, "[]");

// ✅ PayPal setup
const Environment =
  process.env.NODE_ENV === "production"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(
  new Environment(
    process.env.PAYPAL_CLIENT_ID || "YOUR_SANDBOX_CLIENT_ID",
    process.env.PAYPAL_SECRET || "YOUR_SANDBOX_SECRET"
  )
);

// 🛍️ Get products
app.get("/api/products", (req, res) => {
  const products = JSON.parse(fs.readFileSync(productsPath));
  res.json(products);
});

// 🔑 Admin login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "admin@cardslawp.com" && password === "admin123") {
    return res.json({ success: true, admin: true });
  }
  res.json({ success: true, admin: false });
});

// 🛒 Add item (admin only)
app.post("/api/add-item", (req, res) => {
  const { email, name, image, desc, price } = req.body;
  if (email !== "admin@cardslawp.com") return res.status(403).json({ error: "Unauthorized" });

  const products = JSON.parse(fs.readFileSync(productsPath));
  products.push({ name, image, desc, price });
  fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
  res.json({ success: true });
});

// 💸 Create PayPal order
app.post("/api/create-order", async (req, res) => {
  const { cart, buyerEmail } = req.body;
  const total = cart.reduce((sum, item) => sum + Number(item.price), 0);

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: total.toFixed(2),
        },
        payee: {
          email_address: "zxueondrugz@gmail.com", // your receiving PayPal email
        },
      },
    ],
  });

  try {
    const order = await paypalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating order");
  }
});

// ✅ Capture payment and log purchase
app.post("/api/capture-order", async (req, res) => {
  const { orderID, buyerEmail, cart } = req.body;

  try {
    const captureRequest = new paypal.orders.OrdersCaptureRequest(orderID);
    captureRequest.requestBody({});
    const capture = await paypalClient.execute(captureRequest);

    const orders = JSON.parse(fs.readFileSync(ordersPath));
    orders.push({
      buyerEmail,
      cart,
      date: new Date().toISOString(),
      status: "Completed",
    });
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

    res.json({ success: true, message: "Purchase recorded!" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error capturing order");
  }
});

// 📋 Admin check purchases
app.get("/api/orders", (req, res) => {
  const orders = JSON.parse(fs.readFileSync(ordersPath));
  res.json(orders);
});

app.listen(PORT, () => console.log(`✅ CardsLawp server running on ${PORT}`));