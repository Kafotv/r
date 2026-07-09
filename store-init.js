// ============================================
// Pro Store - Client-Side Store Initialization
// Replaces server-side template rendering
// ============================================

window.StoreInit = {
  settings: {},
  categories: [],
  products: [],

  async init() {
    try {
      // Load settings from Supabase
      const { data: settingsRows } = await DB.supabase.from('settings').select('key, value');
      this.settings = {};
      if (settingsRows) {
        settingsRows.forEach(r => { this.settings[r.key] = r.value; });
      }

      // Parse home sections from settings
      if (this.settings.home_sections_json) {
        try { this.homeSections = typeof this.settings.home_sections_json === 'string' ? JSON.parse(this.settings.home_sections_json) : this.settings.home_sections_json; } catch(e) { this.homeSections = []; }
      } else {
        this.homeSections = [];
      }

      // Apply main color
      const mainColor = this.settings.mainColor || '#fa0000';
      document.documentElement.style.setProperty('--primary', mainColor);
      document.documentElement.style.setProperty('--primary-light', mainColor + '22');
      document.querySelector('meta[name="theme-color"]').content = mainColor;

      // Apply title
      document.title = this.settings.metaTitle || this.settings.storeName || 'متجري';

      // Set global vars
      window.storePhone = this.settings.storePhone || '';
      window.currency = this.settings.currency || '₪';
      window.searchPlaceholders = this._parseSearchPlaceholders();

      // Render all sections
      this._renderAnnouncement();
      this._renderLogo();
      this._renderSocialLinks();
      this._renderTrackingScripts();
      this._renderPwaBanner();
      this._renderWhatsAppBubble();
      this._renderPagesLinks();
      this._renderCitiesOptions();
      this._renderFooter();
      this._renderWelcomePopup();

      // Load categories and render sidebar + modal
      await this._loadCategories();
      this._renderSidebar();
      await this._renderCategoriesModal();
      this._renderBrandsModal();

      // Load and render products
      await this._loadProducts();
      this._renderHeroSection();
      this._renderHomeSections();

      // Initialize cart
      if (window.cart) window.cart.init();

      // Handle logo click (home navigation)
      const logo = document.getElementById('logoHome');
      if (logo) {
        logo.addEventListener('click', (e) => {
          e.preventDefault();
          this._goHome();
        });
      }

      // PWA Install Prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'flex';
      });

      // Handle deep links (#?product=ID / #?cat=ID)
      this._handleHash();

    } catch (err) {
      console.error('StoreInit error:', err);
    }
  },

  // ── Hash / Deep Link Routing ───────────────────────────────────────────────
  _handleHash() {
    const hash = window.location.hash || '';
    const productMatch = hash.match(/product=([^&]+)/);
    if (productMatch) {
      const id = decodeURIComponent(productMatch[1]);
      // Defer in case products are still loading
      const tryOpen = () => {
        const product = this.products.find(p => String(p.id) === String(id));
        if (product) {
          this._showProductDetail(id);
        } else if (this._hashRetries < 20) {
          this._hashRetries++;
          setTimeout(tryOpen, 200);
        }
      };
      this._hashRetries = 0;
      tryOpen();
      return;
    }
    const catMatch = hash.match(/cat=([^&]+)/);
    if (catMatch) {
      const catId = decodeURIComponent(catMatch[1]);
      const tryFilter = () => {
        if (this.products && this.products.length) {
          this._filterByCategory(catId);
        } else if (this._hashRetries < 20) {
          this._hashRetries++;
          setTimeout(tryFilter, 200);
        }
      };
      this._hashRetries = 0;
      tryFilter();
      return;
    }
    // No product/cat deep link → make sure the store is visible
    this._hideProductPage();
  },

  _hashRetries: 0,

  // ── Product Detail Page ────────────────────────────────────────────────────
  _showProductDetail(productId) {
    const product = this.products.find(p => String(p.id) === String(productId));
    if (!product) return;

    const currency = this.settings.currency || '₪';
    const page = document.getElementById('productPage');
    if (!page) return;

    const hasSale = product.salePrice && parseFloat(product.salePrice) > 0;
    const images = [product.image].concat(Array.isArray(product.images) ? product.images : []).filter(Boolean);
    const mainImg = images[0] || '';
    const galleryThumbs = images.map((img, i) =>
      `<img src="${img}" onclick="StoreInit._setDetailImage('${img.replace(/'/g, "\\'")}')"
        style="width:64px;height:64px;object-fit:cover;border-radius:12px;cursor:pointer;border:2px solid ${i === 0 ? 'var(--primary)' : 'transparent'};">`
    ).join('');

    let variantsHTML = '';
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(v => {
        const values = Array.isArray(v.values) ? v.values : [];
        variantsHTML += `<div class="product-option" id="detail-option-${v.name.replace(/\s+/g, '-')}">
          <label style="font-weight:800;margin:18px 0 10px;display:block;">${v.name}</label>
          <div class="option-pills" data-option="${v.name}">`;
        values.forEach(val => {
          const cleanVal = (val.value || '').trim();
          const outOfStock = val.stock !== undefined && val.stock !== '' && parseInt(val.stock) === 0;
          variantsHTML += `<div class="option-pill ${outOfStock ? 'out-of-stock' : ''}"
            onclick="${outOfStock ? '' : `StoreInit._selectDetailPill(this, '${v.name.replace(/'/g, "\\'")}')`}"
            data-value="${cleanVal}" data-product-id="${productId}"
            style="${outOfStock ? 'opacity:0.4;cursor:not-allowed;' : 'cursor:pointer;'}">${cleanVal}${outOfStock ? ' ✕' : ''}</div>`;
        });
        variantsHTML += `</div><div class="option-error-msg" style="color:#ef4444;font-size:11px;font-weight:700;margin-top:5px;display:none;">يرجى اختيار ${v.name}</div></div>`;
      });
    }

    const desc = product.description ? `<div style="margin-top:20px;padding:20px;background:#fff;border-radius:16px;border:1px solid var(--gray-200);"><h3 style="margin:0 0 10px;font-size:16px;">وصف المنتج</h3><p style="line-height:1.9;color:var(--gray-600);font-size:15px;white-space:pre-wrap;margin:0;">${product.description}</p></div>` : '';

    page.innerHTML = `
      <div style="max-width:900px;margin:0 auto;padding:20px;">
        <button onclick="StoreInit._hideProductPage()" style="display:inline-flex;align-items:center;gap:8px;background:var(--gray-100);border:none;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer;margin-bottom:18px;font-family:inherit;">
          <i class="fa fa-arrow-right"></i> العودة للمتجر
        </button>
        <div style="display:flex;gap:25px;flex-wrap:wrap;background:#fff;border-radius:20px;padding:25px;box-shadow:var(--shadow-md);border:1px solid var(--gray-200);">
          <div style="flex:1;min-width:260px;">
            <img id="detailMainImage" src="${mainImg}" style="width:100%;max-width:360px;border-radius:18px;object-fit:cover;background:var(--gray-100);display:block;margin:0 auto;">
            ${galleryThumbs ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;justify-content:center;">${galleryThumbs}</div>` : ''}
          </div>
          <div style="flex:1;min-width:260px;display:flex;flex-direction:column;justify-content:center;">
            <h1 style="margin:0;font-size:26px;font-weight:900;">${product.name}</h1>
            <div style="margin-top:14px;font-size:26px;font-weight:900;color:var(--primary);">
              ${hasSale ? `<span style="text-decoration:line-through;color:var(--gray-400);font-size:18px;margin-left:10px;">${currency}${product.salePrice}</span>` : ''}
              ${currency}${product.price}
            </div>
            ${variantsHTML}
            <div style="display:flex;align-items:center;gap:12px;margin-top:24px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
                <button onclick="StoreInit._changeDetailQty(-1)" style="width:44px;height:44px;border:none;background:var(--gray-100);font-size:20px;cursor:pointer;">−</button>
                <span id="detailQty" style="width:54px;text-align:center;font-weight:800;font-size:16px;">1</span>
                <button onclick="StoreInit._changeDetailQty(1)" style="width:44px;height:44px;border:none;background:var(--gray-100);font-size:20px;cursor:pointer;">+</button>
              </div>
              <button onclick="StoreInit._submitProductDetail('${productId}')" style="flex:1;min-width:180px;padding:14px 24px;background:var(--primary);color:white;border:none;border-radius:12px;font-weight:800;font-size:17px;cursor:pointer;">أضف للسلة</button>
            </div>
          </div>
        </div>
        ${desc}
      </div>`;

    this._detailSelections = {};
    this._showProductPage();
  },

  _showProductPage() {
    const page = document.getElementById('productPage');
    const store = document.getElementById('publicMarketingContent');
    const dash = document.getElementById('distDashboardSection');
    const main = document.querySelector('.main-container');
    const footer = document.querySelector('.main-footer');
    if (page) page.style.display = 'block';
    if (store) store.style.display = 'none';
    if (dash) dash.style.display = 'none';
    if (main) main.style.display = 'none';
    if (footer) footer.style.display = 'none';
    window.scrollTo(0, 0);
  },

  _hideProductPage() {
    const page = document.getElementById('productPage');
    const store = document.getElementById('publicMarketingContent');
    const main = document.querySelector('.main-container');
    const footer = document.querySelector('.main-footer');
    if (page) page.style.display = 'none';
    if (store) store.style.display = 'block';
    if (main) main.style.display = '';
    if (footer) footer.style.display = '';
    if (window.location.hash && window.location.hash.indexOf('product=') !== -1) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo(0, 0);
  },

  // Go to the public store (used by logo / home navigation)
  _goHome() {
    const dash = document.getElementById('distDashboardSection');
    const dashVisible = dash && dash.style.display === 'block';
    // If the distributor/admin dashboard is open, return to the public store
    if (dashVisible) {
      if (window.togglePublicStore) window.togglePublicStore(true);
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    this._hideProductPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  _setDetailImage(src) {
    const el = document.getElementById('detailMainImage');
    if (el) el.src = src;
    const page = document.getElementById('productPage');
    if (page) page.querySelectorAll('img').forEach(img => {
      if (img.style) img.style.borderColor = (img.getAttribute('src') === src) ? 'var(--primary)' : 'transparent';
    });
  },

  _changeDetailQty(delta) {
    const el = document.getElementById('detailQty');
    if (!el) return;
    let q = parseInt(el.textContent) || 1;
    q = Math.max(1, q + delta);
    el.textContent = q;
  },

  _selectDetailPill(el, optionName) {
    const container = el.closest('.option-pills');
    if (!container) return;
    container.querySelectorAll('.option-pill').forEach(pill => pill.classList.remove('selected'));
    el.classList.add('selected');
    const productId = el.dataset.productId;
    if (!this._detailSelections[productId]) this._detailSelections[productId] = {};
    this._detailSelections[productId][optionName] = el.dataset.value;
  },

  _submitProductDetail(productId) {
    const product = this.products.find(p => String(p.id) === String(productId));
    if (!product) return;

    const selections = this._detailSelections[productId] || {};
    const requiredOptions = (product.variants || []).map(v => v.name);
    let allSelected = true;
    requiredOptions.forEach(optName => {
      if (!selections[optName]) {
        const errEl = document.querySelector(`#detail-option-${optName.replace(/\s+/g, '-')} .option-error-msg`);
        if (errEl) errEl.style.display = 'block';
        allSelected = false;
      }
    });
    if (!allSelected) return;

    const optionString = requiredOptions.map(optName => ` (${selections[optName]})`).join('');

    let variantImage = '';
    if (product.variants) {
      for (const v of product.variants) {
        const selectedVal = (v.values || []).find(val => val.value === selections[v.name]);
        if (selectedVal && selectedVal.image) { variantImage = selectedVal.image; break; }
      }
    }

    const qtyEl = document.getElementById('detailQty');
    const qty = qtyEl ? (parseInt(qtyEl.textContent) || 1) : 1;

    const item = {
      id: productId,
      name: product.name + optionString,
      price: parseFloat(product.price),
      image: variantImage || product.image || '',
      quantity: qty
    };

    if (window.cart) {
      for (let i = 0; i < qty; i++) window.cart.addItem(item);
      this._hideProductPage();
      this._detailSelections = {};
    }
  },

  _detailSelections: {},

  // ── Settings Helpers ────────────────────────────────────────────────────────

  _parseSearchPlaceholders() {
    const raw = this.settings.searchPlaceholders;
    if (!raw) return ['ابحث عن ما تحب...'];
    if (typeof raw === 'string') {
      return raw.split(',').map(s => s.trim()).filter(s => s);
    }
    return raw;
  },

  // ── Announcement Bar ────────────────────────────────────────────────────────

  _renderAnnouncement() {
    const el = document.querySelector('.top-bar-announcement');
    if (el) {
      el.textContent = this.settings.announcementText || '🌟 أفضل المنتجات بأفضل الأسعار | توصيل سريع لباب المنزل';
    }
  },

  // ── Logo ────────────────────────────────────────────────────────────────────

  _renderLogo() {
    const storeName = this.settings.storeName || 'متجري';
    const logo = this.settings.storeLogo;
    const logoHTML = logo
      ? `<img src="${logo}" alt="${storeName}" style="max-height:40px;max-width:100%;object-fit:contain;">`
      : `<i class="fa fa-gem"></i> ${storeName}`;

    const headerLogo = document.querySelector('a.logo');
    if (headerLogo) headerLogo.innerHTML = logoHTML;

    const footerLogo = document.querySelector('.footer-logo');
    if (footerLogo) {
      footerLogo.innerHTML = logo
        ? `<img src="${logo}" alt="${storeName}" style="max-height:50px;max-width:100%;object-fit:contain;">`
        : `<i class="fa fa-gem"></i> ${storeName}`;
    }
  },

  // ── Social Links ────────────────────────────────────────────────────────────

  _renderSocialLinks() {
    const container = document.querySelector('.footer-logo + div');
    if (!container) return;

    let html = '';
    if (this.settings.instagramUrl) html += `<a href="${this.settings.instagramUrl}" target="_blank"><i class="fab fa-instagram"></i></a>`;
    if (this.settings.facebookUrl) html += `<a href="${this.settings.facebookUrl}" target="_blank"><i class="fab fa-facebook"></i></a>`;
    if (this.settings.snapchatUrl) html += `<a href="${this.settings.snapchatUrl}" target="_blank"><i class="fab fa-snapchat"></i></a>`;
    if (this.settings.whatsappUrl) html += `<a href="https://wa.me/${this.settings.whatsappUrl}" target="_blank"><i class="fab fa-whatsapp"></i></a>`;

    const socialsDiv = container.querySelector('.socials') || container;
    if (html) {
      socialsDiv.innerHTML = `<div class="socials">${html}</div>`;
    }
  },

  // ── Footer ──────────────────────────────────────────────────────────────────

  _renderFooter() {
    const copyrightEl = document.querySelector('.main-footer div div:last-child');
    if (copyrightEl) {
      copyrightEl.innerHTML = `جميع الحقوق محفوظة &copy; ${this.settings.storeName || 'متجري'}`;
    }
  },

  // ── Tracking Scripts ────────────────────────────────────────────────────────

  _renderTrackingScripts() {
    const s = this.settings;
    let html = '';

    // Facebook Pixel
    if (s.fbPixel) {
      html += `<script>
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${s.fbPixel}');fbq('track','PageView');
      </script>
      <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${s.fbPixel}&ev=PageView&noscript=1"/></noscript>`;
    }

    // TikTok Pixel
    if (s.tiktokPixel) {
      html += `<script>
        !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","trackSelf","untrackSelf"],ttq.setAndLog=function(t,e){return function(){for(var n=[],r=arguments.length;r--;)n[r]=arguments[r];n.push(e),ttq.enqueue(t,n)}};for(var i=0;i<ttq.methods.length;i++)ttq[i]=ttq.setAndLog(ttq[i],i);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq[n]=ttq.setAndLog(ttq[n],n);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${s.tiktokPixel}');ttq.page();}(window,document,'ttq');
      </script>`;
    }

    // Snapchat Pixel
    if (s.snapPixel) {
      html += `<script>
        (function(win,doc,sdk){if(win.snaptr)return;var tr=win.snaptr=function(){tr.handleRequest?tr.handleRequest.apply(tr,arguments):tr.queue.push(arguments)};tr.queue=[];var s=doc.createElement(sdk);s.async=!0;s.src='https://sc-static.net/scevent.min.js';var p=doc.getElementsByTagName(sdk)[0];p.parentNode.insertBefore(s,p)}(window,document,'script'));
        snaptr('init','${s.snapPixel}');snaptr('track','PAGE_VIEW');
      </script>`;
    }

    // Google Tag Manager
    if (s.gtm) {
      html += `<script async src="https://www.googletagmanager.com/gtag/js?id=${s.gtm}"></script>
      <script>
        window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
        gtag('js',new Date());gtag('config','${s.gtm}');
      </script>`;
    }

    // Common tracking helper
    const currency = s.currency || 'ILS';
    html += `<script>
      window.trackStoreEvent = function(eventName, data) {
        if (typeof fbq === 'function') {
          if (eventName === 'Purchase') fbq('track', 'Purchase', { value: data.total, currency: '${currency}' });
          else if (eventName === 'AddToCart') fbq('track', 'AddToCart', { content_name: data.name, value: data.price, currency: '${currency}' });
          else if (eventName === 'ViewContent') fbq('track', 'ViewContent', { content_name: data.name, value: data.price, currency: '${currency}' });
        }
        if (typeof ttq === 'function') {
          if (eventName === 'Purchase') ttq.track('CompletePayment', { value: data.total, currency: '${currency}' });
          else if (eventName === 'AddToCart') ttq.track('AddToCart', { content_name: data.name, value: data.price, currency: '${currency}' });
        }
        if (typeof snaptr === 'function') {
          if (eventName === 'Purchase') snaptr('track', 'PURCHASE', { price: data.total, currency: '${currency}' });
          else if (eventName === 'AddToCart') snaptr('track', 'ADD_CART', { item_name: data.name, price: data.price, currency: '${currency}' });
        }
        if (typeof gtag === 'function') gtag('event', eventName, data);
      };
    </script>`;

    // Append to head
    const container = document.createElement('div');
    container.innerHTML = html;
    document.head.appendChild(container);
  },

  // ── PWA Banner ──────────────────────────────────────────────────────────────

  _renderPwaBanner() {
    if (this.settings.showPwaBanner === 'false') return;
    const container = document.getElementById('publicMarketingContent');
    if (!container) return;

    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.style.cssText = 'display:none;align-items:center;justify-content:space-between;gap:15px;background:var(--white);border:1px solid var(--gray-200);border-radius:14px;padding:14px 20px;margin-bottom:12px;box-shadow:var(--shadow-md);flex-wrap:wrap;';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;background:var(--primary);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fa fa-store" style="color:#fff;font-size:20px;"></i>
        </div>
        <div>
          <div style="font-weight:800;font-size:14px;">ثبّت التطبيق على جهازك</div>
          <div style="font-size:12px;color:var(--gray-600);">تجربة أسرع وأسهل في كل مرة!</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button id="pwaInstallBtn" onclick="installPWA()" style="background:var(--primary);color:#fff;border:none;padding:9px 18px;border-radius:9px;font-weight:700;cursor:pointer;font-size:13px;font-family:inherit;"><i class="fa fa-download" style="margin-left:6px;"></i>تثبيت</button>
        <button onclick="this.parentElement.parentElement.style.display='none'" style="background:var(--gray-100);color:var(--gray-600);border:none;padding:9px 12px;border-radius:9px;cursor:pointer;font-size:13px;"><i class="fa fa-xmark"></i></button>
      </div>`;
    container.insertBefore(banner, container.firstChild);
  },

  // ── WhatsApp Bubble ─────────────────────────────────────────────────────────

  _installPWA() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        this.deferredPrompt = null;
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
      });
    }
  },

  // ── WhatsApp Bubble ─────────────────────────────────────────────────────────
  _renderWhatsAppBubble() {
    if (this.settings.showWhatsappBubble === 'false' || !this.settings.whatsappUrl) return;
    const bubble = document.createElement('a');
    bubble.href = `https://wa.me/${this.settings.whatsappUrl}`;
    bubble.target = '_blank';
    bubble.className = 'whatsapp-bubble';
    bubble.title = 'تواصل معنا عبر واتساب';
    bubble.innerHTML = '<i class="fab fa-whatsapp"></i>';
    document.body.appendChild(bubble);
  },

  // ── Pages Links (footer) ────────────────────────────────────────────────────

  async _renderPagesLinks() {
    try {
      const { data: pages } = await DB.supabase.from('pages').select('title, slug').eq('status', 'public');
      this.pages = pages || [];
    } catch (e) {
      this.pages = [];
    }
  },

  // ── Welcome Popup ───────────────────────────────────────────────────────────

  _renderWelcomePopup() {
    if (this.settings.popupEnabled !== true && this.settings.popupEnabled !== 'true') return;

    let popups = this.settings.popups || [];
    if (typeof popups === 'string') {
      try { popups = JSON.parse(popups); } catch (e) { popups = []; }
    }

    const activePopups = popups.filter(p => p.active !== false);
    if (activePopups.length === 0) return;

    const pData = activePopups[Math.floor(Math.random() * activePopups.length)];
    const pId = pData.id || 'popup_' + Math.random().toString(36).substr(2, 9);

    let pLink = pData.link || '';
    if (pLink && !pLink.startsWith('http') && !pLink.startsWith('/?')) {
      if (pLink.startsWith('/')) pLink = '/?' + pLink.substring(1);
      else pLink = '/?' + pLink;
    }

    let themeStyles = '';
    if (pData.theme === 'dark') themeStyles = 'background:#1e293b;color:#fff;';
    else if (pData.theme === 'glass') themeStyles = 'background:rgba(255,255,255,0.7);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.2);color:#1e293b;';
    else if (pData.theme === 'minimal') themeStyles = 'background:#fff;color:#000;border-radius:12px;';
    else themeStyles = 'background:#fff;color:#1e293b;';

    const repeat = pData.repeat || 'always';
    if (repeat === 'once_session' && sessionStorage.getItem('popup_shown_' + pId)) return;
    if (repeat === 'once_forever' && localStorage.getItem('popup_shown_' + pId)) return;
    if (repeat === 'once_day') {
      const last = localStorage.getItem('popup_shown_' + pId);
      if (last && (Date.now() - parseInt(last)) < 24 * 60 * 60 * 1000) return;
    }

    const html = `
      <div id="welcomePopup" class="modal" style="display:none;align-items:center;justify-content:center;z-index:10000;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);">
        <div class="modal-content popup-anim-${pData.animation || 'popIn'}" style="max-width:450px;border-radius:30px;overflow:hidden;border:none;position:relative;${themeStyles}box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <button onclick="StoreInit._closeWelcomePopup('${pId}','${repeat}')" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.9);border:none;color:#000;width:35px;height:35px;border-radius:50%;cursor:pointer;z-index:110;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold;box-shadow:0 4px 10px rgba(0,0,0,0.3);">&times;</button>
          ${pData.image ? `<div style="width:100%;aspect-ratio:1.2;background:#f1f5f9;position:relative;overflow:hidden;">
            <img src="${pData.image}" style="width:100%;height:100%;object-fit:cover;">
            ${pData.type === 'image' && pLink ? `<a href="${pLink}" onclick="StoreInit._closeWelcomePopup('${pId}','${repeat}')" style="position:absolute;inset:0;z-index:5;"></a>` : ''}
          </div>` : ''}
          ${pData.type !== 'image' ? `<div style="padding:30px;text-align:center;">
            <h3 style="font-size:24px;font-weight:900;margin-bottom:12px;font-family:'Tajawal',sans-serif;">${pData.title || ''}</h3>
            <p style="opacity:0.8;font-size:15px;line-height:1.6;margin-bottom:20px;">${pData.desc || ''}</p>
            ${pData.coupon ? `<div style="background:rgba(var(--primary-rgb,250,0,0),0.1);border:2px dashed var(--primary);padding:15px;border-radius:15px;margin-bottom:25px;cursor:pointer;" onclick="navigator.clipboard.writeText('${pData.coupon}');this.querySelector('span').style.display='flex';setTimeout(()=>this.querySelector('span').style.display='none',2000);">
              <div style="font-size:11px;font-weight:800;color:var(--primary);margin-bottom:5px;">كود الخصم (اضغط للنسخ)</div>
              <div style="font-size:22px;font-weight:900;letter-spacing:2px;">${pData.coupon}</div>
              <span style="display:none;position:absolute;inset:0;background:var(--primary);color:white;align-items:center;justify-content:center;font-weight:800;border-radius:15px;">تم النسخ بنجاح! ✓</span>
            </div>` : ''}
            <div style="display:flex;gap:12px;">
              ${pLink ? `<a href="${pLink}" onclick="StoreInit._closeWelcomePopup('${pId}','${repeat}')" class="btn-primary" style="flex:1;padding:15px;border-radius:15px;text-decoration:none;font-weight:800;font-size:16px;background:var(--primary);color:white;">اكتشف العرض الآن</a>` : `<button onclick="StoreInit._closeWelcomePopup('${pId}','${repeat}')" class="btn-primary" style="flex:1;padding:15px;border-radius:15px;border:none;font-weight:800;font-size:16px;background:var(--primary);color:white;cursor:pointer;">ابدأ التسوق</button>`}
            </div>
          </div>` : ''}
        </div>
      </div>
      <style>
        .popup-anim-popIn{animation:popIn .5s cubic-bezier(.175,.885,.32,1.275) forwards}
        .popup-anim-slideUp{animation:slideUp .5s ease-out forwards}
        .popup-anim-zoomIn{animation:zoomIn .4s ease-out forwards}
        @keyframes popIn{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes slideUp{0%{transform:translateY(100px);opacity:0}100%{transform:translateY(0);opacity:1}}
        @keyframes zoomIn{0%{transform:scale(1.5);opacity:0}100%{transform:scale(1);opacity:1}}
      </style>`;

    document.body.insertAdjacentHTML('beforeend', html);

    const showOn = pData.showOn || 'load';
    const delay = (pData.delay || 2) * 1000;

    setTimeout(() => {
      const el = document.getElementById('welcomePopup');
      if (!el) return;

      if (showOn === 'load') {
        el.style.display = 'flex';
      } else if (showOn === 'exit') {
        document.addEventListener('mouseleave', (e) => {
          if (e.clientY < 0 && !sessionStorage.getItem('exit_intent_triggered')) {
            el.style.display = 'flex';
            sessionStorage.setItem('exit_intent_triggered', 'true');
          }
        });
      } else if (showOn === 'scroll') {
        const handler = () => {
          const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
          if (pct > 50) { el.style.display = 'flex'; window.removeEventListener('scroll', handler); }
        };
        window.addEventListener('scroll', handler);
      }
    }, delay);
  },

  _closeWelcomePopup(pId, repeat) {
    const p = document.getElementById('welcomePopup');
    if (p) p.style.display = 'none';
    if (repeat === 'once_session') sessionStorage.setItem('popup_shown_' + pId, 'true');
    else if (repeat === 'once_day') localStorage.setItem('popup_shown_' + pId, Date.now());
    else if (repeat === 'once_forever') localStorage.setItem('popup_shown_' + pId, 'forever');
  },

  // ── Categories ──────────────────────────────────────────────────────────────

  async _loadCategories() {
    const { data } = await DB.supabase.from('categories').select('*');
    this.categories = (data || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      image: c.image || '',
      icon: c.icon || '',
      parentId: c.parent_id || null,
      isBrand: c.is_brand || false
    }));
  },

  _buildCatsHTML(filterBrands = false, forModal = false) {
    const enhanced = this.categories.map(c => {
      let isBrandTree = c.isBrand === true;
      if (!isBrandTree && c.parentId) {
        const parent = this.categories.find(p => p.id === c.parentId);
        if (parent && parent.isBrand === true) isBrandTree = true;
      }
      return { ...c, isBrandTree };
    });

    const filtered = filterBrands
      ? enhanced.filter(c => c.isBrandTree === true)
      : enhanced.filter(c => c.isBrandTree !== true);

    const parents = filtered.filter(c => !c.parentId || !filtered.some(x => x.id === c.parentId));
    let html = '';

    parents.forEach(p => {
      const subs = filtered.filter(c => c.parentId === p.id);
      const img = p.icon || p.image
        ? `<img src="${p.icon || p.image}" style="width:${forModal ? 42 : 24}px;height:${forModal ? 42 : 24}px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
        : (forModal ? '<span style="font-size:24px;">🏷️</span>' : '');

      if (forModal) {
        // Flat brand items for modal grid
        html += `<a href="#?cat=${p.id}" onclick="StoreInit._filterByCategory('${p.id}');closeModal('categoriesModal')" class="brand-modal-item">
          ${img || '<span style="font-size:24px;">🏷️</span>'}
          <span>${p.name}</span>
        </a>`;
      } else {
        // Sidebar category with subcategory popup
        html += `<div class="cat-group">
          <a href="#?cat=${p.id}" onclick="StoreInit._filterByCategory('${p.id}')" class="cat-item" style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px;padding:10px 12px;border-radius:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${img}
              <span style="font-size:15px;font-weight:700;">${p.name}</span>
            </div>
            ${subs.length > 0 ? '<i class="fa fa-chevron-left cat-chevron" style="font-size:12px;"></i>' : ''}
          </a>`;

        if (subs.length > 0) {
          html += `<div class="subcat-wrapper"><div class="subcat-sidebar-list">`;
          subs.forEach(sc => {
            const subImg = sc.icon || sc.image
              ? `<img src="${sc.icon || sc.image}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
              : '';
            html += `<a href="#?cat=${sc.id}" onclick="StoreInit._filterByCategory('${sc.id}')" class="cat-item" style="font-size:13px;padding:8px 12px;display:flex;align-items:center;width:100%;gap:10px;font-weight:600;">
              ${subImg}
              <span>${sc.name}</span>
            </a>`;
          });
          html += `</div></div>`;
        }
        html += `</div>`;
      }
    });

    return html;
  },

  _renderSidebar() {
    if (this.settings.showSidebarFilter === 'false') return;

    const sidebarEl = document.querySelector('.main-container');
    if (!sidebarEl) return;

    const normalCats = this._buildCatsHTML(false);
    const brandsCats = this._buildCatsHTML(true);
    const brandsTitle = this.settings.brandsTitle || 'العلامات التجارية';

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-card">
        <h3 class="sidebar-title"><i class="fa fa-list-ul"></i> تصفح الأقسام</h3>
        <div class="cat-list">
          <a href="#?cat=all" onclick="StoreInit._filterByCategory('all')" class="cat-item">الكل <i class="fa fa-chevron-left"></i></a>
          ${normalCats}
        </div>
      </div>
      ${brandsCats ? `<div class="sidebar-card" style="margin-top:20px;">
        <h3 class="sidebar-title"><i class="fa fa-award"></i> ${brandsTitle}</h3>
        <div class="cat-list">${brandsCats}</div>
      </div>` : ''}
      <div class="sidebar-card" style="background:var(--primary);color:var(--white);border:none;margin-top:20px;">
        <h3 style="margin-bottom:10px;">انضم لقائمتنا البريدية</h3>
        <p style="font-size:13px;margin-bottom:15px;opacity:0.9;">احصل على خصم 10% على طلبك الأول عند الاشتراك!</p>
        <input type="email" placeholder="بريدك الإلكتروني" style="width:100%;padding:10px;border-radius:8px;border:none;margin-bottom:10px;">
        <button style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--dark);color:var(--white);font-weight:bold;cursor:pointer;">اشترك الآن</button>
      </div>
      <div class="sidebar-card">
        <div style="display:flex;gap:15px;align-items:center;margin-bottom:15px;">
          <i class="fa fa-shield-check" style="font-size:30px;color:var(--primary);"></i>
          <div><div style="font-weight:800;">تسوق آمن</div><div style="font-size:12px;color:var(--gray-600);">بياناتك مشفرة ومحمية</div></div>
        </div>
        <div style="display:flex;gap:15px;align-items:center;">
          <i class="fa fa-headset" style="font-size:30px;color:var(--primary);"></i>
          <div><div style="font-weight:800;">دعم 24/7</div><div style="font-size:12px;color:var(--gray-600);">نحن هنا لمساعدتك دائماً</div></div>
        </div>
      </div>`;

    sidebarEl.insertBefore(sidebar, sidebarEl.querySelector('main'));
  },

  async _renderCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    if (!modal) return;

    const normalCats = this._buildCatsHTML(false, false);
    const catsList = modal.querySelector('.cats-mobile-list');
    if (catsList) catsList.innerHTML = normalCats;

    // Pages links
    await this._loadPages();
    const pagesList = modal.querySelector('.cats-pages-list');
    if (pagesList) {
      let pagesHTML = '';
      this.pages.forEach(p => {
        pagesHTML += `<a href="#?page=${p.slug}" onclick="closeModal('categoriesModal')">${p.title}</a>`;
      });
      pagesList.innerHTML = pagesHTML;
    }
  },

  _renderBrandsModal() {
    const modal = document.getElementById('categoriesModal');
    if (!modal) return;

    const brandsGrid = modal.querySelector('.cats-brands-grid');
    if (brandsGrid) {
      brandsGrid.innerHTML = this._buildCatsHTML(true, true);
    }
  },

  async _loadPages() {
    const { data } = await DB.supabase.from('pages').select('*').eq('status', 'public');
    this.pages = data || [];
  },

  // ── Cities Options ──────────────────────────────────────────────────────────

  _renderCitiesOptions() {
    let cities = this.settings.cities || [];
    if (typeof cities === 'string') {
      try { cities = JSON.parse(cities); } catch (e) { cities = []; }
    }

    const citiesNames = this.settings.city_names || [];
    const citiesPrices = this.settings.city_prices || [];

    if (cities.length === 0 && citiesNames.length > 0) {
      cities = citiesNames.map((name, i) => ({
        name,
        price: parseInt(citiesPrices[i]) || 0
      }));
    }

    let html = '<option value="" disabled selected>اختر المدينة...</option>';
    cities.forEach(c => {
      html += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`;
    });

    const select = document.getElementById('distRegCity');
    if (select) select.innerHTML = html;
  },

  // ── Hero Section ────────────────────────────────────────────────────────────

  _renderHeroSection() {
    const heroType = this.settings.heroType || (this.settings.showSlider === 'false' ? 'none' : 'slider');
    const container = document.getElementById('publicMarketingContent');
    if (!container) return;

    let heroHTML = '';

    if (heroType === 'slider') {
      let slides = [];
      const raw = this.settings.slider_json;
      if (raw) {
        try { slides = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { slides = []; }
      }
      if (!Array.isArray(slides) || slides.length === 0) {
        slides = [
          { image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2070&auto=format&fit=crop', title: 'مجموعات فريدة وحصرية', desc: 'اكتشف عالم الفخامة مع تشكيلتنا الجديدة من المجوهرات الراقية' },
          { image: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?q=80&w=2070&auto=format&fit=crop', title: 'أناقة لا تنتهي', desc: 'قطع فنية مصممة لتبرز جمالك في كل مناسبة' }
        ];
      }

      const isSingle = slides.length === 1;
      const slidesHTML = slides.map((slide, index) => {
        const isVideo = slide.image && (slide.image.match(/\.(mp4|webm|ogg|mov)$/i) || slide.image.includes('youtube.com') || slide.image.includes('youtu.be'));
        let mediaHtml = '';
        if (isVideo) {
          if (slide.image.includes('youtube.com') || slide.image.includes('youtu.be')) {
            let embedUrl = slide.image;
            if (slide.image.includes('watch?v=')) embedUrl = slide.image.replace('watch?v=', 'embed/');
            else if (slide.image.includes('youtu.be/')) embedUrl = slide.image.replace('youtu.be/', 'youtube.com/embed/');
            mediaHtml = `<iframe src="${embedUrl}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
          } else {
            mediaHtml = `<video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;"><source src="${slide.image}" type="video/mp4"></video>`;
          }
        } else {
          mediaHtml = `<img src="${slide.image}" alt="Slide ${index + 1}">`;
        }

        const innerSlide = `${mediaHtml}${(slide.title || slide.desc) ? `<div class="hero-content"><${isSingle ? 'h2' : 'h1'}>${slide.title || ''}</${isSingle ? 'h2' : 'h1'}>${slide.desc ? `<p>${slide.desc}</p>` : ''}</div>` : ''}`;

        return slide.link
          ? `<a href="${slide.link}" class="slide ${index === 0 ? 'active' : ''}" style="display:block;text-decoration:none;">${innerSlide}</a>`
          : `<div class="slide ${index === 0 ? 'active' : ''}">${innerSlide}</div>`;
      }).join('');

      const dotsHTML = isSingle ? '' : slides.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i}, this)"></span>`).join('');

      heroHTML = `<div class="hero-slider" id="heroSlider" data-current="0">
        <div class="slider-container">${slidesHTML}</div>
        ${dotsHTML ? `<div class="slider-dots">${dotsHTML}</div>` : ''}
        ${!isSingle ? '<button class="slider-arrow prev" onclick="prevSlide(this)"><i class="fa fa-chevron-right"></i></button><button class="slider-arrow next" onclick="nextSlide(this)"><i class="fa fa-chevron-left"></i></button>' : ''}
      </div>`;

    } else if (heroType === 'banner') {
      const img = this.settings.bannerImage || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2070&auto=format&fit=crop';
      const title = this.settings.bannerTitle || '';
      const desc = this.settings.bannerDesc || '';
      const link = this.settings.bannerLink || '';
      const inner = `<div class="hero-banner" id="heroBanner">
        <img src="${img}" alt="Banner">
        ${(title || desc) ? `<div class="hero-content" style="opacity:1;transform:none;"><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div>` : ''}
      </div>`;
      heroHTML = link ? `<a href="${link}" style="display:block;text-decoration:none;">${inner}</a>` : inner;

    } else if (heroType === 'video') {
      const videoUrl = this.settings.videoUrl || '';
      const title = this.settings.videoTitle || '';
      const desc = this.settings.videoDesc || '';
      if (videoUrl) {
        heroHTML = `<div class="hero-video" id="heroVideo">
          <video autoplay muted loop playsinline><source src="${videoUrl}" type="video/mp4"></video>
          <div class="hero-video-overlay"></div>
          ${(title || desc) ? `<div class="hero-content" style="opacity:1;transform:none;"><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div>` : ''}
        </div>`;
      }
    }

    // Insert hero before products container
    const quickActions = container.querySelector('.content-quick-actions');
    if (heroHTML) {
      const heroDiv = document.createElement('div');
      heroDiv.innerHTML = heroHTML;
      if (quickActions) {
        quickActions.insertAdjacentElement('afterend', heroDiv);
      } else {
        container.insertBefore(heroDiv, container.firstChild);
      }
    }
  },

  // ── Products Grid ───────────────────────────────────────────────────────────

  async _loadProducts() {
    const { data } = await DB.supabase.from('products').select('*');
    this.products = (data || []).map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      salePrice: p.sale_price,
      wholesalePrice: p.wholesale_price,
      image: p.image || '',
      images: p.images || [],
      description: p.description || '',
      categories: p.categories || [],
      variants: p.variants || [],
      advanced: p.advanced || {}
    }));
  },

  _renderProductsGrid() {
    const container = document.getElementById('publicMarketingContent');
    if (!container) return;

    const currency = this.settings.currency || '₪';
    const visibleProducts = this.products.filter(p => {
      if (p.advanced && p.advanced.hiddenProduct) return false;
      return true;
    });

    const productsHTML = visibleProducts.map(p => {
      const isComingSoon = p.advanced && p.advanced.isComingSoon;
      const hasSale = p.salePrice && parseFloat(p.salePrice) > 0;
      const hasVariants = p.variants && p.variants.length > 0;

      return `
        <div class="product-card" data-product-id="${p.id}">
          <a href="#?product=${p.id}" style="text-decoration:none; color:inherit;">
            <div class="product-img">
              ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : '<div style="width:100%;height:200px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><i class="fa fa-image" style="font-size:40px;color:var(--gray-400);"></i></div>'}
              ${hasSale ? `<div class="sale-badge">خصم</div>` : ''}
              ${isComingSoon ? '<div class="coming-badge">قريباً</div>' : ''}
            </div>
          </a>
          <div class="product-info">
            <a href="#?product=${p.id}" style="text-decoration:none;color:inherit;">
              <h3 class="product-name">${p.name}</h3>
            </a>
            <div class="product-price">
              ${hasSale ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}
              <span class="current-price">${currency}${p.price}</span>
            </div>
            ${hasVariants ? `<button onclick="StoreInit._showQuickAdd('${p.id}')" class="quick-add-btn" style="width:100%;padding:10px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;margin-top:8px;">اختر الخيارات</button>` : `<button onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${Number(p.price) || 0}, '${(p.image || '').replace(/'/g, "\\'")}')" class="quick-add-btn" style="width:100%;padding:10px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;margin-top:8px;">أضف للسلة</button>`}
          </div>
        </div>`;
    }).join('');

    const gridContainer = container.querySelector('.product-grid') || document.createElement('div');
    gridContainer.className = 'product-grid';
    gridContainer.id = 'storeProductsGrid';
    gridContainer.innerHTML = productsHTML || '<p style="text-align:center;color:var(--gray-400);padding:40px;">لا توجد منتجات حالياً</p>';

    if (!container.querySelector('.product-grid')) {
      container.appendChild(gridContainer);
    }
    if (window.applyDistributorPricing) window.applyDistributorPricing();
  },

  // ── Category Filtering ──────────────────────────────────────────────────────

  _filterByCategory(catId) {
    if (catId === 'all') {
      this._renderHomeSections();
      this._highlightActiveCategory('all');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const visibleProducts = this.products.filter(p => {
      if (p.advanced && p.advanced.hiddenProduct) return false;
      const cats = p.categories || [];
      return cats.includes(catId);
    });

    // Hide home sections wrapper when filtering a specific category
    const homeWrap = document.getElementById('homeSectionsWrap');
    if (homeWrap) homeWrap.style.display = 'none';

    // Ensure the grid exists inside the marketing content
    const content = document.getElementById('publicMarketingContent');
    let grid = document.getElementById('storeProductsGrid');
    if (!grid && content) {
      grid = document.createElement('div');
      grid.className = 'product-grid';
      grid.id = 'storeProductsGrid';
      content.appendChild(grid);
    }
    if (!grid) {
      this._renderProductsGrid();
      return;
    }
    grid.style.display = 'grid';

    const currency = this.settings.currency || '₪';
    const productsHTML = visibleProducts.map(p => this._productCardHTML(p)).join('');

    grid.innerHTML = productsHTML || '<p style="text-align:center;color:var(--gray-400);padding:40px;">لا توجد منتجات في هذا القسم</p>';
    this._highlightActiveCategory(catId);
    if (window.applyDistributorPricing) window.applyDistributorPricing();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  _highlightActiveCategory(catId) {
    document.querySelectorAll('.cat-item, .brand-modal-item').forEach(el => {
      const href = el.getAttribute('href') || '';
      const isActive = href === `#?cat=${catId}` || (catId === 'all' && href === '#?cat=all');
      el.style.background = isActive ? 'var(--primary-light)' : '';
      el.style.color = isActive ? 'var(--primary)' : '';
      el.style.fontWeight = isActive ? '800' : '';
    });
  },

  // ── Home Sections Rendering ──────────────────────────────────────────────────
  _isComingSoon(p) {
    return p.advanced && p.advanced.isComingSoon && (!p.advanced.comingSoonDate || new Date(p.advanced.comingSoonDate) > new Date());
  },

  _productCardHTML(p) {
    const currency = this.settings.currency || '₪';
    const isComingSoon = p.advanced && p.advanced.isComingSoon;
    const hasSale = p.salePrice && parseFloat(p.salePrice) > 0;
    const hasVariants = p.variants && p.variants.length > 0;
    return `
      <div class="product-card" data-product-id="${p.id}">
        <a href="#?product=${p.id}" style="text-decoration:none;color:inherit;">
          <div class="product-img">
            ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : '<div style="width:100%;height:200px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><i class="fa fa-image" style="font-size:40px;color:var(--gray-400);"></i></div>'}
            ${hasSale ? '<div class="sale-badge">خصم</div>' : ''}
            ${isComingSoon ? '<div class="coming-badge">قريباً</div>' : ''}
          </div>
        </a>
        <div class="product-info">
          <a href="#?product=${p.id}" style="text-decoration:none;color:inherit;">
            <h3 class="product-name">${p.name}</h3>
          </a>
          <div class="product-price">
            ${hasSale ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}
            <span class="current-price">${currency}${p.price}</span>
          </div>
          ${hasVariants ? `<button onclick="StoreInit._showQuickAdd('${p.id}')" class="quick-add-btn" style="width:100%;padding:10px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;margin-top:8px;">اختر الخيارات</button>` : `<button onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${Number(p.price) || 0}, '${(p.image || '').replace(/'/g, "\\'")}')" class="quick-add-btn" style="width:100%;padding:10px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;margin-top:8px;">أضف للسلة</button>`}
        </div>
      </div>`;
  },

  _productCardHTML(p) {
    const currency = this.settings.currency || '₪';
    const isComingSoon = p.advanced && p.advanced.isComingSoon;
    const hasSale = p.salePrice && parseFloat(p.salePrice) > 0;
    const hasVariants = p.variants && p.variants.length > 0;
    return `
      <div class="product-card" data-product-id="${p.id}">
        <a href="#?product=${p.id}" style="text-decoration:none;color:inherit;">
          <div class="product-img">
            ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : '<div style="width:100%;height:200px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><i class="fa fa-image" style="font-size:40px;color:var(--gray-400);"></i></div>'}
            ${hasSale ? '<div class="sale-badge">خصم</div>' : ''}
            ${isComingSoon ? '<div class="coming-badge">قريباً</div>' : ''}
          </div>
        </a>
        <div class="product-info">
          <a href="#?product=${p.id}" style="text-decoration:none;color:inherit;">
            <h3 class="product-name">${p.name}</h3>
          </a>
          <div class="product-price">
            ${hasSale ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}
            <span class="current-price">${currency}${p.price}</span>
          </div>
          ${hasVariants ? `<button onclick="StoreInit._showQuickAdd('${p.id}')" class="quick-add-btn" style="width:100%;padding:10px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;margin-top:8px;">اختر الخيارات</button>` : `<button onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${Number(p.price) || 0}, '${(p.image || '').replace(/'/g, "\\'")}')" class="quick-add-btn" style="width:100%;padding:10px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;margin-top:8px;">أضف للسلة</button>`}
        </div>
      </div>`;
  },

  _isComingSoon(p) {
    return p.advanced && p.advanced.isComingSoon && (!p.advanced.comingSoonDate || new Date(p.advanced.comingSoonDate) > new Date());
  },

  _renderHomeSections() {
    const container = document.getElementById('publicMarketingContent');
    if (!container) return;

    const sections = (this.homeSections && this.homeSections.length) ? this.homeSections : null;
    let homeWrap = document.getElementById('homeSectionsWrap');
    if (!homeWrap) {
      homeWrap = document.createElement('div');
      homeWrap.id = 'homeSectionsWrap';
      container.appendChild(homeWrap);
    }

    const grid = document.getElementById('storeProductsGrid');

    if (!sections) {
      // No custom sections → show default product grid
      if (homeWrap) homeWrap.style.display = 'none';
      this._renderProductsGrid();
      return;
    }

    // Build HTML for all sections
    let html = '';
    sections.forEach(s => { html += this._renderHomeSection(s); });
    homeWrap.innerHTML = html;
    homeWrap.style.display = 'block';

    // Hide default grid when showing sections
    if (grid) grid.style.display = 'none';

    if (window.applyDistributorPricing) window.applyDistributorPricing();
  },

  _renderHomeSection(s) {
    const currency = this.settings.currency || '₪';
    const visibleProducts = this.products.filter(p => !(p.advanced && p.advanced.hiddenProduct));

    const gridOf = (list) => {
      if (!list || !list.length) return '';
      return `<div class="product-grid">${list.map(p => this._productCardHTML(p)).join('')}</div>`;
    };

    const sectionHeader = (title, icon) => `<div class="section-header" style="margin:30px 0 15px;"><h2 class="section-title" style="font-size:20px;font-weight:800;display:flex;align-items:center;gap:10px;">${icon ? `<i class="${icon}" style="color:var(--primary);"></i>` : ''}${title || ''}</h2></div>`;

    const viewAllLink = (catId, label) => `<a href="#?cat=${catId}" onclick="StoreInit._filterByCategory('${catId}')" class="view-all" style="font-size:12px;font-weight:700;color:var(--primary);text-decoration:none;">${label} <i class="fa fa-chevron-left" style="margin-right:4px;"></i></a>`;

    switch (s.type) {
      case 'text':
        return `<div style="background:${s.bgColor || '#f8fafc'};color:${s.textColor || '#0f172a'};padding:40px 25px;border-radius:16px;margin:30px 0;text-align:${s.align || 'center'};border:1px solid rgba(0,0,0,0.03);box-shadow:var(--shadow-sm);">
          ${s.title ? `<h2 style="font-size:28px;font-weight:800;margin-bottom:10px;">${s.title}</h2>` : ''}
          ${s.subtitle ? `<p style="font-size:16px;opacity:0.85;max-width:600px;margin:0 auto;line-height:1.6;">${s.subtitle}</p>` : ''}
          ${s.btnText && s.btnLink ? `<a href="${s.btnLink}" style="display:inline-block;margin-top:20px;background:var(--primary);color:#fff;padding:10px 25px;border-radius:10px;text-decoration:none;font-weight:800;font-size:14px;">${s.btnText} <i class="fa fa-chevron-left" style="margin-right:6px;font-size:10px;"></i></a>` : ''}
        </div>`;
      case 'banner':
        return s.image ? `<div style="margin:30px 0;border-radius:16px;overflow:hidden;box-shadow:var(--shadow-md);">${s.link ? `<a href="${s.link}" style="display:block;">` : ''}<img src="${s.image}" alt="Banner" style="width:100%;display:block;object-fit:cover;max-height:400px;">${s.link ? `</a>` : ''}</div>` : '';
      case 'new_arrivals': {
        let list = visibleProducts.filter(p => !this._isComingSoon(p)).sort((a, b) => b.id - a.id);
        if (s.limit) list = list.slice(0, s.limit);
        return list.length ? `<div style="margin:30px 0;">${sectionHeader(s.title || 'وصل حديثاً ✨', 'fas fa-clock')}${viewAllLink('all', 'عرض الكل')}${gridOf(list)}</div>` : '';
      }
      case 'coming_soon': {
        let list = visibleProducts.filter(p => this._isComingSoon(p));
        if (s.limit) list = list.slice(0, s.limit);
        return list.length ? `<div style="margin:30px 0;">${sectionHeader(s.title || 'قريباً متاح ⏳', 'fas fa-clock')}${gridOf(list)}</div>` : '';
      }
      case 'recommended_products': {
        let list = visibleProducts.filter(p => p.advanced && p.advanced.isRecommended && !this._isComingSoon(p));
        if (s.limit) list = list.slice(0, s.limit);
        return list.length ? `<div style="margin:30px 0;">${sectionHeader(s.title || 'منتجات موصى بها ⭐', 'fas fa-star')}${viewAllLink('all', 'عرض الكل')}${gridOf(list)}</div>` : '';
      }
      case 'category_products': {
        if (!s.categoryId) return '';
        let list;
        if (s.categoryId === 'all') {
          list = visibleProducts.filter(p => !this._isComingSoon(p));
        } else {
          list = visibleProducts.filter(p => {
            const cats = Array.isArray(p.categories) ? p.categories : (p.category ? [String(p.category)] : []);
            return cats.map(String).includes(String(s.categoryId));
          });
        }
        if (s.limit) list = list.slice(0, s.limit);
        if (!list.length) return `<div style="margin:30px 0;">${sectionHeader(s.title || 'منتجات القسم', 'fas fa-boxes')}<div style="text-align:center;padding:30px;color:var(--gray-400);"><i class="fas fa-box-open" style="font-size:36px;margin-bottom:10px;opacity:0.3;"></i><p style="font-weight:700;">لا توجد منتجات في هذا القسم حالياً</p></div></div>`;
        return `<div style="margin:30px 0;">${sectionHeader(s.title || 'منتجات القسم', 'fas fa-boxes')}${viewAllLink(s.categoryId, 'عرض الكل')}${gridOf(list)}</div>`;
      }
      case 'winning_product': {
        const p = visibleProducts.find(x => String(x.id) === String(s.productId));
        return p ? `<div style="margin:30px 0;">${sectionHeader(s.title || '🔥 المنتج الرابح', 'fas fa-trophy')}${gridOf([p])}</div>` : '';
      }
      case 'video':
        if (!s.videoUrl) return '';
        const isYt = /youtube\.com|youtu\.be/.test(s.videoUrl);
        return `<div style="margin:30px 0;border-radius:16px;overflow:hidden;box-shadow:var(--shadow-md);">${isYt ? `<iframe src="${s.videoUrl}" style="width:100%;aspect-ratio:16/9;border:0;" allowfullscreen></iframe>` : `<video src="${s.videoUrl}" controls style="width:100%;display:block;"></video>`}</div>`;
      case 'html':
        return s.htmlContent ? `<div style="margin:30px 0;">${s.htmlContent}</div>` : '';
      case 'testimonials': {
        const reviews = s.reviews || [];
        if (!reviews.length) return '';
        return `<div style="margin:30px 0;">${sectionHeader(s.title || 'آراء زبائننا ⭐', 'fas fa-comments')}${s.subtitle ? `<p style="color:var(--gray-600);margin:5px 0 20px;">${s.subtitle}</p>` : ''}<div class="product-grid">${reviews.map(r => `<div class="product-card" style="padding:20px;text-align:center;"><div style="font-size:22px;color:#fbbf24;">${'★'.repeat(r.rating || 5)}</div><p style="margin:10px 0;line-height:1.7;">${r.text || ''}</p><strong>${r.name || ''}</strong></div>`).join('')}</div></div>`;
      }
      case 'marquee': {
        const texts = s.texts || [];
        if (!texts.length) return '';
        const content = texts.join('   •   ');
        return `<div style="margin:20px 0;background:${s.bgColor || '#fa0000'};color:${s.textColor || '#fff'};padding:12px 0;overflow:hidden;white-space:nowrap;border-radius:10px;"><div style="display:inline-block;animation:marquee 18s linear infinite;font-weight:700;">${content}  •  ${content}</div></div>`;
      }
      case 'badges':
      case 'static_features':
        const items = s.items || [];
        if (!items.length) return '';
        return `<div style="margin:30px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:15px;">${items.map(it => `<div style="background:#fff;border:1px solid var(--gray-200);border-radius:16px;padding:20px;text-align:center;"><i class="fas ${it.icon || 'fa-check'}" style="font-size:26px;color:${s.iconColor || 'var(--primary)'};"></i><div style="font-weight:800;margin-top:10px;">${it.title || it.text || ''}</div>${it.desc ? `<div style="font-size:12px;color:var(--gray-600);margin-top:4px;">${it.desc}</div>` : ''}</div>`).join('')}</div>`;
      case 'category_tabs': {
        const catIds = s.categoryIds || [];
        let list = visibleProducts.filter(p => {
          const cats = Array.isArray(p.categories) ? p.categories : (p.category ? [String(p.category)] : []);
          return cats.map(String).some(c => catIds.map(String).includes(c));
        });
        if (s.limit) list = list.slice(0, s.limit);
        return `<div style="margin:30px 0;">${sectionHeader(s.title || 'أقسامنا', 'fas fa-tags')}${gridOf(list)}</div>`;
      }
      case 'logo_marquee': {
        const logos = s.logos || [];
        if (!logos.length) return '';
        return `<div style="margin:30px 0;background:${s.bgColor || '#fff'};border-radius:16px;padding:20px;display:flex;gap:20px;flex-wrap:wrap;justify-content:center;align-items:center;">${logos.map(l => `<img src="${l}" style="height:50px;object-fit:contain;">`).join('')}</div>`;
      }
      case 'hero_slider': {
        const slides = s.slides || [];
        if (!slides.length) return '';
        const slide = slides[0];
        return `<div style="margin:30px 0;border-radius:16px;overflow:hidden;box-shadow:var(--shadow-md);">${slide.link ? `<a href="${slide.link}" style="display:block;">` : ''}<img src="${slide.image}" style="width:100%;display:block;max-height:420px;object-fit:cover;">${slide.link ? `</a>` : ''}</div>`;
      }
      default:
        return '';
    }
  },

  // ── Quick Add Modal ─────────────────────────────────────────────────────────

  _showQuickAdd(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const currency = this.settings.currency || '₪';
    const body = document.getElementById('quickAddBody');
    if (!body) return;

    let variantsHTML = '';
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(v => {
        const values = Array.isArray(v.values) ? v.values : [];
        variantsHTML += `<div class="product-option" id="option-${v.name.replace(/\s+/g, '-')}">
          <label style="font-weight:800;margin-bottom:10px;display:block;">${v.name}</label>
          <div class="option-pills" data-option="${v.name}">`;

        values.forEach(val => {
          const cleanVal = (val.value || '').trim();
          const outOfStock = val.stock !== undefined && val.stock !== '' && parseInt(val.stock) === 0;
          variantsHTML += `<div class="option-pill ${outOfStock ? 'out-of-stock' : ''}" 
            onclick="${outOfStock ? '' : `StoreInit._selectQuickAddPill(this, '${v.name.replace(/'/g, "\\'")}')`}" 
            data-value="${cleanVal}" data-product-id="${productId}"
            style="${outOfStock ? 'opacity:0.4;cursor:not-allowed;' : 'cursor:pointer;'}">${cleanVal}${outOfStock ? ' ✕' : ''}</div>`;
        });

        variantsHTML += `</div><div class="option-error-msg" style="color:#ef4444;font-size:11px;font-weight:700;margin-top:5px;display:none;">يرجى اختيار ${v.name}</div></div>`;
      });
    }

    body.innerHTML = `
      <div style="display:flex;gap:15px;align-items:center;margin-bottom:20px;">
        ${product.image ? `<img src="${product.image}" style="width:80px;height:80px;border-radius:12px;object-fit:cover;">` : ''}
        <div>
          <h4 style="margin:0;font-weight:800;">${product.name}</h4>
          <p style="color:var(--primary);font-weight:900;font-size:18px;margin:5px 0 0;">${currency}${product.price}</p>
        </div>
      </div>
      ${variantsHTML}
      <button onclick="StoreInit._submitQuickAdd('${productId}')" style="width:100%;padding:14px;background:var(--primary);color:white;border:none;border-radius:12px;font-weight:800;font-size:16px;cursor:pointer;">أضف للسلة</button>`;

    openModal('quickAddModal');
  },

  _quickAddSelections: {},

  _selectQuickAddPill(el, optionName) {
    const container = el.closest('.option-pills');
    if (!container) return;

    container.querySelectorAll('.option-pill').forEach(pill => pill.classList.remove('selected'));
    el.classList.add('selected');

    const productId = el.dataset.productId;
    if (!this._quickAddSelections[productId]) this._quickAddSelections[productId] = {};
    this._quickAddSelections[productId][optionName] = el.dataset.value;
  },

  _submitQuickAdd(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const selections = this._quickAddSelections[productId] || {};
    const requiredOptions = (product.variants || []).map(v => v.name);
    let allSelected = true;

    requiredOptions.forEach(optName => {
      if (!selections[optName]) {
        const errEl = document.querySelector(`#option-${optName.replace(/\s+/g, '-')} .option-error-msg`);
        if (errEl) errEl.style.display = 'block';
        allSelected = false;
      }
    });

    if (!allSelected) return;

    // Build option string
    const optionString = requiredOptions.map(optName => ` (${selections[optName]})`).join('');

    // Find variant image if any
    let variantImage = '';
    if (product.variants) {
      for (const v of product.variants) {
        const selectedVal = (v.values || []).find(val => val.value === selections[v.name]);
        if (selectedVal && selectedVal.image) {
          variantImage = selectedVal.image;
          break;
        }
      }
    }

    const item = {
      id: productId,
      name: product.name + optionString,
      price: parseFloat(product.price),
      image: variantImage || product.image || '',
      quantity: 1
    };

    if (window.cart) {
      window.cart.addItem(item);
      closeModal('quickAddModal');
      this._quickAddSelections[productId] = {};
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => StoreInit.init());

// React to hash changes (e.g. clicking a product link updates #?product=ID)
window.addEventListener('hashchange', () => StoreInit._handleHash());
