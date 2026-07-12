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
      const { data, error } = await sb().from('orders').select('*').order('date', { ascending: false });
      if (error) { console.error('Orders error:', error.code, error.message); return []; }
      return (data || []).map(r => ({ id: String(r.id), date: r.date, customer: r.customer || {}, items: r.items || [], total: r.total || 0, shipping_cost: r.shipping_cost || 0, discount: r.discount || 0, coupon_code: r.coupon_code || '', notes: r.notes || '', status: r.status || 'pending', is_wholesale: r.is_wholesale, distributor_id: r.distributor_id, created_at: r.created_at, updated_at: r.updated_at }));
    },
    async getProducts() {
      const { data, error } = await sb().from('products').select('*');
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
  if ((localAdmin && phone === localAdmin && password === localPass) || (phone === '972568313507' && password === 'saifps4ps')) {
    state.isAdmin = true;
    state.user = { phone, name: 'المدير', id: 'admin' };
    localStorage.setItem('mobileAdminSession', JSON.stringify(state.user));
    if (!localAdmin) { localStorage.setItem('mobileAdminPhone', phone); localStorage.setItem('mobileAdminPass', password); }
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
  if (name === 'Orders') loadOrders();
  if (name === 'Products') { if (_prodTab !== 'products') switchProdTab('products'); loadProducts(); loadCategoriesPage(); }
  if (name === 'Distributors') loadDistributors();
  if (name === 'Dashboard') loadDashboard();
  state.currentPage = name;
}

async function loadAll() { await loadOrders(); await Promise.all([loadProducts(), loadDistributors(), loadDashboard()]); }
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
async function loadOrders(filter = 'all') {
  const el = document.getElementById('ordersList');
  try {
    state.orders = (await DB.getOrders()) || [];
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
async function loadProducts() {
  const el = document.getElementById('productsList');
  const search = (document.getElementById('prodSearch').value || '').toLowerCase();
  try {
    state.products = (await DB.getProducts()) || [];
    await loadCategories();
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
      return `<div class="prod-card"><div class="prod-img">${catName !== 'بدون تصنيف' ? `<span class="prod-cat-badge"><i class="fas fa-tag"></i> ${catName}</span>` : ''}${p.image ? '<img src="' + p.image + '" alt="">' : '<i class="fas fa-box" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray-400);font-size:20px;"></i>'}</div><div class="prod-info"><div class="prod-name">${p.name || 'بدون اسم'}</div><div class="prod-price-row"><span class="prod-price">₪${parseFloat(p.price || 0).toFixed(2)}</span>${wholesale ? `<span class="prod-wholesale-price">جملة ₪${wholesale.toFixed(2)}</span>` : ''}</div><div class="prod-stock ${sc}">${st}</div></div></div>`;
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
async function loadCategoriesPage() {
  const el = document.getElementById('categoriesList');
  try {
    const cats = await DB.supabase.from('categories').select('*').order('name');
    _categories = cats.data || [];
    if (!_categories.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>لا توجد تصنيفات</p><p style="font-size:12px;margin-top:4px">اضف تصنيف من زر الإضافة بالأعلى</p></div>'; return; }
    el.innerHTML = '<div class="cat-grid">' + _categories.map(c => {
      const count = state.products.filter(p => String(p.category) === String(c.id) || p.category === c.name || (Array.isArray(p.categories) && p.categories.some(cid => String(cid) === String(c.id) || String(cid) === c.name))).length;
      const icon = c.icon && c.icon.startsWith('fa-') ? `<i class="fas ${c.icon}"></i>` : c.icon ? `<img src="${c.icon}" style="width:32px;height:32px;object-fit:contain">` : '<i class="fas fa-tag"></i>';
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
  loadDistributors();
}
let _prodTab = 'products';
function switchProdTab(tab) {
  _prodTab = tab;
  document.querySelectorAll('#pageProducts .dist-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`#pageProducts .dist-tab:nth-child(${tab === 'products' ? 1 : 2})`).classList.add('active');
  document.getElementById('prodProductsTab').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('prodCategoriesTab').style.display = tab === 'categories' ? 'block' : 'none';
  if (tab === 'products') loadProducts();
  if (tab === 'categories') loadCategoriesPage();
}
async function loadDistributors() {
  state.distributors = (await DB.getDistributors()) || [];
  const el = document.getElementById('distContent');
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
  loadOrders(btn.dataset.filter);
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
  const toneId = map[type] || map['default'] || 'beep';
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
// ── Auto-login ──
document.addEventListener('DOMContentLoaded', () => {
  const savedNotifs = localStorage.getItem('mobileNotifs');
  if (savedNotifs) { state.notifs = JSON.parse(savedNotifs).map(n => ({ icon: 'bell', ...n })); state.newNotifCount = state.notifs.filter(n => !n.read).length; if (state.newNotifCount > 0) document.getElementById('notifDot')?.classList.add('show'); }
  const saved = localStorage.getItem('mobileAdminSession');
  if (saved) { state.user = JSON.parse(saved); state.isAdmin = state.user.id === 'admin'; enterApp(); }
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
