// ── Config ──
const CONFIG = {
  SUPABASE_URL: 'https://psoatzqqzdknrzslhvvt.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb2F0enFxemRrbnJ6c2xodnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1OTg4NTYsImV4cCI6MjA5OTE3NDg1Nn0.p98fbmfHp7tnYq5qChH3UVbZ_rHIw21kpFaknemhGPs'
};

// ── DB Wrapper ──
const DB = (() => {
  const _supabase = window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;
  if (!_supabase) console.error('Supabase not loaded');
  const sb = () => _supabase;
  return {
    supabase: _supabase,
    async getSettings() {
      const { data } = await sb().from('settings').select('key, value');
      if (!data) return {};
      const s = {};
      data.forEach(r => { s[r.key] = r.value; });
      return s;
    },
    async setSetting(key, value) {
      await sb().from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    },
    async getOrders() {
      const { data, error } = await sb().from('orders').select('id, date, customer, items, total, shipping_cost, discount, coupon_code, notes, status, is_wholesale, distributor_id, created_at, updated_at').order('date', { ascending: false });
      if (error) { console.error('Orders error:', error.code, error.message); return []; }
      return (data || []).map(r => ({ id: String(r.id), date: r.date, customer: r.customer || {}, items: r.items || [], total: r.total || 0, shipping_cost: r.shipping_cost || 0, discount: r.discount || 0, coupon_code: r.coupon_code || '', notes: r.notes || '', status: r.status || 'pending', is_wholesale: r.is_wholesale, distributor_id: r.distributor_id, created_at: r.created_at, updated_at: r.updated_at }));
    },
    async getProducts() {
      const { data, error } = await sb().from('products').select('id, name, price, sale_price, wholesale_price, image, images, category, categories, advanced');
      if (error) { console.error('Products error:', error.code, error.message); return []; }
      return (data || []).map(r => { let adv = r.advanced; if (typeof adv === 'string') try { adv = JSON.parse(adv); } catch(e) { adv = {}; }; let cats = r.categories; if (typeof cats === 'string') try { cats = JSON.parse(cats); } catch(e) { cats = []; }; if (!Array.isArray(cats)) cats = []; return { id: r.id, name: r.name, price: r.price, salePrice: r.sale_price, image: r.image, images: Array.isArray(r.images) ? r.images : [], video: r.video || '', wholesalePrice: r.wholesale_price || r.wholesalePrice, category: r.category, categories: cats, advanced: adv || {} }; });
    },
    async getDistributors() {
      const { data, error } = await sb().from('distributors').select('*');
      if (error) { console.error('Distributors error:', error.code, error.message); return []; }
      return (data || []).map(r => ({ id: r.id, name: r.name, phone: r.phone, password: r.password, city: r.city, address: r.address, status: r.status, created_at: r.created_at }));
    },
    async updateDistributorStatus(id, status) {
      const { error } = await sb().from('distributors').update({ status }).eq('id', String(id));
      return !error;
    },
    async updateProduct(id, updates) {
      const allowed = ['name', 'price', 'sale_price', 'wholesale_price', 'image', 'images', 'category', 'advanced'];
      const row = {};
      for (const k of allowed) if (updates[k] !== undefined) row[k] = updates[k];
      const { error } = await sb().from('products').update(row).eq('id', String(id));
      return !error;
    },
    async addProduct(product) {
      const row = { id: String(product.id || 'PROD-' + Date.now()), name: product.name || '', price: product.price || 0, sale_price: product.salePrice || 0, wholesale_price: product.wholesalePrice || null, image: product.image || '', images: Array.isArray(product.images) ? product.images : [], category: product.category || '', advanced: product.advanced || {} };
      const { error } = await sb().from('products').upsert(row, { onConflict: 'id' });
      return !error;
    },
    async updateOrder(id, updates) {
      const { error } = await sb().from('orders').update(updates).eq('id', String(id));
      return !error;
    },
    async deleteOrder(id) {
      const { error } = await sb().from('orders').delete().eq('id', String(id));
      return !error;
    },
    async registerFCMToken(token, role = 'admin') {
      const { error } = await sb().from('fcm_tokens').upsert({ token, role, created_at: new Date().toISOString() }, { onConflict: 'token' });
      return !error;
    }
  };
})();

let state = { orders: [], products: [], distributors: [], isAdmin: false, user: null, notifs: [], newNotifCount: 0, currentPage: 'Dashboard' };

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + type;
  void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._hide); t._hide = setTimeout(() => t.classList.remove('show'), 2500);
}

function showConfirm(msg) {
  return new Promise(resolve => {
    window._confirmResolve = (val) => {
      document.getElementById('confirmModal').classList.remove('show');
      resolve(val);
    };
    document.getElementById('confirmText').textContent = msg;
    document.getElementById('confirmModal').classList.add('show');
  });
}

// ── Auth ──
async function handleLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  if (!phone || !password) { err.textContent = 'يرجى إدخال الهاتف وكلمة المرور'; err.style.display = 'block'; return; }
  err.style.display = 'none';

  const localAdmin = localStorage.getItem('mobileAdminPhone');
  const localPass = localStorage.getItem('mobileAdminPass');
  if (localAdmin && phone === localAdmin && password === localPass) {
    state.isAdmin = true;
    state.user = { phone, name: 'المدير', id: 'admin' };
    localStorage.setItem('mobileAdminSession', JSON.stringify(state.user));
    enterApp(); return;
  }

  let supabaseAdminPhone = '', supabaseAdminPass = '';
  try {
    const settings = await DB.getSettings();
    supabaseAdminPhone = String(settings.adminPhone || settings.storePhone || '').replace(/"/g, '');
    supabaseAdminPass = String(settings.adminPass || '').replace(/"/g, '');
  } catch (e) {}
  if (supabaseAdminPhone && phone === supabaseAdminPhone && password === supabaseAdminPass) {
    state.isAdmin = true;
    state.user = { phone, name: 'المدير', id: 'admin' };
    localStorage.setItem('mobileAdminSession', JSON.stringify(state.user));
    localStorage.setItem('mobileAdminPhone', phone);
    localStorage.setItem('mobileAdminPass', password);
    enterApp(); return;
  }

  if (!localStorage.getItem('mobileAdminPhone') && !supabaseAdminPhone) {
    document.getElementById('adminSetup').style.display = 'block';
    document.getElementById('loginError').style.display = 'none';
    return;
  }

  let dists;
  try { dists = await DB.getDistributors(); } catch (e) {}
  const dist = dists && dists.find(d => d.phone === phone);
  if (!dist) { err.textContent = 'رقم الهاتف أو كلمة المرور غير صحيحة'; err.style.display = 'block'; return; }
  if (dist.status === 'pending') { err.textContent = 'طلبك قيد المراجعة'; err.style.display = 'block'; return; }
  if (dist.status === 'rejected') { err.textContent = 'تم رفض طلبك'; err.style.display = 'block'; return; }
  if (dist.password !== password) { err.textContent = 'كلمة المرور غير صحيحة'; err.style.display = 'block'; return; }
  state.isAdmin = false;
  state.user = { phone: dist.phone, name: dist.name, id: dist.id };
  localStorage.setItem('mobileAdminSession', JSON.stringify(state.user));
  enterApp();
}

function handleRegister() {
  const name = document.getElementById('regName').value;
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPassword').value;
  const city = document.getElementById('regCity').value;
  const address = document.getElementById('regAddress').value;
  const err = document.getElementById('regError');
  if (!name || !phone || !password || !city || !address) { err.textContent = 'يرجى إكمال جميع الحقول'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  DB.supabase.from('distributors').insert({ id: 'DIST-' + Date.now(), name, phone, password, city, address, status: 'pending' }).then(() => {
    showToast('تم إرسال طلب الانضمام، سيتم مراجعته من الإدارة', 'success');
    showLoginForm();
  }).catch(e => { err.textContent = 'حدث خطأ'; err.style.display = 'block'; });
}

function showRegisterForm() { document.getElementById('loginForm').style.display = 'none'; document.getElementById('registerForm').style.display = 'block'; document.getElementById('regError').style.display = 'none'; }
function showLoginForm() { document.getElementById('loginForm').style.display = 'block'; document.getElementById('registerForm').style.display = 'none'; document.getElementById('loginError').style.display = 'none'; }

async function saveAdminSetup() {
  const phone = document.getElementById('setupPhone').value.trim();
  const pass = document.getElementById('setupPass').value;
  if (!phone || !pass) { showToast('يرجى إدخال الهاتف وكلمة المرور', 'error'); return; }
  try { await DB.setSetting('adminPhone', phone); await DB.setSetting('adminPass', pass); } catch (e) { console.warn('Supabase save failed'); }
  localStorage.setItem('mobileAdminPhone', phone);
  localStorage.setItem('mobileAdminPass', pass);
  showToast('تم الحفظ', 'success');
  state.isAdmin = true;
  state.user = { phone, name: 'المدير', id: 'admin' };
  localStorage.setItem('mobileAdminSession', JSON.stringify(state.user));
  document.getElementById('adminSetup').style.display = 'none';
  enterApp();
}

function logout() {
  localStorage.removeItem('mobileAdminSession');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.remove('active');
}

// ── Enter App ──
function enterApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appShell').classList.add('active');
  loadAll();
  setupRealtime();
  const hashPage = location.hash.replace('#', '');
  if (['Dashboard','Orders','Products','Distributors','Settings'].includes(hashPage)) switchPage(hashPage);
  if (state.isAdmin) {
    initAdminFCM();
  }
}

// ── Navigation ──
function switchPage(name) {
  closeProductEditor();
  closeOrderViewer();
  closeDistributorViewer();
  closeCategoryEditor();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.app-tabs .tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page' + name).classList.add('active');
  const tab = document.querySelector(`.app-tabs .tab[data-page="${name}"]`);
  if (tab) tab.classList.add('active');
  document.getElementById('headerTitle').textContent = { Dashboard: 'الإحصائيات', Orders: 'المبيعات', Products: 'المخزون', Distributors: 'الموزعين', Settings: 'الإعدادات', NotifSounds: 'أصوات التنبيهات' }[name] || name;
  if (location.hash !== '#' + name) location.hash = name;
  if (name === 'Orders') loadOrders(document.querySelector('.orders-filter .filter-btn.active')?.dataset?.filter || 'all', state.orders);
  if (name === 'Products') { if (_prodTab !== 'products') switchProdTab('products'); loadProducts(state.products, _categories); loadCategoriesPage(_categories); }
  if (name === 'Distributors') loadDistributors(state.distributors);
  if (name === 'Dashboard') loadDashboard();
  state.currentPage = name;
}

async function loadAll() {
  try {
    // Show skeletons immediately before fetching new data
    const ordersEl = document.getElementById('ordersList');
    const recentEl = document.getElementById('recentOrders');
    const productsEl = document.getElementById('productsList');
    const distEl = document.getElementById('distContent');

    if (ordersEl) {
      ordersEl.innerHTML = `
        <div class="skeleton-orders-list">
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
        </div>
      `;
    }
    if (recentEl) {
      recentEl.innerHTML = `
        <div class="skeleton-orders-list">
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
        </div>
      `;
    }
    if (productsEl) {
      productsEl.innerHTML = `
        <div class="skeleton-product-grid">
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
        </div>
      `;
    }
    if (distEl) {
      distEl.innerHTML = `
        <div class="skeleton-orders-list">
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
        </div>
      `;
    }

    const [orders, products, distributors, categoriesRes] = await Promise.all([
      DB.getOrders(),
      DB.getProducts(),
      DB.getDistributors(),
      DB.supabase.from('categories').select('*').order('name')
    ]);
    const categories = categoriesRes.data || [];
    
    try {
      localStorage.setItem('cache_orders', JSON.stringify(orders || []));
      localStorage.setItem('cache_products', JSON.stringify(products || []));
      localStorage.setItem('cache_distributors', JSON.stringify(distributors || []));
      localStorage.setItem('cache_categories', JSON.stringify(categories));
    } catch (e) {
      console.warn('Failed to cache data:', e);
    }

    state.orders = orders || [];
    state.products = products || [];
    state.distributors = distributors || [];
    _categories = categories;

    renderAllIncremental(orders, products, distributors, categories);
  } catch (e) {
    console.error('Error during loadAll:', e);
  }
}
async function refreshAll() { showToast('جاري التحديث...'); await loadAll(); showToast('تم التحديث بنجاح', 'success'); }

// ── Dashboard ──
async function loadDashboard() {
  const orders = state.orders;
  const currency = '₪';
  const now = new Date();
  const today = now.toDateString();
  const todayOrders = orders.filter(o => new Date(o.date).toDateString() === today);
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const startOfWeek = new Date(now);
  const dow = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - dow);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekOrders = orders.filter(o => new Date(o.date) >= startOfWeek);
  const monthOrders = orders.filter(o => new Date(o.date) >= startOfMonth);
  const weekRevenue = weekOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const monthRevenue = monthOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const pendingDists = state.distributors.filter(d => d.status === 'pending');
  document.getElementById('statOrders').textContent = todayOrders.length;
  document.getElementById('statPending').textContent = pendingOrders.length;
  document.getElementById('statRevenue').textContent = currency + todayRevenue.toFixed(2);
  document.getElementById('statWeekRevenue').textContent = currency + weekRevenue.toFixed(2);
  document.getElementById('statMonthRevenue').textContent = currency + monthRevenue.toFixed(2);
  document.getElementById('statDistRequests').textContent = pendingDists.length;
  renderAnalytics();
  const recent = orders.slice(0, 5);
  if (recent.length === 0) { document.getElementById('recentOrders').innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد طلبات</p></div>'; return; }
  document.getElementById('recentOrders').innerHTML = '<div class="recent-orders-list">' + recent.map(o => {
    const m = { pending: 'قيد الانتظار', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
    const ic = { pending: 'hourglass-half', processing: 'cog', shipped: 'truck', delivered: 'check-circle', cancelled: 'times-circle' };
    const ib = { pending: '#fef3c7', processing: '#dbeafe', shipped: '#e0e7ff', delivered: '#d1fae5', cancelled: '#fee2e2' };
    const st = o.status || 'pending';
    const isW = o.is_wholesale === true || o.is_wholesale === 'true' || o.distributor_id;
    const orderIcon = isW ? 'store' : 'shopping-cart';
    const name = o.customer?.name || o.customer?.phone || 'عميل';
    return `<div class="order-mini-card" onclick="switchPage('Orders')"><div class="order-icon" style="background:${ib[st]};color:var(--${st === 'shipped' ? 'info' : st === 'cancelled' ? 'danger' : st === 'delivered' ? 'success' : st === 'pending' ? 'warning' : 'info'})"><i class="fas fa-${isW ? orderIcon : ic[st]}"></i></div><div class="order-info"><div class="name">${name}${isW ? ' <span style="font-size:10px;color:var(--warning)">⚡جملة</span>' : ''}</div><div class="meta">${m[st] || st} · ${new Date(o.date).toLocaleDateString('ar-EG')}</div></div><div class="order-total">${currency}${parseFloat(o.total || 0).toFixed(2)}</div></div>`;
  }).join('') + '</div>';
}

let _revFrom = null, _revTo = null;
function applyRevFilter() {
  const f = document.getElementById('revFrom').value;
  const t = document.getElementById('revTo').value;
  if (!f && !t) { showToast('اختر تاريخ البداية أو النهاية', 'error'); return; }
  _revFrom = f ? new Date(f + 'T00:00:00') : null;
  _revTo = t ? new Date(t + 'T23:59:59') : null;
  renderAnalytics();
}
function clearRevFilter() {
  _revFrom = null; _revTo = null;
  document.getElementById('revFrom').value = '';
  document.getElementById('revTo').value = '';
  renderAnalytics();
}
function _dayRange(start, end) {
  const days = [];
  const cur = new Date(start); cur.setHours(0, 0, 0, 0);
  const last = new Date(end); last.setHours(23, 59, 59, 999);
  for (let d = new Date(cur); d <= last; d.setDate(d.getDate() + 1)) {
    const ds = new Date(d); ds.setHours(0, 0, 0, 0);
    const de = new Date(d); de.setHours(23, 59, 59, 999);
    const rev = state.orders.filter(o => { const od = new Date(o.date); return od >= ds && od <= de; }).reduce((s, o) => s + parseFloat(o.total || 0), 0);
    days.push({ date: new Date(ds), rev });
  }
  return days;
}
function renderAnalytics() {
  const allTime = state.orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const elAll = document.getElementById('revAllTime');
  if (elAll) elAll.textContent = '₪' + allTime.toFixed(2);
  let base = state.orders;
  if (_revFrom || _revTo) {
    base = state.orders.filter(o => {
      const od = new Date(o.date);
      if (_revFrom && od < _revFrom) return false;
      if (_revTo && od > _revTo) return false;
      return true;
    });
  }
  const periodTotal = base.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const elPeriod = document.getElementById('revPeriodTotal');
  if (elPeriod) elPeriod.textContent = '₪' + periodTotal.toFixed(2);
  const end = _revTo ? new Date(_revTo) : new Date();
  const start = _revFrom ? new Date(_revFrom) : (() => { const s = new Date(); s.setDate(s.getDate() - 6); return s; })();
  const days = _dayRange(start, end);
  const max = Math.max(1, ...days.map(d => d.rev));
  const chart = document.getElementById('revChart');
  if (chart) chart.innerHTML = days.map(d => {
    const h = Math.max(2, Math.round((d.rev / max) * 100));
    const label = d.date.getDate() + '/' + (d.date.getMonth() + 1);
    return '<div class="bar-col"><div class="bar" style="height:' + h + '%" title="₪' + d.rev.toFixed(2) + '"></div><div class="bar-label">' + label + '</div></div>';
  }).join('');
  const counts = {};
  base.forEach(o => (o.items || []).forEach(it => {
    const key = it.id || it.name;
    const name = it.name || 'منتج';
    if (!counts[key]) counts[key] = { name, qty: 0 };
    counts[key].qty += parseInt(it.quantity || it.qty || 1);
  }));
  const top = Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const tp = document.getElementById('topProducts');
  if (tp) tp.innerHTML = top.length
    ? top.map((p, i) => '<div class="top-item"><span class="top-rank">' + (i + 1) + '</span><span class="top-name">' + p.name + '</span><span class="top-qty">' + p.qty + ' قطعة</span></div>').join('')
    : '<div class="empty-state" style="padding:10px">لا توجد مبيعات</div>';
}

// ── Orders ──
async function loadOrders(filter = 'all', preFetchedData = null) {
  const el = document.getElementById('ordersList');
  try {
    if (preFetchedData) {
      state.orders = preFetchedData;
    } else {
      el.innerHTML = `
        <div class="skeleton-orders-list">
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
          <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
        </div>
      `;
      state.orders = (await DB.getOrders()) || [];
    }
    let list = state.orders;
    if (filter !== 'all') list = list.filter(o => o.status === filter);
    if (list.length === 0) { el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد طلبات</p></div>'; return; }
      const m = { pending: 'قيد الانتظار', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
      const iib = { pending: '#fef3c7', processing: '#dbeafe', shipped: '#e0e7ff', delivered: '#d1fae5', cancelled: '#fee2e2' };
      const iic = { pending: 'hourglass-half', processing: 'cog', shipped: 'truck', delivered: 'check-circle', cancelled: 'times-circle' };
      el.innerHTML = list.map(o => {
        const st = o.status || 'pending';
        const isW = o.is_wholesale === true || o.is_wholesale === 'true' || o.distributor_id;
        const items = Array.isArray(o.items) ? o.items.map(i => i.name || i.id).join('، ') : '';
        const name = o.customer?.name || 'عميل';
        const phone = o.customer?.phone || '';
        const phoneHtml = phone ? `<span class="order-phone-inline" dir="ltr">${phone}</span>` : '';
        const orderIcon = isW ? 'store' : (iic[st] || 'shopping-cart');
        const iconColor = st === 'shipped' ? 'var(--info)' : st === 'cancelled' ? 'var(--danger)' : st === 'delivered' ? 'var(--success)' : st === 'pending' ? 'var(--warning)' : 'var(--info)';
        const isNew = (Date.now() - new Date(o.date).getTime()) < 3600000 && st === 'pending';
        const newBadge = isNew ? '<span class="order-new-badge">جديد</span>' : '';
        return `<div class="order-card${isNew ? ' is-new' : ''}" data-id="${o.id}"><div class="order-icon-side" style="background:${iib[st]};color:${iconColor}"><i class="fas fa-${isW ? 'store' : orderIcon}"></i></div><div class="order-main"><div class="order-header"><span class="order-id">#${o.id}${newBadge}${isW ? ' <span class="order-wholesale-tag">جملة</span>' : ''}</span><span class="order-date">${new Date(o.date).toLocaleString('ar-EG')}</span></div><div class="order-customer">${name} ${phoneHtml}</div><div class="order-items">${items || '—'}</div><div class="order-bottom"><span class="order-total-price">₪${parseFloat(o.total || 0).toFixed(2)}</span><span class="status-badge status-${st}">${m[st] || st}</span></div></div></div>`;
      }).join('');
    el.querySelectorAll('.order-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const order = state.orders.find(o => String(o.id) === String(id));
        if (order) openOrderViewer(order);
      });
    });
  } catch (e) { el.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i><p>فشل تحميل الطلبات</p></div>'; }
}

// ── Products ──
async function loadProducts(preFetchedProducts = null, preFetchedCategories = null) {
  const el = document.getElementById('productsList');
  const search = (document.getElementById('prodSearch').value || '').toLowerCase();
  try {
    if (preFetchedProducts) {
      state.products = preFetchedProducts;
    } else {
      el.innerHTML = `
        <div class="skeleton-product-grid">
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
          <div class="skeleton-product-card"><div class="skeleton img"></div><div class="content"><div class="skeleton line-title"></div><div class="skeleton line-price"></div><div class="skeleton line-stock"></div></div></div>
        </div>
      `;
      state.products = (await DB.getProducts()) || [];
    }
    if (preFetchedCategories) {
      _categories = preFetchedCategories;
      const sel = document.getElementById('editProdCategory');
      if (sel) sel.innerHTML = '<option value="">بدون تصنيف</option>' + _categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } else {
      await loadCategories();
    }
    let list = state.products;
    if (search) list = list.filter(p => p.name && p.name.toLowerCase().includes(search));
    if (list.length === 0) { el.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد منتجات</p></div>'; return; }
    el.innerHTML = '<div class="prod-list">' + list.map(p => {
      let st = '', sc = '';
      const stock = p.advanced?.stock;
      if (stock === undefined || stock === null || stock === '') { st = 'مخزون غير محدود'; sc = 'stock-unlimited'; } else if (parseInt(stock) === 0) { st = 'نفدت الكمية'; sc = 'stock-out'; } else if (parseInt(stock) <= 5) { st = 'متبقي ' + stock + ' فقط'; sc = 'stock-low'; } else { st = 'متبقي ' + stock; sc = 'stock-finite'; }
      let catName = 'بدون تصنيف';
      if (p.category) {
        const c = _categories.find(c => String(c.id) === String(p.category));
        catName = c ? c.name : (String(p.category).length > 0 ? p.category : 'بدون تصنيف');
      } else if (Array.isArray(p.categories) && p.categories.length) {
        const first = p.categories[0];
        const c = _categories.find(c => String(c.id) === String(first) || String(c.name) === String(first));
        catName = c ? c.name : (typeof first === 'string' ? first : 'بدون تصنيف');
      }
      const wholesale = p.wholesalePrice ? parseFloat(p.wholesalePrice) : 0;
      return `<div class="prod-card"><div class="prod-img">${catName !== 'بدون تصنيف' ? `<span class="prod-cat-badge"><i class="fas fa-tag"></i> ${catName}</span>` : ''}${p.image ? '<img src="' + p.image + '" alt="" loading="lazy">' : '<i class="fas fa-box" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray-400);font-size:20px;"></i>'}</div><div class="prod-info"><div class="prod-name">${p.name || 'بدون اسم'}</div><div class="prod-price-row"><span class="prod-price">₪${parseFloat(p.price || 0).toFixed(2)}</span>${wholesale ? `<span class="prod-wholesale-price">جملة ₪${wholesale.toFixed(2)}</span>` : ''}</div><div class="prod-stock ${sc}">${st}</div></div></div>`;
    }).join('') + '</div>';
    el.querySelectorAll('.prod-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = Array.from(card.parentNode.children).indexOf(card);
        if (list[idx]) openProductEditor(list[idx]);
      });
    });
  } catch (e) { el.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i><p>فشل تحميل المنتجات</p></div>'; }
}

// ── Product Management ──
let _editingProductId = null;
let _categories = [];

async function loadCategories() {
  try {
    const cats = await DB.supabase.from('categories').select('*').order('name');
    _categories = cats.data || [];
  } catch (e) { _categories = []; }
  const sel = document.getElementById('editProdCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">بدون تصنيف</option>' + _categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function toggleCategoryPanel() {
  switchPage('Categories');
}
async function loadCategoriesPage(preFetchedCategories = null) {
  const el = document.getElementById('categoriesList');
  try {
    if (preFetchedCategories) {
      _categories = preFetchedCategories;
    } else {
      const cats = await DB.supabase.from('categories').select('*').order('name');
      _categories = cats.data || [];
    }
    if (!_categories.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>لا توجد تصنيفات</p><p style="font-size:12px;margin-top:4px">اضف تصنيف من زر الإضافة بالأعلى</p></div>'; return; }
    el.innerHTML = '<div class="cat-grid">' + _categories.map(c => {
      const count = state.products.filter(p => String(p.category) === String(c.id) || p.category === c.name || (Array.isArray(p.categories) && p.categories.some(cid => String(cid) === String(c.id) || String(cid) === c.name))).length;
      const icon = c.icon && c.icon.startsWith('fa-') ? `<i class="fas ${c.icon}"></i>` : c.icon ? `<img src="${c.icon}" style="width:32px;height:32px;object-fit:contain" loading="lazy">` : '<i class="fas fa-tag"></i>';
      const bg = c.image ? `style="background-image:url('${c.image.replace(/'/g, "\\'")}');background-size:cover;background-position:center"` : '';
      return `<div class="cat-card" onclick="openCategoryEditor('${c.id}')"><div class="cat-icon-wrap" ${bg}>${!c.image ? icon : ''}</div><div class="name">${c.name}</div><div class="count">${count} منتج</div></div>`;
    }).join('') + '</div>';
  } catch (e) { el.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i><p>فشل تحميل التصنيفات</p></div>'; }
}
function showAddCategoryForm() {
  openCategoryEditor(null);
}

// ── Category Editor ──
let _editingCatId = null;
function openCategoryEditor(id) {
  _editingCatId = id;
  const cat = id ? _categories.find(c => c.id === id) : null;
  document.getElementById('pageCategoryEditor').classList.add('active');
  if (cat) {
    document.getElementById('catEditorTitle').textContent = 'تعديل: ' + cat.name;
    document.getElementById('catEditName').value = cat.name || '';
    document.getElementById('catEditImage').value = cat.image || '';
    document.getElementById('catEditIcon').value = (cat.icon && cat.icon.startsWith('fa-') ? cat.icon : '') || '';
    document.getElementById('catEditorDelete').style.display = 'flex';
  } else {
    document.getElementById('catEditorTitle').textContent = 'إضافة تصنيف جديد';
    document.getElementById('catEditName').value = '';
    document.getElementById('catEditImage').value = '';
    document.getElementById('catEditIcon').value = '';
    document.getElementById('catEditorDelete').style.display = 'none';
  }
  syncCatImagePreview();
  previewCatIcon();
}
function closeCategoryEditor() {
  document.getElementById('pageCategoryEditor').classList.remove('active');
  _editingCatId = null;
}
async function saveCategoryEditor() {
  const name = document.getElementById('catEditName').value.trim();
  if (!name) { showToast('يرجى إدخال اسم التصنيف', 'error'); return; }
  const image = document.getElementById('catEditImage').value.trim();
  const icon = document.getElementById('catEditIcon').value.trim();
  const data = { name, image, icon };
  if (_editingCatId) {
    const { error } = await DB.supabase.from('categories').update(data).eq('id', String(_editingCatId));
    if (error) { showToast('فشل حفظ التصنيف', 'error'); return; }
    showToast('تم حفظ التصنيف', 'success');
  } else {
    const { error } = await DB.supabase.from('categories').insert({ id: 'CAT-' + Date.now(), ...data });
    if (error) { showToast('فشل إضافة التصنيف', 'error'); return; }
    showToast('تم إضافة التصنيف', 'success');
  }
  closeCategoryEditor();
  loadCategoriesPage();
  loadCategories();
}
async function deleteCategoryEditor() {
  if (!_editingCatId) return;
  const cat = _categories.find(c => c.id === _editingCatId);
  if (!(await showConfirm(`حذف التصنيف "${cat ? cat.name : ''}"؟`))) return;
  const { error } = await DB.supabase.from('categories').delete().eq('id', String(_editingCatId));
  if (error) { showToast('فشل حذف التصنيف', 'error'); return; }
  showToast('تم حذف التصنيف', 'success');
  closeCategoryEditor();
  loadCategoriesPage();
  loadCategories();
}
function syncCatImagePreview() {
  const url = document.getElementById('catEditImage').value.trim();
  const el = document.getElementById('catImagePreview');
  if (url) { el.style.backgroundImage = `url('${url.replace(/'/g, "\\'")}')`; el.classList.add('has-image'); }
  else { el.style.backgroundImage = ''; el.classList.remove('has-image'); }
}
function previewCatIcon() {
  const val = document.getElementById('catEditIcon').value.trim();
  const el = document.getElementById('catIconPreview');
  const i = el.querySelector('i');
  if (val && val.startsWith('fa-')) { i.className = 'fas ' + val; i.style.color = 'var(--primary)'; }
  else { i.className = 'fas fa-icons'; i.style.color = 'var(--gray-400)'; }
}
// Cat image upload
document.addEventListener('DOMContentLoaded', () => {
  const fi = document.getElementById('catFileInput');
  if (fi) fi.addEventListener('change', e => { if (!e.target.files[0]) return; const file = e.target.files[0]; const el = document.getElementById('catImagePreview'); el.innerHTML = '<i class="fas fa-spinner fa-pulse" style="font-size:24px;color:var(--primary)"></i><span>جاري الرفع...</span>'; el.style.backgroundImage = ''; el.classList.remove('has-image'); uploadToSupabaseStorage(file).then(url => { document.getElementById('catEditImage').value = url; syncCatImagePreview(); showToast('تم رفع الصورة', 'success'); }).catch(err => { el.innerHTML = '<i class="fas fa-image"></i><span>فشل الرفع</span>'; showToast('فشل الرفع: ' + (err && err.message ? err.message : ''), 'error'); }); });
});

// ── Icon Picker ──
const ICON_LIST = ['fa-mobile','fa-laptop','fa-headphones','fa-camera','fa-gamepad','fa-tv','fa-clock','fa-car','fa-bicycle','fa-book','fa-gem','fa-tshirt','fa-shoe-prints','fa-ring','fa-hat-cowboy','fa-crown','fa-star','fa-heart','fa-bolt','fa-fire','fa-sun','fa-moon','fa-cloud','fa-umbrella','fa-leaf','fa-tree','fa-flower','fa-apple-alt','fa-utensils','fa-coffee','fa-wine-glass','fa-cocktail','fa-home','fa-building','fa-store','fa-tools','fa-wrench','fa-cog','fa-tag','fa-gift','fa-robot','fa-rocket','fa-plane','fa-ship','fa-truck','fa-bus','fa-train','fa-paw','fa-dog','fa-cat','fa-fish','fa-dragon','fa-horse','fa-egg','fa-snowflake','fa-music','fa-palette','fa-paint-brush','fa-pen','fa-camera-retro','fa-video','fa-film','fa-microphone','fa-guitar','fa-drum','fa-dice','fa-chess','fa-puzzle-piece','fa-baby','fa-child','fa-school','fa-graduation-cap','fa-chart-line','fa-chart-bar','fa-pie-chart','fa-calculator','fa-dollar-sign','fa-euro-sign','fa-pound-sign','fa-money-bill','fa-credit-card','fa-wallet','fa-handshake','fa-briefcase','fa-medal','fa-trophy','fa-shield','fa-lock','fa-key','fa-bell','fa-envelope','fa-phone','fa-map-marker','fa-globe','fa-infinity','fa-atom','fa-biohazard','fa-radiation','fa-skull','fa-dragon','fa-fist-raised','fa-running','fa-swimmer','fa-basketball-ball','fa-futbol','fa-volleyball-ball','fa-hiking','fa-mountain','fa-water','fa-fire-extinguisher'];
function openIconPicker() {
  const panel = document.getElementById('iconPickerPanel');
  const grid = document.getElementById('iconGrid');
  const current = document.getElementById('catEditIcon').value.trim();
  grid.innerHTML = ICON_LIST.map(ic => `<div class="icon-option ${ic === current ? 'selected' : ''}" onclick="selectIcon('${ic}')"><i class="fas ${ic}"></i></div>`).join('');
  panel.classList.add('show');
}
function closeIconPicker() { document.getElementById('iconPickerPanel').classList.remove('show'); }
function selectIcon(ic) {
  document.getElementById('catEditIcon').value = ic;
  previewCatIcon();
  closeIconPicker();
}

function syncImagePreview() {
  const url = document.getElementById('editProdImage').value.trim();
  const el = document.getElementById('editorImagePreview');
  if (url) { el.style.backgroundImage = `url('${url.replace(/'/g, "\\'")}')`; el.classList.add('has-image'); }
  else { el.style.backgroundImage = ''; el.classList.remove('has-image'); }
}
function syncVideoPreview() {
  const url = document.getElementById('editProdVideo').value.trim();
  const el = document.getElementById('editProdVideoPreview');
  if (!el) return;
  if (!url) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'block';
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let embed = url;
    if (url.includes('watch?v=')) embed = url.replace('watch?v=', 'embed/');
    else if (url.includes('youtu.be/')) embed = url.replace('youtu.be/', 'youtube.com/embed/');
    el.innerHTML = '<div class="video-frame"><iframe src="' + embed.replace(/"/g, '%22') + '" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>';
  } else {
    el.innerHTML = '<div class="video-frame"><video src="' + url.replace(/"/g, '%22') + '" controls playsinline></video></div>';
  }
}
const STORAGE_BUCKET = 'product-images';
async function uploadToSupabaseStorage(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = 'prod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const { data, error } = await DB.supabase.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  const { data: pub } = DB.supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}
async function uploadImageFromFile(file) {
  if (!file) return;
  const el = document.getElementById('editorImagePreview');
  el.innerHTML = '<i class="fas fa-spinner fa-pulse" style="font-size:24px;color:var(--primary)"></i><span style="font-size:12px">جاري الرفع...</span>';
  el.style.backgroundImage = ''; el.classList.remove('has-image');
  try {
    const url = await uploadToSupabaseStorage(file);
    document.getElementById('editProdImage').value = url;
    syncImagePreview();
    showToast('تم رفع الصورة', 'success');
  } catch (err) {
    el.innerHTML = '<i class="fas fa-camera"></i><span>فشل الرفع، حاول مرة أخرى</span>';
    showToast('فشل رفع الصورة: ' + (err && err.message ? err.message : ''), 'error');
  }
}

let _editorImages = [];
function renderEditorGallery() {
  const g = document.getElementById('editorGallery');
  if (!g) return;
  g.innerHTML = _editorImages.map((url, i) =>
    `<div class="gallery-item" style="background-image:url('${url.replace(/'/g, "\\'")}')"><button type="button" class="gallery-del" onclick="removeExtraImage(${i})"><i class="fas fa-times"></i></button></div>`
  ).join('') + (_editorImages.length ? '' : '<div class="gallery-empty">لا توجد صور إضافية</div>');
}
function addExtraImage() {
  const inp = document.getElementById('editProdExtraImage');
  const url = inp.value.trim();
  if (!url) { showToast('أدخل رابط الصورة أولاً', 'error'); return; }
  _editorImages.push(url); inp.value = ''; renderEditorGallery();
}
function removeExtraImage(i) {
  _editorImages.splice(i, 1); renderEditorGallery();
}
async function uploadToGallery(file) {
  if (!file) return;
  try {
    const url = await uploadToSupabaseStorage(file);
    _editorImages.push(url); renderEditorGallery(); showToast('تمت إضافة الصورة', 'success');
  } catch (err) { showToast('خطأ في رفع الصورة: ' + (err && err.message ? err.message : ''), 'error'); }
}

async function openProductEditor(p) {
  _editingProductId = p ? p.id : null;
  document.getElementById('pageProductEditor').classList.add('active');
  if (p) {
    document.getElementById('editorTitle').textContent = 'تعديل: ' + (p.name || '');
    document.getElementById('editProdName').value = p.name || '';
    document.getElementById('editProdPrice').value = p.price || '';
    document.getElementById('editProdSale').value = p.salePrice || '';
    document.getElementById('editProdWholesale').value = p.wholesalePrice || '';
    document.getElementById('editProdImage').value = p.image || '';
    document.getElementById('editProdDesc').value = (p.advanced && p.advanced.description) || '';
    const stock = p.advanced?.stock;
    if (stock === undefined || stock === null || stock === '') { document.getElementById('editProdStockType').value = 'unlimited'; document.getElementById('editorStockQtyField').style.display = 'none'; }
    else if (parseInt(stock) === 0) { document.getElementById('editProdStockType').value = 'out'; document.getElementById('editorStockQtyField').style.display = 'none'; }
    else { document.getElementById('editProdStockType').value = 'limited'; document.getElementById('editorStockQtyField').style.display = 'block'; document.getElementById('editProdStockQty').value = stock; }
    document.getElementById('editorDeleteBtn').style.display = 'flex';
  } else {
    document.getElementById('editorTitle').textContent = 'إضافة منتج جديد';
    ['editProdName','editProdPrice','editProdSale','editProdWholesale','editProdImage','editProdDesc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('editProdStockType').value = 'unlimited';
    document.getElementById('editorStockQtyField').style.display = 'none';
    document.getElementById('editorDeleteBtn').style.display = 'none';
  }
  syncImagePreview();
  _editorImages = (p && Array.isArray(p.images) && p.images.length) ? p.images.slice() : ((p && p.advanced && Array.isArray(p.advanced.images)) ? p.advanced.images.slice() : []);
  renderEditorGallery();
  document.getElementById('editProdVideo').value = (p && p.advanced && p.advanced.productVideo) || (p && p.video) || '';
  syncVideoPreview();
  await loadCategories();
  const catSelect = document.getElementById('editProdCategory');
  if (catSelect && p) {
    let curVal = String(p.category || '').trim();
    if (!curVal && Array.isArray(p.categories) && p.categories.length) curVal = String(p.categories[0]).trim();
    let sel = _categories.find(c => String(c.id) === curVal) || _categories.find(c => String(c.name) === curVal);
    if (!sel && curVal && !_categories.some(c => String(c.id) === curVal)) {
      const opt = document.createElement('option');
      opt.value = curVal; opt.textContent = curVal; opt.selected = true;
      catSelect.appendChild(opt);
      sel = opt;
    }
    catSelect.value = sel ? curVal : '';
  }
}
function closeProductEditor() {
  document.getElementById('pageProductEditor').classList.remove('active');
  _editingProductId = null;
}
function showAddProductForm() { openProductEditor(null); }

function toggleEditorStock() {
  document.getElementById('editorStockQtyField').style.display = document.getElementById('editProdStockType').value === 'limited' ? 'block' : 'none';
}

async function saveProductEditor() {
  const name = document.getElementById('editProdName').value.trim();
  const price = parseFloat(document.getElementById('editProdPrice').value) || 0;
  const sale = document.getElementById('editProdSale').value ? parseFloat(document.getElementById('editProdSale').value) : 0;
  const wholesale = document.getElementById('editProdWholesale').value ? parseFloat(document.getElementById('editProdWholesale').value) : null;
  const image = document.getElementById('editProdImage').value.trim();
  const category = document.getElementById('editProdCategory').value;
  const desc = document.getElementById('editProdDesc').value.trim();
  const video = document.getElementById('editProdVideo').value.trim();
  const stockType = document.getElementById('editProdStockType').value;
  let stock = stockType === 'unlimited' ? '' : stockType === 'out' ? 0 : parseInt(document.getElementById('editProdStockQty').value) || 0;
  if (!name) { showToast('يرجى إدخال اسم المنتج', 'error'); return; }
  if (!price && price !== 0) { showToast('يرجى إدخال السعر', 'error'); return; }
  const advanced = { stock };
  if (desc) advanced.description = desc;
  if (video) advanced.productVideo = video;
  const images = _editorImages.slice();
  const ok = _editingProductId
    ? await DB.updateProduct(_editingProductId, { name, price, sale_price: sale, wholesale_price: wholesale, image, images, category, advanced })
    : await DB.addProduct({ id: 'PROD-' + Date.now(), name, price, salePrice: sale, wholesalePrice: wholesale, image, images, category, advanced });
  if (!ok) { showToast(_editingProductId ? 'فشل حفظ المنتج' : 'فشل إضافة المنتج', 'error'); return; }
  showToast(_editingProductId ? 'تم حفظ المنتج' : 'تم إضافة المنتج', 'success');
  closeProductEditor();
  loadProducts();
}
async function deleteProductEditor() {
  if (!_editingProductId || !(await showConfirm('هل أنت متأكد من حذف هذا المنتج؟'))) return;
  const { error } = await DB.supabase.from('products').delete().eq('id', String(_editingProductId));
  if (error) { showToast('فشل حذف المنتج', 'error'); return; }
  showToast('تم حذف المنتج', 'success');
  closeProductEditor();
  loadProducts();
}

// File input handler
document.addEventListener('DOMContentLoaded', () => {
  const fi = document.getElementById('editorFileInput');
  if (fi) fi.addEventListener('change', e => { if (e.target.files[0]) uploadImageFromFile(e.target.files[0]); });
  const gfi = document.getElementById('editorGalleryFileInput');
  if (gfi) gfi.addEventListener('change', e => { if (e.target.files[0]) uploadToGallery(e.target.files[0]); });
});

// ── Order Viewer ──
let _viewingOrderId = null;
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check" style="color:var(--success)"></i>';
    setTimeout(() => btn.innerHTML = orig, 1200);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
}
function openOrderViewer(order) {
  _viewingOrderId = order.id;
  document.getElementById('pageOrderViewer').classList.add('active');
  document.getElementById('orderViewerTitle').textContent = 'طلب #' + order.id;
  document.getElementById('orderViewerDelete').style.display = state.isAdmin ? 'flex' : 'none';
  renderOrderDetails(order);
}
function closeOrderViewer() {
  document.getElementById('pageOrderViewer').classList.remove('active');
  _viewingOrderId = null;
}
function renderOrderDetails(order) {
  const cur = '₪';
  const m = { pending: 'قيد الانتظار', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
  const st = order.status || 'pending';
  const isW = order.is_wholesale === true || order.is_wholesale === 'true' || order.distributor_id;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.price) * parseInt(i.quantity)), 0);
  const shipping = parseFloat(order.shipping_cost) || 0;
  const discount = parseFloat(order.discount) || 0;

  const itemsHTML = items.length
    ? items.map(i => `<div class="ov-item">${i.image ? '<img src="' + i.image + '" alt="">' : '<div style="width:44px;height:44px;border-radius:8px;background:var(--gray-200);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-box" style="color:var(--gray-400);font-size:16px"></i></div>'}<div class="info"><div class="name">${i.name || i.id || 'منتج'}</div><div class="meta">${i.quantity || 1} × ${parseFloat(i.price || 0).toFixed(2)} ${cur}${i.variant ? ' · ' + i.variant : ''}</div></div><div class="item-total">${cur}${(parseFloat(i.price) * parseInt(i.quantity || 1)).toFixed(2)}</div></div>`).join('')
    : '<div class="empty-state" style="padding:16px"><p>لا توجد منتجات</p></div>';

  const body = document.getElementById('orderViewerBody');
  body.innerHTML = `
    <div class="ov-card">
      <div class="ov-card-title"><span>${isW ? '<span style="background:#fff7ed;color:#c2410c;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:900;border:1px solid #fdba74"><i class="fas fa-store"></i> طلب جملة</span>' : '<span style="background:#f0fafb;color:#0891b2;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:900;border:1px solid #a5f3fc"><i class="fas fa-shopping-bag"></i> طلب مفرق</span>'}</span><span class="status-badge status-${st}">${m[st] || st}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-hashtag"></i> رقم الطلب</span><span class="ov-val">#${order.id}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-calendar"></i> التاريخ</span><span class="ov-val">${new Date(order.date).toLocaleString('ar-EG')}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-tag"></i> وسيلة الدفع</span><span class="ov-val">${order.paymentMethod || 'COD'}</span></div>
      ${order.notes ? `<div class="ov-row"><span class="ov-label"><i class="fas fa-sticky-note"></i> ملاحظات</span><span class="ov-val" style="font-size:12px;max-width:140px;text-align:right;word-break:break-word">${order.notes}</span></div>` : ''}
    </div>
    <div class="ov-card">
      <div class="ov-card-title"><span>العميل</span><i class="fas fa-user"></i></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-user"></i> الاسم</span><span class="ov-val">${order.customer?.name || '—'}${order.customer?.name ? `<a href="javascript:void(0)" onclick="copyText('${order.customer.name.replace(/'/g, "\\'")}', this)" style="color:var(--gray-400);font-size:12px;margin-right:6px" title="نسخ"><i class="far fa-copy"></i></a>` : ''}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-phone"></i> الهاتف</span><span class="ov-val" dir="ltr">${order.customer?.phone || '—'}${order.customer?.phone ? `<a href="javascript:void(0)" onclick="copyText('${order.customer.phone.replace(/'/g, "\\'")}', this)" style="color:var(--gray-400);font-size:12px;margin-right:6px" title="نسخ"><i class="far fa-copy"></i></a>` : ''}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-city"></i> المدينة</span><span class="ov-val">${order.customer?.city || '—'}${order.customer?.city ? `<a href="javascript:void(0)" onclick="copyText('${order.customer.city.replace(/'/g, "\\'")}', this)" style="color:var(--gray-400);font-size:12px;margin-right:6px" title="نسخ"><i class="far fa-copy"></i></a>` : ''}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-map-marker"></i> العنوان</span><span class="ov-val" style="font-size:12px;max-width:140px;text-align:right;word-break:break-word">${order.customer?.address || '—'}${order.customer?.address ? `<a href="javascript:void(0)" onclick="copyText('${order.customer.address.replace(/'/g, "\\'")}', this)" style="color:var(--gray-400);font-size:12px;margin-right:6px" title="نسخ"><i class="far fa-copy"></i></a>` : ''}</span></div>
      ${order.customer?.email ? `<div class="ov-row"><span class="ov-label"><i class="fas fa-envelope"></i> البريد</span><span class="ov-val" style="font-size:11px" dir="ltr">${order.customer.email}</span></div>` : ''}
    </div>
    <div class="ov-card">
      <div class="ov-card-title"><span>المنتجات (${items.length})</span><i class="fas fa-shopping-bag"></i></div>
      ${itemsHTML}
      <div style="border-top:2px solid var(--gray-200);margin-top:8px;padding-top:10px">
        <div class="ov-row"><span class="ov-label">مجموع المنتجات</span><span class="ov-val">${cur}${itemsTotal.toFixed(2)}</span></div>
        <div class="ov-row"><span class="ov-label" style="color:var(--gray-400)">التوصيل</span><span class="ov-val">${shipping > 0 ? cur + shipping.toFixed(2) : 'مجاني'}</span></div>
        ${discount > 0 ? `<div class="ov-row"><span class="ov-label" style="color:#ef4444">الخصم</span><span class="ov-val" style="color:#ef4444">-${cur}${discount.toFixed(2)}${order.coupon_code ? `<span style="display:block;font-size:10px;color:var(--gray-500);font-weight:600">كوبون: ${order.coupon_code}</span>` : ''}</span></div>` : ''}
        <div class="ov-row"><span class="ov-label ov-total">الإجمالي</span><span class="ov-total">${cur}${parseFloat(order.total || 0).toFixed(2)}</span></div>
      </div>
    </div>
    ${state.isAdmin ? `
    <div class="ov-card">
      <div class="ov-card-title"><span>تحديث الحالة</span><i class="fas fa-edit"></i></div>
      <select class="ov-status-select" id="orderStatusSelect">
        <option value="pending" ${st === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
        <option value="processing" ${st === 'processing' ? 'selected' : ''}>قيد التجهيز</option>
        <option value="shipped" ${st === 'shipped' ? 'selected' : ''}>تم الشحن</option>
        <option value="delivered" ${st === 'delivered' ? 'selected' : ''}>تم التوصيل</option>
        <option value="cancelled" ${st === 'cancelled' ? 'selected' : ''}>ملغي</option>
      </select>
      <button class="ov-action-btn primary" onclick="updateOrderStatus()"><i class="fas fa-save"></i> حفظ الحالة</button>
      <button class="ov-action-btn danger" onclick="deleteOrderFromViewer()"><i class="fas fa-trash"></i> حذف الطلب</button>
    </div>` : ''}
  `;
}

async function updateOrderStatus() {
  const sel = document.getElementById('orderStatusSelect');
  if (!sel || !_viewingOrderId) return;
  const newStatus = sel.value;
  const ok = await DB.updateOrder(_viewingOrderId, { status: newStatus });
  if (!ok) { showToast('فشل تحديث الحالة', 'error'); return; }
  showToast('تم تحديث الحالة', 'success');
  const order = state.orders.find(o => String(o.id) === String(_viewingOrderId));
  if (order) order.status = newStatus;
  renderOrderDetails(order);
  loadOrders(document.querySelector('.orders-filter .filter-btn.active')?.dataset?.filter || 'all');
  loadDashboard();
}
async function deleteOrderFromViewer() {
  if (!_viewingOrderId || !(await showConfirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟'))) return;
  const ok = await DB.deleteOrder(_viewingOrderId);
  if (!ok) { showToast('فشل حذف الطلب', 'error'); return; }
  showToast('تم حذف الطلب', 'success');
  closeOrderViewer();
  loadOrders(document.querySelector('.orders-filter .filter-btn.active')?.dataset?.filter || 'all');
  loadDashboard();
}

// ── Distributors ──
let _distTab = 'pending';
function switchDistTab(tab) {
  _distTab = tab;
  document.querySelectorAll('#pageDistributors .dist-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`#pageDistributors .dist-tab:nth-child(${tab === 'pending' ? 1 : 2})`).classList.add('active');
  loadDistributors(state.distributors);
}
let _prodTab = 'products';
function switchProdTab(tab) {
  _prodTab = tab;
  document.querySelectorAll('#pageProducts .dist-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`#pageProducts .dist-tab:nth-child(${tab === 'products' ? 1 : 2})`).classList.add('active');
  document.getElementById('prodProductsTab').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('prodCategoriesTab').style.display = tab === 'categories' ? 'block' : 'none';
  if (tab === 'products') loadProducts(state.products, _categories);
  if (tab === 'categories') loadCategoriesPage(_categories);
}
async function loadDistributors(preFetchedDistributors = null) {
  const el = document.getElementById('distContent');
  if (preFetchedDistributors) {
    state.distributors = preFetchedDistributors;
  } else {
    el.innerHTML = `
      <div class="skeleton-orders-list">
        <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
        <div class="skeleton-order-card"><div class="skeleton avatar"></div><div class="content"><div class="skeleton line-sm"></div><div class="skeleton line-md"></div><div class="skeleton line-lg"></div></div></div>
      </div>
    `;
    state.distributors = (await DB.getDistributors()) || [];
  }
  if (_distTab === 'pending') {
    const pending = state.distributors.filter(d => d.status === 'pending');
    if (!pending.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-user-check"></i><p>لا توجد طلبات انضمام معلقة</p></div>'; return; }
    el.innerHTML = pending.map(d => `<div class="dist-card"><div class="dist-header"><span class="dist-name">${d.name}</span><span class="status-badge status-pending">معلق</span></div><div class="dist-phone">${d.phone}</div><div class="dist-info">${d.city} · ${d.address || ''}</div><div class="dist-actions"><button class="dist-approve-btn" onclick="approveDist('${d.id}')"><i class="fas fa-check"></i> قبول</button><button class="dist-reject-btn" onclick="rejectDist('${d.id}')"><i class="fas fa-times"></i> رفض</button></div></div>`).join('');
  } else {
    const approved = state.distributors.filter(d => d.status === 'approved');
    if (!approved.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>لا يوجد موزعون معتمدون</p></div>'; return; }
    el.innerHTML = '<div class="prod-list">' + approved.map(d => `<div class="dist-card" style="cursor:pointer" onclick="openDistributorViewer('${d.id}')"><div class="dist-header"><span class="dist-name">${d.name}</span><span class="status-badge status-delivered">معتمد</span></div><div class="dist-phone">${d.phone}</div><div class="dist-info">${d.city} · ${d.address || ''}</div></div>`).join('') + '</div>';
  }
}
async function approveDist(id) { if (await DB.updateDistributorStatus(id, 'approved')) { showToast('تم قبول الموزع', 'success'); loadDistributors(); loadDashboard(); } else showToast('فشل قبول الموزع', 'error'); }
async function rejectDist(id) { if (await DB.updateDistributorStatus(id, 'rejected')) { showToast('تم رفض الموزع', 'success'); loadDistributors(); loadDashboard(); } else showToast('فشل رفض الموزع', 'error'); }

// ── Distributor Viewer ──
function openDistributorViewer(id) {
  const dist = state.distributors.find(d => String(d.id) === String(id));
  if (!dist) return;
  document.getElementById('pageDistributorViewer').classList.add('active');
  document.getElementById('distViewerTitle').textContent = dist.name;
  renderDistributorDetails(dist);
}
function closeDistributorViewer() {
  document.getElementById('pageDistributorViewer').classList.remove('active');
}
function renderDistributorDetails(dist) {
  const cur = '₪';
  const distOrders = state.orders.filter(o => {
    const oPhone = (o.customer?.phone || '').replace(/\s+/g, '');
    const dPhone = (dist.phone || '').replace(/\s+/g, '');
    return oPhone === dPhone || String(o.distributor_id) === String(dist.id);
  });
  const totalSpent = distOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const m = { pending: 'قيد الانتظار', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
  const ordersHTML = distOrders.length
    ? distOrders.map(o => {
        const st = o.status || 'pending';
        return `<div class="order-mini-card" onclick="closeDistributorViewer();openOrderViewer(state.orders.find(ord=>String(ord.id)==='${o.id}'))"><div class="order-icon" style="background:${st === 'delivered' ? '#d1fae5' : '#fef3c7'}"><i class="fas fa-${st === 'delivered' ? 'check-circle' : 'hourglass-half'}" style="color:${st === 'delivered' ? 'var(--success)' : 'var(--warning)'}"></i></div><div class="order-info"><div class="name">طلب #${o.id}</div><div class="meta">${new Date(o.date).toLocaleDateString('ar-EG')} · ${m[st] || st}</div></div><div class="order-total">${cur}${parseFloat(o.total || 0).toFixed(2)}</div></div>`;
      }).join('')
    : '<div class="empty-state" style="padding:16px"><i class="fas fa-inbox"></i><p>لا توجد طلبات</p></div>';

  const body = document.getElementById('distViewerBody');
  body.innerHTML = `
    <div class="ov-card">
      <div class="ov-card-title"><span>بيانات الموزع</span><span class="status-badge status-delivered">معتمد</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-user"></i> الاسم</span><span class="ov-val">${dist.name}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-phone"></i> الهاتف</span><span class="ov-val" dir="ltr">${dist.phone}${dist.phone ? `<a href="javascript:void(0)" onclick="copyText('${dist.phone.replace(/'/g, "\\'")}', this)" style="color:var(--gray-400);font-size:12px;margin-right:6px" title="نسخ"><i class="far fa-copy"></i></a>` : ''}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-city"></i> المدينة</span><span class="ov-val">${dist.city}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-map-marker"></i> العنوان</span><span class="ov-val" style="font-size:12px;max-width:160px;text-align:right;word-break:break-word">${dist.address || '—'}</span></div>
      <div class="ov-row"><span class="ov-label"><i class="fas fa-calendar-alt"></i> تاريخ التسجيل</span><span class="ov-val">${dist.created_at ? new Date(dist.created_at).toLocaleDateString('ar-EG') : '—'}</span></div>
    </div>
    <div class="ov-card">
      <div class="ov-card-title"><span>الإحصائيات</span><i class="fas fa-chart-bar"></i></div>
      <div class="ov-row"><span class="ov-label">عدد الطلبات</span><span class="ov-val" style="font-size:18px;font-weight:900">${distOrders.length}</span></div>
      <div class="ov-row"><span class="ov-label">إجمالي المشتريات</span><span class="ov-total">${cur}${totalSpent.toFixed(2)}</span></div>
    </div>
    <div class="ov-card">
      <div class="ov-card-title"><span>الطلبات السابقة (${distOrders.length})</span><i class="fas fa-shopping-bag"></i></div>
      ${ordersHTML}
    </div>
  `;
}

// ── Orders Filter ──
document.getElementById('ordersFilter').addEventListener('click', function(e) {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.orders-filter .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadOrders(btn.dataset.filter, state.orders);
});

// ── Notifications ──
let _notifFilter = 'all';
let _notifIdCounter = parseInt(localStorage.getItem('mobileNotifIdCounter') || '0');
function saveNotifs() {
  localStorage.setItem('mobileNotifs', JSON.stringify(state.notifs.slice(0, 50)));
  localStorage.setItem('mobileNotifIdCounter', String(_notifIdCounter));
}
function switchNotifFilter(type) {
  _notifFilter = type;
  document.querySelectorAll('#notifFilter .filter-btn').forEach(b => b.classList.toggle('active', b.dataset.ntype === type));
  renderNotifs();
}
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (panel.classList.contains('show')) { panel.classList.remove('show'); return; }
  panel.classList.add('show');
  state.newNotifCount = 0;
  document.getElementById('notifDot').classList.remove('show');
  renderNotifs();
}
function addNotif(text, type = 'order', ref = null, icon = 'shopping-cart') {
  state.notifs.unshift({ id: ++_notifIdCounter, text, time: new Date().toLocaleString('ar-EG'), type, ref, icon, read: false });
  state.newNotifCount++;
  document.getElementById('notifDot').classList.add('show');
  saveNotifs();
  if (document.getElementById('notifPanel').classList.contains('show')) renderNotifs();
}
function testNotification() {
  addNotif('🔔 هذا إشعار تجريبي — تم بنجاح!', 'order', null, 'bell');
  showToast('تم عرض الإشعار', 'success');
  playNotifSound('order');
}
function notifSound() {
  const cur = localStorage.getItem('mobileNotifSound');
  const next = cur !== 'off' ? 'off' : 'on';
  localStorage.setItem('mobileNotifSound', next);
  document.getElementById('notifSoundLabel').textContent = next !== 'off' ? 'مفعل' : 'معطل';
  showToast(next !== 'off' ? 'تم تفعيل صوت الإشعارات' : 'تم تعطيل صوت الإشعارات', 'success');
}
const NOTIF_TONES = {
  none:   { name: 'صامت', notes: [] },
  mane:   { name: 'صوت الكاش المميز (mane.mp3) 🎵', file: 'data:audio/mp3;base64,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qYhzn///h/O/14jBEOFgEbQaNhmOCrL12uOs6dybjf//////////////////oabBnlrOAAwgGI5FORTCBgwIE/gkjaW5ySPPtdaaiLAisBty//m/WMBEzBOaAoRNv/sZGRFQukHvN/60SYRI0NXh2jZf6yZJ3rKYvQ+ZvWQI9FACyWQNGLI+n3CEkNIxRQLIdUg7f////6xzFoFgW8+mREiR///wyi4qSAAABAmJAVjQeGAweAATjBkAiwHixiEFXHBoHGBYDr3fWGCIDXLwEEym/YvmDoLCwCuVNv+8K+FUncT9kfO/3Bnq2YNcW3bUCJQUCCLqwaYMYQecBGJAw38GQPLILXXz//XbOphD1cLZoMuRjHtJev0rltjLnGCgCAYETBIMTFu5TOATwCAiVr1QLann/zoSUYxIBZ7Dn5DAEos2f/68Nq2U2KgbE71WWWZly5fKJQsowSIYHF09jPFA2lmFQTgYG29gF/LcnYZB9FEoBhP+WCf8sE//bWgN0GpkeSQIAAHGFxCuieRqFpRl////6yAnmmqpXIwAAUjt41KQlhnlABZiaygCMq7WxYcey+17LSb8h7//H4YExBOaFBBW/+rWNUcaP/zMuF0fId0LjFR/1EwVOxHkuIBnuomC+yhfEufOETVZ6ycAXEBtBsTaRNrGKeMy+/////2FnERMjcax8ij/+9JksYIHkmhIY72lcHoNCb9gFIQdSWUfDWOkweksZjz60XhESa03////8mnOmwAJgXJkwhmiRksAZAtAhorMD/TlNe1BSaB/QxRphacw4g88TAUwlAFSNInuzZhMBsmIgFXixNY3aks1XUGrwQzajS9EIRBBfIQBYEQZ6B1QOqW0ppZLbg1eWPf/897jzDV7v3lJGu7wZUxinlDSVMDAcCzBwBUWSoGpkhjpqKIpgMBiX9SBqaAZd7PxgdYFfPDn5r7SY5//ulVmo5hu7H/3j/w438cZOmUYEmgOgA4r6qAoDwINRMKcmjkCMafFaudLjz//K13/+ta7///7/etfdGgMW+vgwDCkHD8uaFQLBchwgi9//UHDRIeCAELgMBsMAIJMDbXhaUWI+rQry4AY31Z2kHdE1fbIYgXDBqazf+swGBQBJDgwQFv/7NWT42CQ/9RHmKJZBswCkckX/UOWMB+dNhv/NjjFkoG3+swCy8HESkXx0CtA9AQS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' },
  beep:   { name: 'تنبيه بسيط', notes: [[800, 150, 'sine']] },
  double: { name: 'نغمة مزدوجة', notes: [[800, 120, 'sine'], [800, 120, 'sine']] },
  high:   { name: 'عالي', notes: [[1200, 280, 'square']] },
  chime:  { name: 'أجراس', notes: [[523, 150, 'sine'], [659, 150, 'sine'], [784, 260, 'sine']] },
  ding:   { name: 'دينغ', notes: [[988, 180, 'triangle'], [1319, 300, 'triangle']] },
  alert:  { name: 'تحذير', notes: [[440, 140, 'square'], [330, 140, 'square'], [440, 140, 'square']] },
};
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { _audioCtx = null; } }
  if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}
function playTone(toneId) {
  const t = NOTIF_TONES[toneId] || NOTIF_TONES.beep;
  if (t.file) {
    const audio = new Audio(t.file);
    audio.play().catch(e => console.error("Sound play blocked:", e));
    return;
  }
  if (!t.notes || !t.notes.length) return;
  const ctx = getAudioCtx(); if (!ctx) return;
  let t0 = ctx.currentTime;
  t.notes.forEach(([freq, dur, type]) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / 1000);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur / 1000);
    t0 += (dur / 1000) + 0.09;
  });
}
function playNotifSound(type) {
  if (localStorage.getItem('mobileNotifSound') === 'off') return;
  const map = JSON.parse(localStorage.getItem('mobileNotifSounds') || '{}');
  const toneId = map[type] || map['default'] || (type === 'order' ? 'mane' : 'beep');
  playTone(toneId);
}
const NOTIF_SOUND_TYPES = [
  { type: 'order', icon: 'shopping-cart', label: 'طلب جديد' },
  { type: 'distributor', icon: 'user-plus', label: 'طلب انضمام موزع' },
  { type: 'default', icon: 'bell', label: 'إشعارات أخرى' },
];
function openNotifSounds() {
  switchPage('NotifSounds');
  renderSoundsList();
  const tg = document.getElementById('soundsGlobalToggle');
  if (tg) tg.checked = localStorage.getItem('mobileNotifSound') !== 'off';
}
function renderSoundsList() {
  const map = JSON.parse(localStorage.getItem('mobileNotifSounds') || '{}');
  const el = document.getElementById('soundsList');
  if (!el) return;
  el.innerHTML = NOTIF_SOUND_TYPES.map(s => {
    const cur = map[s.type] || 'beep';
    const opts = Object.keys(NOTIF_TONES).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${NOTIF_TONES[k].name}</option>`).join('');
    return `<div class="sound-row"><div class="sound-ic"><i class="fas fa-${s.icon}"></i></div><div class="sound-mid"><div class="sound-label">${s.label}</div><select class="sound-select" onchange="setNotifSound('${s.type}', this.value)">${opts}</select></div><button class="sound-play" type="button" onclick="playTone(this.closest('.sound-row').querySelector('.sound-select').value)"><i class="fas fa-play"></i></button></div>`;
  }).join('');
}
function setNotifSound(type, toneId) {
  const map = JSON.parse(localStorage.getItem('mobileNotifSounds') || '{}');
  map[type] = toneId;
  localStorage.setItem('mobileNotifSounds', JSON.stringify(map));
  showToast('تم حفظ النغمة', 'success');
}
function toggleNotifSoundGlobal() {
  const tg = document.getElementById('soundsGlobalToggle');
  const next = (tg && tg.checked) ? 'on' : 'off';
  localStorage.setItem('mobileNotifSound', next);
  const lbl = document.getElementById('notifSoundLabel');
  if (lbl) lbl.textContent = next !== 'off' ? 'مفعل' : 'معطل';
}
function renderNotifs() {
  const el = document.getElementById('notifList');
  const list = _notifFilter === 'all' ? state.notifs : state.notifs.filter(n => n.type === _notifFilter);
  const clearBtn = document.getElementById('clearNotifBtn');
  if (clearBtn) clearBtn.style.display = state.notifs.length > 0 ? 'inline' : 'none';
  if (list.length === 0) { el.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><p>لا توجد إشعارات</p></div>'; return; }
  el.innerHTML = '<div class="notif-list">' + list.map(n => `<div class="notif-card${n.read ? ' read' : ''}" onclick="notifClick(${n.id})"><div class="notif-ic"><i class="fas fa-${n.icon || 'bell'}"></i></div><div class="notif-body"><div class="notif-time">${n.time}</div><div class="notif-text">${n.text}</div></div></div>`).join('') + '</div>';
}
function notifClick(id) {
  const n = state.notifs.find(x => x.id === id);
  if (!n) return;
  n.read = true;
  saveNotifs();
  renderNotifs();
  toggleNotifPanel();
  if (n.type === 'order' && n.ref) {
    const order = state.orders.find(o => String(o.id) === String(n.ref));
    if (order) openOrderViewer(order);
    else switchPage('Orders');
  } else if (n.type === 'distributor') {
    switchPage('Distributors');
  }
}
async function clearAllNotifs() {
  if (state.notifs.length === 0) return;
  if (!(await showConfirm('مسح كل الإشعارات؟'))) return;
  state.notifs = [];
  state.newNotifCount = 0;
  document.getElementById('notifDot').classList.remove('show');
  saveNotifs();
  renderNotifs();
  showToast('تم مسح الكل', 'success');
}
(function initNotifSwipe() {
  let nid = null, startX = 0, currentX = 0, dragging = false, card = null;
  const list = document.getElementById('notifList');
  if (!list) return;
  const down = (e) => {
    const c = e.target.closest('.notif-card');
    if (!c || c.closest('#notifList') !== list) return;
    card = c; nid = parseInt(card.dataset.nid); dragging = true;
    startX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    currentX = startX;
  };
  const move = (e) => {
    if (!dragging || !card) return;
    currentX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const dx = currentX - startX;
    if (dx < 0) card.style.transform = `translateX(${dx}px)`;
  };
  const up = () => {
    if (!dragging || !card) return;
    const dx = currentX - startX;
    card.style.transform = '';
    if (dx < -60) {
      const idx = state.notifs.findIndex(n => n.id === nid);
      if (idx !== -1) { state.notifs.splice(idx, 1); saveNotifs(); renderNotifs(); showToast('تم حذف الإشعار', 'success'); }
    }
    dragging = false; card = null; nid = null;
  };
  list.addEventListener('touchstart', down, { passive: true });
  list.addEventListener('touchmove', move, { passive: true });
  list.addEventListener('touchend', up);
  list.addEventListener('mousedown', down);
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
})();

// ── Realtime ──
let _lastNotifTime = Date.now();
function setupRealtime() {
  _lastNotifTime = Date.now();
  try {
    if (!DB || !DB.supabase) return;
    const ch = DB.supabase.channel('mobile-admin-orders');
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, p => { const o = p.new; const isW = o.is_wholesale === true || o.is_wholesale === 'true' || o.distributor_id; addNotif('طلب جديد من ' + (o.customer?.name || o.customer?.phone || 'عميل') + ' بقيمة ₪' + parseFloat(o.total || 0).toFixed(2), 'order', o.id, isW ? 'store' : 'shopping-cart'); playNotifSound('order'); _lastNotifTime = Date.now(); loadOrders(); loadDashboard(); });
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'distributors' }, p => { const d = p.new; if (d.status === 'pending') { addNotif('طلب انضمام جديد من ' + d.name, 'distributor', d.id, 'user-plus'); playNotifSound('distributor'); _lastNotifTime = Date.now(); } loadDistributors(); loadDashboard(); });
    ch.subscribe((status) => { if (status !== 'SUBSCRIBED') console.warn('Realtime status:', status); });
  } catch (e) { console.warn('Realtime setup failed:', e); }
  // Polling fallback every 20s — فقط الطلبات التي أُنشئت بعد آخر فحص
  setInterval(async () => {
    try {
      const { data } = await DB.supabase.from('orders').select('*').gte('created_at', new Date(_lastNotifTime).toISOString()).order('created_at', { ascending: true });
      if (data && data.length > 0) {
        for (const o of data) {
          if (new Date(o.created_at).getTime() <= _lastNotifTime) continue;
          const isW = o.is_wholesale === true || o.is_wholesale === 'true' || o.distributor_id;
          addNotif('طلب جديد من ' + (o.customer?.name || o.customer?.phone || 'عميل') + ' بقيمة ₪' + parseFloat(o.total || 0).toFixed(2), 'order', o.id, isW ? 'store' : 'shopping-cart');
          playNotifSound('order');
        }
        _lastNotifTime = Date.now();
        await loadOrders();
        await loadDashboard();
      }
    } catch(e) {}
  }, 20000);
}

// ── Dark Mode ──
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('mobileDarkMode', isDark ? '1' : '');
  const icon = document.getElementById('darkModeIcon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}
// ── Incremental Renderer ──
function renderCurrentPage() {
  const name = state.currentPage || 'Dashboard';
  if (name === 'Dashboard') {
    loadDashboard();
  } else if (name === 'Orders') {
    loadOrders(document.querySelector('.orders-filter .filter-btn.active')?.dataset?.filter || 'all', state.orders);
  } else if (name === 'Products') {
    loadProducts(state.products, _categories);
    loadCategoriesPage(_categories);
  } else if (name === 'Distributors') {
    loadDistributors(state.distributors);
  }
}

function renderAllIncremental(orders = null, products = null, distributors = null, categories = null) {
  renderCurrentPage();
  const currentPage = state.currentPage || 'Dashboard';
  setTimeout(() => {
    if (currentPage !== 'Orders') loadOrders(document.querySelector('.orders-filter .filter-btn.active')?.dataset?.filter || 'all', orders || state.orders);
  }, 100);
  setTimeout(() => {
    if (currentPage !== 'Products') {
      loadProducts(products || state.products, categories || _categories);
      loadCategoriesPage(categories || _categories);
    }
  }, 200);
  setTimeout(() => {
    if (currentPage !== 'Distributors') loadDistributors(distributors || state.distributors);
  }, 300);
}

// ── Local Cache Loader ──
function loadCachedData() {
  try {
    const cachedOrders = localStorage.getItem('cache_orders');
    const cachedProducts = localStorage.getItem('cache_products');
    const cachedDistributors = localStorage.getItem('cache_distributors');
    const cachedCategories = localStorage.getItem('cache_categories');

    if (cachedOrders) state.orders = JSON.parse(cachedOrders);
    if (cachedProducts) state.products = JSON.parse(cachedProducts);
    if (cachedDistributors) state.distributors = JSON.parse(cachedDistributors);
    if (cachedCategories) _categories = JSON.parse(cachedCategories);

    if (state.orders.length || state.products.length || state.distributors.length || _categories.length) {
      renderAllIncremental();
    }
  } catch (e) {
    console.warn('Failed to load cached data:', e);
  }
}

// ── Auto-login ──
document.addEventListener('DOMContentLoaded', () => {
  const savedNotifs = localStorage.getItem('mobileNotifs');
  if (savedNotifs) { state.notifs = JSON.parse(savedNotifs).map(n => ({ icon: 'bell', ...n })); state.newNotifCount = state.notifs.filter(n => !n.read).length; if (state.newNotifCount > 0) document.getElementById('notifDot')?.classList.add('show'); }
  const saved = localStorage.getItem('mobileAdminSession');
  if (saved) {
    state.user = JSON.parse(saved);
    state.isAdmin = state.user.id === 'admin';
    loadCachedData();
    enterApp();
  }
  if (localStorage.getItem('mobileDarkMode') === '1') {
    document.body.classList.add('dark-mode');
    const icon = document.getElementById('darkModeIcon');
    if (icon) icon.className = 'fas fa-sun';
  }
  const nsl = document.getElementById('notifSoundLabel');
  if (nsl) nsl.textContent = localStorage.getItem('mobileNotifSound') !== 'off' ? 'مفعل' : 'معطل';
});
window.addEventListener('hashchange', () => {
  const hashPage = location.hash.replace('#', '');
  if (['Dashboard','Orders','Products','Distributors','Settings'].includes(hashPage) && hashPage !== state.currentPage) switchPage(hashPage);
});

// ─── FCM Admin Token Registration ───────────────────────────────────────
async function initAdminFCM() {
  try {
    // If running in Cordova, but plugins are not loaded yet, wait for deviceready
    if (window.cordova && !window.FirebasePlugin) {
      console.log('📱 Cordova detected but FirebasePlugin not ready. Waiting for deviceready...');
      document.addEventListener('deviceready', () => {
        initAdminFCM();
      }, { once: true });
      return;
    }

    // 1. If running inside Cordova app:
    if (window.cordova && window.FirebasePlugin) {
      console.log('📱 Cordova environment detected. Initializing native FCM...');
      
      window.FirebasePlugin.grantPermission(async (hasPermission) => {
        if (hasPermission) {
          window.FirebasePlugin.getToken(async (token) => {
            if (token) {
              await DB.registerFCMToken(token, 'admin');
              console.log('✅ Native Admin FCM Token Registered:', token.slice(0, 20) + '...');
            }
          }, (err) => {
            console.error('Failed to get native FCM token:', err);
          });
          
          window.FirebasePlugin.onMessageReceived((message) => {
            console.log('Native message received:', message);
            // Show alert or play sound in foreground if desired
            showToast('طلب جديد وارد! 💰', 'success');
          }, (err) => {
            console.error('Failed to register message handler:', err);
          });
        } else {
          console.warn('Native push notification permission denied');
        }
      });
      return;
    }

    // 2. Fallback for standard Web browser environment:
    if (typeof firebase === 'undefined') return;

    const firebaseConfig = {
      apiKey: "AIzaSyBpBVstbuy7-QWX2ZZXWInPrD4UUwG_JgY",
      authDomain: "jomla-d4b6d.firebaseapp.com",
      projectId: "jomla-d4b6d",
      storageBucket: "jomla-d4b6d.firebasestorage.app",
      messagingSenderId: "52673843388",
      appId: "1:52673843388:web:29ac3a7a964045eef8c0b9"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const swPath = window.location.pathname.includes('/r/') ? '/r/firebase-messaging-sw.js' : '/firebase-messaging-sw.js';
      const scopePath = window.location.pathname.includes('/r/') ? '/r/firebase-cloud-messaging-push-scope' : '/firebase-cloud-messaging-push-scope';
      const reg = await navigator.serviceWorker.register(swPath, { scope: scopePath });
      const token = await messaging.getToken({ serviceWorkerRegistration: reg });
      if (token) {
        await DB.registerFCMToken(token, 'admin');
        console.log('✅ Admin FCM Token Registered:', token.slice(0, 20) + '...');
      }
    }
  } catch (e) {
    console.error('FCM init failed:', e);
  }
}
