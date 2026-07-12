// ============================================
// Pro Store - Supabase Database Client
// Replaces server-side dbHelper.js + all API endpoints
// ============================================

const DB = (() => {
  // Initialize Supabase client
  const _supabase = window.supabase
    ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
    : null;

  if (!_supabase) {
    console.error('Supabase client not loaded! Make sure supabase-js CDN is included.');
  }

  const sb = () => _supabase;

  // ── Helper: convert camelCase DB columns to snake_case and vice versa ──
  const toRow = (obj, map) => {
    const r = {};
    for (const [k, v] of Object.entries(obj)) {
      const col = map[k] || k;
      r[col] = v;
    }
    return r;
  };

  const fromRow = (row, map) => {
    if (!row) return row;
    const r = {};
    const reverseMap = {};
    for (const [k, v] of Object.entries(map)) { reverseMap[v] = k; }
    for (const [col, val] of Object.entries(row)) {
      const key = reverseMap[col] || col;
      r[key] = val;
    }
    return r;
  };

  // Column mapping: JS camelCase → DB snake_case
  const PRODUCT_MAP = {
    salePrice: 'sale_price', wholesalePrice: 'wholesale_price',
    costPrice: 'cost_price', adminNote: 'admin_note',
    fakeVisitors: 'fake_visitors', fakeStock: 'fake_stock',
    fakeTimer: 'fake_timer', isLandingPage: 'is_landing_page',
    landingSections: 'landing_sections', variantsData: 'variants_data',
    advanced: 'advanced',
    createdAt: 'created_at'
  };
  const CATEGORY_MAP = {
    parentId: 'parent_id', metaTitle: 'meta_title',
    metaDesc: 'meta_desc', isActive: 'is_active', isBrand: 'is_brand'
  };
  const ORDER_MAP = {
    shippingCost: 'shipping_cost', couponCode: 'coupon_code',
    utmSource: 'utm_source', utmCampaign: 'utm_campaign',
    visitedPages: 'visited_pages', timeSpent: 'time_spent',
    sessionCount: 'session_count', firstVisit: 'first_visit',
    ipCountry: 'ip_country', isWholesale: 'is_wholesale',
    distributorId: 'distributor_id', stockSubtracted: 'stock_subtracted',
    createdAt: 'created_at', updatedAt: 'updated_at',
    customer: 'customer', items: 'items', total: 'total',
    discount: 'discount', status: 'status', notes: 'notes',
    referrer: 'referrer'
  };
  const COUPON_MAP = {
    minOrder: 'min_order', maxUses: 'max_uses', usedCount: 'used_count',
    targetPhone: 'target_phone', productIds: 'product_ids',
    createdAt: 'created_at'
  };
  const DIST_MAP = {
    businessName: 'business_name', createdAt: 'created_at'
  };
  const PAGE_MAP = {
    metaTitle: 'meta_title', metaDesc: 'meta_desc',
    createdAt: 'created_at', updatedAt: 'updated_at'
  };
  const REEL_MAP = {
    videoUrl: 'video_url', productId: 'product_id',
    createdAt: 'created_at', updatedAt: 'updated_at'
  };
  const PROMO_MAP = {
    occasionId: 'occasion_id', occasionName: 'occasion_name',
    occasionEmoji: 'occasion_emoji', startDate: 'start_date',
    endDate: 'end_date', discountType: 'discount_type',
    discountValue: 'discount_value', minOrder: 'min_order',
    showBanner: 'show_banner', bannerText: 'banner_text',
    bannerBgColor: 'banner_bg_color', bannerTextColor: 'banner_text_color',
    bannerImage: 'banner_image', bannerCustomCss: 'banner_custom_css',
    allProducts: 'all_products', productIds: 'product_ids',
    createdAt: 'created_at'
  };
  const NOTIF_MAP = {
    imageUrl: 'image_url', targetPhone: 'target_phone',
    sentAt: 'sent_at', readBy: 'read_by', updatedAt: 'updated_at'
  };
  const TEMPLATE_MAP = {
    imageUrl: 'image_url', createdAt: 'created_at'
  };
  const FCM_MAP = { createdAt: 'created_at' };
  const PRESET_MAP = {
    bgColor: 'bg_color', textColor: 'text_color',
    customCss: 'custom_css', isDefault: 'is_default',
    createdAt: 'created_at'
  };

  return {
    supabase: sb(),

    // ── Settings ──────────────────────────────────────────────────────────
    async getSettings() {
      const { data, error } = await sb().from('settings').select('key, value');
      if (error) { console.error('getSettings:', error); return {}; }
      const settings = {};
      data.forEach(row => { settings[row.key] = row.value; });
      return settings;
    },

    async setSetting(key, value) {
      const { error } = await sb().from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) console.error('setSetting:', error);
    },

    async setSettings(obj) {
      const rows = Object.entries(obj).map(([key, value]) => ({
        key, value, updated_at: new Date().toISOString()
      }));
      const { error } = await sb().from('settings').upsert(rows, { onConflict: 'key' });
      if (error) console.error('setSettings:', error);
    },

    // ── Products ──────────────────────────────────────────────────────────
    async getProducts() {
      const { data, error } = await sb().from('products').select('*').order('created_at', { ascending: false });
      if (error) { console.error('getProducts:', error); return []; }
      return data.map(r => {
        const p = fromRow(r, PRODUCT_MAP);
        // Normalize id to string
        p.id = String(p.id);
        return p;
      });
    },

    async getProduct(id) {
      const { data, error } = await sb().from('products').select('*').eq('id', String(id)).single();
      if (error) { console.error('getProduct:', error); return null; }
      return fromRow(data, PRODUCT_MAP);
    },

    async saveProduct(product) {
      const row = toRow(product, PRODUCT_MAP);
      row.id = String(row.id || Date.now());
      
      if (row.advanced === undefined || row.advanced === null) row.advanced = {};
      if (typeof row.advanced !== 'object') row.advanced = {};

      // Move UI/advanced fields to advanced JSONB column
      const advancedKeys = ['stock', 'comingSoonDate', 'isComingSoon', 'isRecommended'];
      advancedKeys.forEach(k => {
        if (k in row) {
          row.advanced[k] = row[k];
          delete row[k];
        }
      });

      // Filter out any other keys not present in the database table schema
      const dbColumns = [
        'id', 'name', 'price', 'sale_price', 'wholesale_price', 'cost_price',
        'sku', 'image', 'images', 'description', 'categories', 'category',
        'admin_note', 'fake_visitors', 'fake_stock', 'fake_timer',
        'is_landing_page', 'landing_sections', 'variants', 'variants_data',
        'advanced', 'created_at'
      ];
      Object.keys(row).forEach(k => {
        if (!dbColumns.includes(k)) {
          delete row[k];
        }
      });

      // Numeric columns must be numbers or null (Postgres rejects empty strings)
      ['price', 'sale_price', 'wholesale_price', 'cost_price'].forEach(col => {
        if (col in row) {
          const v = row[col];
          row[col] = (v === '' || v === null || v === undefined) ? null : Number(v);
        }
      });
      console.log('saveProduct row:', JSON.stringify(row, null, 2));
      const { error } = await sb().from('products').upsert(row, { onConflict: 'id' });
      if (error) { console.error('saveProduct error:', JSON.stringify(error)); return false; }
      return true;
    },

    async deleteProduct(id) {
      const { error } = await sb().from('products').delete().eq('id', String(id));
      if (error) { console.error('deleteProduct:', error); return false; }
      return true;
    },

    async importProducts(products) {
      const rows = products.map(p => {
        const row = toRow(p, PRODUCT_MAP);
        row.id = String(row.id || Date.now());
        if ('comingSoonDate' in row) {
          row.advanced = row.advanced || {};
          if (row.comingSoonDate) row.advanced.comingSoonDate = row.comingSoonDate;
          delete row.comingSoonDate;
        }
        if (typeof row.advanced !== 'object') row.advanced = {};
        ['price', 'sale_price', 'wholesale_price', 'cost_price'].forEach(col => {
          if (col in row) {
            const v = row[col];
            row[col] = (v === '' || v === null || v === undefined) ? null : Number(v);
          }
        });
        return row;
      });
      const { error } = await sb().from('products').upsert(rows, { onConflict: 'id' });
      if (error) { console.error('importProducts:', error); return false; }
      return true;
    },

    // ── Categories ────────────────────────────────────────────────────────
    async getCategories() {
      const { data, error } = await sb().from('categories').select('*');
      if (error) { console.error('getCategories:', error); return []; }
      return data.map(r => fromRow(r, CATEGORY_MAP));
    },

    async saveCategory(cat) {
      const row = toRow(cat, CATEGORY_MAP);
      row.id = String(row.id || Date.now());
      const { error } = await sb().from('categories').upsert(row, { onConflict: 'id' });
      if (error) { console.error('saveCategory:', error); return false; }
      return true;
    },

    async deleteCategory(id) {
      const { error } = await sb().from('categories').delete().eq('id', String(id));
      if (error) { console.error('deleteCategory:', error); return false; }
      return true;
    },

    // ── Orders ────────────────────────────────────────────────────────────
    async getOrders() {
      const { data, error } = await sb().from('orders').select('*').order('date', { ascending: false });
      if (error) {
        alert('Supabase getOrders Error: ' + JSON.stringify(error));
        console.error('getOrders:', error);
        return [];
      }
      return data.map(r => {
        const o = fromRow(r, ORDER_MAP);
        o.id = String(o.id);
        return o;
      });
    },

    async getOrder(id) {
      const { data, error } = await sb().from('orders').select('*').eq('id', String(id)).single();
      if (error) return null;
      return fromRow(data, ORDER_MAP);
    },

    async saveOrder(order) {
      if (!sb()) { console.error('saveOrder: Supabase client not initialized'); return null; }
      const allowed = [
        'id', 'date', 'customer', 'items', 'total', 'shipping_cost', 'discount',
        'coupon_code', 'notes', 'status', 'is_wholesale', 'distributor_id',
        'stock_subtracted', 'created_at', 'updated_at'
      ];
      const fullRow = toRow(order, ORDER_MAP);
      fullRow.id = String(fullRow.id || 'ORD-' + Date.now());
      if (!fullRow.date) fullRow.date = new Date().toISOString();
      const row = {};
      for (const k of allowed) {
        if (fullRow[k] !== undefined) row[k] = fullRow[k];
      }
      const { data, error } = await sb().from('orders').upsert(row, { onConflict: 'id' }).select();
      if (error) { console.error('saveOrder:', error.message, error.details, error.hint); return null; }
      return row.id;
    },

    // Alias for compatibility
    async createOrder(order) {
      return this.saveOrder(order);
    },

    async updateOrder(id, updates) {
      const row = {};
      if (updates.status !== undefined) row.status = updates.status;
      if (updates.notes !== undefined) row.notes = updates.notes;
      if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;
      if (updates.stockSubtracted !== undefined) row.stock_subtracted = updates.stockSubtracted;
      const { error } = await sb().from('orders').update(row).eq('id', String(id));
      if (error) { console.error('updateOrder:', error); return false; }
      return true;
    },

    async deleteOrder(id) {
      const { error } = await sb().from('orders').delete().eq('id', String(id));
      if (error) { console.error('deleteOrder:', error); return false; }
      return true;
    },

    async getOrdersByPhone(phone) {
      const { data, error } = await sb().from('orders')
        .select('*')
        .eq('customer->>phone', phone)
        .order('date', { ascending: false });
      if (error) { console.error('getOrdersByPhone:', error); return []; }
      return data.map(r => fromRow(r, ORDER_MAP));
    },

    // ── Coupons ───────────────────────────────────────────────────────────
    async getCoupons() {
      const { data, error } = await sb().from('coupons').select('*');
      if (error) { console.error('getCoupons:', error); return []; }
      return data.map(r => fromRow(r, COUPON_MAP));
    },

    async saveCoupon(coupon) {
      const row = toRow(coupon, COUPON_MAP);
      row.code = (row.code || '').toUpperCase();
      const { error } = await sb().from('coupons').upsert(row, { onConflict: 'code' });
      if (error) { console.error('saveCoupon:', error); return false; }
      return true;
    },

    async deleteCoupon(code) {
      const { error } = await sb().from('coupons').delete().eq('code', code.toUpperCase());
      if (error) { console.error('deleteCoupon:', error); return false; }
      return true;
    },

    async incrementCouponUsage(code) {
      const { data, error: fetchErr } = await sb().from('coupons').select('used_count').eq('code', code.toUpperCase()).single();
      if (fetchErr || !data) return false;
      const newCount = (data.used_count || 0) + 1;
      const { error } = await sb().from('coupons').update({ used_count: newCount }).eq('code', code.toUpperCase());
      if (error) { console.error('incrementCouponUsage:', error); return false; }
      return true;
    },

    async validateCoupon(code, phone, cart) {
      const { data, error } = await sb().from('coupons').select('*').eq('code', code.toUpperCase()).single();
      if (error || !data) return { valid: false, error: 'كود الخصم غير موجود' };
      const coupon = fromRow(data, COUPON_MAP);
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, error: 'عذراً، هذا الكوبون استنفد عدد مرات الاستخدام' };
      }
      if (coupon.targetPhone && coupon.targetPhone !== phone) {
        return { valid: false, error: 'هذا الكوبون مخصص لعميل آخر' };
      }
      if (coupon.productIds && coupon.productIds.length > 0 && cart) {
        const hasRestricted = cart.some(item => coupon.productIds.includes(String(item.id)));
        if (!hasRestricted) return { valid: false, error: 'هذا الكوبون لا يشمل المنتجات في سلتك' };
      }
      return { valid: true, coupon };
    },

    // ── Distributors ──────────────────────────────────────────────────────
    async getDistributors() {
      const { data, error } = await sb().from('distributors').select('*');
      if (error) { console.error('getDistributors:', error); return []; }
      return data.map(r => fromRow(r, DIST_MAP));
    },

    async saveDistributor(dist) {
      const row = toRow(dist, DIST_MAP);
      row.id = String(row.id || 'DIST-' + Date.now());
      const { error } = await sb().from('distributors').upsert(row, { onConflict: 'id' });
      if (error) { console.error('saveDistributor:', error); return false; }
      return true;
    },

    async loginDistributor(phone, password) {
      const { data, error } = await sb().from('distributors').select('*').eq('phone', phone).single();
      if (error || !data) return { error: 'الرقم غير مسجل' };
      if (data.password !== password) return { error: 'كلمة المرور غير صحيحة' };
      if (data.status === 'pending') return { error: 'طلبك قيد المراجعة من الإدارة' };
      if (data.status === 'rejected') return { error: 'تم رفض طلبك. تواصل مع الإدارة' };
      return { distributor: fromRow(data, DIST_MAP) };
    },

    async updateDistributorStatus(id, status) {
      const { error } = await sb().from('distributors').update({ status }).eq('id', String(id));
      if (error) { console.error('updateDistributorStatus:', error); return false; }
      return true;
    },

    async editDistributor(id, updates) {
      const row = {};
      if (updates.name) row.name = updates.name;
      if (updates.phone) row.phone = updates.phone;
      if (updates.password) row.password = updates.password;
      if (updates.businessName !== undefined) row.business_name = updates.businessName;
      if (updates.status) row.status = updates.status;
      const { error } = await sb().from('distributors').update(row).eq('id', String(id));
      if (error) { console.error('editDistributor:', error); return false; }
      return true;
    },

    async getDistributorPurchasedProducts(phone) {
      const orders = await this.getOrdersByPhone(phone);
      const map = {};
      orders.forEach(o => {
        (o.items || []).forEach(item => {
          const key = `${item.id}-${item.color || ''}-${item.size || ''}`;
          if (!map[key]) {
            map[key] = {
              id: item.id, name: item.name, image: item.image,
              color: item.color || '', size: item.size || '',
              quantity: 0, totalSpent: 0, orders: []
            };
          }
          map[key].quantity += parseInt(item.quantity || 1);
          map[key].totalSpent += parseFloat(item.price || 0) * parseInt(item.quantity || 1);
          map[key].orders.push({ orderId: o.id, date: o.date, status: o.status, price: item.price, quantity: item.quantity });
        });
      });
      return Object.values(map);
    },

    // ── Pages ─────────────────────────────────────────────────────────────
    async getPages() {
      const { data, error } = await sb().from('pages').select('*');
      if (error) { console.error('getPages:', error); return []; }
      return data.map(r => fromRow(r, PAGE_MAP));
    },

    async savePage(page) {
      const row = toRow(page, PAGE_MAP);
      row.id = String(row.id || 'PAGE-' + Date.now());
      row.updated_at = new Date().toISOString();
      const { error } = await sb().from('pages').upsert(row, { onConflict: 'id' });
      if (error) { console.error('savePage:', error); return false; }
      return true;
    },

    async deletePage(id) {
      const { error } = await sb().from('pages').delete().eq('id', String(id));
      if (error) { console.error('deletePage:', error); return false; }
      return true;
    },

    // ── Reels ─────────────────────────────────────────────────────────────
    async getReels() {
      const { data, error } = await sb().from('reels').select('*').order('created_at', { ascending: false });
      if (error) { console.error('getReels:', error); return []; }
      return data.map(r => fromRow(r, REEL_MAP));
    },

    async saveReel(reel) {
      const row = toRow(reel, REEL_MAP);
      row.id = String(row.id || 'reel_' + Date.now());
      const { error } = await sb().from('reels').upsert(row, { onConflict: 'id' });
      if (error) { console.error('saveReel:', error); return false; }
      return true;
    },

    async deleteReel(id) {
      const { error } = await sb().from('reels').delete().eq('id', String(id));
      if (error) { console.error('deleteReel:', error); return false; }
      return true;
    },

    // ── Promotions ────────────────────────────────────────────────────────
    async getPromotions() {
      const { data, error } = await sb().from('promotions').select('*');
      if (error) { console.error('getPromotions:', error); return []; }
      return data.map(r => fromRow(r, PROMO_MAP));
    },

    async getActivePromotions() {
      const now = new Date().toISOString();
      const { data, error } = await sb().from('promotions')
        .select('*')
        .lte('start_date', now)
        .gte('end_date', now);
      if (error) return [];
      return data.map(r => fromRow(r, PROMO_MAP));
    },

    async savePromotion(promo) {
      const row = toRow(promo, PROMO_MAP);
      row.id = String(row.id || 'PROMO-' + Date.now());
      const { error } = await sb().from('promotions').upsert(row, { onConflict: 'id' });
      if (error) { console.error('savePromotion:', error); return false; }
      return true;
    },

    async deletePromotion(id) {
      const { error } = await sb().from('promotions').delete().eq('id', String(id));
      if (error) { console.error('deletePromotion:', error); return false; }
      return true;
    },

    // ── Notifications ─────────────────────────────────────────────────────
    async getNotifications() {
      const { data, error } = await sb().from('notifications').select('*').order('sent_at', { ascending: false });
      if (error) { console.error('getNotifications:', error); return []; }
      return data.map(r => fromRow(r, NOTIF_MAP));
    },

    async saveNotification(notif) {
      const row = toRow(notif, NOTIF_MAP);
      row.id = row.id || Date.now();
      row.sent_at = new Date().toISOString();
      const { error } = await sb().from('notifications').upsert(row, { onConflict: 'id' });
      if (error) { console.error('saveNotification:', error); return false; }
      return true;
    },

    async deleteNotification(id) {
      const { error } = await sb().from('notifications').delete().eq('id', id);
      if (error) { console.error('deleteNotification:', error); return false; }
      return true;
    },

    // ── Analytics ─────────────────────────────────────────────────────────
    async getAnalytics() {
      const { data, error } = await sb().from('analytics').select('*').eq('id', 1).single();
      if (error || !data) return { visits: 0, add_to_cart: 0, init_checkout: 0, history: [] };
      return {
        visits: data.visits || 0,
        add_to_cart: data.add_to_cart || 0,
        init_checkout: data.init_checkout || 0,
        history: data.history || []
      };
    },

    async trackEvent(eventName) {
      let dbField = eventName;
      if (dbField === 'visit') dbField = 'visits';

      const allowed = ['visits', 'add_to_cart', 'init_checkout'];
      if (!allowed.includes(dbField)) return;

      const stats = await this.getAnalytics();
      const today = new Date().toISOString().split('T')[0];

      stats[dbField] = (stats[dbField] || 0) + 1;

      let dayEntry = stats.history.find(h => h.date === today);
      if (!dayEntry) {
        dayEntry = { date: today, visits: 0, add_to_cart: 0, init_checkout: 0, orders: 0, revenue: 0 };
        stats.history.push(dayEntry);
      }
      dayEntry[dbField] = (dayEntry[dbField] || 0) + 1;

      if (stats.history.length > 30) stats.history.shift();

      const { error } = await sb().from('analytics').update({
        [dbField]: stats[dbField],
        history: stats.history,
        updated_at: new Date().toISOString()
      }).eq('id', 1);
      if (error) console.error('trackEvent:', error);
    },

    async getAnalyticsStats() {
      const analytics = await this.getAnalytics();
      const orders = await this.getOrders();
      const products = await this.getProducts();
      const today = new Date().toISOString().split('T')[0];

      let totalRevenue = 0, todayRevenue = 0, todayOrders = 0;
      orders.forEach(o => {
        const total = parseFloat(o.total || 0);
        totalRevenue += total;
        const orderDate = new Date(o.date || o.createdAt).toISOString().split('T')[0];
        if (orderDate === today) { todayOrders++; todayRevenue += total; }
      });

      const avgOrderValue = orders.length > 0 ? (totalRevenue / orders.length) : 0;

      // City stats
      const cityMap = {};
      orders.forEach(o => {
        const city = o.customer ? o.customer.city : 'غير محدد';
        if (!cityMap[city]) cityMap[city] = { name: city, revenue: 0 };
        cityMap[city].revenue += parseFloat(o.total || 0);
      });

      // Top products
      const prodMap = {};
      orders.forEach(o => {
        (o.items || []).forEach(item => {
          if (!prodMap[item.id]) prodMap[item.id] = { id: item.id, name: item.name, image: item.image, count: 0, revenue: 0 };
          const qty = parseInt(item.quantity || 1);
          prodMap[item.id].count += qty;
          prodMap[item.id].revenue += parseFloat(item.price || 0) * qty;
        });
      });

      return {
        summary: {
          totalRevenue, todayRevenue, todayOrders, avgOrderValue,
          totalProducts: products.length,
          totalVisits: analytics.visits || 0,
          totalAddToCart: analytics.add_to_cart || 0,
          totalInitCheckout: analytics.init_checkout || 0,
          totalOrders: orders.length
        },
        history: analytics.history,
        cityStats: Object.values(cityMap).sort((a, b) => b.revenue - a.revenue),
        topProducts: Object.values(prodMap).sort((a, b) => b.count - a.count).slice(0, 10)
      };
    },

    // ── Abandoned Carts ───────────────────────────────────────────────────
    async getAbandoned() {
      const { data, error } = await sb().from('abandoned').select('*').order('updated_at', { ascending: false });
      if (error) return [];
      return data;
    },

    async saveAbandoned(entry) {
      const { error } = await sb().from('abandoned').upsert({
        session_id: entry.sessionId,
        name: entry.name || '',
        phone: entry.phone || '',
        email: entry.email || '',
        city: entry.city || '',
        address: entry.address || '',
        items: entry.items || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id' });
      if (error) { console.error('saveAbandoned:', error); return false; }
      return true;
    },

    async deleteAbandoned(sessionId) {
      const { error } = await sb().from('abandoned').delete().eq('session_id', sessionId);
      if (error) { console.error('deleteAbandoned:', error); return false; }
      return true;
    },

    // ── Pending Reviews ───────────────────────────────────────────────────
    async getPendingReviews() {
      const { data, error } = await sb().from('pending_reviews').select('*');
      if (error) return [];
      return data;
    },

    async submitReview(review) {
      const { error } = await sb().from('pending_reviews').insert({
        id: review.id || 'rev_' + Date.now() + Math.random().toString(36).substr(2, 5),
        name: review.name,
        rating: review.rating || 5,
        text: review.text,
        avatar: review.avatar || '',
        created_at: new Date().toISOString()
      });
      if (error) { console.error('submitReview:', error); return false; }
      return true;
    },

    async approveReview(id) {
      const { error } = await sb().from('pending_reviews').delete().eq('id', id);
      if (error) { console.error('approveReview:', error); return false; }
      return true;
    },

    async rejectReview(id) {
      const { error } = await sb().from('pending_reviews').delete().eq('id', id);
      if (error) { console.error('rejectReview:', error); return false; }
      return true;
    },

    // ── Custom Templates ──────────────────────────────────────────────────
    async getCustomTemplates() {
      const { data, error } = await sb().from('custom_templates').select('*');
      if (error) return [];
      return data.map(r => fromRow(r, TEMPLATE_MAP));
    },

    async saveCustomTemplate(tpl) {
      const row = toRow(tpl, TEMPLATE_MAP);
      row.id = row.id || Date.now();
      const { error } = await sb().from('custom_templates').upsert(row, { onConflict: 'id' });
      if (error) { console.error('saveCustomTemplate:', error); return false; }
      return true;
    },

    async deleteCustomTemplate(id) {
      const { error } = await sb().from('custom_templates').delete().eq('id', id);
      if (error) { console.error('deleteCustomTemplate:', error); return false; }
      return true;
    },

    // ── FCM Tokens ────────────────────────────────────────────────────────
    async registerFCMToken(token, role) {
      const { error } = await sb().from('fcm_tokens').upsert({
        token, role: role || 'customer', created_at: new Date().toISOString()
      }, { onConflict: 'token' });
      if (error) console.error('registerFCMToken:', error);
    },

    // ── Banner Presets ────────────────────────────────────────────────────
    async getBannerPresets() {
      const { data, error } = await sb().from('banner_presets').select('*');
      if (error) return [];
      return data.map(r => fromRow(r, PRESET_MAP));
    },

    async saveBannerPreset(preset) {
      const row = toRow(preset, PRESET_MAP);
      row.id = String(row.id || 'PRESET-' + Date.now());
      const { error } = await sb().from('banner_presets').upsert(row, { onConflict: 'id' });
      if (error) { console.error('saveBannerPreset:', error); return false; }
      return true;
    },

    // ── Wholesale Prices ──────────────────────────────────────────────────
    async getWholesalePrices(phone) {
      const dists = await this.getDistributors();
      const dist = dists.find(d => d.phone === phone && d.status === 'approved');
      if (!dist) return null;
      const products = await this.getProducts();
      const prices = {};
      products.forEach(p => { if (p.wholesalePrice) prices[p.id] = p.wholesalePrice; });
      return { prices, distributor: dist };
    },

    // ── Bulk Wholesale Update ─────────────────────────────────────────────
    async bulkUpdateWholesale(updates) {
      for (const upd of updates) {
        const { error } = await sb().from('products')
          .update({ wholesale_price: upd.wholesalePrice })
          .eq('id', String(upd.id));
        if (error) console.error('bulkUpdateWholesale:', error);
      }
      return true;
    },

    // ── Stock Management ──────────────────────────────────────────────────
    async adjustStock(items, direction) {
      const products = await this.getProducts();
      for (const item of items) {
        const product = products.find(p => String(p.id) === String(item.id));
        if (!product) continue;
        const qty = parseInt(item.quantity) || 1;
        const change = direction === 'deduct' ? -qty : qty;

        if (product.variants && product.variants.length > 0 && (item.color || item.size)) {
          product.variants.forEach(variant => {
            if (variant.values && Array.isArray(variant.values)) {
              variant.values.forEach(val => {
                const match = (item.color && String(val.value).trim() === String(item.color).trim()) ||
                              (item.size && String(val.value).trim() === String(item.size).trim());
                if (match) {
                  val.stock = String(Math.max(0, (parseInt(val.stock) || 0) + change));
                }
              });
            }
          });
        }

        if (product.stock !== undefined) {
          product.stock = Math.max(0, (parseInt(product.stock) || 0) + change);
        }

        await this.saveProduct(product);
      }
    }
  };
})();
