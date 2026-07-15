// frontend/js/layout.js

// Retained for backward compatibility. With clean URLs all links are now
// root-absolute (/shop, /product/:slug, …) so there is no base prefix.
function getBasePath() {
  return '';
}

function renderNav() {
  const nav     = document.getElementById('main-nav');
  if (!nav) return;

  // Active-nav detection from the clean path (/, /shop, /category/.., /product/..)
  const path = window.location.pathname;
  let current = 'index';
  if (path.startsWith('/shop') || path.startsWith('/category') || path.startsWith('/product')) current = 'shop';
  else if (path.startsWith('/about'))   current = 'about';
  else if (path.startsWith('/contact')) current = 'contact';

  const links = [
    { href: '/',        label: 'Home',    id: 'index'   },
    { href: '/shop',    label: 'Shop',    id: 'shop'    },
    { href: '/about',   label: 'About',   id: 'about'   },
    { href: '/contact', label: 'Contact', id: 'contact' },
  ];

  nav.innerHTML = `
    <a href="/" class="nav-logo">Dom<span>Dom</span></a>
    <ul class="nav-links">
      ${links.map(l =>
        `<li><a href="${l.href}" class="${current === l.id ? 'active' : ''}">${l.label}</a></li>`
      ).join('')}
    </ul>
    <div class="nav-right">
      <button class="nav-icon-btn" id="search-btn" title="Search">🔍</button>

      <!-- Wishlist icon with badge -->
      <a href="/wishlist" class="nav-icon-btn"
        style="position:relative;text-decoration:none" title="Wishlist">
        🤍
        <span id="wishlist-count" style="
          display:none;position:absolute;top:-4px;right:-4px;
          background:var(--rose);color:white;border-radius:50%;
          width:16px;height:16px;font-size:.6rem;font-weight:700;
          align-items:center;justify-content:center;">0</span>
      </a>

      <!-- Not logged in -->
      <button class="btn btn-outline btn-sm" id="nav-login-btn">Sign In</button>

      <!-- Logged in -->
      <div id="nav-user-menu" class="hidden"
        style="display:none;align-items:center;gap:.4rem;position:relative">

        <!-- Admin button — only for admins -->
        <a id="nav-admin-link" href="/admin"
          style="display:none;align-items:center;gap:.3rem;
            background:var(--charcoal);color:white;
            padding:.4rem .9rem;border-radius:var(--r-full);
            font-size:.75rem;font-weight:500;text-decoration:none;transition:background .2s"
          onmouseover="this.style.background='var(--rose)'"
          onmouseout="this.style.background='var(--charcoal)'">
          ⚙️ Admin
        </a>

        <!-- Account button -->
        <button id="account-avatar-btn"
          style="display:flex;align-items:center;gap:.4rem;
            background:var(--rose-light);color:var(--rose-dark);
            border:none;border-radius:var(--r-full);
            padding:.45rem 1rem;font-size:.85rem;font-weight:500;cursor:pointer">
          👤 <span id="nav-user-name">Me</span> ▾
        </button>

        <!-- Account Dropdown -->
        <div id="account-dropdown" style="
          display:none;position:absolute;top:calc(100% + .5rem);right:0;
          background:white;border-radius:var(--r-lg);box-shadow:var(--shadow-lg);
          min-width:220px;z-index:600;overflow:hidden;">
          <div style="padding:1.2rem 1.2rem .8rem;background:var(--cream);border-bottom:1px solid var(--nude)">
            <div style="font-size:.72rem;color:var(--muted);margin-bottom:.2rem">Signed in as</div>
            <div class="dd-user-name" style="font-weight:600;font-size:.9rem"></div>
            <div class="dd-user-email" style="font-size:.75rem;color:var(--muted)"></div>
          </div>
          <div style="padding:.4rem 0">
            <a href="/profile"  class="dd-menu-item">👤 My Profile</a>
            <a href="/orders"   class="dd-menu-item">📦 My Orders</a>
            <a href="/wishlist" class="dd-menu-item">❤️ My Wishlist</a>
            <div style="height:1px;background:var(--nude);margin:.4rem 0"></div>
            <a id="nav-admin-link-dd" href="/admin"
              class="dd-menu-item" style="display:none;color:var(--rose)">⚙️ Admin Dashboard</a>
            <button id="logout-btn" class="dd-menu-item"
              style="width:100%;text-align:left;background:none;border:none;
                color:var(--danger);cursor:pointer">🚪 Logout</button>
          </div>
        </div>
      </div>

      <button class="cart-nav-btn" id="cart-nav-btn">
        🛍 <span class="cart-count">0</span>
      </button>
      <button class="hamburger" id="hamburger-btn" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>`;

  // Dropdown styles
  if (!document.getElementById('dd-menu-style')) {
    const style = document.createElement('style');
    style.id = 'dd-menu-style';
   style.textContent = `
  .dd-menu-item {
    display:block;padding:.55rem 1.2rem;font-size:.875rem;
    color:var(--charcoal);text-decoration:none;
    transition:background .15s;cursor:pointer;
  }
  .dd-menu-item:hover { background:var(--cream); }
  #account-dropdown.open { display:block !important; }

  @media (max-width: 1024px) {
    .hamburger { display: flex !important; }
    .nav-links  { display: none  !important; }
  }
`;
    document.head.appendChild(style);
  }

  // Mobile menu
  let mob = document.getElementById('mobile-menu');
  if (!mob) {
    mob = document.createElement('div');
    mob.id = 'mobile-menu'; mob.className = 'mobile-menu';
    document.body.insertBefore(mob, nav.nextSibling);
  }
  mob.innerHTML = links.map(l => `<a href="${l.href}">${l.label}</a>`).join('') +
    `<div id="mobile-auth-links">
       <a onclick="Auth.openModal('login');document.getElementById('mobile-menu').classList.remove('open')" style="cursor:pointer">Sign In / Register</a>
     </div>`;

  document.getElementById('hamburger-btn')
    .addEventListener('click', () => mob.classList.toggle('open'));
  window.addEventListener('scroll', () =>
    nav.classList.toggle('scrolled', window.scrollY > 20));
}

function renderFooter() {
  const footer = document.getElementById('main-footer');
  if (!footer) return;
  footer.innerHTML = `
    <div class="footer-grid container">
      <div>
        <div class="footer-logo">Dom<span>Dom</span> Store</div>
        <p class="footer-about">Your destination for premium cruelty-free beauty.
          Empowering confidence, one product at a time.</p>
        <div class="footer-socials">
          <a href="https://www.facebook.com/share/g/1EPvx3Fu6L/?mibextid=wwXIfr" class="social-link" title="Facebook" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
            </svg>
          </a>
          <a href="https://www.instagram.com/domdom_store89?igsh=MWw3OGxzeTNsanFkMA%3D%3D&utm_source=qr" class="social-link" title="Instagram" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </a>
          <a href="https://maps.app.goo.gl/KNzfisWkXoVjbpSZ7" class="social-link" title="Location" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>  
          </a>
          <a href="https://wa.me/message/TB6OQ4U23JJKK1" class="social-link" title="WhatsApp" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <ul>
          <li><a href="/shop">All Products</a></li>
          <li><a href="/category/lips">Lips</a></li>
          <li><a href="/category/eyes">Eyes</a></li>
          <li><a href="/category/face">Face</a></li>
          <li><a href="/category/skincare">Skincare</a></li>
          <li><a href="/category/body">Body</a></li>
          <li><a href="/category/perfumes">Perfumes</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Help</h4>
        <ul>
          <li><a href="/contact">Contact Us</a></li>
          <li><a href="/contact#faq">Shipping & Returns</a></li>
          <li><a href="/orders">Track Order</a></li>
          <li><a href="/contact#faq">FAQ</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>About</h4>
        <ul>
          <li><a href="/about">Our Story</a></li>
          <li><a href="/privacy-policy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="/contact">Press</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom container">
      <span>© 2025 DomDom Store. All rights reserved.</span>
      <span><a href="/privacy-policy">Privacy Policy</a> · <a href="/terms">Terms</a> · <a href="/privacy-policy#cookies">Cookies</a></span>
    </div>`;
}

function renderCartSidebar() {
  if (document.getElementById('cart-sidebar')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="cart-overlay" id="cart-overlay"></div>
    <div class="cart-sidebar" id="cart-sidebar">
      <div class="cart-header">
        <h3>🛍 Your Cart</h3>
        <button class="nav-icon-btn" id="cart-close-btn">✕</button>
      </div>
      <div class="cart-items" id="cart-items"></div>
      <div class="cart-footer hidden" id="cart-footer">
        <div class="cart-total-row">
          <span>Subtotal</span>
          <span id="cart-subtotal">0 EGP</span>
        </div>
        <div class="cart-total-row">
          <span>Shipping</span>
          <span id="cart-shipping" style="font-size:.8rem;color:var(--muted)">Calculated at checkout</span>
        </div>
        <div class="cart-total-row grand">
          <span>Subtotal</span>
          <span id="cart-total">0 EGP</span>
        </div>
        <button class="btn btn-primary"
          style="width:100%;justify-content:center;margin-top:1rem"
          id="checkout-btn">Checkout →</button>
        <p style="font-size:.72rem;color:var(--muted);text-align:center;margin-top:.5rem">
          💵 Cash on Delivery · 🚚 Shipping based on city
        </p>
      </div>
    </div>`);
}

function renderAuthModal() {
  if (document.getElementById('auth-modal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay hidden" id="auth-modal">
      <div class="modal">
        <button class="modal-close" id="auth-modal-close">✕</button>
        <div class="auth-tabs">
          <div class="auth-tab active" data-tab="login">Sign In</div>
          <div class="auth-tab" data-tab="register">Create Account</div>
        </div>
        <div class="auth-form active" id="login-form">
          <form id="login-form-el">
            <div class="form-group"><label>Email</label>
              <input class="form-control" type="email" id="login-email"
                placeholder="you@example.com" required></div>
            <div class="form-group"><label>Password</label>
              <input class="form-control" type="password" id="login-password"
                placeholder="Password" required></div>
            <p class="form-error" id="login-error"></p>
            <button type="submit" class="btn btn-primary"
              style="width:100%;justify-content:center"
              id="login-submit-btn">Sign In</button>
          </form>
        </div>
        <div class="auth-form" id="register-form">
          <form id="register-form-el">
            <div class="form-group"><label>Full Name</label>
              <input class="form-control" type="text" id="reg-name"
                placeholder="Your name" required></div>
            <div class="form-group"><label>Email</label>
              <input class="form-control" type="email" id="reg-email"
                placeholder="you@example.com" required></div>
            <div class="form-group"><label>Password</label>
              <input class="form-control" type="password" id="reg-password"
                placeholder="Min 6 characters" minlength="6" required></div>
            <p class="form-error" id="reg-error"></p>
            <button type="submit" class="btn btn-primary"
              style="width:100%;justify-content:center"
              id="reg-submit-btn">Create Account</button>
          </form>
        </div>
      </div>
    </div>`);
}

// Global search entry point. It doesn't fetch on its own — submitting (Enter or
// the 🔍 button) redirects to the Shop page, which runs the actual search and
// renders the full filtered results. This keeps a single search code path and
// avoids per-keystroke requests.
function renderSearchOverlay() {
  if (document.getElementById('search-overlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="search-overlay hidden" id="search-overlay">
      <div class="search-box">
        <form class="search-input-row" id="nav-search-form" role="search">
          <input type="search" class="search-input" id="search-input"
            placeholder="Search products, brands, categories…"
            autocomplete="off" enterkeyhint="search" aria-label="Search products">
          <button type="submit" class="nav-icon-btn search-go-btn" aria-label="Search" title="Search">🔍</button>
          <button type="button" class="btn btn-outline btn-sm" id="search-close-btn" aria-label="Close">✕</button>
        </form>
        <p class="search-hint">Press Enter to see all matching products in the shop.</p>
      </div>
    </div>`);

  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  const form    = document.getElementById('nav-search-form');

  const open = () => {
    // Prefill with the active shop query so the user can refine it.
    input.value = new URLSearchParams(location.search).get('search') || '';
    overlay.classList.remove('hidden');
    setTimeout(() => { input.focus(); input.select(); }, 0);
  };
  const close = () => overlay.classList.add('hidden');

  document.getElementById('search-btn')?.addEventListener('click', open);
  document.getElementById('search-close-btn')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    close();
    // Empty query clears the search; otherwise land on the filtered shop.
    window.location.href = q ? `/shop?search=${encodeURIComponent(q)}` : '/shop';
  });
}

function syncAdminLinks() {
  const isAdmin = Auth.isAdmin();
  const ddLink  = document.getElementById('nav-admin-link-dd');
  if (ddLink) ddLink.style.display = isAdmin ? 'block' : 'none';
}

function syncMobileAuth() {
  const el      = document.getElementById('mobile-auth-links');
  if (!el) return;
  const user    = Auth.getUser();
  if (user) {
    const adminLink = Auth.isAdmin()
      ? `<a href="/admin" style="color:var(--rose)">⚙️ Admin Dashboard</a>`
      : '';
    el.innerHTML = `
      <a href="/profile">👤 My Profile</a>
      <a href="/orders">📦 My Orders</a>
      <a href="/wishlist">❤️ My Wishlist</a>
      ${adminLink}
      <a onclick="Auth.logout()" style="cursor:pointer;color:var(--rose)">🚪 Logout</a>`;
  } else {
    el.innerHTML = `<a onclick="Auth.openModal('login');document.getElementById('mobile-menu').classList.remove('open')" style="cursor:pointer">Sign In / Register</a>`;
  }
}

function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}

// Reflect the admin-configured free-shipping threshold in any storefront banner
// that opts in with a `.free-ship-amount` span. Defaults stay if the fetch fails.
async function syncFreeShipping() {
  const els = document.querySelectorAll('.free-ship-amount');
  if (!els.length) return;
  try {
    const d = await API.getSettings();
    const n = parseInt(d.settings?.free_shipping_threshold, 10);
    if (Number.isFinite(n)) els.forEach(el => { el.textContent = n; });
  } catch {}
}

async function initLayout() {
  renderNav();
  renderFooter();
  renderCartSidebar();
  renderAuthModal();
  renderSearchOverlay();
  Auth.bind();
  await Auth.init();
  syncAdminLinks();
  syncMobileAuth();
  Cart.bind();
  Cart.render();
  initReveal();
  syncFreeShipping();
}

window.getBasePath    = getBasePath;
window.initLayout     = initLayout;
window.initReveal     = initReveal;
window.syncAdminLinks = syncAdminLinks;
window.syncMobileAuth = syncMobileAuth;
