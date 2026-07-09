const path = require('path');
const fs = require('fs');
const dbHelper = require('../utils/dbHelper');

// Helper to update product stock
function adjustProductStock(items, direction) {
    const productsPath = path.join(__dirname, '../data/db.json');
    if (!fs.existsSync(productsPath)) return;
    try {
        const db = JSON.parse(fs.readFileSync(productsPath));
        if (!db.products) return;

        items.forEach(item => {
            const product = db.products.find(p => p.id === String(item.id));
            if (!product) return;

            const qty = parseInt(item.quantity) || 1;
            const change = direction === 'deduct' ? -qty : qty;

            // 1. If item has variants (color/size)
            let variantFound = false;
            if (product.variants && product.variants.length > 0 && (item.color || item.size)) {
                product.variants.forEach(variant => {
                    if (variant.values && Array.isArray(variant.values)) {
                        variant.values.forEach(val => {
                            const matchColor = item.color && String(val.value).trim() === String(item.color).trim();
                            const matchSize = item.size && String(val.value).trim() === String(item.size).trim();
                            if (matchColor || matchSize) {
                                const currentStock = parseInt(val.stock) || 0;
                                val.stock = String(Math.max(0, currentStock + change));
                                variantFound = true;
                            }
                        });
                    }
                });
            }

            // 2. Adjust global stock
            if (product.stock !== undefined) {
                const currentStock = parseInt(product.stock) || 0;
                product.stock = Math.max(0, currentStock + change);
            }
        });

        fs.writeFileSync(productsPath, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('Error adjusting stock:', e);
    }
}

module.exports = {
    login: (req, res) => {
        res.sendFile(path.join(__dirname, '../views/login.html'));
    },

    distributor_portal: (req, res) => {
        const db = dbHelper.readData();
        const settings = db.settings || {};
        let htmlPath = path.join(__dirname, '../views/distributor.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{storeName\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{mainColor\}\}/g, settings.mainColor || '#000');
        res.send(html);
    },

    admin_login: (req, res) => {
        if (req.method === 'POST') {
            const { email, password } = req.body;
            // Get credentials from DB or use default
            const db = dbHelper.readData();
            const settings = db.settings || {};
            const adminEmail = settings.adminEmail || 'admin@prostore.com';
            const adminPass = settings.adminPass || 'admin123';

            if (email === adminEmail && password === adminPass) {
                res.setHeader('Set-Cookie', 'admin_auth=logged_in; HttpOnly; Path=/; Max-Age=86400');
                return res.redirect('/?account=dashboard');
            } else {
                return res.send(`
                    <div style="text-align:center; padding:50px; font-family:sans-serif;">
                        <h2>بيانات الدخول غير صحيحة</h2>
                        <a href="/?account=login">العودة لتسجيل الدخول</a>
                    </div>
                `);
            }
        }
        res.status(405).send('Method Not Allowed');
    },

    logout: (req, res) => {
        res.setHeader('Set-Cookie', 'admin_auth=; HttpOnly; Path=/; Max-Age=0');
        res.redirect('/?account=login');
    },
    
    dashboard: (req, res) => {
        const db = dbHelper.readData();
        const products = db.products || [];
        const categories = db.categories || [];
        const orders = dbHelper.readOrders();
        const settings = db.settings || {};

        let catOptions = '';
        let catCheckboxes = '';
        categories.forEach(c => {
            catOptions += `<option value="${c.id}">${c.name}</option>`;
            catCheckboxes += `
                <label class="luxury-check" style="border:none; background:none; padding:5px 0;">
                    <input type="checkbox" value="${c.id}" name="category_check">
                    <span style="font-size:13px; font-weight:600;">${c.name}</span>
                </label>`;
        });

        // 1. Products Table
        let tableRows = '';
        products.forEach(p => {
            let optionsText = [];
            if(p.variants && p.variants.length) {
                p.variants.forEach(v => {
                    const count = Array.isArray(v.values) ? v.values.length : (typeof v.values === 'string' ? (v.values.includes(',') ? v.values.split(',').length : 1) : 0);
                    optionsText.push(`${v.name} (${count})`);
                });
            } else {
                if(p.colors && p.colors.length) optionsText.push(p.colors.length + ' ألوان');
                if(p.sizes && p.sizes.length) optionsText.push(p.sizes.length + ' مقاسات');
            }
            let opts = optionsText.length > 0 ? optionsText.join(', ') : 'لا يوجد';

            tableRows += `
                <tr class="product-row">
                    <td><img src="${p.image}" width="50" height="50" style="border-radius:10px; border:1px solid #eee; object-fit:cover;"></td>
                    <td>
                        <div class="search-target" style="font-weight:800; font-size:15px; color:#0f172a;">${p.name}</div>
                        <div style="font-size:12px; color:#64748b;">${p.sku || 'بدون SKU'}</div>
                    </td>
                    <td style="font-weight:700; color:#000;">
                        ${p.salePrice ? `<span style="text-decoration:line-through; color:#999; font-size:12px;">$${p.price}</span> $${p.salePrice}` : `$${p.price}`}
                    </td>
                    <td style="color:#64748b; font-size:13px;">${opts}</td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            <a href="/?account=dashboard&tab=product-editor&edit=${p.id}" class="btn-edit" style="background:#6366f1; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px; text-decoration:none; font-size:13px;"><i class="fa fa-edit"></i> تعديل</a>
                            <button onclick="confirmDeleteProduct('${p.id}')" style="color:#ef4444; background:#fee2e2; border:none; padding:8px 12px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer;"><i class="fa fa-trash"></i> حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        if(products.length === 0) {
            tableRows = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #777;">لا يوجد منتجات، أضف أول منتج.</td></tr>';
        }

        // 2. Orders Table
        let ordersRows = '';
        let statsOrdersRows = '';
        const statusColors = {
            'جديد':     { bg:'#eff6ff', color:'#2563eb' },
            'قيد المراجعة': { bg:'#fef9c3', color:'#a16207' },
            'قيد التنفيذ':  { bg:'#fff7ed', color:'#c2410c' },
            'تم الشحن': { bg:'#f0fdf4', color:'#15803d' },
            'مكتمل':    { bg:'#dcfce7', color:'#166534' },
            'ملغي':     { bg:'#fee2e2', color:'#991b1b' },
            'تم الارجاع':{ bg:'#fae8ff', color:'#86198f' }
        };
        orders.forEach(o => {
            let date = new Date(o.date).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' });
            let time = new Date(o.date).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' });
            let itemsCount = o.items.reduce((sum, item) => sum + item.quantity, 0);
            const sc = statusColors[o.status] || { bg:'#f3f4f6', color:'#374151' };
            const cur = settings.currency || '$';

            // Data Quality score
            const customer = o.customer || {};
            const hasPhone = !!(customer.phone && customer.phone.length > 5);
            const hasAddress = !!(customer.address && customer.address.length > 3);
            const hasEmail = !!(customer.email && customer.email.length > 4);
            const score = (hasPhone ? 1:0) + (hasAddress ? 1:0) + (hasEmail ? 1:0);
            const dqColor = score===3?'#15803d':score===2?'#a16207':'#991b1b';
            const dqBg = score===3?'#dcfce7':score===2?'#fef9c3':'#fee2e2';
            const dqLabel = score===3?'بيانات كاملة':score===2?'بيانات كافية':'بيانات ناقصة';

            // Extract IP country if available
            const ipCountry = o.ipCountry || '—';

            // Wholesale check
            const distributors = db.distributors || [];
            const approvedPhones = distributors.filter(d => d.status === 'approved').map(d => d.phone);
            const orderIsWholesale = o.isWholesale || (customer.phone && approvedPhones.includes(customer.phone));
            const wholesaleBadge = orderIsWholesale ? `
                <div style="background:#fff7ed; color:#c2410c; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:900; border:1px solid #fdba74; display:flex; align-items:center; gap:3px; margin-top:3px; width:fit-content;">
                    <i class="fas fa-store" style="font-size:10px;"></i> جملة
                </div>` : '';
            const rowStyle = orderIsWholesale ? 'background-color: #fffaf0; border-right: 4px solid #f97316;' : '';

            // Rows for Full Table (9 columns)
            ordersRows += `
                <tr style="cursor:pointer; ${rowStyle}" onclick="viewOrder('${o.id}')">
                    <td>
                        <div style="font-weight:800;color:var(--primary);font-size:13px;">#${o.id}</div>
                        <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${itemsCount} منتج</div>
                        ${wholesaleBadge}
                    </td>
                    <td>
                        <div style="font-weight:700;color:#111827;font-size:13px;">${customer.name||'—'}</div>
                        <div style="font-size:11px;color:#6b7280;margin-top:2px;" dir="ltr">${customer.phone||'—'}</div>
                    </td>
                    <td>
                        <div style="font-size:12px;color:#374151;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${customer.city||customer.address||'—'}</div>
                    </td>
                    <td>
                        <div style="font-weight:800;color:#111827;font-size:14px;">${parseFloat(o.total).toFixed(2)} ${cur}</div>
                    </td>
                    <td>
                        <span style="background:${sc.bg};color:${sc.color};padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;">${o.status||'جديد'}</span>
                    </td>
                    <td style="text-align:center;">
                        ${ipCountry !== '—' ? `<span style="background:#f1f5f9;color:#475569;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;"><i class="fas fa-globe"></i> ${ipCountry}</span>` : '—'}
                    </td>
                    <td>
                        <span style="background:${dqBg};color:${dqColor};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">${dqLabel}</span>
                    </td>
                    <td>
                        <div style="font-size:12px;color:#374151;font-weight:600;">${date}</div>
                        <div style="font-size:11px;color:#9ca3af;">${time}</div>
                    </td>
                    <td onclick="event.stopPropagation()">
                        <button onclick="viewOrder('${o.id}')" style="padding:6px 12px;font-size:12px;border-radius:8px;color:var(--primary);border:1.5px solid var(--primary-light);background:var(--primary-light);cursor:pointer;font-weight:700;"><i class="fas fa-eye"></i> عرض</button>
                    </td>
                </tr>
            `;

            // Rows for Stats Table (6 columns: ID, Name, Phone, Total, Status, Date)
            statsOrdersRows += `
                <tr style="cursor:pointer; ${rowStyle}" onclick="viewOrder('${o.id}')">
                    <td>
                        <div style="font-weight:800;color:var(--primary);font-size:13px;">#${o.id}</div>
                        ${wholesaleBadge}
                    </td>
                    <td style="font-weight:700;color:#111827;font-size:13px;">${customer.name||'—'}</td>
                    <td dir="ltr" style="font-size:12px;color:#6b7280;">${customer.phone||'—'}</td>
                    <td style="font-weight:800;color:#111827;font-size:13px;">${parseFloat(o.total).toFixed(2)} ${cur}</td>
                    <td>
                        <span style="background:${sc.bg};color:${sc.color};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">${o.status||'جديد'}</span>
                    </td>
                    <td style="font-size:12px;color:#374151;">${date}</td>
                </tr>
            `;
        });

        if(orders.length === 0) {
            ordersRows = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: #777;">لا يوجد طلبات واردة حالياً.</td></tr>';
            statsOrdersRows = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #777;">لا يوجد طلبات واردة حالياً.</td></tr>';
        }


        // 3. Categories Table
        let categoriesRows = '';
        let parentCatOptions = '';
        categories.forEach(c => {
            let pCount = products.filter(p => (p.categories || []).includes(c.id) || p.category === c.id).length;
            let parentName = categories.find(parent => parent.id === c.parentId)?.name || '<span style="color:#ccc;">-</span>';
            let catImg = c.image || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name) + '&background=f1f5f9&color=64748b';
            let brandBadge = c.isBrand ? `<span class="badge" style="background:var(--primary-light); color:var(--primary); font-size:10px; margin-right:5px;"><i class="fa fa-award"></i> ماركة</span>` : '';
            
            parentCatOptions += `<option value="${c.id}">${c.name}</option>`;

            categoriesRows += `
                <tr>
                    <td><img src="${catImg}" width="40" height="40" style="border-radius:8px; object-fit:cover; border:1px solid #eee;"></td>
                    <td style="font-weight:700;">${c.name} ${brandBadge}</td>
                    <td>${parentName}</td>
                    <td><span class="badge badge-success">${pCount} منتج</span></td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            <a href="/?account=dashboard&tab=categories&editCat=${c.id}" class="btn btn-outline" style="padding:5px 10px; font-size:12px; text-decoration:none;"><i class="fa fa-edit"></i> تعديل</a>
                            <a href="/?account=delete_category&id=${c.id}" style="color:#ef4444; background:#fee2e2; padding:5px 10px; border-radius:5px; text-decoration:none; font-weight:700; font-size:12px;" onclick="return confirm('هل أنت متأكب من حذف القسم؟')"><i class="fa fa-trash"></i></a>
                        </div>
                    </td>
                </tr>
            `;
        });
        if(categories.length === 0) categoriesRows = '<tr><td colspan="5" style="text-align:center;">لا يوجد أقسام حالياً.</td></tr>';

        // 4. Settings parsing

        let htmlPath = path.join(__dirname, '../views/dashboard.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // Inject JSON data safely using multiple fallback markers to ensure compatibility
        const productsJson = JSON.stringify(products).replace(/<\/script>/g, '<\\/script>');
        const categoriesJson = JSON.stringify(categories).replace(/<\/script>/g, '<\\/script>');
        html = html.replace(/\{\{PRODUCTS_JSON\}\}/g, () => productsJson);
        html = html.replace(/\{\{CATEGORIES_JSON\}\}/g, () => categoriesJson);

        html = html.replace(/\{\{TABLE_ROWS\}\}/g, () => tableRows);
        html = html.replace(/\{\{CATEGORY_OPTIONS\}\}/g, () => catOptions);
        html = html.replace(/\{\{CATEGORY_CHECKBOXES\}\}/g, () => catCheckboxes);
        html = html.replace(/\{\{PARENT_CATEGORY_OPTIONS\}\}/g, () => parentCatOptions);
        html = html.replace(/\{\{ORDERS_ROWS\}\}/g, () => ordersRows);
        html = html.replace(/\{\{\s*STATS_ORDERS_ROWS\s*\}\}/g, () => statsOrdersRows);
        if (!html.includes(statsOrdersRows) && statsOrdersRows !== '') {
            // Fallback split/join if regex failed for some reason
            html = html.split('{{STATS_ORDERS_ROWS}}').join(statsOrdersRows);
        }
        html = html.replace(/\{\{CATEGORIES_TABLE_ROWS\}\}/g, () => categoriesRows);
        
        // Inject orders and distributors data for modal
        const distributors = db.distributors || [];
        html = html.replace('</body>', () => `<script>window.storeOrdersData = ${JSON.stringify(orders).replace(/</g, '\\u003c')}; window.storeDistributorsData = ${JSON.stringify(distributors).replace(/</g, '\\u003c')}; window.storeCurrency = ${JSON.stringify(settings.currency || '$')};</script></body>`);
        
        // Stats
        let totalSales = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
        html = html.replace(/\$0\.00/g, () => '$' + totalSales.toFixed(2));
        
        // Inject Settings
        html = html.replace(/\{\{storeName\}\}/g, () => settings.storeName || 'Pro Store');
        html = html.replace(/\{\{storePhone\}\}/g, () => settings.storePhone || '');
        html = html.replace(/\{\{adminEmail\}\}/g, () => settings.adminEmail || 'admin@prostore.com');
        html = html.replace(/\{\{adminPass\}\}/g, () => settings.adminPass || 'admin123');
        const storeLogo = settings.storeLogo || '';
        html = html.replace(/\{\{storeLogo\}\}/g, () => storeLogo);
        html = html.replace(/\{\{storeLogoClass\}\}/g, () => storeLogo ? '' : 'empty');
        html = html.replace(/\{\{storeLogoPreview\}\}/g, () => storeLogo ? `<img src="${storeLogo}" style="max-height:60px; max-width:100%; object-fit:contain;">` : '<span style="color:#94a3b8; font-size:12px;">معاينة الشعار تظهر هنا</span>');
        
        // Inject Logout Button in Header
        html = html.replace('<!-- Settings Dropdown -->', `
            <a href="/?account=logout" style="text-decoration:none; color:#ef4444; font-weight:700; margin-left:15px; font-size:14px;"><i class="fa fa-sign-out-alt"></i> تسجيل الخروج</a>
            <!-- Settings Dropdown -->
        `);
        html = html.replace(/\{\{shippingCost\}\}/g, () => settings.shippingCost || 0);
        html = html.replace(/\{\{metaTitle\}\}/g, () => settings.metaTitle || '');
        html = html.replace(/\{\{metaDesc\}\}/g, () => settings.metaDesc || '');
        html = html.replace(/\{\{fbPixel\}\}/g, () => settings.fbPixel || '');
        html = html.replace(/\{\{snapPixel\}\}/g, () => settings.snapPixel || '');
        html = html.replace(/\{\{tiktokPixel\}\}/g, () => settings.tiktokPixel || '');
        html = html.replace(/\{\{gtm\}\}/g, () => settings.gtm || '');
        html = html.replace(/\{\{popupTitle\}\}/g, () => settings.popupTitle || '');
        html = html.replace(/\{\{popupImage\}\}/g, () => settings.popupImage || '');
        html = html.replace(/\{\{popupDesc\}\}/g, () => settings.popupDesc || '');
        html = html.replace(/\{\{popupLink\}\}/g, () => settings.popupLink || '');
        html = html.replace(/\{\{popupsJSON\}\}/g, () => JSON.stringify(settings.popups || []));
        html = html.replace(/\{\{popupEnabledChecked\}\}/g, () => settings.popupEnabled ? 'checked' : '');
        html = html.replace(/\{\{mainColor\}\}/g, () => settings.mainColor || '#6366f1');
        html = html.replace(/\{\{thankYouMessage\}\}/g, () => settings.thankYouMessage || 'شكراً لتسوقك معنا!');
        html = html.replace(/\{\{searchPlaceholders\}\}/g, () => settings.searchPlaceholders || 'ابحث عن ما تحب...');

        let citiesUI = '';
        const cities = settings.cities || [];
        cities.forEach((c) => {
            citiesUI += `
                <div style="display:flex; gap:10px; margin-bottom:10px;" class="city-row">
                    <input type="text" name="city_names[]" value="${c.name}" class="input-luxury" style="margin-bottom:0;" placeholder="اسم المدينة/المنطقة" required>
                    <input type="number" name="city_prices[]" value="${c.price}" class="input-luxury" style="margin-bottom:0; width:150px;" placeholder="تكلفة التوصيل" required>
                    <button type="button" class="btn btn-outline" style="color:red; border-color:red; padding: 0 15px;" onclick="this.parentElement.remove()"><i class="fa fa-trash"></i></button>
                </div>
            `;
        });
        html = html.replace(/\{\{CITIES_UI_HTML\}\}/g, () => citiesUI);

        html = html.replace(/\{\{currency_\$\}\}/g, () => settings.currency === '$' ? 'selected' : '');
        html = html.replace(/\{\{currency_JOD\}\}/g, () => settings.currency === 'د.أ' ? 'selected' : '');
        html = html.replace(/\{\{currency_ILS\}\}/g, () => settings.currency === '₪' ? 'selected' : '');
        html = html.replace(/\{\{currency_SAR\}\}/g, () => settings.currency === 'SAR' || settings.currency === 'ر.س' ? 'selected' : '');
        html = html.replace(/\{\{currency_AED\}\}/g, () => settings.currency === 'AED' || settings.currency === 'د.إ' ? 'selected' : '');

        // Homepage Customizer Injection
        html = html.replace(/\{\{announcementText\}\}/g, () => settings.announcementText || '🌟 أفضل المنتجات بأفضل الأسعار | توصيل سريع لباب المنزل');
        html = html.replace(/\{\{instagramUrl\}\}/g, () => settings.instagramUrl || '');
        html = html.replace(/\{\{facebookUrl\}\}/g, () => settings.facebookUrl || '');
        html = html.replace(/\{\{snapchatUrl\}\}/g, () => settings.snapchatUrl || '');
        html = html.replace(/\{\{whatsappUrl\}\}/g, () => settings.whatsappUrl || '');
        html = html.replace(/\{\{showWhatsappBubble\}\}/g, () => settings.showWhatsappBubble === 'false' ? '' : 'checked');
        html = html.replace(/\{\{showSidebarFilter\}\}/g, () => settings.showSidebarFilter === 'false' ? '' : 'checked');
        html = html.replace(/\{\{showPwaBanner\}\}/g, () => settings.showPwaBanner === 'false' ? '' : 'checked');
        html = html.replace(/\{\{showBrandsSidebar\}\}/g, () => settings.showBrandsSidebar === 'false' ? '' : 'checked');
        html = html.replace(/\{\{brandsTitle\}\}/g, () => settings.brandsTitle || 'العلامات التجارية');

        // Hero Section Type (with backward compat for old showSlider)
        const heroType = settings.heroType || (settings.showSlider === 'false' ? 'none' : 'slider');
        html = html.replace(/\{\{heroType\}\}/g, () => heroType);

        // Banner settings
        const bannerImg = settings.bannerImage || '';
        html = html.replace(/\{\{bannerImage\}\}/g, () => bannerImg);
        html = html.replace(/\{\{bannerImageClass\}\}/g, () => bannerImg ? '' : 'empty');
        html = html.replace(/\{\{bannerImagePreview\}\}/g, () => bannerImg ? `<img src="${bannerImg}" style="width:100%; height:100%; object-fit:cover;">` : '');
        html = html.replace(/\{\{bannerTitle\}\}/g, () => settings.bannerTitle || '');
        html = html.replace(/\{\{bannerDesc\}\}/g, () => settings.bannerDesc || '');
        html = html.replace(/\{\{bannerLink\}\}/g, () => settings.bannerLink || '');

        // Video settings
        html = html.replace(/\{\{videoUrl\}\}/g, () => settings.videoUrl || '');
        html = html.replace(/\{\{videoTitle\}\}/g, () => settings.videoTitle || '');
        html = html.replace(/\{\{videoDesc\}\}/g, () => settings.videoDesc || '');
        
        let sliderJSON = '[]';
        if (settings.slider_json) {
            try {
                const parsed = typeof settings.slider_json === 'string' ? JSON.parse(settings.slider_json) : settings.slider_json;
                sliderJSON = JSON.stringify(parsed);
            } catch(e) {
                sliderJSON = '[]';
            }
        }
        html = html.replace(/\{\{SLIDER_JSON\}\}/g, () => sliderJSON.replace(/<\/script>/g, '<\\/script>'));

        let homeSectionsJSON = '[]';
        if (settings.home_sections_json) {
            try {
                const parsed = typeof settings.home_sections_json === 'string' ? JSON.parse(settings.home_sections_json) : settings.home_sections_json;
                homeSectionsJSON = JSON.stringify(parsed);
            } catch(e) {
                homeSectionsJSON = '[]';
            }
        }
        html = html.replace(/\{\{HOME_SECTIONS_JSON\}\}/g, () => homeSectionsJSON.replace(/<\/script>/g, '<\\/script>'));

        res.send(html);
    },

    add_product: (req, res) => {
        if (req.method === 'POST') {
            const db = dbHelper.readData();
            db.products = db.products || [];
            
            const extraImages = req.body.extraImages ? req.body.extraImages.split('\n').map(u => u.trim()).filter(u => u) : [];
            const images = [req.body.image, ...extraImages].filter(u => u);

            let categoriesJson = req.body.categories_json;
            if (Array.isArray(categoriesJson)) categoriesJson = categoriesJson[categoriesJson.length - 1];
            const categories = categoriesJson ? JSON.parse(categoriesJson) : [];

            let sectionsJson = req.body.landingSections_json;
            const landingSections = sectionsJson ? JSON.parse(sectionsJson) : [];

            let variantsJson = req.body.variants_json;
            let variants = [];
            let variantsData = [];
            if (variantsJson) {
                const vParsed = JSON.parse(variantsJson);
                variants = vParsed.options || [];
                variantsData = vParsed.data || [];
            }

            const productData = {
                id: req.body.id || Date.now().toString(),
                name: req.body.name,
                price: parseFloat(req.body.price) || 0,
                salePrice: parseFloat(req.body.salePrice) || null,
                wholesalePrice: parseFloat(req.body.wholesalePrice) || null,
                costPrice: parseFloat(req.body.costPrice) || null,
                sku: req.body.sku,
                image: req.body.image || images[0],
                images: images,
                description: req.body.description,
                categories: categories,
                category: categories.length > 0 ? categories[0] : 'general',
                adminNote: req.body.adminNote,
                fakeVisitors: req.body.fakeVisitors_val === 'true',
                fakeStock: req.body.fakeStock_val === 'true',
                fakeTimer: req.body.fakeTimer_val === 'true',
                isLandingPage: req.body.isLandingPage_val === 'true',
                landingSections: landingSections,
                variants: variants,
                variantsData: variantsData,
                advanced: {
                    hiddenProduct: req.body.hiddenProduct === 'true',
                    isComingSoon: req.body.isComingSoon === 'true',
                    comingSoonDate: req.body.comingSoonDate || '',
                    productVideo: req.body.productVideo || '',
                    isRecommended: req.body.isRecommended_val === 'true'
                }
            };
            
            const productIndex = db.products.findIndex(p => p.id === productData.id);
            if (productIndex > -1) {
                db.products[productIndex] = productData;
            } else {
                db.products.unshift(productData);
            }

            dbHelper.writeData(db);
            
            if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers['accept']?.includes('application/json')) {
                return res.json({ success: true, id: productData.id });
            }

            return res.redirect(`/?account=dashboard&tab=product-editor&success_id=${productData.id}`);
        }
        res.status(405).send('Method Not Allowed');
    },

    delete_product: (req, res) => {
        const id = req.query.id;
        const db = dbHelper.readData();
        db.products = db.products.filter(p => p.id !== id);
        dbHelper.writeData(db);
        
        if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers['accept']?.includes('application/json')) {
            return res.json({ success: true });
        }
        
        return res.redirect('/?account=dashboard&tab=products');
    },

    add_category: (req, res) => {
        if (req.method === 'POST') {
            const db = dbHelper.readData();
            db.categories = db.categories || [];
            
            const categoryData = {
                id: req.body.id || Date.now().toString(),
                name: req.body.name,
                description: req.body.description,
                image: req.body.image,
                icon: req.body.icon,
                parentId: req.body.parentId || null,
                metaTitle: req.body.metaTitle,
                metaDesc: req.body.metaDesc,
                priority: parseInt(req.body.priority) || 0,
                isActive: req.body.isActive_val === 'true' || req.body.isActive === 'true' || req.body.isActive === true || req.body.isActive === 'on',
                isBrand: req.body.isBrand_val === 'true' || req.body.isBrand === 'true' || req.body.isBrand === true || req.body.isBrand === 'on'
            };

            const catIndex = db.categories.findIndex(c => c.id === categoryData.id);
            if (catIndex > -1) {
                db.categories[catIndex] = categoryData;
            } else {
                db.categories.push(categoryData);
            }

            dbHelper.writeData(db);
            return res.redirect('/?account=dashboard&cat_success_id=' + categoryData.id);
        }
        res.status(405).send('Method Not Allowed');
    },

    delete_category: (req, res) => {
        const id = req.query.id;
        const db = dbHelper.readData();
        db.categories = (db.categories || []).filter(c => c.id !== id);
        dbHelper.writeData(db);
        return res.redirect('/?account=dashboard&tab=categories');
    },

    save_settings: (req, res) => {
        if (req.method === 'POST') {
            const db = dbHelper.readData();
            db.settings = db.settings || {};
            
            for (let key in req.body) {
                if(key !== 'tab' && key !== 'city_names[]' && key !== 'city_prices[]' && key !== 'city_names' && key !== 'city_prices') {
                    db.settings[key] = req.body[key];
                }
            }

            const tab = req.body.tab;
            
            // Handle checkboxes that might be missing if unchecked
            if (tab === 'design') {
                db.settings.showBrandsSidebar = req.body.showBrandsSidebar === 'on';
            } else if (tab === 'marketing') {
                db.settings.popupEnabled = req.body.popupEnabled === 'on';
            } else if (tab === 'popups') {
                db.settings.popupEnabled = req.body.popupEnabled === 'on';
                db.settings.popups = JSON.parse(req.body.popups_json || '[]');
            }

            // Handle shipping tab specifically
            if (tab === 'shipping') {
                db.settings.cities = [];
                const rawNames = req.body.city_names || req.body['city_names[]'];
                const rawPrices = req.body.city_prices || req.body['city_prices[]'];
                
                if (rawNames) {
                    const names = Array.isArray(rawNames) ? rawNames : [rawNames];
                    const prices = Array.isArray(rawPrices) ? rawPrices : [rawPrices];
                    names.forEach((name, i) => {
                        if (name && name.trim()) {
                            db.settings.cities.push({ name: name.trim(), price: parseFloat(prices[i]) || 0 });
                        }
                    });
                }
            }
            dbHelper.writeData(db);
            return res.redirect('/?account=dashboard&tab=' + (tab || 'settings'));
        }
        res.status(405).send('Method Not Allowed');
    },

    update_order_status: (req, res) => {
        if (req.method === 'POST') {
            const { orderId, status } = req.body;
            const orders = dbHelper.readOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex > -1) {
                const order = orders[orderIndex];
                order.status = status;
                order.updatedAt = new Date().toLocaleString();
                
                // ERP Automation: Stock auto-deduction/restoration
                const isDelivering = ['تم الشحن', 'مكتمل'].includes(status);
                
                if (isDelivering && !order.stockSubtracted) {
                    adjustProductStock(order.items || [], 'deduct');
                    order.stockSubtracted = true;
                } else if (!isDelivering && order.stockSubtracted) {
                    adjustProductStock(order.items || [], 'restore');
                    order.stockSubtracted = false;
                }
                
                dbHelper.writeOrders(orders);
                return res.json({ success: true, message: 'تم تحديث حالة الطلب وتحديث المخزون بنجاح' });
            }
            return res.json({ success: false, message: 'الطلب غير موجود' });
        }
        res.status(405).send('Method Not Allowed');
    },

    update_order_notes: (req, res) => {
        if (req.method === 'POST') {
            const { orderId, notes } = req.body;
            const orders = dbHelper.readOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex > -1) {
                orders[orderIndex].notes = notes;
                orders[orderIndex].updatedAt = new Date().toLocaleString();
                dbHelper.writeOrders(orders);
                return res.json({ success: true, message: 'تم حفظ الملاحظات بنجاح' });
            }
            return res.json({ success: false, message: 'الطلب غير موجود' });
        }
        res.status(405).send('Method Not Allowed');
    },

    update_order: (req, res) => {
        if (req.method === 'POST') {
            const { orderId, name, phone, email, city, address, shippingCost, discount, couponCode, items } = req.body;
            const orders = dbHelper.readOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex > -1) {
                const order = orders[orderIndex];
                
                // Update customer info
                if (!order.customer) order.customer = {};
                order.customer.name = name;
                order.customer.phone = phone;
                order.customer.email = email;
                order.customer.city = city;
                order.customer.address = address;
                
                // Update shipping and discount costs
                order.shippingCost = parseFloat(shippingCost) || 0;
                order.discount = parseFloat(discount) || 0;
                order.couponCode = couponCode !== undefined ? couponCode : (order.couponCode || '');
                
                // Update items if provided
                if (items) {
                    try {
                        order.items = Array.isArray(items) ? items : JSON.parse(items);
                    } catch (e) {
                        console.error('Failed parsing updated order items:', e);
                    }
                }
                
                // Recalculate total based on item totals, shipping, and discounts
                const itemsTotal = order.items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
                order.total = (itemsTotal + order.shippingCost - order.discount).toFixed(2);
                
                order.updatedAt = new Date().toLocaleString();
                dbHelper.writeOrders(orders);
                return res.json({ success: true, message: 'تم تحديث بيانات الطلب بنجاح', order });
            }
            return res.json({ success: false, message: 'الطلب غير موجود' });
        }
        res.status(405).send('Method Not Allowed');
    },

    delete_order: (req, res) => {
        if (req.method === 'POST') {
            const { orderId } = req.body;
            const orders = dbHelper.readOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex > -1) {
                const order = orders[orderIndex];
                
                // If stock was subtracted, restore it before deleting the order
                if (order.stockSubtracted) {
                    adjustProductStock(order.items || [], 'restore');
                }
                
                // Remove the order from the array
                orders.splice(orderIndex, 1);
                
                dbHelper.writeOrders(orders);
                return res.json({ success: true, message: 'تم حذف الطلب بنجاح' });
            }
            return res.json({ success: false, message: 'الطلب غير موجود' });
        }
        res.status(405).send('Method Not Allowed');
    },

    render_page: (req, res) => {
        const slug = req.params.slug || req.query.page;
        const pages = dbHelper.readPages();
        const page = pages.find(p => p.slug === slug);

        if (!page || (page.status === 'draft' && !req.headers.cookie?.includes('admin_auth=logged_in'))) {
            return res.status(404).send('الصفحة غير موجودة');
        }

        const db = dbHelper.readData();
        const settings = db.settings || {};
        const categories = db.categories || [];

        // Build Sidebar
        const catsHTML = buildCatsHTML(categories);

        // Featured Image for Articles
        let featuredImageHTML = '';
        if (page.thumbnail) {
            featuredImageHTML = `
                <div style="margin:-40px -40px 30px -40px; height:400px; overflow:hidden; border-radius:25px 25px 0 0; position:relative;">
                    <img src="${page.thumbnail}" style="width:100%; height:100%; object-fit:cover;">
                    <div style="position:absolute; bottom:0; left:0; right:0; padding:40px; background:linear-gradient(transparent, rgba(0,0,0,0.7)); color:#fff;">
                        <span style="background:var(--primary); padding:5px 12px; border-radius:30px; font-size:12px; font-weight:800; margin-bottom:10px; display:inline-block;">${page.type === 'article' ? 'مقالة' : 'صفحة'}</span>
                        <h1 style="font-weight:900; font-size:32px; margin:0;">${page.title}</h1>
                    </div>
                </div>
            `;
        }

        // Parse Shortcodes: [product id="xxxxx"]
        let processedContent = page.content;
        const productRegex = /\[product id="([^"]+)"\]/g;
        const products = db.products || [];
        const currency = settings.currency || '₪';

        processedContent = processedContent.replace(productRegex, (match, productId) => {
            const p = products.find(item => item.id === productId);
            if (!p) return '';

            const discount = p.salePrice && p.price < p.salePrice ? Math.round(((p.salePrice - p.price) / p.salePrice) * 100) : 0;
            
            return `
                <div class="product-card" style="max-width:320px; margin:30px auto; border: 1px solid var(--gray-200); cursor:pointer; background:#fff; box-shadow: var(--shadow-md); transition: var(--transition);" onclick="window.location.href='/?app=product.show.${p.id}'">
                    <div class="product-img" style="height: 220px; position:relative;">
                        ${discount > 0 ? `<div class="discount-badge" style="background:var(--primary); top:15px; left:15px;">خصم ${discount}%</div>` : ''}
                        <button class="fav-btn" style="top:15px; right:15px;" onclick="event.stopPropagation(); toggleFavorite('${p.id}', '${p.name}', ${p.price}, '${p.image}')"><i class="fa fa-heart"></i></button>
                        <img src="${p.image}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div class="product-info" style="padding: 20px; text-align:center;">
                        <span class="product-name" style="font-size:18px; font-weight:800; color:var(--dark); margin-bottom:10px; height:auto; display:block;">${p.name}</span>
                        <div style="margin-bottom:15px;">
                            ${buildVariantChipsHTML(p)}
                        </div>
                        <div class="product-price" style="font-size:24px; font-weight:900; color:var(--primary); justify-content:center; display:flex; align-items:baseline; gap:8px;">
                            ${currency}${p.price}
                            ${p.salePrice ? `<span class="old-price" style="font-size:16px; font-weight:400; color:var(--gray-400); text-decoration:line-through;">${currency}${p.salePrice}</span>` : ''}
                        </div>
                        <button class="btn btn-primary" style="width:100%; margin-top:20px; padding:15px; border-radius:12px; font-size:16px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:10px;">
                            <i class="fa fa-shopping-bag"></i> اشتري الآن
                        </button>
                    </div>
                </div>
            `;
        });

        const pageHTML = `
            <div style="background:#fff; padding:40px; border-radius:25px; border:1px solid #eee; min-height: 500px; overflow:hidden;">
                ${featuredImageHTML}
                ${!page.thumbnail ? `<h1 style="font-weight:900; margin-bottom:10px; color:var(--dark);">${page.title}</h1>` : ''}
                <div style="margin-bottom:30px; display:flex; gap:15px; align-items:center; color:var(--gray-400); font-size:13px;">
                    <span><i class="fa fa-calendar-alt"></i> آخر تحديث: ${new Date(page.updatedAt || page.createdAt || new Date()).toLocaleDateString('ar-EG')}</span>
                    <span><i class="fa fa-clock"></i> ${Math.max(1, Math.ceil(page.content.split(/\s+/).length / 200))} دقيقة قراءة</span>
                </div>
                <div class="page-content-render" style="line-height:1.8; color:var(--gray-600); font-size:16px;">
                    ${processedContent}
                </div>
            </div>
        `;

        let htmlPath = path.join(__dirname, '../views/store.html');
        if (!fs.existsSync(htmlPath)) return res.status(500).send('قالب المتجر غير موجود');
        
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{\s*STORE_NAME\s*\}\}/g, settings.storeName || 'متجري');
        html = html.replace(/\{\{\s*STORE_PHONE\s*\}\}/g, settings.storePhone || '');
        html = html.replace(/\{\{\s*MAIN_COLOR\s*\}\}/g, settings.mainColor || '#000');
        html = html.replace(/\{\{\s*META_TITLE\s*\}\}/g, `${page.title} | ${settings.storeName || 'متجري'}`);
        html = html.replace(/\{\{\s*PRODUCTS_HTML\s*\}\}/g, () => pageHTML);
        html = html.replace(/\{\{\s*CATEGORIES_HTML\s*\}\}/g, catsHTML);
        html = html.replace(/\{\{\s*HERO_SECTION\s*\}\}/g, '');
        html = html.replace(/\{\{\s*ALL_ACTIVE\s*\}\}/g, '');
        
        html = renderStoreTemplate(html, settings, catsHTML);
        res.send(html);
    },

    export_product_feed: (req, res) => {
        const db = dbHelper.readData();
        const products = db.products || [];
        const settings = db.settings || {};
        const host = req.get('host');
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;
        const platform = req.query.platform || 'meta';
        const format = req.query.format || 'csv';

        if (format === 'xml') {
            // Generate RSS 2.0 XML (Google Merchant Center Format)
            let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
    <title>${settings.storeName || 'Pro Store'}</title>
    <link>${baseUrl}</link>
    <description>Product feed for ${settings.storeName || 'Pro Store'}</description>
`;
            
            products.forEach(p => {
                if (p.advanced && p.advanced.hiddenProduct) return;
                
                const title = (p.name || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&apos;"}[c]));
                const desc = (p.description || '').replace(/<[^>]*>/g, '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&apos;"}[c])).substring(0, 5000);
                const image = p.image ? (p.image.startsWith('http') ? p.image : `${baseUrl}${p.image}`) : '';
                const currency = settings.currency || 'ILS';

                xml += `    <item>
        <g:id>${p.id}</g:id>
        <g:title>${title}</g:title>
        <g:description>${desc}</g:description>
        <g:link>${baseUrl}/?app=product.show.${p.id}</g:link>
        <g:image_link>${image}</g:image_link>
        <g:availability>in stock</g:availability>
        <g:price>${p.price} ${currency}</g:price>
        ${p.salePrice ? `<g:sale_price>${p.salePrice} ${currency}</g:sale_price>` : ''}
        <g:brand>${(settings.storeName || 'Store').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&apos;"}[c]))}</g:brand>
        <g:condition>new</g:condition>
    </item>
`;
            });

            xml += `</channel>
</rss>`;

            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            return res.send(xml);
        }

        // Default to CSV
        let csv = '';
        
        if (platform === 'google') {
            csv = 'id,title,description,link,image_link,availability,price,brand,condition,google_product_category\n';
            products.forEach(p => {
                if (p.advanced && p.advanced.hiddenProduct) return;
                const title = `"${(p.name || '').replace(/"/g, '""')}"`;
                const desc = `"${(p.description || '').replace(/<[^>]*>/g, '').replace(/"/g, '""').substring(0, 5000)}"`;
                const price = `${p.price} ${settings.currency || 'ILS'}`;
                csv += `${p.id},${title},${desc},${baseUrl}/?app=product.show.${p.id},${p.image},in stock,${price},"${settings.storeName || 'Store'}",new,\n`;
            });
        } else if (platform === 'snapchat') {
            csv = 'id,title,description,link,image_link,availability,price,brand,condition,item_group_id\n';
            products.forEach(p => {
                if (p.advanced && p.advanced.hiddenProduct) return;
                const title = `"${(p.name || '').replace(/"/g, '""')}"`;
                const desc = `"${(p.description || '').replace(/<[^>]*>/g, '').replace(/"/g, '""').substring(0, 500)}"`;
                csv += `${p.id},${title},${desc},${baseUrl}/?app=product.show.${p.id},${p.image},in stock,${p.price} ${settings.currency || 'ILS'},"${settings.storeName || 'Store'}",new,${p.category || 'all'}\n`;
            });
        } else if (platform === 'tiktok') {
            csv = 'sku_id,title,description,product_link,image_link,stock,price,sale_price,category_id\n';
            products.forEach(p => {
                if (p.advanced && p.advanced.hiddenProduct) return;
                const title = `"${(p.name || '').replace(/"/g, '""')}"`;
                const desc = `"${(p.description || '').replace(/<[^>]*>/g, '').replace(/"/g, '""')}"`;
                csv += `${p.id},${title},${desc},${baseUrl}/?app=product.show.${p.id},${p.image},999,${p.price} ${settings.currency || 'ILS'},${p.salePrice || ''},${p.category || '0'}\n`;
            });
        } else {
            // Meta (Facebook/Instagram) - Default
            csv = 'id,title,description,link,image_link,availability,price,sale_price,brand,condition\n';
            products.forEach(p => {
                if (p.advanced && p.advanced.hiddenProduct) return;
                const title = `"${(p.name || '').replace(/"/g, '""')}"`;
                const desc = `"${(p.description || '').replace(/<[^>]*>/g, '').replace(/"/g, '""').substring(0, 5000)}"`;
                csv += `${p.id},${title},${desc},${baseUrl}/?app=product.show.${p.id},${p.image},in stock,${p.price} ${settings.currency || 'ILS'},${p.salePrice ? p.salePrice + ' ' + (settings.currency || 'ILS') : ''},"${settings.storeName || 'Store'}",new\n`;
            });
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=products_feed_${platform}.csv`);
        res.send('\uFEFF' + csv); // Add BOM for Excel Arabic support
    },

    import_products_json: (req, res) => {
        try {
            const productsToImport = req.body.products;
            if (!Array.isArray(productsToImport)) {
                return res.status(400).json({ success: false, message: 'Invalid format. Expected an array of products.' });
            }

            const db = dbHelper.readData();
            db.products = db.products || [];

            let added = 0;
            let updated = 0;

            productsToImport.forEach(newP => {
                if (!newP.name) return;

                const index = db.products.findIndex(p => p.id === String(newP.id) || p.sku === newP.sku && newP.sku);
                if (index > -1) {
                    // Update existing
                    db.products[index] = { ...db.products[index], ...newP, id: db.products[index].id };
                    updated++;
                } else {
                    // Add new
                    const productData = {
                        id: String(newP.id || Date.now() + Math.floor(Math.random() * 1000)),
                        name: newP.name,
                        price: parseFloat(newP.price) || 0,
                        salePrice: newP.salePrice ? parseFloat(newP.salePrice) : null,
                        image: newP.image || '',
                        description: newP.description || '',
                        categories: Array.isArray(newP.categories) ? newP.categories : [],
                        category: newP.category || 'general',
                        sku: newP.sku || '',
                        variants: newP.variants || [],
                        variantsData: newP.variantsData || [],
                        advanced: newP.advanced || {}
                    };
                    db.products.unshift(productData);
                    added++;
                }
            });

            dbHelper.writeData(db);
            res.json({ success: true, message: `تم الاستيراد بنجاح: إضافة ${added} وتحديث ${updated}` });
        } catch (e) {
            console.error('Import Error:', e);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء الاستيراد: ' + e.message });
        }
    }
};

// --- Helpers for Store Layout (Copied from productController to avoid circular deps) ---
function buildCatsHTML(categories, activeCatId, filterBrands = false) {
    if (!categories) return '';
    let catsHTML = '';

    // Inherit 'isBrand' from parent
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

    const parentCategories = filteredCategories.filter(c => !c.parentId);
    
    parentCategories.forEach(p => {
        const isActiveParent = p.id === activeCatId;
        const subImg = p.icon || p.image;
        const imgHTML = subImg ? `<img src="${subImg}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; flex-shrink:0;">` : '';
        catsHTML += `
            <div class="cat-group" style="margin-bottom: 6px;">
                <a href="/?app=product.cat.${p.id}" class="cat-item ${isActiveParent ? 'active' : ''}" style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${imgHTML}
                        <span>${p.name}</span>
                    </div>
                    <i class="fa fa-chevron-left" style="font-size:10px;"></i>
                </a>
            </div>
        `;
    });
    return catsHTML;
}

function renderStoreTemplate(html, settings, catsHTML, activeCatId) {
    const db = dbHelper.readData();
    const categories = db.categories || [];
    
    const normalCatsHTML = buildCatsHTML(categories, activeCatId, false);
    const brandsHTML = buildCatsHTML(categories, activeCatId, true);
    html = html.replace(/\{\{BRANDS_HTML\}\}/g, brandsHTML);

    // ── Build FLAT brands HTML for the mobile modal grid ────────────────────
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
    const modalCatsHTML = (catsHTML || normalCatsHTML).replace(
        /(<a\b[^>]*href="[^"]*"[^>]*)(>)/g,
        (match, before, close) => {
            if (before.includes('closeModal')) return match;
            return before + ' onclick="closeModal(\'categoriesModal\')"' + close;
        }
    );
    html = html.replace(/\{\{\s*CATEGORIES_HTML_MODAL\s*\}\}/g, modalCatsHTML);

    html = html.replace(/\{\{\s*SIDEBAR_SECTION\s*\}\}/g, `
        <aside class="sidebar">
            <div class="sidebar-card">
                <h3 class="sidebar-title"><i class="fa fa-list-ul"></i> تصفح الأقسام</h3>
                <div class="cat-list">
                    <a href="/" class="cat-item">الكل <i class="fa fa-chevron-left"></i></a>
                    ${normalCatsHTML}
                </div>
            </div>
            ${brandsHTML ? `
                <div class="sidebar-card" style="margin-top:20px;">
                    <h3 class="sidebar-title"><i class="fa fa-award"></i> العلامات التجارية</h3>
                    <div class="cat-list">
                        ${brandsHTML}
                    </div>
                </div>
            ` : ''}
            <div class="sidebar-card" style="background: var(--primary); color: var(--white); border: none; margin-top: 20px;">
                <h3 style="margin-bottom: 10px;">عروض حصرية</h3>
                <p style="font-size: 13px; margin-bottom: 15px; opacity: 0.9;">اشترك معنا لتصلك أقوى العروض والخصومات!</p>
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
            </div>
        </aside>
    `);
    
    html = html.replace(/\{\{\s*PWA_BANNER\s*\}\}/g, '');
    
    // Build Pages Footer links
    const pages = dbHelper.readPages();
    const publicPages = pages.filter(p => p.status === 'public');
    let pagesFooterHTML = '';
    publicPages.forEach(p => {
        pagesFooterHTML += `<a href="/?page=${p.slug}" onclick="closeModal('categoriesModal')">${p.title}</a>`;
    });
    html = html.replace(/\{\{\s*PAGES_FOOTER\s*\}\}/g, pagesFooterHTML);
    
    html = html.replace(/\{\{ANNOUNCEMENT_TEXT\}\}/g, settings.announcementText || '🌟 أفضل المنتجات بأفضل الأسعار | توصيل سريع لباب المنزل');
    
    let socialLinksHTML = '<div class="socials">';
    if (settings.instagramUrl) socialLinksHTML += `<a href="${settings.instagramUrl}" target="_blank"><i class="fab fa-instagram"></i></a>`;
    if (settings.facebookUrl) socialLinksHTML += `<a href="${settings.facebookUrl}" target="_blank"><i class="fab fa-facebook"></i></a>`;
    if (settings.snapchatUrl) socialLinksHTML += `<a href="${settings.snapchatUrl}" target="_blank"><i class="fab fa-snapchat"></i></a>`;
    if (settings.whatsappUrl) socialLinksHTML += `<a href="https://wa.me/${settings.whatsappUrl}" target="_blank"><i class="fab fa-whatsapp"></i></a>`;
    socialLinksHTML += '</div>';
    html = html.replace(/\{\{\s*SOCIAL_LINKS\s*\}\}/g, socialLinksHTML);

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
    html = html.replace(/\{\{\s*WELCOME_POPUP\s*\}\}/g, welcomePopupHTML);

    // Logo replacements
    let logoHTML = `<i class="fa fa-gem"></i> ${settings.storeName || 'متجري'}`;
    let footerLogoHTML = `<i class="fa fa-gem"></i> ${settings.storeName || 'متجري'}`;
    if (settings.storeLogo) {
        logoHTML = `<img src="${settings.storeLogo}" alt="${settings.storeName || 'متجري'}">`;
        footerLogoHTML = `<img src="${settings.storeLogo}" alt="${settings.storeName || 'متجري'}">`;
    }
    html = html.replace(/\{\{\s*STORE_LOGO_HTML\s*\}\}/g, logoHTML);
    html = html.replace(/\{\{\s*STORE_FOOTER_LOGO_HTML\s*\}\}/g, footerLogoHTML);

    return html;
}

function buildVariantChipsHTML(p) {
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

                    let style = `display:inline-block; width:16px; height:16px; border-radius:50%; border:1.5px solid rgba(0,0,0,0.1); flex-shrink:0; position:relative;`;
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
                        let style = `width:18px; height:18px; border-radius:4px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;`;
                        if (outOfStock) {
                            style += `opacity: 0.35; filter: grayscale(1);`;
                        }
                        chips.push(`
                            <span style="position:relative; display:inline-flex; width:18px; height:18px; vertical-align:middle; line-height:1;">
                                <img src="${img}" title="${label}${outOfStock ? ' (نفدت)' : ''}" style="${style}">
                                ${outOfStock ? `<span style="position:absolute; inset:0; background: linear-gradient(45deg, transparent 42%, #ef4444 42%, #ef4444 58%, transparent 58%); border-radius:4px; pointer-events:none;"></span>` : ''}
                            </span>
                        `);
                    } else {
                        let style = `font-size:10px; padding:3px 8px; border-radius:6px; flex-shrink:0;`;
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

                    let style = `font-size:10px; padding:3px 8px; border-radius:6px; font-weight:700; flex-shrink:0;`;
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
                chips.push(`<span style="font-size:10px; background:var(--gray-100); padding:3px 8px; border-radius:6px; color:var(--gray-600); border:1px solid var(--gray-200);">${c}</span>`);
            });
        }
        if (p.sizes && p.sizes.length > 0) {
            p.sizes.slice(0, 3).forEach(s => {
                chips.push(`<span style="font-size:10px; background:var(--primary-light,#fff0f0); padding:3px 8px; border-radius:6px; color:var(--primary); font-weight:700;">${s}</span>`);
            });
        }
    }

    if (chips.length === 0) return '<div style="height:24px;"></div>';

    return `<div style="display:flex; justify-content:center; align-items:center; gap:6px; margin-bottom:10px; min-height:24px; flex-wrap:wrap;">${chips.join('')}</div>`;
}