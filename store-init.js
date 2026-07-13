// ============================================
// Pro Store - Client-Side Store Initialization
// Replaces server-side template rendering
// ============================================

window.StoreInit = {
  settings: {},
  categories: [],
  products: [],

  async init() {
    // Clean URL from index.html and empty hash when running on the web
    if (window.location.protocol !== 'file:') {
      if (window.location.pathname.endsWith('/index.html')) {
        const cleanPath = window.location.pathname.replace(/\/index\.html$/, '/');
        window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
      }
      if (window.location.hash === '#') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    try {
      // Store content is hidden via CSS by default. Show it only when no page/reels URL.
      const pageInQuery = window.location.search.match(/[?&]page=([^&#]+)/);
      const hashRoutes = window.location.hash.match(/[?&](cat|product|app)=/);
      const isPageOnly = pageInQuery && !hashRoutes;
      const isReels = window.location.hash.match(/[?&]app=reels/);
      if (!isPageOnly && !isReels) {
        const m = document.querySelector('.main-container');
        const f = document.querySelector('.main-footer');
        if (m) m.style.display = '';
        if (f) f.style.display = '';
      }
      // Load settings from Supabase
      const { data: settingsRows } = await DB.supabase.from('settings').select('key, value');
      this.settings = {};
      if (settingsRows) {
        settingsRows.forEach(r => { this.settings[r.key] = r.value; });
      }
      console.log('🔍 Store settings loaded:', { popupEnabled: this.settings.popupEnabled, popups: this.settings.popups, popups_json: this.settings.popups_json });

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
      document.title = this.settings.storeName || this.settings.metaTitle || 'متجري';

      // Set global vars
      window.storePhone = this.settings.storePhone || '';
      window.currency = this.settings.currency || '₪';
      window.searchPlaceholders = this._parseSearchPlaceholders();

      // Show/hide reels feature
      this._applyReelsVisibility();

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

      // Load categories and render modals
      await this._loadCategories();
      await this._renderCategoriesModal();
      this._renderBrandsModal();

      // Load and render products
      await this._loadProducts();
      this._renderSidebar();
      await this._loadActivePromotions();
      this._renderHeroSection();
      this._renderHomeSections();

      // Initialize cart
      if (window.cart) window.cart.init();

      // Track page visit
      this._trackVisit();

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

      // Register Service Worker for PWA support (only on http/https)
      if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js').catch(err => {
          console.warn('Service Worker registration failed:', err);
        });
      }

      // Handle deep links (#?product=ID / #?cat=ID)
      this._handleHash();

    } catch (err) {
      console.error('StoreInit error:', err);
    }
  },

  // ── Track page visit ────────────────────────────────────────────────────────
  async _trackVisit() {
    try {
      await DB.trackEvent('visit');
    } catch (e) { console.warn('Track visit failed:', e); }
  },

  // ── Show / hide reels feature based on settings ─────────────────────────
  _applyReelsVisibility() {
    const enabled = this.settings.reelsEnabled !== false;
    const reelsLinks = document.querySelectorAll('.reels-story-icon');
    reelsLinks.forEach(el => { el.style.display = enabled ? '' : 'none'; });
  },

  // ── Hash / Deep Link Routing ───────────────────────────────────────────────
  _handleHash() {
    // Check both hash (#?page=X) and query string (?page=X)
    const hash = window.location.hash || '';
    const query = window.location.search || '';
    const getParam = (name, source) => {
      const m = source.match(new RegExp(name + '=([^&#]+)'));
      return m ? decodeURIComponent(m[1]) : null;
    };
    const appMatch = hash.match(/app=([^&#]+)/);
    if (appMatch) {
      if (appMatch[1] === 'reels') {
        if (this.settings.reelsEnabled === false) {
          this._goHome();
          return;
        }
        this._showReelsPage();
        return;
      }
      if (appMatch[1] === 'distributor') {
        if (window.openDistributorPortal) {
          window.openDistributorPortal();
        }
        return;
      }
    }
    // If a custom page is displayed and user navigates to product/cat, remove page first
    const hasPageContainer = document.getElementById('customPageContainer');
    const store = document.getElementById('publicMarketingContent');
    const main = document.querySelector('.main-container');
    const footer = document.querySelector('.main-footer');
    const productId = getParam('product', hash) || getParam('product', query);
    if (productId) {
      if (hasPageContainer) { if (store) store.style.display = ''; if (main) main.style.display = ''; if (footer) footer.style.display = 'block'; hasPageContainer.remove(); }
      const tryOpen = () => {
        const product = this.products.find(p => String(p.id) === String(productId));
        if (product) {
          this._showProductDetail(productId);
        } else if (this._hashRetries < 20) {
          this._hashRetries++;
          setTimeout(tryOpen, 200);
        }
      };
      this._hashRetries = 0;
      tryOpen();
      return;
    }
    const catId = getParam('cat', hash) || getParam('cat', query);
    if (catId) {
      if (hasPageContainer) { if (store) store.style.display = ''; if (main) main.style.display = ''; if (footer) footer.style.display = 'block'; hasPageContainer.remove(); }
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
    const pageSlug = getParam('page', hash) || getParam('page', query);
    console.log('🔍 _handleHash pageSlug:', pageSlug, 'hash:', hash, 'query:', query);
    if (pageSlug) {
      this._showPage(pageSlug);
      return;
    }
    // No deep link → show homepage
    this._filterByCategory('all');
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

    const isComingSoon = this._isComingSoon(product);
    const isOutOfStock = product.advanced && typeof product.advanced.stock === 'number' && product.advanced.stock === 0;
    const productVideo = (product.advanced && product.advanced.productVideo) || (product.video) || '';

    // Calculate promotion price for detail page
    const promoPrice = this._getPromoPrice(product);
    const hasPromo = promoPrice !== null && promoPrice < parseFloat(product.price);
    const hasSale = hasPromo ? (product.salePrice && parseFloat(product.salePrice) > parseFloat(product.price)) : (product.salePrice && parseFloat(product.salePrice) > 0);
    let displayPrice = hasPromo ? promoPrice : parseFloat(product.price);
    let displayOriginal = hasPromo ? parseFloat(product.price) : (hasSale ? parseFloat(product.salePrice) : 0);
    const distPhone = localStorage.getItem('distributorPhone');
    const distId = localStorage.getItem('distributorId');
    const isDistributor = distPhone && distId;
    let wholesalePrice = null;
    if (isDistributor) {
      if (window.wholesalePrices && window.wholesalePrices[product.id]) {
        wholesalePrice = parseFloat(window.wholesalePrices[product.id]);
      } else if (product.wholesalePrice && parseFloat(product.wholesalePrice) > 0) {
        wholesalePrice = parseFloat(product.wholesalePrice);
      }
    }
    if (wholesalePrice) {
      displayOriginal = displayPrice;
      displayPrice = wholesalePrice;
    }
    const allImages = product.images && product.images.length > 0 ? product.images : [product.image];

    // Build gallery items (images + video)
    let galleryItems = allImages.map(img => ({ type: 'image', url: img }));
    if (productVideo) {
      // Place video after the first image (main image)
      galleryItems.splice(1, 0, { type: 'video', url: productVideo });
    }

    let galleryHTML = galleryItems.length > 1 ? '<div class="product-gallery">' + galleryItems.map((item, i) => {
      if (item.type === 'video') {
        let thumb = '';
        if (item.url.includes('youtube.com') || item.url.includes('youtu.be')) {
          const id = item.url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/)?.[2];
          thumb = 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg';
        } else if (item.url.includes('vimeo.com')) {
          thumb = 'https://vjs.zencdn.net/v/oceans.png';
        } else {
          return '<div class="gallery-thumb video-thumb ' + (i === 0 ? 'selected-thumb' : '') + '" onclick="window.setGalleryItem(' + i + ')" style="position:relative; background:#000; overflow:hidden;">' +
            '<video src="' + item.url + '" muted style="width:100%; height:100%; object-fit:cover; opacity:0.8;"></video>' +
            '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2);">' +
            '<i class="fas fa-play-circle" style="color:white; font-size:24px; text-shadow:0 2px 4px rgba(0,0,0,0.5);"></i>' +
            '</div>' +
            '</div>';
        }
        return '<div class="gallery-thumb video-thumb ' + (i === 0 ? 'selected-thumb' : '') + '" onclick="window.setGalleryItem(' + i + ')" style="position:relative; background:#f8fafc; display:flex; align-items:center; justify-content:center;">' +
          '<img src="' + thumb + '" style="width:100%; height:100%; object-fit:cover;">' +
          '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2);">' +
          '<i class="fas fa-play-circle" style="color:white; font-size:24px; text-shadow:0 2px 4px rgba(0,0,0,0.5);"></i>' +
          '</div>' +
          '</div>';
      }
      return '<img src="' + item.url + '" class="gallery-thumb ' + (i === 0 ? 'selected-thumb' : '') + '" onclick="window.setGalleryItem(' + i + ')">';
    }).join('') + '</div>' : '';

    let optionsHTML = '';
    if (product.variants && product.variants.length > 0) {
      const getColorHex = (colorName) => {
        const map = {
          'أحمر': '#ef4444', 'red': '#ef4444', 'أزرق': '#3b82f6', 'blue': '#3b82f6',
          'أخضر': '#10b981', 'green': '#10b981', 'أصفر': '#f59e0b', 'yellow': '#f59e0b',
          'أسود': '#0f172a', 'black': '#0f172a', 'أبيض': '#ffffff', 'white': '#ffffff',
          'ذهبي': '#eab308', 'gold': '#eab308', 'فضي': '#94a3b8', 'silver': '#94a3b8',
          'وردي': '#ec4899', 'pink': '#ec4899', 'بنفسجي': '#a855f7', 'purple': '#a855f7'
        };
        return map[colorName.toLowerCase().trim()] || '#e2e8f0';
      };

      product.variants.forEach(v => {
        const rawValues = Array.isArray(v.values) ? v.values : (typeof v.values === 'string' ? (v.values.includes(',') ? v.values.split(',') : [v.values]) : []);
        const values = rawValues.map(val => typeof val === 'object' ? val : { value: val, image: '' });
        const type = v.type || 'pills';

        optionsHTML += '<div class="product-option" id="option-' + v.name.replace(/\s+/g, '-') + '"><label>' + v.name + '</label><div class="option-pills" data-option="' + v.name + '">';

        optionsHTML += values.map((val, i) => {
          const cleanVal = (val.value || '').trim();
          const outOfStock = val.stock !== undefined && val.stock !== '' && parseInt(val.stock) === 0;
          const isSelected = false;

          if (type === 'swatch') {
            const hex = val.color || getColorHex(cleanVal);
            return '<div class="option-pill swatch-pill ' + (isSelected ? 'selected' : '') + ' ' + (outOfStock ? 'out-of-stock' : '') + '" ' +
              'onclick="' + (outOfStock ? '' : 'window.selectPill(this, \'' + v.name.replace(/'/g, "\\'") + '\')') + '" ' +
              'title="' + cleanVal + (outOfStock ? ' (نفدت)' : '') + '" ' +
              'data-image="' + (val.image || '') + '" data-out-of-stock="' + outOfStock + '" ' +
              'style="background: ' + hex + '; width:34px; height:34px; border-radius:50%; border:2px solid transparent; position:relative; cursor:' + (outOfStock ? 'not-allowed' : 'pointer') + '; ' + (outOfStock ? 'opacity:0.4; filter:grayscale(1);' : '') + '">' +
              (outOfStock ? '<svg style="position:absolute;inset:0;" viewBox="0 0 30 30"><line x1="4" y1="4" x2="26" y2="26" stroke="#ef4444" stroke-width="2.5"/></svg>' : '') +
              '</div>';
          } else if (type === 'image') {
            const imgSrc = val.image || '';
            return '<div class="option-pill image-pill ' + (isSelected ? 'selected' : '') + ' ' + (outOfStock ? 'out-of-stock' : '') + '" ' +
              'onclick="' + (outOfStock ? '' : 'window.selectPill(this, \'' + v.name.replace(/'/g, "\\'") + '\')') + '" ' +
              'data-image="' + imgSrc + '" style="width:64px; height:64px; border-radius:10px; overflow:hidden; border:2px solid #e2e8f0; cursor:' + (outOfStock ? 'not-allowed' : 'pointer') + '; ' + (outOfStock ? 'opacity:0.4; filter:grayscale(1);' : '') + '">' +
              (imgSrc ? '<img src="' + imgSrc + '" style="width:100%; height:100%; object-fit:cover;">' : '<span>' + cleanVal + '</span>') +
              (outOfStock ? '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;"><svg style="width:100%; height:100%;" viewBox="0 0 30 30"><line x1="0" y1="30" x2="30" y2="0" stroke="#ef4444" stroke-width="2"/></svg></div>' : '') +
              '</div>';
          } else {
            return '<div class="option-pill ' + (isSelected ? 'selected' : '') + ' ' + (outOfStock ? 'out-of-stock' : '') + '" ' +
              'onclick="' + (outOfStock ? '' : 'window.selectPill(this, \'' + v.name.replace(/'/g, "\\'") + '\')') + '" ' +
              'data-image="' + (val.image || '') + '">' + cleanVal + (outOfStock ? ' ✕' : '') + '</div>';
          }
        }).join('');

        optionsHTML += '</div><div class="option-error-msg" style="color:#ef4444; font-size:11px; font-weight:700; margin-top:5px; display:none;">يرجى اختيار ' + v.name + '</div></div>';
      });
    } else {
      if (product.colors && product.colors.length > 0) {
        optionsHTML += '<div class="product-option"><label>اللون</label><div class="option-pills" data-option="اللون">' + product.colors.map((c, i) => '<div class="option-pill ' + (i === 0 ? 'selected' : '') + '" onclick="window.selectPill(this, \'اللون\')">' + c + '</div>').join('') + '</div></div>';
      }
      if (product.sizes && product.sizes.length > 0) {
        optionsHTML += '<div class="product-option"><label>المقاس</label><div class="option-pills" data-option="المقاس">' + product.sizes.map((s, i) => '<div class="option-pill ' + (i === 0 ? 'selected' : '') + '" onclick="window.selectPill(this, \'المقاس\')">' + s + '</div>').join('') + '</div></div>';
      }
    }

    const currentCat = this.categories.find(c => String(c.id) === String(product.category)) || { name: 'عام', id: '0' };

    let initialMediaHTML = '';
    const firstItem = galleryItems[0];
    if (firstItem && firstItem.type === 'video') {
      if (firstItem.url.includes('youtube.com') || firstItem.url.includes('youtu.be')) {
        const vidId = firstItem.url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/)?.[2];
        initialMediaHTML = '<iframe id="mainProductVideo" width="100%" height="100%" src="https://www.youtube.com/embed/' + vidId + '?autoplay=1&mute=1&loop=1&playlist=' + vidId + '" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="position:absolute; inset:0; width:100%; height:100%;"></iframe>';
      } else if (firstItem.url.includes('vimeo.com')) {
        const vidId = firstItem.url.split('/').pop();
        initialMediaHTML = '<iframe id="mainProductVideo" src="https://player.vimeo.com/video/' + vidId + '?autoplay=1&muted=1&loop=1" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="position:absolute; inset:0; width:100%; height:100%;"></iframe>';
      } else {
        initialMediaHTML = '<div class="custom-video-wrapper">' +
          '<div onclick="window.toggleCustomVideo(this.parentNode)" style="width:100%; height:100%; position:relative;">' +
          '<video id="mainProductVideo" class="custom-video-player" src="' + firstItem.url + '" autoplay muted loop playsinline controlsList="nodownload" oncontextmenu="return false;" ontimeupdate="window.updateVideoProgress(this)"></video>' +
          '<div class="video-overlay" style="opacity: 0; pointer-events: none;">' +
          '<div class="play-pause-btn"><i class="fas fa-play"></i></div>' +
          '</div>' +
          '</div>' +
          '<div class="fullscreen-btn" onclick="window.toggleFullscreen(this.parentNode.querySelector(\'video\'))" title="تكبير">' +
          '<i class="fas fa-expand"></i>' +
          '</div>' +
          '<div class="video-controls-bottom">' +
          '<div class="video-progress" id="videoProgressBar"></div>' +
          '</div>' +
          '</div>';
      }
    } else {
      initialMediaHTML = '<img src="' + (product.image || '') + '" id="mainProductImg" class="product-main-img">';
    }

    // Build related products HTML
    let relatedProductsHTML = '';
    const relatedProducts = this.products.filter(p => String(p.category) === String(product.category) && String(p.id) !== String(product.id) && (!p.advanced || !p.advanced.hiddenProduct) && !this._isComingSoon(p)).slice(0, 6);
    if (relatedProducts.length > 0) {
      relatedProductsHTML = `
        <div style="margin-top:60px;">
          <div class="section-header" style="margin-bottom:20px;">
            <h2 class="section-title" style="font-size:22px; font-weight:800; border-bottom:2.5px solid var(--primary); padding-bottom:8px; display:inline-block;">منتجات قد تعجبك أيضاً</h2>
          </div>
          <div class="product-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:16px;">
            ${relatedProducts.map(p => this._productCardHTML(p)).join('')}
          </div>
        </div>`;
    }

    let productDetailHTML = `
      <div class="product-page-wrapper" style="max-width: 1450px; margin: 40px auto; padding: 0 5%; box-sizing: border-box;">
      <nav class="breadcrumbs">
        <a href="javascript:void(0)" onclick="StoreInit._goHome()">الرئيسية</a>
        <i class="fa fa-chevron-left"></i>
        <a href="javascript:void(0)" onclick="StoreInit._filterByCategory('all')">كل المنتجات</a>
        <i class="fa fa-chevron-left"></i>
        <a href="javascript:void(0)" onclick="StoreInit._filterByCategory('${currentCat.id}')">${currentCat.name}</a>
        <i class="fa fa-chevron-left"></i>
        <span class="current">${product.name}</span>
      </nav>
      <div class="product-detail-view">
        <div class="product-main-info">
          <div class="product-media">
            <div class="main-img-container" style="${isOutOfStock ? 'filter: grayscale(0.5) opacity(0.8);' : ''}">
              ${initialMediaHTML}
              ${isComingSoon ? `<div class="coming-soon-badge" style="transform: translate(-50%, -50%) rotate(-15deg); font-size: 24px; padding: 10px 25px;">قريباً متاح ⏳</div>` : ''}
              ${isOutOfStock ? `<div class="out-of-stock-badge-detail" style="position:absolute; top:10px; left:10px; background:#ef4444; color:white; padding:6px 14px; border-radius:8px; font-size:13px; font-weight:800; z-index:5;">نفدت الكمية</div>` : ''}
              ${galleryItems.length > 1 ? `
                <button class="gallery-arrow prev" onclick="window.changeGalleryImage(1)"><i class="fa fa-chevron-right"></i></button>
                <button class="gallery-arrow next" onclick="window.changeGalleryImage(-1)"><i class="fa fa-chevron-left"></i></button>
              ` : ''}
            </div>
            ${galleryHTML}
          </div>
          <div class="product-details">
            <div class="breadcrumb" style="margin-bottom:15px; font-size:12px; opacity:0.6;">
              <a href="javascript:void(0)" onclick="StoreInit._goHome()" style="color:inherit; text-decoration:none;">الرئيسية</a> / 
              <span>${product.name}</span>
            </div>
            <h1 class="product-title">${product.name}</h1>
            <div class="product-price-large">
              ${isComingSoon ? `
                <span style="background:#f1f5f9; color:#64748b; padding:5px 15px; border-radius:10px; font-size:18px;">بانتظار التوفر</span>
              ` : wholesalePrice ? `
                <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                  <span style="font-size:12px; color:#10b981; font-weight:800; background:#10b98118; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;">
                    <i class="fas fa-tags" style="font-size:10px;"></i> سعر الجملة للتاجر
                  </span>
                  <div style="display:flex; align-items:baseline; gap:8px;">
                    <span style="color:#10b981; font-size:32px; font-weight:900;">${currency}${displayPrice.toFixed(2)}</span>
                    <span style="font-size:18px; font-weight:normal; color:var(--gray-400); text-decoration:line-through;">${currency}${displayOriginal.toFixed(2)}</span>
                  </div>
                </div>
              ` : `
                <span style="font-size:28px;font-weight:900;color:var(--primary);">${currency}${displayPrice.toFixed(2)}</span>
                ${displayOriginal > 0 && displayOriginal > displayPrice ? `<span class="old-price" style="text-decoration:line-through;color:var(--gray-400);font-size:16px;font-weight:700;margin-right:8px;">${currency}${displayOriginal.toFixed(2)}</span>` : ''}
                ${hasPromo ? `<span style="background:#ef4444;color:white;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:800;margin-right:8px;">${this.activePromotions?.[0]?.occasion_emoji || '🔥'} خصم</span>` : ''}
              `}
            </div>

            <!-- Marketing Elements -->
            <div style="margin: 20px 0; display: flex; flex-direction: column; gap: 12px;">
              ${(product.fakeStock === true || product.fakeStock === 'true') ? `
                <div style="background: ${isOutOfStock ? '#fef2f2' : '#fff5f5'}; border: 1px solid ${isOutOfStock ? '#fecaca' : '#feb2b2'}; padding: 12px 15px; border-radius: 12px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 700; color: #c53030;">
                    ${isOutOfStock ? '<span>المنتج نفدت كميته</span><span>المنتج غير متوفر حالياً</span>' : '<span>المخزون المتبقي: <span id="dynamicStock">12</span> قطعة</span><span>عجل! الكمية أوشكت على النفاذ</span>'}
                  </div>
                  <div style="height: 8px; background: #fed7d7; border-radius: 10px; overflow: hidden;">
                    <div id="stockBar" style="width: ${isOutOfStock ? '0%' : '85%'}; height: 100%; background: #e53e3e; border-radius: 10px; transition: width 2s ease;"></div>
                  </div>
                </div>` : ''}

              ${(product.fakeVisitors === true || product.fakeVisitors === 'true') ? `
                <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4a5568; font-weight: 600;">
                  <span style="width: 8px; height: 8px; background: #48bb78; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite;"></span>
                  <span>يوجد حالياً <strong id="dynamicVisitors" style="color: #2d3748;">${Math.floor(Math.random() * 30) + 20}</strong> شخص يشاهدون هذا المنتج</span>
                </div>
                <style>@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(72, 187, 120, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0); } }</style>` : ''}

              ${(product.fakeTimer === true || product.fakeTimer === 'true') ? `
                <div style="background: #fdf2f2; border: 1px dashed #f87171; padding: 15px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
                  <div style="font-weight: 800; font-size: 14px; color: #991b1b;">ينتهي العرض خلال:</div>
                  <div style="display: flex; gap: 8px; font-weight: 800; color: #b91c1c;">
                    <div style="background: white; padding: 5px 10px; border-radius: 8px; border: 1px solid #fecaca; min-width: 45px; text-align: center;"><span id="timerH">02</span><br><small style="font-size: 8px;">ساعة</small></div>
                    <div style="background: white; padding: 5px 10px; border-radius: 8px; border: 1px solid #fecaca; min-width: 45px; text-align: center;"><span id="timerM">45</span><br><small style="font-size: 8px;">دقيقة</small></div>
                    <div style="background: white; padding: 5px 10px; border-radius: 8px; border: 1px solid #fecaca; min-width: 45px; text-align: center;"><span id="timerS">18</span><br><small style="font-size: 8px;">ثانية</small></div>
                  </div>
                </div>` : ''}
            </div>

            ${optionsHTML}

            <div class="purchase-actions" style="margin-top:30px; display:flex; gap:15px;">
              ${isComingSoon ? `
                <button class="buy-now-btn" style="flex:1; background:#94a3b8; cursor:not-allowed;" disabled>قريباً متاح (انتظروا توفر المنتج)</button>` : isOutOfStock ? `
                <button class="buy-now-btn" style="flex:1; background:#ef4444; cursor:not-allowed;" disabled>نفدت الكمية</button>
                <button class="add-to-cart-btn" disabled style="background:#ef444480; cursor:not-allowed;"><i class="fa fa-ban"></i></button>` : `
                <button class="buy-now-btn" style="flex:1;">اشتري الآن</button>
                <button class="add-to-cart-btn"><i class="fa fa-shopping-bag"></i></button>`}
            </div>

            <div class="share-tools" style="margin-top:25px; display:flex; gap:10px; align-items:center;">
              <span style="font-size:13px; font-weight:700;">شارك المنتج:</span>
              <button onclick="copyProductLink()" style="background:var(--gray-100); border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:12px;"><i class="fa fa-link"></i> نسخ الرابط</button>
              <button onclick="showQRCode()" style="background:var(--gray-100); border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:12px;"><i class="fa fa-qrcode"></i> QR كود</button>
            </div>

            <div id="qrOverlay" onclick="this.style.display='none'" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; flex-direction:column; color:white;">
              <div style="background:white; padding:20px; border-radius:15px; text-align:center;">
                <img id="qrImg" src="" style="width:200px; height:200px; margin-bottom:15px;">
                <div style="color:#000; font-weight:800;">امسح الكود للمشاركة</div>
              </div>
              <p style="margin-top:15px; font-size:14px;">اضغط في أي مكان للإغلاق</p>
            </div>

            <div class="product-desc-box" style="margin-top: 30px;">${product.description || ''}</div>

            <div style="margin-top:30px; border-top:1px solid #eee; padding-top:25px; display:flex; flex-direction:column; gap:15px;">
              <!-- COD Box -->
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:18px 20px; display:flex; align-items:flex-start; gap:14px;">
                <div style="width:42px; height:42px; background:#16a34a; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <i class="fa fa-money-bill-wave" style="color:#fff; font-size:18px;"></i>
                </div>
                <div>
                  <div style="font-weight:800; font-size:15px; color:#15803d; margin-bottom:5px;">الدفع عند الإستلام</div>
                  <div style="font-size:13px; color:#166534; line-height:1.6;">نقوم بإيصال المنتج لغاية منزلك وتقوم بدفع الثمن لموظف التوصيل. لا تحتاج لبطاقة ائتمان!</div>
                </div>
              </div>

              <!-- Delivery Areas Box -->
              <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:14px; padding:18px 20px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                  <div style="width:42px; height:42px; background:#2563eb; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="fa fa-location-dot" style="color:#fff; font-size:18px;"></i>
                  </div>
                  <div style="font-weight:800; font-size:15px; color:#1d4ed8;">مناطق التوصيل المتاحة</div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                  ${[
                    'الداخل 48', 'القدس', 'جنين', 'طوباس', 'نابلس',
                    'سلفيت', 'طولكرم', 'قلقيلية', 'رام الله والبيرة',
                    'اريحا', 'الخليل', 'بيت لحم', 'ضواحي القدس'
                  ].map(area => `
                    <span style="background:#dbeafe; color:#1e40af; font-size:12px; font-weight:700; padding:5px 11px; border-radius:20px; display:flex; align-items:center; gap:5px;">
                      <i class="fa fa-circle-check" style="font-size:10px;"></i> ${area}
                    </span>`).join('')}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Landing Page Advanced Sections -->
      ${product.landingSections && product.landingSections.length > 0 ? `
      <div class="landing-sections-container" style="margin-top:60px; display:flex; flex-direction:column; gap:60px; padding:0 5%;">
        ${product.landingSections.map((s, i) => {
          if (s.type === 'zigzag') {
            return `
              <div class="landing-row zigzag" style="display:flex; align-items:center; gap:50px; flex-direction: ${s.direction === 'left' ? 'row-reverse' : 'row'};">
                <div style="flex:1;"><img src="${s.image}" style="width:100%; border-radius:20px; box-shadow:0 15px 30px rgba(0,0,0,0.1);"></div>
                <div style="flex:1; text-align: ${s.direction === 'left' ? 'left' : 'right'};">
                  <h3 style="font-size:32px; font-weight:900; margin-bottom:20px; color:#0f172a;">${s.title}</h3>
                  <p style="font-size:18px; line-height:1.8; color:#475569;">${s.text}</p>
                </div>
              </div>`;
          } else if (s.type === 'banner') {
            return `<div class="landing-row banner"><img src="${s.image}" style="width:100%; border-radius:20px; box-shadow:0 15px 30px rgba(0,0,0,0.05);"></div>`;
          } else if (s.type === 'video') {
            const isYoutube = s.videoUrl.includes('youtube.com') || s.videoUrl.includes('youtu.be');
            let videoHTML = '';
            if (isYoutube) {
              const vidId = s.videoUrl.split('v=')[1] || s.videoUrl.split('/').pop();
              videoHTML = `<iframe width="100%" height="500" src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen style="border-radius:20px;"></iframe>`;
            } else {
              videoHTML = `<video src="${s.videoUrl}" controls style="width:100%; border-radius:20px;"></video>`;
            }
            return `<div class="landing-row video">${videoHTML}</div>`;
          } else if (s.type === 'features') {
            const featuresHTML = (s.features || []).map(f => `
              <div class="feature-card" style="background:#fff; padding:30px; border-radius:20px; border:1px solid #eee; text-align:center; flex:1; min-width:250px;">
                <div style="width:60px; height:60px; background:var(--primary-light); color:var(--primary); border-radius:15px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:24px;"><i class="fas ${f.icon}"></i></div>
                <h4 style="font-weight:800; margin-bottom:10px;">${f.title}</h4>
                <p style="font-size:14px; color:#64748b;">${f.text}</p>
              </div>`).join('');
            return `
              <div class="landing-row features">
                ${s.title ? `<h2 style="text-align:center; font-weight:900; margin-bottom:40px; font-size:28px;">${s.title}</h2>` : ''}
                <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">${featuresHTML}</div>
              </div>`;
          }
          return '';
        }).join('')}
      </div>` : ''}

      ${relatedProductsHTML}

      <style>
        .product-detail-view { background: #fff; border-radius: 20px; padding: 30px; border: 1px solid #eee; }
        .product-main-info { display: flex; gap: 40px; align-items: flex-start; }
        .product-media { width: 45%; align-self: flex-start; position: relative; }
        @media (min-width: 992px) {
          .product-media { position: sticky; top: 80px; }
        }
        .main-img-container { width: 100%; aspect-ratio: 1; border-radius: 15px; overflow: hidden; border: 1px solid #eee; background: #fdfdfd; position: relative; }
        .product-main-img { width: 100%; height: 100%; object-fit: cover; }
        
        .gallery-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.85); border: none; width: 42px; height: 42px; border-radius: 50%; color: var(--dark); cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
        .gallery-arrow:hover { background: var(--primary); color: white; transform: translateY(-50%) scale(1.1); }
        .gallery-arrow.prev { right: 15px; }
        .gallery-arrow.next { left: 15px; }

        .product-gallery { display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; padding-bottom: 5px; scroll-behavior: smooth; }
        .gallery-thumb { width: 70px; height: 70px; border-radius: 12px; object-fit: cover; cursor: pointer; border: 2.5px solid transparent; transition: all 0.2s ease; opacity: 0.6; flex-shrink: 0; }
        .gallery-thumb:hover, .gallery-thumb.selected-thumb { border-color: var(--primary); opacity: 1; transform: scale(1.05); }

        .product-details { flex: 1; }
        .product-title { font-size: 28px; font-weight: 900; margin-bottom: 15px; }
        .product-price-large { font-size: 32px; font-weight: 800; color: var(--primary); margin-bottom: 25px; }
        .product-price-large .old-price { font-size: 18px; color: #999; text-decoration: line-through; margin-right: 10px; font-weight: 400; }
        .product-desc-box { line-height: 1.8; color: #555; margin-bottom: 30px; white-space: pre-line; }
        .product-option { margin-bottom: 20px; }
        .product-option label { font-weight: 800; font-size: 13px; display: block; margin-bottom: 10px; }
        .option-pills { display: flex; gap: 10px; flex-wrap: wrap; }
        .option-pill { padding: 8px 15px; border: 2px solid #eee; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px; transition: 0.2s; }
        .option-pill:hover { border-color: var(--primary); }
        .option-pill.selected { background: var(--primary); color: #fff; border-color: var(--primary); }
        .buy-now-btn { background: var(--primary); color: #fff; border: none; padding: 15px; border-radius: 10px; font-weight: 800; cursor: pointer; transition: 0.3s; font-size: 16px; }
        .buy-now-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .add-to-cart-btn { background: #000; color: #fff; border: none; width: 55px; height: 55px; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .add-to-cart-btn:hover { background: var(--primary); transform: translateY(-3px); }
        .share-tools button:hover { background: var(--gray-200); }
        @media (max-width: 991px) {
          .product-main-info { flex-direction: column; }
          .product-media { width: 100%; position: relative; top: 0; margin-bottom: 20px; }
          .gallery-arrow { width: 36px; height: 36px; font-size: 14px; }
        }

        .custom-video-wrapper { position: absolute; inset: 0; width: 100%; height: 100%; background: #000; overflow: hidden; cursor: pointer; border-radius: 12px; }
        .custom-video-player { width: 100%; height: 100%; object-fit: contain; }
        .video-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; opacity: 0; }
        .custom-video-wrapper:not(.is-playing) .video-overlay { opacity: 1; pointer-events: auto; }
        .play-pause-btn { width: 65px; height: 65px; background: rgba(255,255,255,0.2); backdrop-filter: blur(12px); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; transition: 0.3s; border: 1.5px solid rgba(255,255,255,0.4); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .play-pause-btn i { transform: translateX(-2px); }
      </style>
      </div>`;

    page.innerHTML = productDetailHTML;

    // Execute product page logic directly (avoid innerHTML script block blocking)
    (function() {
      let currentItemIndex = 0;

      function setGalleryItem(index) {
        currentItemIndex = index;
        var container = document.querySelector('.main-img-container');
        if (!container) return;
        var item = galleryItems[index];
        if (!item) return;

        var existingImg = document.getElementById('mainProductImg');
        var existingVideoWrapper = container.querySelector('.custom-video-wrapper');
        var existingIframe = document.getElementById('mainProductVideo');
        if (existingImg) existingImg.remove();
        if (existingVideoWrapper) existingVideoWrapper.remove();
        if (existingIframe) existingIframe.remove();

        if (item.type === 'video') {
          var videoHtml = '';
          if (item.url.indexOf('youtube.com') !== -1 || item.url.indexOf('youtu.be') !== -1) {
            var vid = '';
            if (item.url.indexOf('youtu.be/') !== -1) vid = item.url.split('youtu.be/')[1].split(/[?#&]/)[0];
            else if (item.url.indexOf('watch?v=') !== -1) vid = item.url.split('watch?v=')[1].split(/[?#&]/)[0];
            else if (item.url.indexOf('embed/') !== -1) vid = item.url.split('embed/')[1].split(/[?#&]/)[0];
            videoHtml = '<iframe id="mainProductVideo" width="100%" height="100%" src="https://www.youtube.com/embed/' + vid + '?autoplay=1&mute=1&loop=1&playlist=' + vid + '" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="position:absolute; inset:0; width:100%; height:100%;"></iframe>';
          } else if (item.url.indexOf('vimeo.com') !== -1) {
            var vid = item.url.split('/').pop().split(/[?#&]/)[0];
            videoHtml = '<iframe id="mainProductVideo" src="https://player.vimeo.com/video/' + vid + '?autoplay=1&muted=1&loop=1" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="position:absolute; inset:0; width:100%; height:100%;"></iframe>';
          } else {
            videoHtml = '<div class="custom-video-wrapper">' +
              '<div onclick="window.toggleCustomVideo(this.parentNode)" style="width:100%; height:100%; cursor:pointer; position:relative;">' +
                '<video id="mainProductVideo" class="custom-video-player" src="' + item.url + '" autoplay muted loop playsinline controlsList="nodownload" oncontextmenu="return false;" ontimeupdate="window.updateVideoProgress(this)"></video>' +
                '<div class="video-overlay">' +
                  '<div class="play-pause-btn"><i class="fas fa-play"></i></div>' +
                '</div>' +
              '</div>' +
              '<div class="fullscreen-btn" onclick="window.toggleFullscreen(this.parentNode.querySelector(&quot;video&quot;))" title="تكبير">' +
                '<i class="fas fa-expand"></i>' +
              '</div>' +
              '<div class="video-controls-bottom">' +
                '<div class="video-progress" id="videoProgressBar"></div>' +
              '</div>' +
            '</div>';
          }
          container.insertAdjacentHTML('afterbegin', videoHtml);
        } else {
          var imgHtml = '<img src="' + item.url + '" id="mainProductImg" class="product-main-img" style="width:100%; height:100%; object-fit:cover;">';
          container.insertAdjacentHTML('afterbegin', imgHtml);
        }

        document.querySelectorAll('.gallery-thumb').forEach(function(thumb, i) {
          if (i === index) {
            thumb.classList.add('selected-thumb');
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } else {
            thumb.classList.remove('selected-thumb');
          }
        });
      }

      window.setGalleryItem = setGalleryItem;

      window.changeGalleryImage = function(dir) {
        var nextIndex = currentItemIndex + dir;
        if (nextIndex < 0) nextIndex = galleryItems.length - 1;
        if (nextIndex >= galleryItems.length) nextIndex = 0;
        setGalleryItem(nextIndex);
      };

      window.toggleCustomVideo = function(wrapper) {
        var video = wrapper.querySelector('video');
        if (!video || !video.src) return;
        if (video.paused) { video.play().catch(function(){}); wrapper.classList.add('is-playing'); }
        else { video.pause(); wrapper.classList.remove('is-playing'); }
      };

      window.updateVideoProgress = function(video) {
        var progress = (video.currentTime / video.duration) * 100;
        var bar = document.getElementById('videoProgressBar');
        if (bar) bar.style.width = progress + '%';
      };

      window.toggleFullscreen = function(video) {
        if (!video) return;
        if (video.requestFullscreen) video.requestFullscreen();
        else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
        else if (video.msRequestFullscreen) video.msRequestFullscreen();
      };

      window.selectPill = function(el, optionName) {
        const pillsContainer = el.parentNode;
        Array.from(pillsContainer.children).forEach(function(p) { p.classList.remove('selected'); });
        el.classList.add('selected');
        pillsContainer.classList.remove('error-border');
        const errorMsg = pillsContainer.parentNode.querySelector('.option-error-msg');
        if (errorMsg) errorMsg.style.display = 'none';

        if (typeof updateVariantPriceAndImage === 'function') updateVariantPriceAndImage();
      };

      window.copyProductLink = function() {
        navigator.clipboard.writeText(window.location.href);
        if (window.showToast) showToast('تم نسخ رابط المنتج بنجاح! 🔗');
        else alert('تم نسخ رابط المنتج بنجاح!');
      };

      window.showQRCode = function() {
        var url = encodeURIComponent(window.location.href);
        document.getElementById('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + url;
        document.getElementById('qrOverlay').style.display = 'flex';
      };

      const videoEvents = ['play', 'pause'];
      videoEvents.forEach(evt => {
        document.addEventListener(evt, function(e) {
          if (e.target.classList.contains('custom-video-player')) {
            var wrapper = e.target.closest('.custom-video-wrapper');
            if (wrapper) {
              var icon = wrapper.querySelector('.play-pause-btn i');
              var overlay = wrapper.querySelector('.video-overlay');
              if (icon) icon.className = (evt === 'play') ? 'fas fa-pause' : 'fas fa-play';
              if (overlay) overlay.style.opacity = (evt === 'play') ? '0' : '1';
              if (evt === 'play') wrapper.classList.add('is-playing');
              else wrapper.classList.remove('is-playing');
            }
          }
        }, true);
      });

      const visitorsEl = document.getElementById('dynamicVisitors');
      if(visitorsEl) {
        setInterval(() => {
          let current = parseInt(visitorsEl.innerText);
          let change = Math.floor(Math.random() * 5) - 2;
          visitorsEl.innerText = Math.max(10, current + change);
        }, 4000);
      }

      let h = 2, m = 45, s = 18;
      const hEl = document.getElementById('timerH'), mEl = document.getElementById('timerM'), sEl = document.getElementById('timerS');
      if(hEl) {
        setInterval(() => {
          s--;
          if(s < 0) { s = 59; m--; }
          if(m < 0) { m = 59; h--; }
          if(h < 0) { h = 23; }
          hEl.innerText = String(h).padStart(2, '0');
          mEl.innerText = String(m).padStart(2, '0');
          sEl.innerText = String(s).padStart(2, '0');
        }, 1000);
      }

      const stockEl = document.getElementById('dynamicStock');
      const stockBar = document.getElementById('stockBar');
      if(stockEl) {
        setTimeout(() => {
          stockEl.innerText = "11";
          if (stockBar) stockBar.style.width = "78%";
        }, 10000);
      }

      window.productData = window.productData || {};
      window.productData[product.id] = {
        name: product.name,
        price: product.price,
        salePrice: product.salePrice || null,
        variants: product.variants || [],
        currency: currency,
        image: product.image,
        isComingSoon: isComingSoon
      };

      window.updateVariantPriceAndImage = function() {
        const data = window.productData[product.id];
        const selected = {};
        document.querySelectorAll(".option-pills").forEach(pills => {
          const name = pills.dataset.option;
          const selectedEl = pills.querySelector(".option-pill.selected");
          if(selectedEl) {
            const val = (selectedEl.innerText.trim() || selectedEl.getAttribute("title") || "").replace(" (نفدت)", "").replace(" ✕", "");
            if(name && val) selected[name] = val;
          }
        });
        const phone = localStorage.getItem("distributorPhone");
        let basePrice = data.price;
        let isWholesale = false;
        if (phone) {
          if (window.wholesalePrices && window.wholesalePrices[product.id]) {
            basePrice = parseFloat(window.wholesalePrices[product.id]);
            isWholesale = true;
          } else if (product.wholesalePrice && parseFloat(product.wholesalePrice) > 0) {
            basePrice = parseFloat(product.wholesalePrice);
            isWholesale = true;
          }
        }
        let finalPrice = basePrice;
        let hasFixedOverride = false;
        let targetImage = "";
        Object.entries(selected).forEach(([optName, optVal]) => {
          const option = data.variants.find(o => o.name === optName);
          if (option && option.values) {
            const valData = option.values.find(v => (typeof v === "object" ? v.value : v).trim() === optVal.trim());
            if (valData && typeof valData === "object") {
              const customPrice = (isWholesale && valData.wholesalePrice !== undefined && String(valData.wholesalePrice).trim() !== "") ? valData.wholesalePrice : valData.price;
              if (customPrice && String(customPrice).trim() !== "" && parseFloat(customPrice) !== 0) {
                const pr = String(customPrice).trim();
                if (pr.startsWith("+")) finalPrice = basePrice + (parseFloat(pr) || 0);
                else if (pr.startsWith("-")) finalPrice = basePrice - Math.abs(parseFloat(pr));
                else { finalPrice = parseFloat(pr); hasFixedOverride = true; }
              }
              if (valData.image) targetImage = valData.image;
            }
          }
        });
        const priceEl = document.querySelector(".product-price-large");
        const imgEl = document.getElementById("mainProductImg");
        if (!data.isComingSoon && priceEl) {
          if (isWholesale) {
            priceEl.innerHTML = `
              <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                <span style="font-size:12px; color:#10b981; font-weight:800; background:#10b98118; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;">
                  <i class="fas fa-tags" style="font-size:10px;"></i> سعر الجملة للتاجر
                </span>
                <div style="display:flex; align-items:baseline; gap:8px;">
                  <span style="color:#10b981; font-size:32px; font-weight:900;">${data.currency}${finalPrice.toFixed(2)}</span>
                  <span style="font-size:18px; font-weight:normal; color:var(--gray-400); text-decoration:line-through;">${data.currency}${data.price.toFixed(2)}</span>
                </div>
              </div>
            `;
          }
          else if (!hasFixedOverride && data.salePrice && data.salePrice > finalPrice) priceEl.innerHTML = data.currency + finalPrice.toFixed(2) + "<span class='old-price'>" + data.currency + data.salePrice.toFixed(2) + "</span>";
          else priceEl.innerHTML = data.currency + finalPrice.toFixed(2);
        }
        if (targetImage && imgEl) imgEl.src = targetImage;
        
        document.querySelectorAll(".buy-now-btn, .add-to-cart-btn").forEach(btn => {
          if (data.isComingSoon) { btn.onclick = null; return; }
          btn.onclick = () => {
            const pillsList = document.querySelectorAll(".option-pills");
            let firstMissing = null;
            pillsList.forEach(p => {
              const optName = p.dataset.option;
              const errorMsg = p.parentNode.querySelector(".option-error-msg");
              const hasSelectedPill = p.querySelector(".option-pill.selected");
              if (!hasSelectedPill) {
                p.classList.add("error-border");
                if (errorMsg) errorMsg.style.display = "block";
                if (!firstMissing) firstMissing = p;
              } else {
                p.classList.remove("error-border");
                if (errorMsg) errorMsg.style.display = "none";
              }
            });
            if (firstMissing) {
              firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            let suffix = ""; Object.entries(selected).forEach(([k, v]) => { suffix += " " + v; });
            const finalName = suffix.trim() ? data.name + " (" + suffix.trim() + ")" : data.name;
            
            if (btn.classList.contains("buy-now-btn")) {
              if (window.cart && typeof window.cart.add === 'function') {
                window.cart.add(String(product.id), finalName, finalPrice, targetImage || data.image);
              } else if (typeof addToCart === 'function') {
                addToCart(String(product.id), finalName, finalPrice, targetImage || data.image);
              }
              if (typeof openModal === "function") openModal("cartModal");
            } else {
              if (window.cart && typeof window.cart.add === 'function') {
                window.cart.add(String(product.id), finalName, finalPrice, targetImage || data.image);
              } else if (typeof addToCart === 'function') {
                addToCart(String(product.id), finalName, finalPrice, targetImage || data.image);
              }
              if (window.showToast) showToast('تمت الإضافة إلى السلة بنجاح! 🛍️');
            }
          };
        });
      };

      window.updateVariantPriceAndImage();
      setGalleryItem(0);
    })();

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
    if (footer) footer.style.display = 'block';
    window.scrollTo(0, 0);
  },

  _hideProductPage() {
    const page = document.getElementById('productPage');
    const reels = document.getElementById('reelsPage');
    const store = document.getElementById('publicMarketingContent');
    const main = document.querySelector('.main-container');
    const footer = document.querySelector('.main-footer');
    if (page) page.style.display = 'none';
    if (reels) { reels.style.display = 'none'; reels.innerHTML = ''; }
    if (store) store.style.display = 'block';
    if (main) main.style.display = '';
    if (footer) footer.style.display = 'block';
    if (window.location.hash && window.location.hash.indexOf('product=') !== -1) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo(0, 0);
  },

  // ── Reels Page ────────────────────────────────────────────────────────
  async _showReelsPage() {
    if (this.settings.reelsEnabled === false) { this._goHome(); return; }
    const page = document.getElementById('reelsPage');
    const store = document.getElementById('publicMarketingContent');
    const main = document.querySelector('.main-container');
    const footer = document.querySelector('.main-footer');
    if (!page) return;
    if (store) store.style.display = 'none';
    if (main) main.style.display = 'none';
    if (footer) footer.style.display = 'none';
    page.style.display = 'block';
    page.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;"><i class="fas fa-spinner fa-spin" style="font-size:32px;"></i></div>';
    window.scrollTo(0, 0);

    try {
      const [reels, products, settings] = await Promise.all([
        DB.getReels(),
        this.products && this.products.length ? Promise.resolve(this.products) : DB.getProducts(),
        this.settings && this.settings.currency ? Promise.resolve(this.settings) : DB.getSettings()
      ]);
      const currency = (settings && settings.currency) || '₪';
      const reelsList = reels || [];
      const productsList = products || [];

      if (!reelsList.length) {
        page.innerHTML = `
          <div class="reels-page-container">
            <a href="javascript:void(0)" class="reel-back-btn" onclick="StoreInit._goHome()"><i class="fa fa-arrow-right"></i></a>
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;color:rgba(255,255,255,0.5);text-align:center;">
              <i class="fa fa-video-slash" style="font-size:48px;margin-bottom:16px;"></i>
              <h3 style="margin:0 0 8px;">لا توجد فيديوهات ريلز حالياً</h3>
              <a href="javascript:void(0)" onclick="StoreInit._goHome()" style="color:var(--primary,#a855f7);text-decoration:none;font-weight:700;">العودة للمتجر</a>
            </div>
          </div>`;
        return;
      }

      const reelsShuffle = settings ? settings.reelsShuffle !== false : true;
      let displayReels = [...reelsList];
      if (reelsShuffle) {
        for (let i = displayReels.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [displayReels[i], displayReels[j]] = [displayReels[j], displayReels[i]];
        }
      }

      let html = '<div class="reels-page-container"><a href="javascript:void(0)" class="reel-back-btn" onclick="StoreInit._goHome()"><i class="fa fa-arrow-right"></i></a>';

      displayReels.forEach((reel) => {
        const product = productsList.find(p => String(p.id) === String(reel.productId));
        html += `
          <div class="reel-video-section" id="reel-${reel.id}">
            <video src="${reel.videoUrl}" muted playsinline class="reel-video-player"></video>
            <div class="reel-ui-overlay">
              <div class="reel-side-actions">
                <div class="action-item" onclick="window.toggleReelLike('${reel.id}')">
                  <i class="fa fa-heart"></i><span>أعجبني</span>
                </div>
                <div class="action-item" onclick="window.shareReel('${reel.id}')">
                  <i class="fa fa-share"></i><span>مشاركة</span>
                </div>
              </div>
              <div class="reel-bottom-info">
                <h3 class="reel-title">${reel.title || ''}</h3>
                ${product ? `
                  <div class="reel-product-card" onclick="StoreInit._showProductDetail('${product.id}')">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="product-details">
                      <div class="name">${product.name}</div>
                      <div class="price">${product.price} ${currency}</div>
                    </div>
                    <i class="fa fa-chevron-left"></i>
                  </div>` : ''}
              </div>
            </div>
            <div class="unmute-overlay" onclick="window.unmuteAllVideos(this)">
              <i class="fa fa-volume-mute"></i><span>انقر لتشغيل الصوت</span>
            </div>
            <div class="play-pause-indicator"><i class="fa fa-play"></i></div>
          </div>`;
      });

      html += `
          <div class="reels-navigation">
            <button class="nav-btn prev" onclick="window.scrollReel(-1)"><i class="fa fa-chevron-up"></i></button>
            <button class="nav-btn next" onclick="window.scrollReel(1)"><i class="fa fa-chevron-down"></i></button>
          </div>
        </div>`;

      page.innerHTML = html;

      // Mark all reels as seen so the "new reel" toast doesn't persist
      const allIds = displayReels.map(r => r.id);
      localStorage.setItem('seenReels', JSON.stringify(allIds));
      const toast = document.getElementById('newReelFloatingToast');
      if (toast) { toast.classList.remove('show'); toast.style.display = 'none'; }
      const notif = document.getElementById('reels-notification');
      if (notif) notif.style.display = 'none';

      if (window.initReelsPage) window.initReelsPage();

      const firstVideo = page.querySelector('.reel-video-player');
      if (firstVideo) firstVideo.play().catch(()=>{});

      const handleFirstInteraction = () => {
        page.querySelectorAll('.reel-video-player').forEach(v => { v.muted = false; v.play().catch(()=>{}); });
        document.removeEventListener('click', handleFirstInteraction, true);
        document.removeEventListener('touchstart', handleFirstInteraction, true);
      };
      document.addEventListener('click', handleFirstInteraction, true);
      document.addEventListener('touchstart', handleFirstInteraction, true);

    } catch(e) {
      console.error('Reels page error:', e);
      page.innerHTML = '<div class="reels-page-container"><div style="display:flex;align-items:center;justify-content:center;height:80vh;color:#ef4444;text-align:center;"><p>حدث خطأ أثناء تحميل الريلز</p></div></div>';
    }
  },

  // Go to the public store (used by logo / home navigation)
  _goHome() {
    const dash = document.getElementById('distDashboardSection');
    const dashVisible = dash && dash.style.display === 'block';
    if (dashVisible) {
      if (window.togglePublicStore) window.togglePublicStore(true);
    }
    // Remove custom page view if present
    const pageContainer = document.getElementById('customPageContainer');
    if (pageContainer) {
      const store = document.getElementById('publicMarketingContent');
      const main = document.querySelector('.main-container');
      const footer = document.querySelector('.main-footer');
      if (store) store.style.display = '';
      if (main) main.style.display = '';
      if (footer) footer.style.display = 'block';
      pageContainer.remove();
    }
    // Remove ?page= from the URL
    if (window.location.search.match(/[?&]page=/)) {
      const url = window.location.pathname + (window.location.hash || '');
      window.history.replaceState(null, '', url);
    }
    if (window.location.hash) {
      window.location.hash = '';
    } else {
      this._filterByCategory('all');
      this._hideProductPage();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async _showPage(slug) {
    console.log('🔍 _showPage called with slug:', slug);
    // Close product detail overlay if open
    this._hideProductPage();
    const store = document.getElementById('publicMarketingContent');
    const main = document.querySelector('.main-container');
    const footer = document.querySelector('.main-footer');
    if (store) store.style.display = 'none';
    if (main) main.style.display = 'none';
    if (footer) footer.style.display = 'none';

    const old = document.getElementById('customPageContainer');
    if (old) old.remove();

    try {
      const { data } = await DB.supabase.from('pages').select('*').eq('slug', slug).eq('status', 'public').single();
      if (!data) { this._goHome(); return; }
      const container = document.createElement('div');
      container.id = 'customPageContainer';
      container.innerHTML = `
        <style>
          .page-view {
            max-width:900px;margin:100px auto 40px;padding:0 20px;direction:rtl;text-align:right;
          }
          .page-view .back-link {
            display:inline-flex;align-items:center;gap:8px;padding:10px 20px;
            background:var(--primary-light);color:var(--primary);text-decoration:none;
            border-radius:12px;font-weight:700;font-size:14px;margin-bottom:30px;transition:0.2s;
          }
          .page-view .back-link:hover { background:var(--primary);color:white; }
          .page-view .page-card {
            background:#fff;border-radius:24px;padding:50px;box-shadow:0 10px 30px rgba(0,0,0,0.06);
            border:1px solid #f1f5f9;
          }
          .page-view .page-header {
            text-align:center;margin-bottom:40px;padding-bottom:30px;
            border-bottom:2px dashed #f1f5f9;
          }
          .page-view h1 { font-size:36px;font-weight:900;color:#1e293b;margin-bottom:15px; }
          .page-view .page-meta { font-size:14px;color:#64748b;display:flex;justify-content:center;gap:20px; }
          .page-view .content-area { font-size:17px;color:#334155;line-height:1.9; }
          .page-view .content-area p { margin-bottom:20px; }
          .page-view .content-area h2,.page-view .content-area h3 { margin:35px 0 20px;color:#1e293b; }
          @media (max-width:640px) {
            .page-view .page-card { padding:30px 20px; }
            .page-view h1 { font-size:28px; }
          }
        </style>
        <div class="page-view">
          <a href="#" onclick="StoreInit._goHome();return false;" class="back-link"><i class="fas fa-arrow-right"></i> العودة للمتجر</a>
          <article class="page-card">
            <div class="page-header">
              <h1>${data.title}</h1>
              <div class="page-meta">
                <span><i class="far fa-calendar-alt"></i> آخر تحديث: ${new Date(data.updated_at || data.created_at).toLocaleDateString('ar-SA', {year:'numeric',month:'long',day:'numeric'})}</span>
              </div>
            </div>
            <div class="content-area">${data.content || ''}</div>
          </article>
        </div>
      `;
      document.body.appendChild(container);
      window.scrollTo(0, 0);
    } catch(e) {
      console.error('Page load error:', e);
      this._goHome();
    }
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

    let distPrice = null;
    const distPhone = localStorage.getItem('distributorPhone');
    const distId = localStorage.getItem('distributorId');
    if (distPhone && distId) {
      if (window.wholesalePrices && window.wholesalePrices[product.id]) {
        distPrice = parseFloat(window.wholesalePrices[product.id]);
      } else if (product.wholesalePrice && parseFloat(product.wholesalePrice) > 0) {
        distPrice = parseFloat(product.wholesalePrice);
      }
    }
    const item = {
      id: productId,
      name: product.name + optionString,
      price: distPrice || parseFloat(product.price),
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
    const logoOnly = this.settings.logoOnly === true || this.settings.logoOnly === 'true';
    let logoHTML;
    if (logo && logoOnly) {
      logoHTML = `<img src="${logo}" alt="${storeName}" style="max-height:40px;max-width:100%;object-fit:contain;">`;
    } else if (logo && !logoOnly) {
      logoHTML = `<img src="${logo}" alt="${storeName}" style="max-height:40px;max-width:100%;object-fit:contain;"> <span style="font-weight:800;font-size:18px;color:var(--text,#1e293b);">${storeName}</span>`;
    } else {
      logoHTML = `<i class="fa fa-gem"></i> ${storeName}`;
    }

    const headerLogo = document.querySelector('a.logo');
    if (headerLogo) headerLogo.innerHTML = logoHTML;

    const footerLogo = document.querySelector('.footer-logo');
    if (footerLogo) {
      let footerLogoHTML;
      if (logo && logoOnly) {
        footerLogoHTML = `<img src="${logo}" alt="${storeName}" style="max-height:50px;max-width:100%;object-fit:contain;">`;
      } else if (logo && !logoOnly) {
        footerLogoHTML = `<img src="${logo}" alt="${storeName}" style="max-height:50px;max-width:100%;object-fit:contain;"> <span style="font-weight:800;font-size:20px;color:#fff;">${storeName}</span>`;
      } else {
        footerLogoHTML = `<i class="fa fa-gem"></i> ${storeName}`;
      }
      footerLogo.innerHTML = footerLogoHTML;
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
    if (this.settings.tiktokUrl) html += `<a href="${this.settings.tiktokUrl}" target="_blank"><i class="fab fa-tiktok"></i></a>`;
    if (this.settings.whatsappUrl) html += `<a href="https://wa.me/${this.settings.whatsappUrl}" target="_blank"><i class="fab fa-whatsapp"></i></a>`;

    const socialsDiv = container.querySelector('.socials') || container;
    if (html) {
      socialsDiv.innerHTML = `<div class="socials">${html}</div>`;
    }
  },

  // ── Footer ──────────────────────────────────────────────────────────────────

  _renderFooter() {
    const s = this.settings;
    const copyrightEl = document.querySelector('.main-footer div div:last-child');
    if (copyrightEl) {
      copyrightEl.innerHTML = `جميع الحقوق محفوظة &copy; ${s.storeName || 'المتجر'}`;
    }
    const socialsEl = document.querySelector('.main-footer .socials');
    if (socialsEl) {
      let html = '';
      if (s.instagramUrl) html += `<a href="${s.instagramUrl}" target="_blank" style="color:inherit; margin:0 8px;"><i class="fab fa-instagram"></i></a>`;
      if (s.facebookUrl) html += `<a href="${s.facebookUrl}" target="_blank" style="color:inherit; margin:0 8px;"><i class="fab fa-facebook"></i></a>`;
      if (s.snapchatUrl) html += `<a href="${s.snapchatUrl}" target="_blank" style="color:inherit; margin:0 8px;"><i class="fab fa-snapchat"></i></a>`;
      if (s.tiktokUrl) html += `<a href="${s.tiktokUrl}" target="_blank" style="color:inherit; margin:0 8px;"><i class="fab fa-tiktok"></i></a>`;
      if (html) {
        socialsEl.innerHTML = html;
      } else {
        const section = document.getElementById('footerSocialsSection');
        if (section) section.style.display = 'none';
      }
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
    if (String(this.settings.showPwaBanner) === 'false') return;
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
    if (String(this.settings.showWhatsappBubble) === 'false' || !this.settings.whatsappUrl) return;
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
    console.log('🔍 _renderWelcomePopup fired', 'popupEnabled:', this.settings.popupEnabled, 'popups:', this.settings.popups);
    if (this.settings.popupEnabled !== true && this.settings.popupEnabled !== 'true') {
      console.log('🔍 popup skipped: popupEnabled not true');
      return;
    }

    let popups = this.settings.popups || this.settings.popups_json || [];
    if (typeof popups === 'string') {
      try { popups = JSON.parse(popups); } catch (e) { popups = []; }
    }
    // If it's still an object (already parsed), keep as is
    if (!Array.isArray(popups)) popups = [];

    console.log('🔍 popups array:', JSON.stringify(popups).substring(0, 200));

    const activePopups = popups.filter(p => p.active !== false);
    console.log('🔍 activePopups:', activePopups.length);
    if (activePopups.length === 0) {
      console.log('🔍 popup skipped: no active popups');
      return;
    }

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
            ${pData.showTimer ? `
            <div id="popupTimer_${pId}" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;direction:ltr;">
              <span style="font-size:12px;font-weight:700;color:#ef4444;"><i class="fas fa-clock"></i> العرض ينتهي خلال:</span>
              <span id="timerDisplay_${pId}" style="font-size:24px;font-weight:900;font-family:monospace;color:#ef4444;background:#fee2e2;padding:4px 12px;border-radius:8px;">${String(Math.floor((pData.timerMinutes || 10) * 60 / 60)).padStart(2,'0')}:${String((pData.timerMinutes || 10) * 60 % 60).padStart(2,'0')}</span>
            </div>
            ` : ''}
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
    console.log('🔍 popup HTML injected into body');

    const showOn = pData.showOn || 'load';
    const delay = (pData.delay || 2) * 1000;

    setTimeout(() => {
      const el = document.getElementById('welcomePopup');
      console.log('🔍 setTimeout fired, welcomePopup element:', el);
      if (!el) return;

      if (showOn === 'load') {
        console.log('🔍 showing popup (load)');
        el.style.display = 'flex';
        // Start countdown timer if enabled
        if (pData.showTimer) {
          const totalSec = (pData.timerMinutes || 10) * 60;
          const display = document.getElementById('timerDisplay_' + pId);
          if (display) {
            let remaining = totalSec;
            const interval = setInterval(() => {
              remaining--;
              if (remaining <= 0) { clearInterval(interval); display.textContent = '00:00'; return; }
              const m = Math.floor(remaining / 60);
              const s = remaining % 60;
              display.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
            }, 1000);
          }
        }
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
      isBrand: c.is_brand || false,
      priority: c.priority || 0
    }));
    this.categories.sort((a, b) => (a.priority || 0) - (b.priority || 0));
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
    parents.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    let html = '';

    parents.forEach(p => {
      const subs = filtered.filter(c => c.parentId === p.id);
      subs.sort((a, b) => (a.priority || 0) - (b.priority || 0));
      const isFaIcon = p.icon && p.icon.startsWith('fa-');
      const bxSize = forModal ? 42 : 24;
      const bxFont = forModal ? 24 : 16;
      const img = isFaIcon
        ? `<i class="fas ${p.icon}" style="font-size:${bxFont}px;color:var(--primary);width:${bxSize}px;height:${bxSize}px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"></i>`
        : (p.icon || p.image
          ? `<div style="width:${bxSize}px;height:${bxSize}px;flex-shrink:0;position:relative;border-radius:50%;overflow:hidden;"><img src="${p.icon || p.image}" onerror="this.style.display='none';this.parentNode.querySelector('.fallback').style.display='flex'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"><div class="fallback" style="display:none;width:100%;height:100%;border-radius:50%;background:var(--primary-light);align-items:center;justify-content:center;"><i class="fas fa-tag" style="font-size:${bxFont}px;color:var(--primary);"></i></div></div>`
          : (forModal ? '<span style="font-size:24px;">🏷️</span>' : ''));

      if (forModal) {
        // Flat brand items for modal grid
        html += `<a href="#?cat=${p.id}" onclick="StoreInit._filterByCategory('${p.id}');closeModal('categoriesModal')" class="brand-modal-item">
          ${img || '<span style="font-size:24px;">🏷️</span>'}
          <span>${p.name}</span>
        </a>`;
      } else {
        // Sidebar category with subcategory popup
        html += `<div class="cat-group">
          <a href="#?cat=${p.id}" onclick="StoreInit._filterByCategory('${p.id}');closeModal('categoriesModal')" class="cat-item" style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px;padding:10px 12px;border-radius:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${img}
              <span style="font-size:15px;font-weight:700;">${p.name}</span>
            </div>
            ${subs.length > 0 ? '<i class="fa fa-chevron-left cat-chevron" style="font-size:12px;"></i>' : ''}
          </a>`;

        if (subs.length > 0) {
          html += `<div class="subcat-wrapper"><div class="subcat-sidebar-list">`;
          subs.forEach(sc => {
            const isFaSub = sc.icon && sc.icon.startsWith('fa-');
            const subImg = isFaSub
              ? `<i class="fas ${sc.icon}" style="font-size:14px;color:var(--primary);width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"></i>`
              : (sc.icon || sc.image
                ? `<div style="width:20px;height:20px;flex-shrink:0;position:relative;border-radius:50%;overflow:hidden;"><img src="${sc.icon || sc.image}" onerror="this.style.display='none';this.parentNode.querySelector('.fallback').style.display='flex'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"><div class="fallback" style="display:none;width:100%;height:100%;border-radius:50%;background:var(--primary-light);align-items:center;justify-content:center;"><i class="fas fa-folder-open" style="font-size:12px;color:var(--primary);"></i></div></div>`
                : '');
            html += `<a href="#?cat=${sc.id}" onclick="StoreInit._filterByCategory('${sc.id}');closeModal('categoriesModal')" class="cat-item" style="font-size:13px;padding:8px 12px;display:flex;align-items:center;width:100%;gap:10px;font-weight:600;">
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
    const mainContainer = document.querySelector('.main-container');
    if (String(this.settings.showSidebarFilter) === 'false') {
      if (mainContainer) mainContainer.classList.add('no-sidebar');
      return;
    }
    if (String(this.settings.showSidebarSections) === 'false') {
      if (mainContainer) mainContainer.classList.add('no-sidebar');
      return;
    }
    if (mainContainer) mainContainer.classList.remove('no-sidebar');

    const sidebarEl = document.querySelector('.main-container');
    if (!sidebarEl) return;

    const normalCats = this._buildCatsHTML(false);
    const brandsCats = this._buildCatsHTML(true);
    const brandsTitle = this.settings.brandsTitle || 'العلامات التجارية';

    const showNewsletter = this.settings.showNewsletter !== 'false' && this.settings.showNewsletter !== false;
    const newsletterTitle = this.settings.newsletterTitle || 'انضم لقائمتنا البريدية';
    const newsletterSubtitle = this.settings.newsletterSubtitle || 'احصل على خصم 10% على طلبك الأول عند الاشتراك!';
    const newsletterPlaceholder = this.settings.newsletterPlaceholder || 'بريدك الإلكتروني';
    const newsletterBtnText = this.settings.newsletterBtnText || 'اشترك الآن';

    const showTrustBadges = this.settings.showTrustBadges !== 'false' && this.settings.showTrustBadges !== false;
    let badgesList = [];
    if (this.settings.sidebar_badges_json) {
      try {
        badgesList = typeof this.settings.sidebar_badges_json === 'string'
          ? JSON.parse(this.settings.sidebar_badges_json)
          : this.settings.sidebar_badges_json;
      } catch(e) {
        badgesList = [];
      }
    }
    if (!Array.isArray(badgesList) || badgesList.length === 0) {
      badgesList = [
        { title: "تسوق آمن", desc: "بياناتك مشفرة ومحمية", icon: "fa-shield-check" },
        { title: "دعم 24/7", desc: "نحن هنا لمساعدتك دائماً", icon: "fa-headset" }
      ];
    }

    let customSectionsHTML = '';
    let sidebarSections = [];
    if (this.settings.sidebar_sections_json) {
      try {
        sidebarSections = typeof this.settings.sidebar_sections_json === 'string'
          ? JSON.parse(this.settings.sidebar_sections_json)
          : this.settings.sidebar_sections_json;
      } catch (e) {
        sidebarSections = [];
      }
    }

    if (Array.isArray(sidebarSections)) {
      const currency = this.settings.currency || '₪';
      sidebarSections.forEach(s => {
        if (s.type === 'text') {
          customSectionsHTML += `
            <div class="sidebar-card" style="text-align: center; margin-top:20px;">
              ${s.title ? `<h3 style="font-size:16px; font-weight:800; margin-bottom:8px; color:var(--dark);">${s.title}</h3>` : ''}
              ${s.subtitle ? `<p style="font-size:12px; color:var(--gray-600); margin:0;">${s.subtitle}</p>` : ''}
            </div>
          `;
        } else if (s.type === 'image' && s.image) {
          customSectionsHTML += `
            <div class="sidebar-card" style="padding:0; overflow:hidden; border-radius:12px; margin-top:20px;">
              ${s.link ? `<a href="${s.link}" style="display:block;">` : ''}
                <img src="${s.image}" style="width:100%; display:block; object-fit:cover;">
              ${s.link ? `</a>` : ''}
            </div>
          `;
        } else if (s.type === 'html' && s.html) {
          customSectionsHTML += `
            <div class="sidebar-card" style="padding:15px; margin-top:20px;">
              ${s.html}
            </div>
          `;
        } else if (s.type === 'products' && Array.isArray(s.productIds) && s.productIds.length > 0) {
          const matchedProds = this.products.filter(p => s.productIds.map(String).includes(String(p.id)) && !this._isComingSoon(p));
          if (matchedProds.length > 0) {
            customSectionsHTML += `
              <div class="sidebar-card" style="margin-top:20px;">
                ${s.title ? `<h3 class="sidebar-title" style="margin-bottom:15px;"><i class="fa fa-boxes"></i> ${s.title}</h3>` : s.type === 'products' ? `<h3 class="sidebar-title" style="margin-bottom:15px;"><i class="fa fa-boxes"></i> منتجات مميزة</h3>` : ''}
                <div style="display:flex; flex-direction:column; gap:12px;">
                  ${matchedProds.map(p => {
                    const price = parseFloat(p.price);
                    const originalPrice = parseFloat(p.sale_price);
                    const isOutOfStock = p.quantity <= 0;
                    return `
                      <a href="#?product=${p.id}" style="display:flex; gap:10px; align-items:center; text-decoration:none; color:inherit;">
                        <img src="${p.image}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                        <div style="flex:1; min-width:0;">
                          <div style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                          <div style="font-size:12px; color:var(--primary); font-weight:800; margin-top:2px;">
                            ${isOutOfStock ? '<span style="color:#ef4444;">نفدت</span>' : `${currency}${price.toFixed(2)}`}
                          </div>
                        </div>
                      </a>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }
        }
      });
    }

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
      ${showNewsletter ? `
      <div class="sidebar-card" style="background:var(--primary);color:var(--white);border:none;margin-top:20px;">
        <h3 style="margin-bottom:10px;">${newsletterTitle}</h3>
        <p style="font-size:13px;margin-bottom:15px;opacity:0.9;">${newsletterSubtitle}</p>
        <input type="email" placeholder="${newsletterPlaceholder}" style="width:100%;padding:10px;border-radius:8px;border:none;margin-bottom:10px;">
        <button style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--dark);color:var(--white);font-weight:bold;cursor:pointer;">${newsletterBtnText}</button>
      </div>` : ''}
      ${showTrustBadges ? `
      <div class="sidebar-card" style="display:flex; flex-direction:column; gap:15px;">
        ${badgesList.map(badge => `
        <div style="display:flex;gap:15px;align-items:center;">
          <i class="fa ${badge.icon || 'fa-certificate'}" style="font-size:30px;color:var(--primary);width:35px;text-align:center;"></i>
          <div>
            <div style="font-weight:800;">${badge.title || ''}</div>
            <div style="font-size:12px;color:var(--gray-600);">${badge.desc || ''}</div>
          </div>
        </div>
        `).join('')}
      </div>` : ''}
      ${customSectionsHTML}`;

    sidebarEl.insertBefore(sidebar, sidebarEl.querySelector('main'));
  },

  async _renderCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    if (!modal) return;

    const normalCats = this._buildCatsHTML(false, false);
    const catsList = modal.querySelector('.cats-mobile-list');
    if (catsList) catsList.innerHTML = normalCats;

    // Setup click handlers for category expand/collapse
    this._setupCategoryToggle(modal);

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

  _setupCategoryToggle(modal) {
    modal.querySelectorAll('.cat-group > .cat-item').forEach(item => {
      item.onclick = (e) => {
        e.preventDefault();
        const group = item.closest('.cat-group');
        const wrapper = group?.querySelector('.subcat-wrapper');
        const chevron = item.querySelector('.cat-chevron');
        if (wrapper) {
          const isOpen = wrapper.style.display !== 'none';
          wrapper.style.display = isOpen ? 'none' : 'flex';
          if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
          item.classList.toggle('active', !isOpen);
        }
        // Still allow navigation if no subcategories
        if (!wrapper && item.href) {
          window.location.href = item.href;
        }
      };
    });
  },

  _setupCategoryIndicators(modal) {
    const list = modal.querySelector('.cats-mobile-list');
    const indicators = modal.querySelector('.cats-mobile-indicators');
    if (!list || !indicators) return;

    const groups = list.querySelectorAll('.cat-group');
    const totalGroups = groups.length;
    if (totalGroups <= 3) { indicators.innerHTML = ''; return; }

    const pages = Math.ceil(totalGroups / 3);
    indicators.innerHTML = Array.from({ length: pages }, (_, i) => 
      `<span${i === 0 ? ' class="active"' : ''}></span>`
    ).join('');

    const updateIndicators = () => {
      const scrollLeft = list.scrollLeft;
      const itemWidth = list.clientWidth;
      const currentPage = Math.round(scrollLeft / itemWidth);
      indicators.querySelectorAll('span').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentPage);
      });
    };

    list.addEventListener('scroll', updateIndicators, { passive: true });
    modal.addEventListener('transitionend', updateIndicators);
    // Also update when modal opens
    updateIndicators();
  },

  _setupCatSectionIndicators() {
    const grids = document.querySelectorAll('.cat-section-grid');
    grids.forEach(grid => {
      const indicators = grid.parentElement?.querySelector('.cat-section-indicators');
      if (!indicators) return;
      const items = grid.querySelectorAll('a');
      const totalItems = items.length;
      if (totalItems <= 3) { indicators.innerHTML = ''; return; }
      const pages = Math.ceil(totalItems / 3);
      indicators.innerHTML = Array.from({ length: pages }, (_, i) => 
        `<span${i === 0 ? ' class="active"' : ''}></span>`
      ).join('');
      const updateIndicators = () => {
        const scrollLeft = grid.scrollLeft;
        const itemWidth = grid.clientWidth;
        const currentPage = Math.round(scrollLeft / itemWidth);
        indicators.querySelectorAll('span').forEach((dot, i) => {
          dot.classList.toggle('active', i === currentPage);
        });
      };
      grid.addEventListener('scroll', updateIndicators, { passive: true });
      updateIndicators();
    });
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
    const heroType = this.settings.heroType || (String(this.settings.showSlider) === 'false' ? 'none' : 'slider');
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
    this.products = await DB.getProducts();
  },

  async _loadActivePromotions() {
    try {
      const { data } = await DB.supabase.from('promotions').select('*');
      console.log('🔍 All promotions from DB:', data?.length, data?.map(p => ({ id: p.id, name: p.occasion_name, start: p.start_date, end: p.end_date, all: p.all_products })));
      const now = new Date();
      this.activePromotions = (data || []).filter(p => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return now >= start && now <= end;
      });
      console.log('🔍 Active promotions:', this.activePromotions.length);
    } catch (e) {
      console.error('Failed to load promotions', e);
      this.activePromotions = [];
    }
  },

  _renderProductsGrid() {
    const container = document.getElementById('publicMarketingContent');
    if (!container) return;

    const currency = this.settings.currency || '₪';
    const visibleProducts = this.products.filter(p => {
      if (p.advanced && p.advanced.hiddenProduct) return false;
      return true;
    });

    const productsHTML = visibleProducts.map(p => this._productCardHTML(p)).join('');

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

  _filterByCategory(catId, sortVal = 'default') {
    this.activeCategory = catId;
    this.activeSort = sortVal;

    if (catId === 'all') {
      const homeWrap = document.getElementById('homeSectionsWrap');
      if (homeWrap) homeWrap.style.display = 'block';
      const grid = document.getElementById('storeProductsGrid');
      if (grid) grid.style.display = 'none';
      const catPageWrap = document.getElementById('categoryPageWrap');
      if (catPageWrap) catPageWrap.style.display = 'none';
      const footer = document.querySelector('.main-footer');
      if (footer) footer.style.display = 'block';
      const main = document.querySelector('.main-container');
      if (main) main.style.display = '';

      this._renderHomeSections();
      this._highlightActiveCategory('all');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const homeWrap = document.getElementById('homeSectionsWrap');
    if (homeWrap) homeWrap.style.display = 'none';

    const isRecommendedView = catId === 'recommended';
    const catObj = isRecommendedView 
      ? { name: 'منتجات موصى بها ⭐', description: 'أفضل الخيارات والمنتجات التي نوصي بها لعملائنا' }
      : (this.categories ? this.categories.find(c => String(c.id) === String(catId)) : null);
    const parentObj = catObj && catObj.parentId ? this.categories.find(c => String(c.id) === String(catObj.parentId)) : null;

    let visibleProducts = this.products.filter(p => {
      if (p.advanced && p.advanced.hiddenProduct) return false;
      if (isRecommendedView) {
        return p.advanced && p.advanced.isRecommended;
      }
      const cats = Array.isArray(p.categories) ? p.categories.map(String) : (p.category ? [String(p.category)] : []);
      return cats.includes(String(catId));
    });

    if (sortVal === 'price_asc') {
      visibleProducts.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortVal === 'price_desc') {
      visibleProducts.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortVal === 'id_desc') {
      visibleProducts.sort((a, b) => Number(b.id) - Number(a.id));
    } else if (sortVal === 'id_asc') {
      visibleProducts.sort((a, b) => Number(a.id) - Number(b.id));
    } else if (sortVal === 'title_asc') {
      visibleProducts.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    } else if (sortVal === 'title_desc') {
      visibleProducts.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'ar'));
    }

    const content = document.getElementById('publicMarketingContent');
    if (!content) return;

    let catPageWrap = document.getElementById('categoryPageWrap');
    if (!catPageWrap) {
      catPageWrap = document.createElement('div');
      catPageWrap.id = 'categoryPageWrap';
      content.appendChild(catPageWrap);
    }
    catPageWrap.style.display = 'block';

    const grid = document.getElementById('storeProductsGrid');
    if (grid) grid.style.display = 'none';

    let breadcrumbsHTML = `
      <nav class="breadcrumbs" style="margin-bottom:20px; font-size:13px; font-weight:700; color:var(--gray-600); display:flex; align-items:center; gap:8px;">
          <a href="#?cat=all" onclick="StoreInit._filterByCategory('all')" style="color:inherit; text-decoration:none;">الرئيسية</a>
          <i class="fa fa-chevron-left" style="font-size:9px; opacity:0.5;"></i>
          <a href="#?cat=all" onclick="StoreInit._filterByCategory('all')" style="color:inherit; text-decoration:none;">كل المنتجات</a>
    `;
    if (parentObj) {
      breadcrumbsHTML += `
          <i class="fa fa-chevron-left" style="font-size:9px; opacity:0.5;"></i>
          <a href="#?cat=${parentObj.id}" onclick="StoreInit._filterByCategory('${parentObj.id}')" style="color:inherit; text-decoration:none;">${parentObj.name}</a>
      `;
    }
    breadcrumbsHTML += `
          <i class="fa fa-chevron-left" style="font-size:9px; opacity:0.5;"></i>
          <span class="current" style="color:var(--primary);">${catObj ? catObj.name : 'التصنيف'}</span>
      </nav>
    `;

    let categoryHeroHTML = '';
    const heroImage = catObj ? catObj.image : null;
    if (heroImage) {
      categoryHeroHTML = `
        <div class="category-hero" style="position:relative; width:100%; height:220px; border-radius:20px; overflow:hidden; margin-bottom:25px; box-shadow:var(--shadow-md); background:url('${heroImage}') no-repeat center center; background-size:cover;">
            <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 100%); display:flex; flex-direction:column; justify-content:flex-end; padding:25px; color:#fff;">
                <h1 style="font-weight:900; font-size:32px; margin:0 0 5px 0; text-shadow:0 2px 4px rgba(0,0,0,0.3); font-family:'Tajawal', sans-serif;">${catObj.name}</h1>
                ${catObj.description ? `<p style="font-size:14px; margin:0; opacity:0.9; text-shadow:0 1px 2px rgba(0,0,0,0.3); max-width:600px; font-family:'Tajawal', sans-serif;">${catObj.description}</p>` : ''}
            </div>
        </div>
      `;
    }

    const subcategories = this.categories ? this.categories.filter(c => String(c.parentId) === String(catId)) : [];
    let subcatsHTML = '';
    if (subcategories.length > 0) {
      subcatsHTML = `
        <div class="subcategories-bar" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:25px; padding:15px; background:var(--gray-50); border-radius:14px; border:1px solid var(--gray-200); align-items:center;">
            <span style="font-weight:800; color:var(--gray-600); display:flex; align-items:center; gap:6px; font-size:14px; margin-left:10px;"><i class="fa fa-sitemap"></i> الأقسام الفرعية:</span>
            ${subcategories.map(sc => `
                <a href="#?cat=${sc.id}" onclick="StoreInit._filterByCategory('${sc.id}')" style="text-decoration:none; padding:6px 14px; background:#fff; border:1px solid var(--gray-200); border-radius:30px; font-size:13px; font-weight:700; color:var(--dark); transition:all 0.2s ease; display:inline-flex; align-items:center; gap:8px; box-shadow:var(--shadow-sm);" onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--gray-200)'; this.style.transform='none';">
                    ${sc.icon && sc.icon.startsWith('fa-') ? `<i class="fas ${sc.icon}" style="font-size:14px;color:var(--primary);width:22px;height:22px;display:flex;align-items:center;justify-content:center;"></i>` : (sc.icon || sc.image ? `<div style="width:22px;height:22px;border-radius:50%;overflow:hidden;flex-shrink:0;position:relative;"><img src="${sc.icon || sc.image}" onerror="this.style.display='none';this.parentNode.querySelector('.fb').style.display='inline-flex'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"><i class="fb fas fa-folder-open" style="display:none;font-size:13px;color:var(--primary);width:22px;height:22px;align-items:center;justify-content:center;"></i></div>` : `<i class="fa fa-folder-open" style="font-size:13px; color:var(--primary);"></i>`)}
                    <span>${sc.name}</span>
                    <i class="fa fa-chevron-left" style="font-size:9px; opacity:0.4;"></i>
                </a>
            `).join('')}
        </div>
      `;
    }

    const sortHTML = `
      <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
          <h2 class="section-title" style="margin:0;">
              ${catObj ? catObj.name : 'التصنيف'}
              <span style="font-size:14px; font-weight:400; color:var(--gray-400); margin-right:8px;">(${visibleProducts.length} منتج)</span>
          </h2>
          <div class="sort-box">
              <select id="sort" style="padding:8px 15px; border-radius:8px; border:1px solid var(--gray-200); font-size:12px; font-weight:700; color:var(--gray-600); outline:none; cursor:pointer; background:var(--white);" onchange="StoreInit._filterByCategory('${catId}', this.value)">
                  <option value="default" ${this.activeSort === 'default' ? 'selected' : ''}>ترتيب افتراضي</option>
                  <option value="price_asc" ${this.activeSort === 'price_asc' ? 'selected' : ''}>ترتيب السعر الأقل</option>
                  <option value="price_desc" ${this.activeSort === 'price_desc' ? 'selected' : ''}>ترتيب السعر الأعلى</option>
                  <option value="id_desc" ${this.activeSort === 'id_desc' ? 'selected' : ''}>ترتيب الجديد أولاً</option>
                  <option value="id_asc" ${this.activeSort === 'id_asc' ? 'selected' : ''}>ترتيب القديم أولاً</option>
                  <option value="title_asc" ${this.activeSort === 'title_asc' ? 'selected' : ''}>ترتيب أبجدي أ-ي</option>
                  <option value="title_desc" ${this.activeSort === 'title_desc' ? 'selected' : ''}>ترتيب أبجدي ي-أ</option>
              </select>
          </div>
      </div>
    `;

    const productsHTML = visibleProducts.map(p => this._productCardHTML(p)).join('');
    const gridHTML = productsHTML 
      ? `<div class="product-grid" style="display:grid;">${productsHTML}</div>` 
      : `<div style="text-align:center; padding:40px; color:var(--gray-400);"><i class="fa fa-shopping-bag" style="font-size:48px; opacity:0.2; margin-bottom:15px; display:block;"></i> لا توجد منتجات في هذا التصنيف حالياً.</div>`;

    catPageWrap.innerHTML = breadcrumbsHTML + categoryHeroHTML + subcatsHTML + sortHTML + gridHTML;

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

  _buildVariantChipsHTML(p) {
    const chips = [];
    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
      p.variants.forEach(variant => {
        const type = variant.type || 'pills';
        const values = Array.isArray(variant.values) ? variant.values : [];
        if (type === 'swatch') {
          values.slice(0, 5).forEach(val => {
            const hex = (typeof val === 'object' ? val.color : null) || '#cbd5e1';
            const label = typeof val === 'object' ? val.value : val;
            const outOfStock = typeof val === 'object' && val.stock !== undefined && val.stock !== '' && parseInt(val.stock) === 0;
            let style = `display:inline-block; width:14px; height:14px; border-radius:50%; border:1.5px solid rgba(0,0,0,0.1); flex-shrink:0; position:relative;`;
            if (outOfStock) {
              style += `background: linear-gradient(45deg, transparent 42%, #ef4444 42%, #ef4444 58%, transparent 58%), ${hex}; opacity: 0.35; filter: grayscale(0.5);`;
            } else {
              style += `background:${hex};`;
            }
            chips.push(`<span title="${label}${outOfStock ? ' (نفدت)' : ''}" style="${style}"></span>`);
          });
        } else if (type === 'image') {
          values.slice(0, 4).forEach(val => {
            const img = typeof val === 'object' ? val.image : '';
            const label = typeof val === 'object' ? val.value : val;
            const outOfStock = typeof val === 'object' && val.stock !== undefined && val.stock !== '' && parseInt(val.stock) === 0;
            if (img) {
              let style = `width:16px; height:16px; border-radius:3px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;`;
              if (outOfStock) style += `opacity: 0.35; filter: grayscale(1);`;
              chips.push(`
                <span style="position:relative; display:inline-flex; width:16px; height:16px; vertical-align:middle; line-height:1;">
                  <img src="${img}" title="${label}${outOfStock ? ' (نفدت)' : ''}" style="${style}">
                  ${outOfStock ? `<span style="position:absolute; inset:0; background: linear-gradient(45deg, transparent 42%, #ef4444 42%, #ef4444 58%, transparent 58%); border-radius:3px; pointer-events:none;"></span>` : ''}
                </span>
              `);
            } else {
              let style = `font-size:9px; padding:2px 5px; border-radius:4px; flex-shrink:0;`;
              if (outOfStock) {
                style += `background:#f1f5f9; color:#94a3b8; border:1px dashed #cbd5e1; text-decoration:line-through; opacity:0.6;`;
              } else {
                style += `background:var(--gray-100); color:var(--gray-600); border:1px solid var(--gray-200);`;
              }
              chips.push(`<span style="${style}">${label}</span>`);
            }
          });
        } else {
          values.slice(0, 3).forEach(val => {
            const label = typeof val === 'object' ? val.value : val;
            const outOfStock = typeof val === 'object' && val.stock !== undefined && val.stock !== '' && parseInt(val.stock) === 0;
            let style = `font-size:9px; padding:2px 6px; border-radius:4px; font-weight:700; flex-shrink:0;`;
            if (outOfStock) {
              style += `background:#f1f5f9; color:#94a3b8; border:1px dashed #cbd5e1; text-decoration:line-through; opacity:0.6;`;
            } else {
              style += `background:var(--primary-light,#fff0f0); color:var(--primary); border:1px solid var(--primary-light,#fdd);`;
            }
            chips.push(`<span style="${style}" title="${label}${outOfStock ? ' (نفدت)' : ''}">${label}</span>`);
          });
        }
      });
    } else {
      if (p.colors && p.colors.length > 0) {
        p.colors.slice(0, 3).forEach(c => {
          chips.push(`<span style="font-size:9px; background:var(--gray-100); padding:2px 6px; border-radius:4px; color:var(--gray-600); border:1px solid var(--gray-200);">${c}</span>`);
        });
      }
      if (p.sizes && p.sizes.length > 0) {
        p.sizes.slice(0, 3).forEach(s => {
          chips.push(`<span style="font-size:9px; background:var(--primary-light,#fff0f0); padding:2px 6px; border-radius:4px; color:var(--primary); font-weight:700;">${s}</span>`);
        });
      }
    }
    if (chips.length === 0) return '<div style="height:22px;"></div>';
    return `<div style="display:flex; justify-content:center; align-items:center; gap:4px; margin-bottom:6px; min-height:22px; flex-wrap:nowrap; overflow:hidden;">${chips.join('')}</div>`;
  },

  _getQAOnClick(p) {
    let colors = p.colors ? p.colors.join(',') : '';
    let sizes = p.sizes ? p.sizes.join(',') : '';
    if (p.variants && Array.isArray(p.variants)) {
      const colorVar = p.variants.find(v => v.name.includes('اللون') || v.type === 'swatch' || v.name.toLowerCase().includes('color'));
      const sizeVar = p.variants.find(v => v.name.includes('المقاس') || v.type === 'pills' || v.name.toLowerCase().includes('size'));
      if (colorVar && colorVar.values) {
        colors = colorVar.values.map(v => (typeof v === 'object' ? v.value : v)).join(',');
      }
      if (sizeVar && sizeVar.values) {
        sizes = sizeVar.values.map(v => (typeof v === 'object' ? v.value : v)).join(',');
      }
      if (!colors && !sizes && p.variants.length > 0) {
        colors = p.variants[0].values.map(v => (typeof v === 'object' ? v.value : v)).join(',');
        if (p.variants[1]) {
          sizes = p.variants[1].values.map(v => (typeof v === 'object' ? v.value : v)).join(',');
        }
      }
    }
    const escapedName = p.name.replace(/'/g, "\\'");
    const distPhone = localStorage.getItem('distributorPhone');
    const distId = localStorage.getItem('distributorId');
    let wsPrice = null;
    if (distPhone && distId) {
      if (window.wholesalePrices && window.wholesalePrices[p.id]) {
        wsPrice = parseFloat(window.wholesalePrices[p.id]);
      } else if (p.wholesalePrice && parseFloat(p.wholesalePrice) > 0) {
        wsPrice = parseFloat(p.wholesalePrice);
      }
    }
    const price = wsPrice || p.price;
    return `openQuickAdd('${p.id}', '${escapedName}', ${price}, '${p.image}', '${colors}', '${sizes}')`;
  },

  _getPromoPrice(product) {
    if (!this.activePromotions || this.activePromotions.length === 0) return null;
    const promo = this.activePromotions[0];
    console.log('🔍 _getPromoPrice for', product.name, 'promo:', promo.occasion_name, promo.discount_type, promo.discount_value, 'all_products:', promo.all_products);
    const catIds = Array.isArray(product.categories) ? product.categories.map(String) : (product.category ? [String(product.category)] : []);
    const applies = promo.all_products ||
      (promo.product_ids && promo.product_ids.map(String).includes(String(product.id))) ||
      (promo.categories && promo.categories.some(c => catIds.includes(String(c))));
    if (!applies) { console.log('🔍 product does not apply'); return null; }
    if (promo.discount_type === 'percentage') {
      return parseFloat(product.price) * (1 - parseFloat(promo.discount_value) / 100);
    }
    return Math.max(0, parseFloat(product.price) - parseFloat(promo.discount_value));
  },

  _productCardHTML(p) {
    const currency = this.settings.currency || '₪';
    const isComingSoon = p.advanced && p.advanced.isComingSoon;
    const isOutOfStock = p.advanced && typeof p.advanced.stock === 'number' && p.advanced.stock === 0;
    const isNew = (Date.now() - parseInt(p.id)) < (48 * 60 * 60 * 1000);
    const pCatId = Array.isArray(p.categories) && p.categories.length > 0 ? p.categories[0] : (p.category || 'general');
    const catObj = this.categories ? this.categories.find(c => String(c.id) === String(pCatId)) : null;
    const categoryName = catObj ? catObj.name : '';

    // Calculate base price + promotion discount
    let originalPrice = p.salePrice && parseFloat(p.salePrice) > parseFloat(p.price) ? parseFloat(p.salePrice) : parseFloat(p.price);
    let currentPrice = parseFloat(p.price);
    let promoDiscount = 0;
    let promoLabel = '';

    const promoPrice = this._getPromoPrice(p);
    if (promoPrice !== null && promoPrice < parseFloat(p.price)) {
      currentPrice = promoPrice;
      promoDiscount = Math.round(((parseFloat(p.price) - currentPrice) / parseFloat(p.price)) * 100);
      promoLabel = this.activePromotions?.[0]?.occasion_emoji || '🔥';
      if (originalPrice <= currentPrice) originalPrice = parseFloat(p.price);
    }

    const hasPromo = promoDiscount > 0;
    let displayPrice = hasPromo ? currentPrice : parseFloat(p.price);
    let displayOriginal = hasPromo ? originalPrice : (p.salePrice && parseFloat(p.salePrice) > parseFloat(p.price) ? parseFloat(p.salePrice) : 0);
    const distPhone = localStorage.getItem('distributorPhone');
    const distId = localStorage.getItem('distributorId');
    let wsPrice = null;
    if (distPhone && distId) {
      if (window.wholesalePrices && window.wholesalePrices[p.id]) {
        wsPrice = parseFloat(window.wholesalePrices[p.id]);
      } else if (p.wholesalePrice && parseFloat(p.wholesalePrice) > 0) {
        wsPrice = parseFloat(p.wholesalePrice);
      }
    }
    if (wsPrice) {
      displayOriginal = displayPrice;
      displayPrice = wsPrice;
    }

    return `
      <div class="product-card" data-product-id="${p.id}" onclick="window.location.hash = '#?product=${p.id}'" style="cursor:pointer;">
        <span class="product-cat" style="padding: 8px 12px 0; text-align: center; display:block; font-size:12px; color:var(--gray-400); font-weight:700;">${categoryName}</span>
        <div class="product-img" style="position:relative;">
          ${hasPromo && !isComingSoon ? `<div class="discount-badge" style="position:absolute; top:10px; right:10px; background:#ef4444; color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:800; z-index:2;">${promoLabel} خصم ${promoDiscount}%</div>` : ''}
          ${isComingSoon ? '<div class="coming-badge" style="position:absolute; right:0; background:var(--gray-600); color:white; padding:4px 8px; border-radius:6px 0px 0px 6px; font-size:11px; font-weight:800; z-index:2;">قريباً</div>' : ''}
          ${isOutOfStock ? '<div class="out-of-stock-badge" style="position:absolute; top:10px; left:10px; background:#ef4444; color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:800; z-index:2;">نفدت الكمية</div>' : ''}
          ${isNew && !isComingSoon && !isOutOfStock ? '<div class="new-badge" style="position:absolute;top:10px;background:#3b82f6;color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:800;z-index:2;">جديد</div>' : ''}
          <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${displayPrice}, '${p.image}')" style="position:absolute; top:10px; right:10px; border:none; background:#fff; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:2; box-shadow:var(--shadow-sm);"><i class="fa fa-heart"></i></button>
          ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy" style="${(isComingSoon || isOutOfStock) ? 'filter: grayscale(0.5) opacity(0.8);' : ''}">` : '<div style="width:100%;height:200px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><i class="fa fa-image" style="font-size:40px;color:var(--gray-400);"></i></div>'}
        </div>
        <div class="product-info" style="display:flex; flex-direction:column; padding:15px; height:100%;">
          <h3 class="product-name" style="font-size:14px; font-weight:700; margin:0 0 8px 0; color:var(--dark); line-height:1.4;">${p.name}</h3>
          ${this._buildVariantChipsHTML(p)}
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; width:100%;">
            <div class="product-price" style="display:flex; align-items:center; gap:6px; ${wsPrice ? 'flex-direction:column; align-items:flex-start;' : ''}">
              ${isOutOfStock ? `<span style="color:#ef4444; font-weight:800; font-size:13px;">نفدت الكمية</span>` : wsPrice ? `
                <span style="font-size:10px; color:#10b981; font-weight:800; background:#10b98118; padding:2px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;"><i class="fas fa-tags" style="font-size:8px;"></i> جملة</span>
                <div style="display:flex; align-items:center; gap:6px;">
                  <span class="current-price" style="color:#10b981; font-weight:800; font-size:14px;">${currency}${displayPrice.toFixed(2)}</span>
                  <span class="old-price" style="text-decoration:line-through; color:var(--gray-400); font-size:11px; font-weight:700;">${currency}${displayOriginal.toFixed(2)}</span>
                </div>
              ` : `<span class="current-price" style="color:var(--primary); font-weight:800; font-size:16px;">${currency}${displayPrice.toFixed(2)}</span>
              ${displayOriginal > 0 && displayOriginal > displayPrice ? `<span class="old-price" style="text-decoration:line-through; color:var(--gray-400); font-size:12px; font-weight:700;">${currency}${displayOriginal.toFixed(2)}</span>` : ''}`}
            </div>
            ${isComingSoon || isOutOfStock ? `
              <button class="cart-icon-btn" disabled style="background:var(--gray-200); color:var(--gray-400); cursor:not-allowed; border:none; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-${isOutOfStock ? 'ban' : 'lock'}" style="font-size:14px;"></i></button>
            ` : `
              <button class="cart-icon-btn" onclick="event.stopPropagation(); ${this._getQAOnClick(p)}" title="إضافة للسلة" style="background:var(--primary-light); color:var(--primary); border:none; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:var(--transition);">
                <i class="fa fa-shopping-bag" style="font-size:14px;"></i>
              </button>
            `}
          </div>
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

    const renderHeaderRow = (title, icon, catId = null, label = 'عرض الكل') => {
      const iconHTML = icon ? `<i class="${icon}" style="color:var(--primary);"></i>` : '';
      const linkHTML = catId ? `<a href="#?cat=${catId}" onclick="StoreInit._filterByCategory('${catId}')" class="view-all" style="font-size:12px;font-weight:700;color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:4px;">${label} <i class="fa fa-chevron-left" style="font-size:9px;"></i></a>` : '';
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin:30px 0 15px; width:100%;">
          <h2 class="section-title" style="font-size:20px;font-weight:800;display:flex;align-items:center;gap:10px;margin:0;">${iconHTML}${title || ''}</h2>
          ${linkHTML}
        </div>
      `;
    };

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
        const totalCount = list.length;
        const displayLimit = s.limit ? parseInt(s.limit) : totalCount;
        if (s.limit) list = list.slice(0, s.limit);
        const showLink = totalCount > displayLimit;
        return list.length ? `<div style="margin:30px 0;">${renderHeaderRow(s.title || 'وصل حديثاً ✨', 'fas fa-clock', showLink ? 'all' : null)}${gridOf(list)}</div>` : '';
      }
      case 'coming_soon': {
        let list = visibleProducts.filter(p => this._isComingSoon(p));
        if (s.limit) list = list.slice(0, s.limit);
        return list.length ? `<div style="margin:30px 0;">${renderHeaderRow(s.title || 'قريباً متاح ⏳', 'fas fa-clock')}${gridOf(list)}</div>` : '';
      }
      case 'recommended_products': {
        let list = visibleProducts.filter(p => p.advanced && p.advanced.isRecommended && !this._isComingSoon(p));
        const totalCount = list.length;
        const displayLimit = s.limit ? parseInt(s.limit) : totalCount;
        if (s.limit) list = list.slice(0, s.limit);
        const showLink = totalCount > displayLimit;
        return list.length ? `<div style="margin:30px 0;">${renderHeaderRow(s.title || 'منتجات موصى بها ⭐', 'fas fa-star', showLink ? 'recommended' : null)}${gridOf(list)}</div>` : '';
      }
      case 'category_products': {
        if (!s.categoryId) return '';
        let list;
        if (s.categoryId === 'all') {
          list = visibleProducts.filter(p => !this._isComingSoon(p));
        } else {
          list = visibleProducts.filter(p => {
            const cats = Array.isArray(p.categories) ? p.categories : (p.category ? [String(p.category)] : []);
            return cats.map(String).includes(String(s.categoryId)) && !this._isComingSoon(p);
          });
        }
        const totalCount = list.length;
        const displayLimit = s.limit ? parseInt(s.limit) : totalCount;
        if (s.limit) list = list.slice(0, s.limit);
        const showLink = totalCount > displayLimit;
        if (!list.length) return `<div style="margin:30px 0;">${renderHeaderRow(s.title || 'منتجات القسم', 'fas fa-boxes')}<div style="text-align:center;padding:30px;color:var(--gray-400);"><i class="fas fa-box-open" style="font-size:36px;margin-bottom:10px;opacity:0.3;"></i><p style="font-weight:700;">لا توجد منتجات في هذا القسم حالياً</p></div></div>`;
        return `<div style="margin:30px 0;">${renderHeaderRow(s.title || 'منتجات القسم', 'fas fa-boxes', showLink ? s.categoryId : null)}${gridOf(list)}</div>`;
      }
      case 'winning_product': {
        const p = visibleProducts.find(x => String(x.id) === String(s.productId));
        return p ? `<div style="margin:30px 0;">${renderHeaderRow(s.title || '🔥 المنتج الرابح', 'fas fa-trophy')}${gridOf([p])}</div>` : '';
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
        return `<div style="margin:30px 0;">${renderHeaderRow(s.title || 'آراء زبائننا ⭐', 'fas fa-comments')}${s.subtitle ? `<p style="color:var(--gray-600);margin:5px 0 20px;">${s.subtitle}</p>` : ''}<div style="display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:10px;-webkit-overflow-scrolling:touch;">${reviews.map(r => `<div style="min-width:280px;max-width:320px;flex-shrink:0;scroll-snap-align:start;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">${r.avatar ? `<img src="${r.avatar}" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;">` : ''}<div style="display:flex;align-items:center;gap:8px;">${r.name ? `<div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;">${r.name.charAt(0)}</div>` : ''}<div><div style="font-weight:800;font-size:14px;">${r.name || ''}</div><div style="color:#fbbf24;font-size:14px;">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div></div></div><p style="margin:0;line-height:1.7;color:#475569;font-size:13px;">${r.text || ''}</p></div>`).join('')}</div></div>`;
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
        return `<div style="margin:30px 0;">${renderHeaderRow(s.title || 'أقسامنا', 'fas fa-tags')}${gridOf(list)}</div>`;
      }
      case 'logo_marquee': {
        const logos = s.logos || [];
        if (!logos.length) return '';
        return `<div style="margin:30px 0;background:${s.bgColor || '#fff'};border-radius:16px;padding:20px;display:flex;gap:20px;flex-wrap:wrap;justify-content:center;align-items:center;">${logos.map(l => `<img src="${l}" style="height:50px;object-fit:contain;">`).join('')}</div>`;
      }
      case 'categories': {
        const cats = this.categories || [];
        const selectedIds = s.categoryIds || [];
        let normalCats = cats.filter(c => !c.isBrand && (!c.parentId || !cats.some(x => x.id === c.parentId)));
        normalCats.sort((a, b) => (a.priority || 0) - (b.priority || 0));
        if (selectedIds.length) normalCats = normalCats.filter(c => selectedIds.includes(c.id));
        if (!normalCats.length) return '';
        const catStyle = s.catStyle || 'grid';
        const currency = this.settings.currency || '₪';
        const header = s.title ? `<div style="display:flex;justify-content:space-between;align-items:center;margin:30px 0 15px;width:100%;"><h2 class="section-title" style="font-size:20px;font-weight:800;display:flex;align-items:center;gap:10px;margin:0;"><i class="fas fa-folder-tree" style="color:var(--primary);"></i> ${s.title}</h2></div>` : '';
        const catIconHTML = (c, size = 60) => {
          const isFa = c.icon && c.icon.startsWith('fa-');
          if (isFa) return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;"><i class="fas ${c.icon}" style="font-size:${size * 0.4}px;color:var(--primary);"></i></div>`;
          if (c.icon || c.image) return `<div style="width:${size}px;height:${size}px;border-radius:50%;position:relative;"><img src="${c.icon || c.image}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"><div style="display:none;width:100%;height:100%;border-radius:50%;background:var(--primary-light);align-items:center;justify-content:center;"><i class="fas fa-tag" style="font-size:${size * 0.4}px;color:var(--primary);"></i></div></div>`;
          return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;"><i class="fas fa-tag" style="font-size:${size * 0.4}px;color:var(--primary);"></i></div>`;
        };
        if (catStyle === 'grid') {
          const catsHTML = normalCats.map(c => `<a href="#?cat=${c.id}" onclick="StoreInit._filterByCategory('${c.id}')" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 15px;background:#fff;border:1px solid var(--gray-200);border-radius:16px;text-decoration:none;color:inherit;transition:0.2s;box-shadow:var(--shadow-sm);">${catIconHTML(c, 60)}<span style="font-weight:700;font-size:13px;text-align:center;">${c.name}</span></a>`).join('');
          const html = `<div style="margin:30px 0;">${header}<div class="cat-section-grid">${catsHTML}</div><div class="cat-section-indicators" style="display:flex;justify-content:center;gap:6px;margin-top:8px;"></div></div>`;
          // Setup indicators after render
          setTimeout(() => this._setupCatSectionIndicators(), 0);
          return html;
        } else if (catStyle === 'list') {
          const catsHTML = normalCats.map(c => `<a href="#?cat=${c.id}" onclick="StoreInit._filterByCategory('${c.id}')" style="flex-shrink:0;scroll-snap-align:start;display:flex;flex-direction:column;align-items:center;gap:10px;min-width:120px;padding:15px 12px;background:#fff;border:1px solid var(--gray-200);border-radius:14px;text-decoration:none;color:inherit;">${catIconHTML(c, 50)}<span style="font-weight:700;font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${c.name}</span></a>`).join('');
          return `<div style="margin:30px 0;">${header}<div style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;-webkit-overflow-scrolling:touch;">${catsHTML}</div></div>`;
        } else if (catStyle === 'circles') {
          const catsHTML = normalCats.map(c => {
            const size = 80;
            const isFa = c.icon && c.icon.startsWith('fa-');
            const visual = isFa ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.08);"><i class="fas ${c.icon}" style="font-size:32px;"></i></div>` : (c.icon || c.image ? `<div style="width:${size}px;height:${size}px;border-radius:50%;position:relative;box-shadow:0 4px 12px rgba(0,0,0,0.08);"><img src="${c.icon || c.image}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;border:3px solid var(--gray-100);"><div style="display:none;width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));align-items:center;justify-content:center;"><i class="fas fa-tag" style="font-size:32px;color:#fff;"></i></div></div>` : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.08);"><i class="fas fa-tag" style="font-size:32px;"></i></div>`);
            return `<a href="#?cat=${c.id}" onclick="StoreInit._filterByCategory('${c.id}')" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:inherit;min-width:0;">${visual}<span style="font-weight:700;font-size:12px;text-align:center;">${c.name}</span></a>`;
          }).join('');
          return `<div style="margin:30px 0;">${header}<div style="display:flex;flex-wrap:wrap;gap:25px;justify-content:center;">${catsHTML}</div></div>`;
        } else if (catStyle === 'boxes') {
          const catsHTML = normalCats.map(c => {
            const colors = ['#f0fdf4,#22c55e', '#fef2f2,#ef4444', '#eff6ff,#3b82f6', '#fdf4ff,#a855f7', '#fefce8,#eab308', '#fff7ed,#f97316', '#f0f9ff,#0ea5e9', '#fdf2f8,#ec4899'];
            const ci = normalCats.indexOf(c) % colors.length;
            const [bg, border] = colors[ci].split(',');
            const isFa = c.icon && c.icon.startsWith('fa-');
            const visual = isFa ? `<div style="width:40px;height:40px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;"><i class="fas ${c.icon}" style="font-size:18px;color:${border};"></i></div>` : (c.icon || c.image ? `<div style="width:40px;height:40px;border-radius:10px;position:relative;"><img src="${c.icon || c.image}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:100%;height:100%;border-radius:10px;object-fit:cover;"><div style="display:none;width:100%;height:100%;border-radius:10px;background:#fff;align-items:center;justify-content:center;"><i class="fas fa-tag" style="font-size:18px;color:${border};"></i></div></div>` : `<div style="width:40px;height:40px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;"><i class="fas fa-tag" style="font-size:18px;color:${border};"></i></div>`);
            return `<a href="#?cat=${c.id}" onclick="StoreInit._filterByCategory('${c.id}')" style="display:flex;align-items:center;gap:12px;padding:16px;background:${bg};border-radius:14px;text-decoration:none;color:inherit;border:1px solid ${border}20;">${visual}<span style="font-weight:700;font-size:13px;color:${border};">${c.name}</span></a>`;
          }).join('');
          return `<div style="margin:30px 0;">${header}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">${catsHTML}</div></div>`;
        }
        return '';
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

// ─── Product Feed Handler (for Facebook/TikTok/Google catalogs) ───
(async function handleFeedRequest() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('app') !== 'products-feed') return;
    const platform = params.get('platform') || 'meta';
    const format = params.get('format') || 'xml';

    try {
        const { data: settingsRows } = await DB.supabase.from('settings').select('key, value');
        const s = {};
        if (settingsRows) settingsRows.forEach(r => { s[r.key] = r.value; });
        const storeName = s.storeName || 'Pro Store';
        const currency = s.currency || 'ILS';
        const { data: products } = await DB.supabase.from('products').select('*');
        const allProducts = (products || []).filter(p => !(p.advanced && p.advanced?.hiddenProduct));
        const baseUrl = window.location.origin;

        const escXml = v => String(v).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&apos;"}[c]));
        const escCsv = v => `"${String(v).replace(/"/g, '""')}"`;

        document.title = '';
        document.body.innerHTML = '';

        if (format === 'xml') {
            let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n<channel>\n<title>${escXml(storeName)}</title>\n<link>${baseUrl}</link>\n<description>Product feed for ${escXml(storeName)}</description>\n`;
            allProducts.forEach(p => {
                const link = `${baseUrl}/index.html#?product=${p.id}`;
                xml += `<item>\n<g:id>${escXml(p.id)}</g:id>\n<g:title>${escXml(p.name)}</g:title>\n<g:description>${escXml((p.description || '').replace(/<[^>]*>/g, '').substring(0, 5000))}</g:description>\n<g:link>${escXml(link)}</g:link>\n<g:image_link>${escXml(p.image || '')}</g:image_link>\n<g:availability>in stock</g:availability>\n<g:price>${p.price} ${currency}</g:price>${p.salePrice ? `\n<g:sale_price>${p.salePrice} ${currency}</g:sale_price>` : ''}\n<g:brand>${escXml(storeName)}</g:brand>\n<g:condition>new</g:condition>\n</item>\n`;
            });
            xml += `</channel>\n</rss>`;
            document.open('application/xml');
            document.write(xml);
            document.close();
        } else {
            let csv = '';
            if (platform === 'google') {
                csv = 'id,title,description,link,image_link,availability,price,brand,condition,google_product_category\n';
                allProducts.forEach(p => {
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, '').substring(0, 5000))},${baseUrl}/index.html#?product=${p.id},${p.image},in stock,${p.price} ${currency},"${escCsv(storeName)}",new,\n`;
                });
            } else if (platform === 'snapchat') {
                csv = 'id,title,description,link,image_link,availability,price,brand,condition,item_group_id\n';
                allProducts.forEach(p => {
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, '').substring(0, 500))},${baseUrl}/index.html#?product=${p.id},${p.image},in stock,${p.price} ${currency},"${escCsv(storeName)}",new,${p.category || 'all'}\n`;
                });
            } else if (platform === 'tiktok') {
                csv = 'sku_id,title,description,product_link,image_link,stock,price,sale_price,category_id\n';
                allProducts.forEach(p => {
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, ''))},${baseUrl}/index.html#?product=${p.id},${p.image},999,${p.price} ${currency},${p.salePrice || ''},${p.category || '0'}\n`;
                });
            } else {
                csv = 'id,title,description,link,image_link,availability,price,sale_price,brand,condition\n';
                allProducts.forEach(p => {
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, '').substring(0, 5000))},${baseUrl}/index.html#?product=${p.id},${p.image},in stock,${p.price} ${currency},${p.salePrice ? p.salePrice + ' ' + currency : ''},"${escCsv(storeName)}",new\n`;
                });
            }
            document.open('text/csv');
            document.write('\uFEFF' + csv);
            document.close();
        }
    } catch (e) {
        console.error('Feed handler error:', e);
        document.write('Feed generation failed: ' + e.message);
    }
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => StoreInit.init());

// React to hash changes (e.g. clicking a product link updates #?product=ID)
window.addEventListener('hashchange', () => StoreInit._handleHash());
