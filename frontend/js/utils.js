// frontend/js/utils.js — Toast, Auth, Cart  (EGP currency)

// ══════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════
const Toast = (() => {
  function show(msg, type = 'info', duration = 3500) {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
    }
    const icons = { success: '✅', error: '❌', info: '💬' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type] || '💬'}</span><span>${msg}</span>`;
    el.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      t.style.transition = '.3s';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }
  return { show };
})();
window.Toast = Toast;

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════
const Auth = (() => {
  let currentUser = null;

  function token()     { return localStorage.getItem('dd_token'); }
  function getUser()   { return currentUser; }
  function isLoggedIn(){ return !!token(); }
  function isAdmin()   { return currentUser?.role === 'admin'; }

  async function init() {
    if (!token()) return updateUI();
    try {
      const d = await API.me();
      currentUser = d.user;
    } catch {
      logout(false);
    }
    updateUI();
  }

  function login(user, tkn) {
    localStorage.setItem('dd_token', tkn);
    localStorage.setItem('dd_user', JSON.stringify(user));
    currentUser = user;
    updateUI();
  }

  function logout(redirect = true) {
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_user');
    currentUser = null;
    updateUI();
    closeAccountDropdown();
    if (redirect) {
      Toast.show('Logged out successfully', 'info');
      setTimeout(() => window.location.href = '/', 800);
    }
  }

  function updateUI() {
    const loginBtn  = document.getElementById('nav-login-btn');
    const userMenu  = document.getElementById('nav-user-menu');
    const nameEl    = document.getElementById('nav-user-name');
    const adminLink = document.getElementById('nav-admin-link');
    const wishBadge = document.getElementById('wishlist-count');

    if (!loginBtn) return;

    if (isLoggedIn() && currentUser) {
      loginBtn.classList.add('hidden');
      if (userMenu) { userMenu.classList.remove('hidden'); userMenu.style.display = 'flex'; }
      if (nameEl)   nameEl.textContent = currentUser.name.split(' ')[0];
      if (adminLink) adminLink.style.display = isAdmin() ? 'flex' : 'none';
      if (wishBadge && currentUser.wishlist) {
        const count = Array.isArray(currentUser.wishlist) ? currentUser.wishlist.length : 0;
        wishBadge.textContent = count;
        wishBadge.style.display = count > 0 ? 'flex' : 'none';
      }
    } else {
      loginBtn.classList.remove('hidden');
      if (userMenu) { userMenu.classList.add('hidden'); userMenu.style.display = 'none'; }
      if (adminLink) adminLink.style.display = 'none';
      if (wishBadge) wishBadge.style.display = 'none';
    }
  }

  function openModal(tab = 'login') {
    const m = document.getElementById('auth-modal');
    if (!m) return;
    m.classList.remove('hidden');
    document.querySelectorAll('.auth-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f =>
      f.classList.toggle('active', f.id === `${tab}-form`));
  }

  function closeModal() {
    document.getElementById('auth-modal')?.classList.add('hidden');
  }

  function openAccountDropdown() {
    const dd = document.getElementById('account-dropdown');
    if (!dd) return;
    if (!isLoggedIn()) { openModal('login'); return; }
    dd.classList.toggle('open');
    if (currentUser) {
      const nameEl  = dd.querySelector('.dd-user-name');
      const emailEl = dd.querySelector('.dd-user-email');
      if (nameEl)  nameEl.textContent  = currentUser.name;
      if (emailEl) emailEl.textContent = currentUser.email;
    }
  }

  function closeAccountDropdown() {
    document.getElementById('account-dropdown')?.classList.remove('open');
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-submit-btn');
    const errEl    = document.getElementById('login-error');
    btn.disabled = true; btn.textContent = 'Signing in…'; errEl.textContent = '';
    try {
      const d = await API.login(email, password);
      login(d.user, d.token);
      closeModal();
      Toast.show(`Welcome back, ${d.user.name.split(' ')[0]}! 🌸`, 'success');
    } catch (err) { errEl.textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = 'Sign In'; }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const name     = document.getElementById('reg-name').value;
    const email    = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const btn      = document.getElementById('reg-submit-btn');
    const errEl    = document.getElementById('reg-error');
    btn.disabled = true; btn.textContent = 'Creating…'; errEl.textContent = '';
    try {
      const d = await API.register(name, email, password);
      login(d.user, d.token);
      closeModal();
      Toast.show(`Welcome, ${d.user.name.split(' ')[0]}! 🎉`, 'success');
    } catch (err) { errEl.textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = 'Create Account'; }
  }

  function bind() {
    document.getElementById('nav-login-btn')?.addEventListener('click', () => openModal('login'));
    document.getElementById('auth-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('auth-modal')?.addEventListener('click', e => {
      if (e.target.id === 'auth-modal') closeModal();
    });
    document.querySelectorAll('.auth-tab').forEach(t =>
      t.addEventListener('click', () => openModal(t.dataset.tab)));
    document.getElementById('login-form-el')?.addEventListener('submit',    handleLogin);
    document.getElementById('register-form-el')?.addEventListener('submit', handleRegister);
    document.getElementById('logout-btn')?.addEventListener('click', () => logout());
    document.getElementById('account-avatar-btn')?.addEventListener('click', openAccountDropdown);
    document.getElementById('nav-user-name')?.addEventListener('click', openAccountDropdown);
    document.addEventListener('click', e => {
      const dd  = document.getElementById('account-dropdown');
      const btn = document.getElementById('account-avatar-btn') ||
                  document.getElementById('nav-user-name');
      if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
        closeAccountDropdown();
      }
    });
  }

  return { init, login, logout, isLoggedIn, isAdmin, getUser, openModal, closeModal, openAccountDropdown, bind };
})();
window.Auth = Auth;

// ══════════════════════════════════════════════
// CART  (EGP currency)
// ══════════════════════════════════════════════
const Cart = (() => {
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem('dd_cart') || '[]');
  } catch { items = []; }
  // Migrate any pre-variant cart lines (no `key`/`variantId`) so each one
  // gets a stable composite key and survives the new uniqueness rules.
  items = items.map(normalizeLine).filter(Boolean);

  // A cart line is unique per product + variant (color). Different colors of
  // the same product are distinct lines; the same variant stacks quantity.
  function lineKey(productId, variantId, colorName) {
    return `${productId}::${variantId || colorName || 'default'}`;
  }

  function normalizeLine(i) {
    if (!i || !i.id) return null;
    const variantId = i.variantId || '';
    const colorName = i.colorName || '';
    return {
      key:       i.key || lineKey(i.id, variantId, colorName),
      id:        String(i.id),
      variantId,
      name:      i.name      || 'Product',
      emoji:     i.emoji     || '✨',
      photo:     i.photo     || null,
      price:     parseFloat(i.price) || 0,
      colorName,
      colorHex:  i.colorHex  || '',
      quantity:  Math.max(1, parseInt(i.quantity) || 1)
    };
  }

  function save()      { localStorage.setItem('dd_cart', JSON.stringify(items)); updateCount(); }
  function getItems()  { return items; }
  function getCount()  { return items.reduce((s, i) => s + i.quantity, 0); }
  function getSubtotal(){ return items.reduce((s, i) => s + (i.price * i.quantity), 0); }

  function pid(product) { return String(product._id || product.id || ''); }

  // Resolve which color variant is being added. The product page sets
  // `selectedVariantId`/`selectedColor`; list pages (shop/index/wishlist)
  // pass a bare product → default to the first color.
  function resolveVariant(product) {
    const colors = Array.isArray(product.colors) ? product.colors : [];
    let color = null;
    if (product.selectedVariantId)
      color = colors.find(c => String(c._id || c.id) === String(product.selectedVariantId));
    if (!color && product.selectedColor)
      color = colors.find(c => c.name === product.selectedColor);
    if (!color) color = colors[0] || null;

    // A color with no hex is an auto image-holder for a color-less product,
    // not a real shade — keep its photo but don't surface it as a variant.
    const isPlaceholder = !!color && !(color.hex && String(color.hex).trim());

    return {
      variantId: (color && !isPlaceholder) ? String(color._id || color.id || '') : '',
      colorName: (color && !isPlaceholder) ? (color.name || '') : (isPlaceholder ? '' : (product.selectedColor || '')),
      colorHex:  (color && !isPlaceholder) ? (color.hex || '') : '',
      photo:     (color && color.images && color.images[0]) || getProductImage(product)
    };
  }

  function add(product, qty = 1) {
    if (!product) return;
    const id = pid(product);
    if (!id) return Toast.show('Invalid product', 'error');

    const v   = resolveVariant(product);
    const key = lineKey(id, v.variantId, v.colorName);

    const ex = items.find(i => i.key === key);
    if (ex) {
      ex.quantity += qty;
    } else {
      items.push({
        key,
        id,
        variantId: v.variantId,
        name:      product.name  || 'Product',
        emoji:     product.emoji || '✨',
        photo:     v.photo,
        price:     parseFloat(product.finalPrice) || 0,
        colorName: v.colorName,
        colorHex:  v.colorHex,
        quantity:  qty
      });
    }
    save();
    render();
    const label = v.colorName ? `${product.name} (${v.colorName})` : product.name;
    Toast.show(`${product.emoji || '✨'} ${label} added to cart!`, 'success');
  }

  function remove(key) { items = items.filter(i => i.key !== key); save(); render(); }
  function clear()     { items = []; save(); render(); }

  function updateQty(key, delta) {
    const item = items.find(i => i.key === key);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity < 1) remove(key);
    else { save(); render(); }
  }

  function updateCount() {
    const count = getCount();
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = count);
  }

  function open()  {
    document.getElementById('cart-sidebar')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
  }
  function close() {
    document.getElementById('cart-sidebar')?.classList.remove('open');
    document.getElementById('cart-overlay')?.classList.remove('open');
  }

  function thumbHTML(item) {
    if (item.photo)
      return `<img src="${item.photo}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover">`;
    return item.emoji || '🛍';
  }

  function render() {
    const container = document.getElementById('cart-items');
    const footer    = document.getElementById('cart-footer');
    if (!container) return;
    updateCount();

    if (!items.length) {
      container.innerHTML = `
        <div class="cart-empty">
          <div class="empty-icon">🛍️</div>
          <p>Your cart is empty</p>
        </div>`;
      footer?.classList.add('hidden');
      return;
    }

    footer?.classList.remove('hidden');
    container.innerHTML = items.map(item => `
      <div class="cart-item">
        <div class="cart-item-img">${thumbHTML(item)}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">
            ${item.name}
            ${item.colorName
              ? `<span style="font-size:.7rem;color:var(--muted)"> (${item.colorName})</span>`
              : ''}
          </div>
          <div class="cart-item-price">
            ${(item.price * item.quantity).toFixed(2)} EGP
          </div>
          <div class="cart-qty-row">
            <button class="cart-qty-btn" onclick="Cart.updateQty('${item.key}', -1)">−</button>
            <span class="cart-qty-val">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="Cart.updateQty('${item.key}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="Cart.remove('${item.key}')">✕</button>
      </div>`).join('');

    const sub = getSubtotal();
    document.getElementById('cart-subtotal').textContent = `${sub.toFixed(2)} EGP`;
    document.getElementById('cart-shipping').textContent  = 'At checkout';
    document.getElementById('cart-total').textContent     = `${sub.toFixed(2)} EGP`;
  }

  function goCheckout() {
    if (!items.length) return Toast.show('Your cart is empty', 'error');
    close();
    window.location.href = '/checkout';
  }

  function bind() {
    document.getElementById('cart-nav-btn')?.addEventListener('click', open);
    document.getElementById('cart-close-btn')?.addEventListener('click', close);
    document.getElementById('cart-overlay')?.addEventListener('click', close);
    document.getElementById('checkout-btn')?.addEventListener('click', goCheckout);
  }

  return { add, remove, updateQty, clear, open, close, render, bind,
           getItems, getCount, getSubtotal, pid };
})();
window.Cart = Cart;
