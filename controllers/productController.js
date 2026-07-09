const path = require('path');
const fs = require('fs');
const dbHelper = require('../utils/dbHelper');

// FCM: Read registered admin tokens and send push notification via internal API
function triggerFCMPush(order) {
    const fcmTokensPath = path.join(__dirname, '../data/fcm-tokens.json');
    if (!fs.existsSync(fcmTokensPath)) return;
    try {
        const http = require('http');
        const data = JSON.stringify({
            orderId: order.id,
            name: order.customer ? order.customer.name : '—',
            city: order.customer ? order.customer.city : '—',
            total: order.total
        });
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 3000,
            path: '/api/fcm/notify-new-order',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = http.request(options);
        req.on('error', (e) => console.error('FCM trigger error:', e.message));
        req.write(data);
        req.end();
    } catch (e) {
        console.error('FCM trigger exception:', e.message);
    }
}

// ── Helper: build variant chips HTML for product cards ──────────────────────
function buildVariantChipsHTML(p) {
    const chips = [];

    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach(variant => {
            const type = variant.type || 'pills';
            const values = Array.isArray(variant.values) ? variant.values : [];

            if (type === 'swatch') {
                // Color swatches: small circles
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
                // Image thumbnails: tiny squares
                values.slice(0, 4).forEach(val => {
                    const img = typeof val === 'object' ? val.image : '';
                    const label = typeof val === 'object' ? val.value : val;
                    const outOfStock = typeof val === 'object' && val.stock !== undefined && val.stock !== '' && parseInt(val.stock) === 0;

                    if (img) {
                        let style = `width:16px; height:16px; border-radius:3px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;`;
                        if (outOfStock) {
                            style += `opacity: 0.35; filter: grayscale(1);`;
                        }
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
                // Pills / dropdown: text chips
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
        // Legacy colors/sizes fallback
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
}

function getQAOnClick(p) {
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
        
        // If still empty but has variants, just take the first two variants as color/size placeholders
        if (!colors && !sizes && p.variants.length > 0) {
            colors = p.variants[0].values.map(v => (typeof v === 'object' ? v.value : v)).join(',');
            if (p.variants[1]) {
                sizes = p.variants[1].values.map(v => (typeof v === 'object' ? v.value : v)).join(',');
            }
        }
    }
    
    const escapedName = p.name.replace(/'/g, "\\'");
    return `event.stopPropagation(); openQuickAdd('${p.id}', '${escapedName}', ${p.price}, '${p.image}', '${colors}', '${sizes}')`;
}
// ── Helper: build category sidebar HTML (Sleek Tree with Optional Images) ──
function buildCatsHTML(categories, activeCatId, filterBrands = false) {
    let catsHTML = `
        <style>
            .cat-group {
                position: relative;
                border-radius: 8px;
                transition: background 0.3s ease, color 0.3s ease;
                margin-bottom: 4px;
            }
            .cat-group:hover, .cat-group:has(.active) {
                background: var(--primary-light);
            }
            .cat-group .cat-item {
                transition: color 0.3s ease;
            }
            .cat-group:hover > .cat-item, .cat-item.active {
                color: var(--primary) !important;
            }
            .cat-group .subcat-wrapper {
                position: absolute;
                top: 0;
                right: calc(100% + 5px);
                width: 230px;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                border: 1px solid var(--gray-200);
                opacity: 0;
                visibility: hidden;
                transform: translateX(15px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 5000;
                padding: 8px;
            }
            .cat-group:hover .subcat-wrapper {
                opacity: 1;
                visibility: visible;
                transform: translateX(0);
            }
            .cat-group .cat-chevron {
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 0.6;
            }
            .cat-group:hover .cat-chevron {
                transform: translateX(-3px);
                color: var(--primary);
                opacity: 1;
            }
            .subcat-sidebar-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .subcat-sidebar-list .cat-item {
                border-radius: 8px;
                transition: all 0.2s ease;
                color: var(--dark);
            }
            .subcat-sidebar-list .cat-item:hover {
                background: var(--primary-light);
                color: var(--primary) !important;
                transform: translateX(-4px);
            }
        </style>
    `;

    // Inherit 'isBrand' from parent so subcategories of a Brand move with it
    const enhancedCategories = categories.map(c => {
        let isBrandTree = c.isBrand === true;
        if (!isBrandTree && c.parentId) {
            const parent = categories.find(p => p.id === c.parentId);
            if (parent && parent.isBrand === true) isBrandTree = true;
        }
        return { ...c, isBrandTree };
    });

    const filteredCategories = filterBrands
        ? enhancedCategories.filter(c => c.isBrandTree === true)
        : enhancedCategories.filter(c => c.isBrandTree !== true);

    const parentCategories = filteredCategories.filter(c => !c.parentId || !filteredCategories.some(x => x.id === c.parentId));

    parentCategories.forEach(p => {
        const isActiveParent = p.id === activeCatId;
        const subcategories = filteredCategories.filter(c => c.parentId === p.id);
        const hasActiveChild = subcategories.some(sc => sc.id === activeCatId);
        const isOpen = isActiveParent || hasActiveChild;

        const parentImg = p.icon ? `<img src="${p.icon}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; flex-shrink:0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none';">` : (p.image ? `<img src="${p.image}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; flex-shrink:0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none';">` : '');

        catsHTML += `
            <div class="cat-group ${isOpen ? 'is-open' : ''}">
                <a href="/?app=product.cat.${p.id}" class="cat-item ${isActiveParent ? 'active' : ''}" style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px; padding: 10px 12px; border-radius: 8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${parentImg}
                        <span style="font-size: 15px; font-weight: 700;">${p.name}</span>
                    </div>
                    ${subcategories.length > 0 ? '<i class="fa fa-chevron-left cat-chevron" style="font-size:12px;"></i>' : ''}
                </a>
        `;

        if (subcategories.length > 0) {
            catsHTML += `<div class="subcat-wrapper"><div class="subcat-sidebar-list">`;
            subcategories.forEach(sc => {
                const isActiveSub = sc.id === activeCatId;
                const subImg = sc.icon ? `<img src="${sc.icon}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; flex-shrink:0;" onerror="this.style.display='none';">` : (sc.image ? `<img src="${sc.image}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; flex-shrink:0;" onerror="this.style.display='none';">` : '');

                catsHTML += `
                    <a href="/?app=product.cat.${sc.id}" class="cat-item ${isActiveSub ? 'active' : ''}" style="font-size:13px; padding: 8px 12px; display:flex; align-items:center; width:100%; gap:10px; font-weight:600;">
                        ${subImg}
                        <span>${sc.name}</span>
                    </a>
                `;
            });
            catsHTML += `</div></div>`;
        }
        catsHTML += `</div>`;
    });
    return catsHTML;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper: verify if product is still in Coming Soon state ──────────────────
function checkComingSoon(p) {
    if (!p.advanced || !p.advanced.isComingSoon) return false;
    if (p.advanced.comingSoonDate) {
        const releaseDate = new Date(p.advanced.comingSoonDate);
        if (!isNaN(releaseDate.getTime()) && new Date() >= releaseDate) return false;
    }
    return true;
}

// ── Helper: common html replacement for storefront templates ────────────────
function renderStoreTemplate(html, settings, catsHTML, activeCatId, isHomePage) {
    // Read fresh category list for Brands Sidebar
    const db = dbHelper.readData();
    const categories = db.categories || [];

    // Filter standard categories (non-brands)
    const normalCatsHTML = buildCatsHTML(categories, activeCatId, false);

    // Build brands sidebar HTML
    let brandsSectionHTML = '';
    const brandsHTML = buildCatsHTML(categories, activeCatId, true);
    html = html.replace(/\{\{BRANDS_HTML\}\}/g, brandsHTML);

    // ── Build FLAT brands HTML for the mobile modal grid ────────────────────
    // (no cat-group wrappers — just simple <a> links that work in a CSS grid)
    const enhancedCats = categories.map(c => {
        let isBrandTree = c.isBrand === true;
        if (!isBrandTree && c.parentId) {
            const parent = categories.find(p => p.id === c.parentId);
            if (parent && parent.isBrand === true) isBrandTree = true;
        }
        return { ...c, isBrandTree };
    });
    const brandParents = enhancedCats.filter(c => c.isBrandTree && (!c.parentId || !enhancedCats.some(x => x.id === c.parentId && x.isBrandTree)));
    let brandModalHTML = brandParents.map(b => {
        const isActive = b.id === activeCatId;
        const img = b.icon || b.image
            ? `<img src="${b.icon || b.image}" style="width:42px;height:42px;border-radius:10px;object-fit:cover;" onerror="this.style.display='none'">`
            : `<span style="font-size:24px;">🏷️</span>`;
        return `<a href="/?app=product.cat.${b.id}" onclick="closeModal('categoriesModal')" class="brand-modal-item ${isActive ? 'active' : ''}">
            ${img}
            <span>${b.name}</span>
        </a>`;
    }).join('');
    html = html.replace(/\{\{BRANDS_HTML_MODAL\}\}/g, brandModalHTML || '');

    // ── Inject closeModal onclick into all category links in the modal ───────
    // Replace {{CATEGORIES_HTML}} with a version that closes the modal on click
    const modalCatsHTML = (catsHTML || normalCatsHTML).replace(
        /(<a\b[^>]*href="[^"]*"[^>]*)(>)/g,
        (match, before, close) => {
            if (before.includes('closeModal')) return match;
            return before + ' onclick="closeModal(\'categoriesModal\')"' + close;
        }
    );
    html = html.replace(/\{\{\s*CATEGORIES_HTML_MODAL\s*\}\}/g, modalCatsHTML);

    if (settings.showBrandsSidebar !== 'false') {
        if (brandsHTML) {
            const brandsTitle = settings.brandsTitle || 'العلامات التجارية';
            brandsSectionHTML = `
                <div class="sidebar-card" style="margin-top: 20px;">
                    <h3 class="sidebar-title"><i class="fa fa-award"></i> ${brandsTitle}</h3>
                    <div class="cat-list">
                        ${brandsHTML}
                    </div>
                </div>
            `;
        }
    }

    // Sidebar render logic
    let sidebarHTML = '';
    if (settings.showSidebarFilter !== 'false') {
        sidebarHTML = `
            <aside class="sidebar">
                <div class="sidebar-card">
                    <h3 class="sidebar-title"><i class="fa fa-list-ul"></i> تصفح الأقسام</h3>
                    <div class="cat-list">
                        <a href="/?app=product.cat.all" class="cat-item">الكل <i class="fa fa-chevron-left"></i></a>
                        ${normalCatsHTML}
                    </div>
                </div>

                ${brandsSectionHTML}

                <div class="sidebar-card" style="background: var(--primary); color: var(--white); border: none; margin-top: 20px;">
                    <h3 style="margin-bottom: 10px;">انضم لقائمتنا البريدية</h3>
                    <p style="font-size: 13px; margin-bottom: 15px; opacity: 0.9;">احصل على خصم 10% على طلبك الأول عند الاشتراك!</p>
                    <input type="email" placeholder="بريدك الإلكتروني" style="width: 100%; padding: 10px; border-radius: 8px; border: none; margin-bottom: 10px;">
                    <button style="width: 100%; padding: 10px; border-radius: 8px; border: none; background: var(--dark); color: var(--white); font-weight: bold; cursor: pointer;">اشترك الآن</button>
                </div>
                
                <div class="sidebar-card">
                    <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                        <i class="fa fa-shield-check" style="font-size: 30px; color: var(--primary);"></i>
                        <div>
                            <div style="font-weight: 800;">تسوق آمن</div>
                            <div style="font-size: 12px; color: var(--gray-600);">بياناتك مشفرة ومحمية</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <i class="fa fa-headset" style="font-size: 30px; color: var(--primary);"></i>
                        <div>
                            <div style="font-weight: 800;">دعم 24/7</div>
                            <div style="font-size: 12px; color: var(--gray-600);">نحن هنا لمساعدتك دائماً</div>
                        </div>
                    </div>
                </div>
            </aside>
        `;
    }
    html = html.replace(/\{\{SIDEBAR_SECTION\}\}/g, sidebarHTML || '');

    // PWA Install Banner logic
    let pwaBannerHTML = '';
    if (settings.showPwaBanner !== 'false') {
        pwaBannerHTML = `
            <div id="pwaInstallBanner" style="display:none; align-items:center; justify-content:space-between; gap:15px; background:var(--white); border:1px solid var(--gray-200); border-radius:14px; padding:14px 20px; margin-bottom:12px; box-shadow:var(--shadow-md); flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:44px; height:44px; background:var(--primary); border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa fa-store" style="color:#fff; font-size:20px;"></i>
                    </div>
                    <div>
                        <div style="font-weight:800; font-size:14px;">ثبّت التطبيق على جهازك</div>
                        <div style="font-size:12px; color:var(--gray-600);">تجربة أسرع وأسهل في كل مرة!</div>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="pwaInstallBtn" onclick="installPWA()" style="background:var(--primary); color:#fff; border:none; padding:9px 18px; border-radius:9px; font-weight:700; cursor:pointer; font-size:13px; font-family:inherit;"><i class="fa fa-download" style="margin-left:6px;"></i>تثبيت</button>
                    <button onclick="document.getElementById('pwaInstallBanner').style.display='none'" style="background:var(--gray-100); color:var(--gray-600); border:none; padding:9px 12px; border-radius:9px; cursor:pointer; font-size:13px;"><i class="fa fa-xmark"></i></button>
                </div>
            </div>
        `;
    }

    html = html.replace(/\{\{\s*PWA_BANNER\s*\}\}/g, pwaBannerHTML);

    // Build Pages Footer links
    const pages = dbHelper.readPages();
    const publicPages = pages.filter(p => p.status === 'public');
    let pagesFooterHTML = '';
    publicPages.forEach(p => {
        pagesFooterHTML += `<a href="/page/${p.slug}" onclick="closeModal('categoriesModal')">${p.title}</a>`;
    });
    html = html.replace(/\{\{PAGES_FOOTER\}\}/g, pagesFooterHTML || '');

    // WhatsApp Floating Bubble logic
    let whatsappBubbleHTML = '';
    if (settings.showWhatsappBubble !== 'false' && settings.whatsappUrl) {
        whatsappBubbleHTML = `
            <a href="https://wa.me/${settings.whatsappUrl}" class="whatsapp-bubble" target="_blank" title="تواصل معنا عبر واتساب">
                <i class="fab fa-whatsapp"></i>
            </a>
        `;
    }
    html = html.replace(/\{\{\s*WHATSAPP_BUBBLE\s*\}\}/g, whatsappBubbleHTML);

    // Dynamic Header announcement
    html = html.replace(/\{\{\s*ANNOUNCEMENT_TEXT\s*\}\}/g, settings.announcementText || '🌟 أفضل المنتجات بأفضل الأسعار | توصيل سريع لباب المنزل');

    // Dynamic social links in header
    let socialLinksHTML = '<div class="socials">';
    if (settings.instagramUrl) socialLinksHTML += `<a href="${settings.instagramUrl}" target="_blank"><i class="fab fa-instagram"></i></a>`;
    if (settings.facebookUrl) socialLinksHTML += `<a href="${settings.facebookUrl}" target="_blank"><i class="fab fa-facebook"></i></a>`;
    if (settings.snapchatUrl) socialLinksHTML += `<a href="${settings.snapchatUrl}" target="_blank"><i class="fab fa-snapchat"></i></a>`;
    if (settings.whatsappUrl) socialLinksHTML += `<a href="https://wa.me/${settings.whatsappUrl}" target="_blank"><i class="fab fa-whatsapp"></i></a>`;
    socialLinksHTML += '</div>';
    html = html.replace(/\{\{\s*SOCIAL_LINKS\s*\}\}/g, socialLinksHTML);

    // Typewriter search placeholders
    let searchPlaceholders = ['ابحث عن ما تحب...', 'ابحث عن منتجاتنا...'];
    if (settings.searchPlaceholders) {
        if (typeof settings.searchPlaceholders === 'string') {
            const parts = settings.searchPlaceholders.split(',').map(s => s.trim()).filter(s => s);
            if (parts.length > 0) searchPlaceholders = parts;
        } else if (Array.isArray(settings.searchPlaceholders) && settings.searchPlaceholders.length > 0) {
            searchPlaceholders = settings.searchPlaceholders;
        }
    }
    html = html.replace(/\{\{\s*SEARCH_PLACEHOLDERS_JSON\s*\}\}/g, JSON.stringify(searchPlaceholders));

    // Cleanup active navigation tags if not already replaced
    html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');
    html = html.replace(/\{\{\s*REELS_ACTIVE\s*\}\}/g, '');

    // ── Pixel & Tracking Scripts ─────────────────────────────────────────────
    let trackingScripts = '';
    
    // Facebook Pixel
    if (settings.fbPixel) {
        trackingScripts += `
            <!-- Facebook Pixel Code -->
            <script>
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${settings.fbPixel}');
            fbq('track', 'PageView');
            </script>
            <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${settings.fbPixel}&ev=PageView&noscript=1"/></noscript>
        `;
    }

    // TikTok Pixel
    if (settings.tiktokPixel) {
        trackingScripts += `
            <!-- TikTok Pixel Code -->
            <script>
            !function (w, d, t) { w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","trackSelf","untrackSelf"],ttq.setAndLog=function(t,e){return function(){for(var n=[],r=arguments.length;r--;)n[r]=arguments[r];n.push(e),ttq.enqueue(t,n)}};for(var i=0;i<ttq.methods.length;i++)ttq[i]=ttq.setAndLog(ttq[i],i);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq[n]=ttq.setAndLog(ttq[n],n);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
            ttq.load('${settings.tiktokPixel}');
            ttq.page();
            }(window, document, 'ttq');
            </script>
        `;
    }

    // Snapchat Pixel
    if (settings.snapPixel) {
        trackingScripts += `
            <!-- Snapchat Pixel Code -->
            <script type='text/javascript'>
            (function(win, doc, sdk) {
            if (win.snaptr) return;
            var tr = win.snaptr = function() { tr.handleRequest ? tr.handleRequest.apply(tr, arguments) : tr.queue.push(arguments); };
            tr.queue = [];
            var s = doc.createElement(sdk); s.async = !0; s.src = 'https://sc-static.net/scevent.min.js';
            var p = doc.getElementsByTagName(sdk)[0]; p.parentNode.insertBefore(s, p);
            }(window, document, 'script'));
            snaptr('init', '${settings.snapPixel}');
            snaptr('track', 'PAGE_VIEW');
            </script>
        `;
    }

    // Google Tag Manager / Analytics (GTAG)
    if (settings.gtm) {
        trackingScripts += `
            <!-- Global site tag (gtag.js) - Google Analytics -->
            <script async src="https://www.googletagmanager.com/gtag/js?id=${settings.gtm}"></script>
            <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${settings.gtm}');
            </script>
        `;
    }

    // Common Tracking Helper for Events
    trackingScripts += `
        <script>
        window.trackStoreEvent = function(eventName, data) {
            console.log('Tracking Event:', eventName, data);
            
            // Facebook
            if (typeof fbq === 'function') {
                if (eventName === 'Purchase') fbq('track', 'Purchase', { value: data.total, currency: '${settings.currency || 'ILS'}' });
                else if (eventName === 'AddToCart') fbq('track', 'AddToCart', { content_name: data.name, value: data.price, currency: '${settings.currency || 'ILS'}' });
                else if (eventName === 'ViewContent') fbq('track', 'ViewContent', { content_name: data.name, value: data.price, currency: '${settings.currency || 'ILS'}' });
            }
            
            // TikTok
            if (typeof ttq === 'function') {
                if (eventName === 'Purchase') ttq.track('CompletePayment', { value: data.total, currency: '${settings.currency || 'ILS'}' });
                else if (eventName === 'AddToCart') ttq.track('AddToCart', { content_name: data.name, value: data.price, currency: '${settings.currency || 'ILS'}' });
                else if (eventName === 'ViewContent') ttq.track('ViewContent', { content_name: data.name, value: data.price, currency: '${settings.currency || 'ILS'}' });
            }
            
            // Snapchat
            if (typeof snaptr === 'function') {
                if (eventName === 'Purchase') snaptr('track', 'PURCHASE', { price: data.total, currency: '${settings.currency || 'ILS'}' });
                else if (eventName === 'AddToCart') snaptr('track', 'ADD_CART', { item_name: data.name, price: data.price, currency: '${settings.currency || 'ILS'}' });
                else if (eventName === 'ViewContent') snaptr('track', 'VIEW_CONTENT', { item_name: data.name, price: data.price, currency: '${settings.currency || 'ILS'}' });
            }
            
            // Google Analytics
            if (typeof gtag === 'function') {
                gtag('event', eventName, data);
            }
        };
        </script>
    `;

    html = html.replace(/\{\{\s*TRACKING_SCRIPTS\s*\}\}/g, trackingScripts);

    // ── Advanced Welcome Popups ──────────────────────────────────────────────
    let welcomePopupHTML = '';
    if (settings.popupEnabled && settings.popups && settings.popups.length > 0) {
        const activePopups = settings.popups.filter(p => p.active !== false);
        if (activePopups.length > 0) {
            const pData = activePopups[Math.floor(Math.random() * activePopups.length)]; 
            const pId = pData.id || `popup_${Math.random().toString(36).substr(2, 9)}`;
            
            // Sanitize Link
            let pLink = pData.link || '';
            if (pLink && !pLink.startsWith('http')) {
                // If it starts with / but no ?, like /app=...
                if (pLink.startsWith('/') && !pLink.includes('?')) {
                    if (pLink.includes('app=') || pLink.includes('account=')) {
                        pLink = '/?' + pLink.substring(1);
                    }
                } 
                // If it doesn't start with / or http, like app=...
                else if (!pLink.startsWith('/')) {
                    pLink = '/?' + pLink;
                }
            }

            // Theme Styles
            let themeStyles = '';
            if (pData.theme === 'dark') {
                themeStyles = 'background:#1e293b; color:#fff;';
            } else if (pData.theme === 'glass') {
                themeStyles = 'background:rgba(255,255,255,0.7); backdrop-filter:blur(15px); border:1px solid rgba(255,255,255,0.2); color:#1e293b;';
            } else if (pData.theme === 'minimal') {
                themeStyles = 'background:#fff; color:#000; border-radius:12px;';
            } else {
                themeStyles = 'background:#fff; color:#1e293b;';
            }

            welcomePopupHTML = `
                <div id="welcomePopup" class="modal" style="display:none; align-items:center; justify-content:center; z-index:10000; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px);">
                    <div class="modal-content popup-anim-${pData.animation || 'popIn'}" style="max-width:450px; border-radius:30px; overflow:hidden; border:none; position:relative; ${themeStyles} box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
                        <button onclick="closeWelcomePopup()" style="position:absolute; top:15px; right:15px; background:rgba(255,255,255,0.9); border:none; color:#000; width:35px; height:35px; border-radius:50%; cursor:pointer; z-index:110; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3); transition:0.3s;" onmouseover="this.style.transform='scale(1.1); background:#fff;'" onmouseout="this.style.transform='scale(1); background:rgba(255,255,255,0.9);'">&times;</button>
                        
                        ${pData.image ? `
                            <div style="width:100%; aspect-ratio:1.2; background:#f1f5f9; position:relative; overflow:hidden;">
                                <img src="${pData.image}" style="width:100%; height:100%; object-fit:cover; transition:0.5s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                ${pData.type === 'image' && pLink ? `<a href="${pLink}" onclick="closeWelcomePopup()" style="position:absolute; inset:0; z-index:5;"></a>` : ''}
                            </div>
                        ` : ''}
                        
                        ${pData.type !== 'image' ? `
                            <div style="padding:30px; text-align:center;">
                                <h3 style="font-size:24px; font-weight:900; margin-bottom:12px; font-family:'Tajawal', sans-serif;">${pData.title || ''}</h3>
                                <p style="opacity:0.8; font-size:15px; line-height:1.6; margin-bottom:20px;">${pData.desc || ''}</p>
                                
                                ${pData.showTimer ? `
                                    <div style="display:flex; justify-content:center; gap:10px; margin-bottom:25px;">
                                        <div style="background:var(--primary); color:white; padding:8px 15px; border-radius:12px; min-width:60px;">
                                            <div id="popupTimerM" style="font-size:20px; font-weight:900;">${pData.timerMinutes || 10}</div>
                                            <div style="font-size:9px; font-weight:700;">دقيقة</div>
                                        </div>
                                        <div style="font-size:24px; font-weight:900; color:var(--primary); align-self:center;">:</div>
                                        <div style="background:var(--primary); color:white; padding:8px 15px; border-radius:12px; min-width:60px;">
                                            <div id="popupTimerS" style="font-size:20px; font-weight:900;">00</div>
                                            <div style="font-size:9px; font-weight:700;">ثانية</div>
                                        </div>
                                    </div>
                                ` : ''}

                                ${pData.coupon ? `
                                    <div style="background:rgba(var(--primary-rgb, 250,0,0), 0.1); border:2px dashed var(--primary); padding:15px; border-radius:15px; margin-bottom:25px; cursor:pointer; position:relative; overflow:hidden;" onclick="copyPopupCoupon('${pData.coupon}')">
                                        <div style="font-size:11px; font-weight:800; color:var(--primary); margin-bottom:5px;">كود الخصم (اضغط للنسخ)</div>
                                        <div style="font-size:22px; font-weight:900; letter-spacing:2px;">${pData.coupon}</div>
                                        <div id="couponFeedback" style="position:absolute; inset:0; background:var(--primary); color:white; display:none; align-items:center; justify-content:center; font-weight:800; font-size:14px;">تم النسخ بنجاح! ✓</div>
                                    </div>
                                ` : ''}

                                <div style="display:flex; gap:12px;">
                                    ${pLink ? `
                                        <a href="${pLink}" onclick="closeWelcomePopup()" class="btn-primary" style="flex:1; padding:15px; border-radius:15px; text-decoration:none; font-weight:800; font-size:16px; background:var(--primary); color:white; box-shadow:0 10px 20px -5px var(--primary);">اكتشف العرض الآن</a>
                                    ` : `
                                        <button onclick="closeWelcomePopup()" class="btn-primary" style="flex:1; padding:15px; border-radius:15px; border:none; font-weight:800; font-size:16px; background:var(--primary); color:white; cursor:pointer;">ابدأ التسوق</button>
                                    `}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            <style>
                .popup-anim-popIn { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                .popup-anim-slideUp { animation: slideUp 0.5s ease-out forwards; }
                .popup-anim-zoomIn { animation: zoomIn 0.4s ease-out forwards; }
                .popup-anim-rotateIn { animation: rotateIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

                @keyframes popIn { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                @keyframes slideUp { 0% { transform: translateY(100px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
                @keyframes zoomIn { 0% { transform: scale(1.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                @keyframes rotateIn { 0% { transform: rotate(-10deg) scale(0.8); opacity: 0; } 100% { transform: rotate(0) scale(1); opacity: 1; } }
            </style>
            <script>
                function closeWelcomePopup() {
                    const p = document.getElementById('welcomePopup');
                    if(p) p.style.display = 'none';
                    const repeat = '${pData.repeat || 'always'}';
                    const pId = '${pId}';
                    if (repeat === 'once_session') sessionStorage.setItem('popup_shown_' + pId, 'true');
                    else if (repeat === 'once_day') localStorage.setItem('popup_shown_' + pId, Date.now());
                    else if (repeat === 'once_forever') localStorage.setItem('popup_shown_' + pId, 'forever');
                }

                function copyPopupCoupon(code) {
                    navigator.clipboard.writeText(code);
                    const feedback = document.getElementById('couponFeedback');
                    if(feedback) {
                        feedback.style.display = 'flex';
                        setTimeout(() => feedback.style.display = 'none', 2000);
                    }
                }

                function shouldShowPopup() {
                    const repeat = '${pData.repeat || 'always'}';
                    const pId = '${pId}';
                    if (repeat === 'once_session' && sessionStorage.getItem('popup_shown_' + pId)) return false;
                    if (repeat === 'once_forever' && localStorage.getItem('popup_shown_' + pId)) return false;
                    if (repeat === 'once_day') {
                        const lastShown = localStorage.getItem('popup_shown_' + pId);
                        if (lastShown && (Date.now() - parseInt(lastShown)) < 24 * 60 * 60 * 1000) return false;
                    }
                    return true;
                }

                function initPopupTriggers() {
                    if (!shouldShowPopup()) return;
                    
                    const showOn = '${pData.showOn || 'load'}';
                    const delay = ${(pData.delay || 2) * 1000};
                    
                    if (showOn === 'load') {
                        setTimeout(() => document.getElementById('welcomePopup').style.display = 'flex', delay);
                    } else if (showOn === 'exit') {
                        document.addEventListener('mouseleave', (e) => {
                            if (e.clientY < 0 && !sessionStorage.getItem('exit_intent_triggered')) {
                                document.getElementById('welcomePopup').style.display = 'flex';
                                sessionStorage.setItem('exit_intent_triggered', 'true');
                            }
                        });
                    } else if (showOn === 'scroll') {
                        const scrollHandler = () => {
                            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
                            if (scrollPercent > 50) {
                                document.getElementById('welcomePopup').style.display = 'flex';
                                window.removeEventListener('scroll', scrollHandler);
                            }
                        };
                        window.addEventListener('scroll', scrollHandler);
                    }

                    // Urgency Timer
                    if (document.getElementById('popupTimerM')) {
                        let mins = ${pData.timerMinutes || 10}, secs = 0;
                        const mEl = document.getElementById('popupTimerM'), sEl = document.getElementById('popupTimerS');
                        const t = setInterval(() => {
                            if (secs === 0) { if (mins === 0) { clearInterval(t); return; } mins--; secs = 59; }
                            else secs--;
                            mEl.innerText = mins;
                            sEl.innerText = secs < 10 ? '0' + secs : secs;
                        }, 1000);
                    }
                }

                window.addEventListener('load', initPopupTriggers);
            </script>
        `;
        }
    }
    // Logo replacements
    let logoHTML = `<i class="fa fa-gem"></i> ${settings.storeName || 'متجري'}`;
    let footerLogoHTML = `<i class="fa fa-gem"></i> ${settings.storeName || 'متجري'}`;
    if (settings.storeLogo) {
        logoHTML = `<img src="${settings.storeLogo}" alt="${settings.storeName || 'متجري'}" style="max-height: 40px; max-width: 100%; object-fit: contain;">`;
        footerLogoHTML = `<img src="${settings.storeLogo}" alt="${settings.storeName || 'متجري'}" style="max-height: 50px; max-width: 100%; object-fit: contain;">`;
    }
    html = html.replace(/\{\{STORE_LOGO_HTML\}\}/g, logoHTML);
    html = html.replace(/\{\{STORE_FOOTER_LOGO_HTML\}\}/g, footerLogoHTML);

    html = html.replace(/\{\{\s*WELCOME_POPUP\s*\}\}/g, welcomePopupHTML);

    return html;
}
// ─────────────────────────────────────────────────────────────────────────────


// ── Helper: apply seasonal promotions to products ────────────────────────────
function applyActivePromotions(products) {
    const promoPath = path.join(__dirname, '../data/promotions.json');
    if (!fs.existsSync(promoPath)) return products;
    try {
        const promos = JSON.parse(fs.readFileSync(promoPath, 'utf8'));
        const now = new Date();
        const active = promos.filter(p => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            return now >= start && now <= end;
        });

        if (active.length > 0) {
            const promo = active[0];
            return products.map(p => {
                const productCategories = Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : [p.category || 'general'];
                const isApplicable = promo.allProducts ||
                    (promo.categories && promo.categories.some(c => productCategories.includes(c))) ||
                    (promo.productIds && promo.productIds.includes(p.id));

                if (isApplicable && promo.discountType !== 'freeship') {
                    const clonedP = { ...p };
                    if (!clonedP.salePrice) clonedP.salePrice = clonedP.price; // salePrice is the old price

                    if (promo.discountType === 'percentage') {
                        clonedP.price = clonedP.price - (clonedP.price * (promo.discountValue / 100));
                    } else if (promo.discountType === 'fixed') {
                        clonedP.price = Math.max(0, clonedP.price - promo.discountValue);
                    }
                    // Round to 2 decimals if needed or just use Math.round to avoid ugly fractions
                    clonedP.price = parseFloat(clonedP.price.toFixed(2));
                    return clonedP;
                }
                return p;
            });
        }
    } catch (e) { console.error('Error applying promotions:', e); }
    return products;
}
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    home: (req, res) => {
        console.log('HOME METHOD CALLED WITH QUERY:', req.query);
        const db = dbHelper.readData();
        let products = applyActivePromotions(db.products || []);
        const categories = db.categories || [];
        const settings = db.settings || {};
        const currency = settings.currency || '$';
        const searchQuery = req.query.q ? req.query.q.toLowerCase() : '';

        let sections = [];
        if (settings.home_sections_json) {
            try {
                sections = typeof settings.home_sections_json === 'string' ? JSON.parse(settings.home_sections_json) : settings.home_sections_json;
            } catch (e) { sections = []; }
        }

        let catsHTML = buildCatsHTML(categories);

        // Filter out hidden products, and filter by search if exists
        let visibleProducts = products.filter(p => !p.advanced || !p.advanced.hiddenProduct);
        if (searchQuery) {
            visibleProducts = visibleProducts.filter(p => p.name.toLowerCase().includes(searchQuery) || (p.description && p.description.toLowerCase().includes(searchQuery)));
        }

        let productsHTML = '';
        if (searchQuery) {
            let searchResults = visibleProducts.filter(p => {
                if (checkComingSoon(p)) return false;
                return p.name.toLowerCase().includes(searchQuery) || (p.description && p.description.toLowerCase().includes(searchQuery));
            });
            if (searchResults.length === 0) {
                productsHTML = '<div class="empty-state"><i class="fa fa-search"></i><h3>لا توجد منتجات تطابق بحثك حالياً. جرب كلمات أخرى.</h3></div>';
            } else {
                productsHTML += `
                    <div class="section-header">
                        <h2 class="section-title">نتائج البحث عن: "${searchQuery}"</h2>
                    </div>
                    <div class="product-grid">
                `;
                searchResults.forEach((p, idx) => {
                    const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                    const isHidden = idx >= 12;
                    const isNew = (Date.now() - parseInt(p.id)) < (48 * 60 * 60 * 1000);
                    const isComingSoon = checkComingSoon(p);

                    productsHTML += `
                        <div class="product-card ${isComingSoon ? 'coming-soon-card' : ''} ${isHidden ? 'hidden-product-card' : ''}" style="${isHidden ? 'display: none;' : ''}" onclick="window.location.href='/?app=product.show.${p.id}'">
                            <div class="product-img">
                                ${isComingSoon ? `<div class="coming-soon-badge">قريباً</div>` : (isNew ? `<div class="new-badge">جديد</div>` : '')}
                                ${discount > 0 && !isComingSoon ? `<div class="discount-badge">خصم ${discount}%</div>` : ''}
                                <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                <img src="${p.image}" alt="${p.name}" loading="lazy" style="${isComingSoon ? 'filter: grayscale(0.5) opacity(0.8);' : ''}">
                            </div>
                            <div class="product-info">
                                <span class="product-name">${p.name}</span>
                                ${buildVariantChipsHTML(p)}
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                    <div class="product-price">
                                        ${isComingSoon ? '<span style="color:var(--gray-500); font-size:14px;">بانتظار التوفر</span>' : `${currency}${p.price}${p.salePrice ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}`}
                                    </div>
                                    ${isComingSoon ? `
                                        <button class="cart-icon-btn" disabled style="background:var(--gray-200); color:var(--gray-400); cursor:not-allowed;"><i class="fas fa-lock"></i></button>
                                    ` : `
                                        <button class="cart-icon-btn" onclick="${getQAOnClick(p)}" title="إضافة للسلة"><i class="fa fa-shopping-bag"></i></button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                });
                productsHTML += `</div>`;

                if (searchResults.length > 12) {
                    productsHTML += `
                        <div class="load-more-container" style="text-align:center; margin: 30px auto 10px;">
                            <button id="btnLoadMore" onclick="loadMoreProducts()" style="padding:12px 35px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-weight:800; font-size:16px; cursor:pointer; box-shadow:0 10px 20px var(--primary-light); transition:all 0.3s ease;">عرض المزيد من المنتجات <i class="fa fa-chevron-down" style="margin-right:8px;"></i></button>
                        </div>
                    `;
                }
            }
        } else {
            if (Array.isArray(sections) && sections.length > 0) {
                console.log('DEBUG SECTIONS:', JSON.stringify(sections));
                sections.forEach(s => {
                    console.log('PROCESSING SECTION:', s.type, 'categoryId:', s.categoryId);
                    if (s.type === 'text') {
                        productsHTML += `
                            <div style="background:${s.bgColor || '#f8fafc'}; color:${s.textColor || '#0f172a'}; padding:40px 25px; border-radius:16px; margin: 30px 0; text-align:${s.align || 'center'}; border:1px solid rgba(0,0,0,0.03); box-shadow:var(--shadow-sm);">
                                ${s.title ? `<h2 style="font-size:28px; font-weight:800; margin-bottom:10px; font-family:'Tajawal', sans-serif;">${s.title}</h2>` : ''}
                                ${s.subtitle ? `<p style="font-size:16px; opacity:0.85; max-width:600px; margin:0 auto; line-height:1.6; font-family:'Tajawal', sans-serif;">${s.subtitle}</p>` : ''}
                                ${s.btnText && s.btnLink ? `<a href="${s.btnLink}" class="view-all" style="display:inline-block; margin-top:20px; background:var(--primary); color:#fff; padding:10px 25px; border-radius:10px; text-decoration:none; font-weight:800; font-size:14px; box-shadow:0 4px 10px rgba(250,0,0,0.2); transition:all 0.2s;">${s.btnText} <i class="fa fa-chevron-left" style="margin-right:6px; font-size:10px;"></i></a>` : ''}
                            </div>
                        `;
                    } else if (s.type === 'banner' && s.image) {
                        productsHTML += `
                            <div style="margin: 30px 0; border-radius:16px; overflow:hidden; box-shadow:var(--shadow-md); transition:transform 0.3s ease;">
                                ${s.link ? `<a href="${s.link}" style="display:block;">` : ''}
                                <img src="${s.image}" alt="Banner" style="width:100%; display:block; object-fit:cover; max-height:400px;">
                                ${s.link ? `</a>` : ''}
                            </div>
                        `;
                    } else if (s.type === 'new_arrivals') {
                        let latestProducts = visibleProducts.filter(p => !checkComingSoon(p)).sort((a, b) => b.id - a.id);
                        if (s.limit) latestProducts = latestProducts.slice(0, s.limit);

                        if (latestProducts.length > 0) {
                            const arrivalsSliderID = 'arrSlider_' + Date.now();
                            productsHTML += `
                                <div class="arr-slider-section">
                                    <style>
                                        .arr-slider-section {
                                            margin: 28px 0;
                                            background: rgba(250,204,21,0.06);
                                            border-radius: 20px;
                                            padding: 20px 16px 24px;
                                            border: 1px solid rgba(250,204,21,0.1);
                                            position: relative;
                                            overflow: hidden;
                                        }
                                        .arr-sl-header {
                                            display: flex; align-items: center;
                                            justify-content: space-between;
                                            margin-bottom: 16px; gap: 10px;
                                            position: relative; z-index: 2;
                                        }
                                        .arr-sl-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
                                        .arr-sl-icon {
                                            width: 38px; height: 38px;
                                            background: linear-gradient(135deg, #facc15, #f59e0b);
                                            border-radius: 12px;
                                            display: flex; align-items: center; justify-content: center;
                                            flex-shrink: 0;
                                            box-shadow: 0 4px 14px rgba(250,204,21,0.4);
                                        }
                                        .arr-sl-icon i { color: #78350f; font-size: 15px; animation: arrIconBounce 2.5s ease-in-out infinite; }
                                        .arr-sl-title { font-size: 16px; font-weight: 800; color: var(--dark); margin: 0; font-family: 'Tajawal', sans-serif; line-height: 1.2; }
                                        .arr-sl-subtitle { font-size: 10px; color: var(--gray-400, #9ca3af); font-family: 'Tajawal', sans-serif; margin-top: 1px; }
                                        .arr-sl-viewall {
                                            flex-shrink: 0; font-size: 11px; font-weight: 700;
                                            color: #b45309; text-decoration: none;
                                            background: #fef3c7; border: 1.5px solid #fcd34d;
                                            padding: 6px 14px; border-radius: 50px;
                                            display: flex; align-items: center; gap: 4px;
                                            transition: all 0.25s; font-family: 'Tajawal', sans-serif; white-space: nowrap;
                                        }
                                        .arr-sl-viewall:hover { background: #facc15; color: #78350f; border-color: #facc15; }
                                        .arr-sl-viewport { overflow: hidden; position: relative; border-radius: 16px; }
                                        .arr-sl-track { display: flex; transition: transform 0.55s cubic-bezier(0.4,0,0.2,1); will-change: transform; gap: 14px; }
                                        .arr-sl-card {
                                            flex: 0 0 calc(50% - 7px);
                                            background: var(--white, #fff); border-radius: 16px;
                                            border: 1.5px solid var(--gray-200, #e5e7eb);
                                            overflow: hidden; display: flex; flex-direction: column;
                                            cursor: pointer; transition: border-color 0.3s, box-shadow 0.3s;
                                            position: relative; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                                        }
                                        .arr-sl-card:hover { border-color: #facc15; box-shadow: 0 8px 24px rgba(250,204,21,0.25); }
                                        .arr-sl-img { width: 100%; aspect-ratio: 1; position: relative; overflow: hidden; background: var(--gray-100, #f3f4f6); }
                                        .arr-sl-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
                                        .arr-sl-card:hover .arr-sl-img img { transform: scale(1.06); }
                                        .arr-sl-badge {
                                            position: absolute; top: 9px; right: 9px;
                                            background: linear-gradient(135deg, #facc15, #f59e0b);
                                            color: #78350f; font-size: 9px; font-weight: 800;
                                            padding: 4px 8px; border-radius: 20px;
                                            display: flex; align-items: center; gap: 3px;
                                            z-index: 5; box-shadow: 0 2px 8px rgba(250,204,21,0.4);
                                            font-family: 'Tajawal', sans-serif;
                                        }
                                        .arr-sl-disc {
                                            position: absolute; top: 9px; left: 9px;
                                            background: #ef4444; color: #fff;
                                            font-size: 9px; font-weight: 800;
                                            padding: 4px 8px; border-radius: 20px;
                                            z-index: 5; font-family: 'Tajawal', sans-serif;
                                        }
                                        .arr-sl-fav {
                                            position: absolute; bottom: 9px; left: 9px;
                                            width: 29px; height: 29px; border-radius: 50%;
                                            background: rgba(255,255,255,0.92);
                                            border: 1px solid var(--gray-200, #e5e7eb);
                                            display: flex; align-items: center; justify-content: center;
                                            color: #f43f5e; font-size: 12px; cursor: pointer; z-index: 5; transition: all 0.25s;
                                        }
                                        .arr-sl-fav:hover { background: #f43f5e; color: #fff; }
                                        .arr-sl-info { padding: 11px 12px 13px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
                                        .arr-sl-name {
                                            font-size: 12px; font-weight: 700; color: var(--dark, #111);
                                            line-height: 1.45; display: -webkit-box;
                                            -webkit-line-clamp: 2; line-clamp: 2;
                                            -webkit-box-orient: vertical; overflow: hidden;
                                            font-family: 'Tajawal', sans-serif; transition: color 0.2s;
                                        }
                                        .arr-sl-card:hover .arr-sl-name { color: #b45309; }
                                        .arr-sl-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
                                        .arr-sl-price-new { font-size: 17px; font-weight: 900; color: var(--primary); font-family: 'Tajawal', sans-serif; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
                                        .arr-sl-price-old { font-size: 11px; color: var(--gray-400, #9ca3af); text-decoration: line-through; font-family: 'Tajawal', sans-serif; }
                                        .arr-sl-cart {
                                            width: 32px; height: 32px; border-radius: 8px;
                                            background: linear-gradient(135deg, #facc15, #f59e0b);
                                            color: #78350f; border: none;
                                            display: flex; align-items: center; justify-content: center;
                                            cursor: pointer; font-size: 12px; transition: all 0.25s;
                                            box-shadow: 0 3px 10px rgba(250,204,21,0.4); flex-shrink: 0;
                                        }
                                        .arr-sl-cart:hover { transform: scale(1.12) rotate(-5deg); filter: brightness(1.1); }
                                        .arr-sl-dots { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }
                                        .arr-sl-dot {
                                            width: 6px; height: 6px; border-radius: 50%;
                                            background: var(--gray-200, #e5e7eb);
                                            cursor: pointer; transition: all 0.3s ease; border: none; padding: 0;
                                        }
                                        .arr-sl-dot.active { width: 20px; border-radius: 10px; background: #facc15; }
                                        .arr-sl-arrows { display: flex; gap: 8px; flex-shrink: 0; }
                                        .arr-sl-arrow {
                                            width: 34px; height: 34px; border-radius: 50%;
                                            background: rgba(250,204,21,0.12); border: 1.5px solid rgba(250,204,21,0.35);
                                            color: #b45309; font-size: 13px; cursor: pointer;
                                            display: flex; align-items: center; justify-content: center;
                                            transition: all 0.25s ease; flex-shrink: 0;
                                            font-family: 'Tajawal', sans-serif;
                                        }
                                        .arr-sl-arrow:hover { background: #facc15; color: #78350f; border-color: #facc15; transform: scale(1.08); }
                                        .arr-sl-arrow:active { transform: scale(0.95); }
                                        @media (min-width: 640px) { .arr-sl-card { flex: 0 0 calc(33.333% - 10px); } }
                                        @media (min-width: 900px) { .arr-sl-card { flex: 0 0 calc(25% - 11px); } .arr-sl-title { font-size: 20px; } .arr-sl-icon { width: 44px; height: 44px; } }
                                        @keyframes arrIconBounce {
                                            0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                                            30% { transform: translateY(-3px) scale(1.2) rotate(15deg); }
                                            60% { transform: translateY(1px) scale(0.95) rotate(-8deg); }
                                        }
                                    </style>
                                    <div class="arr-sl-header">
                                        <div class="arr-sl-title-wrap">
                                            <div class="arr-sl-icon"><i class="fas fa-bolt"></i></div>
                                            <div>
                                                <h2 class="arr-sl-title">${s.title || 'وصل حديثاً'} ✨</h2>
                                                <div class="arr-sl-subtitle">أحدث ما وصل إلى متجرنا</div>
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                            <a href="/?app=product.cat.all&filter=new_arrivals" class="arr-sl-viewall">
                                                عرض الكل <i class="fa fa-chevron-left" style="font-size:9px;"></i>
                                            </a>
                                            <div class="arr-sl-arrows">
                                                <button class="arr-sl-arrow" id="${arrivalsSliderID}_prev" aria-label="السابق"><i class="fa fa-chevron-right"></i></button>
                                                <button class="arr-sl-arrow" id="${arrivalsSliderID}_next" aria-label="التالي"><i class="fa fa-chevron-left"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="arr-sl-viewport" id="${arrivalsSliderID}_vp">
                                        <div class="arr-sl-track" id="${arrivalsSliderID}_track">
                            `;

                            latestProducts.forEach((p) => {
                                const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                                productsHTML += `
                                    <div class="arr-sl-card" onclick="window.location.href='/?app=product.show.${p.id}'">
                                        <div class="arr-sl-img">
                                            <div class="arr-sl-badge"><i class="fas fa-bolt"></i> جديد</div>
                                            ${discount > 0 ? `<div class="arr-sl-disc">خصم ${discount}%</div>` : ''}
                                            <button class="arr-sl-fav" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                            <img src="${p.image}" alt="${p.name}" loading="lazy">
                                        </div>
                                        <div class="arr-sl-info">
                                            <span class="arr-sl-name">${p.name}</span>
                                            ${buildVariantChipsHTML(p)}
                                            <div class="arr-sl-bottom">
                                                <div>
                                                    <div class="arr-sl-price-new">${currency}${p.price}</div>
                                                    ${p.salePrice ? `<div class="arr-sl-price-old">${currency}${p.salePrice}</div>` : ''}
                                                </div>
                                                <button class="arr-sl-cart" onclick="${getQAOnClick(p)}">
                                                    <i class="fa fa-shopping-bag"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            });

                            productsHTML += `
                                        </div>
                                    </div>
                                    <div class="arr-sl-dots" id="${arrivalsSliderID}_dots"></div>
                                    <script>
                                    (function(){
                                        var track = document.getElementById('${arrivalsSliderID}_track');
                                        var dotsEl = document.getElementById('${arrivalsSliderID}_dots');
                                        if (!track) return;
                                        var cards = track.querySelectorAll('.arr-sl-card');
                                        var total = cards.length;
                                        var current = 0;
                                        var timer = null;
                                        var perView = 2;
                                        function getPerView() {
                                            var w = window.innerWidth;
                                            if (w >= 900) return 4;
                                            if (w >= 640) return 3;
                                            return 2;
                                        }
                                        function getCardWidth() {
                                            if (!cards[0]) return 0;
                                            var gap = parseFloat(window.getComputedStyle(track).gap) || 14;
                                            return cards[0].getBoundingClientRect().width + gap;
                                        }
                                        function goTo(idx) {
                                            perView = getPerView();
                                            var max = Math.max(0, total - perView);
                                            if (idx < 0) idx = max;
                                            if (idx > max) idx = 0;
                                            current = idx;
                                            track.style.transform = 'translateX(' + (current * getCardWidth()) + 'px)';
                                            updateDots();
                                        }
                                        function buildDots() {
                                            perView = getPerView();
                                            var steps = Math.max(1, total - perView + 1);
                                            dotsEl.innerHTML = '';
                                            for (var i = 0; i < steps; i++) {
                                                (function(i){
                                                    var d = document.createElement('button');
                                                    d.className = 'arr-sl-dot' + (i === 0 ? ' active' : '');
                                                    d.onclick = function(){ goTo(i); resetTimer(); };
                                                    dotsEl.appendChild(d);
                                                })(i);
                                            }
                                        }
                                        function updateDots() {
                                            dotsEl.querySelectorAll('.arr-sl-dot').forEach(function(d, i){ d.classList.toggle('active', i === current); });
                                        }
                                        function next() {
                                            if (!track.isConnected) {
                                                clearInterval(timer);
                                                return;
                                            }
                                            goTo(current + 1);
                                        }
                                        function startTimer() { timer = setInterval(next, 3200); }
                                        function resetTimer() { clearInterval(timer); startTimer(); }
                                        track.parentElement.parentElement.addEventListener('mouseenter', function(){ clearInterval(timer); });
                                        track.parentElement.parentElement.addEventListener('mouseleave', startTimer);
                                        var touchStart = 0;
                                        track.addEventListener('touchstart', function(e){ touchStart = e.touches[0].clientX; }, {passive:true});
                                        track.addEventListener('touchend', function(e){
                                            var diff = touchStart - e.changedTouches[0].clientX;
                                            if (Math.abs(diff) > 40) { diff > 0 ? goTo(current + 1) : goTo(current - 1); resetTimer(); }
                                        }, {passive:true});
                                        window.addEventListener('resize', function(){ buildDots(); goTo(0); });
                                        var prevBtn = document.getElementById('${arrivalsSliderID}_prev');
                                        var nextBtn = document.getElementById('${arrivalsSliderID}_next');
                                        if (prevBtn) prevBtn.onclick = function(){ goTo(current - 1); resetTimer(); };
                                        if (nextBtn) nextBtn.onclick = function(){ goTo(current + 1); resetTimer(); };
                                        buildDots();
                                        startTimer();
                                    })();
                                    <\/script>
                                </div>
                            `;
                        }
                    } else if (s.type === 'coming_soon') {
                        let comingSoonProducts = visibleProducts.filter(p => checkComingSoon(p));
                        if (s.limit) comingSoonProducts = comingSoonProducts.slice(0, s.limit);

                        if (comingSoonProducts.length > 0) {
                            productsHTML += `
                                <div class="section-header">
                                    <h2 class="section-title"><i class="fas fa-clock" style="color:var(--primary); margin-left:10px;"></i> ${s.title || 'قريباً متاح'}</h2>
                                </div>
                                <div class="product-grid">
                            `;
                            comingSoonProducts.forEach((p, idx) => {
                                const isHidden = idx >= 12;
                                productsHTML += `
                                    <div class="product-card coming-soon-card ${isHidden ? 'hidden-product-card' : ''}" style="${isHidden ? 'display: none;' : ''}" onclick="window.location.href='/?app=product.show.${p.id}'">
                                        <div class="product-img">
                                            <div class="coming-soon-badge">قريباً</div>
                                            <img src="${p.image}" alt="${p.name}" loading="lazy" style="filter: grayscale(0.5) opacity(0.8);">
                                        </div>
                                        <div class="product-info">
                                            <span class="product-name">${p.name}</span>
                                            <div style="display:flex; justify-content:center; align-items:center; margin-top:auto;">
                                                <div class="product-price" style="color:var(--gray-500);">بانتظار التوفر</div>
                                                <button class="cart-icon-btn" style="background:var(--gray-200); color:var(--gray-400); cursor:not-allowed;" disabled>
                                                    <i class="fas fa-lock"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            });
                            productsHTML += `</div>`;
                        }
                    } else if (s.type === 'recommended_products') {
                        let recommendedProducts = visibleProducts.filter(p => p.advanced && p.advanced.isRecommended && !checkComingSoon(p));
                        if (s.limit) recommendedProducts = recommendedProducts.slice(0, s.limit);

                        if (recommendedProducts.length > 0) {
                            const sliderID = 'recSlider_' + Date.now();
                            productsHTML += `
                                <div class="rec-slider-section">
                                    <style>
                                        /* ═══ Recommended Slider Section ═══ */
                                        .rec-slider-section {
                                            margin: 28px 0;
                                            background: rgba(168,85,247,0.04);
                                            border-radius: 20px;
                                            padding: 16px 14px 24px;
                                            border: 1px solid rgba(168,85,247,0.08);
                                            position: relative;
                                            overflow: hidden;
                                        }
                                        /* ── Header ── */
                                        .rec-sl-header {
                                            display: flex;
                                            align-items: center;
                                            justify-content: space-between;
                                            margin-bottom: 16px;
                                            gap: 10px;
                                            position: relative;
                                            z-index: 2;
                                        }
                                        .rec-sl-title-wrap {
                                            display: flex;
                                            align-items: center;
                                            gap: 10px;
                                            min-width: 0;
                                        }
                                        .rec-sl-icon {
                                            width: 38px; height: 38px;
                                            background: var(--primary);
                                            border-radius: 12px;
                                            display: flex; align-items: center; justify-content: center;
                                            flex-shrink: 0;
                                            box-shadow: 0 4px 14px var(--primary-light, rgba(0,0,0,0.2));
                                        }
                                        .rec-sl-icon i {
                                            color: #fff;
                                            font-size: 15px;
                                            animation: recIconPulse 2.5s ease-in-out infinite;
                                        }
                                        .rec-sl-title {
                                            font-size: 16px;
                                            font-weight: 800;
                                            color: var(--dark);
                                            margin: 0;
                                            font-family: 'Tajawal', sans-serif;
                                            line-height: 1.2;
                                        }
                                        .rec-sl-subtitle {
                                            font-size: 10px;
                                            color: var(--gray-400, #9ca3af);
                                            font-family: 'Tajawal', sans-serif;
                                            margin-top: 1px;
                                        }
                                        .rec-sl-viewall {
                                            flex-shrink: 0;
                                            font-size: 11px;
                                            font-weight: 700;
                                            color: var(--primary);
                                            text-decoration: none;
                                            background: var(--white, #fff);
                                            border: 1.5px solid var(--primary);
                                            padding: 6px 14px;
                                            border-radius: 50px;
                                            display: flex; align-items: center; gap: 4px;
                                            transition: all 0.25s ease;
                                            font-family: 'Tajawal', sans-serif;
                                            white-space: nowrap;
                                        }
                                        .rec-sl-viewall:hover {
                                            background: var(--primary);
                                            color: #fff;
                                        }

                                        /* ── Slider Track ── */
                                        .rec-sl-viewport {
                                            overflow: hidden;
                                            position: relative;
                                            border-radius: 16px;
                                        }
                                        .rec-sl-track {
                                            display: flex;
                                            transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
                                            will-change: transform;
                                            gap: 14px;
                                        }

                                        /* ── Card ── */
                                        .rec-sl-card {
                                            flex: 0 0 calc(50% - 7px);
                                            background: var(--white, #fff);
                                            border-radius: 16px;
                                            border: 1.5px solid var(--gray-200, #e5e7eb);
                                            overflow: hidden;
                                            display: flex;
                                            flex-direction: column;
                                            cursor: pointer;
                                            transition: border-color 0.3s, box-shadow 0.3s;
                                            position: relative;
                                            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                                        }
                                        .rec-sl-card:hover {
                                            border-color: var(--primary);
                                            box-shadow: 0 8px 24px var(--primary-light, rgba(0,0,0,0.12));
                                        }

                                        /* ── Image ── */
                                        .rec-sl-img {
                                            width: 100%;
                                            aspect-ratio: 1;
                                            position: relative;
                                            overflow: hidden;
                                            background: var(--gray-100, #f3f4f6);
                                        }
                                        .rec-sl-img img {
                                            width: 100%; height: 100%;
                                            object-fit: cover;
                                            transition: transform 0.5s ease;
                                        }
                                        .rec-sl-card:hover .rec-sl-img img {
                                            transform: scale(1.06);
                                        }

                                        /* ── Badges ── */
                                        .rec-sl-badge {
                                            position: absolute;
                                            top: 9px; right: 9px;
                                            background: var(--primary);
                                            color: #fff;
                                            font-size: 9px; font-weight: 800;
                                            padding: 4px 8px;
                                            border-radius: 20px;
                                            display: flex; align-items: center; gap: 3px;
                                            z-index: 5;
                                            box-shadow: 0 2px 8px var(--primary-light, rgba(0,0,0,0.2));
                                            font-family: 'Tajawal', sans-serif;
                                        }
                                        .rec-sl-disc {
                                            position: absolute;
                                            top: 9px; left: 9px;
                                            background: #ef4444;
                                            color: #fff;
                                            font-size: 9px; font-weight: 800;
                                            padding: 4px 8px;
                                            border-radius: 20px;
                                            z-index: 5;
                                            font-family: 'Tajawal', sans-serif;
                                        }
                                        .rec-sl-fav {
                                            position: absolute;
                                            bottom: 9px; left: 9px;
                                            width: 29px; height: 29px;
                                            border-radius: 50%;
                                            background: rgba(255,255,255,0.92);
                                            border: 1px solid var(--gray-200, #e5e7eb);
                                            display: flex; align-items: center; justify-content: center;
                                            color: #f43f5e;
                                            font-size: 12px;
                                            cursor: pointer;
                                            z-index: 5;
                                            transition: all 0.25s;
                                        }
                                        .rec-sl-fav:hover { background: #f43f5e; color: #fff; }

                                        /* ── Info ── */
                                        .rec-sl-info {
                                            padding: 11px 12px 13px;
                                            display: flex;
                                            flex-direction: column;
                                            gap: 7px;
                                            flex: 1;
                                        }
                                        .rec-sl-name {
                                            font-size: 12px;
                                            font-weight: 700;
                                            color: var(--dark, #111);
                                            line-height: 1.45;
                                            display: -webkit-box;
                                            -webkit-line-clamp: 2;
                                            line-clamp: 2;
                                            -webkit-box-orient: vertical;
                                            overflow: hidden;
                                            font-family: 'Tajawal', sans-serif;
                                            transition: color 0.2s;
                                        }
                                        .rec-sl-card:hover .rec-sl-name { color: var(--primary); }
                                        .rec-sl-bottom {
                                            display: flex;
                                            align-items: center;
                                            justify-content: space-between;
                                            margin-top: auto;
                                        }
                                        .rec-sl-price-new {
                                            font-size: 17px;
                                            font-weight: 900;
                                            color: var(--primary);
                                            font-family: 'Tajawal', sans-serif;
                                            display: flex;
                                            align-items: center;
                                            flex-wrap: wrap;
                                            gap: 4px;
                                        }
                                        .rec-sl-price-old {
                                            font-size: 11px;
                                            color: var(--gray-400, #9ca3af);
                                            text-decoration: line-through;
                                            font-family: 'Tajawal', sans-serif;
                                        }
                                        .rec-sl-cart {
                                            width: 32px; height: 32px;
                                            border-radius: 8px;
                                            background: var(--primary);
                                            color: #fff;
                                            border: none;
                                            display: flex; align-items: center; justify-content: center;
                                            cursor: pointer;
                                            font-size: 12px;
                                            transition: all 0.25s;
                                            box-shadow: 0 3px 10px var(--primary-light, rgba(0,0,0,0.2));
                                            flex-shrink: 0;
                                        }
                                        .rec-sl-cart:hover { transform: scale(1.12) rotate(-5deg); filter: brightness(1.1); }

                                        /* ── Dots ── */
                                        .rec-sl-dots {
                                            display: flex;
                                            justify-content: center;
                                            gap: 6px;
                                            margin-top: 14px;
                                        }
                                        .rec-sl-dot {
                                            width: 6px; height: 6px;
                                            border-radius: 50%;
                                            background: var(--gray-200, #e5e7eb);
                                            cursor: pointer;
                                            transition: all 0.3s ease;
                                            border: none;
                                            padding: 0;
                                        }
                                        .rec-sl-dot.active {
                                            width: 20px;
                                            border-radius: 10px;
                                            background: var(--primary);
                                        }

                                        /* ── Desktop: show 4 per view ── */
                                        @media (min-width: 640px) {
                                            .rec-sl-card { flex: 0 0 calc(33.333% - 10px); }
                                        }
                                        @media (min-width: 900px) {
                                            .rec-sl-card { flex: 0 0 calc(25% - 11px); }
                                            .rec-sl-title { font-size: 20px; }
                                            .rec-sl-icon { width: 44px; height: 44px; }
                                            .rec-sl-section { padding: 24px 20px 28px; }
                                        }

                                        /* ── Animation ── */
                                        @keyframes recIconPulse {
                                            0%, 100% { transform: rotate(0deg) scale(1); }
                                            30% { transform: rotate(18deg) scale(1.15); }
                                            60% { transform: rotate(-10deg) scale(1.05); }
                                        }
                                        .rec-sl-arrows { display: flex; gap: 8px; flex-shrink: 0; }
                                        .rec-sl-arrow {
                                            width: 34px; height: 34px; border-radius: 50%;
                                            background: var(--primary-light, rgba(0,0,0,0.05)); border: 1.5px solid var(--primary-light, rgba(0,0,0,0.1));
                                            color: var(--primary); font-size: 13px; cursor: pointer;
                                            display: flex; align-items: center; justify-content: center;
                                            transition: all 0.25s ease; flex-shrink: 0;
                                        }
                                        .rec-sl-arrow:hover { background: var(--primary); color: #fff; border-color: var(--primary); transform: scale(1.08); }
                                        .rec-sl-arrow:active { transform: scale(0.95); }
                                    </style>

                                    <div class="rec-sl-header">
                                        <div class="rec-sl-title-wrap">
                                            <div class="rec-sl-icon"><i class="fas fa-star"></i></div>
                                            <div>
                                                <h2 class="rec-sl-title">${s.title || 'منتجات موصى بها'}</h2>
                                                <div class="rec-sl-subtitle">اختيارات مميزة لك ✨</div>
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                            <a href="/?app=product.cat.all&filter=recommended" class="rec-sl-viewall">
                                                عرض الكل <i class="fa fa-chevron-left" style="font-size:9px;"></i>
                                            </a>
                                            <div class="rec-sl-arrows">
                                                <button class="rec-sl-arrow" id="${sliderID}_prev" aria-label="السابق"><i class="fa fa-chevron-right"></i></button>
                                                <button class="rec-sl-arrow" id="${sliderID}_next" aria-label="التالي"><i class="fa fa-chevron-left"></i></button>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="rec-sl-viewport" id="${sliderID}_vp">
                                        <div class="rec-sl-track" id="${sliderID}_track">
                            `;

                            recommendedProducts.forEach((p) => {
                                const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                                productsHTML += `
                                    <div class="rec-sl-card" onclick="window.location.href='/?app=product.show.${p.id}'">
                                        <div class="rec-sl-img">
                                            <div class="rec-sl-badge"><i class="fas fa-crown"></i> موصى به</div>
                                            ${discount > 0 ? `<div class="rec-sl-disc">خصم ${discount}%</div>` : ''}
                                            <button class="rec-sl-fav" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                            <img src="${p.image}" alt="${p.name}" loading="lazy">
                                        </div>
                                        <div class="rec-sl-info">
                                            <span class="rec-sl-name">${p.name}</span>
                                            ${buildVariantChipsHTML(p)}
                                            <div class="rec-sl-bottom">
                                                <div>
                                                    <div class="rec-sl-price-new">${currency}${p.price}</div>
                                                    ${p.salePrice ? `<div class="rec-sl-price-old">${currency}${p.salePrice}</div>` : ''}
                                                </div>
                                                <button class="rec-sl-cart" onclick="${getQAOnClick(p)}">
                                                    <i class="fa fa-shopping-bag"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            });

                            productsHTML += `
                                        </div>
                                    </div>

                                    <div class="rec-sl-dots" id="${sliderID}_dots"></div>

                                    <script>
                                    (function(){
                                        var track = document.getElementById('${sliderID}_track');
                                        var dotsEl = document.getElementById('${sliderID}_dots');
                                        if (!track) return;

                                        var cards = track.querySelectorAll('.rec-sl-card');
                                        var total = cards.length;
                                        var current = 0;
                                        var timer = null;
                                        var perView = 2;

                                        function getPerView() {
                                            var w = window.innerWidth;
                                            if (w >= 900) return 4;
                                            if (w >= 640) return 3;
                                            return 2;
                                        }

                                        function getCardWidth() {
                                            if (!cards[0]) return 0;
                                            var style = window.getComputedStyle(track);
                                            var gap = parseFloat(style.gap) || 14;
                                            return cards[0].getBoundingClientRect().width + gap;
                                        }

                                        function goTo(idx) {
                                            perView = getPerView();
                                            var max = Math.max(0, total - perView);
                                            if (idx < 0) idx = max;
                                            if (idx > max) idx = 0;
                                            current = idx;
                                            var w = getCardWidth();
                                            track.style.transform = 'translateX(' + (current * w) + 'px)';
                                            updateDots();
                                        }

                                        function buildDots() {
                                            perView = getPerView();
                                            var steps = Math.max(1, total - perView + 1);
                                            dotsEl.innerHTML = '';
                                            for (var i = 0; i < steps; i++) {
                                                (function(i){
                                                    var d = document.createElement('button');
                                                    d.className = 'rec-sl-dot' + (i === 0 ? ' active' : '');
                                                    d.onclick = function(){ goTo(i); resetTimer(); };
                                                    dotsEl.appendChild(d);
                                                })(i);
                                            }
                                        }

                                        function updateDots() {
                                            var dots = dotsEl.querySelectorAll('.rec-sl-dot');
                                            dots.forEach(function(d, i){ d.classList.toggle('active', i === current); });
                                        }

                                        function next() {
                                             if (!track.isConnected) {
                                                 clearInterval(timer);
                                                 return;
                                             }
                                             goTo(current + 1);
                                         }

                                         function startTimer() {
                                             timer = setInterval(next, 3000);
                                         }

                                         function resetTimer() {
                                             clearInterval(timer);
                                             startTimer();
                                         }

                                        // Pause on hover
                                        track.parentElement.parentElement.addEventListener('mouseenter', function(){ clearInterval(timer); });
                                        track.parentElement.parentElement.addEventListener('mouseleave', startTimer);

                                        // Touch swipe
                                        var touchStart = 0;
                                        track.addEventListener('touchstart', function(e){ touchStart = e.touches[0].clientX; }, {passive:true});
                                        track.addEventListener('touchend', function(e){
                                            var diff = touchStart - e.changedTouches[0].clientX;
                                            if (Math.abs(diff) > 40) { diff > 0 ? goTo(current + 1) : goTo(current - 1); resetTimer(); }
                                        }, {passive:true});

                                        // Resize
                                        window.addEventListener('resize', function(){ buildDots(); goTo(0); });

                                        // Arrow buttons
                                        var prevBtn = document.getElementById('${sliderID}_prev');
                                        var nextBtn = document.getElementById('${sliderID}_next');
                                        if (prevBtn) prevBtn.onclick = function(){ goTo(current - 1); resetTimer(); };
                                        if (nextBtn) nextBtn.onclick = function(){ goTo(current + 1); resetTimer(); };

                                        // Init
                                        buildDots();
                                        startTimer();
                                    })();
                                    <\/script>
                                </div>
                            `;
                        }
                    } else if (s.type === 'category_products' && s.categoryId) {
                        if (s.categoryId === 'all') {
                            console.log('ALL CATEGORIES BRANCH ENTERED');

                            // Group products: roll subcategory products up to parent
                            const groupedAll = {};
                            visibleProducts.filter(p => !checkComingSoon(p)).forEach(p => {
                                const pCats = Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : [p.category || 'general'];
                                pCats.forEach(catId => {
                                    let rootId = catId;
                                    const catObj = categories.find(c => c.id === catId);
                                    if (catObj && catObj.parentId) rootId = catObj.parentId;
                                    if (!groupedAll[rootId]) groupedAll[rootId] = [];
                                    if (!groupedAll[rootId].find(item => item.id === p.id)) groupedAll[rootId].push(p);
                                });
                            });

                            categories.filter(cat => !cat.parentId).forEach(cat => {
                                let catProducts = groupedAll[cat.id] || [];
                                if (s.limit) catProducts = catProducts.slice(0, s.limit);

                                if (catProducts.length > 0) {
                                    // Build subcategory cards
                                    const subCats = categories.filter(c => c.parentId === cat.id);
                                    const subCatsHTML = subCats.length > 0 ? `
                                        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; align-items:stretch;">
                                            <a href="/?app=product.cat.${cat.id}" style="text-decoration:none; background:var(--primary); color:#fff; border-radius:16px; font-size:13px; font-weight:800; display:inline-flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:14px 20px; transition:all 0.25s; box-shadow:0 4px 14px rgba(250,0,0,0.25); min-width:80px;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(250,0,0,0.35)';" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 14px rgba(250,0,0,0.25)';">
                                                <i class="fa fa-th" style="font-size:22px;"></i>
                                                <span>الكل</span>
                                            </a>
                                            ${subCats.map(sc => {
                                        const imgSrc = sc.icon || sc.image;
                                        const imgHTML = imgSrc
                                            ? `<img src="${imgSrc}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid var(--gray-200);" onerror="this.style.display='none';">`
                                            : `<div style="width:48px;height:48px;border-radius:12px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><i class="fa fa-folder-open" style="font-size:20px;color:var(--primary);"></i></div>`;
                                        return `
                                                <a href="/?app=product.cat.${sc.id}" style="text-decoration:none; background:#fff; border:1.5px solid var(--gray-200); border-radius:16px; font-size:13px; font-weight:700; color:var(--dark); display:inline-flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:14px 18px; transition:all 0.25s ease; box-shadow:0 2px 8px rgba(0,0,0,0.06); min-width:80px;" onmouseover="this.style.borderColor='var(--primary)';this.style.color='var(--primary)';this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)';" onmouseout="this.style.borderColor='var(--gray-200)';this.style.color='var(--dark)';this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)';">
                                                    ${imgHTML}
                                                    <span>${sc.name}</span>
                                                </a>`;
                                    }).join('')}
                                        </div>
                                    ` : '';

                                    productsHTML += `
                                        <div class="section-header">
                                            <h2 class="section-title">
                                                ${cat.name}
                                                <span style="font-size:14px; font-weight:400; color:var(--gray-400); margin-right:8px;">(${catProducts.length} منتج)</span>
                                            </h2>
                                            <a href="/?app=product.cat.${cat.id}" class="view-all">عرض الكل <i class="fa fa-chevron-left"></i></a>
                                        </div>
                                        ${subCatsHTML}
                                        <div class="product-grid">
                                    `;
                                    catProducts.forEach((p, idx) => {
                                        const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                                        const isHidden = idx >= 12;
                                        const isNew = (Date.now() - parseInt(p.id)) < (48 * 60 * 60 * 1000);
                                        const isComingSoon = p.advanced && p.advanced.isComingSoon;

                                        productsHTML += `
                                            <div class="product-card ${isComingSoon ? 'coming-soon-card' : ''} ${isHidden ? 'hidden-product-card' : ''}" style="${isHidden ? 'display: none;' : ''}" onclick="window.location.href='/?app=product.show.${p.id}'">
                                                <span class="product-cat" style="padding: 8px 12px 0; text-align: center;">${cat.name}</span>
                                                <div class="product-img">
                                                    ${isComingSoon ? `<div class="coming-soon-badge">قريباً</div>` : (isNew ? `<div class="new-badge">جديد</div>` : '')}
                                                    ${discount > 0 && !isComingSoon ? `<div class="discount-badge">خصم ${discount}%</div>` : ''}
                                                    <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                                    <img src="${p.image}" alt="${p.name}" loading="lazy" style="${isComingSoon ? 'filter: grayscale(0.5) opacity(0.8);' : ''}">
                                                </div>
                                                <div class="product-info">
                                                    <span class="product-name">${p.name}</span>
                                                    ${buildVariantChipsHTML(p)}
                                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                                        <div class="product-price">
                                                            ${isComingSoon ? '<span style="color:var(--gray-500); font-size:14px;">بانتظار التوفر</span>' : `${currency}${p.price}${p.salePrice ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}`}
                                                        </div>
                                                        ${isComingSoon ? `
                                                            <button class="cart-icon-btn" disabled style="background:var(--gray-200); color:var(--gray-400); cursor:not-allowed;"><i class="fas fa-lock"></i></button>
                                                        ` : `
                                                            <button class="cart-icon-btn" onclick="${getQAOnClick(p)}" title="إضافة للسلة"><i class="fa fa-shopping-bag"></i></button>
                                                        `}
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    });
                                    productsHTML += `</div>`;

                                    if (catProducts.length > 12) {
                                        productsHTML += `
                                            <div class="load-more-container" style="text-align:center; margin: 30px auto 10px;">
                                                <button id="btnLoadMore" onclick="loadMoreProducts()" style="padding:12px 35px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-weight:800; font-size:16px; cursor:pointer; box-shadow:0 10px 20px var(--primary-light); transition:all 0.3s ease;">عرض المزيد من المنتجات <i class="fa fa-chevron-down" style="margin-right:8px;"></i></button>
                                            </div>
                                        `;
                                    }
                                }
                            });
                        } else {
                            const cat = categories.find(c => c.id === s.categoryId) || { name: 'منتجات مختارة' };
                            let catProducts = visibleProducts.filter(p => {
                                const cats = Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : [p.category || 'general'];
                                return cats.includes(s.categoryId);
                            });
                            if (s.limit) {
                                catProducts = catProducts.slice(0, s.limit);
                            }

                            if (catProducts.length > 0) {
                                productsHTML += `
                                    <div class="section-header">
                                        <h2 class="section-title">
                                            ${cat.name}
                                            <span style="font-size:14px; font-weight:400; color:var(--gray-400); margin-right:8px;">(${catProducts.length} منتج)</span>
                                        </h2>
                                        <a href="/?app=product.cat.${s.categoryId}" class="view-all">عرض الكل <i class="fa fa-chevron-left"></i></a>
                                    </div>
                                    <div class="product-grid">
                                `;
                                catProducts.forEach((p, idx) => {
                                    const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                                    const isHidden = idx >= 12;
                                    productsHTML += `
                                        <div class="product-card ${isHidden ? 'hidden-product-card' : ''}" style="${isHidden ? 'display: none;' : ''}" onclick="window.location.href='/?app=product.show.${p.id}'">
                                            <span class="product-cat" style="padding: 8px 12px 0; text-align: center;">${cat.name}</span>
                                            <div class="product-img">
                                                ${discount > 0 ? `<div class="discount-badge">خصم ${discount}%</div>` : ''}
                                                <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                                <img src="${p.image}" alt="${p.name}" loading="lazy">
                                            </div>
                                            <div class="product-info">
                                                <span class="product-name">${p.name}</span>
                                                ${buildVariantChipsHTML(p)}
                                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                                    <div class="product-price">
                                                        ${currency}${p.price}
                                                        ${p.salePrice ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}
                                                    </div>
                                                    <button class="cart-icon-btn" onclick="${getQAOnClick(p)}" title="إضافة للسلة">
                                                            <i class="fa fa-shopping-bag"></i>
                                                        </button>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                });
                                productsHTML += `</div>`;

                                if (catProducts.length > 12) {
                                    productsHTML += `
                                        <div class="load-more-container" style="text-align:center; margin: 30px auto 10px;">
                                            <button id="btnLoadMore" onclick="loadMoreProducts()" style="padding:12px 35px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-weight:800; font-size:16px; cursor:pointer; box-shadow:0 10px 20px var(--primary-light); transition:all 0.3s ease;">عرض المزيد من المنتجات <i class="fa fa-chevron-down" style="margin-right:8px;"></i></button>
                                        </div>
                                    `;
                                }
                            }
                        }
                    } else if (s.type === 'category_tabs') {
                        let selectedCatIds = s.categoryIds || [];
                        if (!Array.isArray(selectedCatIds) || selectedCatIds.length === 0) {
                            selectedCatIds = categories.filter(c => !c.parentId).slice(0, 4).map(c => c.id);
                        }

                        const activeCats = selectedCatIds.map(id => categories.find(c => c.id === id)).filter(Boolean);

                        if (activeCats.length > 0) {
                            const sectionID = 'tabs_' + s.id.replace(/[^a-zA-Z0-9]/g, '_');
                            productsHTML += `
                                <div class="tabs-showcase-section" id="${sectionID}">
                                    <style>
                                        .tabs-showcase-section {
                                            margin: 36px 0;
                                            padding: 24px 20px;
                                            background: var(--white, #fff);
                                            border-radius: 24px;
                                            border: 1px solid var(--gray-200, #e5e7eb);
                                            box-shadow: 0 4px 20px rgba(0,0,0,0.02);
                                        }
                                        .tabs-header {
                                            display: flex;
                                            flex-direction: column;
                                            gap: 12px;
                                            margin-bottom: 24px;
                                            text-align: center;
                                        }
                                        .tabs-title {
                                            font-size: 22px;
                                            font-weight: 900;
                                            color: var(--dark, #0f172a);
                                            margin: 0;
                                            font-family: 'Tajawal', sans-serif;
                                        }
                                        .tabs-container {
                                            display: flex;
                                            gap: 10px;
                                            justify-content: center;
                                            flex-wrap: wrap;
                                            margin-bottom: 28px;
                                            overflow-x: auto;
                                            padding-bottom: 5px;
                                            -webkit-overflow-scrolling: touch;
                                        }
                                        .tabs-container::-webkit-scrollbar {
                                            height: 5px;
                                        }
                                        .tabs-container::-webkit-scrollbar-thumb {
                                            background: var(--gray-200, #e2e8f0);
                                            border-radius: 10px;
                                        }
                                        .tab-btn {
                                            padding: 10px 22px;
                                            border-radius: 50px;
                                            border: 1.5px solid var(--gray-200, #e2e8f0);
                                            background: #f8fafc;
                                            color: var(--gray-600, #475569);
                                            font-size: 14px;
                                            font-weight: 800;
                                            cursor: pointer;
                                            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                                            font-family: 'Tajawal', sans-serif;
                                            white-space: nowrap;
                                            display: inline-flex;
                                            align-items: center;
                                            gap: 8px;
                                        }
                                        .tab-btn:hover {
                                            border-color: var(--primary);
                                            color: var(--primary);
                                            background: var(--primary-light, rgba(0,0,0,0.02));
                                            transform: translateY(-2px);
                                        }
                                        .tab-btn.active {
                                            background: var(--primary);
                                            border-color: var(--primary);
                                            color: #fff;
                                            box-shadow: 0 8px 20px var(--primary-light, rgba(0,0,0,0.2));
                                        }
                                        .tab-grid {
                                            display: none;
                                            animation: tabFadeIn 0.5s ease forwards;
                                        }
                                        .tab-grid.active {
                                            display: grid;
                                        }
                                        @keyframes tabFadeIn {
                                            from { opacity: 0; transform: translateY(12px); }
                                            to { opacity: 1; transform: translateY(0); }
                                        }
                                        @media (max-width: 640px) {
                                            .tabs-showcase-section {
                                                padding: 16px 12px;
                                                margin: 20px 0;
                                                border-radius: 16px;
                                            }
                                            .tabs-container {
                                                gap: 8px;
                                                margin-bottom: 20px;
                                                flex-wrap: wrap;
                                                justify-content: center;
                                            }
                                            .tab-btn {
                                                padding: 6px 12px;
                                                font-size: 11px;
                                                gap: 5px;
                                                border-radius: 30px;
                                            }
                                            .tab-btn img {
                                                width: 14px !important;
                                                height: 14px !important;
                                            }
                                            .tabs-title {
                                                font-size: 17px;
                                            }
                                        }
                                    </style>
                                    
                                    <div class="tabs-header">
                                        <h2 class="tabs-title">${s.title || 'تصفح منتجاتنا المميزة'} 🏷️</h2>
                                    </div>
                                    
                                    <div class="tabs-container">
                            `;

                            activeCats.forEach((cat, idx) => {
                                const isActive = idx === 0 ? 'active' : '';
                                const iconHTML = cat.icon ? `<img src="${cat.icon}" style="width:18px;height:18px;object-fit:cover;border-radius:4px;" onerror="this.style.display='none';">` : '<i class="fas fa-tag"></i>';
                                productsHTML += `
                                    <button class="tab-btn ${isActive}" data-tab="${cat.id}" onclick="switchCategoryTab('${cat.id}', '${sectionID}')">
                                        ${iconHTML}
                                        <span>${cat.name}</span>
                                    </button>
                                `;
                            });

                            productsHTML += `
                                    </div>
                                    <div class="tabs-content-wrapper">
                            `;

                            activeCats.forEach((cat, idx) => {
                                const isActive = idx === 0 ? 'active' : '';
                                let catProducts = visibleProducts.filter(p => {
                                    const cats = Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : [p.category || 'general'];
                                    return cats.includes(cat.id) && !checkComingSoon(p);
                                });

                                if (s.limit) {
                                    catProducts = catProducts.slice(0, s.limit);
                                }

                                productsHTML += `
                                    <div class="tab-grid product-grid ${isActive}" id="grid_${sectionID}_${cat.id}">
                                `;

                                if (catProducts.length === 0) {
                                    productsHTML += `
                                        <div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--gray-400);">
                                            <i class="fas fa-box-open" style="font-size:36px; margin-bottom:10px; opacity:0.6;"></i>
                                            <p style="font-size:14px; font-weight:700;">لا توجد منتجات متوفرة حالياً في هذا القسم</p>
                                        </div>
                                    `;
                                } else {
                                    catProducts.forEach((p) => {
                                        const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                                        const isNew = (Date.now() - parseInt(p.id)) < (48 * 60 * 60 * 1000);

                                        productsHTML += `
                                            <div class="product-card" onclick="window.location.href='/?app=product.show.${p.id}'">
                                                <span class="product-cat" style="padding: 8px 12px 0; text-align: center;">${cat.name}</span>
                                                <div class="product-img">
                                                    ${isNew ? `<div class="new-badge">جديد</div>` : ''}
                                                    ${discount > 0 ? `<div class="discount-badge">خصم ${discount}%</div>` : ''}
                                                    <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                                    <img src="${p.image}" alt="${p.name}" loading="lazy">
                                                </div>
                                                <div class="product-info">
                                                    <span class="product-name">${p.name}</span>
                                                    ${buildVariantChipsHTML(p)}
                                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                                        <div class="product-price">
                                                            ${currency}${p.price}
                                                            ${p.salePrice ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}
                                                        </div>
                                                        <button class="cart-icon-btn" onclick="${getQAOnClick(p)}" title="إضافة للسلة">
                                                            <i class="fa fa-shopping-bag"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    });
                                }

                                productsHTML += `
                                    </div>
                                `;
                            });

                            productsHTML += `
                                    </div>
                                    <script>
                                    if (typeof window.switchCategoryTab !== 'function') {
                                        window.switchCategoryTab = function(catId, sectionId) {
                                            var sec = document.getElementById(sectionId);
                                            if (!sec) return;
                                            sec.querySelectorAll('.tab-btn').forEach(function(btn) {
                                                btn.classList.toggle('active', btn.getAttribute('data-tab') === catId);
                                            });
                                            sec.querySelectorAll('.tab-grid').forEach(function(grid) {
                                                grid.classList.toggle('active', grid.id === 'grid_' + sectionId + '_' + catId);
                                            });
                                        };
                                    }
                                    </script>
                                </div>
                            `;
                        }
                    } else if (s.type === 'testimonials') {
                        const reviews = s.reviews || [];
                        if (reviews.length > 0) {
                            const tsID = 'ts_' + s.id.replace(/[^a-zA-Z0-9]/g, '_');
                            productsHTML += `
                                <div class="ts-section" id="${tsID}">
                                    <style>
                                        .ts-section {
                                            margin: 40px 0;
                                            padding: 40px 25px;
                                            background: rgba(168,85,247,0.02);
                                            border-radius: 28px;
                                            position: relative;
                                            overflow: hidden;
                                        }
                                        .ts-header {
                                            display: flex;
                                            justify-content: space-between;
                                            align-items: center;
                                            margin-bottom: 28px;
                                            gap: 20px;
                                            flex-wrap: wrap;
                                            border-bottom: 1.5px dashed rgba(168,85,247,0.15);
                                            padding-bottom: 18px;
                                        }
                                        .ts-header-text {
                                            text-align: right;
                                        }
                                        .ts-title {
                                            font-size: 24px; font-weight: 900; color: #3b0764;
                                            margin: 0 0 6px; font-family: 'Tajawal', sans-serif;
                                        }
                                        .ts-subtitle { font-size: 13.5px; color: #7e22ce; font-weight: 600; opacity: 0.85; margin: 0; }
                                        .ts-track-wrap { overflow: hidden; position: relative; cursor: grab; }
                                        .ts-track-wrap:active { cursor: grabbing; }
                                        .ts-track {
                                            display: flex; gap: 20px;
                                            will-change: transform;
                                            transition: transform 0.5s cubic-bezier(0.4,0,0.2,1);
                                        }
                                        .ts-card {
                                            flex: 0 0 290px;
                                            background: #fff; border-radius: 20px; padding: 24px;
                                            box-shadow: 0 6px 20px rgba(168,85,247,0.05);
                                            border: 1.5px solid rgba(168,85,247,0.08);
                                            display: flex; flex-direction: column;
                                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                            position: relative;
                                            box-sizing: border-box;
                                        }
                                        .ts-card:hover {
                                            transform: translateY(-6px);
                                            box-shadow: 0 16px 40px rgba(168,85,247,0.13);
                                            border-color: rgba(168,85,247,0.24);
                                        }
                                        .ts-card-header {
                                            display: flex;
                                            align-items: center;
                                            gap: 12px;
                                            margin-bottom: 14px;
                                            direction: rtl;
                                        }
                                        .ts-avatar {
                                            width: 46px;
                                            height: 46px;
                                            border-radius: 50%;
                                            background: linear-gradient(135deg,#a855f7,#7c3aed);
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            color: #fff;
                                            font-size: 16px;
                                            font-weight: 800;
                                            font-family: 'Tajawal', sans-serif;
                                            flex-shrink: 0;
                                            overflow: hidden;
                                            border: 2px solid #f3e8ff;
                                            box-sizing: border-box;
                                            box-shadow: 0 4px 10px rgba(168,85,247,0.1);
                                        }
                                        .ts-avatar img {
                                            width: 100%;
                                            height: 100%;
                                            object-fit: cover;
                                        }
                                        .ts-stars { display: flex; gap: 3px; margin-bottom: 10px; direction: rtl; }
                                        .ts-star { color: #f59e0b; font-size: 13px; }
                                        .ts-star.empty { color: #e5e7eb; }
                                        .ts-text {
                                            font-size: 13.5px; color: #4b5563; line-height: 1.65;
                                            font-family: 'Tajawal', sans-serif; margin: 0; flex: 1;
                                            font-weight: 500; text-align: right;
                                        }
                                        .ts-name { font-size: 14.5px; font-weight: 800; color: #3b0764; font-family: 'Tajawal', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
                                        .ts-verified { font-size: 11px; color: #10b981; font-weight: 700; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
                                        .ts-quote-mark {
                                            font-size: 32px;
                                            color: rgba(168,85,247,0.15);
                                            font-family: Georgia, serif;
                                            line-height: 1;
                                            margin-right: auto;
                                            align-self: flex-start;
                                            margin-top: -5px;
                                        }
                                        .ts-dots { display: flex; justify-content: center; gap: 8px; margin-top: 24px; }
                                        .ts-dot {
                                            width: 8px; height: 8px; border-radius: 50%;
                                            background: rgba(168,85,247,0.25); border: none;
                                            cursor: pointer; transition: all 0.3s ease; padding: 0;
                                        }
                                        .ts-dot.active { width: 24px; border-radius: 10px; background: #a855f7; }
                                        .ts-add-review-btn {
                                            background: linear-gradient(135deg, #a855f7, #7c3aed);
                                            color: #fff;
                                            border: none;
                                            padding: 10px 20px;
                                            border-radius: 12px;
                                            font-weight: 800;
                                            font-family: 'Tajawal', sans-serif;
                                            cursor: pointer;
                                            font-size: 13.5px;
                                            box-shadow: 0 4px 15px rgba(168,85,247,0.2);
                                            transition: all 0.3s ease;
                                            display: inline-flex;
                                            align-items: center;
                                            gap: 6px;
                                        }
                                        .ts-add-review-btn:hover {
                                            transform: translateY(-2px);
                                            box-shadow: 0 6px 20px rgba(168,85,247,0.3);
                                        }
                                        @media (max-width: 640px) {
                                            .ts-section { padding: 25px 15px; border-radius: 20px; }
                                            .ts-header {
                                                flex-direction: column;
                                                align-items: center;
                                                text-align: center;
                                                gap: 15px;
                                                padding-bottom: 14px;
                                            }
                                            .ts-header-text {
                                                text-align: center;
                                            }
                                            .ts-card { flex: 0 0 250px; padding: 20px 16px; }
                                        }
                                        .ts-arrows { display: flex; gap: 8px; flex-shrink: 0; }
                                        .ts-arrow {
                                            width: 34px; height: 34px; border-radius: 50%;
                                            background: rgba(168,85,247,0.1); border: 1.5px solid rgba(168,85,247,0.25);
                                            color: #7c3aed; font-size: 13px; cursor: pointer;
                                            display: flex; align-items: center; justify-content: center;
                                            transition: all 0.25s ease; flex-shrink: 0;
                                        }
                                        .ts-arrow:hover { background: #a855f7; color: #fff; border-color: #a855f7; transform: scale(1.08); }
                                        .ts-arrow:active { transform: scale(0.95); }
                                    </style>

                                    <div class="ts-header">
                                        <div class="ts-header-text">
                                            <h2 class="ts-title">${s.title || 'آراء زبائننا ⭐'}</h2>
                                            ${s.subtitle ? `<div class="ts-subtitle">${s.subtitle}</div>` : ''}
                                        </div>
                                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex-shrink:0;">
                                            <button class="ts-add-review-btn" onclick="openAddReviewModal()"><i class="fas fa-pen" style="margin-left: 6px;"></i> شاركنا تقييمك</button>
                                            <div class="ts-arrows">
                                                <button class="ts-arrow" id="${tsID}_prev" aria-label="السابق"><i class="fa fa-chevron-right"></i></button>
                                                <button class="ts-arrow" id="${tsID}_next" aria-label="التالي"><i class="fa fa-chevron-left"></i></button>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="ts-track-wrap" id="${tsID}_wrap">
                                        <div class="ts-track" id="${tsID}_track">
                            `;

                            reviews.forEach((r) => {
                                const rating = Math.min(5, Math.max(1, parseInt(r.rating) || 5));
                                const stars = Array.from({length: 5}, (_, i) =>
                                    `<span class="ts-star${i < rating ? '' : ' empty'}"><i class="fas fa-star"></i></span>`
                                ).join('');
                                const initial = (r.name || 'ز').charAt(0);
                                
                                productsHTML += `
                                    <div class="ts-card">
                                        <div class="ts-card-header">
                                            <div class="ts-avatar">
                                                ${initial}
                                            </div>
                                            <div style="flex: 1; min-width: 0; text-align: right;">
                                                <h4 class="ts-name">${r.name || 'زبون'}</h4>
                                                <div class="ts-verified" style="color: #10b981;"><i class="fas fa-check-circle"></i> زبون موثق</div>
                                            </div>
                                            <div class="ts-quote-mark">”</div>
                                        </div>
                                        <div class="ts-stars">${stars}</div>
                                        <p class="ts-text">${r.text || ''}</p>
                                        
                                        <div style="margin-top: auto; padding-top: 14px;">
                                            ${r.avatar ? `
                                                <div style="position: relative; border-radius: 12px; overflow: hidden; border: 1.5px solid rgba(16,185,129,0.22); cursor: pointer; height: 110px; box-shadow: 0 4px 10px rgba(16,185,129,0.05);" onclick="window.openLightboxModal('${r.avatar}')" title="انقر لتكبير إثبات التقييم">
                                                    <img src="${r.avatar}" alt="إثبات التقييم" style="width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                                    <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(15,23,42,0.8), transparent); padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; direction: rtl;">
                                                        <span style="font-size: 10.5px; color: #10b981; font-weight: 800; display: flex; align-items: center; gap: 4px; font-family: 'Tajawal', sans-serif;">
                                                            <i class="fas fa-camera"></i> صورة إثبات من الزبون
                                                        </span>
                                                        <span style="font-size: 9px; color: rgba(255,255,255,0.9); font-weight: 700; font-family: 'Tajawal', sans-serif;">
                                                            تكبير الصورة <i class="fas fa-expand-alt" style="font-size:8px;"></i>
                                                        </span>
                                                    </div>
                                                </div>
                                            ` : `
                                                <div style="border-radius: 12px; overflow: hidden; border: 1.5px solid rgba(168,85,247,0.12); height: 110px; background: linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(124,58,237,0.05) 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 12px; box-sizing: border-box;">
                                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, rgba(168,85,247,0.12), rgba(124,58,237,0.12)); display: flex; align-items: center; justify-content: center; color: #7c3aed;">
                                                        <i class="fas fa-shield-alt" style="font-size: 14px;"></i>
                                                    </div>
                                                    <span style="font-size: 11.5px; color: #3b0764; font-weight: 800; font-family: 'Tajawal', sans-serif;">تقييم معتمد وموثق</span>
                                                    <span style="font-size: 9.5px; color: #7e22ce; font-weight: 700; font-family: 'Tajawal', sans-serif;">شراء مؤكد من المتجر 🔒</span>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                `;
                            });

                            productsHTML += `
                                        </div>
                                    </div>

                                    <div class="ts-dots" id="${tsID}_dots"></div>

                                    <style>
                                        .ts-modal-overlay {
                                            position: fixed;
                                            top: 0; left: 0; right: 0; bottom: 0;
                                            background: rgba(15, 23, 42, 0.6);
                                            backdrop-filter: blur(8px);
                                            display: flex; align-items: center; justify-content: center;
                                            z-index: 10000;
                                            opacity: 0; pointer-events: none;
                                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                        }
                                        .ts-modal-overlay.active {
                                            opacity: 1; pointer-events: auto;
                                        }
                                        .ts-modal-content {
                                            background: #fff;
                                            width: 90%; max-width: 480px;
                                            padding: 30px; border-radius: 24px;
                                            box-shadow: 0 25px 50px -12px rgba(168,85,247,0.25);
                                            position: relative;
                                            transform: translateY(20px);
                                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                            direction: rtl;
                                            font-family: 'Tajawal', sans-serif;
                                        }
                                        .ts-modal-overlay.active .ts-modal-content {
                                            transform: translateY(0);
                                        }
                                        .ts-modal-close {
                                            position: absolute;
                                            top: 15px; left: 15px;
                                            background: #f3f4f6; border: none;
                                            width: 32px; height: 32px; border-radius: 50%;
                                            font-size: 20px; font-weight: 800; cursor: pointer;
                                            display: flex; align-items: center; justify-content: center;
                                            color: #6b7280; transition: all 0.2s;
                                        }
                                        .ts-modal-close:hover { background: #fee2e2; color: #ef4444; }
                                        .ts-modal-title { font-size: 20px; font-weight: 900; color: #3b0764; margin: 0 0 6px; text-align: right; }
                                        .ts-modal-subtitle { font-size: 13px; color: #6b7280; margin: 0 0 20px; line-height: 1.5; text-align: right; }
                                        .ts-form-group { margin-bottom: 16px; text-align: right; }
                                        .ts-form-label { display: block; font-size: 12px; font-weight: 800; color: #4b5563; margin-bottom: 6px; text-align: right; }
                                        .ts-form-input {
                                            width: 100%; border: 1.5px solid #e5e7eb;
                                            padding: 10px 14px; border-radius: 10px;
                                            font-size: 13px; font-family: inherit; color: #1f2937;
                                            transition: all 0.2s; background: #faf9ff;
                                            box-sizing: border-box;
                                            text-align: right;
                                        }
                                        .ts-form-input:focus {
                                            border-color: #a855f7; outline: none; background: #fff;
                                            box-shadow: 0 0 0 3px rgba(168,85,247,0.15);
                                        }
                                        .ts-upload-btn {
                                            background: #f3e8ff; color: #a855f7; border: 1.5px dashed #a855f7;
                                            width: 45px; height: 45px; border-radius: 10px;
                                            display: flex; align-items: center; justify-content: center;
                                            cursor: pointer; transition: all 0.2s; font-size: 16px; flex-shrink: 0;
                                            padding: 0;
                                        }
                                        .ts-upload-btn:hover { background: #e9d5ff; }
                                        .ts-star-rating {
                                            display: flex; flex-direction: row-reverse; justify-content: flex-end; gap: 6px;
                                        }
                                        .ts-star-rating input { display: none; }
                                        .ts-star-rating label {
                                            font-size: 22px; color: #d1d5db; cursor: pointer; transition: all 0.2s;
                                        }
                                        .ts-star-rating input:checked ~ label,
                                        .ts-star-rating label:hover,
                                        .ts-star-rating label:hover ~ label {
                                            color: #f59e0b;
                                        }
                                        .ts-submit-btn {
                                            width: 100%; background: linear-gradient(135deg, #a855f7, #7c3aed);
                                            color: #fff; border: none; padding: 12px; border-radius: 12px;
                                            font-weight: 800; font-family: inherit; font-size: 14px;
                                            cursor: pointer; margin-top: 10px; transition: all 0.2s;
                                            box-shadow: 0 4px 12px rgba(168,85,247,0.2);
                                        }
                                        .ts-submit-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(168,85,247,0.3); }
                                    </style>

                                    <div id="ts_review_modal" class="ts-modal-overlay" onclick="if(event.target===this) closeAddReviewModal()">
                                        <div class="ts-modal-content">
                                            <button class="ts-modal-close" onclick="closeAddReviewModal()">&times;</button>
                                            <h3 class="ts-modal-title">شاركنا رأيك وتجربتك ⭐</h3>
                                            <p class="ts-modal-subtitle">يسعدنا جداً سماع رأيك حول تجربتك معنا لنستمر بتقديم الأفضل!</p>
                                            
                                             <form id="ts_review_form" onsubmit="submitCustomerReview(event)">
                                                 <div class="ts-form-group">
                                                     <label class="ts-form-label">الاسم بالكامل *</label>
                                                     <input type="text" id="ts_rev_name" required placeholder="مثال: سارة محمد" class="ts-form-input">
                                                 </div>
                                                 
                                                 <div class="ts-form-group">
                                                     <label class="ts-form-label">تقييمك للمتجر والخدمة *</label>
                                                     <div class="ts-star-rating">
                                                         <input type="radio" id="star5" name="ts_rating" value="5" checked><label for="star5" title="5 نجوم"><i class="fas fa-star"></i></label>
                                                         <input type="radio" id="star4" name="ts_rating" value="4"><label for="star4" title="4 نجوم"><i class="fas fa-star"></i></label>
                                                         <input type="radio" id="star3" name="ts_rating" value="3"><label for="star3" title="3 نجوم"><i class="fas fa-star"></i></label>
                                                         <input type="radio" id="star2" name="ts_rating" value="2"><label for="star2" title="2 نجوم"><i class="fas fa-star"></i></label>
                                                         <input type="radio" id="star1" name="ts_rating" value="1"><label for="star1" title="نجمة واحدة"><i class="fas fa-star"></i></label>
                                                     </div>
                                                 </div>

                                                 <div class="ts-form-group">
                                                     <label class="ts-form-label"><i class="fas fa-camera" style="color:#a855f7; margin-left:4px;"></i> صورة إثبات (اختياري) — لقطة محادثة أو صورة المنتج</label>
                                                     <div style="display:flex; gap:10px; align-items:center;">
                                                         <div id="ts_rev_avatar_preview" style="width:56px; height:48px; border-radius:8px; background:#f3e8ff; border:1.5px dashed rgba(168,85,247,0.4); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                                                             <i class="fas fa-image" style="color:#a855f7; font-size:18px;"></i>
                                                         </div>
                                                         <input type="text" id="ts_rev_avatar" placeholder="ارفع لقطة شاشة أو صورة المنتج" class="ts-form-input" style="flex:1;" oninput="window.updateVisitorAvatarPreview(this.value)">
                                                         <button type="button" class="ts-upload-btn" onclick="window.triggerVisitorAvatarUpload()" title="ارفع صورة"><i class="fas fa-upload"></i></button>
                                                     </div>
                                                     <div style="font-size:10px; color:#9ca3af; margin-top:5px; text-align:right;"><i class="fas fa-info-circle"></i> يمكنك رفع لقطة شاشة المحادثة أو صورة المنتج كإثبات — ستظهر في تقييمك</div>
                                                     <input type="file" id="ts_rev_avatar_file" style="display:none;" accept="image/*" onchange="window.handleVisitorAvatarUpload(this)">
                                                 </div>
                                                 
                                                 <div class="ts-form-group">
                                                     <label class="ts-form-label">نص التقييم / رأيك بالمتجر *</label>
                                                     <textarea id="ts_rev_text" required rows="3" placeholder="اكتب رأيك الصادق هنا عن جودة المنتجات والتوصيل والخدمة..." class="ts-form-input"></textarea>
                                                 </div>
                                                 
                                                 <button type="submit" id="ts_submit_btn" class="ts-submit-btn">إرسال التقييم للمراجعة</button>
                                             </form>
                                        </div>
                                    </div>

                                    <script>
                                    (function(){
                                        var track = document.getElementById('${tsID}_track');
                                        if (!track) return;
                                        var dotsEl  = document.getElementById('${tsID}_dots');
                                        var wrap    = document.getElementById('${tsID}_wrap');
                                        var total   = ${reviews.length};
                                        var current = 0;
                                        var timer   = null;

                                        function getPerView() {
                                            var w = window.innerWidth;
                                            if (w >= 900) return 3;
                                            if (w >= 640) return 2;
                                            return 1;
                                        }
                                        function getCardWidth() {
                                            var cards = track.querySelectorAll('.ts-card');
                                            if (!cards[0]) return 300;
                                            var gap = parseFloat(window.getComputedStyle(track).gap) || 20;
                                            return cards[0].getBoundingClientRect().width + gap;
                                        }
                                        function goTo(idx) {
                                            var pv  = getPerView();
                                            var max = Math.max(0, total - pv);
                                            if (idx < 0) idx = max;
                                            if (idx > max) idx = 0;
                                            current = idx;
                                            track.style.transform = 'translateX(' + (current * getCardWidth()) + 'px)';
                                            updateDots();
                                        }
                                        function buildDots() {
                                            var pv    = getPerView();
                                            var steps = Math.max(1, total - pv + 1);
                                            dotsEl.innerHTML = '';
                                            for (var i = 0; i < steps; i++) {
                                                (function(i){
                                                    var d = document.createElement('button');
                                                    d.className = 'ts-dot' + (i === 0 ? ' active' : '');
                                                    d.onclick = function(){ goTo(i); resetTimer(); };
                                                    dotsEl.appendChild(d);
                                                })(i);
                                            }
                                        }
                                        function updateDots() {
                                            dotsEl.querySelectorAll('.ts-dot').forEach(function(d,i){
                                                d.classList.toggle('active', i === current);
                                            });
                                        }
                                        function next() {
                                            if (!wrap.isConnected) {
                                                clearInterval(timer);
                                                return;
                                            }
                                            goTo(current + 1);
                                        }
                                        function startTimer() { timer = setInterval(next, 3500); }
                                        function resetTimer() { clearInterval(timer); startTimer(); }

                                        if (wrap) {
                                            wrap.addEventListener('mouseenter', function(){ clearInterval(timer); });
                                            wrap.addEventListener('mouseleave', startTimer);
                                            var tx = 0;
                                            wrap.addEventListener('touchstart', function(e){ tx = e.touches[0].clientX; }, {passive:true});
                                            wrap.addEventListener('touchend', function(e){
                                                var diff = tx - e.changedTouches[0].clientX;
                                                if (Math.abs(diff) > 40) { diff > 0 ? goTo(current+1) : goTo(current-1); resetTimer(); }
                                            }, {passive:true});
                                        }
                                        window.addEventListener('resize', function(){ buildDots(); goTo(0); });
                                        var prevBtn = document.getElementById('${tsID}_prev');
                                        var nextBtn = document.getElementById('${tsID}_next');
                                        if (prevBtn) prevBtn.onclick = function(){ goTo(current - 1); resetTimer(); };
                                        if (nextBtn) nextBtn.onclick = function(){ goTo(current + 1); resetTimer(); };
                                        buildDots();
                                        startTimer();
                                    })();

                                    window.openAddReviewModal = function() {
                                        var modal = document.getElementById('ts_review_modal');
                                        if (modal) {
                                            modal.classList.add('active');
                                            modal.style.display = 'flex';
                                        }
                                    };
                                    window.closeAddReviewModal = function() {
                                        var modal = document.getElementById('ts_review_modal');
                                        if (modal) {
                                            modal.classList.remove('active');
                                            setTimeout(function() { modal.style.display = 'none'; }, 300);
                                        }
                                    };
                                    window.updateVisitorAvatarPreview = function(url) {
                                        var preview = document.getElementById('ts_rev_avatar_preview');
                                        if (preview) {
                                            if (url) {
                                                preview.innerHTML = '<img src="' + url + '" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">';
                                                preview.style.border = '1.5px solid rgba(168,85,247,0.5)';
                                            } else {
                                                preview.innerHTML = '<i class="fas fa-image" style="color:#a855f7; font-size:18px;"></i>';
                                                preview.style.border = '1.5px dashed rgba(168,85,247,0.4)';
                                            }
                                        }
                                    };
                                    window.triggerVisitorAvatarUpload = function() {
                                        var fileInput = document.getElementById('ts_rev_avatar_file');
                                        if (fileInput) fileInput.click();
                                    };
                                    window.handleVisitorAvatarUpload = function(input) {
                                        var file = input.files[0];
                                        if (!file) return;
                                        
                                        var preview = document.getElementById('ts_rev_avatar_preview');
                                        if (preview) {
                                            preview.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="color:#a855f7; font-size:16px;"></i>';
                                        }
                                        
                                        var reader = new FileReader();
                                        reader.onload = function(e) {
                                            var base64Data = e.target.result;
                                            fetch('/api/upload', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ name: file.name, data: base64Data })
                                            })
                                            .then(function(res) { return res.json(); })
                                            .then(function(data) {
                                                if (data.url) {
                                                    document.getElementById('ts_rev_avatar').value = data.url;
                                                    window.updateVisitorAvatarPreview(data.url);
                                                } else {
                                                    alert('فشل رفع الصورة الشخصية.');
                                                    window.updateVisitorAvatarPreview('');
                                                }
                                            })
                                            .catch(function(err) {
                                                console.error('Upload error:', err);
                                                alert('حدث خطأ أثناء رفع الصورة الشخصية.');
                                                window.updateVisitorAvatarPreview('');
                                            });
                                        };
                                        reader.readAsDataURL(file);
                                    };
                                    window.submitCustomerReview = function(event) {
                                        event.preventDefault();
                                        var submitBtn = document.getElementById('ts_submit_btn');
                                        if (submitBtn) {
                                            submitBtn.disabled = true;
                                            submitBtn.innerText = 'جاري الإرسال...';
                                        }
                                        
                                        var name = document.getElementById('ts_rev_name').value;
                                        var rating = parseInt(document.querySelector('input[name="ts_rating"]:checked').value) || 5;
                                        var text = document.getElementById('ts_rev_text').value;
                                        var avatar = document.getElementById('ts_rev_avatar').value;
                                        
                                        fetch('/api/testimonials/submit', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ name: name, rating: rating, text: text, avatar: avatar })
                                        })
                                        .then(function(res) { return res.json(); })
                                        .then(function(data) {
                                            if (data.success) {
                                                window.closeAddReviewModal();
                                                document.getElementById('ts_review_form').reset();
                                                window.updateVisitorAvatarPreview('');
                                                window.showCustomerToast('✨ شكراً لك! تم إرسال تقييمك بنجاح وهو الآن قيد المراجعة من الإدارة وسيتم نشره قريباً.');
                                            } else {
                                                alert('فشل إرسال التقييم. حاول مرة أخرى.');
                                            }
                                        })
                                        .catch(function(err) {
                                            console.error('Submit review error:', err);
                                            alert('حدث خطأ أثناء إرسال التقييم.');
                                        })
                                        .finally(function() {
                                            if (submitBtn) {
                                                submitBtn.disabled = false;
                                                submitBtn.innerText = 'إرسال التقييم للمراجعة';
                                            }
                                        });
                                    };
                                    window.showCustomerToast = function(message) {
                                        var toast = document.createElement('div');
                                        toast.setAttribute('style', 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#1e1b4b; color:#fff; padding:15px 30px; border-radius:16px; box-shadow:0 10px 25px rgba(0,0,0,0.25); z-index:99999; direction:rtl; font-family:Tajawal,sans-serif; font-size:14px; font-weight:800; border:2px solid #a855f7; text-align:center; max-width:90%; transition:all 0.3s ease; opacity:0;');
                                        toast.innerText = message;
                                        document.body.appendChild(toast);
                                        
                                        setTimeout(function() {
                                            toast.style.opacity = '1';
                                            toast.style.bottom = '40px';
                                        }, 50);
                                        
                                        setTimeout(function() {
                                            toast.style.opacity = '0';
                                            toast.style.bottom = '30px';
                                            setTimeout(function() { toast.remove(); }, 300);
                                        }, 5000);
                                    };
                                    </script>
                                </div>
                            `;
                        }
                    } else if (s.type === 'marquee') {
                        const texts = s.texts || [s.title || 'شحن سريع لجميع المحافظات 🚚'];
                        const singleLine = texts.map(t => `<span>${t}</span>`).join('');
                        // Repeat 5 times is enough for most cases and keeps speed stable
                        const repeatedContent = Array(5).fill(singleLine).join('');
                        productsHTML += `
                            <div class="marquee-container" style="${s.bgColor ? `background:${s.bgColor};` : ''} ${s.textColor ? `color:${s.textColor};` : ''} --speed: ${s.speed || 25}s;">
                                <div class="marquee-content">
                                    ${repeatedContent}
                                </div>
                                <div class="marquee-content">
                                    ${repeatedContent}
                                </div>
                            </div>
                        `;
                    } else if (s.type === 'badges') {
                        const items = s.items || [
                            { icon: 'fa-truck-fast', text: 'توصيل سريع' },
                            { icon: 'fa-shield-halved', text: 'ضمان الجودة' },
                            { icon: 'fa-rotate-left', text: 'تبديل سهل' },
                            { icon: 'fa-headset', text: 'دعم فني' }
                        ];
                        productsHTML += `
                            <div class="rotating-badges-section">
                                ${items.map(item => `
                                    <div class="badge-360">
                                        <div class="badge-360-icon" style="${s.iconColor ? `color:${s.iconColor};` : ''}">
                                            ${item.image ? `<img src="${item.image}" alt="${item.text}" style="width:100%; height:100%; object-fit:contain;">` : `<i class="fa ${item.icon}"></i>`}
                                        </div>
                                        <div class="badge-360-text">${item.text}</div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    } else if (s.type === 'hero_slider') {
                        const slides = s.slides || [];
                        const displayType = s.heroType || 'slider';
                        
                        if (displayType === 'video' && s.videoUrl) {
                            const isYoutube = s.videoUrl.includes('youtube.com') || s.videoUrl.includes('youtu.be');
                            let embedUrl = s.videoUrl;
                            if (isYoutube) {
                                if (s.videoUrl.includes('watch?v=')) {
                                    embedUrl = s.videoUrl.replace('watch?v=', 'embed/');
                                } else if (s.videoUrl.includes('youtu.be/')) {
                                    embedUrl = s.videoUrl.replace('youtu.be/', 'youtube.com/embed/');
                                }
                            }
                            productsHTML += `
                                <div style="margin: 20px 0; border-radius:20px; overflow:hidden; box-shadow:var(--shadow-md); position:relative; aspect-ratio: 16/9; background:#000;">
                                    ${isYoutube ? `
                                        <iframe src="${embedUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allowfullscreen></iframe>
                                    ` : `
                                        <video autoplay muted loop playsinline style="width:100%; height:100%; object-fit:cover;">
                                            <source src="${s.videoUrl}" type="video/mp4">
                                        </video>
                                    `}
                                </div>
                            `;
                        } else if (slides.length > 0) {
                            if (displayType === 'banner') {
                                const slide = slides[0];
                                const inner = `
                                    <div class="hero-banner" style="margin: 20px 0; border-radius: 20px; overflow: hidden; position: relative;">
                                        <img src="${slide.image}" alt="Banner" style="width:100%; display:block; object-fit:cover;">
                                        ${slide.title ? `<div class="hero-content" style="opacity:1;transform:none;"><h1>${slide.title}</h1></div>` : ''}
                                    </div>`;
                                productsHTML += slide.link ? `<a href="${slide.link}" style="display:block;text-decoration:none;">${inner}</a>` : inner;
                            } else {
                                const isSingle = slides.length === 1;
                                const slidesHTML = slides.map((slide, index) => {
                                    const isSlideVideo = slide.image && (slide.image.match(/\.(mp4|webm|ogg|mov)$/i) || slide.image.includes('youtube.com') || slide.image.includes('youtu.be'));
                                    
                                    let mediaHtml = '';
                                    if (isSlideVideo) {
                                        if (slide.image.includes('youtube.com') || slide.image.includes('youtu.be')) {
                                            let embedUrl = slide.image;
                                            if (slide.image.includes('watch?v=')) embedUrl = slide.image.replace('watch?v=', 'embed/');
                                            else if (slide.image.includes('youtu.be/')) embedUrl = slide.image.replace('youtu.be/', 'youtube.com/embed/');
                                            mediaHtml = `<iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" allowfullscreen></iframe>`;
                                        } else {
                                            mediaHtml = `<video autoplay muted loop playsinline style="width:100%; height:100%; object-fit:cover;"><source src="${slide.image}" type="video/mp4"></video>`;
                                        }
                                    } else {
                                        mediaHtml = `<img src="${slide.image}" alt="Slide ${index + 1}">`;
                                    }

                                    const innerSlide = `
                                        ${mediaHtml}
                                        ${slide.title ? `<div class="hero-content"><h1>${slide.title}</h1></div>` : ''}
                                    `;
                                    return slide.link
                                        ? `<a href="${slide.link}" class="slide ${index === 0 ? 'active' : ''}" style="display:block;text-decoration:none;">${innerSlide}</a>`
                                        : `<div class="slide ${index === 0 ? 'active' : ''}">${innerSlide}</div>`;
                                }).join('');
                                const dotsHTML = isSingle ? '' : slides.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i}, this)"></span>`).join('');
                                
                                productsHTML += `
                                    <div class="hero-slider" data-speed="${s.speed || 5}" data-current="0" style="margin: 20px 0; border-radius: 20px; overflow: hidden; position: relative; width: 100%;">
                                        <div class="slider-container">${slidesHTML}</div>
                                        ${dotsHTML ? `<div class="slider-dots">${dotsHTML}</div>` : ''}
                                        ${!isSingle ? `<button class="slider-arrow prev" onclick="prevSlide(this)"><i class="fa fa-chevron-right"></i></button><button class="slider-arrow next" onclick="nextSlide(this)"><i class="fa fa-chevron-left"></i></button>` : ''}
                                    </div>`;
                            }
                        }
                    } else if (s.type === 'logo_marquee') {
                        const logos = s.logos || [];
                        const singleLine = logos.map(l => {
                            const isObj = typeof l === 'object' && l !== null;
                            const url = isObj ? l.url : l;
                            const link = isObj ? l.link : '';
                            const imgHtml = `<img src="${url}" alt="brand">`;
                            return link ? `<a href="${link}" target="_blank" style="display:inline-block;">${imgHtml}</a>` : imgHtml;
                        }).join('');
                        // Repeat 5 times is enough for logos
                        const repeatedLogos = Array(5).fill(singleLine).join('');
                        productsHTML += `
                            <div class="logo-marquee-container" style="${s.bgColor ? `background:${s.bgColor};` : ''} --speed: ${s.speed || 60}s;">
                                <div class="logo-marquee-content">
                                    ${repeatedLogos}
                                </div>
                                <div class="logo-marquee-content">
                                    ${repeatedLogos}
                                </div>
                            </div>
                        `;
                    } else if (s.type === 'static_features') {
                        const items = s.items || [];
                        productsHTML += `
                            <div class="static-features-section" style="${s.bgColor ? `background:${s.bgColor};` : ''}">
                                ${items.map(it => `
                                    <div class="feature-item">
                                        <div class="feature-icon" style="${s.iconColor ? `color:${s.iconColor}; background:rgba(var(--primary-rgb, 250,0,0), 0.1);` : ''}">
                                            ${it.image ? `<img src="${it.image}" alt="${it.title}" style="width:100%; height:100%; object-fit:contain;">` : `<i class="fa ${it.icon || 'fa-check'}"></i>`}
                                        </div>
                                        <div class="feature-info">
                                            <h4>${it.title || ''}</h4>
                                            <p>${it.desc || ''}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    } else if (s.type === 'winning_product' && s.productId) {
                        const p = visibleProducts.find(prod => prod.id === s.productId);
                        if (p) {
                            productsHTML += `
                                <div class="premium-winning-sec">
                                    <style>
                                        .premium-winning-sec {
                                            margin: 40px 0;
                                            background: linear-gradient(145deg, var(--white, #fff) 0%, var(--gray-100, #f8fafc) 100%);
                                            border-radius: 24px;
                                            padding: 30px;
                                            box-shadow: 0 15px 40px rgba(0,0,0,0.06);
                                            border: 1px solid var(--gray-200, #e2e8f0);
                                            display: grid;
                                            grid-template-columns: 1fr 1fr;
                                            gap: 40px;
                                            align-items: center;
                                            position: relative;
                                            overflow: hidden;
                                        }
                                        .premium-winning-sec::before {
                                            content: '';
                                            position: absolute;
                                            top: -50%; right: -50%;
                                            width: 100%; height: 100%;
                                            background: radial-gradient(circle, var(--primary-light, rgba(0,0,0,0.05)) 0%, transparent 70%);
                                            pointer-events: none;
                                            z-index: 0;
                                        }
                                        .win-badge-top {
                                            position: absolute;
                                            top: 20px; right: 20px;
                                            background: linear-gradient(135deg, #ef4444, #f43f5e);
                                            color: #fff;
                                            font-size: 13px;
                                            font-weight: 800;
                                            padding: 8px 16px;
                                            border-radius: 50px;
                                            z-index: 2;
                                            display: flex; align-items: center; gap: 6px;
                                            box-shadow: 0 6px 15px rgba(239, 68, 68, 0.3);
                                            animation: winBadgePulse 2s infinite;
                                        }
                                        @keyframes winBadgePulse {
                                            0%, 100% { transform: scale(1); box-shadow: 0 6px 15px rgba(239, 68, 68, 0.3); }
                                            50% { transform: scale(1.05); box-shadow: 0 8px 25px rgba(239, 68, 68, 0.5); }
                                        }
                                        .win-img-wrapper {
                                            position: relative;
                                            z-index: 1;
                                            border-radius: 20px;
                                            overflow: hidden;
                                            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                                            cursor: pointer;
                                            aspect-ratio: 1;
                                            background: #fff;
                                        }
                                        .win-img-wrapper img {
                                            width: 100%; height: 100%;
                                            object-fit: cover;
                                            transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                                        }
                                        .win-img-wrapper:hover img {
                                            transform: scale(1.05);
                                        }
                                        .win-content {
                                            position: relative;
                                            z-index: 1;
                                            display: flex;
                                            flex-direction: column;
                                            gap: 16px;
                                        }
                                        .win-title {
                                            font-size: 28px;
                                            font-weight: 900;
                                            color: var(--dark, #0f172a);
                                            line-height: 1.3;
                                            margin: 0;
                                        }
                                        .win-desc {
                                            font-size: 14px;
                                            color: var(--gray-600, #475569);
                                            line-height: 1.7;
                                            margin: 0;
                                            display: -webkit-box;
                                            -webkit-line-clamp: 3;
                                            line-clamp: 3;
                                            -webkit-box-orient: vertical;
                                            overflow: hidden;
                                        }
                                        .win-price-box {
                                            display: flex;
                                            align-items: baseline;
                                            gap: 12px;
                                            margin: 5px 0;
                                            padding: 15px;
                                            background: var(--primary-light, rgba(0,0,0,0.03));
                                            border-radius: 16px;
                                            border: 1px dashed var(--primary);
                                            width: fit-content;
                                        }
                                        .win-price-new {
                                            font-size: 34px;
                                            font-weight: 900;
                                            color: var(--primary);
                                            line-height: 1;
                                        }
                                        .win-price-old {
                                            font-size: 18px;
                                            color: var(--gray-400, #9ca3af);
                                            text-decoration: line-through;
                                            font-weight: 600;
                                        }
                                        .win-actions {
                                            display: flex;
                                            gap: 12px;
                                            margin-top: 10px;
                                        }
                                        .win-btn-primary {
                                            flex: 1;
                                            background: var(--primary);
                                            color: #fff;
                                            text-align: center;
                                            padding: 16px 20px;
                                            border-radius: 16px;
                                            font-weight: 800;
                                            font-size: 16px;
                                            text-decoration: none;
                                            display: flex; align-items: center; justify-content: center; gap: 8px;
                                            transition: all 0.3s;
                                            box-shadow: 0 8px 20px var(--primary-light, rgba(0,0,0,0.2));
                                            border: none;
                                            cursor: pointer;
                                        }
                                        .win-btn-primary:hover {
                                            transform: translateY(-3px);
                                            box-shadow: 0 12px 25px var(--primary-light, rgba(0,0,0,0.3));
                                            filter: brightness(1.05);
                                        }
                                        .win-btn-secondary {
                                            width: 58px; height: 58px;
                                            display: flex; align-items: center; justify-content: center;
                                            border-radius: 16px;
                                            background: var(--white, #fff);
                                            border: 2px solid var(--primary);
                                            color: var(--primary);
                                            font-size: 22px;
                                            cursor: pointer;
                                            transition: all 0.3s;
                                        }
                                        .win-btn-secondary:hover {
                                            background: var(--primary);
                                            color: #fff;
                                            transform: translateY(-3px);
                                        }

                                        /* Responsive */
                                        @media (max-width: 900px) {
                                            .premium-winning-sec {
                                                grid-template-columns: 1fr;
                                                gap: 25px;
                                                padding: 20px;
                                                border-radius: 20px;
                                            }
                                            .win-badge-top {
                                                top: 15px; right: 15px;
                                                font-size: 11px;
                                                padding: 6px 12px;
                                            }
                                            .win-title { font-size: 24px; }
                                            .win-price-box { width: 100%; justify-content: center; }
                                            .win-img-wrapper { max-height: 350px; }
                                        }
                                    </style>

                                    <div class="win-badge-top"><i class="fa fa-fire"></i> عرض خاص وحصري</div>
                                    
                                    <div class="win-img-wrapper" onclick="window.location.href='/?app=product.show.${p.id}'">
                                        <img src="${p.image}" alt="${p.name}" loading="lazy">
                                    </div>
                                    
                                    <div class="win-content">
                                        <h2 class="win-title">${s.title || p.name}</h2>
                                        <p class="win-desc">${s.desc || (p.description ? p.description.replace(/<[^>]*>/g, '').substring(0, 150) + '...' : '')}</p>
                                        
                                        <div class="win-price-box">
                                            <span class="win-price-new">${currency}${p.price}</span>
                                            ${p.salePrice ? `<span class="win-price-old">${currency}${p.salePrice}</span>` : ''}
                                        </div>

                                        ${buildVariantChipsHTML(p)}

                                        <div class="win-actions">
                                            <a href="/?app=product.show.${p.id}" class="win-btn-primary">
                                                <i class="fa fa-shopping-bag"></i> عرض كامل التفاصيل
                                            </a>
                                            <button class="win-btn-secondary" onclick="${getQAOnClick(p)}" title="إضافة سريعة للسلة">
                                                <i class="fa fa-cart-plus"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    } else if (s.type === 'video' && s.videoUrl) {
                        const isYoutube = s.videoUrl.includes('youtube.com') || s.videoUrl.includes('youtu.be');
                        let embedUrl = s.videoUrl;
                        if (isYoutube) {
                            if (s.videoUrl.includes('watch?v=')) {
                                embedUrl = s.videoUrl.replace('watch?v=', 'embed/');
                            } else if (s.videoUrl.includes('youtu.be/')) {
                                embedUrl = s.videoUrl.replace('youtu.be/', 'youtube.com/embed/');
                            }
                        }
                        productsHTML += `
                            <div style="margin: 30px 0; border-radius:16px; overflow:hidden; box-shadow:var(--shadow-md); position:relative; aspect-ratio: 16/9; background:#000;">
                                ${isYoutube ? `
                                    <iframe src="${embedUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allowfullscreen></iframe>
                                ` : `
                                    <video controls style="width:100%; height:100%; object-fit:cover;">
                                        <source src="${s.videoUrl}" type="video/mp4">
                                    </video>
                                `}
                            </div>
                        `;
                    } else if (s.type === 'reels') {
                        const reels = db.reels || [];
                        if (reels.length > 0) {
                            productsHTML += `
                                <div class="home-reels-section">
                                    <div class="section-header">
                                        <h2 class="section-title">فيديوهات ريلز <i class="fa fa-play-circle" style="color:#f43f5e;"></i></h2>
                                        <a href="/?app=reels" class="view-all">عرض الكل <i class="fa fa-chevron-left"></i></a>
                                    </div>
                                    <div class="home-reels-container">
                                        ${reels.slice(0, 10).map(reel => `
                                            <div class="home-reel-card" onclick="window.location.href='/?app=reels#reel-${reel.id}'">
                                                <video src="${reel.videoUrl}" muted playsinline></video>
                                                <div class="reel-card-overlay">
                                                    <i class="fa fa-play"></i>
                                                    <span>${reel.title || ''}</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <style>
                                        .home-reels-container {
                                            display: flex;
                                            gap: 15px;
                                            overflow-x: auto;
                                            padding: 10px 5px 20px;
                                            scrollbar-width: none;
                                            -ms-overflow-style: none;
                                        }
                                        .home-reels-container::-webkit-scrollbar { display: none; }
                                        .home-reel-card {
                                            flex: 0 0 160px;
                                            aspect-ratio: 9/16;
                                            background: #000;
                                            border-radius: 18px;
                                            overflow: hidden;
                                            position: relative;
                                            cursor: pointer;
                                            box-shadow: 0 10px 20px rgba(0,0,0,0.15);
                                            transition: 0.3s;
                                        }
                                        .home-reel-card:hover { transform: translateY(-5px); }
                                        .home-reel-card video {
                                            width: 100%;
                                            height: 100%;
                                            object-fit: cover;
                                            opacity: 0.8;
                                        }
                                        .reel-card-overlay {
                                            position: absolute;
                                            inset: 0;
                                            background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
                                            display: flex;
                                            flex-direction: column;
                                            justify-content: flex-end;
                                            padding: 15px;
                                            color: #fff;
                                        }
                                        .reel-card-overlay i {
                                            position: absolute;
                                            top: 50%;
                                            left: 50%;
                                            transform: translate(-50%, -50%);
                                            font-size: 30px;
                                            opacity: 0.8;
                                        }
                                        .reel-card-overlay span {
                                            font-size: 12px;
                                            font-weight: 800;
                                            display: -webkit-box;
                                            -webkit-line-clamp: 2;
                                            line-clamp: 2;
                                            -webkit-box-orient: vertical;
                                            overflow: hidden;
                                        }
                                    </style>
                                </div>
                            `;
                        }
                    } else if (s.type === 'html' && s.htmlContent) {
                        productsHTML += `
                            <div style="margin: 30px 0;">
                                ${s.htmlContent}
                            </div>
                        `;
                    }
                });
            } else {
                const grouped = {};
                visibleProducts.forEach(p => {
                    const cats = Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : [p.category || 'general'];
                    cats.forEach(catId => {
                        let rootCatId = catId;
                        const catObj = categories.find(c => c.id === catId);
                        if (catObj && catObj.parentId) {
                            rootCatId = catObj.parentId;
                        }

                        if (!grouped[rootCatId]) grouped[rootCatId] = [];
                        if (!grouped[rootCatId].find(item => item.id === p.id)) {
                            grouped[rootCatId].push(p);
                        }
                    });
                });

                for (const catId in grouped) {
                    const cat = categories.find(c => c.id === catId) || { name: 'منتجات مختارة' };
                    const catProducts = grouped[catId];
                    const displayProducts = catProducts.slice(0, 12);

                    // Build subcategory cards
                    const subCats = categories.filter(c => c.parentId === catId);
                    const subCatsHTML = subCats.length > 0 ? `
                        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; align-items:stretch;">
                            <a href="/?app=product.cat.${catId}" style="text-decoration:none; background:var(--primary); color:#fff; border-radius:16px; font-size:13px; font-weight:800; display:inline-flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:14px 20px; transition:all 0.25s; box-shadow:0 4px 14px rgba(250,0,0,0.25); min-width:80px;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(250,0,0,0.35)';" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 14px rgba(250,0,0,0.25)';">
                                <i class="fa fa-th" style="font-size:22px;"></i>
                                <span>الكل</span>
                            </a>
                            ${subCats.map(sc => {
                        const imgSrc = sc.icon || sc.image;
                        const imgHTML = imgSrc
                            ? `<img src="${imgSrc}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid var(--gray-200);" onerror="this.style.display='none';">`
                            : `<div style="width:48px;height:48px;border-radius:12px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;"><i class="fa fa-folder-open" style="font-size:20px;color:var(--primary);"></i></div>`;
                        return `
                                <a href="/?app=product.cat.${sc.id}" style="text-decoration:none; background:#fff; border:1.5px solid var(--gray-200); border-radius:16px; font-size:13px; font-weight:700; color:var(--dark); display:inline-flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:14px 18px; transition:all 0.25s ease; box-shadow:0 2px 8px rgba(0,0,0,0.06); min-width:80px;" onmouseover="this.style.borderColor='var(--primary)';this.style.color='var(--primary)';this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)';" onmouseout="this.style.borderColor='var(--gray-200)';this.style.color='var(--dark)';this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)';">
                                    ${imgHTML}
                                    <span>${sc.name}</span>
                                </a>`;
                    }).join('')}
                        </div>
                    ` : '';

                    productsHTML += `
                        <div class="section-header">
                            <h2 class="section-title">
                                ${cat.name}
                                <span style="font-size:14px; font-weight:400; color:var(--gray-400); margin-right:8px;">(${catProducts.length} منتج)</span>
                            </h2>
                            <a href="/?app=product.cat.${catId}" class="view-all">عرض الكل <i class="fa fa-chevron-left"></i></a>
                        </div>
                        ${subCatsHTML}
                        <div class="product-grid">
                    `;

                    displayProducts.forEach(p => {
                        const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                        productsHTML += `
                            <div class="product-card" onclick="window.location.href='/?app=product.show.${p.id}'">
                                <span class="product-cat" style="padding: 8px 12px 0; text-align: center;">${cat.name}</span>
                                <div class="product-img">
                                    ${discount > 0 ? `<div class="discount-badge">خصم ${discount}%</div>` : ''}
                                    <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                    <img src="${p.image}" alt="${p.name}" loading="lazy">
                                </div>
                                <div class="product-info">
                                    <span class="product-name">${p.name}</span>
                                    ${buildVariantChipsHTML(p)}
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                        <div class="product-price">
                                            ${currency}${p.price}
                                            ${p.salePrice ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}
                                        </div>
                                        <button class="cart-icon-btn" onclick="${getQAOnClick(p)}" title="إضافة للسلة">
                                            <i class="fa fa-shopping-bag"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    productsHTML += `</div>`;
                }
            }
        }

        let sliderHTML = '';
        const heroType = settings.heroType || (settings.showSlider === 'false' ? 'none' : 'slider');

        if (heroType === 'slider') {
            let slides = [];
            if (settings.slider_json) {
                try { slides = typeof settings.slider_json === 'string' ? JSON.parse(settings.slider_json) : settings.slider_json; } catch (e) { slides = []; }
            }
            if (!Array.isArray(slides) || slides.length === 0) {
                slides = [
                    { image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2070&auto=format&fit=crop', title: 'مجموعات فريدة وحصرية', desc: 'اكتشف عالم الفخامة مع تشكيلتنا الجديدة من المجوهرات الراقية' },
                    { image: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?q=80&w=2070&auto=format&fit=crop', title: 'أناقة لا تنتهي', desc: 'قطع فنية مصممة لتبرز جمالك في كل مناسبة' }
                ];
            }
            const isSingle = slides.length === 1;
            const slidesHTML = slides.map((slide, index) => {
                const isSlideVideo = slide.image && (slide.image.match(/\.(mp4|webm|ogg|mov)$/i) || slide.image.includes('youtube.com') || slide.image.includes('youtu.be'));
                
                let mediaHtml = '';
                if (isSlideVideo) {
                    if (slide.image.includes('youtube.com') || slide.image.includes('youtu.be')) {
                        let embedUrl = slide.image;
                        if (slide.image.includes('watch?v=')) embedUrl = slide.image.replace('watch?v=', 'embed/');
                        else if (slide.image.includes('youtu.be/')) embedUrl = slide.image.replace('youtu.be/', 'youtube.com/embed/');
                        mediaHtml = `<iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" allowfullscreen></iframe>`;
                    } else {
                        mediaHtml = `<video autoplay muted loop playsinline style="width:100%; height:100%; object-fit:cover;"><source src="${slide.image}" type="video/mp4"></video>`;
                    }
                } else {
                    mediaHtml = `<img src="${slide.image}" alt="Slide ${index + 1}">`;
                }

                const innerSlide = `
                    ${mediaHtml}
                    ${slide.title || slide.desc ? `<div class="hero-content"><${isSingle ? 'h2' : 'h1'}>${slide.title || ''}</${isSingle ? 'h2' : 'h1'}>${slide.desc ? `<p>${slide.desc}</p>` : ''}</div>` : ''}
                `;
                return slide.link
                    ? `<a href="${slide.link}" class="slide ${index === 0 ? 'active' : ''}" style="display:block;text-decoration:none;">${innerSlide}</a>`
                    : `<div class="slide ${index === 0 ? 'active' : ''}">${innerSlide}</div>`;
            }).join('');
            const dotsHTML = isSingle ? '' : slides.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i}, this)"></span>`).join('');
            sliderHTML = `
                <div class="hero-slider" id="heroSlider" data-current="0">
                    <div class="slider-container">${slidesHTML}</div>
                    ${dotsHTML ? `<div class="slider-dots">${dotsHTML}</div>` : ''}
                    ${!isSingle ? `<button class="slider-arrow prev" onclick="prevSlide(this)"><i class="fa fa-chevron-right"></i></button><button class="slider-arrow next" onclick="nextSlide(this)"><i class="fa fa-chevron-left"></i></button>` : ''}
                </div>`;

        } else if (heroType === 'banner') {
            const img = settings.bannerImage || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2070&auto=format&fit=crop';
            const title = settings.bannerTitle || '';
            const desc = settings.bannerDesc || '';
            const link = settings.bannerLink || '';
            const inner = `
                <div class="hero-banner" id="heroBanner">
                    <img src="${img}" alt="Banner">
                    ${title || desc ? `<div class="hero-content" style="opacity:1;transform:none;"><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div>` : ''}
                </div>`;
            sliderHTML = link ? `<a href="${link}" style="display:block;text-decoration:none;">${inner}</a>` : inner;

        } else if (heroType === 'video') {
            const videoUrl = settings.videoUrl || '';
            const title = settings.videoTitle || '';
            const desc = settings.videoDesc || '';
            if (videoUrl) {
                sliderHTML = `
                    <div class="hero-video" id="heroVideo">
                        <video autoplay muted loop playsinline>
                            <source src="${videoUrl}" type="video/mp4">
                        </video>
                        <div class="hero-video-overlay"></div>
                        ${title || desc ? `<div class="hero-content" style="opacity:1;transform:none;"><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div>` : ''}
                    </div>`;
            }
        }
        // heroType === 'none': sliderHTML stays ''


        const cities = settings.cities || [];
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        cities.forEach(c => {
            citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`;
        });

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#fa0000');
        html = html.replace(/\{\{META_TITLE\}\}/g, settings.metaTitle || settings.storeName || 'متجري');
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => productsHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*CITIES_OPTIONS\s*\}\}/g, citiesHTML);
        // Only show slider on home page without search query
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, searchQuery ? '' : sliderHTML);
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, searchQuery ? '' : 'active');

        // Sidebar render logic
        html = renderStoreTemplate(html, settings, catsHTML, null, true);

        res.send(html);
    },

    show: (req, res, id) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};
        const currency = settings.currency || '$';
        const categories = db.categories || [];
        const products = applyActivePromotions(db.products || []);
        const product = products.find(p => p.id === id);

        if (!product) return res.status(404).send('<h1>المنتج غير موجود</h1>');
        const isComingSoon = checkComingSoon(product);

        const productVideo = (product.advanced && product.advanced.productVideo) || (product.video) || '';
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
                    const isSelected = false; // Disable auto-select to force user choice

                    if (type === 'swatch') {
                        const hex = val.color || getColorHex(cleanVal);
                        return '<div class="option-pill swatch-pill ' + (isSelected ? 'selected' : '') + ' ' + (outOfStock ? 'out-of-stock' : '') + '" ' +
                            'onclick="' + (outOfStock ? '' : 'window.selectPill(this, \'' + v.name.replace(/'/g, "\\'") + '\')') + '" ' +
                            'title="' + cleanVal + (outOfStock ? ' (نفدت)' : '') + '" ' +
                            'data-image="' + (val.image || '') + '" data-out-of-stock="' + outOfStock + '" ' +
                            'style="background : ' + hex + '; width:34px; height:34px; border-radius:50%; border:2px solid transparent; position:relative; cursor:' + (outOfStock ? 'not-allowed' : 'pointer') + '; ' + (outOfStock ? 'opacity:0.4; filter:grayscale(1);' : '') + '">' +
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

            optionsHTML += '<style>' +
                '.swatch-pill.selected { transform: scale(1.18); border-color: #000 !important; box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.15) !important; }' +
                '.image-pill.selected { border-color: var(--primary) !important; box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 250,0,0), 0.2) !important; transform: scale(1.05); }' +
                '.option-pill.out-of-stock { opacity: 0.5; cursor: not-allowed !important; position: relative; background: #f1f5f9 !important; color: #94a3b8 !important; border-color: #e2e8f0 !important; text-decoration: line-through; }' +
                '.option-pill.out-of-stock:hover { border-color: #e2e8f0 !important; transform: none !important; }' +
                '.option-pills.error-border { border: 1px solid #ef4444; padding: 10px; border-radius: 12px; background: #fff5f5; animation: shake 0.5s ease-in-out; }' +
                '@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-5px); } }' +
                '</style>' +
                '<script>' +
                'window.productData = window.productData || {};' +
                'window.productData["' + product.id + '"] = {' +
                'name: ' + JSON.stringify(product.name) + ',' +
                'price: ' + product.price + ',' +
                'salePrice: ' + (product.salePrice || 'null') + ',' +
                'variants: ' + JSON.stringify(product.variants || []) + ',' +
                'currency: ' + JSON.stringify(currency) + ',' +
                'image: ' + JSON.stringify(product.image) + ',' +
                'isComingSoon: ' + isComingSoon +
                '};' +
                'function updateVariantPriceAndImage() {' +
                'const data = window.productData["' + product.id + '"];' +
                'const selected = {};' +
                'document.querySelectorAll(".option-pills").forEach(pills => {' +
                'const name = pills.dataset.option;' +
                'const selectedEl = pills.querySelector(".option-pill.selected");' +
                'if(selectedEl) {' +
                'const val = (selectedEl.innerText.trim() || selectedEl.getAttribute("title") || "").replace(" (نفدت)", "").replace(" ✕", "");' +
                'if(name && val) selected[name] = val;' +
                '}' +
                '});' +
                'const phone = localStorage.getItem("distributorPhone");' +
                'let basePrice = data.price;' +
                'let isWholesale = false;' +
                'if (phone && window.wholesalePrices && window.wholesalePrices["' + product.id + '"]) {' +
                'basePrice = parseFloat(window.wholesalePrices["' + product.id + '"]);' +
                'isWholesale = true;' +
                '}' +
                'let finalPrice = basePrice;' +
                'let hasFixedOverride = false;' +
                'let targetImage = "";' +
                'Object.entries(selected).forEach(([optName, optVal]) => {' +
                'const option = data.variants.find(o => o.name === optName);' +
                'if (option && option.values) {' +
                'const valData = option.values.find(v => (typeof v === "object" ? v.value : v).trim() === optVal.trim());' +
                'if (valData && typeof valData === "object") {' +
                'const customPrice = (isWholesale && valData.wholesalePrice !== undefined && String(valData.wholesalePrice).trim() !== "") ? valData.wholesalePrice : valData.price;' +
                'if (customPrice && String(customPrice).trim() !== "" && parseFloat(customPrice) !== 0) {' +
                'const pr = String(customPrice).trim();' +
                'if (pr.startsWith("+")) finalPrice = basePrice + (parseFloat(pr) || 0);' +
                'else if (pr.startsWith("-")) finalPrice = basePrice - Math.abs(parseFloat(pr));' +
                'else { finalPrice = parseFloat(pr); hasFixedOverride = true; }' +
                '}' +
                'if (valData.image) targetImage = valData.image;' +
                '}' +
                '}' +
                '});' +
                'const priceEl = document.querySelector(".product-price-large");' +
                'const imgEl = document.getElementById("mainProductImg");' +
                'if (!data.isComingSoon && priceEl) {' +
                'if (isWholesale) priceEl.innerHTML = "سعر الجملة: " + data.currency + finalPrice.toFixed(2) + " <span style=\'font-size:16px; font-weight:normal; color:var(--gray-400); text-decoration:line-through;\'>" + data.currency + data.price.toFixed(2) + "</span>";' +
                'else if (!hasFixedOverride && data.salePrice && data.salePrice > finalPrice) priceEl.innerHTML = data.currency + finalPrice.toFixed(2) + "<span class=\'old-price\'>" + data.currency + data.salePrice.toFixed(2) + "</span>";' +
                'else priceEl.innerHTML = data.currency + finalPrice.toFixed(2);' +
                '}' +
                'if (targetImage && imgEl) imgEl.src = targetImage;' +
                'document.querySelectorAll(".buy-now-btn, .add-to-cart-btn").forEach(btn => {' +
                'if (data.isComingSoon) { btn.onclick = null; return; }' +
                'btn.onclick = () => {' +
                'const pillsList = document.querySelectorAll(".option-pills");' +
                'let firstMissing = null;' +
                'pillsList.forEach(p => {' +
                'const optName = p.dataset.option;' +
                'const errorMsg = p.parentNode.querySelector(".option-error-msg");' +
                'if (!selected[optName]) {' +
                'p.classList.add("error-border");' +
                'if (errorMsg) errorMsg.style.display = "block";' +
                'if (!firstMissing) firstMissing = p;' +
                '} else {' +
                'p.classList.remove("error-border");' +
                'if (errorMsg) errorMsg.style.display = "none";' +
                '}' +
                '});' +
                'if (firstMissing) {' +
                'firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });' +
                'return;' +
                '}' +
                'let suffix = ""; Object.entries(selected).forEach(([k, v]) => { suffix += " " + v; });' +
                'const finalName = suffix.trim() ? data.name + " (" + suffix.trim() + ")" : data.name;' +
                'addToCart("' + product.id + '", finalName, finalPrice, targetImage || data.image);' +
                'if(typeof openModal === "function") openModal("cartModal");' +
                '};' +
                '});' +
                '}' +
                'if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateVariantPriceAndImage);' +
                'else updateVariantPriceAndImage();' +
                'if (typeof window.trackStoreEvent === "function") {' +
                'window.trackStoreEvent("ViewContent", { id: "' + product.id + '", name: ' + JSON.stringify(product.name) + ', price: ' + product.price + ' });' +
                '}' +
                '</script>';
        } else {
            // Legacy colors/sizes
            if (product.colors && product.colors.length > 0) {
                optionsHTML += '<div class="product-option"><label>اللون</label><div class="option-pills">' + product.colors.map((c, i) => '<div class="option-pill ' + (i === 0 ? 'selected' : '') + '" onclick="window.selectPill(this, \'color\')">' + c + '</div>').join('') + '</div></div>';
            }
            if (product.sizes && product.sizes.length > 0) {
                optionsHTML += '<div class="product-option"><label>المقاس</label><div class="option-pills">' + product.sizes.map((s, i) => '<div class="option-pill ' + (i === 0 ? 'selected' : '') + '" onclick="window.selectPill(this, \'size\')">' + s + '</div>').join('') + '</div></div>';
            }
        }

        const currentCat = categories.find(c => c.id === product.category) || { name: 'عام', id: '0' };

        // 1. Initial Media HTML
        let initialMediaHTML = '';
        const firstItem = galleryItems[0];
        if (firstItem.type === 'video') {
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
            initialMediaHTML = '<img src="' + firstItem.url + '" id="mainProductImg" class="product-main-img">';
        }

        let productDetailHTML = `
            <nav class="breadcrumbs">
                <a href="/">الرئيسية</a>
                <i class="fa fa-chevron-left"></i>
                <a href="/?app=product.cat.all">كل المنتجات</a>
                <i class="fa fa-chevron-left"></i>
                <a href="/?app=product.cat.${currentCat.id}">${currentCat.name}</a>
                <i class="fa fa-chevron-left"></i>
                <span class="current">${product.name}</span>
            </nav>
            <div class="product-detail-view">
                <div class="product-main-info">
                    <div class="product-media">
                        <div class="main-img-container">
                            ${initialMediaHTML}
                            ${isComingSoon ? `<div class="coming-soon-badge" style="transform: translate(-50%, -50%) rotate(-15deg); font-size: 24px; padding: 10px 25px;">قريباً متاح ⏳</div>` : ''}
                            ${galleryItems.length > 1 ? `
                                <button class="gallery-arrow prev" onclick="window.changeGalleryImage(1)"><i class="fa fa-chevron-right"></i></button>
                                <button class="gallery-arrow next" onclick="window.changeGalleryImage(-1)"><i class="fa fa-chevron-left"></i></button>
                            ` : ''}
                        </div>
                        ${galleryHTML}
                    </div>
                    <div class="product-details">
                        <div class="breadcrumb" style="margin-bottom:15px; font-size:12px; opacity:0.6;">
                            <a href="/" style="color:inherit; text-decoration:none;">الرئيسية</a> / 
                            <span>${product.name}</span>
                        </div>
                        <h1 class="product-title">${product.name}</h1>
                        <div class="product-price-large">
                            ${isComingSoon ? `
                                <span style="background:#f1f5f9; color:#64748b; padding:5px 15px; border-radius:10px; font-size:18px;">بانتظار التوفر</span>
                            ` : `
                                ${currency}${product.price}
                                ${product.salePrice ? `<span class="old-price">${currency}${product.salePrice}</span>` : ''}
                            `}
                        </div>

                        <!-- Marketing Elements -->
                        <div style="margin: 20px 0; display: flex; flex-direction: column; gap: 12px;">
                            ${product.fakeStock ? (
                '<div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 12px 15px; border-radius: 12px;">' +
                '<div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 700; color: #c53030;">' +
                '<span>المخزون المتبقي: <span id="dynamicStock">12</span> قطعة</span>' +
                '<span>عجل! الكمية أوشكت على النفاذ</span>' +
                '</div>' +
                '<div style="height: 8px; background: #fed7d7; border-radius: 10px; overflow: hidden;">' +
                '<div id="stockBar" style="width: 85%; height: 100%; background: #e53e3e; border-radius: 10px; transition: width 2s ease;"></div>' +
                '</div>' +
                '</div>'
            ) : ''}

                            ${product.fakeVisitors ? (
                '<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4a5568; font-weight: 600;">' +
                '<span style="width: 8px; height: 8px; background: #48bb78; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite;"></span>' +
                '<span>يوجد حالياً <strong id="dynamicVisitors" style="color: #2d3748;">' + (Math.floor(Math.random() * 30) + 20) + '</strong> شخص يشاهدون هذا المنتج</span>' +
                '</div>' +
                '<style>@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(72, 187, 120, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0); } }</style>'
            ) : ''}

                            ${product.fakeTimer ? (
                '<div style="background: #fdf2f2; border: 1px dashed #f87171; padding: 15px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">' +
                '<div style="font-weight: 800; font-size: 14px; color: #991b1b;">ينتهي العرض خلال:</div>' +
                '<div style="display: flex; gap: 8px; font-weight: 800; color: #b91c1c;">' +
                '<div style="background: white; padding: 5px 10px; border-radius: 8px; border: 1px solid #fecaca; min-width: 45px; text-align: center;"><span id="timerH">02</span><br><small style="font-size: 8px;">ساعة</small></div>' +
                '<div style="background: white; padding: 5px 10px; border-radius: 8px; border: 1px solid #fecaca; min-width: 45px; text-align: center;"><span id="timerM">45</span><br><small style="font-size: 8px;">دقيقة</small></div>' +
                '<div style="background: white; padding: 5px 10px; border-radius: 8px; border: 1px solid #fecaca; min-width: 45px; text-align: center;"><span id="timerS">18</span><br><small style="font-size: 8px;">ثانية</small></div>' +
                '</div>' +
                '</div>'
            ) : ''}
                        </div>

                        <script>
                            // 1. Dynamic Visitors
                            const visitorsEl = document.getElementById('dynamicVisitors');
                            if(visitorsEl) {
                                setInterval(() => {
                                    let current = parseInt(visitorsEl.innerText);
                                    let change = Math.floor(Math.random() * 5) - 2; // -2 to +2
                                    visitorsEl.innerText = Math.max(10, current + change);
                                }, 4000);
                            }

                            // 2. Countdown Timer
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

                            // 3. Dynamic Stock (slow decrease)
                            const stockEl = document.getElementById('dynamicStock');
                            const stockBar = document.getElementById('stockBar');
                            if(stockEl) {
                                setTimeout(() => {
                                    stockEl.innerText = "11";
                                    stockBar.style.width = "78%";
                                }, 10000);
                            }
                        </script>

                        ${optionsHTML}

                        <div class="purchase-actions" style="margin-top:30px; display:flex; gap:15px;">
                            ${isComingSoon ? (
                '<button class="buy-now-btn" style="flex:1; background:#94a3b8; cursor:not-allowed;" disabled>قريباً متاح (انتظروا توفر المنتج)</button>'
            ) : (
                '<button class="buy-now-btn" style="flex:1;">اشتري الآن</button>' +
                '<button class="add-to-cart-btn"><i class="fa fa-shopping-bag"></i></button>'
            )}
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

                        <div class="product-desc-box" style="margin-top: 30px;">${product.description}</div>

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
            ].map(area => {
                return '<span style="background:#dbeafe; color:#1e40af; font-size:12px; font-weight:700; padding:5px 11px; border-radius:20px; display:flex; align-items:center; gap:5px;">' +
                    '<i class="fa fa-circle-check" style="font-size:10px;"></i> ' + area +
                    '</span>';
            }).join('')}
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
                            </div>
                        `;
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
                            </div>
                        `).join('');
                    return `
                            <div class="landing-row features">
                                ${s.title ? `<h2 style="text-align:center; font-weight:900; margin-bottom:40px; font-size:28px;">${s.title}</h2>` : ''}
                                <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">${featuresHTML}</div>
                            </div>
                        `;
                }
                return '';
            }).join('')}
            </div>
            <style>
                @media (max-width: 768px) {
                    .landing-row.zigzag { flex-direction: column !important; text-align: center !important; gap: 25px !important; }
                    .landing-row.zigzag > div { width: 100% !important; text-align: center !important; }
                    .landing-row.features > div { flex-direction: column !important; }
                }
            </style>
            ` : ''}

            <!-- Related Products -->
            <div style="margin-top:60px;">
                <div class="section-header">
                    <h2 class="section-title">منتجات قد تعجبك أيضاً</h2>
                </div>
                <div class="product-grid">
                    ${applyActivePromotions(db.products || [])
                .filter(p => p.category === product.category && p.id !== id && (!p.advanced || !p.advanced.hiddenProduct) && !checkComingSoon(p))
                .slice(0, 6)
                .map(p => {
                    const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                    const catName = currentCat.name;
                    const isNew = (Date.now() - parseInt(p.id)) < (48 * 60 * 60 * 1000);
                    const isComingSoon = checkComingSoon(p);

                    return `
                                <div class="product-card ${isComingSoon ? 'coming-soon-card' : ''}" onclick="window.location.href='/?app=product.show.${p.id}'">
                                    <span class="product-cat" style="padding: 8px 12px 0; text-align: center;">${catName}</span>
                                    <div class="product-img">
                                        ${isComingSoon ? `<div class="coming-soon-badge">قريباً</div>` : (isNew ? `<div class="new-badge">جديد</div>` : '')}
                                        ${discount > 0 && !isComingSoon ? `<div class="discount-badge">خصم ${discount}%</div>` : ''}
                                        <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                                        <img src="${p.image}" style="${isComingSoon ? 'filter: grayscale(0.5) opacity(0.8);' : ''}">
                                    </div>
                                    <div class="product-info">
                                        <span class="product-name">${p.name}</span>
                                        ${buildVariantChipsHTML(p)}
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                            <div class="product-price">
                                                ${isComingSoon ? '<span style="color:var(--gray-500); font-size:14px;">بانتظار التوفر</span>' : `${currency}${p.price}${p.salePrice ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}`}
                                            </div>
                                            ${isComingSoon ? `
                                                <button class="cart-icon-btn" disabled style="background:var(--gray-200); color:var(--gray-400); cursor:not-allowed;"><i class="fas fa-lock"></i></button>
                                            ` : `
                                                <button class="cart-icon-btn" onclick="${getQAOnClick(p)}"><i class="fa fa-shopping-bag"></i></button>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            `;
                }).join('')}
                </div>
            </div>
            <style>
                .product-detail-view { background: #fff; border-radius: 20px; padding: 30px; border: 1px solid #eee; }
                .product-main-info { display: flex; gap: 40px; align-items: flex-start; }
                .product-media { width: 45%; align-self: flex-start; position: relative; }
                @media (min-width: 992px) {
                    .product-media { position: sticky; top: 80px; }
                }
                .main-img-container { width: 100%; aspect-ratio: 1; border-radius: 15px; overflow: hidden; border: 1px solid #eee; background: #fdfdfd; position: relative; }
                .product-main-img { width: 100%; height: 100%; object-fit: contain; }
                
                /* Gallery Arrows */
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

                /* Custom Video Player Styles */
                .custom-video-wrapper { position: absolute; inset: 0; width: 100%; height: 100%; background: #000; overflow: hidden; cursor: pointer; border-radius: 12px; }
                .custom-video-player { width: 100%; height: 100%; object-fit: contain; }
                .video-overlay {
                    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                    background: rgba(0,0,0,0.3); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; opacity: 0;
                }
                .custom-video-wrapper:not(.is-playing) .video-overlay { opacity: 1; pointer-events: auto; }
                .play-pause-btn {
                    width: 65px; height: 65px; background: rgba(255,255,255,0.2); backdrop-filter: blur(12px);
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    color: #fff; font-size: 26px; transition: 0.3s; border: 1.5px solid rgba(255,255,255,0.4);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                }
                .play-pause-btn i { transform: translateX(-2px); } /* Offset for play icon target */
                .custom-video-wrapper:hover .play-pause-btn { transform: scale(1.1); background: rgba(255,255,255,0.3); }
                .video-controls-bottom {
                    position: absolute; bottom: 0; left: 0; right: 0; height: 5px;
                    background: rgba(255,255,255,0.15); transition: 0.3s;
                    display: flex; align-items: center;
                }
                .video-progress { height: 100%; background: var(--primary); width: 0%; transition: width 0.1s linear; }
                .fullscreen-btn {
                    position: absolute; left: 15px; bottom: 15px; width: 36px; height: 36px;
                    background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
                    border-radius: 10px; display: flex; align-items: center; justify-content: center;
                    color: #fff; font-size: 15px; opacity: 0; transition: 0.3s; cursor: pointer; z-index: 10;
                    border: 1px solid rgba(255,255,255,0.3);
                }
                .custom-video-wrapper:hover .fullscreen-btn { opacity: 1; }
                .fullscreen-btn:hover { background: rgba(255,255,255,0.4); transform: scale(1.1); }

            </style>

            <script>
                (function() {
                    var galleryItems = JSON.parse(document.getElementById('__galleryData').textContent);
                    var currentItemIndex = 0;

                    function setGalleryItem(index) {
                        currentItemIndex = index;
                        var container = document.querySelector('.main-img-container');
                        var item = galleryItems[index];
                        if (!item || !container) return;

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
                            var imgHtml = '<img src="' + item.url + '" id="mainProductImg" class="product-main-img" style="width:100%; height:100%; object-fit:contain;">';
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

                    // Expose on window so they survive SPA innerHTML swaps and inline onclick
                    window.setGalleryItem = setGalleryItem;

                    window.changeGalleryImage = function(dir) {
                        var nextIndex = currentItemIndex + dir;
                        if (nextIndex < 0) nextIndex = galleryItems.length - 1;
                        if (nextIndex >= galleryItems.length) nextIndex = 0;
                        setGalleryItem(nextIndex);
                    };

                    window.toggleCustomVideo = function(wrapper) {
                        var video = wrapper.querySelector('video');
                        if (!video) return;
                        if (video.paused) { video.play(); wrapper.classList.add('is-playing'); }
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

                    window.selectPill = function(el) {
                        const pillsContainer = el.parentNode;
                        Array.from(pillsContainer.children).forEach(function(p) { p.classList.remove('selected'); });
                        el.classList.add('selected');
                        
                        // Clear error styling on selection
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

                    document.addEventListener('play', function(e) {
                        if (e.target.classList.contains('custom-video-player')) {
                            var wrapper = e.target.closest('.custom-video-wrapper');
                            if (wrapper) {
                                var icon = wrapper.querySelector('.play-pause-btn i');
                                var overlay = wrapper.querySelector('.video-overlay');
                                if (icon) icon.className = 'fas fa-pause';
                                if (overlay) overlay.style.opacity = '0';
                                wrapper.classList.add('is-playing');
                            }
                        }
                    }, true);

                    document.addEventListener('pause', function(e) {
                        if (e.target.classList.contains('custom-video-player')) {
                            var wrapper = e.target.closest('.custom-video-wrapper');
                            if (wrapper) {
                                var icon = wrapper.querySelector('.play-pause-btn i');
                                var overlay = wrapper.querySelector('.video-overlay');
                                if (icon) icon.className = 'fas fa-play';
                                if (overlay) overlay.style.opacity = '1';
                                wrapper.classList.remove('is-playing');
                            }
                        }
                    }, true);

                    // Initialize gallery
                    setGalleryItem(0);
                })();
            </script>
        `;

        // === SAFE DATA INJECTION (outside template literal to prevent parsing issues) ===
        const safeGalleryJson = JSON.stringify(galleryItems).replace(/<\/script>/gi, '<\\/script>');
        const galleryDataScript = '<script type="application/json" id="__galleryData">' + safeGalleryJson + '</script>';
        // Inject before the closing </div> of product detail
        productDetailHTML = galleryDataScript + productDetailHTML;


        let catsHTML = buildCatsHTML(categories, product.category);

        const cities = settings.cities || [];
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        cities.forEach(c => {
            citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`;
        });

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // --- Landing Page Layout Logic ---
        // (Removed CSS that hides header/footer to keep standard store appearance)
        if (product.isLandingPage) {
            const landingStyles = `
                <style>
                    .landing-sections-container { margin-top: 80px; }
                    .landing-row { margin-bottom: 80px; }
                    .premium-pulse { animation: premiumPulse 2s infinite; }
                    @keyframes premiumPulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.02); }
                        100% { transform: scale(1); }
                    }
                </style>
            `;
            html = html.replace('</head>', landingStyles + '</head>');
        }

        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{META_TITLE\}\}/g, `${product.name} | ${settings.storeName}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => productDetailHTML);
        html = html.replace(/\{\{CATEGORIES_HTML\}\}/g, catsHTML);
        html = html.replace(/\{\{CITIES_OPTIONS\}\}/g, citiesHTML);
        html = html.replace(/\{\{HERO_SECTION\}\}/g, '');
        html = html.replace(/\{\{ALL_ACTIVE\}\}/g, '');

        // Sidebar render logic
        html = renderStoreTemplate(html, settings, catsHTML, product.category);

        res.send(html);
    },

    cat: (req, res, catId) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};
        const currency = settings.currency || '$';
        const categories = db.categories || [];
        const sort = req.query.sort || 'default';
        const isAll = catId === 'all';
        const isNewArrivals = req.query.filter === 'new_arrivals';
        const isRecommended = req.query.filter === 'recommended';
        const subCategoryIds = isAll ? [] : categories.filter(c => c.parentId === catId).map(c => c.id);
        const allTargetCatIds = [catId, ...subCategoryIds];

        let products = applyActivePromotions(db.products || []).filter(p => {
            if (p.advanced && p.advanced.hiddenProduct) return false;
            if (checkComingSoon(p)) return false;
            if (isRecommended && (!p.advanced || !p.advanced.isRecommended)) return false;
            if (isAll) return true;
            const cats = Array.isArray(p.categories) ? p.categories : [p.category];
            return cats.some(cId => allTargetCatIds.includes(cId));
        });

        // Sorting Logic
        if ((isNewArrivals || isRecommended) && sort === 'default') products.sort((a, b) => b.id - a.id);
        else if (sort === 'id_desc' || sort === 'newest') products.sort((a, b) => b.id - a.id);
        else if (sort === 'id_asc' || sort === 'oldest') products.sort((a, b) => a.id - b.id);
        else if (sort === 'price_asc' || sort === 'price_low') products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        else if (sort === 'price_desc' || sort === 'price_high') products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        else if (sort === 'title_asc') products.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        else if (sort === 'title_desc') products.sort((a, b) => b.name.localeCompare(a.name, 'ar'));
        else if (sort === 'random') products.sort(() => Math.random() - 0.5);
        else if (sort === 'bestseller' || sort === 'views_asc') products.sort(() => Math.random() - 0.5); // Placeholder

        if (req.query.format === 'json') return res.json(products);

        let catsHTML = buildCatsHTML(categories, catId);

        const currentCategory = isNewArrivals ? { name: 'وصل حديثاً ✨', id: 'all' } : (isRecommended ? { name: 'منتجات موصى بها ⭐', id: 'all' } : (isAll ? { name: 'تصفح كافة المنتجات', id: 'all' } : (categories.find(c => c.id === catId) || { name: 'التصنيف' })));
        const parentCategory = currentCategory.parentId ? categories.find(c => c.id === currentCategory.parentId) : null;

        let breadcrumbsHTML = `
            <nav class="breadcrumbs">
                <a href="/">الرئيسية</a>
                <i class="fa fa-chevron-left"></i>
                <a href="/?app=product.cat.all">كل المنتجات</a>
        `;
        if (parentCategory) {
            breadcrumbsHTML += `
                <i class="fa fa-chevron-left"></i>
                <a href="/?app=product.cat.${parentCategory.id}">${parentCategory.name}</a>
            `;
        }
        breadcrumbsHTML += `
                <i class="fa fa-chevron-left"></i>
                <span class="current">${currentCategory.name}</span>
            </nav>
        `;

        const subcategories = categories.filter(c => c.parentId === catId);
        let subcatsHTML = '';
        if (subcategories.length > 0) {
            subcatsHTML = `
                <div class="subcategories-bar" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:25px; padding:15px; background:var(--gray-50); border-radius:14px; border:1px solid var(--gray-200); align-items:center;">
                    <span style="font-weight:800; color:var(--gray-600); display:flex; align-items:center; gap:6px; font-size:14px; margin-left:10px;"><i class="fa fa-sitemap"></i> الأقسام الفرعية:</span>
                    ${subcategories.map(sc => `
                        <a href="/?app=product.cat.${sc.id}" style="text-decoration:none; padding:6px 14px; background:#fff; border:1px solid var(--gray-200); border-radius:30px; font-size:13px; font-weight:700; color:var(--dark); transition:all 0.2s ease; display:inline-flex; align-items:center; gap:8px; box-shadow:var(--shadow-sm);" onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--gray-200)'; this.style.transform='none';">
                            ${sc.icon ? `<img src="${sc.icon}" style="width:22px; height:22px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none';">` : (sc.image ? `<img src="${sc.image}" style="width:22px; height:22px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none';">` : `<i class="fa fa-folder-open" style="font-size:13px; color:var(--primary);"></i>`)}
                            <span>${sc.name}</span>
                            <i class="fa fa-chevron-left" style="font-size:9px; opacity:0.4;"></i>
                        </a>
                    `).join('')}
                </div>
            `;
        }

        let categoryHeroHTML = '';
        if (currentCategory.image) {
            categoryHeroHTML = `
                <div class="category-hero" style="position:relative; width:100%; height:220px; border-radius:20px; overflow:hidden; margin-bottom:25px; box-shadow:var(--shadow-md); background:url('${currentCategory.image}') no-repeat center center; background-size:cover;">
                    <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 100%); display:flex; flex-direction:column; justify-content:flex-end; padding:25px; color:#fff;">
                        <h1 style="font-weight:900; font-size:32px; margin:0 0 5px 0; text-shadow:0 2px 4px rgba(0,0,0,0.3); font-family:'Tajawal', sans-serif;">${currentCategory.name}</h1>
                        ${currentCategory.description ? `<p style="font-size:14px; margin:0; opacity:0.9; text-shadow:0 1px 2px rgba(0,0,0,0.3); max-width:600px; font-family:'Tajawal', sans-serif;">${currentCategory.description}</p>` : ''}
                    </div>
                </div>
            `;
        }

        let productsHTML = breadcrumbsHTML + categoryHeroHTML + subcatsHTML;

        if (products.length === 0) {
            productsHTML += `<div class="empty-state"><h3>لا توجد منتجات في هذا التصنيف حالياً.</h3></div>`;
        } else {
            productsHTML += `
                <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                <h2 class="section-title">
                    ${currentCategory.name}
                    <span style="font-size:14px; font-weight:400; color:var(--gray-400); margin-right:8px;">(${products.length} منتج)</span>
                </h2>
                <div class="sort-box">
                    <select id="sort" style="padding:8px 15px; border-radius:8px; border:1px solid var(--gray-200); font-size:12px; font-weight:700; color:var(--gray-600); outline:none; cursor:pointer; background:var(--white);" onchange="location.href='/?app=product.cat.${catId}&sort=' + this.value">
                        <option value="default" ${sort === 'default' ? 'selected' : ''}>ترتيب افتراضي</option>
                        <option value="bestseller" ${sort === 'bestseller' ? 'selected' : ''}>ترتيب الأكثر مبيعاً</option>
                        <option value="views_asc" ${sort === 'views_asc' ? 'selected' : ''}>ترتيب الأكثر مشاهدة</option>
                        <option value="random" ${sort === 'random' ? 'selected' : ''}>ترتيب عشوائي</option>
                        <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>ترتيب السعر الأقل</option>
                        <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>ترتيب السعر الأعلى</option>
                        <option value="id_desc" ${sort === 'id_desc' ? 'selected' : ''}>ترتيب الجديد أولاً</option>
                        <option value="id_asc" ${sort === 'id_asc' ? 'selected' : ''}>ترتيب القديم أولاً</option>
                        <option value="title_asc" ${sort === 'title_asc' ? 'selected' : ''}>ترتيب أبجدي أ-ي</option>
                        <option value="title_desc" ${sort === 'title_desc' ? 'selected' : ''}>ترتيب أبجدي ي-أ</option>
                    </select>
                </div>
            </div>
            <div class="product-grid">
            `;
            products.forEach((p, idx) => {
                const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
                const isHidden = idx >= 12;
                const productCatId = Array.isArray(p.categories) ? p.categories[0] : (p.category || '0');
                const productCat = categories.find(c => c.id === productCatId) || { name: 'عام' };
                const isComingSoon = checkComingSoon(p);
                const isNew = isNewArrivals || (Date.now() - parseInt(p.id)) < (48 * 60 * 60 * 1000);

                productsHTML += `
                    <div class="product-card ${isComingSoon ? 'coming-soon-card' : ''} ${isHidden ? 'hidden-product-card' : ''}" style="${isHidden ? 'display: none;' : ''}" onclick="window.location.href='/?app=product.show.${p.id}'">
                        <span class="product-cat" style="padding: 8px 12px 0; text-align: center;">${productCat.name}</span>
                        <div class="product-img">
                            ${isComingSoon ? `<div class="coming-soon-badge">قريباً</div>` : (isNew ? `<div class="new-badge">جديد</div>` : '')}
                            ${discount > 0 && !isComingSoon ? `<div class="discount-badge">خصم ${discount}%</div>` : ''}
                            <button class="fav-btn" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                            <img src="${p.image}" loading="lazy" style="${isComingSoon ? 'filter: grayscale(0.5) opacity(0.8);' : ''}">
                        </div>
                        <div class="product-info">
                            <span class="product-name">${p.name}</span>
                            ${buildVariantChipsHTML(p)}
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                                <div class="product-price">
                                    ${isComingSoon ? '<span style="color:var(--gray-500); font-size:14px;">بانتظار التوفر</span>' : `${currency}${p.price}${p.salePrice ? `<span class="old-price">${currency}${p.salePrice}</span>` : ''}`}
                                </div>
                                ${isComingSoon ? `
                                    <button class="cart-icon-btn" disabled style="background:var(--gray-200); color:var(--gray-400); cursor:not-allowed;"><i class="fas fa-lock"></i></button>
                                ` : `
                                    <button class="cart-icon-btn" onclick="${getQAOnClick(p)}"><i class="fa fa-shopping-bag"></i></button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            });
            productsHTML += `</div>`;

            if (products.length > 12) {
                productsHTML += `
                    <div class="load-more-container" style="text-align:center; margin: 30px auto 10px;">
                        <button id="btnLoadMore" onclick="loadMoreProducts()" style="padding:12px 35px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-weight:800; font-size:16px; cursor:pointer; box-shadow:0 10px 20px var(--primary-light); transition:all 0.3s ease;">عرض المزيد من المنتجات <i class="fa fa-chevron-down" style="margin-right:8px;"></i></button>
                    </div>
                `;
            }
        }

        const cities = settings.cities || [];
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        cities.forEach(c => {
            citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`;
        });

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{META_TITLE\}\}/g, settings.metaTitle || settings.storeName || 'متجري');
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => productsHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*CITIES_OPTIONS\s*\}\}/g, citiesHTML);
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, '');
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');

        // Sidebar render logic
        html = renderStoreTemplate(html, settings, catsHTML, catId);

        res.send(html);
    },

    view_cart: (req, res) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};
        const currency = settings.currency || '$';
        const categories = db.categories || [];

        const cartHTML = `
            <div class="cart-page-view">
                <h2 style="margin-bottom:30px; font-weight:900; display:flex; align-items:center; gap:12px;"><i class="fa fa-shopping-bag" style="color:var(--primary);"></i> سلة المشتريات</h2>
                
                <div class="cart-layout" style="display:flex; gap:30px;">
                    <div class="cart-items-column" style="flex:1;">
                        <div id="cart-items-list" style="display:flex; flex-direction:column; gap:15px;">
                            <!-- Items loaded via JS -->
                        </div>
                    </div>
                    
                    <div class="cart-summary-column" style="width:350px;">
                        <div class="summary-card" style="background:var(--gray-100); padding:25px; border-radius:20px; border:1px solid var(--gray-200); position:sticky; top:20px;">
                            <h3 style="margin-bottom:20px; font-weight:800;">إتمام الطلب</h3>
                            <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:700;">
                                <span>الإجمالي:</span>
                                <span id="cart-total-val" style="color:var(--primary); font-size:20px;">0</span>
                            </div>
                            
                            <form action="/?app=order.submit" method="POST" id="checkoutForm" onsubmit="return prepareCheckout()">
                                <input type="hidden" name="cartData" id="cartDataInput">
                                <input type="hidden" name="total" id="totalPriceInput">
                                
                                <div style="display:flex; flex-direction:column; gap:15px;">
                                    <div class="form-field">
                                        <label style="display:block; font-size:12px; font-weight:800; margin-bottom:5px;">الاسم الكامل</label>
                                        <input type="text" name="customerName" required style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--gray-200); outline:none;">
                                    </div>
                                    <div class="form-field">
                                        <label style="display:block; font-size:12px; font-weight:800; margin-bottom:5px;">رقم الجوال</label>
                                        <input type="tel" name="customerPhone" required style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--gray-200); outline:none;">
                                    </div>
                                    <div class="form-field">
                                        <label style="display:block; font-size:12px; font-weight:800; margin-bottom:5px;">العنوان بالتفصيل</label>
                                        <textarea name="customerAddress" required rows="3" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--gray-200); outline:none; resize:none;"></textarea>
                                    </div>
                                    <button type="submit" class="checkout-btn" style="width:100%; padding:15px; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:800; cursor:pointer; font-size:16px; margin-top:10px; transition:0.3s;">تأكيد الطلب</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .cart-page-view { background:#fff; padding:40px; border-radius:25px; border:1px solid #eee; }
                .cart-item-row { display:flex; gap:20px; align-items:center; background:#fdfdfd; padding:20px; border-radius:15px; border:1px solid #f0f0f0; transition:0.2s; }
                .cart-item-row:hover { border-color: var(--primary); transform: translateX(-5px); }
                .cart-item-img { width:90px; height:90px; border-radius:12px; object-fit:cover; border:1px solid #eee; }
                .cart-item-info { flex:1; }
                .cart-item-name { font-weight:800; font-size:16px; margin-bottom:5px; }
                .cart-item-meta { font-size:12px; color:var(--gray-600); margin-bottom:8px; }
                .cart-item-price { font-weight:800; color:var(--primary); font-size:18px; }
                .remove-item { background:none; border:none; color:#f43f5e; cursor:pointer; font-size:18px; transition:0.2s; }
                .remove-item:hover { transform: scale(1.2); }
                .checkout-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
                @media (max-width: 900px) {
                    .cart-layout { flex-direction: column; }
                    .cart-summary-column { width: 100%; }
                }
            </style>

            <script>
                function renderCartPage() {
                    const cart = getCart();
                    const container = document.getElementById('cart-items-list');
                    const totalEl = document.getElementById('cart-total-val');
                    let total = 0;

                    if(cart.length === 0) {
                        document.querySelector('.cart-layout').innerHTML = \`
                            <div style="text-align:center; padding:100px 20px; width:100%;">
                                <i class="fa fa-shopping-bag" style="font-size:60px; color:#eee; margin-bottom:20px;"></i>
                                <h3 style="color:#999;">سلة المشتريات فارغة حالياً</h3>
                                <a href="/" style="display:inline-block; margin-top:20px; color:var(--primary); font-weight:800; text-decoration:none;">استمر في التسوق <i class="fa fa-arrow-left"></i></a>
                            </div>
                        \`;
                        return;
                    }

                    container.innerHTML = cart.map((item, i) => {
                        total += item.price * item.quantity;
                        return \`
                            <div class="cart-item-row">
                                <img src="\${item.image}" class="cart-item-img">
                                <div class="cart-item-info">
                                    <div class="cart-item-name">\${item.name}</div>
                                    <div class="cart-item-meta">\${item.color || ''} \${item.size || ''}</div>
                                    <div class="cart-item-price">${currency}\${item.price}</div>
                                </div>
                                <div style="display:flex; align-items:center; gap:15px;">
                                    <div style="font-weight:700;">x \${item.quantity}</div>
                                    <button class="remove-item" onclick="removeFromCartPage(\${i})"><i class="fa fa-trash-alt"></i></button>
                                </div>
                            </div>
                        \`;
                    }).join('');

                    totalEl.innerText = '${currency}' + total;
                    document.getElementById('totalPriceInput').value = total;
                    document.getElementById('cartDataInput').value = JSON.stringify(cart);
                }

                function removeFromCartPage(i) {
                    let cart = getCart();
                    cart.splice(i, 1);
                    saveCart(cart);
                    renderCartPage();
                }

                function prepareCheckout() {
                    const cart = getCart();
                    if(cart.length === 0) return false;
                    
                    const form = document.querySelector('form[action="/?app=order"]');
                    if (form) {
                        const tracking = {
                            utm_source: localStorage.getItem('store_utm_source') || '',
                            utm_campaign: localStorage.getItem('store_utm_campaign') || '',
                            referrer: localStorage.getItem('store_referrer') || '',
                            visitedPages: localStorage.getItem('store_visited_pages') || '[]',
                            sessionCount: localStorage.getItem('store_session_count') || '1',
                            firstVisit: localStorage.getItem('store_first_visit') || ''
                        };
                        
                        const sessionStart = parseInt(sessionStorage.getItem('store_session_start') || Date.now());
                        const diffMs = Date.now() - sessionStart;
                        const minutes = Math.floor(diffMs / 60000);
                        const seconds = Math.floor((diffMs % 60000) / 1000);
                        tracking.timeSpent = \`\${minutes}:\${seconds < 10 ? '0' : ''}\${seconds} دقيقه\`;
                        
                        for (let key in tracking) {
                            let input = form.querySelector(\`input[name="\${key}"]\`);
                            if (!input) {
                                input = document.createElement('input');
                                input.type = 'hidden';
                                input.name = key;
                                form.appendChild(input);
                            }
                            input.value = tracking[key];
                        }
                    }
                    
                    localStorage.removeItem('cart');
                    return true;
                }

                document.addEventListener('DOMContentLoaded', renderCartPage);
                // Extra check if page loaded
                setTimeout(renderCartPage, 100);
            </script>
        `;

        let catsHTML = buildCatsHTML(categories);

        const cities = settings.cities || [];
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        cities.forEach(c => {
            citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`;
        });
        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{META_TITLE\}\}/g, `سلة المشتريات | ${settings.storeName}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => cartHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*CITIES_OPTIONS\s*\}\}/g, citiesHTML);
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');

        html = renderStoreTemplate(html, settings, catsHTML);
        res.send(html);
    },

    submit_order: (req, res) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};

        // --- Phone Number Validation (Backend) ---
        const phone = String(req.body.customerPhone || '').replace(/\D/g, '');
        if (phone.length !== 10) {
            if (req.query.ajax === 'true' || req.xhr || req.headers['content-type'] === 'application/json') {
                return res.json({ success: false, message: 'يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام.' });
            }
            return res.status(400).send('رقم الهاتف غير صحيح، يجب أن يتكون من 10 أرقام.');
        }

        const categories = db.categories || [];
        const orders = dbHelper.readOrders();
        const orderId = 'ORD-' + Date.now().toString().slice(-6);
        const newOrder = {
            id: orderId,
            date: new Date().toISOString(),
            customer: {
                name: req.body.customerName,
                phone: req.body.customerPhone,
                address: req.body.customerAddress,
                city: req.body.customerCity || '',
                email: req.body.customerEmail || ''
            },
            items: JSON.parse(req.body.cartData || '[]'),
            total: req.body.total,
            shippingCost: req.body.shippingCost || 0,
            discount: req.body.discount || 0,
            couponCode: req.body.couponCode || '',
            status: 'جديد',
            utm_source: req.body.utm_source || '',
            utm_campaign: req.body.utm_campaign || '',
            referrer: req.body.referrer || '',
            visitedPages: JSON.parse(req.body.visitedPages || '[]'),
            notes: req.body.notes || '',
            timeSpent: req.body.timeSpent || '',
            sessionCount: req.body.sessionCount || '',
            firstVisit: req.body.firstVisit || '',
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
            ipCountry: 'il',
            isWholesale: req.body.isWholesale === 'true' || req.body.isWholesale === true,
            distributorId: req.body.distributorId || null
        };
        orders.unshift(newOrder);
        dbHelper.writeOrders(orders);

        // 🗑️ Clean up abandoned cart for this session or phone
        try {
            const abandonedPath = path.join(__dirname, '../data/abandoned.json');
            if (fs.existsSync(abandonedPath)) {
                let abandonedData = JSON.parse(fs.readFileSync(abandonedPath, 'utf8') || '[]');
                const phone = String(req.body.customerPhone || '').replace(/\D/g, '');
                const sessionId = req.body.sessionId || '';
                
                const filtered = abandonedData.filter(c => {
                    const entryPhone = String(c.phone || '').replace(/\D/g, '');
                    const entrySession = c.sessionId || '';
                    // Delete if either phone matches or sessionId matches
                    const phoneMatch = phone && entryPhone === phone;
                    const sessionMatch = sessionId && entrySession === sessionId;
                    return !phoneMatch && !sessionMatch;
                });
                
                if (filtered.length !== abandonedData.length) {
                    fs.writeFileSync(abandonedPath, JSON.stringify(filtered, null, 2));
                }
            }
        } catch(e) { console.error('Abandoned cleanup error:', e); }

        // 🔔 Trigger Firebase Cloud Messaging push to all admin devices
        triggerFCMPush(newOrder);

        if (req.query.ajax === 'true' || req.xhr || req.headers['content-type'] === 'application/json') {
            return res.json({ success: true, orderId: orderId });
        }

        const successHTML = `
            <div style="text-align:center; padding:80px 20px; background:#fff; border-radius:20px; border:1px solid #eee; margin:40px auto; max-width:600px;">
                <i class="fa fa-check-circle" style="font-size:80px; color:#10b981; margin-bottom:20px;"></i>
                <h1 style="font-weight:900; margin-bottom:15px;">تم استلام طلبك بنجاح! 🎉</h1>
                <p style="color:#64748b; font-size:16px; margin-bottom:20px;">سنقوم بالتواصل معك قريباً لتأكيد الطلب وترتيب عملية التوصيل.</p>
                <div style="background:#f8fafc; padding:15px; border-radius:10px; display:inline-block; margin-bottom:30px;">
                    <span style="color:#475569;">رقم الطلب:</span> <strong>${orderId}</strong>
                </div>
                <br>
                <a href="/" style="display:inline-block; padding:12px 25px; background:var(--primary); color:#fff; text-decoration:none; border-radius:10px; font-weight:700;">العودة للتسوق</a>
                <a href="/?app=orders.view" style="display:inline-block; padding:12px 25px; background:#f1f5f9; color:#0f172a; text-decoration:none; border-radius:10px; font-weight:700; margin-right:10px;">تتبع طلباتي</a>
                <script>
                    localStorage.removeItem('cart');
                    if(document.getElementById('cart-count')) document.getElementById('cart-count').innerText = '0';
                    
                    function playSuccessSound() {
                        try {
                            const ctx = new (window.AudioContext || window.webkitAudioContext)();
                            const notes = [
                                { f: 523.25, d: 0.15 }, // C5
                                { f: 659.25, d: 0.15 }, // E5
                                { f: 783.99, d: 0.15 }, // G5
                                { f: 1046.50, d: 0.40 } // C6
                            ];
                            notes.forEach((note, index) => {
                                const delay = index * 0.12;
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.type = 'sine';
                                osc.frequency.setValueAtTime(note.f, ctx.currentTime + delay);
                                gain.gain.setValueAtTime(0, ctx.currentTime + delay);
                                gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
                                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + note.d);
                                osc.start(ctx.currentTime + delay);
                                osc.stop(ctx.currentTime + delay + note.d);
                            });
                        } catch(e) {}
                    }
                    setTimeout(playSuccessSound, 300);
                    const playOnInteraction = () => { playSuccessSound(); window.removeEventListener('click', playOnInteraction); window.removeEventListener('touchstart', playOnInteraction); };
                    window.addEventListener('click', playOnInteraction);
                    window.addEventListener('touchstart', playOnInteraction);
                </script>
            </div>
        `;

        let catsHTML = buildCatsHTML(categories);
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        (settings.cities || []).forEach(c => { citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`; });

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{META_TITLE\}\}/g, `تأكيد الطلب | ${settings.storeName || 'متجري'}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => successHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*CITIES_OPTIONS\s*\}\}/g, citiesHTML);
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, '');
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');

        html = renderStoreTemplate(html, settings, catsHTML);
        res.send(html);
    },

    view_wishlist: (req, res) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};
        const categories = db.categories || [];

        const wishlistHTML = `
            <div style="background:#fff; padding:40px; border-radius:25px; border:1px solid #eee;">
                <h2 style="margin-bottom:30px; font-weight:900; display:flex; align-items:center; gap:12px;"><i class="fa fa-heart" style="color:#ef4444;"></i> قائمة المفضلة</h2>
                <div id="wishlist-grid" class="product-grid"></div>
            </div>
            <script>
                function renderWishlist() {
                    const favs = getFavorites();
                    const container = document.getElementById('wishlist-grid');
                    if(favs.length === 0) {
                        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><i class="fa fa-heart-broken" style="font-size:50px; color:#cbd5e1; margin-bottom:15px;"></i><h3 style="color:#64748b;">المفضلة فارغة</h3></div>';
                        return;
                    }
                    container.innerHTML = favs.map(p => \`
                        <div class="product-card" onclick="window.location.href='/?app=product.show.\${p.id}'">
                            <button class="fav-btn" style="color:#ef4444;" onclick="event.stopPropagation(); toggleFavorite('\${p.id}', '\${p.name}', \${p.price}, '\${p.image}'); renderWishlist();"><i class="fa fa-heart"></i></button>
                            <div class="product-img"><img src="\${p.image}"></div>
                            <div class="product-info">
                                <span class="product-name">\${p.name}</span>
                                <div class="product-price">\${p.currency || '$'}\${p.price}</div>
                            </div>
                        </div>
                    \`).join('');
                }
                document.addEventListener('DOMContentLoaded', renderWishlist);
                setTimeout(renderWishlist, 100);
            </script>
        `;

        let catsHTML = buildCatsHTML(categories);
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        (settings.cities || []).forEach(c => { citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`; });

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{META_TITLE\}\}/g, `المفضلة | ${settings.storeName || 'متجري'}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => wishlistHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*CITIES_OPTIONS\s*\}\}/g, citiesHTML);
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, '');
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');

        html = renderStoreTemplate(html, settings, catsHTML);
        res.send(html);
    },

    view_orders: (req, res) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};
        const categories = db.categories || [];
        const currency = settings.currency || '$';
        const phone = req.query.phone || '';

        const allOrders = dbHelper.readOrders();
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const filteredOrders = phone ? allOrders.filter(o => {
            const isSamePhone = o.customer.phone === phone;
            const orderDate = new Date(o.date);
            return isSamePhone && orderDate >= fourteenDaysAgo;
        }) : [];

        if (req.query.format === 'json') return res.json(filteredOrders);

        let ordersListHTML = phone ? (filteredOrders.length === 0 ? '<div style="text-align:center; padding:40px; color:#64748b;">لا توجد طلبات حديثة مسجلة بهذا الرقم.</div>' : filteredOrders.map(o => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:20px; border-radius:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                <div>
                    <div style="font-weight:800; font-size:16px; margin-bottom:5px;">طلب #${o.id}</div>
                    <div style="font-size:13px; color:#64748b;">${new Date(o.date).toLocaleDateString('ar-EG')}</div>
                </div>
                <div>
                    <span style="background:#fef3c7; color:#d97706; padding:5px 12px; border-radius:8px; font-size:13px; font-weight:800;">${o.status}</span>
                </div>
                <div style="font-weight:900; color:var(--primary); font-size:18px;">
                    ${currency}${o.total}
                </div>
            </div>
        `).join('')) : '';

        const ordersHTML = `
            <div style="background:#fff; padding:40px; border-radius:25px; border:1px solid #eee; max-width:800px; margin:0 auto;">
                <h2 style="margin-bottom:30px; font-weight:900; display:flex; align-items:center; gap:12px;"><i class="fa fa-box" style="color:var(--primary);"></i> تتبع طلباتي</h2>
                <div style="background:#f1f5f9; padding:20px; border-radius:15px; margin-bottom:30px;">
                    <form action="/" method="GET" style="display:flex; gap:10px; flex-wrap:wrap;">
                        <input type="hidden" name="app" value="orders.view">
                        <input type="tel" name="phone" value="${phone}" placeholder="أدخل رقم الجوال المستخدم في الطلب" required style="flex:1; min-width:200px; padding:12px 15px; border:1px solid #cbd5e1; border-radius:10px; outline:none; font-family:inherit;">
                        <button type="submit" style="padding:12px 25px; background:var(--primary); color:#fff; border:none; border-radius:10px; font-weight:800; cursor:pointer;">بحث</button>
                    </form>
                </div>
                ${ordersListHTML}
            </div>
        `;

        let catsHTML = buildCatsHTML(categories);
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        (settings.cities || []).forEach(c => { citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`; });

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{META_TITLE\}\}/g, `طلباتي | ${settings.storeName || 'متجري'}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => ordersHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*CITIES_OPTIONS\s*\}\}/g, citiesHTML);
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, '');
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');

        html = renderStoreTemplate(html, settings, catsHTML);
        res.send(html);
    },

    invoice: (req, res, orderId) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};
        const categories = db.categories || [];
        const orders = dbHelper.readOrders();
        const order = orders.find(o => o.id === orderId);

        if (!order) {
            return res.status(404).send('الطلب غير موجود');
        }

        const currency = settings.currency || '$';

        // Build items table
        let itemsHTML = '';
        order.items.forEach(item => {
            const variantText = (item.color || item.size) ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">الخيارات: ${[item.color, item.size].filter(Boolean).join(' - ')}</div>` : '';
            itemsHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 10px; text-align: right;">
                        <div style="font-weight: 700; color: #1e293b;">${item.name}</div>
                        ${variantText}
                    </td>
                    <td style="padding: 12px 10px; text-align: center; color: #475569;">${currency}${parseFloat(item.price).toFixed(2)}</td>
                    <td style="padding: 12px 10px; text-align: center; color: #475569; font-weight: 700;">${item.quantity}</td>
                    <td style="padding: 12px 10px; text-align: left; font-weight: 800; color: var(--primary);">${currency}${(parseFloat(item.price) * parseInt(item.quantity)).toFixed(2)}</td>
                </tr>
            `;
        });

        const subtotal = order.items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);

        const invoiceHTML = `
            <div class="invoice-container" style="background:#fff; border-radius:24px; border:1px solid #e2e8f0; max-width:800px; margin:40px auto; padding:40px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); direction:rtl; font-family:'Tajawal', sans-serif;">
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px dashed #e2e8f0; padding-bottom:30px; margin-bottom:30px; flex-wrap:wrap; gap:20px;">
                    <div>
                        <div style="font-size: 28px; font-weight: 900; color: var(--primary); display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                            <i class="fa fa-gem"></i> ${settings.storeName || 'متجري'}
                        </div>
                        <div style="font-size: 13px; color: #64748b;">رقم الهاتف: ${settings.storePhone || ''}</div>
                    </div>
                    <div style="text-align:left;">
                        <h2 style="margin:0 0 5px 0; font-size:22px; font-weight:900; color:#1e293b;">فاتورة شراء</h2>
                        <div style="background:var(--primary-light); color:var(--primary); padding:5px 12px; border-radius:8px; display:inline-block; font-size:12px; font-weight:800; margin-bottom:8px;">#${order.id}</div>
                        <div style="font-size: 12px; color: #64748b;">التاريخ: ${new Date(order.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</div>
                    </div>
                </div>

                <!-- Info Cards -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:30px; text-align:right;">
                    <div style="background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #f1f5f9;">
                        <h4 style="margin:0 0 10px 0; color:#475569; font-size:14px; font-weight:800; display:flex; align-items:center; gap:6px;"><i class="fa fa-user" style="color:var(--primary);"></i> معلومات المشتري</h4>
                        <div style="font-weight:700; color:#1e293b; margin-bottom:5px;">${order.customer.name}</div>
                        <div style="font-size:13px; color:#475569; margin-bottom:5px;">هاتف: ${order.customer.phone}</div>
                        ${order.customer.email ? `<div style="font-size:13px; color:#475569;">إيميل: ${order.customer.email}</div>` : ''}
                    </div>
                    <div style="background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #f1f5f9;">
                        <h4 style="margin:0 0 10px 0; color:#475569; font-size:14px; font-weight:800; display:flex; align-items:center; gap:6px;"><i class="fa fa-truck" style="color:var(--primary);"></i> الشحن والتوصيل</h4>
                        <div style="font-weight:700; color:#1e293b; margin-bottom:5px;">المدينة: ${order.customer.city || ''}</div>
                        <div style="font-size:13px; color:#475569; margin-bottom:5px;">العنوان: ${order.customer.address}</div>
                        <div style="font-size:13px; color:#475569;">الحالة: <span style="font-weight:800; color:var(--primary);">${order.status || 'جديد'}</span></div>
                    </div>
                </div>

                <!-- Items Table -->
                <table style="width:100%; border-collapse:collapse; text-align:right; margin-bottom:30px;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569; font-weight:800; font-size:13px;">
                            <th style="padding:12px 10px; text-align:right;">المنتج</th>
                            <th style="padding:12px 10px; text-align:center;">السعر</th>
                            <th style="padding:12px 10px; text-align:center;">الكمية</th>
                            <th style="padding:12px 10px; text-align:left;">المجموع</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <!-- Summary -->
                <div style="width:100%; max-width:320px; margin-right:auto; margin-left:0; background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #f1f5f9;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px; color:#475569;">
                        <span>مجموع المنتجات:</span>
                        <span style="font-weight:700; color:#1e293b;">${currency}${subtotal.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px; color:#475569;">
                        <span>تكلفة التوصيل:</span>
                        <span style="font-weight:700; color:#1e293b;">+ ${currency}${parseFloat(order.shippingCost || 0).toFixed(2)}</span>
                    </div>
                    ${parseFloat(order.discount || 0) > 0 ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:14px; color:#ef4444;">
                        <span>خصم إضافي:</span>
                        <span style="font-weight:700;">- ${currency}${parseFloat(order.discount || 0).toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div style="display:flex; justify-content:space-between; border-top:2px dashed #e2e8f0; padding-top:15px; font-size:18px; font-weight:900; color:var(--primary);">
                        <span>الإجمالي الكلي:</span>
                        <span>${currency}${parseFloat(order.total).toFixed(2)}</span>
                    </div>
                </div>

                <!-- Footer / Action Buttons -->
                <div class="no-print" style="display:flex; justify-content:center; gap:15px; margin-top:45px; border-top:1px solid #e2e8f0; padding-top:30px;">
                    <button onclick="window.print()" style="padding:12px 30px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-weight:800; font-size:15px; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 10px 20px var(--primary-light);"><i class="fa fa-print"></i> طباعة الفاتورة</button>
                    <a href="/" style="padding:12px 30px; background:#f1f5f9; color:#0f172a; text-decoration:none; border-radius:12px; font-weight:800; font-size:15px; display:flex; align-items:center; gap:8px;"><i class="fa fa-home"></i> العودة للموقع</a>
                </div>
            </div>
            <style>
                @media print {
                    body { background: #fff !important; color: #000 !important; }
                    .no-print, header, footer, .top-bar, .mobile-bottom-nav, .whatsapp-bubble, .traffic-floating-info { display: none !important; }
                    .invoice-container { border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
                }
            </style>
        `;

        let catsHTML = buildCatsHTML(categories);
        let citiesHTML = '<option value="" disabled selected>اختر المدينة...</option>';
        (settings.cities || []).forEach(c => { citiesHTML += `<option value="${c.name}" data-price="${c.price}">${c.name}</option>`; });

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{STORE_NAME\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{STORE_PHONE\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{MAIN_COLOR\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{META_TITLE\}\}/g, `فاتورة الطلب #${order.id} | ${settings.storeName || 'متجري'}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => invoiceHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*CITIES_OPTIONS\s*\}\}/g, citiesHTML);
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, '');
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');

        html = renderStoreTemplate(html, settings, catsHTML);
        res.send(html);
    },

    view_reels: (req, res) => {
        const db = dbHelper.readData();
        const reels = db.reels || [];
        const settings = db.settings || {};
        const products = db.products || [];

        const reelsShuffle = settings.reelsShuffle !== false; // default true = random
        let displayReels = [...reels];
        if (reelsShuffle) {
            // Fisher-Yates shuffle
            for (let i = displayReels.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [displayReels[i], displayReels[j]] = [displayReels[j], displayReels[i]];
            }
        }

        let reelsHTML = `
            <div class="reels-page-container">
                <a href="/" class="reel-back-btn"><i class="fa fa-arrow-right"></i></a>
        `;

        if (displayReels.length === 0) {
            reelsHTML += `
                <div class="empty-state">
                    <i class="fa fa-video-slash"></i>
                    <h3>لا توجد فيديوهات ريلز حالياً</h3>
                    <a href="/" class="btn btn-primary">العودة للمتجر</a>
                </div>
            `;
        } else {
            displayReels.forEach((reel, index) => {
                const product = products.find(p => String(p.id) === String(reel.productId));
                reelsHTML += `
                    <div class="reel-video-section" id="reel-${reel.id}">
                        <video src="${reel.videoUrl}" autoplay muted playsinline class="reel-video-player"></video>
                        
                        <div class="reel-ui-overlay">
                                <div class="reel-side-actions">
                                    <div class="action-item" onclick="window.toggleReelLike('${reel.id}')">
                                        <i class="fa fa-heart"></i>
                                        <span>أعجبني</span>
                                    </div>
                                    <div class="action-item" onclick="window.shareReel('${reel.id}')">
                                        <i class="fa fa-share"></i>
                                        <span>مشاركة</span>
                                    </div>
                                </div>

                            <div class="reel-bottom-info">
                                <h3 class="reel-title">${reel.title || ''}</h3>
                                ${product ? `
                                    <div class="reel-product-card" onclick="window.location.href='/?app=product.show.${product.id}'">
                                        <img src="${product.image}" alt="${product.name}">
                                        <div class="product-details">
                                            <div class="name">${product.name}</div>
                                            <div class="price">${product.price} ${settings.currency || '₪'}</div>
                                        </div>
                                        <i class="fa fa-chevron-left"></i>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Unmute Overlay -->
                        <div class="unmute-overlay" onclick="window.unmuteAllVideos(this)">
                            <i class="fa fa-volume-mute"></i>
                            <span>انقر لتشغيل الصوت</span>
                        </div>

                        <!-- Play/Pause Indicator -->
                        <div class="play-pause-indicator"><i class="fa fa-play"></i></div>
                    </div>
                `;
            });
        }

        reelsHTML += `
                <!-- Navigation Controls -->
                <div class="reels-navigation">
                    <button class="nav-btn prev" onclick="window.scrollReel(-1)"><i class="fa fa-chevron-up"></i></button>
                    <button class="nav-btn next" onclick="window.scrollReel(1)"><i class="fa fa-chevron-down"></i></button>
                </div>

                <!-- Reels Share Modal -->
                <div id="reelShareModal" style="
                display:none; position:fixed; inset:0; z-index:20000;
                background:rgba(0,0,0,0.65); backdrop-filter:blur(12px);
                -webkit-backdrop-filter:blur(12px);
                align-items:flex-end; justify-content:center;
                font-family:'Tajawal',sans-serif; direction:rtl;
            " onclick="if(event.target===this) window.closeReelShare()">
                <div id="reelShareSheet" style="
                    background:linear-gradient(180deg,#1a1a2e 0%,#16213e 100%);
                    border-radius:28px 28px 0 0;
                    padding:24px 20px 36px;
                    width:100%; max-width:480px;
                    transform:translateY(100%);
                    transition:transform 0.38s cubic-bezier(0.34,1.56,0.64,1);
                ">
                    <!-- Header with Handle Bar & Close Button -->
                    <div style="display:flex; align-items:center; justify-content:center; position:relative; margin-bottom:20px;">
                        <div style="width:40px;height:4px;background:rgba(255,255,255,0.25);border-radius:4px;"></div>
                        <button onclick="window.closeReelShare()" style="position:absolute; left:0; top:50%; transform:translateY(-50%); background:none; border:none; color:rgba(255,255,255,0.6); font-size:20px; cursor:pointer; padding:5px; transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.6)'">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>

                    <!-- Title -->
                    <div style="text-align:center;margin-bottom:22px;">
                        <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:4px;">مشاركة الريل</div>
                        <div id="reelShareUrlText" style="font-size:11px;color:rgba(255,255,255,0.4);word-break:break-all;padding:0 10px;"></div>
                    </div>

                    <!-- Social Buttons Grid -->
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;">
                        <!-- WhatsApp -->
                        <a id="shareWA" href="#" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;">
                            <div style="width:56px;height:56px;background:#25D366;border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(37,211,102,0.3);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                <i class="fab fa-whatsapp" style="color:#fff;font-size:26px;"></i>
                            </div>
                            <span style="font-size:11px;color:rgba(255,255,255,0.7);font-weight:700;">واتساب</span>
                        </a>
                        <!-- Telegram -->
                        <a id="shareTG" href="#" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;">
                            <div style="width:56px;height:56px;background:#0088CC;border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,136,204,0.3);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                <i class="fab fa-telegram-plane" style="color:#fff;font-size:26px;"></i>
                            </div>
                            <span style="font-size:11px;color:rgba(255,255,255,0.7);font-weight:700;">تيليجرام</span>
                        </a>
                        <!-- X (Twitter) -->
                        <a id="shareX" href="#" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;">
                            <div style="width:56px;height:56px;background:#000;border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                <i class="fab fa-x-twitter" style="color:#fff;font-size:22px;"></i>
                            </div>
                            <span style="font-size:11px;color:rgba(255,255,255,0.7);font-weight:700;">X</span>
                        </a>
                        <!-- Facebook -->
                        <a id="shareFB" href="#" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;">
                            <div style="width:56px;height:56px;background:#1877F2;border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(24,119,242,0.3);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                <i class="fab fa-facebook-f" style="color:#fff;font-size:24px;"></i>
                            </div>
                            <span style="font-size:11px;color:rgba(255,255,255,0.7);font-weight:700;">فيسبوك</span>
                        </a>
                    </div>

                    <!-- Copy Link Button -->
                    <button id="copyReelLinkBtn" onclick="window.copyReelLink()" style="
                        width:100%; padding:16px; border:none; cursor:pointer;
                        background:rgba(255,255,255,0.08);
                        border:1.5px solid rgba(255,255,255,0.15);
                        border-radius:16px; color:#fff;
                        font-size:14px; font-weight:800;
                        font-family:'Tajawal',sans-serif;
                        display:flex; align-items:center; justify-content:center; gap:10px;
                        transition:all 0.25s ease;
                    " onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        <i class="fa fa-link" style="font-size:16px;"></i>
                        <span id="copyBtnLabel">نسخ الرابط</span>
                    </button>
                </div>
            </div>
        </div>

            <style>
                body {
                    margin: 0;
                    padding: 0 !important;
                    background: #000;
                    width: 100vw;
                    height: 100vh;
                }
                header, footer, .top-bar, .whatsapp-bubble, .back-to-top, .traffic-floating-info, .sidebar, .floating-cart-bar, #pwaInstallBanner, .announcement-bar {
                    display: none !important;
                }
                .main-container {
                    margin: 0 !important;
                    padding: 0 !important;
                    max-width: 100% !important;
                    height: 100vh !important;
                    width: 100vw !important;
                    display: block !important;
                }
                .content-area {
                    padding: 0 !important;
                    margin: 0 !important;
                    height: 100vh !important;
                    width: 100vw !important;
                    max-width: 100% !important;
                }
                #publicMarketingContent {
                    height: 100vh;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .reels-page-container {
                    height: 100vh;
                    width: 100vw;
                    overflow-y: scroll;
                    scroll-snap-type: y mandatory;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    background: #000;
                    position: fixed;
                    top: 0;
                    left: 0;
                    z-index: 10000; /* Extremely high to cover everything */
                }
                .reels-page-container::-webkit-scrollbar {
                    display: none;
                }
                .reel-back-btn {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 2000;
                    width: 40px;
                    height: 40px;
                    background: rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    text-decoration: none;
                    font-size: 18px;
                    border: 1px solid rgba(255,255,255,0.3);
                    transition: 0.3s;
                }
                .reel-back-btn:hover {
                    background: var(--primary);
                }
                .reel-video-section {
                    height: 100vh;
                    width: 100%;
                    scroll-snap-align: start;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                }
                .reel-video-player {
                    width: 100%;
                    height: 100%;
                    max-width: 500px; /* Limit width on desktop to look like mobile */
                    object-fit: cover;
                    background: #000;
                    cursor: pointer;
                    position: relative;
                    z-index: 1;
                }
                .reel-ui-overlay {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    max-width: 500px;
                    margin: 0 auto;
                    background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.4) 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    padding: 0 0 40px 0; /* Space from bottom */
                    pointer-events: none;
                    z-index: 5;
                }
                .reel-ui-overlay * {
                    pointer-events: auto;
                }
                .unmute-overlay {
                    position: absolute;
                    top: 40px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.6);
                    color: #fff;
                    padding: 10px 20px;
                    border-radius: 50px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    backdrop-filter: blur(10px);
                    z-index: 10002;
                    border: 1px solid rgba(255,255,255,0.2);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    white-space: nowrap;
                }
                .reel-side-actions {
                    position: absolute;
                    right: 15px;
                    bottom: 180px; 
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                    align-items: center;
                    z-index: 100;
                    pointer-events: auto !important;
                }
                .action-item {
                    color: #fff;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                    cursor: pointer;
                    transition: 0.3s;
                    pointer-events: auto !important;
                }
                .action-item:hover { transform: scale(1.1); }
                .action-item i {
                    font-size: 28px;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
                }
                .action-item span {
                    font-size: 11px;
                    font-weight: 700;
                }
                .reel-bottom-info {
                    width: 100%;
                    padding: 0 15px;
                    display: flex;
                    flex-direction: column-reverse; /* Title (first in DOM) will be at bottom */
                    gap: 0;
                    pointer-events: auto !important;
                }
                @media (max-width: 768px) {
                    .reel-bottom-info {
                        padding-bottom: 110px; /* Above mobile nav */
                    }
                }
                .reel-title {
                    color: #fff;
                    font-size: 15px;
                    font-weight: 800;
                    margin: 0;
                    text-shadow: 0 2px 5px rgba(0,0,0,0.5);
                    max-width: 75%;
                    line-height: 1.4;
                }
                .reel-product-card {
                    background: rgba(255,255,255,0.95);
                    border-radius: 18px;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    opacity: 0;
                    max-height: 0;
                    overflow: hidden;
                    transform: translateY(10px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    width: fit-content;
                    max-width: 280px;
                    margin-bottom: 0;
                }
                .reel-product-card.show {
                    opacity: 1;
                    max-height: 100px;
                    padding: 10px 15px;
                    transform: translateY(0);
                    margin-bottom: 15px; /* Space above title */
                }
                /* Cleaned up duplicate/incorrect rules below */
                .reel-product-card img {
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    object-fit: cover;
                }
                .reel-product-card .product-details {
                    flex: 1;
                }
                .reel-product-card .name {
                    font-size: 14px;
                    font-weight: 800;
                    color: #000;
                }
                .reel-product-card .price {
                    font-size: 16px;
                    font-weight: 900;
                    color: var(--primary);
                }
                .reels-navigation {
                    position: fixed;
                    left: calc(50% + 270px); /* Positioned next to the 500px video */
                    top: 50%;
                    transform: translateY(-50%);
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    z-index: 10001;
                }
                @media (max-width: 1100px) {
                    .reels-navigation {
                        left: auto;
                        right: 10px;
                    }
                }
                @media (max-width: 768px) {
                    .reels-navigation {
                        display: none;
                    }
                    .reel-video-player {
                        max-width: 100%;
                    }
                    .reel-ui-overlay {
                        max-width: 100%;
                        padding-bottom: 80px; /* Elevated just above the mobile bottom nav */
                    }
                    .reel-bottom-info {
                        padding-bottom: 0 !important;
                        padding-right: 80px !important; /* Prevents overlap with side action buttons on RTL layout */
                    }
                    .reel-side-actions {
                        bottom: 140px !important;
                        right: 15px !important;
                    }
                }
                .nav-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    backdrop-filter: blur(10px);
                    transition: 0.3s;
                }
                .nav-btn:hover {
                    background: var(--primary);
                }
                .play-pause-indicator {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 80px;
                    height: 80px;
                    background: rgba(0,0,0,0.4);
                    border-radius: 50%;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-size: 35px;
                    pointer-events: none;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 0;
                    z-index: 10005;
                    border: 2px solid rgba(255,255,255,0.2);
                    backdrop-filter: blur(5px);
                }
                
                @media (max-width: 768px) {
                    .reels-navigation {
                        display: none;
                    }
                    .mobile-bottom-nav {
                        background: rgba(0,0,0,0.8) !important;
                        border-top: 1px solid rgba(255,255,255,0.1) !important;
                        backdrop-filter: blur(15px);
                        z-index: 10001 !important;
                    }
                    .mobile-bottom-nav a {
                        color: rgba(255,255,255,0.6) !important;
                    }
                    .mobile-bottom-nav a.active {
                        color: #fff !important;
                    }
                }
            </style>
        `;

        let htmlPath = path.join(__dirname, '../views/store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        const catsHTML = buildCatsHTML(db.categories || []);

        html = html.replace(/\{\{\s*STORE_NAME\s*\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{\s*STORE_PHONE\s*\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{\s*MAIN_COLOR\s*\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{\s*META_TITLE\s*\}\}/g, `فيديوهات ريلز | ${settings.storeName || 'متجري'}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => reelsHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, '');
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');
        html = html.replace(/\{\{\s*REELS_ACTIVE\s*\}\}/g, 'active');

        html = renderStoreTemplate(html, settings, catsHTML);
        res.send(html);
    }
};
