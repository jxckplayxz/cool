// public/app.js
let PRODUCTS = [];
let CART = [];
let SESSION = null;

// fetch products
async function loadProducts() {
  const res = await fetch('/api/products');
  PRODUCTS = await res.json();
  renderProducts();
}

function renderProducts() {
  const el = document.getElementById('products');
  el.innerHTML = '';
  PRODUCTS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <div class="price">$${(p.price_cents/100).toFixed(2)}</div>
      <button class="add-btn" data-id="${p.id}">Add to cart</button>
    `;
    el.appendChild(card);
  });
  // add listeners
  document.querySelectorAll('.add-btn').forEach(b => b.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    addToCart(id);
  }));
  // run scroll fade in
  requestAnimationFrame(() => onScroll());
}

function addToCart(id) {
  const found = CART.find(x=>x.id===id);
  if (found) found.quantity++;
  else CART.push({ id, quantity: 1 });
  showToast('Added to cart');
  renderCart();
}

function renderCart() {
  const el = document.getElementById('cartItems');
  if (!el) return;
  el.innerHTML = '';
  CART.forEach(item => {
    const p = PRODUCTS.find(x => x.id === item.id);
    const row = document.createElement('div');
    row.style.display='flex'; row.style.justifyContent='space-between'; row.style.marginBottom='8px';
    row.innerHTML = `<div>${p.name} x${item.quantity}</div><div>$${((p.price_cents/100)*item.quantity).toFixed(2)}</div>`;
    el.appendChild(row);
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),2000);
}

// Tab switching
document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(tc=>tc.classList.add('hidden'));
    document.getElementById(tab).classList.remove('hidden');
  });
});

// login & session
async function loadSession() {
  const res = await fetch('/api/session');
  const json = await res.json();
  SESSION = json;
  // show admin add if admin email
  if (SESSION.data.email === 'admin@cardslawp.com') {
    document.getElementById('adminAdd').classList.remove('hidden');
  }
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = prompt('Enter your email (demo login)');
  if (!email) return;
  const r = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})});
  const res = await r.json();
  if (res.code) alert('Demo code: ' + res.code);
  alert('Login initiated. Check your email for code (or see console in demo).');
  await loadSession();
});

// send email code from profile
document.getElementById('sendEmailCode').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  if (!email) return alert('Enter email');
  await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})});
  alert('Code sent (or returned in response if SMTP not configured).');
  await loadSession();
});

// send sms
document.getElementById('sendSms').addEventListener('click', async ()=> {
  const phone = document.getElementById('phone').value;
  if (!phone) return alert('Enter phone');
  const r = await fetch('/api/send-sms', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone})});
  const j = await r.json();
  if (j.code) alert('Demo SMS code: ' + j.code);
  alert('SMS initiated.');
  await loadSession();
});

document.getElementById('verifyBtn').addEventListener('click', async ()=> {
  const code = document.getElementById('verifyCode').value;
  // Try verify email first, then phone
  let r = await fetch('/api/verify-email', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code})});
  if (r.ok) return alert('Email verified!');
  r = await fetch('/api/verify-phone', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code})});
  if (r.ok) return alert('Phone verified!');
  alert('Invalid code.');
});

// Admin: add product
document.getElementById('adminAddBtn').addEventListener('click', async ()=> {
  const name = document.getElementById('adminName').value;
  const price_cents = document.getElementById('adminPrice').value;
  const image = document.getElementById('adminImage').value;
  const res = await fetch('/api/admin/add-product',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({name, price_cents, image})});
  if (res.ok) {
    alert('Added product');
    const p = await res.json();
    await loadProducts();
  } else {
    alert('Add product failed (are you admin?)');
  }
});

// Stripe checkout
document.getElementById('stripeCheckout').addEventListener('click', async () => {
  if (CART.length === 0) return alert('Cart empty');
  const stripePublic = prompt('Enter STRIPE_PUBLIC_KEY for demo or leave blank to use env on server?');
  // create session on server
  const r = await fetch('/api/create-stripe-session', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({items:CART})});
  const j = await r.json();
  if (j.url) {
    // redirect to Stripe hosted checkout
    window.location = j.url;
  } else if (j.id && stripePublic) {
    const stripe = Stripe(stripePublic);
    stripe.redirectToCheckout({ sessionId: j.id });
  } else {
    alert('Stripe error: ' + JSON.stringify(j));
  }
});

// PayPal Buttons (client-side) - uses server to create order
function renderPayPal() {
  if (!window.paypal) return;
  paypal.Buttons({
    createOrder: function(data, actions) {
      // call server to create order
      return fetch('/api/create-paypal-order', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({items:CART})})
        .then(res => res.json())
        .then(data => data.id);
    },
    onApprove: function(data, actions) {
      // capture on server
      return fetch('/api/capture-paypal-order', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({orderID: data.orderID})})
        .then(res => res.json())
        .then(() => {
          alert('Payment successful (PayPal)');
        });
    }
  }).render('#paypal-button-container');
}

// simple scroll fade in/out
function onScroll() {
  document.querySelectorAll('.fade-in').forEach(el=>{
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 50 && rect.bottom > 100) el.classList.add('visible'); else el.classList.remove('visible');
  });
}
window.addEventListener('scroll', onScroll);

// init
(async function init(){
  await loadProducts();
  await loadSession();
  renderCart();
  renderPayPal();
})();