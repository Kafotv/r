// Dashboard Main JS
// Split from views/dashboard.html to improve performance and code organization


        const tabLinks = document.querySelectorAll('.tab-link');
        const tabContents = document.querySelectorAll('.tab-content');
        window.lastOrderListTab = 'tab-orders';
        let allProducts = [];
        let allCategories = [];

        function toggleDropdown(element) {
            const dropdown = element.parentElement;
            const isOpen = element.classList.contains('open');
            
            // Close all other dropdowns
            document.querySelectorAll('.nav-item').forEach(item => {
                if(item !== element) item.classList.remove('open');
            });

            element.classList.toggle('open');
        }

        function toggleNotifDropdown() {
            const dropdown = document.getElementById('notifDropdown');
            const isVisible = dropdown.style.display === 'flex';
            dropdown.style.display = isVisible ? 'none' : 'flex';
        }

        function toggleMobileMenu() {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar && overlay) {
                sidebar.classList.toggle('mobile-open');
                overlay.classList.toggle('active');
            }
        }

        // Close dropdowns when clicking outside
        window.addEventListener('click', (e) => {
            // Notification dropdown
            const notifCenter = document.querySelector('.notif-center');
            const notifDropdown = document.getElementById('notifDropdown');
            if (notifCenter && !notifCenter.contains(e.target) && notifDropdown) {
                notifDropdown.style.display = 'none';
            }
        });

        function switchTab(targetId, updateUrl = true) {
            // Close mobile menu if open
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('active');

            // Track last order-related tab for "Back" button
            if (['tab-orders', 'tab-distributors-orders', 'tab-abandoned'].includes(targetId)) {
                window.lastOrderListTab = targetId;
            }

            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            const activeLink = document.querySelector(`.tab-link[data-target="${targetId}"]`);
            const activeContent = document.getElementById(targetId);
            
            if(activeLink) {
                activeLink.classList.add('active');
                // If it's a sub-item, open its parent dropdown
                const parentDropdown = activeLink.closest('.nav-dropdown');
                if(parentDropdown) {
                    const trigger = parentDropdown.querySelector('.nav-item');
                    if(trigger) trigger.classList.add('open');
                }
            }
            
            if(activeContent) activeContent.classList.add('active');

            if (targetId === 'tab-abandoned') loadAbandonedCarts();
            if (targetId === 'tab-promotions') loadPromotions();
            if (targetId === 'tab-coupons') loadCoupons();
            if (targetId === 'tab-marketing-notifications') loadNotifications();
            if (targetId === 'tab-distributors') loadDistributors();
            if (targetId === 'tab-distributor-detail' && !window._currentDistDetail) {
                const body = document.getElementById('distDetailBody');
                if (body) body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);"><i class="fas fa-hand-pointer" style="font-size:48px;opacity:0.3;display:block;margin-bottom:15px;"></i><p style="font-weight:700;font-size:16px;">يرجى اختيار موزع من القائمة</p><button class="btn btn-primary" onclick="switchTab(\'tab-distributors\')" style="margin-top:10px;"><i class="fas fa-arrow-right"></i> العودة لقائمة الموزعين</button></div>';
            }
            if (targetId === 'tab-distributors-orders') loadDistributorOrders();
            if (targetId === 'tab-wholesale-prices') loadWholesalePricesUI();
            if (targetId === 'tab-pages') loadPagesList();
            if (targetId === 'tab-popups') initPopupsManager();
            if (targetId === 'tab-shipping' && typeof renderShippingRegions === 'function') renderShippingRegions(window._storeSettings);
            if (targetId === 'tab-reels') {
                showReelsList(false);
                handleReelDeepLinking();
            }
            if (targetId === 'tab-products') renderProductsTable();
            if (targetId === 'tab-orders') renderOrdersTable();

            if(updateUrl) {
                const newUrl = new URL(window.location);
                const currentTab = targetId.replace('tab-', '');
                newUrl.searchParams.set('tab', currentTab);
                
                // Only delete these if we are NOT switching to their respective editors
                if (currentTab !== 'product-editor') newUrl.searchParams.delete('edit');
                if (currentTab !== 'category-editor') newUrl.searchParams.delete('editCat');
                
                newUrl.searchParams.delete('orderId'); 
                newUrl.searchParams.delete('editCoupon');
                newUrl.searchParams.delete('editNotif');
                
                try {
                    window.history.pushState({}, '', newUrl);
                } catch (e) {
                    console.warn('History pushState blocked (normal on file:// protocol):', e);
                }
                if(activeLink) document.title = `${activeLink.innerText.trim()} | لوحة التحكم`;
            }
            const contentArea = document.querySelector('.content-area');
            if(contentArea) contentArea.scrollTop = 0;
        }

        tabLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(link.dataset.target);
            });
        });

        async function initDashboard() {
            try {
                // ✅ Switch tab IMMEDIATELY from URL before any async fetch (prevents flash)
                const params = new URLSearchParams(window.location.search);
                const tab = params.get('tab');
                if (tab) switchTab('tab-' + tab, false);

                // Handle distributor detail deep link with distId
                const distId = params.get('distId');
                if (tab === 'distributor-detail' && distId) {
                    // Defer until distributors are loaded, then show detail
                    const tryLoadDist = async () => {
                        try {
                            const dists = await DB.getDistributors();
                            const dist = dists.find(d => String(d.id) === String(distId));
                            if (dist) {
                                showDistributorDetail(dist);
                            } else {
                                document.getElementById('distDetailBody').innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);"><i class="fas fa-exclamation-triangle" style="font-size:48px;opacity:0.3;display:block;margin-bottom:15px;"></i><p style="font-weight:700;font-size:16px;">لم يتم العثور على الموزع</p></div>';
                            }
                        } catch(e) {
                            console.error('Failed to load distributor by ID:', e);
                        }
                    };
                    tryLoadDist();
                }

                allProducts = await DB.getProducts();
                allCategories = await DB.getCategories();
                window.allCategories = allCategories;
                window._allCats = allCategories;
                
                // Render products table after categories are loaded
                renderProductsTable();
                if (typeof loadCategories === 'function') loadCategories();

                // Load home sections from settings
                try {
                    const settings = await DB.getSettings();
                    window._storeSettings = settings;
                    window.storeCurrency = settings.currency || '₪';
                    const safeParse = (v) => {
                        if (!v || typeof v !== 'string') return v;
                        try { return JSON.parse(v); } catch (e) { console.warn('Invalid JSON in settings value:', e); return null; }
                    };
                    if (settings.home_sections_json) {
                        const parsed = safeParse(settings.home_sections_json);
                        if (parsed) { window.homeSections = parsed; homeSections = parsed; }
                    }
                    if (settings.slider_json) {
                        const parsed = safeParse(settings.slider_json);
                        if (parsed) window.activeSlides = parsed;
                    }
                    if (typeof renderHomeSections === 'function') renderHomeSections();

                    if (settings.sidebar_sections_json) {
                        const parsed = safeParse(settings.sidebar_sections_json);
                        if (parsed) window.sidebarSections = parsed;
                    }
                    if (typeof renderSidebarSections === 'function') renderSidebarSections();

                    // Populate other settings form fields dynamically from database
                    document.querySelectorAll('form[action*="save_settings"]').forEach(form => {
                        form.querySelectorAll('input, textarea, select').forEach(input => {
                            if (!input.name) return;
                            let val = settings[input.name];
                            // Handle popups_json → popups mapping
                            if (val === undefined && input.name === 'popups_json') {
                                val = settings.popups;
                            }
                            if (val === undefined) return;
                            
                            if (input.type === 'checkbox') {
                                input.checked = (val === true || val === 'true');
                            } else if (input.type === 'radio') {
                                input.checked = String(input.value) === String(val);
                            } else {
                                // If value is an object/array (already parsed JSON from Supabase),
                                // stringify it before setting on the form field
                                input.value = typeof val === 'object' ? JSON.stringify(val) : val;
                            }
                        });
                    });
                    // Re-init popup manager after settings are loaded (for popups tab)
                    if (document.getElementById('popups_json_input') && typeof initPopupsManager === 'function') {
                        initPopupsManager();
                    }
                    // Render saved shipping regions (if any)
                    if (typeof renderShippingRegions === 'function') renderShippingRegions(settings);
                } catch(e) { console.error('Error loading settings:', e); }

                if (params.get('action') === 'add_product') openAddModal();
                
                const successId = params.get('success_id');
                const editId = params.get('edit');
                const editCatId = params.get('editCat');
                const catSuccessId = params.get('cat_success_id');
                const orderIdParam = params.get('orderId');
                const editCouponCode = params.get('editCoupon');

                if (successId) {
                    openEditById(successId);
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.delete('success_id');
                    window.history.replaceState({}, '', newUrl);
                } else if (catSuccessId) {
                    openCategoryEdit(catSuccessId);
                    if(typeof showToast === 'function') showToast('✅ تم حفظ القسم بنجاح');
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.delete('cat_success_id');
                    window.history.replaceState({}, '', newUrl);
                } else if (editId) {
                    openEditById(editId);
                } else if (editCatId) {
                    openCategoryEdit(editCatId);
                } else if (editCouponCode) {
                    setTimeout(() => editCoupon(editCouponCode), 500); // تأخير بسيط لضمان تحميل البيانات
                } else if (orderIdParam) {
                    setTimeout(() => {
                        viewOrder(orderIdParam);
                    }, 100);
                } else if (params.get('editNotif')) {
                    setTimeout(() => editNotification(params.get('editNotif')), 500);
                } else if (params.get('action') === 'new_notif') {
                    setTimeout(() => showNotifCreateView(), 500);
                }
                
                // --- Marketing Notifications Listeners ---
                const nTitle = document.getElementById('notif_title');
                const nMsg = document.getElementById('notif_message');
                const nImg = document.getElementById('notif_image');
                
                if(nTitle) nTitle.addEventListener('input', updateMainNotifPreview);
                if(nMsg) nMsg.addEventListener('input', updateMainNotifPreview);
                if(nImg) nImg.addEventListener('input', updateMainNotifPreview);

                // Render custom home sections
                if (typeof renderHomeSections === 'function') renderHomeSections();

                // Re-handle reels deep linking if tab is reels
                if (tab === 'reels') handleReelDeepLinking();
            } catch (e) { console.error('Dashboard Init Error:', e); }
        }

        // ─── FCM Admin Token Registration ───────────────────────────────────────
        async function initAdminFCM() {
            try {
                if (typeof firebase === 'undefined') return;

                const firebaseConfig = {
                    apiKey: "AIzaSyBw9zs-QKCGHpWOqlCfOdGR44S1kIPbE5o",
                    authDomain: "ulpro-102d3.firebaseapp.com",
                    projectId: "ulpro-102d3",
                    storageBucket: "ulpro-102d3.firebasestorage.app",
                    messagingSenderId: "943893735072",
                    appId: "1:943893735072:web:e467211472030ea3418bc5"
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
                console.warn('Admin FCM init failed:', e.message);
            }
        }

        // Initialize dashboard & FCM on load
        window.addEventListener('DOMContentLoaded', async () => {
            await initDashboard();
            initAdminFCM();
            loadAdvancedStats().catch(e => { console.error('Initial stats load failed, retrying...', e); setTimeout(loadAdvancedStats, 500); });
            loadAbandonedCarts();
            initDistributorNotifier();
        });

        function initDistributorNotifier() {
            // Show pending count badge on sidebar
            async function updateBadge() {
                try {
                    const dists = await DB.getDistributors();
                    const pending = dists.filter(d => d.status === 'pending').length;
                    let badge = document.getElementById('distPendingBadge');
                    if (!badge) {
                        const link = document.querySelector('.sub-item[data-target="tab-distributors"]');
                        if (!link) return;
                        badge = document.createElement('span');
                        badge.id = 'distPendingBadge';
                        badge.style.cssText = 'background:#ef4444; color:#fff; font-size:10px; padding:1px 7px; border-radius:50px; margin-right:5px; font-weight:800;';
                        link.appendChild(badge);
                    }
                    badge.textContent = pending;
                    badge.style.display = pending > 0 ? 'inline' : 'none';
                } catch(e) {}
            }
            updateBadge();
            setInterval(updateBadge, 30000);

            // Refresh bell dropdown with current distributor notifs
            async function refreshBell() {
                const notifs = [];
                await _appendDistributorNotifs(notifs);
                if (notifs.length > 0) {
                    const existing = document.querySelectorAll('.notif-item');
                    if (!existing.length || !document.querySelector('.notif-item [class*="fa-user-plus"]')) {
                        _updateNotifUI(notifs);
                    }
                }
            }

            // Real-time subscription for new registrations
            try {
                const channel = DB.supabase
                    .channel('distributors-insert')
                    .on('postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'distributors' },
                        (payload) => {
                            const d = payload.new;
                            showToast(`🆕 طلب انضمام جديد من ${d.name || d.phone}`);
                            playDistributorSound();
                            updateBadge();
                            refreshBell();
                        }
                    )
                    .subscribe();
            } catch(e) { console.warn('Realtime not available:', e.message); }
        }

        window.onDateRangeChange = function() {
            const range = document.getElementById('cro-date-range').value;
            const customDiv = document.getElementById('custom-date-inputs');
            if (range === 'custom') {
                customDiv.style.display = 'flex';
                const todayStr = new Date().toISOString().split('T')[0];
                if (!document.getElementById('cro-start-date').value) {
                    document.getElementById('cro-start-date').value = todayStr;
                }
                if (!document.getElementById('cro-end-date').value) {
                    document.getElementById('cro-end-date').value = todayStr;
                }
            } else {
                customDiv.style.display = 'none';
            }
            loadAdvancedStats();
        };

        let statsChart = null;
        async function loadAdvancedStats() {
            console.log('[STATS] loadAdvancedStats called');
            const btn = document.querySelector('button[onclick="loadAdvancedStats()"]');
            const originalContent = btn ? btn.innerHTML : '';
            
            // Load saved settings from localStorage
            const savedSettings = JSON.parse(localStorage.getItem('cro_settings') || '{"targets":{"final": 5.0, "interest": 20.0, "success": 50.0}, "visible":{"final":true, "interest":true, "success":true}}');
            const range = document.getElementById('cro-date-range')?.value || 'today';
            const customStart = document.getElementById('cro-start-date')?.value;
            const customEnd = document.getElementById('cro-end-date')?.value;

            try {
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-sync-alt fa-spin" style="margin-left: 8px;"></i> جاري التحديث...';
                }

                console.log('[STATS] Fetching analytics stats...');
                const statsData = await DB.getAnalyticsStats();
                console.log('[STATS] statsData:', statsData);
                
                const allOrdersRaw = await DB.getOrders();
                console.log('[STATS] orders count:', allOrdersRaw.length);
                window.storeOrdersData = allOrdersRaw;

                const history = statsData.history || [];
                const summary = statsData.summary;

                // --- Filter Data by Date Range ---
                let filteredOrders = allOrdersRaw;
                let filteredHistory = history;

                if (range === 'custom' && customStart && customEnd) {
                    const startDate = new Date(customStart);
                    startDate.setHours(0,0,0,0);
                    const endDate = new Date(customEnd);
                    endDate.setHours(23,59,59,999);

                    filteredOrders = allOrdersRaw.filter(o => {
                        const od = new Date(o.date || o.createdAt);
                        return od >= startDate && od <= endDate;
                    });
                    filteredHistory = history.filter(h => {
                        const hd = new Date(h.date);
                        return hd >= startDate && hd <= endDate;
                    });
                } else {
                    const getStartDate = (rangeVal) => {
                        const d = new Date();
                        if (rangeVal === 'today') d.setHours(0,0,0,0);
                        else if (rangeVal === 'yesterday') {
                            d.setDate(d.getDate() - 1);
                            d.setHours(0,0,0,0);
                        }
                        else if (rangeVal === '7days') d.setDate(d.getDate() - 7);
                        else if (rangeVal === '30days') d.setDate(d.getDate() - 30);
                        else return null;
                        return d;
                    };

                    const startDate = getStartDate(range);
                    if (startDate) {
                        if (range === 'yesterday') {
                            const endDate = new Date(startDate);
                            endDate.setDate(endDate.getDate() + 1);
                            filteredOrders = allOrdersRaw.filter(o => {
                                const od = new Date(o.date || o.createdAt);
                                return od >= startDate && od < endDate;
                            });
                            filteredHistory = history.filter(h => {
                                const hd = new Date(h.date);
                                return hd >= startDate && hd < endDate;
                            });
                        } else {
                            filteredOrders = allOrdersRaw.filter(o => new Date(o.date || o.createdAt) >= startDate);
                            filteredHistory = history.filter(h => new Date(h.date) >= startDate);
                        }
                    }
                }

                // Calculate Totals for CRO
                const visits = filteredHistory.reduce((s, h) => s + (h.visits || h.visit || 0), 0);
                const carts = filteredHistory.reduce((s, h) => s + (h.add_to_cart || 0), 0);
                const checkouts = filteredHistory.reduce((s, h) => s + (h.init_checkout || 0), 0);
                const ordersCount = filteredOrders.length;

                // 1. Update Super Stats Cards based on selected range
                const rangeRevenue = filteredOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
                const rangeOrdersCount = filteredOrders.length;
                const rangeAOV = rangeOrdersCount > 0 ? (rangeRevenue / rangeOrdersCount) : 0;
                const rangeVisits = filteredHistory.reduce((s, h) => s + (h.visits || h.visit || 0), 0);

                // Update Titles dynamically
                const revenueTitle = document.getElementById('stat-today-revenue')?.previousElementSibling;
                if (revenueTitle) {
                    if (range === 'today') revenueTitle.innerText = 'مبيعات اليوم';
                    else if (range === 'yesterday') revenueTitle.innerText = 'مبيعات أمس';
                    else if (range === '7days') revenueTitle.innerText = 'مبيعات آخر 7 أيام';
                    else if (range === '30days') revenueTitle.innerText = 'مبيعات آخر 30 يوم';
                    else revenueTitle.innerText = 'إجمالي المبيعات';
                }
                const ordersTitle = document.getElementById('stat-total-orders-count')?.previousElementSibling;
                if (ordersTitle) {
                    if (range === 'today') ordersTitle.innerText = 'طلبات اليوم';
                    else if (range === 'yesterday') ordersTitle.innerText = 'طلبات أمس';
                    else if (range === '7days') ordersTitle.innerText = 'طلبات آخر 7 أيام';
                    else if (range === '30days') ordersTitle.innerText = 'طلبات آخر 30 يوم';
                    else ordersTitle.innerText = 'إجمالي الطلبات';
                }
                const aovTitle = document.getElementById('stat-aov')?.previousElementSibling;
                if (aovTitle) {
                    if (range === 'today') aovTitle.innerText = 'متوسط الطلب اليوم';
                    else if (range === 'yesterday') aovTitle.innerText = 'متوسط الطلب أمس';
                    else if (range === '7days') aovTitle.innerText = 'متوسط الطلب (7 أيام)';
                    else if (range === '30days') aovTitle.innerText = 'متوسط الطلب (30 يوم)';
                    else aovTitle.innerText = 'متوسط قيمة الطلب';
                }
                const visitsTitle = document.getElementById('stat-active-visitors')?.previousElementSibling;
                if (visitsTitle) {
                    if (range === 'today') visitsTitle.innerText = 'زيارات اليوم';
                    else if (range === 'yesterday') visitsTitle.innerText = 'زيارات أمس';
                    else if (range === '7days') visitsTitle.innerText = 'زيارات آخر 7 أيام';
                    else if (range === '30days') visitsTitle.innerText = 'زيارات آخر 30 يوم';
                    else visitsTitle.innerText = 'إجمالي الزيارات';
                }

                // Update Values
                document.getElementById('stat-today-revenue').innerText = `₪${rangeRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
                document.getElementById('stat-total-orders-count').innerText = rangeOrdersCount.toLocaleString();
                document.getElementById('stat-aov').innerText = `₪${rangeAOV.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
                document.getElementById('stat-active-visitors').innerText = rangeVisits.toLocaleString();

                // 2. Render CRO Grid Dynamically
                const grid = document.getElementById('cro-metrics-grid');
                if (grid) {
                    let gridHtml = '';
                    
                    // Metric 1: Final Conversion
                    if (savedSettings.visible.final) {
                        const rate = visits > 0 ? (ordersCount / visits) * 100 : 0;
                        const goal = savedSettings.targets.final;
                        const progress = Math.min(100, (rate / goal) * 100);
                        gridHtml += `
                            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                    <div>
                                        <div style="font-size: 12px; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">التحويل النهائي</div>
                                        <div style="font-size: 10px; color: #64748b;">(طلبات / زيارات)</div>
                                    </div>
                                    <div style="font-size: 24px; font-weight: 900; color: #fbbf24;">${rate.toFixed(1)}%</div>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom: 8px;">
                                    <span>الهدف: ${goal.toFixed(1)}%</span>
                                    <span>${progress.toFixed(0)}%</span>
                                </div>
                                <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:10px;">
                                    <div style="height:100%; width:${progress}%; background:#fbbf24; border-radius:10px; transition: width 1.5s ease; box-shadow: 0 0 10px rgba(251, 191, 36, 0.3);"></div>
                                </div>
                            </div>`;
                    }

                    // Metric 2: Interest Rate
                    if (savedSettings.visible.interest) {
                        const rate = visits > 0 ? (carts / visits) * 100 : 0;
                        const goal = savedSettings.targets.interest;
                        const progress = Math.min(100, (rate / goal) * 100);
                        gridHtml += `
                            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                    <div>
                                        <div style="font-size: 12px; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">اهتمام الزوار</div>
                                        <div style="font-size: 10px; color: #64748b;">(سلة / زيارات)</div>
                                    </div>
                                    <div style="font-size: 24px; font-weight: 900; color: #818cf8;">${rate.toFixed(1)}%</div>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom: 8px;">
                                    <span>الهدف: ${goal.toFixed(1)}%</span>
                                    <span>${progress.toFixed(0)}%</span>
                                </div>
                                <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:10px;">
                                    <div style="height:100%; width:${progress}%; background:#818cf8; border-radius:10px; transition: width 1.5s ease; box-shadow: 0 0 10px rgba(129, 140, 248, 0.3);"></div>
                                </div>
                            </div>`;
                    }

                    // Metric 3: Success Rate
                    if (savedSettings.visible.success) {
                        const rate = checkouts > 0 ? (ordersCount / checkouts) * 100 : 0;
                        const goal = savedSettings.targets.success;
                        const progress = Math.min(100, (rate / goal) * 100);
                        gridHtml += `
                            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                    <div>
                                        <div style="font-size: 12px; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">نجاح إتمام الدفع</div>
                                        <div style="font-size: 10px; color: #64748b;">(طلبات / بدء دفع)</div>
                                    </div>
                                    <div style="font-size: 24px; font-weight: 900; color: #10b981;">${rate.toFixed(1)}%</div>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom: 8px;">
                                    <span>الهدف: ${goal.toFixed(1)}%</span>
                                    <span>${progress.toFixed(0)}%</span>
                                </div>
                                <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:10px;">
                                    <div style="height:100%; width:${progress}%; background:#10b981; border-radius:10px; transition: width 1.5s ease; box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);"></div>
                                </div>
                            </div>`;
                    }

                    grid.innerHTML = gridHtml || '<p style="text-align:center; grid-column: 1/-1; padding: 20px; opacity:0.5;">يرجى اختيار مقياس واحد على الأقل من الإعدادات.</p>';
                }

                // Update settings panel inputs
                if(document.getElementById('show-final-cro')) document.getElementById('show-final-cro').checked = savedSettings.visible.final;
                if(document.getElementById('show-interest-cro')) document.getElementById('show-interest-cro').checked = savedSettings.visible.interest;
                if(document.getElementById('show-success-cro')) document.getElementById('show-success-cro').checked = savedSettings.visible.success;
                if(document.getElementById('target-final-val')) document.getElementById('target-final-val').value = savedSettings.targets.final;
                if(document.getElementById('target-interest-val')) document.getElementById('target-interest-val').value = savedSettings.targets.interest;
                if(document.getElementById('target-success-val')) document.getElementById('target-success-val').value = savedSettings.targets.success;

                // 3. Daily Boxes
                const todayData = history[history.length - 1] || { visits: 0, visit: 0, orders: 0, revenue: 0 };
                const yesterdayData = history[history.length - 2] || { visits: 0, visit: 0, orders: 0, revenue: 0 };
                const calcTrend = (nowVal, prevVal) => {
                    if (prevVal === 0) return nowVal > 0 ? '+100%' : '0%';
                    const diff = ((nowVal - prevVal) / prevVal) * 100;
                    return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
                };
                document.getElementById('box-today-visits').innerText = (todayData.visits || todayData.visit || 0).toLocaleString();
                document.getElementById('box-visits-trend').innerText = `${calcTrend(todayData.visits || todayData.visit || 0, yesterdayData.visits || yesterdayData.visit || 0)} منذ الأمس`;
                document.getElementById('box-today-orders').innerText = todayData.orders.toLocaleString();
                document.getElementById('box-orders-trend').innerText = `${calcTrend(todayData.orders, yesterdayData.orders)} منذ الأمس`;
                document.getElementById('box-today-revenue').innerText = `₪${parseFloat(summary.todayRevenue || 0).toLocaleString()}`;

                // 4. Funnel Boxes (Always 7 days for the funnel visuals)
                const funnelVisits = filteredHistory.reduce((s, h) => s + (h.visits || h.visit || 0), 0) || 1;
                document.getElementById('funnel-box-visits').innerText = funnelVisits.toLocaleString();
                document.getElementById('funnel-box-cart').innerText = carts.toLocaleString();
                document.getElementById('funnel-box-cart-rate').innerText = `${((carts / funnelVisits) * 100).toFixed(1)}% من الزوار`;
                document.getElementById('funnel-box-checkout').innerText = checkouts.toLocaleString();
                document.getElementById('funnel-box-checkout-rate').innerText = `${carts > 0 ? ((checkouts / carts) * 100).toFixed(1) : 0}% من السلة`;
                document.getElementById('funnel-box-orders').innerText = ordersCount.toLocaleString();
                document.getElementById('funnel-box-orders-rate').innerText = `${((ordersCount / funnelVisits) * 100).toFixed(1)}% تحويل نهائي`;

                // 5. Render Top Products & City Performance
                const cityStats = statsData.cityStats || [];
                const topProducts = statsData.topProducts || [];
                const topProductsList = document.getElementById('stats-top-products');
                if (topProductsList) {
                    const displayProducts = topProducts.slice(0, 5);
                    topProductsList.innerHTML = displayProducts.length ? displayProducts.map(p => `
                        <div class="top-product-item" style="padding: 8px; margin-bottom: 5px; border-bottom: 1px solid #f1f5f9;">
                            <img src="${p.image || '/img/placeholder.png'}" class="prod-thumb" style="width: 35px; height: 35px;" onerror="this.src='/img/placeholder.png'">
                            <div style="flex:1;">
                                <div style="font-size:12px; font-weight:700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${p.name}</div>
                                <div style="font-size:10px; color:var(--text-muted);">${p.count} مبيعات</div>
                            </div>
                            <div style="font-weight:800; font-size:12px; color:var(--primary);">₪${parseFloat(p.revenue).toFixed(2)}</div>
                        </div>
                    `).join('') : '<p style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">لا توجد بيانات كافية</p>';
                }
                const cityPerformanceList = document.getElementById('stats-city-performance');
                if (cityPerformanceList) {
                    const displayCities = cityStats.slice(0, 10);
                    cityPerformanceList.innerHTML = displayCities.length ? displayCities.map(c => `
                        <div class="city-tag" style="padding: 8px 12px; margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                            <span style="font-size:12px; font-weight:700;"><i class="fas fa-location-arrow" style="font-size:9px; margin-left:5px; opacity:0.5;"></i> ${c.name}</span>
                            <div style="text-align: left; display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
                                <span style="font-size:11px; font-weight:800; color:var(--primary);">${c.count || 0} طلبات</span>
                                <span style="font-size:10px; color:var(--text-muted); font-weight: 700;">₪${parseFloat(c.revenue || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    `).join('') : '<p style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">سيتم عرض أداء المدن عند توفر الطلبات</p>';
                }

                // 6. Recent Activity Table
                const tableBody = document.getElementById('dashboard-recent-orders');
                if (tableBody) {
                    const distributors = await DB.getDistributors();
                    const approvedPhones = distributors.filter(d => d.status === 'approved').map(d => (d.phone || '').replace(/\s+/g, ''));
                    const latestOrders = allOrdersRaw.slice(0, 8);
                    tableBody.innerHTML = latestOrders.map(o => {
                        const timeStr = o.date ? new Date(o.date).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '—';
                        const oPhone = (o.customer?.phone || o.customerPhone || '').replace(/\s+/g, '');
                        const isWholesale = o.isWholesale === true || o.isWholesale === 'true' || o.distributorId || (oPhone && approvedPhones.includes(oPhone));
                        const wholesaleTag = isWholesale ? '<span style="background:#fff7ed; color:#c2410c; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:900; border:1px solid #fdba74; display:inline-flex; align-items:center; gap:3px; margin-right:5px;"><i class="fas fa-store" style="font-size:10px;"></i> جملة</span>' : '';
                        return `
                            <tr onclick="viewOrder('${o.id}')" style="cursor:pointer; ${isWholesale ? 'background-color: #fffaf0;' : ''}" class="hover-row">
                                <td style="font-weight:800; color:var(--primary);">#${o.id}<div style="margin-top:4px;">${wholesaleTag}</div></td>
                                <td style="font-weight:700;">${o.customer ? o.customer.name : '—'}</td>
                                <td><span style="font-size:12px; color:var(--text-muted);">${o.customer ? o.customer.city : '—'}</span></td>
                                <td style="font-weight:800;">₪${parseFloat(o.total).toFixed(2)}</td>
                                <td><span class="badge" style="background:#f0fdf4; color:#16a34a; padding:6px 12px; border-radius:8px; font-size:11px;">${o.status || 'مكتمل'}</span></td>
                                <td style="font-size:12px; opacity:0.7;">${timeStr}</td>
                            </tr>`;
                    }).join('');
                }

                // 7. Update Dynamic Notifications
                const allProducts = await DB.getProducts();
                updateDynamicNotifications(allOrdersRaw, allProducts);

            } catch (e) { 
                console.error('Failed to load advanced stats:', e); 
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }
        }

        window.toggleCroSettings = function() {
            const panel = document.getElementById('cro-settings-panel');
            if (panel) {
                const isHidden = panel.style.display === 'none';
                panel.style.display = isHidden ? 'block' : 'none';
            }
        }

        window.saveCroTargets = function() {
            const settings = {
                targets: {
                    final: parseFloat(document.getElementById('target-final-val').value) || 5.0,
                    interest: parseFloat(document.getElementById('target-interest-val').value) || 20.0,
                    success: parseFloat(document.getElementById('target-success-val').value) || 50.0
                },
                visible: {
                    final: document.getElementById('show-final-cro').checked,
                    interest: document.getElementById('show-interest-cro').checked,
                    success: document.getElementById('show-success-cro').checked
                }
            };

            localStorage.setItem('cro_settings', JSON.stringify(settings));
            loadAdvancedStats(); // Reload to apply changes
        }

        async function _appendDistributorNotifs(notifications) {
            try {
                const dists = await DB.getDistributors();
                const pending = dists.filter(d => d.status === 'pending');
                pending.forEach(d => {
                    notifications.push({
                        icon: 'fa-user-plus',
                        color: '#10b981',
                        title: `طلب انضمام جديد: ${d.name || d.phone}`,
                        time: new Date(d.createdAt).toLocaleDateString('ar-EG'),
                        action: `switchTab('tab-distributors')`
                    });
                });
            } catch(e) {}
        }

        function _updateNotifUI(notifications) {
            const notifBody = document.querySelector('.notif-body');
            const notifBadge = document.querySelector('.notif-badge');
            if (!notifBody) return;
            if (notifications.length > 0) {
                notifBadge.style.display = 'block';
                notifBadge.innerText = notifications.length;
                notifBody.innerHTML = notifications.map(n => `
                    <div class="notif-item unread" onclick="${n.action}">
                        <i class="fas ${n.icon}" style="color: ${n.color};"></i>
                        <div class="notif-text">
                            <p>${n.title}</p>
                            <span>${n.time}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                notifBadge.style.display = 'none';
                notifBody.innerHTML = '<p style="text-align:center; padding:30px; color:#94a3b8; font-size:12px;">لا توجد تنبيهات جديدة</p>';
            }
        }

        async function updateDynamicNotifications(orders, products) {
            const notifBody = document.querySelector('.notif-body');
            const notifBadge = document.querySelector('.notif-badge');
            if (!notifBody) return;

            let notifications = [];

            // 1. Check for Low Stock (less than 5)
            const lowStockProducts = products.filter(p => {
                // Stock is in variants_data or advanced JSONB
                let stock = 0;
                if (p.variants_data && Array.isArray(p.variants_data) && p.variants_data.length) {
                    stock = p.variants_data.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
                } else if (p.advanced && typeof p.advanced.stock === 'number') {
                    stock = p.advanced.stock;
                } else if (p.variants && Array.isArray(p.variants)) {
                    // Check if variants have stock in their values
                    stock = p.variants.reduce((sum, v) => {
                        if (v.values && Array.isArray(v.values)) {
                            return sum + v.values.reduce((s, val) => s + (parseInt(val.stock) || 0), 0);
                        }
                        return sum;
                    }, 0);
                }
                return stock > 0 && stock < 5;
            });
            lowStockProducts.forEach(p => {
                let stock = 0;
                if (p.variants_data && Array.isArray(p.variants_data) && p.variants_data.length) {
                    stock = p.variants_data.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
                } else if (p.advanced && typeof p.advanced.stock === 'number') {
                    stock = p.advanced.stock;
                } else if (p.variants && Array.isArray(p.variants)) {
                    stock = p.variants.reduce((sum, v) => {
                        if (v.values && Array.isArray(v.values)) {
                            return sum + v.values.reduce((s, val) => s + (parseInt(val.stock) || 0), 0);
                        }
                        return sum;
                    }, 0);
                }
                notifications.push({
                    icon: 'fa-exclamation-triangle',
                    color: '#f59e0b',
                    title: `مخزون منخفض: ${p.name}`,
                    time: `المتبقي: ${stock}`,
                    action: `switchTab('tab-products')`
                });
            });

            // 2. Check for New Orders (last 24 hours)
            const now = new Date();
            const recentOrders = orders.filter(o => {
                const oDate = new Date(o.date || o.createdAt);
                return (now - oDate) < (24 * 60 * 60 * 1000);
            });
            recentOrders.forEach(o => {
                notifications.push({
                    icon: 'fa-shopping-bag',
                    color: '#4f46e5',
                    title: `طلب جديد #${o.id}`,
                    time: `بواسطة: ${o.customer ? o.customer.name : 'عميل'}`,
                    action: `switchTab('tab-orders')`
                });
            });

            // 3. Check for pending distributor registrations
            await _appendDistributorNotifs(notifications);

            _updateNotifUI(notifications);
        }

        function renderStatsChart(history) {
            const ctx = document.getElementById('mainStatsChart');
            if (!ctx) return;

            if (statsChart) statsChart.destroy();

            const labels = history.map(h => h.date);
            const visitData = history.map(h => h.visits);
            const orderData = history.map(h => h.orders);

            statsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'الزيارات اليومية',
                            data: visitData,
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(79, 70, 229, 0.05)',
                            fill: true,
                            tension: 0.45,
                            borderWidth: 3,
                            pointRadius: 4,
                            pointBackgroundColor: '#fff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'الطلبات المكتملة',
                            data: orderData,
                            borderColor: '#f97316',
                            backgroundColor: 'rgba(249, 115, 22, 0.05)',
                            fill: true,
                            tension: 0.45,
                            borderWidth: 3,
                            pointRadius: 4,
                            pointBackgroundColor: '#fff',
                            pointBorderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', rtl: true, labels: { font: { family: 'Tajawal', weight: '700', size: 12 }, usePointStyle: true, padding: 20 } },
                        tooltip: { backgroundColor: '#1e293b', titleFont: { family: 'Tajawal' }, bodyFont: { family: 'Tajawal' }, padding: 12, cornerRadius: 10 }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 5 } },
                        x: { grid: { display: false }, ticks: { font: { family: 'Tajawal', size: 11 } } }
                    },
                    interaction: { mode: 'index', intersect: false }
                }
            });
        }

        let activeSlides = window.activeSlides || [];

        function renderSlides() {
            const container = document.getElementById('slidesContainer');
            if(!container) return;
            
            if(activeSlides.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px; border:2px dashed var(--border); border-radius:16px; background:#f8fafc; color:var(--text-muted);">
                        <i class="fas fa-images" style="font-size:40px; margin-bottom:12px; opacity:0.5;"></i>
                        <p style="font-weight:700;">لا يوجد شرائح عرض حالياً. أضف شريحة لبدء العرض!</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = activeSlides.map((slide, index) => {
                const previewClass = slide.image ? '' : 'empty';
                return `
                    <div class="luxury-card" style="padding: 25px; border: 1px solid var(--border); border-radius: 16px; position:relative; background:#fff; margin-bottom:5px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                            <span style="font-weight:800; color:var(--primary); font-size:14px;"><i class="fas fa-image"></i> شريحة #${index + 1}</span>
                            <div style="display:flex; gap:8px;">
                                <button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="moveSlideUp(${index})" ${index === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up"></i></button>
                                <button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="moveSlideDown(${index})" ${index === activeSlides.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down"></i></button>
                                <button type="button" class="btn btn-outline" style="padding:4px 10px; font-size:12px; color:red; border-color:#fee2e2; background:#fee2e2;" onclick="removeSlide(${index})"><i class="fas fa-trash"></i> حذف</button>
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 150px 1fr; gap:20px;">
                            <div>
                                <div class="preview-box ${previewClass}" id="slide_image_${index}_preview" style="width:100%; height:130px; border-radius:12px; margin-bottom:0;">
                                    ${slide.image ? `<img src="${slide.image}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                                </div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:12px;">
                                <div style="display:flex; gap:10px;">
                                    <input type="text" id="slide_image_${index}" value="${slide.image || ''}" class="input-luxury" style="padding:10px 14px; font-size:14px; margin-bottom:0;" placeholder="رابط صورة الخلفية (رابط مباشر أو ارفع صورة)" oninput="activeSlides[${index}].image=this.value; updatePreview(this.value, 'slide_image_${index}_preview')">
                                    <button type="button" class="btn btn-outline" style="padding:0 15px;" onclick="triggerUpload('slide_image_${index}')"><i class="fas fa-upload"></i></button>
                                </div>
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                                    <input type="text" value="${slide.title || ''}" class="input-luxury" style="padding:10px 14px; font-size:14px; margin-bottom:0;" placeholder="العنوان الرئيسي (اختياري)" oninput="activeSlides[${index}].title=this.value">
                                    <input type="text" value="${slide.desc || ''}" class="input-luxury" style="padding:10px 14px; font-size:14px; margin-bottom:0;" placeholder="العنوان الفرعي/الوصف (اختياري)" oninput="activeSlides[${index}].desc=this.value">
                                </div>
                                <input type="text" value="${slide.link || ''}" class="input-luxury" style="padding:10px 14px; font-size:14px; margin-bottom:0;" placeholder="رابط التوجيه عند الضغط (مثلاً: /?app=product.show.123) (اختياري)" oninput="activeSlides[${index}].link=this.value">
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function addNewSlide() {
            activeSlides.push({ image: '', title: '', desc: '', link: '' });
            renderSlides();
        }

        function removeSlide(index) {
            if(confirm('هل أنت متأكد من حذف هذه الشريحة؟')) {
                activeSlides.splice(index, 1);
                renderSlides();
            }
        }

        function moveSlideUp(index) {
            if(index > 0) {
                const temp = activeSlides[index];
                activeSlides[index] = activeSlides[index - 1];
                activeSlides[index - 1] = temp;
                renderSlides();
            }
        }

        function moveSlideDown(index) {
            if(index < activeSlides.length - 1) {
                const temp = activeSlides[index];
                activeSlides[index] = activeSlides[index + 1];
                activeSlides[index + 1] = temp;
                renderSlides();
            }
        }

        function switchHeroType(type) {
            const input = document.getElementById('settings_heroType');
            if(input) input.value = type;
            ['slider','banner','video','none'].forEach(t => {
                const el = document.getElementById('heroEditor_' + t);
                if(el) el.style.display = (t === type) ? '' : 'none';
            });
            document.querySelectorAll('.hero-type-btn').forEach(btn => {
                const active = btn.dataset.type === type;
                btn.style.background = active ? 'var(--primary)' : 'var(--bg)';
                btn.style.color = active ? '#fff' : 'var(--dark)';
                btn.style.borderColor = active ? 'var(--primary)' : 'var(--border)';
                btn.style.boxShadow = active ? '0 4px 15px rgba(0,0,0,0.15)' : 'none';
            });
        }

        function serializeSlider() {
            const hiddenInput = document.getElementById('settings_slider_json');
            if(hiddenInput) {
                hiddenInput.value = JSON.stringify(activeSlides);
            }
        }

        let homeSections = window.homeSections || [];

        // --- Custom Pending Reviews management ---
        window.pendingReviews = [];
        async function fetchPendingReviews() {
            try {
                const data = await DB.getPendingReviews();
                window.pendingReviews = data || [];
                if (typeof renderHomeSections === 'function') {
                    renderHomeSections();
                }
            } catch(e) {
                console.error('Error fetching pending reviews:', e);
            }
        }
        fetchPendingReviews();

        window.approvePendingReview = async function(reviewId, secIndex) {
            const sec = homeSections[secIndex];
            if (!sec) return;
            
            const pr = window.pendingReviews.find(r => r.id === reviewId);
            if (!pr) return;
            
            if (!sec.reviews) sec.reviews = [];
            sec.reviews.push({
                name: pr.name,
                rating: pr.rating,
                text: pr.text,
                avatar: pr.avatar || ''
            });
            
            window.pendingReviews = window.pendingReviews.filter(r => r.id !== reviewId);
            
            renderHomeSections();
            serializeHomeSections();
            
            try {
                await DB.approveReview(reviewId);
                if (typeof showToast === 'function') {
                    showToast('✨ تم الموافقة على التقييم ونشره. اضغط "حفظ التغييرات" لتثبيت التحديث على المتجر.');
                } else {
                    alert('✨ تم الموافقة على التقييم ونشره. اضغط "حفظ التغييرات" لتثبيت التحديث.');
                }
            } catch(e) {
                console.error(e);
            }
        };

        window.rejectPendingReview = async function(reviewId) {
            window.pendingReviews = window.pendingReviews.filter(r => r.id !== reviewId);
            
            renderHomeSections();
            
            try {
                await DB.rejectReview(reviewId);
                if (typeof showToast === 'function') {
                    showToast('❌ تم رفض وحذف التقييم المعلق بنجاح.');
                } else {
                    alert('❌ تم رفض وحذف التقييم المعلق بنجاح.');
                }
            } catch(e) {
                console.error(e);
            }
        };

        function serializeHomeSections() {
            const hiddenInput = document.getElementById('settings_home_sections_json');
            if(hiddenInput) {
                hiddenInput.value = JSON.stringify(homeSections);
            }
        }

        function renderHomeSections() {
            const container = document.getElementById('homeSectionsContainer');
            if(!container) return;

            // Load collapse states from local storage
            const collapseStates = JSON.parse(localStorage.getItem('admin_sections_collapse') || '{}');

            if(homeSections.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px; border:2px dashed var(--border); border-radius:16px; background:#f8fafc; color:var(--text-muted);">
                        <i class="fas fa-layer-group" style="font-size:40px; margin-bottom:12px; opacity:0.5;"></i>
                        <p style="font-weight:700;">لا يوجد أقسام مخصصة حالياً.</p>
                        <p style="font-size:12px; margin-top:5px;">أضف أقساماً مخصصة لبناء صفحتك الرئيسية الفريدة!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = homeSections.map((section, index) => {
                // Apply stored collapse state only if not already set in this session
                if (section.collapsed === undefined) {
                    if (collapseStates[section.id] !== undefined) {
                        section.collapsed = collapseStates[section.id];
                    } else {
                        section.collapsed = false;
                    }
                }
                
                let sectionContent = '';
                const typeLabels = {
                    'text': 'نص مخصص / إعلان',
                    'banner': 'صورة بانر إعلاني',
                    'new_arrivals': 'قسم وصل حديثاً',
                    'coming_soon': 'قسم قريباً متاح',
                    'recommended_products': 'منتجات موصى بها ⭐',
                    'category_products': 'عرض منتجات قسم',
                    'winning_product': 'منتج رابح / مميز',
                    'video': 'فيديو معروض',
                    'html': 'كود HTML مخصص',
                    'category_tabs': 'تبويبات الأقسام التفاعلية 🏷️',
                    'reels': 'قسم فيديوهات ريلز',
                    'testimonials': 'آراء زبائننا ⭐',
                    'marquee': 'شريط نصوص متحرك 🏃',
                    'badges': 'عشارات مميزات المتجر 360°',
                    'logo_marquee': 'شريط شعارات متحرك 🖼️',
                    'static_features': 'مميزات المتجر (ثابتة) ✅',
                    'categories': 'التصنيفات 🏷️',
                    'hero_slider': 'البنر الرئيسي (Hero Section) 🚀'
                };
                const typeIcons = {
                    'text': 'fas fa-font',
                    'banner': 'fas fa-image',
                    'new_arrivals': 'fas fa-sparkles',
                    'coming_soon': 'fas fa-clock',
                    'recommended_products': 'fas fa-star',
                    'category_products': 'fas fa-boxes',
                    'winning_product': 'fas fa-trophy',
                    'video': 'fas fa-play-circle',
                    'html': 'fas fa-code',
                    'category_tabs': 'fas fa-tags',
                    'reels': 'fas fa-play-circle',
                    'testimonials': 'fas fa-quote-right',
                    'marquee': 'fas fa-running',
                    'badges': 'fas fa-certificate',
                    'logo_marquee': 'fas fa-images',
                    'static_features': 'fas fa-check-double',
                    'categories': 'fas fa-folder-tree',
                    'hero_slider': 'fas fa-rocket'
                };

                if (section.type === 'text') {
                    sectionContent = `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:10px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">العنوان الرئيسي</label>
                                <input type="text" value="${section.title || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="مثال: خصومات كبرى تصل إلى 50%" oninput="homeSections[${index}].title=this.value">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">العنوان الفرعي / الوصف</label>
                                <input type="text" value="${section.subtitle || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="شرح مبسط أو نص تشجيعي" oninput="homeSections[${index}].subtitle=this.value">
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin-bottom:10px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">لون الخلفية</label>
                                <input type="color" value="${section.bgColor || '#f8fafc'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].bgColor=this.value">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">لون النص</label>
                                <input type="color" value="${section.textColor || '#0f172a'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].textColor=this.value">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">محاذاة النص</label>
                                <select class="input-luxury" style="padding:10px; font-size:13px; background:#fff; margin-bottom:0;" onchange="homeSections[${index}].align=this.value">
                                    <option value="center" ${section.align === 'center' ? 'selected' : ''}>توسيط</option>
                                    <option value="right" ${section.align === 'right' ? 'selected' : ''}>يمين</option>
                                    <option value="left" ${section.align === 'left' ? 'selected' : ''}>يسار</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">نص زر الإجراء (اختياري)</label>
                                <input type="text" value="${section.btnText || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="تسوق الآن" oninput="homeSections[${index}].btnText=this.value">
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="label-luxury" style="font-size:12px;">رابط التوجيه لزر الإجراء (اختياري)</label>
                            <input type="text" value="${section.btnLink || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="مثال: /?app=product.cat.123" oninput="homeSections[${index}].btnLink=this.value">
                        </div>
                    `;
                } else if (section.type === 'banner') {
                    const previewClass = section.image ? '' : 'empty';
                    sectionContent = `
                        <div style="display:grid; grid-template-columns: 140px 1fr; gap:20px; align-items:center;">
                            <div>
                                <div class="preview-box ${previewClass}" id="home_sec_preview_${index}" style="width:100%; height:90px; border-radius:10px; margin-bottom:0;">
                                    ${section.image ? `<img src="${section.image}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                                </div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <div style="display:flex; gap:10px; width:100%;">
                                    <input type="text" id="home_sec_image_${index}" value="${section.image || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="رابط البانر الإعلاني (أو ارفع صورة)" oninput="homeSections[${index}].image=this.value; updatePreview(this.value, 'home_sec_preview_${index}')">
                                    <button type="button" class="btn btn-outline" style="padding:0 15px;" onclick="triggerUpload('home_sec_image_${index}')"><i class="fas fa-upload"></i></button>
                                </div>
                                <input type="text" value="${section.link || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="رابط التوجيه عند الضغط على البانر (اختياري)" oninput="homeSections[${index}].link=this.value">
                            </div>
                        </div>
                    `;
                } else if (section.type === 'new_arrivals' || section.type === 'coming_soon' || section.type === 'recommended_products') {
                    const sectionPlaceholder = section.type === 'new_arrivals' ? 'وصل حديثاً ✨' : section.type === 'coming_soon' ? 'قريباً متاح ⏳' : 'منتجات موصى بها ⭐';
                    sectionContent = `
                        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:15px; margin-bottom:0;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">عنوان القسم (مثلاً: ${sectionPlaceholder})</label>
                                <input type="text" value="${section.title || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="عنوان القسم" oninput="homeSections[${index}].title=this.value">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">عدد المنتجات المعروضة</label>
                                <input type="number" min="2" max="24" step="2" value="${section.limit || 8}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" oninput="homeSections[${index}].limit=parseInt(this.value)">
                            </div>
                        </div>
                    `;
                } else if (section.type === 'category_products') {
                    const catOptions = allCategories.map(c => `
                        <option value="${c.id}" ${section.categoryId === c.id ? 'selected' : ''}>${c.name}</option>
                    `).join('');
                    sectionContent = `
                        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:15px; margin-bottom:0;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">اختر قسم المنتجات</label>
                                <select class="input-luxury" style="padding:10px; font-size:13px; background:#fff; margin-bottom:0;" onchange="homeSections[${index}].categoryId=this.value">
                                    <option value="" disabled ${!section.categoryId ? 'selected' : ''}>اختر القسم...</option>
                                    <option value="all" ${section.categoryId === 'all' ? 'selected' : ''}>كل التصنيفات (عرض الأقسام بالتتالي)</option>
                                    ${catOptions}
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">عدد المنتجات المعروضة</label>
                                <input type="number" min="2" max="24" step="2" value="${section.limit || 8}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" oninput="homeSections[${index}].limit=parseInt(this.value)">
                            </div>
                        </div>
                    `;
                } else if (section.type === 'winning_product') {
                    const prodOptions = allProducts.map(p => `
                        <option value="${p.id}" ${section.productId === p.id ? 'selected' : ''}>${p.name}</option>
                    `).join('');
                    sectionContent = `
                        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:15px; margin-bottom:10px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">اختر المنتج المميز</label>
                                <select class="input-luxury" style="padding:10px; font-size:13px; background:#fff; margin-bottom:0;" onchange="homeSections[${index}].productId=this.value">
                                    <option value="" disabled ${!section.productId ? 'selected' : ''}>اختر المنتج...</option>
                                    ${prodOptions}
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">العنوان الرئيسي للقسم</label>
                                <input type="text" value="${section.title || '🔥 المنتج الرابح لهذا الأسبوع!'}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="عنوان تشجيعي جذاب" oninput="homeSections[${index}].title=this.value">
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="label-luxury" style="font-size:12px;">نص تسويقي مخصص للمنتج (وصف جذاب وسريع)</label>
                            <textarea rows="2" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="مثال: هذا المنتج يحل مشكلة تساقط الشعر بشكل نهائي وبضمان مالي..." oninput="homeSections[${index}].desc=this.value">${section.desc || ''}</textarea>
                        </div>
                    `;
                } else if (section.type === 'video') {
                    const videoUrl = section.videoUrl || '';
                    let previewHTML = '';
                    if (videoUrl) {
                        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                            let ytId = '';
                            if (videoUrl.includes('v=')) ytId = videoUrl.split('v=')[1].split('&')[0];
                            else ytId = videoUrl.split('/').pop();
                            previewHTML = `<iframe src="https://www.youtube.com/embed/${ytId}" style="width:100%; height:150px; border-radius:10px; border:none;"></iframe>`;
                        } else {
                            previewHTML = `<video src="${videoUrl}" style="width:100%; height:150px; border-radius:10px; object-fit:cover;" controls></video>`;
                        }
                    }
                    sectionContent = `
                        <div style="display:grid; grid-template-columns: 200px 1fr; gap:20px; align-items:center;">
                            <div class="preview-box ${videoUrl ? '' : 'empty'}" id="video_preview_${index}" style="width:100%; height:150px; border-radius:12px; margin-bottom:0; display:flex; align-items:center; justify-content:center; background:#f8fafc; overflow:hidden; border:1px solid var(--border);">
                                ${previewHTML || '<i class="fas fa-play-circle" style="font-size:30px; color:#cbd5e1;"></i>'}
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">رابط الفيديو (رابط مباشر بصيغة mp4 أو رابط YouTube)</label>
                                <div style="display:flex; gap:5px; margin-bottom:10px;">
                                    <input type="text" id="video_url_${index}" value="${videoUrl}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0; flex:1;" placeholder="مثال: https://mywebsite.com/videos/promo.mp4" oninput="homeSections[${index}].videoUrl=this.value; renderHomeSections(); serializeHomeSections();">
                                    <button type="button" class="btn btn-outline" style="padding:0 15px;" onclick="triggerUpload('video_url_${index}')"><i class="fas fa-upload"></i></button>
                                </div>
                                <div style="font-size:11px; color:var(--text-muted); background:#f0f9ff; padding:8px 12px; border-radius:8px; border:1px solid #bae6fd;">
                                    <i class="fas fa-info-circle"></i> يمكنك وضع رابط فيديو مباشر أو رابط YouTube عادي وسيتم تحويله تلقائياً للمعاينة.
                                </div>
                            </div>
                        </div>
                    `;
                } else if (section.type === 'html') {
                    sectionContent = `
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="label-luxury" style="font-size:12px;">كود HTML / Embed المخصص (لتضمين ويدجت مثل تقييمات، خرائط، نماذج إلخ)</label>
                            <textarea rows="3" class="input-luxury" style="padding:10px; font-size:12px; font-family:monospace; margin-bottom:0;" placeholder="&lt;div class='custom-widget'&gt;...&lt;/div&gt;" oninput="homeSections[${index}].htmlContent=this.value">${section.htmlContent || ''}</textarea>
                        </div>
                    `;
                } else if (section.type === 'category_tabs') {
                    const selectedCats = section.categoryIds || [];
                    const catCheckboxes = allCategories.map(c => `
                        <label style="display:inline-flex; align-items:center; gap:6px; margin: 4px 10px 4px 0; font-size:12px; font-family:'Tajawal', sans-serif; cursor:pointer;">
                            <input type="checkbox" value="${c.id}" ${selectedCats.includes(c.id) ? 'checked' : ''} 
                                onchange="
                                    let ids = homeSections[${index}].categoryIds || [];
                                    if(this.checked) {
                                        if(!ids.includes(this.value)) ids.push(this.value);
                                    } else {
                                        ids = ids.filter(id => id !== this.value);
                                    }
                                    homeSections[${index}].categoryIds = ids;
                                    serializeHomeSections();
                                ">
                            <span>${c.name}</span>
                        </label>
                    `).join('');
                    sectionContent = `
                        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:15px; margin-bottom:12px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">عنوان القسم (مثلاً: تصفح حسب الفئات ✨)</label>
                                <input type="text" value="${section.title || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="تصفح حسب الفئات" oninput="homeSections[${index}].title=this.value; serializeHomeSections();">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">عدد المنتجات المعروضة لكل قسم</label>
                                <input type="number" min="2" max="24" step="2" value="${section.limit || 12}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" oninput="homeSections[${index}].limit=parseInt(this.value); serializeHomeSections();">
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="label-luxury" style="font-size:12px;">اختر الأقسام لعرضها كتبويبات (أشر على الأقسام التي تريد تضمينها)</label>
                            <div style="max-height:150px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; padding:10px; background:#fff; display:flex; flex-wrap:wrap; gap:10px;">
                                ${catCheckboxes || '<span style="font-size:12px; color:var(--text-muted);">لا توجد أقسام متوفرة</span>'}
                            </div>
                        </div>
                    `;
                } else if (section.type === 'reels') {
                    sectionContent = `
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="label-luxury" style="font-size:12px;">عنوان القسم (مثلاً: فيديوهات ريلز ممتعة ✨)</label>
                            <input type="text" value="${section.title || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:10px;" placeholder="فيديوهات ريلز" oninput="homeSections[${index}].title=this.value; serializeHomeSections();">
                            <div style="background:#f1f5f9; border-radius:12px; padding:15px; display:flex; align-items:center; gap:12px; border:1.5px dashed #cbd5e1;">
                                <div style="width:40px; height:40px; border-radius:10px; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center;">
                                    <i class="fas fa-play-circle" style="font-size:20px;"></i>
                                </div>
                                <div>
                                    <div style="font-weight:800; font-size:13px; color:#1e293b;">عرض تلقائي للفيديوهات</div>
                                    <div style="font-size:11px; color:#64748b;">سيقوم هذا القسم بسحب آخر 10 فيديوهات قمت بإضافتها في تبويب "الفيديوهات" وعرضها بشكل عرضي جذاب.</div>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (section.type === 'testimonials') {
                    const reviews = section.reviews || [];
                    const reviewsHTML = reviews.map((r, ri) => {
                        const previewId = `review_avatar_${index}_${ri}_preview`;
                        const previewClass = r.avatar ? '' : 'empty';
                        return `
                        <div style="border:1px solid var(--border); border-radius:12px; padding:15px; background:#fff; margin-bottom:10px;">
                            <style>
                                .avatar-preview-box img {
                                    object-fit: cover !important;
                                    border-radius: 50% !important;
                                }
                            </style>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                                <div class="form-group" style="margin-bottom:0;">
                                    <label class="label-luxury" style="font-size:11px;">اسم الزبون</label>
                                    <input type="text" value="${r.name || ''}" class="input-luxury" style="padding:8px; font-size:12px; margin-bottom:0;" placeholder="محمد علي" oninput="homeSections[${index}].reviews[${ri}].name=this.value; serializeHomeSections();">
                                </div>
                                <div class="form-group" style="margin-bottom:0;">
                                    <label class="label-luxury" style="font-size:11px;">التقييم (1-5)</label>
                                    <input type="number" min="1" max="5" value="${r.rating || 5}" class="input-luxury" style="padding:8px; font-size:12px; margin-bottom:0;" oninput="homeSections[${index}].reviews[${ri}].rating=parseInt(this.value); serializeHomeSections();">
                                </div>
                            </div>
                            
                            <div style="display:grid; grid-template-columns: 45px 1fr auto; gap:10px; align-items:center; margin-bottom:10px;">
                                <div class="preview-box avatar-preview-box ${previewClass}" id="${previewId}" style="width:38px; height:38px; border-radius:50%; margin-bottom:0; overflow:hidden; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; background:#f8fafc; flex-shrink:0;">
                                    ${r.avatar ? `<img src="${r.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '<i class="fas fa-user" style="color:#cbd5e1; font-size:12px;"></i>'}
                                </div>
                                <div style="display:flex; gap:5px; width:100%;">
                                    <input type="text" id="review_avatar_${index}_${ri}" value="${r.avatar || ''}" class="input-luxury" style="padding:8px; font-size:11px; margin-bottom:0; width:100%;" placeholder="رابط صورة الزبون (رابط أو ارفع)" oninput="homeSections[${index}].reviews[${ri}].avatar=this.value; updatePreview(this.value, '${previewId}'); serializeHomeSections();">
                                    <button type="button" class="btn btn-outline" style="padding:0 10px; height:34px;" onclick="triggerUpload('review_avatar_${index}_${ri}')"><i class="fas fa-upload" style="font-size:11px;"></i></button>
                                </div>
                                <div>
                                    <button type="button" class="btn btn-outline" style="padding:8px 12px; font-size:11px; color:red; border-color:#fee2e2; background:#fee2e2; height:34px; display:flex; align-items:center; gap:4px;" onclick="homeSections[${index}].reviews.splice(${ri},1); renderHomeSections(); serializeHomeSections();"><i class="fas fa-trash"></i> حذف</button>
                                </div>
                            </div>

                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:11px;">نص التقييم / الرأي</label>
                                <textarea rows="2" class="input-luxury" style="padding:8px; font-size:12px; margin-bottom:0;" placeholder="تجربة رائعة جداً وسأوصي به لكل شخص..." oninput="homeSections[${index}].reviews[${ri}].text=this.value; serializeHomeSections();">${r.text || ''}</textarea>
                            </div>
                        </div>
                        `;
                    }).join('');

                    const pReviews = window.pendingReviews || [];
                    let pendingHTML = '';
                    if (pReviews.length > 0) {
                        const pListHTML = pReviews.map((pr) => {
                            const stars = Array.from({length: 5}, (_, i) =>
                                `<i class="fas fa-star" style="color:${i < pr.rating ? '#f59e0b' : '#cbd5e1'}; font-size:10px; margin-left:2px;"></i>`
                            ).join('');
                            const prAvatarHTML = pr.avatar ? 
                                `<img src="${pr.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : 
                                `<span style="font-size:10px; font-weight:800; color:#fff;">${(pr.name || 'ز').charAt(0)}</span>`;
                            const prAvatarBg = pr.avatar ? 'background:none; border:1px solid #ddd;' : 'background:linear-gradient(135deg,#a855f7,#7c3aed);';
                            
                            return `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #f3e8ff; border-radius:10px; background:#fff; margin-bottom:8px; gap:10px; direction:rtl;">
                                <div style="display:flex; gap:10px; align-items:center; flex:1;">
                                    <div style="width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; ${prAvatarBg}">
                                        ${prAvatarHTML}
                                    </div>
                                    <div style="flex:1;">
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span style="font-weight:800; font-size:11px; color:var(--dark);">${pr.name || 'زبون'}</span>
                                            <div style="display:flex;">${stars}</div>
                                        </div>
                                        <p style="font-size:10px; color:#475569; margin:2px 0 0; line-height:1.4;">${pr.text || ''}</p>
                                    </div>
                                </div>
                                <div style="display:flex; gap:5px; flex-shrink:0;">
                                    <button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:10px; color:#10b981; border-color:#dcfce7; background:#dcfce7; height:28px;" onclick="approvePendingReview('${pr.id}', ${index})">✔️ موافقة</button>
                                    <button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:10px; color:#ef4444; border-color:#fee2e2; background:#fee2e2; height:28px;" onclick="rejectPendingReview('${pr.id}')">❌ رفض</button>
                                </div>
                            </div>
                            `;
                        }).join('');

                        pendingHTML = `
                        <div style="margin-top:20px; padding:15px; border: 1.5px dashed #a855f7; border-radius:12px; background:#faf5ff;">
                            <h4 style="color:#7e22ce; margin:0 0 10px; font-size:12px; font-weight:800; font-family:'Tajawal', sans-serif;"><i class="fas fa-clock"></i> تقييمات معلقة بانتظار المراجعة (${pReviews.length})</h4>
                            <div style="max-height:220px; overflow-y:auto; padding-left:4px;">
                                ${pListHTML}
                            </div>
                        </div>
                        `;
                    }

                    sectionContent = `
                        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:15px; margin-bottom:12px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">عنوان القسم</label>
                                <input type="text" value="${section.title || 'آراء زبائننا ⭐'}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="آراء زبائننا" oninput="homeSections[${index}].title=this.value; serializeHomeSections();">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">العنوان الفرعي</label>
                                <input type="text" value="${section.subtitle || ''}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="ماذا يقول زبائننا عنا" oninput="homeSections[${index}].subtitle=this.value; serializeHomeSections();">
                            </div>
                        </div>
                        <div style="margin-bottom:10px;">
                            ${reviewsHTML || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:15px;">لا يوجد آراء بعد. أضف رأياً الآن!</p>'}
                        </div>
                        <button type="button" class="btn btn-outline" style="width:100%; font-size:12px; padding:9px; border-style:dashed;" onclick="if(!homeSections[${index}].reviews) homeSections[${index}].reviews=[]; homeSections[${index}].reviews.push({name:'',rating:5,text:'',avatar:''}); renderHomeSections(); serializeHomeSections();">
                            <i class="fas fa-plus"></i> إضافة رأي جديد
                        </button>
                        ${pendingHTML}
                    `;
                } else if (section.type === 'marquee') {
                    const texts = section.texts || [];
                    const textsHTML = texts.map((t, ti) => `
                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <input type="text" value="${t}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0; flex:1;" placeholder="أدخل النص المتحرك هنا..." oninput="homeSections[${index}].texts[${ti}]=this.value; serializeHomeSections();">
                            <button type="button" class="btn btn-outline" style="padding:0 15px; color:red; border-color:#fee2e2; background:#fee2e2;" onclick="homeSections[${index}].texts.splice(${ti},1); renderHomeSections(); serializeHomeSections();"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('');

                    sectionContent = `
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; margin-bottom:15px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">لون الخلفية</label>
                                <input type="color" value="${section.bgColor || '#fa0000'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].bgColor=this.value; serializeHomeSections();">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">لون النص</label>
                                <input type="color" value="${section.textColor || '#ffffff'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].textColor=this.value; serializeHomeSections();">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">السرعة (بالثانية)</label>
                                <input type="number" value="${section.speed || 25}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="مثلاً: 25" oninput="homeSections[${index}].speed=this.value; serializeHomeSections();">
                                <small style="font-size:10px; color:var(--text-muted);">أقل يعني أسرع</small>
                            </div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label class="label-luxury" style="font-size:12px;">النصوص المعروضة</label>
                            ${textsHTML || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">لا يوجد نصوص. أضف نصاً الآن!</p>'}
                        </div>
                        <button type="button" class="btn btn-outline" style="width:100%; font-size:12px; padding:9px; border-style:dashed;" onclick="if(!homeSections[${index}].texts) homeSections[${index}].texts=[]; homeSections[${index}].texts.push(''); renderHomeSections(); serializeHomeSections();">
                            <i class="fas fa-plus"></i> إضافة نص جديد
                        </button>
                    `;
                } else if (section.type === 'badges') {
                    const items = section.items || [];
                    const itemsHTML = items.map((it, ii) => {
                        const previewId = `badge_preview_${index}_${ii}`;
                        const inputId = `badge_image_${index}_${ii}`;
                        return `
                        <div style="border:1px solid var(--border); border-radius:12px; padding:15px; background:#fff; margin-bottom:10px;">
                            <div style="display:grid; grid-template-columns: 60px 1fr auto; gap:15px; align-items:center; margin-bottom:10px;">
                                <div id="${previewId}" style="width:50px; height:50px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                    ${it.image ? `<img src="${it.image}" style="width:100%; height:100%; object-fit:contain;">` : `<i class="fa ${it.icon || 'fa-certificate'}" style="color:${section.iconColor || '#fa0000'}; font-size:24px;"></i>`}
                                </div>
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    <div style="display:flex; gap:5px;">
                                        <div style="flex:1;">
                                            <label class="label-luxury" style="font-size:10px; margin-bottom:2px;">رابط الصورة / أيقونة</label>
                                            <div style="display:flex; gap:4px;">
                                                <input type="text" id="${inputId}" value="${it.image || it.icon || ''}" class="input-luxury" style="padding:6px 10px; font-size:11px; margin-bottom:0;" placeholder="رابط صورة أو اسم أيقونة (fa-star)" 
                                                    oninput="
                                                        const val = this.value;
                                                        if(val.startsWith('/') || val.startsWith('http')) {
                                                            homeSections[${index}].items[${ii}].image = val;
                                                            homeSections[${index}].items[${ii}].icon = '';
                                                        } else {
                                                            homeSections[${index}].items[${ii}].icon = val;
                                                            homeSections[${index}].items[${ii}].image = '';
                                                        }
                                                        renderHomeSections();
                                                        serializeHomeSections();
                                                    ">
                                                <button type="button" class="btn btn-outline" style="padding:0 8px; height:32px;" onclick="triggerUpload('${inputId}')"><i class="fas fa-upload" style="font-size:10px;"></i></button>
                                            </div>
                                        </div>
                                        <div style="flex:1;">
                                            <label class="label-luxury" style="font-size:10px; margin-bottom:2px;">النص التوضيحي</label>
                                            <input type="text" value="${it.text || ''}" class="input-luxury" style="padding:6px 10px; font-size:11px; margin-bottom:0; height:32px;" placeholder="مثال: توصيل سريع" oninput="homeSections[${index}].items[${ii}].text=this.value; serializeHomeSections();">
                                        </div>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-outline" style="padding:8px; color:red; border-color:#fee2e2; background:#fee2e2;" onclick="homeSections[${index}].items.splice(${ii},1); renderHomeSections(); serializeHomeSections();"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `;}).join('');

                    sectionContent = `
                        <div class="form-group" style="margin-bottom:15px;">
                            <label class="label-luxury" style="font-size:12px;">لون الأيقونات</label>
                            <input type="color" value="${section.iconColor || '#fa0000'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].iconColor=this.value; serializeHomeSections();">
                        </div>
                        <div style="margin-bottom:10px;">
                            <label class="label-luxury" style="font-size:12px;">العشارات المميزة</label>
                            ${itemsHTML || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">لا يوجد عشارات. أضف عشارة الآن!</p>'}
                        </div>
                        <button type="button" class="btn btn-outline" style="width:100%; font-size:12px; padding:9px; border-style:dashed;" onclick="if(!homeSections[${index}].items) homeSections[${index}].items=[]; homeSections[${index}].items.push({icon:'fa-star', text:''}); renderHomeSections(); serializeHomeSections();">
                            <i class="fas fa-plus"></i> إضافة عشارة جديدة
                        </button>
                    `;
                } else if (section.type === 'logo_marquee') {
                    const logos = section.logos || [];
                    const logosHTML = logos.map((l, li) => {
                        const previewId = `logo_preview_${index}_${li}`;
                        const isObj = typeof l === 'object' && l !== null;
                        const url = isObj ? l.url : l;
                        const link = isObj ? (l.link || '') : '';
                        const previewClass = url ? '' : 'empty';
                        return `
                        <div style="display:grid; grid-template-columns: 60px 1fr 1fr auto; gap:10px; align-items:center; margin-bottom:10px; background:#f8fafc; padding:10px; border-radius:10px; border:1px solid #edf2f7;">
                            <div class="preview-box ${previewClass}" id="${previewId}" style="width:45px; height:45px; border-radius:8px; margin-bottom:0; background:#fff; border:1px solid #ddd; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                                ${url ? `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">` : '<i class="fas fa-image" style="color:#cbd5e1; font-size:14px;"></i>'}
                            </div>
                            <div style="display:flex; gap:5px; flex:1;">
                                <input type="text" id="logo_url_${index}_${li}" value="${url || ''}" class="input-luxury" style="padding:8px; font-size:11px; margin-bottom:0; flex:1;" placeholder="رابط الشعار..." oninput="
                                    if(typeof homeSections[${index}].logos[${li}] !== 'object') homeSections[${index}].logos[${li}] = {url: '', link: ''};
                                    homeSections[${index}].logos[${li}].url = this.value;
                                    updatePreview(this.value, '${previewId}');
                                    serializeHomeSections();
                                ">
                                <button type="button" class="btn btn-outline" style="padding:0 10px; height:36px;" onclick="triggerUpload('logo_url_${index}_${li}')"><i class="fas fa-upload"></i></button>
                            </div>
                            <div style="flex:1;">
                                <input type="text" value="${link}" class="input-luxury" style="padding:8px; font-size:11px; margin-bottom:0;" placeholder="رابط اختياري (http://...)" oninput="
                                    if(typeof homeSections[${index}].logos[${li}] !== 'object') homeSections[${index}].logos[${li}] = {url: '', link: ''};
                                    homeSections[${index}].logos[${li}].link = this.value;
                                    serializeHomeSections();
                                ">
                            </div>
                            <button type="button" class="btn btn-outline" style="padding:0 12px; height:36px; color:red; border-color:#fee2e2; background:#fee2e2;" onclick="homeSections[${index}].logos.splice(${li},1); renderHomeSections(); serializeHomeSections();"><i class="fas fa-trash"></i></button>
                        </div>
                    `;}).join('');

                    sectionContent = `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">لون الخلفية</label>
                                <input type="color" value="${section.bgColor || '#ffffff'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].bgColor=this.value; serializeHomeSections();">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">السرعة (بالثانية)</label>
                                <input type="number" value="${section.speed || 60}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" placeholder="مثلاً: 60" oninput="homeSections[${index}].speed=this.value; serializeHomeSections();">
                                <small style="font-size:10px; color:var(--text-muted);">أقل يعني أسرع</small>
                            </div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label class="label-luxury" style="font-size:12px;">شعارات الماركات</label>
                            ${logosHTML || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">لا يوجد شعارات. أضف شعاراً الآن!</p>'}
                        </div>
                        <button type="button" class="btn btn-outline" style="width:100%; font-size:12px; padding:9px; border-style:dashed;" onclick="if(!homeSections[${index}].logos) homeSections[${index}].logos=[]; homeSections[${index}].logos.push(''); renderHomeSections(); serializeHomeSections();">
                            <i class="fas fa-plus"></i> إضافة شعار جديد
                        </button>
                    `;
                } else if (section.type === 'static_features') {
                    const items = section.items || [];
                    const itemsHTML = items.map((it, ii) => {
                        const previewId = `static_preview_${index}_${ii}`;
                        const inputId = `static_image_${index}_${ii}`;
                        return `
                        <div style="border:1px solid var(--border); border-radius:12px; padding:15px; background:#fff; margin-bottom:10px;">
                            <div style="display:grid; grid-template-columns: 60px 1fr auto; gap:15px; align-items:center; margin-bottom:10px;">
                                <div id="${previewId}" style="width:50px; height:50px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                    ${it.image ? `<img src="${it.image}" style="width:100%; height:100%; object-fit:contain;">` : `<i class="fa ${it.icon || 'fa-check'}" style="color:${section.iconColor || '#fa0000'}; font-size:24px;"></i>`}
                                </div>
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    <div style="display:flex; gap:5px;">
                                        <div style="flex:1;">
                                            <label class="label-luxury" style="font-size:10px; margin-bottom:2px;">رابط الصورة / أيقونة</label>
                                            <div style="display:flex; gap:4px;">
                                                <input type="text" id="${inputId}" value="${it.image || it.icon || ''}" class="input-luxury" style="padding:6px 10px; font-size:11px; margin-bottom:0;" placeholder="رابط صورة أو اسم أيقونة (fa-star)" 
                                                    oninput="
                                                        const val = this.value;
                                                        if(val.startsWith('/') || val.startsWith('http')) {
                                                            homeSections[${index}].items[${ii}].image = val;
                                                            homeSections[${index}].items[${ii}].icon = '';
                                                        } else {
                                                            homeSections[${index}].items[${ii}].icon = val;
                                                            homeSections[${index}].items[${ii}].image = '';
                                                        }
                                                        renderHomeSections();
                                                        serializeHomeSections();
                                                    ">
                                                <button type="button" class="btn btn-outline" style="padding:0 8px; height:32px;" onclick="triggerUpload('${inputId}')"><i class="fas fa-upload" style="font-size:10px;"></i></button>
                                            </div>
                                        </div>
                                        <div style="flex:1;">
                                            <label class="label-luxury" style="font-size:10px; margin-bottom:2px;">العنوان</label>
                                            <input type="text" value="${it.title || ''}" class="input-luxury" style="padding:6px 10px; font-size:11px; margin-bottom:0; height:32px;" placeholder="توصيل سريع" oninput="homeSections[${index}].items[${ii}].title=this.value; serializeHomeSections();">
                                        </div>
                                    </div>
                                    <div class="form-group" style="margin-bottom:0;">
                                        <label class="label-luxury" style="font-size:10px; margin-bottom:2px;">وصف قصير</label>
                                        <input type="text" value="${it.desc || ''}" class="input-luxury" style="padding:6px 10px; font-size:11px; margin-bottom:0;" placeholder="خلال 24 ساعة فقط" oninput="homeSections[${index}].items[${ii}].desc=this.value; serializeHomeSections();">
                                    </div>
                                </div>
                                <button type="button" class="btn btn-outline" style="padding:8px; color:red; border-color:#fee2e2; background:#fee2e2;" onclick="homeSections[${index}].items.splice(${ii},1); renderHomeSections(); serializeHomeSections();"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `;}).join('');

                    sectionContent = `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">لون الخلفية</label>
                                <input type="color" value="${section.bgColor || '#f8fafc'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].bgColor=this.value; serializeHomeSections();">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">لون الأيقونات</label>
                                <input type="color" value="${section.iconColor || '#fa0000'}" class="input-luxury" style="padding:5px; height:42px; margin-bottom:0;" oninput="homeSections[${index}].iconColor=this.value; serializeHomeSections();">
                            </div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label class="label-luxury" style="font-size:12px;">مميزات المتجر</label>
                            ${itemsHTML || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">لا يوجد مميزات. أضف ميزة الآن!</p>'}
                        </div>
                        <button type="button" class="btn btn-outline" style="width:100%; font-size:12px; padding:9px; border-style:dashed;" onclick="if(!homeSections[${index}].items) homeSections[${index}].items=[]; homeSections[${index}].items.push({icon:'fa-check', title:'', desc:''}); renderHomeSections(); serializeHomeSections();">
                            <i class="fas fa-plus"></i> إضافة ميزة جديدة
                        </button>
                    `;
                } else if (section.type === 'categories') {
                    const catStyle = section.catStyle || 'grid';
                    const selectedCatIds = section.categoryIds || [];
                    const catsForCheckbox = (allCategories && allCategories.length) ? allCategories : (window._allCats || []);
                    if (!catsForCheckbox.length && typeof DB !== 'undefined' && DB.getCategories) {
                        DB.getCategories().then(c => { window._allCats = c; if (typeof renderHomeSections === 'function') renderHomeSections(); });
                    }
                    const catCheckboxes = catsForCheckbox.map(c => `
                        <label style="display:inline-flex; align-items:center; gap:6px; margin: 4px 10px 4px 0; font-size:12px; font-family:'Tajawal', sans-serif; cursor:pointer;">
                            <input type="checkbox" value="${c.id}" ${selectedCatIds.includes(c.id) ? 'checked' : ''} 
                                onchange="
                                    let ids = homeSections[${index}].categoryIds || [];
                                    if(this.checked) {
                                        if(!ids.includes(this.value)) ids.push(this.value);
                                    } else {
                                        ids = ids.filter(id => id !== this.value);
                                    }
                                    homeSections[${index}].categoryIds = ids;
                                    serializeHomeSections();
                                ">
                            <span>${c.name}</span>
                        </label>
                    `).join('');
                    sectionContent = `
                        <div class="form-group" style="margin-bottom:10px;">
                            <label class="label-luxury" style="font-size:12px;">عنوان القسم</label>
                            <input type="text" value="${section.title || 'التصنيفات 🏷️'}" class="input-luxury" style="padding:10px; font-size:13px; margin-bottom:0;" oninput="homeSections[${index}].title=this.value; serializeHomeSections();">
                        </div>
                        <div class="form-group" style="margin-bottom:10px;">
                            <label class="label-luxury" style="font-size:12px;">شكل عرض التصنيفات</label>
                            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px;">
                                <label style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px; border:2px solid ${catStyle === 'grid' ? 'var(--primary)' : '#e2e8f0'}; border-radius:12px; cursor:pointer; background:${catStyle === 'grid' ? '#f5f3ff' : '#fff'};" onclick="homeSections[${index}].catStyle='grid'; renderHomeSections(); serializeHomeSections();">
                                    <i class="fas fa-th-large" style="font-size:22px; color:${catStyle === 'grid' ? 'var(--primary)' : '#94a3b8'};"></i>
                                    <span style="font-size:10px; font-weight:700; color:${catStyle === 'grid' ? 'var(--primary)' : '#64748b'};">شبكة</span>
                                </label>
                                <label style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px; border:2px solid ${catStyle === 'list' ? 'var(--primary)' : '#e2e8f0'}; border-radius:12px; cursor:pointer; background:${catStyle === 'list' ? '#f5f3ff' : '#fff'};" onclick="homeSections[${index}].catStyle='list'; renderHomeSections(); serializeHomeSections();">
                                    <i class="fas fa-list" style="font-size:22px; color:${catStyle === 'list' ? 'var(--primary)' : '#94a3b8'};"></i>
                                    <span style="font-size:10px; font-weight:700; color:${catStyle === 'list' ? 'var(--primary)' : '#64748b'};">قائمة</span>
                                </label>
                                <label style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px; border:2px solid ${catStyle === 'circles' ? 'var(--primary)' : '#e2e8f0'}; border-radius:12px; cursor:pointer; background:${catStyle === 'circles' ? '#f5f3ff' : '#fff'};" onclick="homeSections[${index}].catStyle='circles'; renderHomeSections(); serializeHomeSections();">
                                    <i class="fas fa-circle" style="font-size:22px; color:${catStyle === 'circles' ? 'var(--primary)' : '#94a3b8'};"></i>
                                    <span style="font-size:10px; font-weight:700; color:${catStyle === 'circles' ? 'var(--primary)' : '#64748b'};">دوائر</span>
                                </label>
                                <label style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px; border:2px solid ${catStyle === 'boxes' ? 'var(--primary)' : '#e2e8f0'}; border-radius:12px; cursor:pointer; background:${catStyle === 'boxes' ? '#f5f3ff' : '#fff'};" onclick="homeSections[${index}].catStyle='boxes'; renderHomeSections(); serializeHomeSections();">
                                    <i class="fas fa-th" style="font-size:22px; color:${catStyle === 'boxes' ? 'var(--primary)' : '#94a3b8'};"></i>
                                    <span style="font-size:10px; font-weight:700; color:${catStyle === 'boxes' ? 'var(--primary)' : '#64748b'};">بطاقات</span>
                                </label>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="label-luxury" style="font-size:12px;">اختر التصنيفات للعرض (اتركها فارغة لعرض الكل)</label>
                            <div style="max-height:150px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; padding:10px; background:#fff; display:flex; flex-wrap:wrap; gap:10px;">
                                ${catCheckboxes || '<span style="font-size:12px; color:var(--text-muted);">لا توجد تصنيفات متوفرة</span>'}
                            </div>
                        </div>
                    `;
                } else if (section.type === 'hero_slider') {
                    const slides = section.slides || [];
                    const displayType = section.heroType || 'slider';
                    
                    const slidesHTML = slides.map((s, si) => {
                        const previewId = `hero_slide_${index}_${si}_preview`;
                        const previewClass = s.image ? '' : 'empty';
                        const isVideo = s.image && (s.image.match(/\.(mp4|webm|ogg|mov)$/i) || s.image.includes('youtube.com') || s.image.includes('youtu.be'));
                        
                        let previewContent = '';
                        if (s.image) {
                            if (isVideo) {
                                if (s.image.includes('youtube.com') || s.image.includes('youtu.be')) {
                                    let ytId = '';
                                    if (s.image.includes('v=')) ytId = s.image.split('v=')[1].split('&')[0];
                                    else ytId = s.image.split('/').pop();
                                    previewContent = `<img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" style="width:100%; height:100%; object-fit:cover;">`;
                                } else {
                                    previewContent = `<video src="${s.image}" style="width:100%; height:100%; object-fit:cover;"></video>`;
                                }
                            } else {
                                previewContent = `<img src="${s.image}" style="width:100%; height:100%; object-fit:cover;">`;
                            }
                        }

                        return `
                        <div style="border:1px solid var(--border); border-radius:12px; padding:15px; background:#fff; margin-bottom:10px;">
                            <div style="display:grid; grid-template-columns: 100px 1fr; gap:15px; align-items:center; margin-bottom:10px;">
                                <div class="preview-box ${previewClass}" id="${previewId}" style="width:100%; height:70px; border-radius:10px; margin-bottom:0;">
                                    ${previewContent}
                                </div>
                                <div class="form-group" style="margin-bottom:0;">
                                    <label class="label-luxury" style="font-size:11px;">رابط الصورة أو الفيديو</label>
                                    <div style="display:flex; gap:5px;">
                                        <input type="text" id="hero_slide_${index}_${si}" value="${s.image || ''}" class="input-luxury" style="padding:8px; font-size:12px; flex:1;" oninput="homeSections[${index}].slides[${si}].image=this.value; updatePreview(this.value, '${previewId}'); serializeHomeSections();">
                                        <button type="button" class="btn btn-outline" style="padding:0 10px;" onclick="triggerUpload('hero_slide_${index}_${si}')"><i class="fas fa-upload"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                                <div class="form-group" style="margin-bottom:0;">
                                    <label class="label-luxury" style="font-size:11px;">العنوان</label>
                                    <input type="text" value="${s.title || ''}" class="input-luxury" style="padding:8px; font-size:12px;" oninput="homeSections[${index}].slides[${si}].title=this.value; serializeHomeSections();">
                                </div>
                                <div class="form-group" style="margin-bottom:0;">
                                    <label class="label-luxury" style="font-size:11px;">رابط الزر (اختياري)</label>
                                    <input type="text" value="${s.link || ''}" class="input-luxury" style="padding:8px; font-size:12px;" oninput="homeSections[${index}].slides[${si}].link=this.value; serializeHomeSections();">
                                </div>
                            </div>
                            <button type="button" class="btn btn-outline" style="width:100%; font-size:11px; color:red; border-color:#fee2e2; background:#fee2e2; padding:5px; margin-top:10px;" onclick="homeSections[${index}].slides.splice(${si},1); renderHomeSections(); serializeHomeSections();"><i class="fas fa-trash"></i> حذف الشريحة</button>
                        </div>
                    `;}).join('');

                    sectionContent = `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">نوع العرض</label>
                                <select class="input-luxury" style="padding:10px; font-size:13px;" onchange="homeSections[${index}].heroType=this.value; renderHomeSections(); serializeHomeSections();">
                                    <option value="slider" ${displayType === 'slider' ? 'selected' : ''}>شريط منزلق (Slider)</option>
                                    <option value="banner" ${displayType === 'banner' ? 'selected' : ''}>صورة ثابتة (Banner)</option>
                                    <option value="video" ${displayType === 'video' ? 'selected' : ''}>فيديو (Video)</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label class="label-luxury" style="font-size:12px;">سرعة التبديل (بالثانية)</label>
                                <input type="number" value="${section.speed || 5}" class="input-luxury" style="padding:10px; font-size:13px;" placeholder="مثلاً: 5" oninput="homeSections[${index}].speed=this.value; serializeHomeSections();">
                            </div>
                        </div>
                        ${displayType === 'video' ? `
                            <div class="form-group" style="margin-bottom:15px;">
                                <label class="label-luxury" style="font-size:12px;">رابط الفيديو (Direct URL or YouTube)</label>
                                <div style="display:flex; gap:5px;">
                                    <input type="text" id="hero_video_${index}" value="${section.videoUrl || ''}" class="input-luxury" style="padding:10px; font-size:13px;" placeholder="رابط الفيديو..." oninput="homeSections[${index}].videoUrl=this.value; serializeHomeSections();">
                                    <button type="button" class="btn btn-outline" style="padding:0 15px;" onclick="triggerUpload('hero_video_${index}')"><i class="fas fa-upload"></i></button>
                                </div>
                            </div>
                        ` : `
                            <div style="margin-bottom:10px;">
                                <label class="label-luxury" style="font-size:12px;">شرائح البنر (Slides)</label>
                                ${slidesHTML || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">لا يوجد شرائح. أضف شريحة الآن!</p>'}
                            </div>
                            <button type="button" class="btn btn-outline" style="width:100%; font-size:12px; padding:9px; border-style:dashed;" onclick="if(!homeSections[${index}].slides) homeSections[${index}].slides=[]; homeSections[${index}].slides.push({image:'', title:'', link:''}); renderHomeSections(); serializeHomeSections();">
                                <i class="fas fa-plus"></i> إضافة شريحة جديدة
                            </button>
                        `}
                    `;
                }

                return `
                    <div class="luxury-card section-card-item" data-type="${section.type}" style="padding: 0; border: 1px solid var(--border); border-radius: 16px; position:relative; background:#fff; margin-bottom:15px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); overflow:hidden; transition: 0.3s;">
                        <!-- Header -->
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:${getHeaderColor(section.type)}; border-bottom:1px solid rgba(0,0,0,0.05);">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; color:#fff;">
                                    <i class="${typeIcons[section.type]}" style="font-size:16px;"></i>
                                </div>
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:900; color:#fff; font-size:13px; line-height:1.2;">
                                        ${section.adminNote || typeLabels[section.type]}
                                    </span>
                                    <span style="font-size:10px; color:rgba(255,255,255,0.8); font-weight:700;">
                                        القسم #${index + 1} | ${typeLabels[section.type]}
                                    </span>
                                </div>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <button type="button" class="btn btn-outline" style="padding:4px 10px; font-size:11px; background:rgba(255,255,255,0.2); border-color:transparent; color:#fff; font-weight:900;" onclick="toggleSectionCollapse(${index})" title="${section.collapsed ? 'توسيع' : 'طي'}">
                                    <i class="fas ${section.collapsed ? 'fa-expand-alt' : 'fa-compress-alt'}"></i> ${section.collapsed ? 'توسيع' : 'طي'}
                                </button>
                                <div style="width:1px; background:rgba(255,255,255,0.2); margin:0 4px;"></div>
                                <button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px; background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); color:#fff;" onclick="moveHomeSectionUp(${index})" ${index === 0 ? 'disabled' : ''} title="تحريك للأعلى"><i class="fas fa-chevron-up"></i></button>
                                <button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px; background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); color:#fff;" onclick="moveHomeSectionDown(${index})" ${index === homeSections.length - 1 ? 'disabled' : ''} title="تحريك للأسفل"><i class="fas fa-chevron-down"></i></button>
                                <button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px; background:rgba(220,38,38,0.8); border-color:transparent; color:#fff;" onclick="removeHomeSection(${index})" title="حذف القسم"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        
                        <!-- Admin Note / Identifier -->
                        <div style="display: ${section.collapsed ? 'none' : 'block'}; padding:15px 20px 0 20px;">
                            <div class="form-group" style="margin-bottom:15px; background:#f8fafc; padding:10px; border-radius:10px; border:1px solid #edf2f7;">
                                <label class="label-luxury" style="font-size:11px; color:var(--primary); font-weight:900;"><i class="fas fa-tag"></i> مسمى القسم (لتمييزه في لوحة التحكم فقط)</label>
                                <input type="text" value="${section.adminNote || ''}" class="input-luxury" style="padding:8px; font-size:12px; margin-bottom:0; background:#fff;" placeholder="مثلاً: بنر العروض الصيفية، قسم الماركات العالمية..." oninput="homeSections[${index}].adminNote=this.value; renderHomeSections(); serializeHomeSections();">
                            </div>
                            <div style="border-top:1px dashed #e2e8f0; padding-top:15px; margin-top:5px;">
                                ${sectionContent}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function getHeaderColor(type) {
            const colors = {
                'hero_slider': '#ef4444',
                'marquee': '#10b981',
                'badges': '#3b82f6',
                'logo_marquee': '#ec4899',
                'static_features': '#0ea5e9',
                'text': '#6366f1',
                'banner': '#f59e0b',
                'new_arrivals': '#8b5cf6',
                'recommended_products': '#f43f5e',
                'category_products': '#14b8a6',
                'reels': '#f97316',
                'testimonials': '#a855f7'
            };
            return colors[type] || '#475569';
        }

        function addHomeSection(type) {
            const newSec = { id: 'sec_' + Date.now() + Math.random().toString(36).substr(2, 5), type: type };
            if (type === 'text') {
                newSec.title = '';
                newSec.subtitle = '';
                newSec.bgColor = '#f8fafc';
                newSec.textColor = '#0f172a';
                newSec.align = 'center';
                newSec.btnText = '';
                newSec.btnLink = '';
            } else if (type === 'banner') {
                newSec.image = '';
                newSec.link = '';
            } else if (type === 'new_arrivals') {
                newSec.title = 'وصل حديثاً ✨';
                newSec.limit = 8;
            } else if (type === 'coming_soon') {
                newSec.title = 'قريباً متاح ⏳';
                newSec.limit = 4;
            } else if (type === 'category_products') {
                newSec.categoryId = '';
                newSec.limit = 8;
            } else if (type === 'winning_product') {
                newSec.productId = '';
                newSec.title = '🔥 المنتج الرابح لهذا الأسبوع!';
                newSec.desc = '';
            } else if (type === 'video') {
                newSec.videoUrl = '';
            } else if (type === 'html') {
                newSec.htmlContent = '';
            } else if (type === 'recommended_products') {
                newSec.title = 'منتجات موصى بها ⭐';
                newSec.limit = 8;
            } else if (type === 'category_tabs') {
                newSec.title = 'أقسامنا الأكثر طلباً 🏷️';
                newSec.categoryIds = [];
                newSec.limit = 12;
            } else if (type === 'reels') {
                newSec.title = 'فيديوهات ريلز';
            } else if (type === 'testimonials') {
                newSec.title = 'آراء زبائننا ⭐';
                newSec.subtitle = 'ماذا يقول زبائننا عنا';
                newSec.reviews = [
                    { name: 'سارة محمد', rating: 5, text: 'تجربة تسوق رائعة! المنتجات عالية الجودة والتوصيل كان سريعاً جداً.', avatar: '' },
                    { name: 'أحمد خالد', rating: 5, text: 'خدمة ممتازة وأسعار منافسة، سأعود للطلب مرات كثيرة!', avatar: '' },
                    { name: 'منى العلي', rating: 5, text: 'بصراحة أفضل متجر تعاملت معه، ينصح به بشدة.', avatar: '' }
                ];
            } else if (type === 'marquee') {
                newSec.texts = ['شحن سريع لجميع المحافظات 🚚', 'أفضل المنتجات بأفضل الأسعار ✨'];
                newSec.bgColor = '#fa0000';
                newSec.textColor = '#ffffff';
            } else if (type === 'badges') {
                newSec.iconColor = '#fa0000';
                newSec.items = [
                    { icon: 'fa-truck-fast', text: 'توصيل سريع' },
                    { icon: 'fa-shield-halved', text: 'ضمان الجودة' },
                    { icon: 'fa-rotate-left', text: 'تبديل سهل' }
                ];
            } else if (type === 'logo_marquee') {
                newSec.logos = [];
                newSec.bgColor = '#ffffff';
            } else if (type === 'static_features') {
                newSec.iconColor = '#fa0000';
                newSec.bgColor = '#f8fafc';
                newSec.items = [
                    { icon: 'fa-truck', title: 'توصيل سريع', desc: 'لجميع المناطق' },
                    { icon: 'fa-shield-heart', title: 'ضمان الجودة', desc: 'منتجات أصلية 100%' },
                    { icon: 'fa-rotate', title: 'تبديل سهل', desc: 'خلال 14 يوم' }
                ];
            } else if (type === 'categories') {
                newSec.title = 'التصنيفات 🏷️';
                newSec.catStyle = 'grid';
                newSec.categoryIds = [];
            } else if (type === 'hero_slider') {
                newSec.slides = [
                    { image: '', title: '', link: '' }
                ];
            }

            homeSections.push(newSec);
            renderHomeSections();
            serializeHomeSections();
        }

        function removeHomeSection(index) {
            showCustomConfirm('هل أنت متأكد من حذف هذا القسم من الصفحة الرئيسية؟ لن تتمكن من استعادته إلا عند بنائه مجدداً.', () => {
                homeSections.splice(index, 1);
                renderHomeSections();
                serializeHomeSections();
            });
        }

        window.toggleSectionCollapse = function(index) {
            const section = homeSections[index];
            section.collapsed = !section.collapsed;
            
            // Save state to local storage
            const collapseStates = JSON.parse(localStorage.getItem('admin_sections_collapse') || '{}');
            collapseStates[section.id] = section.collapsed;
            localStorage.setItem('admin_sections_collapse', JSON.stringify(collapseStates));
            
            renderHomeSections();
        }

        function showCustomConfirm(message, onConfirm) {
            // Create modal elements
            const overlay = document.createElement('div');
            overlay.style = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                font-family: 'Tajawal', sans-serif;
            `;

            const modal = document.createElement('div');
            modal.style = `
                background: #ffffff;
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 450px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                text-align: center;
                border: 1px solid rgba(255,255,255,0.8);
            `;

            modal.innerHTML = `
                <div style="width: 70px; height: 70px; background: #fee2e2; color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 32px; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.2);">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #0f172a;">تأكيد الحذف</h3>
                <p style="margin: 0 0 25px 0; font-size: 15px; color: #64748b; line-height: 1.6;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="btn-confirm-yes" style="flex: 1; padding: 12px 20px; font-size: 15px; font-weight: 700; border-radius: 12px; border: none; background: #ef4444; color: #ffffff; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);">
                        نعم، احذف القسم
                    </button>
                    <button id="btn-confirm-no" style="flex: 1; padding: 12px 20px; font-size: 15px; font-weight: 700; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; cursor: pointer; transition: all 0.2s;">
                        إلغاء التراجع
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Trigger animations
            setTimeout(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1) translateY(0)';
            }, 10);

            // Event handlers
            const closeConfirm = (shouldConfirm) => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.9) translateY(20px)';
                setTimeout(() => {
                    if (shouldConfirm && typeof onConfirm === 'function') {
                        onConfirm();
                    }
                    overlay.remove();
                }, 300);
            };

            const btnYes = modal.querySelector('#btn-confirm-yes');
            const btnNo = modal.querySelector('#btn-confirm-no');

            btnYes.addEventListener('click', () => closeConfirm(true));
            btnNo.addEventListener('click', () => closeConfirm(false));

            // Hover effects
            btnYes.style.transition = 'all 0.2s';
            btnNo.style.transition = 'all 0.2s';

            btnYes.addEventListener('mouseenter', () => {
                btnYes.style.background = '#dc2626';
                btnYes.style.boxShadow = '0 6px 15px rgba(220, 38, 38, 0.3)';
            });
            btnYes.addEventListener('mouseleave', () => {
                btnYes.style.background = '#ef4444';
                btnYes.style.boxShadow = '0 4px 10px rgba(239, 68, 68, 0.2)';
            });

            btnNo.addEventListener('mouseenter', () => {
                btnNo.style.background = '#f1f5f9';
                btnNo.style.color = '#1e293b';
            });
            btnNo.addEventListener('mouseleave', () => {
                btnNo.style.background = '#f8fafc';
                btnNo.style.color = '#475569';
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeConfirm(false);
            });
        }

        function moveHomeSectionUp(index) {
            if(index > 0) {
                const temp = homeSections[index];
                homeSections[index] = homeSections[index - 1];
                homeSections[index - 1] = temp;
                renderHomeSections();
                serializeHomeSections();
            }
        }

        function moveHomeSectionDown(index) {
            if(index < homeSections.length - 1) {
                const temp = homeSections[index];
                homeSections[index] = homeSections[index + 1];
                homeSections[index + 1] = temp;
                renderHomeSections();
                serializeHomeSections();
            }
        }

        async function loadDistributors() {
            try {
                const distributors = await DB.getDistributors();
                const tbody = document.getElementById('distributorsBody');
                if(!tbody) return;
                tbody.innerHTML = distributors.map(d => `
                    <tr style="font-size: 13px;">
                        <td style="padding: 12px 15px;">
                            <div style="font-weight: 800; color: #1e293b;">${d.name}</div>
                            <div style="font-size: 11px; color: #64748b;">${d.email || ''}</div>
                        </td>
                        <td dir="ltr" style="font-weight: 600;">${d.phone}</td>
                        <td style="color: #475569;">${d.businessName || '-'}</td>
                        <td style="font-size: 11px; opacity: 0.7;">${new Date(d.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td>
                            <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; background: ${d.status === 'approved' ? '#f0fdf4' : d.status === 'rejected' ? '#fef2f2' : '#fffbeb'}; color: ${d.status === 'approved' ? '#166534' : d.status === 'rejected' ? '#991b1b' : '#92400e'}; border: 1px solid ${d.status === 'approved' ? '#bbf7d0' : d.status === 'rejected' ? '#fecaca' : '#fef3c7'};">
                                <i class="fas ${d.status === 'approved' ? 'fa-check-circle' : d.status === 'rejected' ? 'fa-times-circle' : 'fa-clock'}"></i>
                                ${d.status === 'approved' ? 'نشط' : d.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; gap: 5px;">
                                ${d.status === 'pending' ? `
                                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 11px; background: #10b981; border: none;" onclick="updateDistributorStatus('${d.id}', 'approved')"><i class="fas fa-check"></i> قبول</button>
                                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 11px; color: #ef4444; border-color: #fecaca;" onclick="updateDistributorStatus('${d.id}', 'rejected')"><i class="fas fa-times"></i> رفض</button>
                                ` : `
                                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 11px;" onclick="updateDistributorStatus('${d.id}', 'pending')"><i class="fas fa-undo"></i> إعادة للمراجعة</button>
                                `}
                            </div>
                        </td>
                    </tr>
                `).join('');
            } catch (e) { console.error('Distributors Load Error:', e); }
        }

        function updateDistributorStatus(id, status) {
            showConfirm('هل أنت متأكد من تغيير حالة هذا الموزع؟', async () => {
                try {
                    await DB.updateDistributorStatus(id, status);
                    loadDistributors();
                } catch (e) { alert('حدث خطأ'); }
            });
        }

        // --- Distributor Orders ---
        // --- Distributor Orders Pagination ---
        let distOrdersPage = 1;
        let distOrdersPerPage = 50;
        let distOrdersSearchTerm = '';
        let _distOrdersData = [];

        function getFilteredDistOrders() {
            if (!distOrdersSearchTerm) return _distOrdersData;
            const term = distOrdersSearchTerm.toLowerCase();
            return _distOrdersData.filter(o =>
                (o.customer?.name && o.customer.name.toLowerCase().includes(term)) ||
                (o.customerName && o.customerName.toLowerCase().includes(term)) ||
                (o.customer?.phone && o.customer.phone.toLowerCase().includes(term)) ||
                (o.customerPhone && o.customerPhone.toLowerCase().includes(term))
            );
        }

        function updateDistOrdersPaginationUI() {
            const filtered = getFilteredDistOrders();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / distOrdersPerPage));
            if (distOrdersPage > totalPages) distOrdersPage = totalPages;

            const pagination = document.getElementById('distOrdersPagination');
            if (!pagination) return;
            pagination.style.display = totalItems > 0 ? 'flex' : 'none';

            document.getElementById('distOrdersPaginationInfo').textContent = `إجمالي ${totalItems} طلب — صفحة ${distOrdersPage} من ${totalPages}`;

            const pageNav = document.getElementById('distOrdersPaginationPages');
            const firstBtn = document.getElementById('distOrdersPaginationFirst');
            const prevBtn = document.getElementById('distOrdersPaginationPrev');
            const nextBtn = document.getElementById('distOrdersPaginationNext');
            const lastBtn = document.getElementById('distOrdersPaginationLast');
            const showNav = totalPages > 1;
            [firstBtn, prevBtn, nextBtn, lastBtn, pageNav].forEach(el => { if (el) el.style.display = showNav ? '' : 'none'; });
            if (!showNav) return;

            let pagesHTML = '';
            const range = 2;
            const start = Math.max(1, distOrdersPage - range);
            const end = Math.min(totalPages, distOrdersPage + range);
            if (start > 1) {
                pagesHTML += `<button onclick="goToDistOrdersPage(1)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">1</button>`;
                if (start > 2) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
            }
            for (let p = start; p <= end; p++) {
                pagesHTML += `<button onclick="goToDistOrdersPage(${p})" style="padding:6px 10px;border:1px solid ${p === distOrdersPage ? 'var(--primary)' : 'var(--border)'};border-radius:6px;background:${p === distOrdersPage ? 'var(--primary)' : 'white'};cursor:pointer;font-size:12px;font-weight:${p === distOrdersPage ? '800' : '400'};color:${p === distOrdersPage ? 'white' : 'var(--gray-600)'};">${p}</button>`;
            }
            if (end < totalPages) {
                if (end < totalPages - 1) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
                pagesHTML += `<button onclick="goToDistOrdersPage(${totalPages})" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">${totalPages}</button>`;
            }
            pageNav.innerHTML = pagesHTML;

            firstBtn.style.opacity = distOrdersPage <= 1 ? '0.3' : '1';
            firstBtn.disabled = distOrdersPage <= 1;
            prevBtn.style.opacity = distOrdersPage <= 1 ? '0.3' : '1';
            prevBtn.disabled = distOrdersPage <= 1;
            nextBtn.style.opacity = distOrdersPage >= totalPages ? '0.3' : '1';
            nextBtn.disabled = distOrdersPage >= totalPages;
            lastBtn.style.opacity = distOrdersPage >= totalPages ? '0.3' : '1';
            lastBtn.disabled = distOrdersPage >= totalPages;
        }

        function goToDistOrdersPage(dest) {
            const filtered = getFilteredDistOrders();
            const totalPages = Math.max(1, Math.ceil(filtered.length / distOrdersPerPage));
            if (dest === 'first') distOrdersPage = 1;
            else if (dest === 'prev') distOrdersPage = Math.max(1, distOrdersPage - 1);
            else if (dest === 'next') distOrdersPage = Math.min(totalPages, distOrdersPage + 1);
            else if (dest === 'last') distOrdersPage = totalPages;
            else if (typeof dest === 'number') distOrdersPage = Math.max(1, Math.min(totalPages, dest));
            else distOrdersPage = 1;
            renderDistributorOrders();
        }

        function changeDistOrdersPerPage(val) {
            distOrdersPerPage = parseInt(val) || 50;
            distOrdersPage = 1;
            renderDistributorOrders();
        }

        function searchDistOrdersTable(input) {
            distOrdersSearchTerm = input.value;
            distOrdersPage = 1;
            renderDistributorOrders();
        }

        async function loadDistributorOrders() {
            try {
                const orders = await DB.getOrders();
                const distributors = await DB.getDistributors();
                window.storeDistributorsData = distributors;
                const approvedPhones = distributors.filter(d => d.status === 'approved').map(d => d.phone.replace(/\s+/g, ''));

                const distOrders = orders.filter(o => {
                    const isTagged = o.isWholesale === true || o.isWholesale === 'true' || o.distributorId;
                    const oPhone = (o.customer?.phone || o.customerPhone || '').replace(/\s+/g, '');
                    const phoneMatch = oPhone && approvedPhones.includes(oPhone);
                    return isTagged || phoneMatch;
                });

                _distOrdersData = distOrders;
                _distOrdersApprovedPhones = approvedPhones;
                distOrdersPage = 1;
                renderDistributorOrders();
            } catch (e) { console.error('Distributor Orders Error:', e); }
        }
        let _distOrdersApprovedPhones = [];

        function renderDistributorOrders() {
            const tbody = document.getElementById('distOrdersTableBody');
            if (!tbody) return;

            const filtered = getFilteredDistOrders();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / distOrdersPerPage));
            if (distOrdersPage > totalPages) distOrdersPage = totalPages;
            const start = (distOrdersPage - 1) * distOrdersPerPage;
            const end = Math.min(start + distOrdersPerPage, totalItems);
            const pageOrders = filtered.slice(start, end);

            if (pageOrders.length === 0 && totalItems === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">لا يوجد طلبات جملة حالياً</td></tr>';
                updateDistOrdersPaginationUI();
                return;
            }

            tbody.innerHTML = pageOrders.map(o => {
                const isWholesale = o.isWholesale === true || o.isWholesale === 'true' || o.distributorId || (_distOrdersApprovedPhones || []).includes((o.customer?.phone || '').replace(/\s+/g, ''));
                
                return `
                    <tr onclick="viewOrder('${o.id}')" style="cursor:pointer; font-size: 13px; ${isWholesale ? 'background-color: #fdfaf7;' : ''}" class="hover-row">
                        <td style="padding: 12px 15px;">
                            <div style="font-weight: 800; color: var(--primary);">#${o.id}</div>
                            ${isWholesale ? '<div style="background:#fff7ed; color:#c2410c; padding:1px 5px; border-radius:4px; font-size:9px; font-weight:900; border:1px solid #fdba74; display:inline-flex; align-items:center; gap:2px; margin-top:3px;"><i class="fas fa-store"></i> جملة</div>' : ''}
                        </td>
                        <td>
                            <div style="font-weight: 700; color: #1e293b;">${o.customer ? o.customer.name : (o.customerName || '—')}</div>
                            <div style="font-size: 11px; color: #64748b;">${o.customer ? o.customer.city : ''}</div>
                        </td>
                        <td dir="ltr" style="font-weight: 600; color: #475569;">${o.customer ? o.customer.phone : (o.customerPhone || '—')}</td>
                        <td style="color: var(--primary); font-weight: 900; font-size: 14px;">${parseFloat(o.total).toFixed(2)} ₪</td>
                        <td>
                            <span class="badge" style="background: ${o.status === 'مكتمل' ? '#f0fdf4' : '#fffbeb'}; color: ${o.status === 'مكتمل' ? '#166534' : '#92400e'}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: 1px solid ${o.status === 'مكتمل' ? '#bbf7d0' : '#fef3c7'};">
                                ${o.status}
                            </span>
                        </td>
                        <td style="font-size: 11px; opacity: 0.7;">${new Date(o.date || o.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td onclick="event.stopPropagation()">
                            <button class="btn btn-outline" style="padding: 5px 12px; font-size: 11px; border-radius: 8px;" onclick="viewOrder('${o.id}')">التفاصيل</button>
                        </td>
                    </tr>
                `;
            }).join('');
            updateDistOrdersPaginationUI();
        }

        // --- Products Pagination ---
        let productsPage = 1;
        let productsPerPage = 50;
        let productsSearchTerm = '';

        function getFilteredProducts() {
            if (!productsSearchTerm) return allProducts;
            const term = productsSearchTerm.toLowerCase();
            return allProducts.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.sku && p.sku.toLowerCase().includes(term))
            );
        }

        function updateProductsPaginationUI() {
            const filtered = getFilteredProducts();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / productsPerPage));
            if (productsPage > totalPages) productsPage = totalPages;

            const pagination = document.getElementById('productsPagination');
            if (!pagination) return;
            pagination.style.display = totalItems > 0 ? 'flex' : 'none';

            document.getElementById('productsPaginationInfo').textContent = `إجمالي ${totalItems} منتج — صفحة ${productsPage} من ${totalPages}`;

            const pageNav = document.getElementById('productsPaginationPages');
            const firstBtn = document.getElementById('productsPaginationFirst');
            const prevBtn = document.getElementById('productsPaginationPrev');
            const nextBtn = document.getElementById('productsPaginationNext');
            const lastBtn = document.getElementById('productsPaginationLast');
            const showNav = totalPages > 1;
            [firstBtn, prevBtn, nextBtn, lastBtn, pageNav].forEach(el => { if (el) el.style.display = showNav ? '' : 'none'; });
            if (!showNav) return;

            let pagesHTML = '';
            const range = 2;
            const start = Math.max(1, productsPage - range);
            const end = Math.min(totalPages, productsPage + range);
            if (start > 1) {
                pagesHTML += `<button onclick="goToProductsPage(1)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">1</button>`;
                if (start > 2) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
            }
            for (let p = start; p <= end; p++) {
                pagesHTML += `<button onclick="goToProductsPage(${p})" style="padding:6px 10px;border:1px solid ${p === productsPage ? 'var(--primary)' : 'var(--border)'};border-radius:6px;background:${p === productsPage ? 'var(--primary)' : 'white'};cursor:pointer;font-size:12px;font-weight:${p === productsPage ? '800' : '400'};color:${p === productsPage ? 'white' : 'var(--gray-600)'};">${p}</button>`;
            }
            if (end < totalPages) {
                if (end < totalPages - 1) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
                pagesHTML += `<button onclick="goToProductsPage(${totalPages})" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">${totalPages}</button>`;
            }
            pageNav.innerHTML = pagesHTML;

            firstBtn.style.opacity = productsPage <= 1 ? '0.3' : '1';
            firstBtn.disabled = productsPage <= 1;
            prevBtn.style.opacity = productsPage <= 1 ? '0.3' : '1';
            prevBtn.disabled = productsPage <= 1;
            nextBtn.style.opacity = productsPage >= totalPages ? '0.3' : '1';
            nextBtn.disabled = productsPage >= totalPages;
            lastBtn.style.opacity = productsPage >= totalPages ? '0.3' : '1';
            lastBtn.disabled = productsPage >= totalPages;
        }

        function goToProductsPage(dest) {
            const filtered = getFilteredProducts();
            const totalPages = Math.max(1, Math.ceil(filtered.length / productsPerPage));
            if (dest === 'first') productsPage = 1;
            else if (dest === 'prev') productsPage = Math.max(1, productsPage - 1);
            else if (dest === 'next') productsPage = Math.min(totalPages, productsPage + 1);
            else if (dest === 'last') productsPage = totalPages;
            else if (typeof dest === 'number') productsPage = Math.max(1, Math.min(totalPages, dest));
            else productsPage = 1;
            renderProductsTable();
        }

        function changeProductsPerPage(val) {
            productsPerPage = parseInt(val) || 50;
            productsPage = 1;
            renderProductsTable();
        }

        function searchProductsTable(input) {
            productsSearchTerm = input.value;
            productsPage = 1;
            renderProductsTable();
        }

        // --- Products Table Rendering ---
        function renderProductsTable() {
            const tbody = document.getElementById('productsTableBody') || document.querySelector('#productsTable tbody');
            if (!tbody) return;

            const filtered = getFilteredProducts();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / productsPerPage));
            if (productsPage > totalPages) productsPage = totalPages;
            const start = (productsPage - 1) * productsPerPage;
            const end = Math.min(start + productsPerPage, totalItems);
            const pageProducts = filtered.slice(start, end);

            const currency = '₪';
            tbody.innerHTML = pageProducts.map((p, index) => {
                const hasSale = p.salePrice && parseFloat(p.salePrice) > 0;
                const price = parseFloat(p.price) || 0;
                const salePrice = parseFloat(p.salePrice) || 0;
                const displayPrice = hasSale ? `<span style="text-decoration:line-through;color:#94a3b8;font-size:12px;margin-left:8px;">${salePrice} ₪</span>${price} ₪` : `${price} ₪`;
                const image = p.image || '';
                const isComingSoon = p.advanced && p.advanced.isComingSoon;
                const isHidden = p.advanced && p.advanced.hiddenProduct;
                const variantsCount = (p.variants || []).length;
                const stock = p.advanced && p.advanced.stock !== undefined && p.advanced.stock !== '' ? p.advanced.stock : '';
                let stockDisplay = '';
                let stockBg = '';
                let stockColor = '';
                if (stock === '') {
                    stockDisplay = '∞';
                    stockBg = '#f0fdf4';
                    stockColor = '#166534';
                } else if (stock === 0) {
                    stockDisplay = '0';
                    stockBg = '#fef2f2';
                    stockColor = '#dc2626';
                } else if (stock <= 5) {
                    stockDisplay = String(stock);
                    stockBg = '#fef2f2';
                    stockColor = '#dc2626';
                } else if (stock <= 15) {
                    stockDisplay = String(stock);
                    stockBg = '#fffbeb';
                    stockColor = '#d97706';
                } else {
                    stockDisplay = String(stock);
                    stockBg = '#f0fdf4';
                    stockColor = '#166534';
                }
                
                return `
                    <tr data-id="${p.id}" style="${isHidden ? 'opacity:0.5;background:#fef2f2;' : ''} ${isComingSoon ? 'background:#fff7ed;' : ''}">
                        <td style="text-align:center;"><input type="checkbox" class="product-checkbox" data-id="${p.id}" onchange="updateBulkActionsBar()" style="cursor:pointer;"></td>
                        <td style="text-align:center;">
                            ${image ? `<img src="${image}" alt="${p.name}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : '<div style="width:40px;height:40px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;margin:0 auto;"><i class="fas fa-image" style="color:#94a3b8;font-size:14px;"></i></div>'}
                        </td>
                        <td>
                            <div style="font-weight:700;">${p.name}</div>
                            <div style="font-size:11px;color:#94a3b8;">
                                ${isHidden ? '<span style="color:#ef4444;">🚫 مخفي</span> ' : ''}
                                ${isComingSoon ? '<span style="color:#f59e0b;">⏳ قريباً</span> ' : ''}
                                SKU: ${p.sku || '-'} ${variantsCount ? ` | ${variantsCount} خيارات` : ''}
                            </div>
                        </td>
                        <td style="text-align:center;"><span style="background:${stockBg}; color:${stockColor}; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:800; display:inline-block;">${stockDisplay}${stock === '' ? ' (بلا حد)' : stock === 0 ? ' نفدت' : stock <= 5 ? ' متبقي قليل!' : stock <= 15 ? ' متبقي' : ''}</span></td>
                        <td style="text-align:center;">${displayPrice}</td>
                        <td style="font-size:11px;text-align:center;opacity:0.7;">${p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-EG') : '—'}</td>
                        <td style="text-align:center;">
                            ${(p.categories || []).map(c => { const cat = allCategories.find(x => x.id == c); return `<span style="display:inline-block;background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;margin:2px;">${cat ? cat.name : c}</span>`; }).join(' ')}
                        </td>
                        <td style="text-align:center;">
                            <div style="display:flex;gap:5px;justify-content:center;">
                                <button class="btn btn-outline" onclick="openEditById('${p.id}')" style="padding:5px 10px;font-size:11px;" title="تعديل"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-outline" onclick="confirmDeleteProduct('${p.id}')" style="padding:5px 10px;font-size:11px;color:#ef4444;border-color:#fecaca;" title="حذف"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
}).join('');
            updateProductsPaginationUI();
        }

        // --- Bulk Selection Functions ---
        function toggleSelectAllProducts(masterCheckbox) {
            const checkboxes = document.querySelectorAll('.product-checkbox');
            checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
            updateBulkActionsBar();
        }

        function updateBulkActionsBar() {
            const checked = document.querySelectorAll('.product-checkbox:checked');
            const bar = document.getElementById('bulkActionsBar');
            const countEl = document.getElementById('selectedCount');
            if (!bar || !countEl) return;
            if (checked.length > 0) {
                bar.style.display = 'flex';
                countEl.textContent = `${checked.length} منتج محدد`;
            } else {
                bar.style.display = 'none';
            }
        }

        function getSelectedProductIds() {
            return Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => cb.dataset.id);
        }

        async function bulkDeleteProducts() {
            const ids = getSelectedProductIds();
            if (!ids.length) return;
            if (!confirm(`هل أنت متأكد من حذف ${ids.length} منتج؟`)) return;
            try {
                for (const id of ids) {
                    await DB.deleteProduct(id);
                }
                allProducts = allProducts.filter(p => !ids.includes(String(p.id)));
                renderProductsTable();
                updateBulkActionsBar();
                document.getElementById('selectAllProducts').checked = false;
                if (window.showToast) showToast(`تم حذف ${ids.length} منتج بنجاح`);
            } catch (e) {
                console.error('Bulk delete error:', e);
                if (window.showToast) showToast('حدث خطأ أثناء الحذف', 'error');
            }
        }

        async function bulkHideProducts(hide) {
            const ids = getSelectedProductIds();
            if (!ids.length) return;
            try {
                for (const id of ids) {
                    const product = allProducts.find(p => String(p.id) === String(id));
                    if (product) {
                        product.advanced = product.advanced || {};
                        product.advanced.hiddenProduct = hide;
                        await DB.saveProduct(product);
                    }
                }
                renderProductsTable();
                updateBulkActionsBar();
                document.getElementById('selectAllProducts').checked = false;
                if (window.showToast) showToast(hide ? `تم إخفاء ${ids.length} منتج` : `تم إظهار ${ids.length} منتج`);
            } catch (e) {
                console.error('Bulk hide error:', e);
                if (window.showToast) showToast('حدث خطأ', 'error');
            }
        }
        
        // --- Orders Table Rendering with Pagination ---
        let ordersPage = 1;
        let ordersPerPage = 50;

        function renderOrdersTable() {
            const tbody = document.getElementById('ordersTableBody') || document.querySelector('#ordersTable tbody');
            if (!tbody) return;

            if (window.storeOrdersData === undefined) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray-400);"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الطلبات...</td></tr>';
                DB.getOrders().then(orders => {
                    window.storeOrdersData = orders || [];
                    renderOrdersTable();
                }).catch(() => {
                    window.storeOrdersData = [];
                    renderOrdersTable();
                });
                return;
            }

            const orders = window.storeOrdersData;
            if (!orders.length) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray-400);">لا توجد طلبات بعد</td></tr>';
                document.getElementById('ordersPagination').style.display = 'none';
                return;
            }

            const totalItems = orders.length;
            const totalPages = Math.ceil(totalItems / ordersPerPage);
            if (ordersPage > totalPages) ordersPage = totalPages;
            if (ordersPage < 1) ordersPage = 1;

            const start = (ordersPage - 1) * ordersPerPage;
            const pageOrders = orders.slice(start, start + ordersPerPage);
            const globalStart = start;

            tbody.innerHTML = pageOrders.map((o, i) => {
                const cust = o.customer || {};
                const name = cust.name || o.customerName || '—';
                const phone = cust.phone || o.customerPhone || '—';
                const address = cust.city || cust.address || '—';
                const items = (o.items || []).map(i => `${i.name} x${i.quantity}`).join(', ');
                const total = parseFloat(o.total || 0).toFixed(2);
                const status = o.status || 'جديد';
                const date = new Date(o.date || o.createdAt).toLocaleDateString('ar-EG');
                const ipCountry = o.ipCountry || o.ip_country || '—';
                const filledFields = [name, phone, address, items, total].filter(f => f && f !== '—').length;
                const completion = Math.round((filledFields / 5) * 100);

                const statusColors = {
                    'مكتمل': { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
                    'جديد': { bg: '#fffbeb', color: '#92400e', border: '#fef3c7' },
                    'قيد التوصيل': { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
                    'ملغي': { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }
                };
                const sc = statusColors[status] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };

                return `
                    <tr data-id="${o.id}">
                        <td style="text-align:center;font-size:11px;">${globalStart + i + 1}</td>
                        <td>
                            <div style="font-weight:700;">${name}</div>
                            <div style="font-size:11px;color:#94a3b8;">${phone}</div>
                        </td>
                        <td style="font-size:12px;">${address}</td>
                        <td dir="ltr" style="font-weight:700;color:var(--primary);">${total} ₪</td>
                        <td style="text-align:center;">
                            <span style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.border};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;">${status}</span>
                        </td>
                        <td style="font-size:11px;">${ipCountry}</td>
                        <td style="text-align:center;">
                            <span style="display:inline-block;background:${completion >= 80 ? '#f0fdf4' : completion >= 50 ? '#fffbeb' : '#fef2f2'};color:${completion >= 80 ? '#166534' : completion >= 50 ? '#92400e' : '#991b1b'};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;">${completion}%</span>
                        </td>
                        <td style="font-size:11px;opacity:0.7;">${date}</td>
                        <td style="text-align:center;white-space:nowrap;">
                            <div style="display:inline-flex;gap:3px;align-items:center;justify-content:center;">
                                <button onclick="viewOrder('${o.id}')" style="width:28px;height:28px;font-size:11px;border-radius:6px;border:1px solid var(--border);background:var(--white);color:var(--primary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="التفاصيل"><i class="fas fa-eye"></i></button>
                                <select onchange="changeOrderStatus('${o.id}',this.value);this.selectedIndex=0;" style="height:28px;padding:0 6px;font-size:10px;border-radius:6px;border:1px solid var(--border);background:var(--white);color:#374151;font-weight:600;cursor:pointer;outline:none;" title="تغيير الحالة">
                                    <option value="" disabled selected>الحالة</option>
                                    <option value="جديد">جديد</option>
                                    <option value="قيد التوصيل">قيد التوصيل</option>
                                    <option value="مكتمل">مكتمل</option>
                                    <option value="ملغي">ملغي</option>
                                </select>
                                <button onclick="deleteStoreOrder('${o.id}')" style="width:28px;height:28px;font-size:11px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" title="حذف الطلب"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            updatePaginationUI(totalItems, totalPages);
        }

        function updatePaginationUI(totalItems, totalPages) {
            const pagination = document.getElementById('ordersPagination');
            if (!pagination) return;
            pagination.style.display = totalItems > 0 ? 'flex' : 'none';

            document.getElementById('paginationInfo').textContent = `إجمالي ${totalItems} طلب — صفحة ${ordersPage} من ${totalPages}`;

            const pageNav = document.getElementById('paginationPages');
            const firstBtn = document.getElementById('paginationFirst');
            const prevBtn = document.getElementById('paginationPrev');
            const nextBtn = document.getElementById('paginationNext');
            const lastBtn = document.getElementById('paginationLast');
            const showNav = totalPages > 1;
            [firstBtn, prevBtn, nextBtn, lastBtn, pageNav].forEach(el => { if (el) el.style.display = showNav ? '' : 'none'; });
            if (!showNav) return;

            let pagesHTML = '';
            const range = 2;
            const start = Math.max(1, ordersPage - range);
            const end = Math.min(totalPages, ordersPage + range);
            if (start > 1) {
                pagesHTML += `<button onclick="goToOrdersPage(1)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">1</button>`;
                if (start > 2) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
            }
            for (let p = start; p <= end; p++) {
                pagesHTML += `<button onclick="goToOrdersPage(${p})" style="padding:6px 10px;border:1px solid ${p === ordersPage ? 'var(--primary)' : 'var(--border)'};border-radius:6px;background:${p === ordersPage ? 'var(--primary)' : 'white'};cursor:pointer;font-size:12px;font-weight:${p === ordersPage ? '800' : '400'};color:${p === ordersPage ? 'white' : 'var(--gray-600)'};">${p}</button>`;
            }
            if (end < totalPages) {
                if (end < totalPages - 1) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
                pagesHTML += `<button onclick="goToOrdersPage(${totalPages})" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">${totalPages}</button>`;
            }
            pageNav.innerHTML = pagesHTML;

            firstBtn.style.opacity = ordersPage <= 1 ? '0.3' : '1';
            firstBtn.disabled = ordersPage <= 1;
            prevBtn.style.opacity = ordersPage <= 1 ? '0.3' : '1';
            prevBtn.disabled = ordersPage <= 1;
            nextBtn.style.opacity = ordersPage >= totalPages ? '0.3' : '1';
            nextBtn.disabled = ordersPage >= totalPages;
            lastBtn.style.opacity = ordersPage >= totalPages ? '0.3' : '1';
            lastBtn.disabled = ordersPage >= totalPages;
        }

        function goToOrdersPage(page) {
            const totalPages = Math.ceil((window.storeOrdersData || []).length / ordersPerPage);
            if (page === 'first') page = 1;
            else if (page === 'last') page = totalPages;
            else if (page === 'prev') page = Math.max(1, ordersPage - 1);
            else if (page === 'next') page = Math.min(totalPages, ordersPage + 1);
            else page = Math.max(1, Math.min(totalPages, Number(page)));
            if (page === ordersPage) return;
            ordersPage = page;
            renderOrdersTable();
        }

        function changeOrdersPerPage(val) {
            ordersPerPage = Number(val);
            ordersPage = 1;
            renderOrdersTable();
        }

        // --- Wholesale Prices Pagination ---
        let wholesalePage = 1;
        let wholesalePerPage = 50;
        let wholesaleSearchTerm = '';

        function getFilteredWholesale() {
            if (!wholesaleSearchTerm) return allProducts;
            const term = wholesaleSearchTerm.toLowerCase();
            return allProducts.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.sku && p.sku.toLowerCase().includes(term))
            );
        }

        function updateWholesalePaginationUI() {
            const filtered = getFilteredWholesale();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / wholesalePerPage));
            if (wholesalePage > totalPages) wholesalePage = totalPages;

            const pagination = document.getElementById('wholesalePagination');
            if (!pagination) return;
            pagination.style.display = totalItems > 0 ? 'flex' : 'none';

            document.getElementById('wholesalePaginationInfo').textContent = `إجمالي ${totalItems} منتج — صفحة ${wholesalePage} من ${totalPages}`;

            const pageNav = document.getElementById('wholesalePaginationPages');
            const firstBtn = document.getElementById('wholesalePaginationFirst');
            const prevBtn = document.getElementById('wholesalePaginationPrev');
            const nextBtn = document.getElementById('wholesalePaginationNext');
            const lastBtn = document.getElementById('wholesalePaginationLast');
            const showNav = totalPages > 1;
            [firstBtn, prevBtn, nextBtn, lastBtn, pageNav].forEach(el => { if (el) el.style.display = showNav ? '' : 'none'; });
            if (!showNav) return;

            let pagesHTML = '';
            const range = 2;
            const start = Math.max(1, wholesalePage - range);
            const end = Math.min(totalPages, wholesalePage + range);
            if (start > 1) {
                pagesHTML += `<button onclick="goToWholesalePage(1)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">1</button>`;
                if (start > 2) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
            }
            for (let p = start; p <= end; p++) {
                pagesHTML += `<button onclick="goToWholesalePage(${p})" style="padding:6px 10px;border:1px solid ${p === wholesalePage ? 'var(--primary)' : 'var(--border)'};border-radius:6px;background:${p === wholesalePage ? 'var(--primary)' : 'white'};cursor:pointer;font-size:12px;font-weight:${p === wholesalePage ? '800' : '400'};color:${p === wholesalePage ? 'white' : 'var(--gray-600)'};">${p}</button>`;
            }
            if (end < totalPages) {
                if (end < totalPages - 1) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
                pagesHTML += `<button onclick="goToWholesalePage(${totalPages})" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">${totalPages}</button>`;
            }
            pageNav.innerHTML = pagesHTML;

            firstBtn.style.opacity = wholesalePage <= 1 ? '0.3' : '1';
            firstBtn.disabled = wholesalePage <= 1;
            prevBtn.style.opacity = wholesalePage <= 1 ? '0.3' : '1';
            prevBtn.disabled = wholesalePage <= 1;
            nextBtn.style.opacity = wholesalePage >= totalPages ? '0.3' : '1';
            nextBtn.disabled = wholesalePage >= totalPages;
            lastBtn.style.opacity = wholesalePage >= totalPages ? '0.3' : '1';
            lastBtn.disabled = wholesalePage >= totalPages;
        }

        function goToWholesalePage(dest) {
            const filtered = getFilteredWholesale();
            const totalPages = Math.max(1, Math.ceil(filtered.length / wholesalePerPage));
            if (dest === 'first') wholesalePage = 1;
            else if (dest === 'prev') wholesalePage = Math.max(1, wholesalePage - 1);
            else if (dest === 'next') wholesalePage = Math.min(totalPages, wholesalePage + 1);
            else if (dest === 'last') wholesalePage = totalPages;
            else if (typeof dest === 'number') wholesalePage = Math.max(1, Math.min(totalPages, dest));
            else wholesalePage = 1;
            renderWholesalePricesTable();
        }

        function changeWholesalePerPage(val) {
            wholesalePerPage = parseInt(val) || 50;
            wholesalePage = 1;
            renderWholesalePricesTable();
        }

        function searchWholesaleTable(input) {
            wholesaleSearchTerm = input.value;
            wholesalePage = 1;
            renderWholesalePricesTable();
        }

        function loadWholesalePricesUI() {
            wholesalePage = 1;
            renderWholesalePricesTable();
        }

        function renderWholesalePricesTable() {
            const tbody = document.getElementById('wholesalePricesBody');
            if (!tbody) return;

            const filtered = getFilteredWholesale();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / wholesalePerPage));
            if (wholesalePage > totalPages) wholesalePage = totalPages;
            const start = (wholesalePage - 1) * wholesalePerPage;
            const end = Math.min(start + wholesalePerPage, totalItems);
            const pageProducts = filtered.slice(start, end);

            tbody.innerHTML = pageProducts.map(p => {
                const retail = parseFloat(p.price) || 0;
                const wholesale = parseFloat(p.wholesalePrice) || 0;
                const profit = retail - wholesale;
                
                return `
                    <tr data-id="${p.id}">
                        <td><img src="${p.image}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;"></td>
                        <td>
                            <div style="font-weight:700;">${p.name}</div>
                            <div style="font-size:10px; color:#94a3b8;">SKU: ${p.sku || '-'}</div>
                        </td>
                        <td>${retail} ₪</td>
                        <td>
                            <input type="number" class="input-luxury wholesale-input" value="${wholesale}" 
                                   style="width:100px; padding:6px; margin:0; text-align:center; border-color:var(--primary-light);"
                                   oninput="updateWholesaleProfitUI(this, ${retail})">
                        </td>
                        <td class="profit-cell" style="font-weight:700; color:${profit > 0 ? '#10b981' : '#ef4444'};">
                            ${profit} ₪
                        </td>
                    </tr>
                `;
            }).join('');
            updateWholesalePaginationUI();
        }

        function updateWholesaleProfitUI(input, retail) {
            const wholesale = parseFloat(input.value) || 0;
            const profitCell = input.closest('tr').querySelector('.profit-cell');
            const profit = retail - wholesale;
            profitCell.innerText = profit + ' ₪';
            profitCell.style.color = profit > 0 ? '#10b981' : '#ef4444';
        }

        async function saveAllWholesalePrices() {
            const rows = document.querySelectorAll('#wholesalePricesBody tr');
            const inputMap = {};
            rows.forEach(row => {
                const id = row.dataset.id;
                const val = row.querySelector('.wholesale-input')?.value;
                if (id && val !== undefined) inputMap[id] = val;
            });

            const updates = allProducts.map(p => ({
                id: p.id,
                wholesalePrice: inputMap[p.id] !== undefined ? inputMap[p.id] : (p.wholesalePrice || 0)
            }));

            try {
                const result = await DB.bulkUpdateWholesale(updates);
                if (result) {
                    showToast('✅ تم تحديث أسعار الجملة بنجاح');
                    allProducts = await DB.getProducts();
                }
            } catch (e) { showToast('❌ حدث خطأ أثناء الحفظ'); }
        }

        // Add event listener for wholesale tab
        document.querySelectorAll('.tab-link[data-target="tab-wholesale-prices"]').forEach(link => {
            link.addEventListener('click', () => loadWholesalePricesUI());
        });

        loadDistributors();
        loadCoupons();

        // Auto-load abandoned carts when tab is opened
        document.querySelectorAll('.tab-link[data-target="tab-abandoned"]').forEach(link => {
            link.addEventListener('click', () => setTimeout(loadAbandonedCarts, 300));
        });
        document.querySelectorAll('#nav-abandoned, [onclick*="tab-abandoned"]').forEach(el => {
            el.addEventListener('click', () => setTimeout(loadAbandonedCarts, 300));
        });

        // Auto-load coupons when tab is opened
        document.querySelectorAll('.tab-link[data-target="tab-coupons"]').forEach(link => {
            link.addEventListener('click', () => setTimeout(loadCoupons, 300));
        });

        // --- Coupons Management ---
        function openCreateCouponModal() {
            document.getElementById('couponForm').reset();
            document.getElementById('coupon_edit_mode').value = "";
            document.getElementById('coupon_old_code').value = "";
            document.getElementById('couponProductsChips').innerHTML = "";
            document.getElementById('coupon_productIds').value = "";
            document.getElementById('couponEditorTitle').innerText = "إنشاء كود خصم جديد";
            
            // تنظيف الرابط من أي باراميتر تعديل قديم
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('editCoupon');
            window.history.pushState({}, '', newUrl);

            switchTab('tab-coupon-editor');
        }

        function closeCouponModal() {
            // تنظيف الرابط عند الإلغاء
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('editCoupon');
            window.history.pushState({}, '', newUrl);
            
            switchTab('tab-coupons');
        }

        async function editCoupon(code) {
            try {
                const coupons = await DB.getCoupons();
                const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
                if(!coupon) return alert('الكوبون غير موجود');

                document.getElementById('coupon_code').value = coupon.code;
                document.getElementById('coupon_type').value = coupon.type;
                document.getElementById('coupon_value').value = coupon.value;
                document.getElementById('coupon_minOrder').value = coupon.minOrder || 0;
                document.getElementById('coupon_maxUses').value = coupon.maxUses || 0;
                document.getElementById('coupon_targetPhone').value = coupon.targetPhone || "";
                
                // تحميل المنتجات المشمولة
                const pIds = coupon.productIds || [];
                document.getElementById('coupon_productIds').value = JSON.stringify(pIds);
                renderCouponProductChips(pIds);

                document.getElementById('coupon_edit_mode').value = "true";
                document.getElementById('coupon_old_code').value = coupon.code;
                document.getElementById('couponEditorTitle').innerText = "تعديل كود الخصم: " + coupon.code;
                
                // تحديث الرابط ليعكس حالة التعديل
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('editCoupon', coupon.code);
                window.history.pushState({}, '', newUrl);

                switchTab('tab-coupon-editor');
            } catch(e) { console.error(e); }
        }

        function renderCouponProductChips(ids) {
            const container = document.getElementById('couponProductsChips');
            container.innerHTML = "";
            ids.forEach(id => {
                const chip = document.createElement('div');
                chip.style = "background:var(--primary-light); color:var(--primary); padding:4px 10px; border-radius:8px; font-size:11px; font-weight:800; display:flex; align-items:center; gap:5px;";
                chip.innerHTML = `ID: ${id} <i class="fas fa-times" style="cursor:pointer;" onclick="removeCouponProduct('${id}')"></i>`;
                container.appendChild(chip);
            });
        }

        window.removeCouponProduct = function(id) {
            let ids = JSON.parse(document.getElementById('coupon_productIds').value || "[]");
            ids = ids.filter(i => String(i) !== String(id));
            document.getElementById('coupon_productIds').value = JSON.stringify(ids);
            renderCouponProductChips(ids);
        };

        window.openCouponProductsSelector = async function() {
            // سنستخدم النافذة الموجودة أصلاً للعروض للحفاظ على خفة الكود
            // لكننا سنغير الـ 'onclick' الخاص بالزر في تلك النافذة مؤقتاً أو نستخدم حالة
            window.productSelectorTarget = 'coupon';
            openPromoProductsModal();
        };

        // تحديث وظيفة إغلاق النافذة (أو تأكيد الاختيار) في المودال العام للمنتجات
        const originalClosePromoProductsModal = window.closePromoProductsModal;
        window.closePromoProductsModal = function() {
             if (window.productSelectorTarget === 'coupon') {
                const checked = Array.from(document.querySelectorAll('#promoProductsCheckboxes input:checked')).map(i => i.value);
                document.getElementById('coupon_productIds').value = JSON.stringify(checked);
                renderCouponProductChips(checked);
                window.productSelectorTarget = null;
             }
             document.getElementById('promoProductsModal').style.display = 'none';
        };

        // --- Coupons Pagination ---
        let couponsPage = 1;
        let couponsPerPage = 50;
        let _couponsData = [];

        function getFilteredCoupons() {
            return _couponsData; // No search for now, simple pagination
        }

        function updateCouponsPaginationUI() {
            const filtered = getFilteredCoupons();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / couponsPerPage));
            if (couponsPage > totalPages) couponsPage = totalPages;

            const pagination = document.getElementById('couponsPagination');
            if (!pagination) return;
            pagination.style.display = totalItems > 0 ? 'flex' : 'none';

            document.getElementById('couponsPaginationInfo').textContent = `إجمالي ${totalItems} كوبون — صفحة ${couponsPage} من ${totalPages}`;

            const pageNav = document.getElementById('couponsPaginationPages');
            const firstBtn = document.getElementById('couponsPaginationFirst');
            const prevBtn = document.getElementById('couponsPaginationPrev');
            const nextBtn = document.getElementById('couponsPaginationNext');
            const lastBtn = document.getElementById('couponsPaginationLast');
            const showNav = totalPages > 1;
            [firstBtn, prevBtn, nextBtn, lastBtn, pageNav].forEach(el => { if (el) el.style.display = showNav ? '' : 'none'; });
            if (!showNav) return;

            let pagesHTML = '';
            const range = 2;
            const start = Math.max(1, couponsPage - range);
            const end = Math.min(totalPages, couponsPage + range);
            if (start > 1) {
                pagesHTML += `<button onclick="goToCouponsPage(1)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">1</button>`;
                if (start > 2) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
            }
            for (let p = start; p <= end; p++) {
                pagesHTML += `<button onclick="goToCouponsPage(${p})" style="padding:6px 10px;border:1px solid ${p === couponsPage ? 'var(--primary)' : 'var(--border)'};border-radius:6px;background:${p === couponsPage ? 'var(--primary)' : 'white'};cursor:pointer;font-size:12px;font-weight:${p === couponsPage ? '800' : '400'};color:${p === couponsPage ? 'white' : 'var(--gray-600)'};">${p}</button>`;
            }
            if (end < totalPages) {
                if (end < totalPages - 1) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
                pagesHTML += `<button onclick="goToCouponsPage(${totalPages})" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">${totalPages}</button>`;
            }
            pageNav.innerHTML = pagesHTML;

            firstBtn.style.opacity = couponsPage <= 1 ? '0.3' : '1';
            firstBtn.disabled = couponsPage <= 1;
            prevBtn.style.opacity = couponsPage <= 1 ? '0.3' : '1';
            prevBtn.disabled = couponsPage <= 1;
            nextBtn.style.opacity = couponsPage >= totalPages ? '0.3' : '1';
            nextBtn.disabled = couponsPage >= totalPages;
            lastBtn.style.opacity = couponsPage >= totalPages ? '0.3' : '1';
            lastBtn.disabled = couponsPage >= totalPages;
        }

        function goToCouponsPage(dest) {
            const filtered = getFilteredCoupons();
            const totalPages = Math.max(1, Math.ceil(filtered.length / couponsPerPage));
            if (dest === 'first') couponsPage = 1;
            else if (dest === 'prev') couponsPage = Math.max(1, couponsPage - 1);
            else if (dest === 'next') couponsPage = Math.min(totalPages, couponsPage + 1);
            else if (dest === 'last') couponsPage = totalPages;
            else if (typeof dest === 'number') couponsPage = Math.max(1, Math.min(totalPages, dest));
            else couponsPage = 1;
            renderCouponsTable();
        }

        function changeCouponsPerPage(val) {
            couponsPerPage = parseInt(val) || 50;
            couponsPage = 1;
            renderCouponsTable();
        }

        async function loadCoupons() {
            try {
                const coupons = await DB.getCoupons();
                _couponsData = coupons;
                couponsPage = 1;
                renderCouponsTable();
            } catch (e) { console.error('Coupons Load Error:', e); }
        }

        function renderCouponsTable() {
            const tbody = document.getElementById('couponsBody');
            if(!tbody) return;

            const filtered = getFilteredCoupons();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / couponsPerPage));
            if (couponsPage > totalPages) couponsPage = totalPages;
            const start = (couponsPage - 1) * couponsPerPage;
            const end = Math.min(start + couponsPerPage, totalItems);
            const pageCoupons = filtered.slice(start, end);

            if(pageCoupons.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
                            <i class="fas fa-ticket-alt" style="font-size:30px; margin-bottom:10px; opacity:0.5;"></i>
                            <p>لا يوجد كوبونات خصم حالياً. قم بإنشاء أول كوبون!</p>
                        </td>
                    </tr>
                `;
                updateCouponsPaginationUI();
                return;
            }

            tbody.innerHTML = pageCoupons.map(c => {
                const isRestricted = (c.targetPhone || (c.productIds && c.productIds.length > 0));
                const isExhausted = c.maxUses > 0 && (c.usedCount || 0) >= c.maxUses;
                const rowBg = isExhausted ? 'style="background:#fef2f2;opacity:0.7;"' : '';
                return `
                <tr ${rowBg}>
                    <td>
                        <strong>${c.code}</strong>
                        ${isExhausted ? '<span style="background:#ef4444;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px;margin-right:5px;">مستنفد</span>' : ''}
                        ${isRestricted ? '<i class="fas fa-lock" style="font-size:10px; color:#f59e0b; margin-right:5px;" title="مقيد برقم هاتف أو منتجات"></i>' : ''}
                    </td>
                    <td>${c.type === 'percentage' ? 'نسبة مئوية (%)' : 'مبلغ ثابت (₪)'}</td>
                    <td>${c.value} ${c.type === 'percentage' ? '%' : '₪'}</td>
                    <td>${c.minOrder || 0} ₪</td>
                    <td>${new Date(c.createdAt).toLocaleDateString('ar')}</td>
                    <td>
                        ${isExhausted
                          ? '<span style="color:#ef4444;font-weight:800;font-size:18px;">×</span>'
                          : `<span style="font-weight:bold;">${c.usedCount || 0}</span>`
                        }
                        <span style="color:#94a3b8; font-size:11px;"> / ${c.maxUses && c.maxUses > 0 ? c.maxUses : '∞'}</span>
                        ${isExhausted ? '<br><span style="color:#ef4444;font-size:10px;font-weight:700;">هذا الكوبون استُنفد بالفعل</span>' : ''}
                    </td>
                    <td>
                        <div style="display:flex; gap:5px;">
                            <button class="btn btn-outline" style="padding: 5px 10px; font-size: 12px; color: var(--primary); border-color: #e0e7ff; background: #e0e7ff;" onclick="editCoupon('${c.code}')"><i class="fas fa-edit"></i> تعديل</button>
                            <button class="btn btn-outline" style="padding: 5px 10px; font-size: 12px; color: red; border-color: #fee2e2; background: #fee2e2;" onclick="deleteCoupon('${c.code}')"><i class="fas fa-trash"></i> حذف</button>
                        </div>
                    </td>
                </tr>
            `}).join('');
            updateCouponsPaginationUI();
        }

        window.openCreateCouponModal = openCreateCouponModal;
        window.closeCouponModal = closeCouponModal;
        window.loadCoupons = loadCoupons;
        window.editCoupon = editCoupon;

        async function saveCoupon(e) {
            e.preventDefault();
            const isEdit = document.getElementById('coupon_edit_mode').value === "true";
            const oldCode = document.getElementById('coupon_old_code').value;
            
            const code = document.getElementById('coupon_code').value.trim();
            const type = document.getElementById('coupon_type').value;
            const value = document.getElementById('coupon_value').value;
            const minOrder = document.getElementById('coupon_minOrder').value;
            const maxUses = document.getElementById('coupon_maxUses').value;
            const targetPhone = document.getElementById('coupon_targetPhone').value.trim();
            const productIdsRaw = document.getElementById('coupon_productIds').value;
            const productIds = productIdsRaw ? JSON.parse(productIdsRaw) : [];

            try {
                const result = await DB.saveCoupon({ code, type, value, minOrder, maxUses, targetPhone, productIds });
                if(result) {
                    if (typeof showToast === 'function') showToast(isEdit ? '✅ تم تحديث الكوبون بنجاح' : '✅ تم حفظ الكوبون بنجاح');
                    else alert('تم حفظ العملية بنجاح');
                    closeCouponModal();
                    loadCoupons();
                } else {
                    alert('فشل حفظ الكوبون');
                }
            } catch(err) {
                alert('حدث خطأ أثناء الاتصال بالخادم');
            }
        }
        window.saveCoupon = saveCoupon;

        // --- Marketing Notifications ---
        function showNotifListView() {
            document.getElementById('notifListView').style.display = 'block';
            document.getElementById('notifCreateView').style.display = 'none';
            loadNotifications();
            // تنظيف الرابط
            const url = new URL(window.location);
            url.searchParams.delete('editNotif');
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url);
        }
        window.showNotifListView = showNotifListView;

        function showNotifCreateView() {
            document.getElementById('notif_edit_mode').value = "false";
            document.getElementById('notif_id').value = "";
            document.getElementById('notifEditorTitle').innerText = "إنشاء حملة إشعار جديدة";
            
            // تهيئة الحقول
            document.getElementById('notif_title').value = "";
            document.getElementById('notif_message').value = "";
            document.getElementById('notif_image').value = "";
            document.getElementById('notif_url').value = "";
            
            document.getElementById('notifListView').style.display = 'none';
            document.getElementById('notifCreateView').style.display = 'block';

            // تحديث المعاينة
            updateMainNotifPreview();

            // تحديث الرابط
            const url = new URL(window.location);
            url.searchParams.set('action', 'new');
            window.history.replaceState({}, '', url);
        }
        window.showNotifCreateView = showNotifCreateView;

        function updateMainNotifPreview() {
            const title = document.getElementById('notif_title')?.value;
            const message = document.getElementById('notif_message')?.value;
            const imageUrl = document.getElementById('notif_image')?.value;

            const titleEl = document.getElementById('mainPreviewNotifTitle');
            const msgEl = document.getElementById('mainPreviewNotifMessage');
            const imgEl = document.getElementById('mainPreviewNotifImage');
            const imgCont = document.getElementById('mainPreviewNotifImageContainer');

            if(titleEl) titleEl.innerText = title || "عنوان الإشعار";
            if(msgEl) msgEl.innerText = message || "محتوى الرسالة سيظهر هنا...";
            
            if(imgEl && imgCont) {
                if(imageUrl) {
                    imgEl.src = imageUrl;
                    imgCont.style.display = 'block';
                } else {
                    imgCont.style.display = 'none';
                }
            }
        }
        window.updateMainNotifPreview = updateMainNotifPreview;

        async function sendMarketingNotification() {
            const isEdit = document.getElementById('notif_edit_mode').value === "true";
            const id = document.getElementById('notif_id').value;
            
            const title = document.getElementById('notif_title').value;
            const message = document.getElementById('notif_message').value;
            const imageUrl = document.getElementById('notif_image').value;
            const url = document.getElementById('notif_url').value;
            const target = document.querySelector('input[name="notif_target"]:checked').value;
            const targetPhone = document.getElementById('notif_phone').value;

            if(!message) return alert('يرجى كتابة نص الرسالة');

            try {
                if(isEdit) {
                    const result = await DB.saveNotification({ id: parseInt(id), title, message, url, imageUrl, target, targetPhone });
                    if(result) {
                        showToast('✅ تم تحديث الحملة بنجاح');
                        showNotifListView();
                    } else {
                        alert('فشل معالجة الإشعار');
                    }
                } else {
                    const result = await DB.saveNotification({ title, message, url, imageUrl, target, targetPhone });
                    DB.trackEvent('notification_sent');
                    if(result) {
                        showToast('🚀 تم إطلاق الحملة بنجاح');
                        showNotifListView();
                    } else {
                        alert('فشل معالجة الإشعار');
                    }
                }
            } catch(e) {
                alert('حدث خطأ في الاتصال');
            }
        }
        window.sendMarketingNotification = sendMarketingNotification;

        async function editNotification(id) {
            try {
                const notifications = await DB.getNotifications();
                const n = notifications.find(x => x.id === id);
                if(!n) return;

                document.getElementById('notif_edit_mode').value = "true";
                document.getElementById('notif_id').value = n.id;
                document.getElementById('notifEditorTitle').innerText = "تعديل الحملة: " + n.title;

                document.getElementById('notif_title').value = n.title;
                document.getElementById('notif_message').value = n.message;
                document.getElementById('notif_image').value = n.imageUrl || '';
                document.getElementById('notif_url').value = n.url || '';
                
                // اختيار الفئة
                const radio = document.querySelector(`input[name="notif_target"][value="${n.target}"]`);
                if(radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                }
                if(n.target === 'specific') document.getElementById('notif_phone').value = n.targetPhone || '';

                document.getElementById('notifListView').style.display = 'none';
                document.getElementById('notifCreateView').style.display = 'block';

                const url = new URL(window.location);
                url.searchParams.set('editNotif', n.id);
                url.searchParams.delete('action');
                window.history.replaceState({}, '', url);

                // تحديث المعاينة الحية
                updateMainNotifPreview();
            } catch(e) { console.error(e); }
        }
        window.editNotification = editNotification;

        async function loadNotifications() {
            try {
                const notifications = await DB.getNotifications();
                const tbody = document.getElementById('notifBody');
                if(!tbody) return;

                if(notifications.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">لا يوجد سجل حملات حتى الآن.</td></tr>';
                    return;
                }

                tbody.innerHTML = notifications.reverse().map(n => `
                    <tr>
                        <td style="width:60px;">
                            ${n.imageUrl ? `<img src="${n.imageUrl}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">` : `<div style="width:50px; height:50px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#cbd5e1;"><i class="fas fa-image"></i></div>`}
                        </td>
                        <td>
                            <div style="font-weight:800; color:var(--primary);">${n.title}</div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${n.message.substring(0, 50)}...</div>
                        </td>
                        <td>
                            <span style="background:#f1f5f9; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:700;">
                                ${getTargetLabel(n.target)} ${n.targetPhone ? ': ' + n.targetPhone : ''}
                            </span>
                        </td>
                        <td style="font-size:12px;">${new Date(n.sentAt).toLocaleString('ar')}</td>
                        <td>
                            <span style="font-weight:900; color:#10b981;"><i class="fas fa-eye"></i> ${n.views || 0}</span>
                        </td>
                        <td>
                            <div style="display:flex; gap:5px;">
                                <button class="btn btn-outline" style="padding:5px 10px; font-size:12px;" onclick="editNotification(${n.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-outline" style="color:red; border-color:#fee2e2; background:#fee2e2; padding:5px 10px; font-size:12px;" onclick="deleteNotification(${n.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            } catch(e) { console.error('Load Notifs Error:', e); }
        }
        window.loadNotifications = loadNotifications;

        function getTargetLabel(t) {
            if(t === 'all') return 'الكل';
            if(t === 'merchants') return 'التجار';
            if(t === 'users') return 'الزبائن';
            if(t === 'specific') return 'رقم محدد';
            return t;
        }

        async function deleteNotification(id) {
            if(!confirm('هل أنت متأكد من حذف هذا الإشعار من السجل؟')) return;
            try {
                const result = await DB.deleteNotification(id);
                if(result) {
                    showToast('🗑️ تم حذف الإشعار من السجل');
                    loadNotifications();
                }
            } catch(e) { alert('فشل الحذف'); }
        }
        window.deleteNotification = deleteNotification;

        // --- Marketing Notification Templates ---
        let selectedTemplate = null;
        const notificationTemplates = {
            'discount_40': {
                title: "خصم 40% لفترة محدودة! 🔥",
                message: "استمتع بأكبر خصم لهذا الموسم! 40% خصم فوري على جميع المنتجات عند استخدام الكود الخاص بك. اطلب الآن قبل نفاذ الكمية!"
            },
            'welcome_new': {
                title: "أهلاً بك في عالمنا المميز 💙",
                message: "سعداء جداً بانضمامك إلينا. إليك هدية ترحيبية: خصم 15% على طلبك الأول. اكتشف تشكيلتنا الواسعة وابدأ التسوق الآن!"
            },
            'new_season': {
                title: "وصل حديثاً: تشكيلة الموسم 🌟",
                message: "جدد إطلالتك مع أحدث التصاميم التي وصلتنا للتو. قطع فريدة وحصرية بانتظارك. تصفح التشكيلة الجديدة الآن!"
            },
            'flash_sale': {
                title: "عرض فلاش! ⚡️ 3 ساعات فقط",
                message: "أسعار مجنونة لفترة محدودة جداً! خصومات تصل إلى 60% على قطع مختارة. لا تضيع الوقت، التسوق يبدأ الآن!"
            },
            'restock': {
                title: "عادت من جديد! 📦 المنتجات المفضلة",
                message: "بناءً على طلبكم، قمنا بإعادة توفير المنتجات الأكثر مبيعاً في المتجر. اطلبها الآن قبل أن تنتهي الكمية مرة أخرى!"
            },
            'loyalty_gift': {
                title: "شكراً لوفائك.. هدية بانتظارك 🎁",
                message: "نقدر اختيارك الدائم لنا. كشكر خاص، أضفنا خصم 20% لحسابك لطلبك القادم. نحن سعيدون بخدمتك دائماً!"
            },
            'abandoned_cart': {
                title: "نسيت شيئاً جميلاً في سلتك؟ 🛒",
                message: "منتجاتك المفضلة لا تزال بانتظارك. أكمل طلبك الآن واحصل على شحن مجاني باستخدام كود: FREE-SHIP"
            },
            'weekend_deal': {
                title: "عروض نهاية الأسبوع الرائعة 🎈",
                message: "اجعل عطلتك أكثر متعة مع عروضنا الخاصة! خصومات 25% على جميع الإكسسوارات والملحقات. العرض ينتهي الأحد."
            },
            'app_exclusive': {
                title: "كود حصري لمستخدمي التطبيق ✨",
                message: "لأنكم مميزون، إليكم كود خصم إضافي 10% يعمل فقط عبر التطبيق أو المتجر الإلكتروني. تسوقوا بذكاء ووفروا أكثر!"
            },
            'holiday_joy': {
                title: "شاركنا فرحة العيد مع عروضنا 🌙",
                message: "كل عام وأنتم بخير. بمناسبة العيد، استمتعوا بتخفيضات كبرى وهدايا مع كل طلب تزيد قيمته عن 300 ريال."
            },
            'white_friday': {
                title: "الجمعة البيضاء وصلت! ⚪️ الأقوى في السنة",
                message: "لا تنتظر! أقوى عروض العام بدأت الآن بخصومات تصل إلى 70%. الكميات تنفد بسرعة الصاروخ، احصل على طلبك الآن!",
                imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=800&auto=format&fit=crop"
            },
            'valentine': {
                title: "هدية تعبر عن حبك.. بخصم خاص ❤️",
                message: "اجعل هذا اليوم مميزاً لمن تحب. اختر من تشكيلتنا المختارة للهدايا واحصل على تغليف مجاني وخصم 20% بكود: LOVE",
                imageUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800&auto=format&fit=crop"
            },
            'ramadan': {
                title: "مبارك عليكم الشهر.. عروض رمضان الخير 🌙",
                message: "رمضان يجمعنا بالخير. استمتع بعروضنا الحصرية على مستلزمات الشهر الكريم وتجهيزات الإفطار بأسعار مميزة جداً.",
                imageUrl: "https://images.unsplash.com/photo-1564507592333-c60657eea223?q=80&w=800&auto=format&fit=crop"
            },
            'eid_arafah': {
                title: "عروض العشر من ذي الحجة ويوم عرفة 🕋",
                message: "بمناسبة الأيام المباركة، نهديك خصومات خاصة لكل العائلة. كل عام وأنتم بخير وتقبل الله منا ومنكم صالح الأعمال.",
                imageUrl: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=800&auto=format&fit=crop"
            },
            'new_year': {
                title: "سنة جديدة.. بداية سعيدة وعروض متجددة 🎆",
                message: "نستقبل العام الجديد معكم بأقوى التخفيضات! ابدأ سنتك بقطع جديدة ومميزة بخصم 30% على كل شيء في المتجر.",
                imageUrl: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?q=80&w=800&auto=format&fit=crop"
            },
            'weekly_friday': {
                title: "جمعة مباركة.. عروض الويكند بدأت 🕌",
                message: "نصلي على النبي ونبدأ عروضنا الأسبوعية! خصم خاص ليوم الجمعة فقط على الأقسام المختارة. تسوق ممتع!",
                imageUrl: "https://images.unsplash.com/photo-1598425237654-4fc758e50a93?q=80&w=800&auto=format&fit=crop"
            }
        };

        // --- Custom Templates Logic ---
        async function saveAsCustomTemplate() {
            const title = document.getElementById('notif_title').value;
            const message = document.getElementById('notif_message').value;
            if(!title || !message) return alert("يرجى كتابة عنوان ورسالة لحفظها كقالب");

            try {
                const result = await DB.saveCustomTemplate({ title, message });
                if(result) {
                    showToast('⭐ تم حفظ القالب في مكتبتك الخاصة');
                }
            } catch(e) { console.error(e); }
        }
        window.saveAsCustomTemplate = saveAsCustomTemplate;

        async function loadCustomTemplates() {
            try {
                const templates = await DB.getCustomTemplates();
                const container = document.getElementById('customTemplatesList');
                const area = document.getElementById('customTemplatesArea');
                
                if(templates.length === 0) {
                    area.style.display = 'none';
                    return;
                }

                area.style.display = 'block';
                container.innerHTML = templates.map(t => `
                    <div style="display:flex; gap:5px; align-items:center;">
                        <button class="template-btn" style="flex-grow:1;" onclick="previewCustomTemplate(${t.id})">
                            <i class="fas fa-star" style="color:#f97316;"></i> ${t.title}
                        </button>
                        <button class="btn btn-outline" style="color:red; border-color:#fee2e2; padding:10px;" onclick="deleteCustomTemplate(${t.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('');

                // نضع القوالب المخصصة في الذاكرة للمعاينة
                window.myCustomTemplates = templates;
            } catch(e) { console.error(e); }
        }
        window.loadCustomTemplates = loadCustomTemplates;

        function previewCustomTemplate(id) {
            const t = (window.myCustomTemplates || []).find(x => x.id === id);
            if(t) {
                selectedTemplate = t;
                document.getElementById('previewNotifTitle').innerText = t.title;
                document.getElementById('previewNotifMessage').innerText = t.message;
                document.getElementById('useTemplateBtn').style.display = 'inline-block';
            }
        }
        window.previewCustomTemplate = previewCustomTemplate;

        async function deleteCustomTemplate(id) {
            if(!confirm("هل تريد حذف هذا القالب المخصص؟")) return;
            try {
                await DB.deleteCustomTemplate(id);
                loadCustomTemplates();
            } catch(e) { console.error(e); }
        }
        window.deleteCustomTemplate = deleteCustomTemplate;

        // تحديث فتح النافذة لجلب القوالب المخصصة
        function openNotifTemplatesModal() {
            document.getElementById('notifTemplatesModal').style.display = 'flex';
            document.getElementById('previewNotifTitle').innerText = "عنوان الإشعار";
            document.getElementById('previewNotifMessage').innerText = "محتوى الرسالة سيظهر هنا...";
            document.getElementById('useTemplateBtn').style.display = 'none';
            loadCustomTemplates();
        }
        window.openNotifTemplatesModal = openNotifTemplatesModal;

        function closeNotifTemplatesModal() {
            document.getElementById('notifTemplatesModal').style.display = 'none';
        }
        window.closeNotifTemplatesModal = closeNotifTemplatesModal;

        function previewNotifTemplate(type) {
            const t = notificationTemplates[type];
            if(t) {
                selectedTemplate = t;
                const titleEl = document.getElementById('previewNotifTitle');
                const msgEl = document.getElementById('previewNotifMessage');
                
                titleEl.innerText = t.title;
                msgEl.innerText = t.message;
                
                document.getElementById('useTemplateBtn').style.display = 'inline-block';
            }
        }
        window.previewNotifTemplate = previewNotifTemplate;

        function confirmTemplate() {
            if(selectedTemplate) {
                document.getElementById('notif_title').value = selectedTemplate.title;
                document.getElementById('notif_message').value = selectedTemplate.message;
                document.getElementById('notif_image').value = selectedTemplate.imageUrl || '';
                showToast('✨ تم تطبيق القالب بنجاح مع الصورة');
                closeNotifTemplatesModal();
                updateMainNotifPreview();
            }
        }
        window.confirmTemplate = confirmTemplate;

        // --- Smart Link Picker Logic ---
        function setLinkType(type) {
            document.getElementById('link_custom_area').style.display = (type === 'custom') ? 'block' : 'none';
            document.getElementById('link_pages_area').style.display = (type === 'pages') ? 'block' : 'none';
            document.getElementById('link_selected_info').style.display = (type !== 'custom' && type !== 'pages') ? 'block' : 'none';
            
            if(type === 'custom') document.getElementById('notif_url').focus();
        }
        window.setLinkType = setLinkType;

        async function openLinkProductSelector(forImage = false) {
            try {
                const products = await DB.getProducts();
                
                let html = '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; max-height:450px; overflow-y:auto; padding:5px;">';
                products.forEach(p => {
                    html += `
                        <div class="product-link-card" style="border:1px solid #e2e8f0; border-radius:15px; overflow:hidden; transition:0.3s; background:white;">
                            <img src="${p.image || '/img/no-image.png'}" style="width:100%; height:120px; object-fit:cover; border-bottom:1px solid #f1f5f9;">
                            <div style="padding:10px;">
                                <div style="font-size:12px; font-weight:800; color:#1e293b; margin-bottom:5px; height:34px; overflow:hidden;">${p.name}</div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:11px; color:var(--primary); font-weight:900;">${p.price} ₪</span>
                                    <button class="btn btn-primary" style="padding:4px 12px; font-size:11px;" onclick="${forImage ? `selectNotifImage('${p.image}')` : `selectLinkProduct(${p.id}, '${p.name}')`}">
                                        ${forImage ? 'اختيار الصورة' : 'اختيار المنتج'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                
                showLinkSelectorModal(forImage ? "اختر صورة منتج للإشعار" : "اختر منتجاً للاستهداف", html, true);
            } catch(e) { console.error(e); }
        }
        window.openLinkProductSelector = openLinkProductSelector;

        async function openLinkCategorySelector() {
            try {
                const categories = await DB.getCategories();
                
                let html = '<div style="display:flex; flex-direction:column; gap:10px; max-height:400px; overflow-y:auto;">';
                categories.forEach(c => {
                    html += `
                        <div style="padding:15px; border-radius:12px; border:1px solid #e2e8f0; background:white; display:flex; justify-content:space-between; align-items:center; transition:0.3s;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:35px; height:35px; background:var(--primary-light); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--primary);">
                                    <i class="fas fa-folder"></i>
                                </div>
                                <span style="font-size:14px; font-weight:800; color:#1e293b;">${c.name}</span>
                            </div>
                            <button class="btn btn-primary" style="padding:6px 20px; font-size:12px;" onclick="selectLinkCategory('${c.id}', '${c.name}')">اختيار</button>
                        </div>
                    `;
                });
                html += '</div>';
                
                showLinkSelectorModal("اختر تصنيفاً للاستهداف", html, false);
            } catch(e) { console.error(e); }
        }
        window.openLinkCategorySelector = openLinkCategorySelector;

        async function openLinkPageSelector() {
            const pages = [
                { name: "الصفحة الرئيسية", path: "/", icon: "fa-home" },
                { name: "صفحة العروض الموسمية", path: "/?app=promotions", icon: "fa-fire" },
                { name: "كوبونات الخصم", path: "/?app=coupons", icon: "fa-ticket-alt" },
                { name: "سلة المشتريات", path: "/?app=cart", icon: "fa-shopping-cart" },
                { name: "المفضلة", path: "/?app=wishlist", icon: "fa-heart" },
                { name: "تتبع الطلبات", path: "/account?tab=orders", icon: "fa-box" },
                { name: "إعدادات الحساب", path: "/account?tab=profile", icon: "fa-user-cog" }
            ];
            
            let html = '<div style="display:flex; flex-direction:column; gap:10px; max-height:400px; overflow-y:auto;">';
            pages.forEach(p => {
                html += `
                    <div style="padding:15px; border-radius:12px; border:1px solid #e2e8f0; background:white; display:flex; justify-content:space-between; align-items:center; transition:0.3s; cursor:pointer;" onclick="selectLinkPage('${p.path}', '${p.name}')">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:40px; height:40px; background:var(--primary-light); border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--primary); font-size:18px;">
                                <i class="fas ${p.icon}"></i>
                            </div>
                            <span style="font-size:15px; font-weight:800; color:#1e293b;">${p.name}</span>
                        </div>
                        <i class="fas fa-chevron-left" style="color:var(--text-muted); font-size:12px;"></i>
                    </div>
                `;
            });
            html += '</div>';
            
            showLinkSelectorModal("اختر صفحة للتوجه إليها", html, false);
        }
        window.openLinkPageSelector = openLinkPageSelector;

        function selectLinkPage(path, name) {
            document.getElementById('notif_url').value = path;
            document.getElementById('link_label').innerText = `صفحة: ${name}`;
            document.getElementById('link_selected_info').style.display = 'block';
            closeLinkSelectorModal();
        }
        window.selectLinkPage = selectLinkPage;

        function selectLinkProduct(id, name) {
            document.getElementById('notif_url').value = `/?product=${id}`;
            document.getElementById('link_label').innerText = `منتج: ${name}`;
            document.getElementById('link_selected_info').style.display = 'block';
            closeLinkSelectorModal();
        }
        window.selectLinkProduct = selectLinkProduct;

        function selectLinkCategory(id, name) {
            document.getElementById('notif_url').value = `/?category=${id}`;
            document.getElementById('link_label').innerText = `تصنيف: ${name}`;
            document.getElementById('link_selected_info').style.display = 'block';
            closeLinkSelectorModal();
        }
        window.selectLinkCategory = selectLinkCategory;

        // دوال مساعدة للمودال السريع
        function showLinkSelectorModal(title, content, isLarge = false) {
            let m = document.getElementById('linkSelectorModal');
            if(!m) {
                m = document.createElement('div');
                m.id = 'linkSelectorModal';
                m.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);";
                m.innerHTML = `
                    <div id="linkSelectorBox" style="background:#f8fafc; border-radius:25px; padding:30px; box-shadow:var(--shadow-2xl); border:1px solid rgba(255,255,255,0.3); animation:popIn 0.3s;">
                        <h3 id="linkSelectorTitle" style="margin-bottom:25px; font-weight:900; color:var(--primary); text-align:center;"></h3>
                        <div id="linkSelectorContent"></div>
                        <button class="btn btn-outline" style="width:100%; margin-top:25px; border-radius:12px;" onclick="closeLinkSelectorModal()">إلغاء وإغلاق</button>
                    </div>
                `;
                document.body.appendChild(m);
            }
            document.getElementById('linkSelectorBox').style.width = isLarge ? '600px' : '400px';
            document.getElementById('linkSelectorTitle').innerText = title;
            document.getElementById('linkSelectorContent').innerHTML = content;
            m.style.display = 'flex';
        }
        function closeLinkSelectorModal() {
            document.getElementById('linkSelectorModal').style.display = 'none';
        }
        window.closeLinkSelectorModal = closeLinkSelectorModal;

        async function uploadNotifImage(input) {
            if (!input.files || !input.files[0]) return;
            
            const file = input.files[0];
            const formData = new FormData();
            formData.append('image', file);

            try {
                showToast('⏳ جاري رفع الصورة...');
                const res = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await res.json();
                if(data.success) {
                    document.getElementById('notif_image').value = data.data.url;
                    showToast('✅ تم رفع الصورة بنجاح');
                    
                    // تحديث المعاينة الرئيسية
                    updateMainNotifPreview();
                } else {
                    alert(data.error || 'فشل الرفع');
                }
            } catch(e) { console.error(e); alert('خطأ أثناء الرفع'); }
        }
        window.uploadNotifImage = uploadNotifImage;

        function selectNotifImage(imageUrl) {
            const input = document.getElementById('notif_image');
            if(input) {
                input.value = imageUrl;
                showToast('✨ تم اختيار صورة المنتج بنجاح');
                closeLinkSelectorModal();
                
                // تحديث المعاينة الرئيسية
                updateMainNotifPreview();
            }
        }
        window.selectNotifImage = selectNotifImage;

        async function sendMarketingNotification() {
            const isEdit = document.getElementById('notif_edit_mode').value === "true";
            const id = document.getElementById('notif_id').value;
            
            const title = document.getElementById('notif_title').value;
            const message = document.getElementById('notif_message').value;
            const imageUrl = document.getElementById('notif_image').value;
            const url = document.getElementById('notif_url').value;
            const target = document.querySelector('input[name="notif_target"]:checked').value;
            const targetPhone = document.getElementById('notif_phone').value;

            if(!message) return alert('يرجى كتابة نص الرسالة');

            try {
                if(isEdit) {
                    const result = await DB.saveNotification({ id: parseInt(id), title, message, url, imageUrl, target, targetPhone });
                    if(result) {
                        const successMsg = '✅ تم تحديث الحملة وإعادة إطلاقها';
                        showToast(successMsg);
                        showNotifListView();
                    } else {
                        alert('فشل معالجة الإشعار');
                    }
                } else {
                    const result = await DB.saveNotification({ title, message, url, imageUrl, target, targetPhone });
                    DB.trackEvent('notification_sent');
                    if(result) {
                        const successMsg = '🚀 تم إطلاق الحملة وإرسال الإشعارات';
                        showToast(successMsg);
                        showNotifListView();
                    } else {
                        alert('فشل معالجة الإشعار');
                    }
                }
            } catch(e) { 
                console.error(e);
                alert('حدث خطأ في الاتصال بالخادم'); 
            }
        }
        window.sendMarketingNotification = sendMarketingNotification;

        // تبديل ظهور حقل الهاتف
        document.querySelectorAll('input[name="notif_target"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const area = document.getElementById('specific_phone_area');
                if(area) area.style.display = (e.target.value === 'specific') ? 'block' : 'none';
            });
        });

        function deleteCoupon(code) {
            if (confirm(`هل أنت متأكد من حذف كود الخصم "${code}"؟`)) {
                DB.deleteCoupon(code)
                .then(data => {
                    if(data) {
                        if (typeof showToast === 'function') showToast('🗑️ تم حذف الكوبون بنجاح');
                        loadCoupons();
                    } else {
                        alert('فشل حذف الكوبون');
                    }
                })
                .catch(() => alert('حدث خطأ أثناء الاتصال بالخادم'));
            }
        }
        window.deleteCoupon = deleteCoupon;

        // --- Category Management ---
        function openCategoryAdd() {
            document.getElementById('catEditorTitle').innerText = 'إضافة قسم جديد';
            document.getElementById('categoryForm').reset();
            document.getElementById('cat_id').value = '';
            document.getElementById('cat_isBrand').checked = false;
            updatePreview('', 'cat_preview');
            const viewBtn = document.getElementById('btnViewCategory');
            if (viewBtn) viewBtn.style.display = 'none';
            switchTab('tab-category-editor');
        }

        function openCategoryEdit(id) {
            const cat = allCategories.find(c => c.id == id);
            if(!cat) return;
            document.getElementById('catEditorTitle').innerText = 'تعديل القسم: ' + cat.name;
            document.getElementById('cat_id').value = cat.id;
            document.getElementById('cat_name').value = cat.name;
            document.getElementById('cat_desc').value = cat.description || '';
            document.getElementById('cat_image').value = cat.image || '';
            document.getElementById('cat_icon').value = cat.icon || '';
            document.getElementById('cat_icon_url').value = (cat.icon && !cat.icon.startsWith('fa-') ? cat.icon : '') || '';
            // Update icon picker box
            const iconBox = document.getElementById('catIconPickerBox');
            if (iconBox) {
                const iTag = iconBox.querySelector('i');
                if (iTag) {
                    if (cat.icon && cat.icon.startsWith('fa-')) {
                        iTag.className = 'fas ' + cat.icon;
                        iTag.style.color = 'var(--primary)';
                    } else {
                        iTag.className = 'fas fa-icons';
                        iTag.style.color = '#94a3b8';
                    }
                }
                const hiddenInput = iconBox.querySelector('input');
                if (hiddenInput) hiddenInput.value = cat.icon || '';
            }
            document.getElementById('cat_parentId').value = cat.parentId || '';
            document.getElementById('cat_metaTitle').value = cat.metaTitle || '';
            document.getElementById('cat_metaDesc').value = cat.metaDesc || '';
            document.getElementById('cat_priority').value = cat.priority || 0;
            document.getElementById('cat_isActive').checked = cat.isActive !== false;
            document.getElementById('cat_isBrand').checked = !!cat.isBrand;
            
            updatePreview(cat.image, 'cat_preview');
            updatePreview(cat.icon, 'cat_icon_preview');
            
            const viewBtn = document.getElementById('btnViewCategory');
            if (viewBtn) {
                viewBtn.href = 'index.html?app=product.cat.' + cat.id;
                viewBtn.style.display = 'flex';
            }
            
            switchTab('tab-category-editor');
            
            // Update URL to persist edit state on refresh
            const url = new URL(window.location);
            url.searchParams.set('tab', 'category-editor');
            url.searchParams.set('editCat', cat.id);
            window.history.replaceState({}, '', url);
        }

        function updatePreview(url, previewId) {
            const preview = document.getElementById(previewId);
            if(!preview) return;
            if(url) {
                const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('youtube.com') || url.includes('youtu.be');
                if (isVideo) {
                    if (url.includes('youtube.com') || url.includes('youtu.be')) {
                        let ytId = '';
                        if (url.includes('v=')) ytId = url.split('v=')[1].split('&')[0];
                        else ytId = url.split('/').pop();
                        preview.innerHTML = `<img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" style="width:100%; height:100%; object-fit:cover;">`;
                    } else {
                        preview.innerHTML = `<video src="${url}" style="width:100%; height:100%; object-fit:cover;"></video>`;
                    }
                } else {
                    preview.innerHTML = `<img src="${url}" alt="Preview" style="width:100%; height:100%; object-fit:contain;">`;
                }
                preview.classList.remove('empty');
            } else {
                preview.innerHTML = '';
                preview.classList.add('empty');
            }
        }

        function updateLogoPreview() {
            const url = document.getElementById('storeLogoInput')?.value || '';
            const preview = document.getElementById('storeLogoInput_preview');
            const logoOnly = document.querySelector('input[name="logoOnly"]')?.checked;
            const storeName = document.querySelector('input[name="storeName"]')?.value || 'المتجر';
            if (!preview) return;
            if (url) {
                if (logoOnly) {
                    preview.innerHTML = '<img src="' + url + '" style="max-height:70px; max-width:100%; object-fit:contain;">';
                } else {
                    preview.innerHTML = '<img src="' + url + '" style="max-height:50px; max-width:60%; object-fit:contain;"> <span style="font-weight:800; font-size:16px; color:#1e293b; margin-right:8px;">' + storeName + '</span>';
                }
                preview.classList.remove('empty');
            } else {
                preview.innerHTML = '<span style="color:#94a3b8; font-size:13px;">معاينة الشعار ستظهر هنا</span>';
                preview.classList.add('empty');
            }
        }

        // --- Shipping Regions Management ---
        function addShippingRegion() {
            const container = document.getElementById('shippingRegionsContainer');
            const div = document.createElement('div');
            div.className = 'city-row';
            div.style = 'display:flex; gap:10px; margin-bottom:10px;';
            div.innerHTML = `
                <input type="text" name="city_names[]" class="input-luxury" style="margin-bottom:0;" placeholder="اسم المدينة/المنطقة" required>
                <input type="number" name="city_prices[]" class="input-luxury" style="margin-bottom:0; width:150px;" placeholder="تكلفة التوصيل" required>
                <button type="button" class="btn btn-outline" style="color:red; border-color:red; padding: 0 15px;" onclick="this.parentElement.remove()"><i class="fa fa-trash"></i></button>
            `;
            container.appendChild(div);
        }

        function renderShippingRegions(settings) {
            const container = document.getElementById('shippingRegionsContainer');
            if (!container) return;
            if (container.children.length > 0) return; // keep any rows the user already added
            if (!settings) settings = window._storeSettings || {};
            let names = settings['city_names[]'];
            let prices = settings['city_prices[]'];
            if (typeof names === 'string') names = [names];
            if (typeof prices === 'string') prices = [prices];
            if (!Array.isArray(names)) names = [];
            if (!Array.isArray(prices)) prices = [];
            if (names.length === 0 && prices.length === 0) return;
            const count = Math.max(names.length, prices.length);
            for (let i = 0; i < count; i++) {
                const row = document.createElement('div');
                row.className = 'city-row';
                row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
                const nameInput = document.createElement('input');
                nameInput.type = 'text'; nameInput.name = 'city_names[]'; nameInput.className = 'input-luxury';
                nameInput.style.marginBottom = '0'; nameInput.placeholder = 'اسم المدينة/المنطقة'; nameInput.required = true;
                nameInput.value = names[i] || '';
                const priceInput = document.createElement('input');
                priceInput.type = 'number'; priceInput.name = 'city_prices[]'; priceInput.className = 'input-luxury';
                priceInput.style.cssText = 'margin-bottom:0; width:150px;'; priceInput.placeholder = 'تكلفة التوصيل'; priceInput.required = true;
                priceInput.value = prices[i] || '';
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = 'btn btn-outline';
                btn.style.cssText = 'color:red; border-color:red; padding:0 15px;';
                btn.innerHTML = '<i class="fa fa-trash"></i>';
                btn.onclick = function () { this.parentElement.remove(); };
                row.appendChild(nameInput); row.appendChild(priceInput); row.appendChild(btn);
                container.appendChild(row);
            }
        }

        // --- Gallery Management ---
        let currentGalleryUnified = [];
        let currentVideoUrl = '';

        function syncFromUnified() {
            currentVideoUrl = '';
            const images = [];
            currentGalleryUnified.forEach(item => {
                if (typeof item === 'string' && item.startsWith('video:')) {
                    currentVideoUrl = item.replace('video:', '');
                } else {
                    images.push(item);
                }
            });
            return images;
        }

        function renderGallery() {
            const container = document.getElementById('gallery_container');
            container.innerHTML = '';

            if (currentGalleryUnified.length === 0) {
                container.innerHTML = '<div style="grid-column:1/-1; padding:20px; text-align:center; color:#94a3b8; font-size:13px; border:2px dashed #e2e8f0; border-radius:15px;">لا توجد صور أو فيديوهات حالياً</div>';
                updateGalleryInputs();
                return;
            }

            // 1. Main Item
            const mainItem = currentGalleryUnified[0];
            const mainIsVideo = typeof mainItem === 'string' && mainItem.startsWith('video:');
            const mainUrl = mainIsVideo ? mainItem.replace('video:', '') : mainItem;
            const mainWrapper = document.createElement('div');
            mainWrapper.style = "grid-column: 1 / -1; margin-bottom: 15px;";
            let mainPreview = '';
            if (mainIsVideo) {
                if (mainUrl.includes('youtube.com') || mainUrl.includes('youtu.be')) {
                    const vid = getYoutubeId(mainUrl);
                    mainPreview = `<img src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" style="width:100%; height:100%; object-fit:cover;">`;
                } else {
                    mainPreview = `<video src="${mainUrl}" style="width:100%; height:100%; object-fit:cover; opacity:0.8;"></video>`;
                }
            } else {
                mainPreview = `<img src="${mainUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            }
            mainWrapper.innerHTML = `
                <label class="label-luxury">${mainIsVideo ? 'الفيديو الرئيسي' : 'الصورة الرئيسية (واجهة المنتج)'}</label>
                <div class="gallery-item" style="position:relative; width:200px; aspect-ratio:1; border-radius:20px; overflow:hidden; border:3px solid var(--primary); background:${mainIsVideo ? '#000' : '#f8fafc'};">
                    ${mainPreview}
                    ${mainIsVideo ? '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;"><i class="fas fa-play-circle" style="color:white; font-size:40px;"></i></div><div style="position:absolute; top:10px; left:10px; background:var(--primary); color:white; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:800;">فيديو</div>' : '<div style="position:absolute; top:10px; left:10px; background:var(--primary); color:white; padding:4px 12px; border-radius:50px; font-size:11px; font-weight:800; box-shadow:0 2px 8px rgba(0,0,0,0.2);">الصورة الرئيسية</div>'}
                    <div style="position:absolute; bottom:10px; left:10px; right:10px; background:rgba(255,255,255,0.9); border-radius:10px; display:flex; justify-content:center; align-items:center; padding:8px; box-shadow:0 5px 15px rgba(0,0,0,0.1); opacity:0; transition:0.3s;" class="gallery-controls">
                        <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer;" onclick="removeFromGalleryAll(0)" title="حذف"></i>
                    </div>
                </div>
            `;
            mainWrapper.querySelector('.gallery-item').onmouseover = (e) => e.currentTarget.querySelector('.gallery-controls').style.opacity = '1';
            mainWrapper.querySelector('.gallery-item').onmouseout = (e) => e.currentTarget.querySelector('.gallery-controls').style.opacity = '0';
            container.appendChild(mainWrapper);

            // 2. Extra Items
            if (currentGalleryUnified.length > 1) {
                const extraLabel = document.createElement('div');
                extraLabel.style = "grid-column: 1 / -1; margin-top:10px; margin-bottom:5px;";
                extraLabel.innerHTML = '<label class="label-luxury">الوسائط الإضافية (اسحب للترتيب)</label>';
                container.appendChild(extraLabel);

                currentGalleryUnified.slice(1).forEach((item, i) => {
                    const index = i + 1;
                    const isVideo = typeof item === 'string' && item.startsWith('video:');
                    const url = isVideo ? item.replace('video:', '') : item;
                    const el = document.createElement('div');
                    el.className = 'gallery-item';
                    el.style = `position:relative; width:100%; aspect-ratio:1; border-radius:12px; overflow:hidden; border:2px solid #eee; background:${isVideo ? '#000' : '#fff'}; transition:0.2s;`;
                    let thumb = '';
                    if (isVideo) {
                        if (url.includes('youtube.com') || url.includes('youtu.be')) {
                            const vid = getYoutubeId(url);
                            thumb = `<img src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" style="width:100%; height:100%; object-fit:cover; opacity:0.7;">`;
                        } else {
                            thumb = `<video src="${url}" style="width:100%; height:100%; object-fit:cover; opacity:0.7;"></video>`;
                        }
                    } else {
                        thumb = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;">`;
                    }
                    el.innerHTML = `
                        ${thumb}
                        ${isVideo ? '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;"><i class="fas fa-play-circle" style="color:white; font-size:30px;"></i></div><div style="position:absolute; top:5px; left:5px; background:var(--primary); color:white; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:800;">فيديو</div>' : ''}
                        <div style="position:absolute; bottom:5px; left:5px; right:5px; background:rgba(255,255,255,0.95); border-radius:8px; display:flex; justify-content:space-around; align-items:center; padding:5px; box-shadow:0 2px 10px rgba(0,0,0,0.1); opacity:0; transition:0.3s;" class="gallery-controls">
                            <i class="fas fa-chevron-right" style="color:var(--primary); cursor:pointer;" onclick="moveImageAll(${index}, -1)" title="تحريك للخلف"></i>
                            <i class="fas fa-star" style="color:#ccc; cursor:pointer;" onclick="setMainImageAll(${index})" title="جعلها الرئيسية"></i>
                            <i class="fas fa-trash-alt" style="color:#ef4444; cursor:pointer;" onclick="removeFromGalleryAll(${index})" title="حذف"></i>
                            <i class="fas fa-chevron-left" style="color:var(--primary); cursor:pointer;" onclick="moveImageAll(${index}, 1)" title="تحريك للأمام"></i>
                        </div>
                    `;
                    el.onmouseover = () => el.querySelector('.gallery-controls').style.opacity = '1';
                    el.onmouseout = () => el.querySelector('.gallery-controls').style.opacity = '0';
                    container.appendChild(el);
                });
            }
            updateGalleryInputs();
        }

        function removeFromGalleryAll(index) {
            currentGalleryUnified.splice(index, 1);
            renderGallery();
        }

        function moveImageAll(index, dir) {
            const newIndex = index + dir;
            if (newIndex < 0 || newIndex >= currentGalleryUnified.length) return;
            const temp = currentGalleryUnified[index];
            currentGalleryUnified[index] = currentGalleryUnified[newIndex];
            currentGalleryUnified[newIndex] = temp;
            renderGallery();
        }

        function setMainImageAll(index) {
            const item = currentGalleryUnified.splice(index, 1)[0];
            currentGalleryUnified.unshift(item);
            renderGallery();
        }

        function openVideoModal() {
            document.getElementById('videoModal').style.display = 'flex';
            document.getElementById('videoUrlInput').value = currentVideoUrl;
            previewVideoInput(currentVideoUrl);
        }

        function closeVideoModal() {
            document.getElementById('videoModal').style.display = 'none';
        }

        function previewVideoInput(url) {
            const previewBox = document.getElementById('videoPreviewBox');
            if (!url) {
                previewBox.style.display = 'none';
                return;
            }

            previewBox.style.display = 'block';
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                const id = getYoutubeId(url);
                previewBox.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe>`;
            } else if (url.includes('vimeo.com')) {
                previewBox.innerHTML = `<i class="fab fa-vimeo-v" style="font-size:50px; color:#94a3b8; display:block; margin:20% auto; text-align:center;"></i>`;
            } else {
                previewBox.innerHTML = `<video src="${url}" controls style="width:100%; height:100%; object-fit:cover;"></video>`;
            }
        }

        function getYoutubeId(url) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        }

        function confirmVideoAdd() {
            currentVideoUrl = document.getElementById('videoUrlInput').value.trim();
            // Remove old video from unified gallery if exists
            currentGalleryUnified = currentGalleryUnified.filter(i => !(typeof i === 'string' && i.startsWith('video:')));
            if (currentVideoUrl) {
                currentGalleryUnified.push('video:' + currentVideoUrl);
            }
            renderGallery();
            closeVideoModal();
        }

        async function triggerVideoFileUpload(btn) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'video/*';
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const icon = btn.querySelector('i');
                const originalClass = icon.className;
                icon.className = 'fas fa-spinner fa-spin';
                btn.disabled = true;

                const formData = new FormData();
                formData.append('image', file);

                try {
                    const res = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await res.json();
                    if (result.data && result.data.url) {
                        document.getElementById('videoUrlInput').value = result.data.url;
                        previewVideoInput(result.data.url);
                        showToast('✅ تم رفع الفيديو بنجاح');
                    } else {
                        showToast('❌ فشل رفع الفيديو');
                    }
                } catch (err) {
                    showToast('❌ خطأ أثناء رفع الفيديو');
                } finally {
                    icon.className = originalClass;
                    btn.disabled = false;
                }
            };
            fileInput.click();
        }

        function updateGalleryInputs() {
            const images = [];
            let video = '';
            currentGalleryUnified.forEach(item => {
                if (typeof item === 'string' && item.startsWith('video:')) {
                    video = item.replace('video:', '');
                } else {
                    images.push(item);
                }
            });
            document.getElementById('prod_image').value = images[0] || '';
            document.getElementById('prod_extra_images').value = images.slice(1).join('\n');
            document.getElementById('prod_video').value = video || '';
        }

        // --- Variant Management ---
        function addVariantOption(data = { name: '', type: 'dropdown', values: [] }) {
            const container = document.getElementById('variants_container');
            const div = document.createElement('div');
            div.className = 'variant-option-card';
            div.style = 'background:#fff; padding:20px; border-radius:15px; border:1px solid #e2e8f0; margin-bottom:15px;';
            
            let values = [];
            if (Array.isArray(data.values)) {
                values = data.values.map(v => typeof v === 'object' ? v : { value: v, price: '', image: '', stock: '', color: '#4f46e5' });
            } else if (typeof data.values === 'string') {
                values = data.values.split(',').map(v => ({ value: v.trim(), price: '', image: '', stock: '', color: '#4f46e5' }));
            }

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px dashed #e2e8f0; padding-bottom:12px;">
                    <div style="display:flex; gap:10px; flex:1; align-items:center;">
                        <input type="text" class="input-luxury variant-name" style="padding:8px; width:200px; margin-bottom:0;" placeholder="اسم الخيار (مثلاً: اللون)" value="${data.name || ''}">
                        <select class="input-luxury variant-type" style="padding:8px; width:160px; margin-bottom:0;">
                            <option value="dropdown" ${data.type==='dropdown'?'selected':''}>قائمة منسدلة</option>
                            <option value="pills" ${data.type==='pills'?'selected':''}>أزرار اختيار</option>
                            <option value="swatch" ${data.type==='swatch'?'selected':''}>🎨 ألوان</option>
                            <option value="image" ${data.type==='image'?'selected':''}>🖼️ صور مصغرة</option>
                        </select>
                    </div>
                    <i class="fas fa-trash" style="color:#ef4444; cursor:pointer;" onclick="this.closest('.variant-option-card').remove();"></i>
                </div>
                
                <!-- Values Rows Container -->
                <div class="variant-values-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
                    <!-- Dynamically populated rows -->
                </div>

                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="text" class="input-luxury variant-tag-input" style="padding:8px; margin:0; flex:1;" placeholder="اكتب قيمة جديدة ثم اضغط Enter لإضافتها (مثال: أحمر)...">
                    <button type="button" class="btn btn-primary add-value-btn" style="padding:8px 15px;"><i class="fas fa-plus"></i></button>
                </div>
                <div class="variant-suggestions" style="display:flex; flex-wrap:wrap; gap:5px; margin-top:8px;"></div>
            `;

            const valuesList = div.querySelector('.variant-values-list');
            const tagInput = div.querySelector('.variant-tag-input');
            const addValueBtn = div.querySelector('.add-value-btn');
            const nameInput = div.querySelector('.variant-name');
            const typeSelect = div.querySelector('.variant-type');
            const suggestionsBox = div.querySelector('.variant-suggestions');

            const updateImageFieldsVisibility = () => {
                const type = typeSelect.value;
                const isSwatch = type === 'swatch';
                const isImage = type === 'image';
                div.querySelectorAll('.val-image-container').forEach(cont => {
                    // Show image field for swatch AND image types
                    cont.style.display = (isSwatch || isImage) ? 'flex' : 'none';
                });
                div.querySelectorAll('.val-color-container').forEach(cont => {
                    // Show color picker only for swatch
                    cont.style.display = isSwatch ? 'flex' : 'none';
                });
            };

            const renderValueRow = (valData) => {
                const row = document.createElement('div');
                row.className = 'variant-value-row';
                row.style = 'display:flex; gap:10px; align-items:center; background:#f8fafc; padding:10px; border-radius:10px; border:1px solid #e2e8f0; flex-wrap:wrap;';
                row.innerHTML = `
                    <div class="val-color-container" style="display:none; align-items:center; gap:5px;">
                        <input type="color" class="val-color" style="width:32px; height:32px; padding:0; border:2px solid #cbd5e1; border-radius:50%; cursor:pointer; background:transparent; overflow:hidden;" value="${valData.color || '#4f46e5'}">
                    </div>

                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="text" class="input-luxury val-name" style="padding:6px; margin:0; width:110px; font-weight:700; color:#0f172a; font-size:13px; border:1.5px solid #e2e8f0; border-radius:8px;" placeholder="اسم القيمة" value="${valData.value}">
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="font-size:11px; color:#64748b;">السعر (+/-):</span>
                        <input type="text" class="input-luxury val-price" style="padding:6px; margin:0; width:65px; text-align:center; font-size:12px;" placeholder="0.00" value="${valData.price || ''}">
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="font-size:11px; color:var(--primary); font-weight:700;">الجملة (+/-):</span>
                        <input type="text" class="input-luxury val-wholesale-price" style="padding:6px; margin:0; width:65px; text-align:center; font-size:12px;" placeholder="0.00" value="${valData.wholesalePrice || ''}">
                    </div>

                    <div class="val-image-container" style="display:flex; align-items:center; gap:8px; position:relative;">
                        <span style="font-size:11px; color:#64748b; white-space:nowrap;">الصورة:</span>
                        
                        <!-- Hidden input to store the URL -->
                        <input type="text" class="val-image" style="display:none;" value="${valData.image || ''}">
                        
                        <!-- Image Preview Box -->
                        <div class="val-image-preview" 
                             onclick="triggerUploadForValue(this.nextElementSibling)"
                             title="انقر لرفع صورة"
                             style="width:48px; height:48px; border-radius:10px; border:2px dashed #cbd5e1; overflow:hidden; cursor:pointer; display:flex; align-items:center; justify-content:center; background:#f8fafc; flex-shrink:0; transition:0.2s; position:relative;"
                             onmouseover="this.style.borderColor='#4f46e5'"
                             onmouseout="this.style.borderColor='${valData.image ? '#10b981' : '#cbd5e1'}'">
                            ${valData.image 
                                ? `<img src="${valData.image}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-image\\' style=\\'color:#cbd5e1; font-size:18px;\\'></i>'">`
                                : `<i class="fas fa-camera" style="color:#cbd5e1; font-size:18px;"></i>`
                            }
                        </div>
                        
                        <!-- Upload Button -->
                        <button type="button" class="btn btn-outline val-image-upload-btn" style="padding:6px 10px; border-radius:8px;" onclick="triggerUploadForValue(this)" title="رفع صورة جديدة">
                            <i class="fas fa-upload" style="color:#64748b; font-size:12px;"></i>
                        </button>
                        
                        <!-- Gallery Button -->
                        <button type="button" class="btn btn-outline val-gallery-select-btn" style="padding:6px 10px; border-radius:8px;" onclick="toggleGallerySelectDropdown(this)" title="اختر من معرض الصور">
                            <i class="fas fa-images" style="color:#4f46e5; font-size:12px;"></i>
                        </button>
                        
                        <!-- Remove image button (only if has image) -->
                        ${valData.image ? `<button type="button" class="val-image-clear-btn" onclick="clearValImage(this)" title="حذف الصورة" style="background:none; border:none; cursor:pointer; padding:4px; color:#ef4444; font-size:12px;"><i class="fas fa-times-circle"></i></button>` : `<button type="button" class="val-image-clear-btn" onclick="clearValImage(this)" title="حذف الصورة" style="background:none; border:none; cursor:pointer; padding:4px; color:#ef4444; font-size:12px; display:none;"><i class="fas fa-times-circle"></i></button>`}
                        
                        <!-- Gallery dropdown -->
                        <div class="val-gallery-dropdown" style="display:none; position:absolute; z-index:200; left:0; top:58px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.12); padding:10px; width:230px; max-height:200px; overflow-y:auto; gap:8px; flex-wrap:wrap; justify-content:center;">
                            <!-- Dynamic images populated via JS -->
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="font-size:11px; color:#64748b;">المخزون:</span>
                        <input type="number" class="input-luxury val-stock" style="padding:6px; margin:0; width:70px; text-align:center; font-size:12px;" placeholder="∞" value="${valData.stock || ''}">
                    </div>

                    <i class="fas fa-times" style="color:#ef4444; cursor:pointer; margin-right:5px;" onclick="this.closest('.variant-value-row').remove();"></i>
                `;
                valuesList.appendChild(row);
                updateImageFieldsVisibility();
            };

            // Render existing values
            values.forEach(v => renderValueRow(v));

            const addValue = () => {
                const val = tagInput.value.trim().replace(/[,，、،]$/, '').trim();
                if (val) {
                    const existing = Array.from(valuesList.querySelectorAll('.val-name')).map(el => el.value.trim());
                    if (!existing.includes(val)) {
                        // Pre-assign color if we can map it
                        let suggestedColor = '#4f46e5';
                        const map = {
                            'أحمر': '#ef4444', 'red': '#ef4444',
                            'أزرق': '#3b82f6', 'blue': '#3b82f6',
                            'أخضر': '#10b981', 'green': '#10b981',
                            'أصفر': '#f59e0b', 'yellow': '#f59e0b',
                            'أسود': '#0f172a', 'black': '#0f172a',
                            'أبيض': '#ffffff', 'white': '#ffffff',
                            'ذهبي': '#eab308', 'gold': '#eab308',
                            'فضي': '#94a3b8', 'silver': '#94a3b8',
                            'وردي': '#ec4899', 'pink': '#ec4899',
                            'بنفسجي': '#a855f7', 'purple': '#a855f7',
                            'برتقالي': '#f97316', 'orange': '#f97316',
                            'بني': '#78350f', 'brown': '#78350f'
                        };
                        if (map[val]) suggestedColor = map[val];
                        renderValueRow({ value: val, price: '', wholesalePrice: '', image: '', stock: '', color: suggestedColor });
                    }
                    tagInput.value = '';
                }
            };

            tagInput.onkeydown = (e) => {
                if (e.key === 'Enter' || e.keyCode === 13 || e.key === ',' || e.key === '،') {
                    e.preventDefault();
                    addValue();
                }
            };
            addValueBtn.onclick = addValue;

            const updateSuggestions = () => {
                const type = typeSelect.value;
                const name = nameInput.value.trim();
                let sugs = [];
                
                if (type === 'swatch' || name.includes('لون') || name.toLowerCase().includes('color')) {
                    sugs = ['أبيض', 'أسود', 'أحمر', 'أزرق', 'أخضر', 'أصفر', 'ذهبي', 'فضي', 'بني', 'بنفسجي'];
                } else if (name.includes('مقاس') || name.includes('حجم') || name.toLowerCase().includes('size')) {
                    sugs = ['S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42'];
                }

                suggestionsBox.innerHTML = sugs.map(s => `
                    <div class="suggestion-chip" style="background:#f1f5f9; color:#64748b; padding:2px 10px; border-radius:50px; font-size:11px; cursor:pointer; border:1px solid #e2e8f0;" onclick="addSuggestionValue(this, '${s}')">${s}</div>
                `).join('');
            };

            window.addSuggestionValue = (el, val) => {
                const card = el.closest('.variant-option-card');
                const tInput = card.querySelector('.variant-tag-input');
                tInput.value = val;
                const vList = card.querySelector('.variant-values-list');
                const existing = Array.from(vList.querySelectorAll('.val-name')).map(el => el.value.trim());
                if (!existing.includes(val)) {
                    card.querySelector('.add-value-btn').click();
                } else {
                    tInput.value = '';
                }
            };

            typeSelect.onchange = () => {
                updateImageFieldsVisibility();
                updateSuggestions();
            };
            nameInput.oninput = updateSuggestions;
            
            updateSuggestions();
            updateImageFieldsVisibility();

            container.appendChild(div);
            if(!data.name) nameInput.focus();
        }

        // Helper: update preview box after image is set
        function updateValImagePreview(container, url) {
            const input = container.querySelector('.val-image');
            const preview = container.querySelector('.val-image-preview');
            const clearBtn = container.querySelector('.val-image-clear-btn');

            input.value = url;

            if (url) {
                preview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.style.display='none'">`;
                preview.style.borderColor = '#10b981';
                preview.style.borderStyle = 'solid';
                if (clearBtn) clearBtn.style.display = '';
            } else {
                preview.innerHTML = `<i class="fas fa-camera" style="color:#cbd5e1; font-size:18px;"></i>`;
                preview.style.borderColor = '#cbd5e1';
                preview.style.borderStyle = 'dashed';
                if (clearBtn) clearBtn.style.display = 'none';
            }
        }

        function clearValImage(btn) {
            const container = btn.closest('.val-image-container');
            updateValImagePreview(container, '');
        }

        function triggerUploadForValue(btn) {
            const container = btn.closest('.val-image-container');
            const icon = btn.querySelector('i');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (icon) icon.className = 'fas fa-spinner fa-spin';
                
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const formData = new FormData();
                        formData.append('image', event.target.result);
                        const res = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', {
                            method: 'POST',
                            body: formData
                        });
                        const json = await res.json();
                        if (json.data && json.data.url) {
                            updateValImagePreview(container, json.data.url);
                            if (icon) { icon.className = 'fas fa-upload'; icon.style.color = '#64748b'; }
                            showToast('✅ تم رفع صورة الخيار بنجاح');
                        } else {
                            showToast('❌ فشل رفع الصورة');
                            if (icon) icon.className = 'fas fa-upload';
                        }
                    } catch (err) {
                        showToast('❌ خطأ أثناء الرفع');
                        if (icon) icon.className = 'fas fa-upload';
                    }
                };
                reader.readAsDataURL(file);
            };
            fileInput.click();
        }

        function toggleGallerySelectDropdown(btn) {
            const container = btn.closest('.val-image-container');
            const dropdown = container.querySelector('.val-gallery-dropdown');
            
            const isHidden = dropdown.style.display === 'none';
            
            // Close all other gallery dropdowns first
            document.querySelectorAll('.val-gallery-dropdown').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
            });
            
            if (isHidden) {
                dropdown.style.display = 'flex';
                const imageOnlyItems = currentGalleryUnified.filter(i => typeof i === 'string' && !i.startsWith('video:'));
                if (!imageOnlyItems || imageOnlyItems.length === 0) {
                    dropdown.innerHTML = `<span style="font-size:11px; color:#64748b; padding:10px; text-align:center; width:100%;">معرض الصور فارغ، يرجى إضافة صور أولاً.</span>`;
                } else {
                    dropdown.innerHTML = imageOnlyItems.map(url => `
                        <img src="${url}" style="width:44px; height:44px; border-radius:8px; object-fit:cover; cursor:pointer; border:2px solid #e2e8f0; transition:0.2s; margin:2px;" 
                             onclick="selectImageFromGalleryDropdown(this, '${url}')"
                             onmouseover="this.style.borderColor='#4f46e5'; this.style.transform='scale(1.08)'"
                             onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='scale(1)'"
                        >
                    `).join('');
                }
            } else {
                dropdown.style.display = 'none';
            }
        }

        function selectImageFromGalleryDropdown(imgEl, url) {
            const container = imgEl.closest('.val-image-container');
            const dropdown = container.querySelector('.val-gallery-dropdown');
            updateValImagePreview(container, url);
            dropdown.style.display = 'none';
            showToast('✅ تم اختيار الصورة من المعرض بنجاح');
        }

        // Close dropdown when clicking anywhere else
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.val-image-container')) {
                document.querySelectorAll('.val-gallery-dropdown').forEach(d => d.style.display = 'none');
            }
        });

        // --- Editor Actions ---
        let currentConfirmCallback = null;
        function showConfirm(msg, callback) {
            document.getElementById('confirmModalMsg').innerText = msg;
            const yesBtn = document.getElementById('confirmModalYesBtn');
            
            // Clone and replace to remove old listeners
            const newYesBtn = yesBtn.cloneNode(true);
            yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
            
            newYesBtn.onclick = () => {
                callback();
                closeConfirmModal();
            };
            
            document.getElementById('customConfirmModal').style.display = 'flex';
        }

        function closeConfirmModal() {
            document.getElementById('customConfirmModal').style.display = 'none';
        }

        async function confirmDeleteProduct(id) {
            showConfirm('هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً؟', async () => {
                try {
                    const result = await DB.deleteProduct(id);
                    if (result) {
                        showToast('🗑️ تم حذف المنتج بنجاح');
                        // Reload products
                        initDashboard();
                        // If we are in the editor with this product, clear it
                        if (document.getElementById('prod_id').value == id) {
                            openAddModal();
                        }
                        // Remove row from table directly for instant feedback
                        const row = document.querySelector(`button[onclick="confirmDeleteProduct('${id}')"]`)?.closest('tr');
                        if (row) row.style.opacity = '0';
                        setTimeout(() => row?.remove(), 300);
                    }
                } catch (e) {
                    alert('حدث خطأ أثناء الحذف');
                }
            });
        }
        let selectedCategoryIds = [];

        function searchCategories(query) {
            const results = document.getElementById('category_search_results');
            if (!query) {
                results.style.display = 'none';
                return;
            }
            
            const filtered = allCategories.filter(c => 
                c.name.toLowerCase().includes(query.toLowerCase()) && 
                !selectedCategoryIds.includes(c.id)
            );

            if (filtered.length === 0) {
                results.innerHTML = '<div style="padding: 10px; color: #94a3b8; font-size: 13px;">لا توجد نتائج</div>';
            } else {
                results.innerHTML = filtered.map(c => `
                    <div style="padding: 10px 15px; cursor: pointer; font-size: 14px; border-bottom: 1px solid #f1f5f9; transition: 0.2s;" 
                         onclick="selectCategory('${c.id}')" 
                         onmouseover="this.style.background='#f8fafc'" 
                         onmouseout="this.style.background='white'">
                        ${c.name}
                    </div>
                `).join('');
            }
            results.style.display = 'block';
        }

        function selectCategory(id) {
            if (!selectedCategoryIds.includes(id)) {
                selectedCategoryIds.push(id);
                renderCategoryChips();
                document.getElementById('category_search_input').value = '';
                document.getElementById('category_search_results').style.display = 'none';
            }
        }

        function removeCategory(id) {
            selectedCategoryIds = selectedCategoryIds.filter(cid => cid !== id);
            renderCategoryChips();
        }

        function renderCategoryChips() {
            const container = document.getElementById('selected_categories_chips');
            container.innerHTML = selectedCategoryIds.map(id => {
                const cat = allCategories.find(c => c.id === id);
                if (!cat) return '';
                return `
                    <div style="background: var(--primary); color: white; padding: 5px 12px; border-radius: 50px; font-size: 12px; display: flex; align-items: center; gap: 8px; font-weight: 700;">
                        ${cat.name}
                        <i class="fas fa-times" style="cursor: pointer; font-size: 10px; opacity: 0.8;" onclick="removeCategory('${id}')"></i>
                    </div>
                `;
            }).join('');
        }

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            const searchInput = document.getElementById('category_search_input');
            const searchResults = document.getElementById('category_search_results');
            if (searchInput && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });

        function openAddModal() {
            document.getElementById('editorTitle').innerText = 'إضافة منتج احترافي';
            document.getElementById('productForm').reset();
            document.getElementById('prod_id').value = '';
            currentGalleryUnified = [];
            currentVideoUrl = '';
            renderGallery();
            const varContainer = document.getElementById('variants_container');
            if (varContainer) varContainer.innerHTML = '';
            const comboContainer = document.getElementById('variant_combinations_container');
            if (comboContainer) comboContainer.innerHTML = '';
            window.currentProductVariantsData = [];
            
            selectedCategoryIds = [];
            renderCategoryChips();
            
            const publishBtn = document.getElementById('publishBtn');
            if(publishBtn) publishBtn.innerText = 'نشر المنتج الآن';

            const viewBtn = document.getElementById('viewProductBtn');
            if(viewBtn) viewBtn.style.display = 'none';

            // Update URL
            const url = new URL(window.location);
            url.searchParams.delete('edit');
            window.history.replaceState({}, '', url);
            
            switchTab('tab-product-editor');
        }

        function toggleLandingSections(show) {
            document.getElementById('landingSectionsCard').style.display = show ? 'block' : 'none';
        }

        function addLandingSection(data = { type: 'zigzag', image: '', title: '', text: '', videoUrl: '', direction: 'right', features: [] }) {
            const container = document.getElementById('landingSectionsContainer');
            const div = document.createElement('div');
            div.className = 'landing-section-row';
            div.style = 'background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:20px; position:relative;';
            
            const type = data.type || 'zigzag';

            div.innerHTML = `
                <button type="button" onclick="this.parentElement.remove()" style="position:absolute; top:15px; left:15px; background:#fee2e2; border:none; color:#ef4444; width:30px; height:30px; border-radius:8px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                
                <div class="form-group" style="margin-bottom:15px;">
                    <label style="font-size:12px; font-weight:800; color:var(--primary);">نوع القسم</label>
                    <select class="input-luxury section-type" style="padding:8px; font-size:13px;" onchange="updateSectionFields(this)">
                        <option value="zigzag" ${type === 'zigzag' ? 'selected' : ''}>صورة + نص</option>
                        <option value="banner" ${type === 'banner' ? 'selected' : ''}>بانر عريض (صورة فقط)</option>
                        <option value="video" ${type === 'video' ? 'selected' : ''}>فيديو تشويقي</option>
                        <option value="features" ${type === 'features' ? 'selected' : ''}>شبكة مميزات (أيقونات)</option>
                    </select>
                </div>

                <div class="section-fields-container"></div>
            `;
            container.appendChild(div);
            updateSectionFields(div.querySelector('.section-type'), data);
        }

        function updateSectionFields(select, data = {}) {
            const container = select.closest('.landing-section-row').querySelector('.section-fields-container');
            const type = select.value;
            let html = '';

            if (type === 'zigzag') {
                html = `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div class="form-group">
                            <label style="font-size:11px; font-weight:bold;">الصورة</label>
                            <div style="display:flex; gap:5px;">
                                <input type="text" class="input-luxury section-img" style="padding:8px;" placeholder="رابط الصورة" value="${data.image || ''}">
                                <button type="button" class="btn btn-outline" style="padding:0 10px;" onclick="triggerUploadForSection(this)"><i class="fas fa-upload"></i></button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-size:11px; font-weight:bold;">مكان الصورة</label>
                            <select class="input-luxury section-direction" style="padding:8px;">
                                <option value="right" ${data.direction === 'right' ? 'selected' : ''}>يمين</option>
                                <option value="left" ${data.direction === 'left' ? 'selected' : ''}>يسار</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:10px;">
                        <label style="font-size:11px; font-weight:bold;">العنوان الرئيسي</label>
                        <input type="text" class="input-luxury section-title" style="padding:8px;" placeholder="مثلاً: جودة عالية" value="${data.title || ''}">
                    </div>
                    <div class="form-group">
                        <label style="font-size:11px; font-weight:bold;">الوصف</label>
                        <textarea class="input-luxury section-text" style="padding:8px;" rows="3" placeholder="تفاصيل الميزة...">${data.text || ''}</textarea>
                    </div>
                `;
            } else if (type === 'banner') {
                html = `
                    <div class="form-group">
                        <label style="font-size:11px; font-weight:bold;">صورة البانر</label>
                        <div style="display:flex; gap:5px;">
                            <input type="text" class="input-luxury section-img" style="padding:8px;" placeholder="رابط الصورة" value="${data.image || ''}">
                            <button type="button" class="btn btn-outline" style="padding:0 10px;" onclick="triggerUploadForSection(this)"><i class="fas fa-upload"></i></button>
                        </div>
                    </div>
                `;
            } else if (type === 'video') {
                html = `
                    <div class="form-group">
                        <label style="font-size:11px; font-weight:bold;">رابط الفيديو (YouTube/Direct)</label>
                        <input type="text" class="input-luxury section-videoUrl" style="padding:8px;" value="${data.videoUrl || ''}">
                    </div>
                `;
            } else if (type === 'features') {
                html = `
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="font-size:11px; font-weight:bold;">عنوان الشبكة الرئيسي</label>
                        <input type="text" class="input-luxury section-title" style="padding:8px;" value="${data.title || ''}">
                    </div>
                    <div class="features-list-container">
                        ${(data.features || [{icon:'fa-star',title:'',text:''}]).map(f => `
                            <div class="feature-item-row" style="background:#fff; border:1px solid #eee; padding:10px; border-radius:10px; margin-bottom:10px; position:relative;">
                                <button type="button" onclick="this.parentElement.remove()" style="position:absolute; top:5px; left:5px; color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-times"></i></button>
                                <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
                                    <div class="icon-picker-box" style="width:40px; height:40px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="openIconPicker(this)">
                                        <i class="fas ${f.icon}"></i>
                                        <input type="hidden" class="feature-icon" value="${f.icon}">
                                    </div>
                                    <input type="text" class="input-luxury feature-title" style="padding:6px; font-size:12px; height:auto;" placeholder="عنوان الميزة" value="${f.title}">
                                </div>
                                <textarea class="input-luxury feature-text" style="padding:6px; font-size:11px; height:auto;" rows="2" placeholder="وصف الميزة">${f.text}</textarea>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-outline" style="width:100%; font-size:11px;" onclick="addFeatureItem(this)">+ إضافة ميزة للشبكة</button>
                `;
            }
            container.innerHTML = html;
        }

        function addFeatureItem(btn) {
            const list = btn.previousElementSibling;
            const div = document.createElement('div');
            div.className = 'feature-item-row';
            div.style = 'background:#fff; border:1px solid #eee; padding:10px; border-radius:10px; margin-bottom:10px; position:relative;';
            div.innerHTML = `
                <button type="button" onclick="this.parentElement.remove()" style="position:absolute; top:5px; left:5px; color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-times"></i></button>
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
                    <div class="icon-picker-box" style="width:40px; height:40px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="openIconPicker(this)">
                        <i class="fas fa-star"></i>
                        <input type="hidden" class="feature-icon" value="fa-star">
                    </div>
                    <input type="text" class="input-luxury feature-title" style="padding:6px; font-size:12px; height:auto;" placeholder="عنوان الميزة">
                </div>
                <textarea class="input-luxury feature-text" style="padding:6px; font-size:11px; height:auto;" rows="2" placeholder="وصف الميزة"></textarea>
            `;
            list.appendChild(div);
        }

        const commonIcons = [
            // E-commerce & Shopping
            {icon:'fa-star', kw:'نجمة تقييم تصنيف إعجاب مفضلة نجم'},
            {icon:'fa-truck', kw:'شاحنة توصيل شحن نقل'},
            {icon:'fa-gem', kw:'جوهرة ألماس ماس مجوهرات حجر كريم'},
            {icon:'fa-medal', kw:'ميدالية جائزة إنجاز'},
            {icon:'fa-heart', kw:'قلب إعجاب مفضلة حب'},
            {icon:'fa-thumbs-up', kw:'إعجاب يعجبني thumb up'},
            {icon:'fa-clock', kw:'ساعة وقت زمن مؤقت ساعه'},
            {icon:'fa-tag', kw:'بطاقة سعر تاغ علامة تصنيف تاج'},
            {icon:'fa-check-circle', kw:'موافق صحيح تم دائرة صح'},
            {icon:'fa-bolt', kw:'صاعقة برق كهرباء سريع'},
            {icon:'fa-gift', kw:'هدية هدايا'},
            {icon:'fa-box-open', kw:'صندوق مفتوح فتح'},
            {icon:'fa-award', kw:'جائزة شهادة تكريم مكافأة'},
            {icon:'fa-shopping-cart', kw:'عربة تسوق عربه'},
            {icon:'fa-shopping-bag', kw:'حقيبة تسوق شنطة'},
            {icon:'fa-shopping-basket', kw:'سلة تسوق سله'},
            {icon:'fa-credit-card', kw:'بطاقة ائتمان كريدت فيزا ماستر'},
            {icon:'fa-wallet', kw:'محفظة نقود جيب'},
            {icon:'fa-money-bill-wave', kw:'فلوس نقود مال عملة درهم دولار'},
            {icon:'fa-percent', kw:'نسبة مئوية خصم تخفيض'},
            {icon:'fa-barcode', kw:'باركود رمز منتج'},
            {icon:'fa-qrcode', kw:'رمز الاستجابة كيو آر QR'},
            {icon:'fa-cash-register', kw:'كاشير صندوق نقود كاش'},
            {icon:'fa-tags', kw:'بطاقات أسعار تاجات'},
            {icon:'fa-cart-plus', kw:'إضافة عربة اضافة'},
            {icon:'fa-cart-arrow-down', kw:'تنزيل عربة شراء'},
            {icon:'fa-store', kw:'متجر محل تجارة'},
            {icon:'fa-store-alt', kw:'متجر محل تجارة'},
            {icon:'fa-truck-loading', kw:'تحميل شاحنة تفريغ نقل'},
            {icon:'fa-truck-moving', kw:'شاحنة نقل متحركة'},
            {icon:'fa-shipping-fast', kw:'شحن سريع توصيل'},
            {icon:'fa-undo', kw:'تراجع إلغاء رجوع استرجاع'},
            {icon:'fa-exchange-alt', kw:'تبديل مقايضة صرف بدل'},
            {icon:'fa-box', kw:'صندوق كرتون علبة'},
            {icon:'fa-boxes', kw:'صناديق كراتين علب'},
            {icon:'fa-clipboard-list', kw:'قائمة لائحة حافظة جرد'},
            {icon:'fa-clipboard-check', kw:'حافظة تدقيق موافقة تم'},
            {icon:'fa-dolly', kw:'عربة نقل عربه'},
            {icon:'fa-parachute-box', kw:'صندوق مظلة'},
            {icon:'fa-gift-card', kw:'بطاقة هدية كارت'},
            {icon:'fa-hand-holding-heart', kw:'يد قلب عطاء'},
            // Users & People
            {icon:'fa-user', kw:'مستخدم شخص عميل زبون حساب عضو'},
            {icon:'fa-user-friends', kw:'أصدقاء مستخدمين رفاق اصحاب'},
            {icon:'fa-users', kw:'مستخدمين مجموعة فريق ناس مجموعة'},
            {icon:'fa-user-tie', kw:'موظف مدير مع مدير'},
            {icon:'fa-user-circle', kw:'صورة مستخدم شخص دائرة'},
            {icon:'fa-user-check', kw:'موافقة مستخدم توثيق تحقق'},
            {icon:'fa-user-plus', kw:'إضافة مستخدم اضافة'},
            {icon:'fa-user-shield', kw:'حماية مستخدم أمان درع'},
            {icon:'fa-id-card', kw:'بطاقة هوية تعريف بطاقه'},
            {icon:'fa-id-badge', kw:'شارة هوية تعريف'},
            {icon:'fa-address-card', kw:'بطاقة عنوان اتصال'},
            {icon:'fa-child', kw:'طفل طفلة أطفال ولد'},
            {icon:'fa-male', kw:'ذكر رجل ولد صبي'},
            {icon:'fa-female', kw:'أنثى امرأة فتاة بنت'},
            {icon:'fa-happy', kw:'سعيد فرحان مبسوط مبتهج'},
            {icon:'fa-smile', kw:'ابتسامة مبتسم سعيد'},
            {icon:'fa-meh', kw:'متوسط عادي محايد'},
            {icon:'fa-frown', kw:'حزين عابس كئيب'},
            {icon:'fa-angry', kw:'غضبان غاضب زعلان'},
            {icon:'fa-surprise', kw:'متفاجئ مندهش مفاجأة'},
            {icon:'fa-grin-hearts', kw:'حب قلب إعجاب مبتسم'},
            {icon:'fa-grin-stars', kw:'نجوم مبتسم رائع'},
            // Communication & Social
            {icon:'fa-phone', kw:'هاتف اتصال جوال موبايل تلفون'},
            {icon:'fa-phone-alt', kw:'هاتف اتصال جوال بديل'},
            {icon:'fa-envelope', kw:'بريد إلكتروني رسالة ايميل'},
            {icon:'fa-envelope-open', kw:'بريد مفتوح رسالة'},
            {icon:'fa-comment', kw:'تعليق رسالة رد'},
            {icon:'fa-comments', kw:'تعليقات رسائل محادثة دردشة'},
            {icon:'fa-comment-dots', kw:'تعليق نقاط رسالة'},
            {icon:'fa-comment-alt', kw:'تعليق بديل رسالة رد'},
            {icon:'fa-sms', kw:'رسالة نصية جوال مسج'},
            {icon:'fa-whatsapp', kw:'واتساب وتساب'},
            {icon:'fa-headset', kw:'سماعة دعم صوتي'},
            {icon:'fa-support', kw:'دعم فني مساعدة خدمة'},
            {icon:'fa-info-circle', kw:'معلومات دائرة'},
            {icon:'fa-info', kw:'معلومات معلومة'},
            {icon:'fa-question-circle', kw:'سؤال استفسار دائرة'},
            {icon:'fa-exclamation-circle', kw:'تنبيه مهم دائرة انتباه'},
            {icon:'fa-exclamation-triangle', kw:'تحذير خطر تنبيه مهم مثلث'},
            {icon:'fa-bullhorn', kw:'مكبر صوت إعلان نشر'},
            {icon:'fa-bell', kw:'جرس إشعار تنبيه جرس'},
            {icon:'fa-bell-slash', kw:'إشعار ممنوع جرس'},
            {icon:'fa-volume-up', kw:'صوت مرتفع رفع مكبر'},
            {icon:'fa-volume-mute', kw:'صوت مكتوم كتم'},
            {icon:'fa-rss', kw:'متابعة تغذية خلاصة'},
            {icon:'fa-share-alt', kw:'مشاركة نشر توزيع'},
            {icon:'fa-share', kw:'مشاركة إرسال'},
            {icon:'fa-send', kw:'إرسال ارسال'},
            {icon:'fa-paper-plane', kw:'طائرة ورق إرسال'},
            // Files & Documents
            {icon:'fa-file', kw:'ملف مستند وثيقة'},
            {icon:'fa-file-alt', kw:'ملف مستند بديل نص'},
            {icon:'fa-file-pdf', kw:'ملف PDF بي دي إف'},
            {icon:'fa-file-word', kw:'ملف وورد مستند'},
            {icon:'fa-file-excel', kw:'ملف إكسيل اكسل جدول'},
            {icon:'fa-file-image', kw:'ملف صورة صورة'},
            {icon:'fa-file-video', kw:'ملف فيديو مقطع فيديو'},
            {icon:'fa-file-archive', kw:'ملف مضغوط أرشيف'},
            {icon:'fa-file-code', kw:'ملف كود برمجة كود'},
            {icon:'fa-copy', kw:'نسخ استنساخ'},
            {icon:'fa-paste', kw:'لصق الصاق'},
            {icon:'fa-cut', kw:'قص قص'},
            {icon:'fa-print', kw:'طباعة طابعة برنت'},
            {icon:'fa-save', kw:'حفظ سيف'},
            {icon:'fa-folder', kw:'مجلد فولدر ملف'},
            {icon:'fa-folder-open', kw:'مجلد مفتوح فتح'},
            {icon:'fa-folder-plus', kw:'إضافة مجلد اضافة'},
            {icon:'fa-folder-tree', kw:'شجرة مجلدات فولدرات'},
            {icon:'fa-newspaper', kw:'جريدة صحيفة خبر'},
            {icon:'fa-book', kw:'كتاب قراءة'},
            // Security & Protection
            {icon:'fa-shield-halved', kw:'درع حماية نصف أمان'},
            {icon:'fa-shield-alt', kw:'درع حماية أمان'},
            {icon:'fa-shield', kw:'درع حماية'},
            {icon:'fa-lock', kw:'قفل مغلق أمان حماية'},
            {icon:'fa-lock-open', kw:'قفل مفتوح فتح'},
            {icon:'fa-unlock', kw:'فتح إلغاء قفل'},
            {icon:'fa-key', kw:'مفتاح كلمة سر'},
            {icon:'fa-safe', kw:'خزينة أمان حماية'},
            {icon:'fa-fingerprint', kw:'بصمة إصبع أمان'},
            {icon:'fa-eye', kw:'عين مشاهدة معاينة'},
            {icon:'fa-eye-slash', kw:'إخفاء عين ممنوع'},
            {icon:'fa-ban', kw:'ممنوع محظور رفض'},
            {icon:'fa-times-circle', kw:'دائرة خطأ إلغاء حذف'},
            {icon:'fa-check', kw:'صحيح موافق علامة صح'},
            {icon:'fa-check-double', kw:'تأكيد موافقة مضاعف صح'},
            {icon:'fa-filter', kw:'تصفية فلترة بحث'},
            {icon:'fa-sliders-h', kw:'إعدادات تحكم أشرطة تعديل'},
            {icon:'fa-toggle-on', kw:'تشغيل تفعيل ON'},
            {icon:'fa-toggle-off', kw:'إيقاف تعطيل OFF'},
            // Maps & Travel
            {icon:'fa-map', kw:'خريطة موقع'},
            {icon:'fa-map-marker-alt', kw:'علامة موقع مكان عنوان'},
            {icon:'fa-map-pin', kw:'دبوس خريطة تحديد موقع'},
            {icon:'fa-map-signs', kw:'لافتات خريطة إرشادات اتجاهات'},
            {icon:'fa-location-dot', kw:'موقع نقطة مكان عنوان'},
            {icon:'fa-location-arrow', kw:'سهم موقع اتجاه تحديد'},
            {icon:'fa-compass', kw:'بوصلة اتجاه'},
            {icon:'fa-globe', kw:'كرة أرضية عالم انترنت'},
            {icon:'fa-earth-asia', kw:'الأرض الكرة الأرضية عالم'},
            {icon:'fa-plane', kw:'طائرة سفر طيران'},
            {icon:'fa-plane-departure', kw:'طائرة إقلاع سفر'},
            {icon:'fa-plane-arrival', kw:'طائرة وصول هبوط'},
            {icon:'fa-car', kw:'سيارة عربية'},
            {icon:'fa-bus', kw:'باص حافلة نقل'},
            {icon:'fa-train', kw:'قطار مترو'},
            {icon:'fa-ship', kw:'سفينة مركب بحر'},
            {icon:'fa-bicycle', kw:'دراجة عجلة'},
            {icon:'fa-motorcycle', kw:'دراجة نارية موتوسيكل'},
            {icon:'fa-road', kw:'طريق شارع'},
            {icon:'fa-route', kw:'مسار طريق خط سير'},
            {icon:'fa-parking', kw:'موقف سيارات باركنج'},
            {icon:'fa-gas-pump', kw:'محطة وقود بنزين غاز'},
            {icon:'fa-charging-station', kw:'شحن كهرباء محطة شحن'},
            // Technology
            {icon:'fa-laptop', kw:'لابتوب حاسوب محمول كمبيوتر'},
            {icon:'fa-laptop-code', kw:'لابتوب برمجة كود برمجه'},
            {icon:'fa-laptop-house', kw:'لابتوب منزل'},
            {icon:'fa-desktop', kw:'كمبيوتر مكتبي شاشة حاسوب'},
            {icon:'fa-mobile', kw:'جوال موبايل هاتف محمول'},
            {icon:'fa-mobile-alt', kw:'جوال محمول هاتف'},
            {icon:'fa-tablet', kw:'جهاز لوحي تابلت آيباد'},
            {icon:'fa-tablet-alt', kw:'جهاز لوحي تابلت'},
            {icon:'fa-tv', kw:'تلفاز تلفزيون شاشة'},
            {icon:'fa-camera', kw:'كاميرا تصوير كامره'},
            {icon:'fa-camera-retro', kw:'كاميرا كلاسيك قديم رترو'},
            {icon:'fa-video', kw:'فيديو كاميرا تصوير مقطع'},
            {icon:'fa-video-slash', kw:'فيديو ممنوع إيقاف تصوير'},
            {icon:'fa-headphones', kw:'سماعات رأس سماعه'},
            {icon:'fa-microphone', kw:'ميكروفون مايك صوت'},
            {icon:'fa-microphone-slash', kw:'ميكروفون ممنوع كتم'},
            {icon:'fa-gamepad', kw:'يد تحكم ألعاب درع لعبه'},
            {icon:'fa-keyboard', kw:'لوحة مفاتيح كيبورد'},
            {icon:'fa-mouse', kw:'فأرة ماوس ماوس'},
            {icon:'fa-wifi', kw:'واي فاي اتصال شبكة لاسلكي'},
            {icon:'fa-bluetooth', kw:'بلوتوث لاسلكي'},
            {icon:'fa-database', kw:'قاعدة بيانات داتابيز DB'},
            {icon:'fa-server', kw:'سيرفر خادم استضافة'},
            {icon:'fa-cloud', kw:'سحابة كلود استضافة اونلاين'},
            {icon:'fa-cloud-upload-alt', kw:'رفع سحابة تحميل كلود'},
            {icon:'fa-cloud-download-alt', kw:'تحميل سحابة تنزيل كلود'},
            {icon:'fa-sync', kw:'مزامنة تزامن تحديث'},
            {icon:'fa-cog', kw:'إعدادات ضبط ترس عجله'},
            {icon:'fa-cogs', kw:'إعدادات ضبط تروس'},
            // UI & Arrows
            {icon:'fa-arrow-right', kw:'سهم يمين التالي'},
            {icon:'fa-arrow-left', kw:'سهم يسار السابق'},
            {icon:'fa-arrow-up', kw:'سهم أعلى فوق'},
            {icon:'fa-arrow-down', kw:'سهم أسفل تحت'},
            {icon:'fa-chevron-right', kw:'مثلث يمين تحديد'},
            {icon:'fa-chevron-left', kw:'مثلث يسار رجوع'},
            {icon:'fa-chevron-up', kw:'مثلث أعلى رفع'},
            {icon:'fa-chevron-down', kw:'مثلث أسفل توسيع'},
            {icon:'fa-chevron-circle-right', kw:'دائرة يمين'},
            {icon:'fa-chevron-circle-left', kw:'دائرة يسار'},
            {icon:'fa-angle-right', kw:'زاوية يمين'},
            {icon:'fa-angle-left', kw:'زاوية يسار'},
            {icon:'fa-angle-double-right', kw:'زاوية مزدوجة يمين'},
            {icon:'fa-angle-double-left', kw:'زاوية مزدوجة يسار'},
            {icon:'fa-caret-down', kw:'مؤشر أسفل قائمة منسدلة'},
            {icon:'fa-caret-up', kw:'مؤشر أعلى رفع'},
            {icon:'fa-sort', kw:'ترتيب فرز تصنيف'},
            {icon:'fa-sort-up', kw:'ترتيب تصاعدي فرز'},
            {icon:'fa-sort-down', kw:'ترتيب تنازلي فرز'},
            {icon:'fa-long-arrow-alt-right', kw:'سهم طويل يمين'},
            {icon:'fa-long-arrow-alt-left', kw:'سهم طويل يسار'},
            {icon:'fa-arrows-alt', kw:'أسهم اتجاهات تحريك'},
            {icon:'fa-arrows-alt-h', kw:'أسهم أفقي يسار يمين'},
            {icon:'fa-arrows-alt-v', kw:'أسهم رأسي أعلى أسفل'},
            {icon:'fa-expand', kw:'توسيع تكبير تمديد'},
            {icon:'fa-compress', kw:'تصغير طي ضغط'},
            {icon:'fa-expand-alt', kw:'توسيع بديل تكبير'},
            {icon:'fa-minus', kw:'ناقص طرح إزالة'},
            {icon:'fa-plus', kw:'زائد إضافة زيادة'},
            {icon:'fa-times', kw:'إغلاق حذف أزالة إلغاء'},
            // Business & Office
            {icon:'fa-briefcase', kw:'حقيبة عمل ملف وظيفة شغل'},
            {icon:'fa-briefcase-medical', kw:'حقيبة طبية طب'},
            {icon:'fa-building', kw:'مبنى شركة مؤسسة مقر مكتب'},
            {icon:'fa-chart-line', kw:'رسم بياني خط إحصاء تطور'},
            {icon:'fa-chart-bar', kw:'رسم بياني أعمدة إحصاء'},
            {icon:'fa-chart-pie', kw:'رسم بياني دائري إحصاء احصاء'},
            {icon:'fa-chart-area', kw:'رسم بياني مساحة إحصاء'},
            {icon:'fa-chart-simple', kw:'رسم بياني بسيط'},
            {icon:'fa-handshake', kw:'مصافحة اتفاق شراكة صفقه'},
            {icon:'fa-handshake-simple', kw:'مصافحة بسيطة'},
            {icon:'fa-hand-holding-usd', kw:'يد تحمل دولار مال'},
            {icon:'fa-hand-holding-dollar', kw:'يد تحمل دولار مال فلوس'},
            {icon:'fa-piggy-bank', kw:'بنك أصبع حصالة ادخار'},
            {icon:'fa-coins', kw:'عملات فلوس نقود'},
            {icon:'fa-sack-dollar', kw:'كيس فلوس نقود مال'},
            {icon:'fa-tasks', kw:'مهام مهمات قائمة أعمال'},
            {icon:'fa-list', kw:'قائمة عادية لائحة'},
            {icon:'fa-list-ul', kw:'قائمة نقطية تعداد نقط'},
            {icon:'fa-list-ol', kw:'قائمة مرقمة تعداد رقمي'},
            {icon:'fa-th-large', kw:'شبكة مربعات كبيرة جداول'},
            {icon:'fa-th', kw:'شبكة مربعات مربعات'},
            {icon:'fa-th-list', kw:'قائمة شبكة جداول'},
            {icon:'fa-table', kw:'جدول بيانات اكسل'},
            {icon:'fa-columns', kw:'أعمدة عمودين تخطيط'},
            // Nature & Food
            {icon:'fa-leaf', kw:'ورقة شجر نبات أخضر ورق'},
            {icon:'fa-tree', kw:'شجرة كريسمس عيد ميلاد'},
            {icon:'fa-seedling', kw:'شتلة بذرة زرع نبات'},
            {icon:'fa-flower', kw:'زهرة ورد زهور'},
            {icon:'fa-pagelines', kw:'ورقة نبات خطوط'},
            {icon:'fa-recycle', kw:'إعادة تدوير تدوير بيئة'},
            {icon:'fa-droplet', kw:'قطرة ماء سائل مطر'},
            {icon:'fa-fire', kw:'نار حريق لهب ساخن'},
            {icon:'fa-sun', kw:'شمس صيف حار ضوء'},
            {icon:'fa-moon', kw:'قمر ليل'},
            {icon:'fa-cloud-sun', kw:'غيمة شمس طقس جو'},
            {icon:'fa-apple-alt', kw:'تفاح فاكهة أبل ابل'},
            {icon:'fa-utensils', kw:'أدوات مائدة أدوات مطبخ'},
            {icon:'fa-hamburger', kw:'برجر همبرغر ساندويتش اكل'},
            {icon:'fa-pizza-slice', kw:'شريحة بيتزا اكل طعام'},
            {icon:'fa-coffee', kw:'قهوة كافيه مشروب قهوه'},
            {icon:'fa-mug-hot', kw:'كوب ساخن شاي مشروب'},
            {icon:'fa-cocktail', kw:'كوكتيل مشروب عصير'},
            {icon:'fa-glass-cheers', kw:'كأس نخب احتفال مشروب'},
            {icon:'fa-birthday-cake', kw:'كعكة عيد ميلاد حفلة'},
            {icon:'fa-candy-cane', kw:'حلوى عيد ميلاد'},
            {icon:'fa-cookie', kw:'بسكويت كوكيز حلو'},
            {icon:'fa-drumstick-bite', kw:'دجاج فخدة دجاج اكل طعام'},
            {icon:'fa-carrot', kw:'جزر خضار جزره'},
            {icon:'fa-bread-slice', kw:'خبز شريحة خبز عيش'},
            {icon:'fa-cheese', kw:'جبنة جبن جبنه'},
            {icon:'fa-egg', kw:'بيض بيضة'},
            // Misc
            {icon:'fa-certificate', kw:'شهادة توثيق معتمد موثق'},
            {icon:'fa-ribbon', kw:'شريط هدية زينة'},
            {icon:'fa-crown', kw:'تاج ملكة ملك'},
            {icon:'fa-king', kw:'ملك'},
            {icon:'fa-queen', kw:'ملكة'},
            {icon:'fa-diamond', kw:'ألماسة ماسة مجوهرات'},
            {icon:'fa-ring', kw:'خاتم دبلة مجوهرات محبس خطوبة زواج'},
            {icon:'fa-fire-flame-curved', kw:'نار لهب مشتعل flame'},
            {icon:'fa-circle', kw:'دائرة شكل دائري'},
            {icon:'fa-square', kw:'مربع مستطيل شكل'},
            {icon:'fa-infinity', kw:'لا نهائي مالا نهاية انفنتي'},
            {icon:'fa-link', kw:'رابط لينك اتصال link'},
            {icon:'fa-chains', kw:'سلاسل رابط'},
            {icon:'fa-palette', kw:'لوحة ألوان الألوان رسم الوان'},
            {icon:'fa-paint-brush', kw:'فرشاة دهان طلاء رسم brush'},
            {icon:'fa-paint-roller', kw:'أسطوانة دهان طلاء'},
            {icon:'fa-wand-magic-sparkles', kw:'عصا سحرية سحر magic wand'},
            {icon:'fa-screwdriver-wrench', kw:'مفك براغي عدة صيانة'},
            {icon:'fa-tools', kw:'أدوات صيانة عدة اصلاح'},
            {icon:'fa-wrench', kw:'مفتاح ربط صيانة مفتاح'},
            {icon:'fa-hammer', kw:'مطرقة شاكوش'},
            {icon:'fa-plug', kw:'قابس كهرباء شاحن'},
            {icon:'fa-lightbulb', kw:'لمبة ضوء فكرة'},
            {icon:'fa-battery-full', kw:'بطارية كاملة شحن مشحون'},
            {icon:'fa-battery-three-quarters', kw:'بطارية ثلاثة أرباع شحن'},
            {icon:'fa-snowflake', kw:'ندفة ثلج ثلج شتاء بارد'},
            {icon:'fa-umbrella', kw:'مظلة شمسية مطر'},
            {icon:'fa-umbrella-beach', kw:'مظلة شاطئ صيف مصيف'},
            {icon:'fa-swimmer', kw:'سباحة سباح'},
            {icon:'fa-dumbbell', kw:'دمبل حديد رياضي جيم'},
            {icon:'fa-running', kw:'جري ركض عداء رياضة'},
            {icon:'fa-walking', kw:'مشي تمشية'},
            {icon:'fa-heartbeat', kw:'قلب نبض صحي'},
            {icon:'fa-pulse', kw:'نبض صحي قلب'},
            {icon:'fa-stethoscope', kw:'سماعة طبيب طب دكتور صحه'},
            {icon:'fa-syringe', kw:'حقنة إبرة طب مستشفى ابره'},
            {icon:'fa-flask', kw:'قوارير مختبر كيمياء'},
            {icon:'fa-microscope', kw:'مجهر فحص مختبر'},
            {icon:'fa-search', kw:'بحث ابحث عن'},
            {icon:'fa-search-plus', kw:'بحث تكبير زوم بحث'},
            {icon:'fa-search-minus', kw:'بحث تصغير زوم بحث'},
            {icon:'fa-download', kw:'تحميل تنزيل'},
            {icon:'fa-upload', kw:'رفع رفع ملف'},
            {icon:'fa-flag', kw:'علم دولة علم راية'},
            {icon:'fa-bookmark', kw:'علامة مرجعية حفظ اشارة مرجعيه'},
            {icon:'fa-star-half-alt', kw:'نصف نجمة تقييم تقييم نصف'},
            {icon:'fa-star-half', kw:'نصف نجمة'},
            {icon:'fa-star-of-life', kw:'نجمة الحياة طب طوارئ'},
            {icon:'fa-calendar', kw:'تقويم تاريخ يوم'},
            {icon:'fa-calendar-alt', kw:'تقويم بديل تاريخ'},
            {icon:'fa-calendar-check', kw:'تقويم موافقة موعد حجز'},
            {icon:'fa-calendar-plus', kw:'تقويم إضافة اضافة موعد'},
            {icon:'fa-calendar-day', kw:'تقويم يوم موعد'},
            {icon:'fa-calendar-week', kw:'تقويم أسبوع اسبوع'},
            {icon:'fa-hourglass', kw:'ساعة رملية زمن وقت'},
            {icon:'fa-hourglass-half', kw:'ساعة رملية نصف'},
            {icon:'fa-hourglass-end', kw:'ساعة رملية نهاية انتهى'},
            {icon:'fa-stopwatch', kw:'ساعة إيقاف مؤقت زمن ساعه'},
            {icon:'fa-timer', kw:'مؤقت زمني توقيت ساعه timer'},
            {icon:'fa-alarm-clock', kw:'منبه إنذار صباح'},
            {icon:'fa-history', kw:'تاريخ سجل التاريح'},
            {icon:'fa-redo', kw:'إعادة تكرار اعادة'},
            {icon:'fa-undo-alt', kw:'تراجع رجوع'},
            {icon:'fa-reply', kw:'رد إجابة اجابه'},
            {icon:'fa-reply-all', kw:'رد الجميع'},
            {icon:'fa-forward', kw:'تقدم أمام إعادة'},
            {icon:'fa-backward', kw:'رجوع خلف'},
            {icon:'fa-play', kw:'تشغيل بدء play'},
            {icon:'fa-pause', kw:'إيقاف مؤقت توقف pause'},
            {icon:'fa-stop', kw:'إيقاف توقف stop'},
            {icon:'fa-step-forward', kw:'خطوة للأمام'},
            {icon:'fa-step-backward', kw:'خطوة للخلف'},
            {icon:'fa-fast-forward', kw:'تقديم سريع'},
            {icon:'fa-fast-backward', kw:'ترجيع سريع'},
            {icon:'fa-eject', kw:'إخراج تخرج اخراج eject'},
            {icon:'fa-ellipsis-h', kw:'نقاط أفقية أفقي قائمة'},
            {icon:'fa-ellipsis-v', kw:'نقاط رأسية رأسي قائمة'},
            {icon:'fa-grip-horizontal', kw:'قبضة أفقية ترتيب'},
            {icon:'fa-grip-vertical', kw:'قبضة رأسية ترتيب'},
            {icon:'fa-grip-lines', kw:'خطوط قائمة مربع'},
            {icon:'fa-ad', kw:'إعلان دعاية اعلان'},
            {icon:'fa-bullseye', kw:'هدف نقطة تركيز'},
            {icon:'fa-crosshairs', kw:'مشهدان تصويب تحديد'},
            {icon:'fa-home', kw:'الرئيسية رئيسية بيت'},
            {icon:'fa-home-lg', kw:'رئيسية منزل كبير'},
            {icon:'fa-house', kw:'منزل بيت'},
            {icon:'fa-door-open', kw:'باب مفتوح فتح'},
            {icon:'fa-door-closed', kw:'باب مغلق إغلاق'},
            {icon:'fa-window', kw:'نافذة إطار منظره'},
            {icon:'fa-window-minimize', kw:'تصغير نافذة تصغير'},
            {icon:'fa-window-maximize', kw:'تكبير نافذة تكبير'},
            {icon:'fa-window-restore', kw:'استعادة نافذة تدوير'},
        ];

        function openIconPicker(box) {
            let picker = document.getElementById('iconPickerOverlay');
            if(!picker) {
                picker = document.createElement('div');
                picker.id = 'iconPickerOverlay';
                picker.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:none; align-items:center; justify-content:center;';
                picker.innerHTML = `
                    <div style="background:#fff; padding:20px; border-radius:20px; max-width:600px; width:95%; max-height:85vh; display:flex; flex-direction:column;">
                        <h4 style="margin-bottom:12px; text-align:center;">اختر الأيقونة <span style="font-size:12px;color:var(--text-muted);font-weight:400;">(${commonIcons.length} أيقونة)</span></h4>
                        <input type="text" id="iconSearchInput" placeholder="ابحث عن أيقونة..." style="width:100%;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:13px;margin-bottom:12px;outline:none;font-family:inherit;" oninput="filterIcons(this.value)">
                        <div id="iconsGrid" style="display:grid; grid-template-columns: repeat(6, 1fr); gap:8px; overflow-y:auto; padding:5px;"></div>
                        <div style="margin-top:10px; padding-top:12px; border-top:1px solid #e2e8f0;">
                            <div style="font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">أو أدخل كود أيقونة (FontAwesome) أو رابط صورة:</div>
                            <div style="display:flex; gap:8px;">
                                <input type="text" id="customIconInput" placeholder="مثال: fa-star  أو  https://example.com/icon.png" style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;font-family:inherit;" oninput="previewCustomIcon(this.value)">
                                <button class="btn btn-primary" onclick="applyCustomIcon()" style="white-space:nowrap;"><i class="fas fa-check"></i> استخدام</button>
                            </div>
                            <div id="customIconPreview" style="margin-top:8px; display:flex; align-items:center; gap:10px; min-height:40px;">
                                <span style="font-size:13px; color:#94a3b8;">معاينة:</span>
                                <i id="customIconPreviewTag" class="fas fa-icons" style="font-size:24px; color:#94a3b8; display:none;"></i>
                                <img id="customIconPreviewImg" style="width:40px; height:40px; border-radius:8px; object-fit:cover; display:none;">
                                <span id="customIconPreviewText" style="font-size:12px; color:#94a3b8;"></span>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="width:100%; margin-top:12px; flex-shrink:0;" onclick="document.getElementById('iconPickerOverlay').style.display='none'">إغلاق</button>
                    </div>
                `;
                document.body.appendChild(picker);
                
                const grid = document.getElementById('iconsGrid');
                commonIcons.forEach(item => {
                    const iBox = document.createElement('div');
                    iBox.className = 'icon-pick-item';
                    iBox.dataset.icon = item.icon;
                    iBox.dataset.kw = item.kw || '';
                    iBox.style = 'padding:8px; border:1px solid #eee; border-radius:8px; cursor:pointer; text-align:center; font-size:18px; transition:0.15s;';
                    iBox.innerHTML = `<i class="fas ${item.icon}"></i>`;
                    iBox.onclick = () => {
                        setIconFromPicker(item.icon);
                        picker.style.display = 'none';
                    };
                    grid.appendChild(iBox);
                });
                
                window.filterIcons = function(query) {
                    const term = query.toLowerCase().trim();
                    document.querySelectorAll('.icon-pick-item').forEach(el => {
                        const match = !term || el.dataset.icon.includes(term) || (el.dataset.kw || '').includes(term);
                        el.style.display = match ? '' : 'none';
                    });
                };
                
                window.previewCustomIcon = function(val) {
                    const tag = document.getElementById('customIconPreviewTag');
                    const img = document.getElementById('customIconPreviewImg');
                    const txt = document.getElementById('customIconPreviewText');
                    tag.style.display = 'none';
                    img.style.display = 'none';
                    txt.textContent = '';
                    if (!val.trim()) return;
                    if (val.trim().startsWith('fa-')) {
                        tag.className = 'fas ' + val.trim();
                        tag.style.display = 'inline-block';
                        tag.style.color = 'var(--primary)';
                        txt.textContent = ' (FontAwesome)';
                    } else if (val.trim().startsWith('http://') || val.trim().startsWith('https://')) {
                        img.src = val.trim();
                        img.style.display = 'inline-block';
                        txt.textContent = ' (صورة)';
                    } else {
                        txt.textContent = '❌ أدخل fa-... أو رابط صورة';
                    }
                };
                
                window.applyCustomIcon = function() {
                    const val = document.getElementById('customIconInput').value.trim();
                    if (!val) return;
                    if (val.startsWith('fa-')) {
                        setIconFromPicker(val);
                        picker.style.display = 'none';
                    } else if (val.startsWith('http://') || val.startsWith('https://')) {
                        // URL icon: update the cat_icon_url field directly
                        const iconUrlInput = document.getElementById('cat_icon_url');
                        if (iconUrlInput) iconUrlInput.value = val;
                        // Update picker box preview
                        const box = window.currentPickingBox;
                        if (box) {
                            const iTag = box.querySelector('i');
                            if (iTag) { iTag.className = 'fas fa-image'; iTag.style.color = 'var(--primary)'; }
                            const hiddenInput = box.querySelector('input');
                            if (hiddenInput) hiddenInput.value = val;
                        }
                        picker.style.display = 'none';
                    }
                };
                
                window.setIconFromPicker = function(iconClass) {
                    const box = window.currentPickingBox;
                    if (!box) return;
                    const iTag = box.querySelector('i');
                    if (iTag) { iTag.className = 'fas ' + iconClass; iTag.style.color = 'var(--primary)'; }
                    const hiddenInput = box.querySelector('input');
                    if (hiddenInput) hiddenInput.value = iconClass;
                    // Clear URL field since we're using a FontAwesome icon
                    const urlInput = document.getElementById('cat_icon_url');
                    if (urlInput) urlInput.value = '';
                };
            }
            window.currentPickingBox = box;
            // Sync existing URL into custom input if present
            const urlInput = document.getElementById('cat_icon_url');
            const customInput = document.getElementById('customIconInput');
            if (customInput && urlInput && urlInput.value) {
                customInput.value = urlInput.value;
                previewCustomIcon(urlInput.value);
            } else if (customInput) {
                const hiddenInput = box.querySelector('input');
                if (customInput && hiddenInput && hiddenInput.value) {
                    customInput.value = hiddenInput.value;
                    previewCustomIcon(hiddenInput.value);
                }
            }
            picker.style.display = 'flex';
        }

        function triggerUploadForSection(btn) {
            const input = btn.previousElementSibling;
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64 = event.target.result;
                    const formData = new FormData();
                    formData.append('image', base64);
                    const res = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', {
                        method: 'POST',
                        body: formData
                    });
                    const json = await res.json();
                    if (json.data && json.data.url) {
                        input.value = json.data.url;
                        showToast('✅ تم رفع صورة القسم بنجاح');
                    }
                };
                reader.readAsDataURL(file);
            };
            fileInput.click();
        }

        async function openEditById(id) {
            const product = allProducts.find(p => p.id == id);
            if(!product) return;
            
            document.getElementById('editorTitle').innerText = 'تعديل: ' + product.name;
            document.getElementById('prod_id').value = product.id;
            document.getElementById('prod_name').value = product.name;
            document.getElementById('prod_price').value = product.price;
            document.getElementById('prod_salePrice').value = product.salePrice || '';
            document.getElementById('prod_wholesalePrice').value = product.wholesalePrice || '';
            document.getElementById('prod_costPrice').value = product.costPrice || '';
            document.getElementById('prod_stock').value = (product.advanced && product.advanced.stock !== undefined && product.advanced.stock !== null) ? product.advanced.stock : '';
            document.getElementById('prod_sku').value = product.sku || '';
            document.getElementById('prod_desc').value = product.description || '';
            document.getElementById('prod_adminNote').value = product.adminNote || '';
            

            // Gallery
            currentGalleryUnified = [];
            if(product.image) currentGalleryUnified.push(product.image);
            if(product.images && Array.isArray(product.images) && product.images.length > 0) {
                if(product.images[0] === product.image) {
                    currentGalleryUnified.push(...product.images.slice(1));
                } else {
                    currentGalleryUnified.push(...product.images);
                }
            }
            
            // Video
            currentVideoUrl = (product.advanced && product.advanced.productVideo) || (product.video) || '';
            if (currentVideoUrl) {
                currentGalleryUnified.push('video:' + currentVideoUrl);
            }
            
            renderGallery();

            // Categories
            selectedCategoryIds = Array.isArray(product.categories) ? [...product.categories] : (product.category ? [product.category] : []);
            renderCategoryChips();

            // Variants
            const varContainer = document.getElementById('variants_container');
            varContainer.innerHTML = '';
            window.currentProductVariantsData = product.variantsData || []; // Store combinations data
            
            if(product.variants && product.variants.length) {
                product.variants.forEach(v => addVariantOption(v));
            }

            // Marketing
            document.getElementById('prod_fakeVisitors').checked = !!product.fakeVisitors;
            document.getElementById('prod_fakeStock').checked = !!product.fakeStock;
            document.getElementById('prod_fakeTimer').checked = !!product.fakeTimer;
            document.getElementById('prod_isLandingPage').checked = !!product.isLandingPage;
            document.getElementById('prod_isComingSoon').checked = !!(product.advanced && product.advanced.isComingSoon);
            document.getElementById('prod_comingSoonDate').value = (product.advanced && product.advanced.comingSoonDate) || '';
            document.getElementById('comingSoonDateContainer').style.display = (product.advanced && product.advanced.isComingSoon) ? 'block' : 'none';
            document.getElementById('prod_isRecommended').checked = !!(product.advanced && product.advanced.isRecommended);
            toggleLandingSections(!!product.isLandingPage);
            
            // Render Landing Sections
            const sectionsContainer = document.getElementById('landingSectionsContainer');
            sectionsContainer.innerHTML = '';
            if (product.landingSections && Array.isArray(product.landingSections)) {
                product.landingSections.forEach(s => addLandingSection(s));
            }

            // View Product Button logic
            let viewBtn = document.getElementById('viewProductBtn');
            const headerActions = document.getElementById('publishBtn').parentElement;
            if(!viewBtn) {
                viewBtn = document.createElement('a');
                viewBtn.id = 'viewProductBtn';
                viewBtn.className = 'btn btn-outline';
                viewBtn.target = '_blank';
                viewBtn.style.cssText = 'padding:12px 20px; text-decoration:none; display:flex; align-items:center; gap:5px; border-color:var(--primary); color:var(--primary); font-weight:700;';
                viewBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> شاهد المنتج';
                headerActions.prepend(viewBtn);
            }
            viewBtn.href = 'index.html#?product=' + product.id;
            viewBtn.style.display = 'flex';

            const publishBtn = document.getElementById('publishBtn');
            if(publishBtn) publishBtn.innerText = 'حفظ التعديلات';

            // Update URL to persist on refresh
            const url = new URL(window.location);
            url.searchParams.set('edit', product.id);
            window.history.replaceState({}, '', url);

            switchTab('tab-product-editor');
        }

        function openAIModal() {
            document.getElementById('aiModal').style.display = 'flex';
        }

        function closeAIModal() {
            document.getElementById('aiModal').style.display = 'none';
        }

        async function generateWithAI() {
            const btn = document.getElementById('aiGenerateBtn');
            const desc = document.getElementById('ai_prod_desc_short').value;
            
            if (!desc) {
                alert('يرجى كتابة وصف قصير للمنتج أولاً');
                return;
            }

            const data = {
                reviews_count: document.getElementById('ai_reviews_toggle').checked ? (parseInt(document.getElementById('ai_reviews_count').value) || 0) : 0,
                faqs_count: document.getElementById('ai_faqs_toggle').checked ? (parseInt(document.getElementById('ai_faqs_count').value) || 0) : 0,
                features_count: document.getElementById('ai_features_toggle').checked ? (parseInt(document.getElementById('ai_features_count').value) || 0) : 0,
                language: document.getElementById('ai_language').value,
                dialect: document.getElementById('ai_dialect').value,
                country: document.getElementById('ai_country').value,
                description: desc
            };

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الذكاء الاصطناعي...';

            try {
                alert('ميزة الذكاء الاصطناعي غير متاحة على GitHub Pages. يرجى إنشاء المحتوى يدوياً.');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-magic"></i> ابدأ الإنشاء الآن';
                return;
            } catch (e) {
                console.error('AI Generate Error:', e);
                alert('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-magic"></i> ابدأ الإنشاء الآن';
            }
        }

        document.getElementById('productForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = document.getElementById('publishBtn');
            const originalText = btn.innerText;
            btn.innerText = 'جاري الحفظ...';
            btn.disabled = true;

            const hiddenCat = document.getElementById('prod_categories_json');
            if (hiddenCat) {
                hiddenCat.value = JSON.stringify(selectedCategoryIds);
            }

            // Collect Variants
            const variants = [];
            document.querySelectorAll('.variant-option-card').forEach(card => {
                const values = [];
                card.querySelectorAll('.variant-value-row').forEach(row => {
                    const colInput = row.querySelector('.val-color');
                    values.push({
                        value: row.querySelector('.val-name').value.trim(),
                        price: row.querySelector('.val-price').value.trim(),
                        wholesalePrice: row.querySelector('.val-wholesale-price').value.trim(),
                        image: row.querySelector('.val-image').value.trim(),
                        stock: row.querySelector('.val-stock').value.trim(),
                        color: colInput ? colInput.value : '#4f46e5'
                    });
                });
                variants.push({
                    name: card.querySelector('.variant-name').value.trim(),
                    type: card.querySelector('.variant-type').value,
                    values: values
                });
            });

            document.getElementById('prod_variants_json').value = JSON.stringify({ options: variants, data: [] });

            // Collect Landing Sections
            const landingSections = [];
            document.querySelectorAll('.landing-section-row').forEach(row => {
                const section = {
                    type: row.querySelector('.section-type').value,
                    image: row.querySelector('.section-img')?.value || '',
                    title: row.querySelector('.section-title')?.value || '',
                    text: row.querySelector('.section-text')?.value || '',
                    videoUrl: row.querySelector('.section-videoUrl')?.value || '',
                    direction: row.querySelector('.section-direction')?.value || 'right',
                    features: []
                };

                // Collect Features if type is features
                if (section.type === 'features') {
                    row.querySelectorAll('.feature-item-row').forEach(fRow => {
                        section.features.push({
                            icon: fRow.querySelector('.feature-icon').value,
                            title: fRow.querySelector('.feature-title').value,
                            text: fRow.querySelector('.feature-text').value
                        });
                    });
                }

                landingSections.push(section);
            });
            document.getElementById('prod_landingSections_json').value = JSON.stringify(landingSections);

            // Convert FormData to a plain object
            const formData = new FormData(this);
            const data = {};
            formData.forEach((value, key) => {
                if (key === 'tab') return;
                if (key.endsWith('[]')) {
                    if (!data[key]) data[key] = [];
                    data[key].push(value);
                } else {
                    data[key] = value;
                }
            });
            
            // Add checkbox values explicitly (overwrites FormData which only sends checked ones)
            const checkboxes = this.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (cb.name && !cb.name.startsWith('tab')) {
                    data[cb.name] = cb.checked;
                }
            });

            // Map hidden JSON fields to DB column names and parse
            if (data.categories_json) {
                try { data.categories = JSON.parse(data.categories_json); } catch(e) { data.categories = []; }
                delete data.categories_json;
            }
            if (data.variants_json) {
                try {
                    const vObj = JSON.parse(data.variants_json);
                    data.variants = Array.isArray(vObj.options) ? vObj.options : (Array.isArray(vObj) ? vObj : []);
                    data.variantsData = Array.isArray(vObj.data) ? vObj.data : [];
                } catch(e) { data.variants = []; data.variantsData = []; }
                delete data.variants_json;
            }
            if (data.landingSections_json) {
                try { data.landingSections = JSON.parse(data.landingSections_json); } catch(e) { data.landingSections = []; }
                delete data.landingSections_json;
            }

            // Collect advanced fields into the advanced JSONB column
            // First, preserve existing advanced data from the loaded product
            const existingProduct = allProducts.find(p => String(p.id) === String(data.id));
            data.advanced = (existingProduct && existingProduct.advanced) ? { ...existingProduct.advanced } : {};
            ['isComingSoon', 'isRecommended'].forEach(key => {
                if (key in data) {
                    data.advanced[key] = !!data[key];
                    delete data[key];
                }
            });
            if (data.comingSoonDate) {
                data.advanced.comingSoonDate = data.comingSoonDate;
            }
            delete data.comingSoonDate;
            if (data.stock !== undefined && data.stock !== '') {
                data.advanced.stock = parseInt(data.stock) || 0;
                delete data.stock;
            }

            // Save the entire gallery array (main image + extra images)
            data.images = currentGalleryUnified.filter(i => typeof i === 'string' && !i.startsWith('video:'));
            delete data.extraImages;
            // Move productVideo into advanced
            if (data.productVideo) {
                data.advanced.productVideo = data.productVideo;
            }
            delete data.productVideo;

            try {
                const result = await DB.saveProduct(data);
                if (result) {
                    // Refresh products list
                    allProducts = await DB.getProducts();
                    
                    openEditById(data.id);
                    showToast('✅ تم حفظ وتحديث المنتج بنجاح!');
                } else {
                    throw new Error('Save failed');
                }
            } catch (error) {
                console.error('Save Error:', error);
                alert('حدث خطأ أثناء الحفظ.\n\nتفاصيل الخطأ: ' + (error.message || 'غير معروف') + '\n\nراجع Console للتفاصيل.');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });

        // Simple Toast implementation
        function showToast(msg) {
            const toast = document.createElement('div');
            toast.style = "position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#0f172a; color:white; padding:15px 30px; border-radius:50px; font-weight:800; z-index:100000; box-shadow:0 10px 30px rgba(0,0,0,0.3); animation: slideUp 0.3s forwards;";
            toast.innerHTML = msg;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = "slideDown 0.3s forwards";
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        const toastStyles = document.createElement('style');
        toastStyles.innerHTML = `
            @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
            @keyframes slideDown { from { bottom: 30px; opacity: 1; } to { bottom: -50px; opacity: 0; } }
        `;
        document.head.appendChild(toastStyles);

        function triggerUpload(targetId, isMultiple = false) {
            // Determine if we should allow video based on targetId patterns
            const isVideoTarget = targetId === 'reelVideoUrlInput' || 
                                targetId.startsWith('hero_video_') || 
                                targetId.startsWith('video_url_') || 
                                targetId.startsWith('hero_slide_');
            
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = isMultiple;
            
            // If it's a target that can have video, allow both images and videos
            // Hero slides and main hero video can be either (images/videos)
            if (isVideoTarget) {
                input.accept = 'image/*,video/mp4,video/webm,video/*';
            } else {
                input.accept = 'image/*';
            }
            input.onchange = async () => {
                const files = input.files;
                if(!files.length) return;
                for(let file of files) {
                    // Size check: warn if > 80MB
                    if(file.size > 80 * 1024 * 1024) {
                        showToast('⚠️ حجم الملف كبير جداً (أكثر من 80MB). قد يستغرق رفعه وقتاً أو يفشل.');
                    }
                    showToast('⏳ جاري رفع الملف...');
                    try {
                        let url;
                        if(file.type.startsWith('video/')) {
                            // Use multipart form for videos
                            const formData = new FormData();
                            formData.append('image', file);
                            const res = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', { method: 'POST', body: formData });
                            const data = await res.json();
                            url = data.data.url;
                        } else {
                            // Use FormData for images via imgbb
                            const formData = new FormData();
                            formData.append('image', file);
                            const res = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', {
                                method: 'POST',
                                body: formData
                            });
                            const data = await res.json();
                            url = data.data.url;
                        }
                        if(url) {
                            if(targetId === 'gallery_add') {
                                // Add image to product gallery
                                currentGalleryUnified.push(url);
                                renderGallery();
                            } else if(targetId) {
                                const target = document.getElementById(targetId);
                                if(target) {
                                    target.value = url;
                                    target.dispatchEvent(new Event('input'));
                                    if (targetId.startsWith('slide_image_')) {
                                        const idx = parseInt(targetId.replace('slide_image_', ''));
                                        if (!isNaN(idx) && activeSlides[idx]) activeSlides[idx].image = url;
                                    }
                                    updatePreview(url, targetId + '_preview');
                                }
                            } else {
                                currentGalleryUnified.push(url);
                                renderGallery();
                            }
                            showToast('✅ تم الرفع بنجاح!');
                        }
                    } catch(err) {
                        showToast('❌ فشل رفع الملف. حاول مرة أخرى.');
                        console.error('Upload error:', err);
                    }
                }
            };
            input.click();
        }

        document.getElementById('categoryForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            const catId = document.getElementById('cat_id').value;
            const cat = {
                id: catId || 'cat_' + Date.now(),
                name: document.getElementById('cat_name').value,
                description: document.getElementById('cat_desc').value,
                image: document.getElementById('cat_image').value,
                icon: document.getElementById('cat_icon_url').value || document.getElementById('cat_icon').value,
                parentId: document.getElementById('cat_parentId').value,
                metaTitle: document.getElementById('cat_metaTitle').value,
                metaDesc: document.getElementById('cat_metaDesc').value,
                priority: document.getElementById('cat_priority').value !== '' ? parseInt(document.getElementById('cat_priority').value) : (catId ? (allCategories.find(c => c.id == catId)?.priority ?? 0) : (allCategories.length ? Math.max(...allCategories.map(c => c.priority || 0)) + 10 : 0)),
                isActive: document.getElementById('cat_isActive').checked,
                isBrand: document.getElementById('cat_isBrand').checked
            };
            const row = { id: cat.id, name: cat.name, description: cat.description, image: cat.image, icon: cat.icon, parent_id: cat.parentId, meta_title: cat.metaTitle, meta_desc: cat.metaDesc, priority: cat.priority, is_active: cat.isActive, is_brand: cat.isBrand };
            try {
                const { error } = await DB.supabase.from('categories').upsert(row, { onConflict: 'id' });
                if (error) { console.error('Supabase error:', error); showToast('❌ خطأ: ' + error.message); return; }
                showToast('✅ تم حفظ القسم بنجاح');
                loadCategories();
                switchTab('tab-categories');
            } catch(err) {
                console.error('Category save error:', err);
                showToast('❌ فشل حفظ القسم: ' + (err.message || err));
            }
            return false;
        });

        async function loadCategories() {
            allCategories = await DB.getCategories();
            allCategories.sort((a, b) => (a.priority || 0) - (b.priority || 0));
            window.allCategories = allCategories;
            window._allCats = allCategories;

            // Populate parent category dropdown in editor
            const parentSelect = document.getElementById('cat_parentId');
            if (parentSelect) {
                const currentVal = parentSelect.value;
                const parentCats = allCategories.filter(c => !c.parentId);
                parentSelect.innerHTML = '<option value="">لا يوجد (قسم رئيسي)</option>' + parentCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                if (currentVal) parentSelect.value = currentVal;
            }

            const tbody = document.querySelector('#categoriesTable tbody');
            if (!tbody) return;
            if (!allCategories || allCategories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">لا توجد تصنيفات بعد</td></tr>';
                return;
            }
            tbody.innerHTML = allCategories.map((c, ci) => {
                const parent = allCategories.find(p => p.id === c.parentId);
                const productCount = allProducts.filter(p => (p.categories || []).includes(c.id)).length;
                return `<tr>
                    <td><img src="${c.image || ''}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; ${!c.image ? 'border:1px dashed #e2e8f0;' : ''}"></td>
                    <td style="font-weight:700;">${c.name} ${c.isBrand ? '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">علامة تجارية</span>' : ''}</td>
                    <td>${parent ? parent.name : '—'}</td>
                    <td>${productCount}</td>
                    <td style="font-size:11px;color:var(--text-muted);">${c.priority || 0}</td>
                    <td>
                        <button onclick="openCategoryEdit('${c.id}')" style="background:#eef2ff;color:#4f46e5;border:1px solid #c7d2fe;padding:5px 12px;border-radius:8px;cursor:pointer;font-family:inherit;margin-left:5px;" title="تعديل"><i class="fas fa-edit"></i></button>
                        ${ci > 0 ? `<button onclick="moveCategory(${ci}, -1)" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:5px 9px;border-radius:8px;cursor:pointer;font-family:inherit;margin-left:5px;" title="رفع للأعلى"><i class="fas fa-chevron-up"></i></button>` : ''}
                        ${ci < allCategories.length - 1 ? `<button onclick="moveCategory(${ci}, 1)" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca;padding:5px 9px;border-radius:8px;cursor:pointer;font-family:inherit;margin-left:5px;" title="خفض للأسفل"><i class="fas fa-chevron-down"></i></button>` : ''}
                        <button onclick="deleteCategory('${c.id}')" style="background:#fef2f2;color:#ef4444;border:1px solid #fee2e2;padding:5px 12px;border-radius:8px;cursor:pointer;font-family:inherit;" title="حذف"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }
        window.loadCategories = loadCategories;

        window.moveCategory = async function(index, dir) {
            const target = index + dir;
            if (target < 0 || target >= allCategories.length) return;
            // Swap positions in array and update priorities to match new indices
            [allCategories[index], allCategories[target]] = [allCategories[target], allCategories[index]];
            allCategories[index].priority = index * 10;
            allCategories[target].priority = target * 10;
            // Save only the two swapped categories
            await Promise.all([DB.saveCategory(allCategories[index]), DB.saveCategory(allCategories[target])]);
            window.allCategories = allCategories;
            loadCategories();
        };

        async function deleteCategory(id) {
            if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
            try {
                await DB.deleteCategory(id);
                showToast('✅ تم حذف القسم');
                loadCategories();
            } catch(err) {
                showToast('❌ فشل الحذف');
            }
        }
        window.deleteCategory = deleteCategory;

        function filterTable(input, tableId) {
            const filter = input.value.toLowerCase();
            const table = document.getElementById(tableId);
            if(!table) return;
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(filter) ? '' : 'none';
            });
        }

        // --- Orders Status Filtering ---
        window._currentOrderStatusFilter = '';

        function filterOrdersByStatus(status) {
            window._currentOrderStatusFilter = status;
            window._currentOrderTextFilter = '';

            // Update search input
            const searchInput = document.getElementById('ordersSearchInput');
            if (searchInput) searchInput.value = '';

            // Update chip active states
            document.querySelectorAll('.order-filter-chip').forEach(btn => {
                const isActive = btn.dataset.status === status;
                if (isActive) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Update filter label
            const label = document.getElementById('ordersFilterLabel');
            if (label) {
                if (status) {
                    label.style.display = 'block';
                    label.innerHTML = `<i class="fas fa-filter" style="color:var(--primary); margin-left:6px;"></i> يتم عرض طلبات بحالة: <strong style="color:var(--primary);">${status}</strong>
                        <span onclick="filterOrdersByStatus('')" style="margin-right:12px; color:#ef4444; cursor:pointer; font-size:12px;"><i class="fas fa-times"></i> إزالة الفلتر</span>`;
                } else {
                    label.style.display = 'none';
                }
            }

            // Filter rows
            const tbody = document.getElementById('ordersTableBody');
            if (!tbody) return;
            tbody.querySelectorAll('tr').forEach(row => {
                if (!status) {
                    row.style.display = '';
                } else {
                    const rowText = row.innerText;
                    row.style.display = rowText.includes(status) ? '' : 'none';
                }
            });
        }

        function filterOrdersByText(text) {
            window._currentOrderTextFilter = text;
            const status = window._currentOrderStatusFilter || '';
            const tbody = document.getElementById('ordersTableBody');
            if (!tbody) return;
            tbody.querySelectorAll('tr').forEach(row => {
                const rowText = row.innerText.toLowerCase();
                const matchesText = !text || rowText.includes(text.toLowerCase());
                const matchesStatus = !status || rowText.includes(status);
                row.style.display = (matchesText && matchesStatus) ? '' : 'none';
            });
        }

// --- Sort Orders by Date ---
        let _sortDateAsc = false;
        function sortOrdersByDate(th) {
            _sortDateAsc = !_sortDateAsc;
            const icon = document.getElementById('sort-date-icon');
            if(icon) { icon.className = _sortDateAsc ? 'fas fa-sort-up' : 'fas fa-sort-down'; icon.style.opacity='1'; icon.style.color='var(--primary)'; }

            const tbody = document.getElementById('ordersTableBody');
            if(!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.sort((a, b) => {
                // find the date cell (7th td = index 6)
                const dateA = a.querySelectorAll('td')[6]?.innerText || '';
                const dateB = b.querySelectorAll('td')[6]?.innerText || '';
                return _sortDateAsc
                    ? dateA.localeCompare(dateB, 'ar')
                    : dateB.localeCompare(dateA, 'ar');
            });
            rows.forEach(r => tbody.appendChild(r));
        }

        // --- Abandoned Carts Pagination ---
        let abandonedPage = 1;
        let abandonedPerPage = 50;
        let abandonedSearchTerm = '';

        function getFilteredAbandoned() {
            if (!abandonedSearchTerm) return window._abandonedData || [];
            const term = abandonedSearchTerm.toLowerCase();
            return (window._abandonedData || []).filter(c =>
                (c.name && c.name.toLowerCase().includes(term)) ||
                (c.phone && c.phone.toLowerCase().includes(term)) ||
                (c.email && c.email.toLowerCase().includes(term))
            );
        }

        function updateAbandonedPaginationUI() {
            const filtered = getFilteredAbandoned();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / abandonedPerPage));
            if (abandonedPage > totalPages) abandonedPage = totalPages;

            const pagination = document.getElementById('abandonedPagination');
            if (!pagination) return;
            pagination.style.display = totalItems > 0 ? 'flex' : 'none';

            document.getElementById('abandonedPaginationInfo').textContent = `إجمالي ${totalItems} طلب — صفحة ${abandonedPage} من ${totalPages}`;

            const pageNav = document.getElementById('abandonedPaginationPages');
            const firstBtn = document.getElementById('abandonedPaginationFirst');
            const prevBtn = document.getElementById('abandonedPaginationPrev');
            const nextBtn = document.getElementById('abandonedPaginationNext');
            const lastBtn = document.getElementById('abandonedPaginationLast');
            const showNav = totalPages > 1;
            [firstBtn, prevBtn, nextBtn, lastBtn, pageNav].forEach(el => { if (el) el.style.display = showNav ? '' : 'none'; });
            if (!showNav) return;

            let pagesHTML = '';
            const range = 2;
            const start = Math.max(1, abandonedPage - range);
            const end = Math.min(totalPages, abandonedPage + range);
            if (start > 1) {
                pagesHTML += `<button onclick="goToAbandonedPage(1)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">1</button>`;
                if (start > 2) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
            }
            for (let p = start; p <= end; p++) {
                pagesHTML += `<button onclick="goToAbandonedPage(${p})" style="padding:6px 10px;border:1px solid ${p === abandonedPage ? 'var(--primary)' : 'var(--border)'};border-radius:6px;background:${p === abandonedPage ? 'var(--primary)' : 'white'};cursor:pointer;font-size:12px;font-weight:${p === abandonedPage ? '800' : '400'};color:${p === abandonedPage ? 'white' : 'var(--gray-600)'};">${p}</button>`;
            }
            if (end < totalPages) {
                if (end < totalPages - 1) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
                pagesHTML += `<button onclick="goToAbandonedPage(${totalPages})" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">${totalPages}</button>`;
            }
            pageNav.innerHTML = pagesHTML;

            firstBtn.style.opacity = abandonedPage <= 1 ? '0.3' : '1';
            firstBtn.disabled = abandonedPage <= 1;
            prevBtn.style.opacity = abandonedPage <= 1 ? '0.3' : '1';
            prevBtn.disabled = abandonedPage <= 1;
            nextBtn.style.opacity = abandonedPage >= totalPages ? '0.3' : '1';
            nextBtn.disabled = abandonedPage >= totalPages;
            lastBtn.style.opacity = abandonedPage >= totalPages ? '0.3' : '1';
            lastBtn.disabled = abandonedPage >= totalPages;
        }

        function goToAbandonedPage(dest) {
            const filtered = getFilteredAbandoned();
            const totalPages = Math.max(1, Math.ceil(filtered.length / abandonedPerPage));
            if (dest === 'first') abandonedPage = 1;
            else if (dest === 'prev') abandonedPage = Math.max(1, abandonedPage - 1);
            else if (dest === 'next') abandonedPage = Math.min(totalPages, abandonedPage + 1);
            else if (dest === 'last') abandonedPage = totalPages;
            else if (typeof dest === 'number') abandonedPage = Math.max(1, Math.min(totalPages, dest));
            else abandonedPage = 1;
            renderAbandonedTable();
        }

        function changeAbandonedPerPage(val) {
            abandonedPerPage = parseInt(val) || 50;
            abandonedPage = 1;
            renderAbandonedTable();
        }

        function searchAbandonedTable(input) {
            abandonedSearchTerm = input.value;
            abandonedPage = 1;
            renderAbandonedTable();
        }

        function renderAbandonedTable() {
            const tbody = document.getElementById('abandonedTableBody');
            if (!tbody) return;

            const filtered = getFilteredAbandoned();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / abandonedPerPage));
            if (abandonedPage > totalPages) abandonedPage = totalPages;
            const start = (abandonedPage - 1) * abandonedPerPage;
            const end = Math.min(start + abandonedPerPage, totalItems);
            const pageData = filtered.slice(start, end);

            if (!totalItems) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af;">
                    <i class="fas fa-check-circle" style="font-size:32px;display:block;margin-bottom:10px;color:#10b981;opacity:0.5;"></i>
                    لا توجد طلبات مفقودة حالياً
                </td></tr>`;
                updateAbandonedPaginationUI();
                return;
            }

            const cur = window.storeCurrency || '$';
            tbody.innerHTML = pageData.map(c => {
                const total = (c.items||[]).reduce((s,i)=>s+(parseFloat(i.price||0)*parseInt(i.quantity||1)),0);
                const date = c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
                const items = (c.items||[]).map(i=>`<span style="background:#f1f5f9;padding:2px 8px;border-radius:6px;font-size:11px;margin:2px;display:inline-block;">${i.name||''}</span>`).join('');

                const productDetails = (c.items || []).map(i => `- ${i.name} (الكمية: ${i.quantity})`).join('\n');
                const waMessage = `مرحباً ${c.name}، لاحظنا أنك لم تكمل طلبك في متجرنا. هل تحتاج مساعدة؟\n\nالمنتجات في سلتك:\n${productDetails}\n\nالإجمالي: ${total.toFixed(2)} ${cur}`;

                return `<tr onclick='viewAbandonedDetails(${JSON.stringify(c).replace(/'/g, "&apos;")})' style="cursor:pointer;" class="hover-row">
                    <td>
                        <div style="font-weight:700;color:#111827;font-size:13px;">${c.name||'—'}</div>
                        <div style="font-size:11px;color:#6b7280;">${c.email||''}</div>
                    </td>
                    <td dir="ltr" style="font-weight:600;font-size:13px;">${c.phone||'—'}</td>
                    <td style="max-width:200px;">${items||'—'}</td>
                    <td style="font-weight:800;color:var(--primary);font-size:14px;">${total.toFixed(2)} ${cur}</td>
                    <td style="font-size:12px;color:#6b7280;">${date}</td>
                    <td>
                        <div style="display:flex; gap:5px;">
                            <a href="https://wa.me/${(c.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(waMessage)}" target="_blank" onclick="event.stopPropagation()"
                               style="padding:6px 12px;font-size:12px;border-radius:8px;background:#dcfce7;color:#15803d;border:1.5px solid #bbf7d0;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:5px;text-decoration:none;">
                               <i class="fab fa-whatsapp"></i> متابعة
                            </a>
                        </div>
                    </td>
                </tr>`;
            }).join('');
            updateAbandonedPaginationUI();
        }

// --- Abandoned Carts ---
        async function loadAbandonedCarts() {
            const tbody = document.getElementById('abandonedTableBody');
            if(!tbody) return;
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#9ca3af;"><i class="fas fa-spinner fa-spin" style="font-size:20px;"></i></td></tr>`;
            try {
                window._abandonedData = await DB.getAbandoned();
                abandonedPage = 1;
                abandonedSearchTerm = '';
                const searchInput = document.querySelector('#tab-abandoned .input-luxury');
                if (searchInput) searchInput.value = '';
                renderAbandonedTable();
            } catch(e) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#ef4444;">فشل تحميل البيانات</td></tr>`;
            }
        }

        window.viewAbandonedDetails = function(data) {
            const container = document.getElementById('abandoned-details-container');
            if (!container) return;

            const total = (data.items || []).reduce((s, i) => s + (parseFloat(i.price || 0) * parseInt(i.quantity || 1)), 0);
            const itemsHtml = (data.items || []).map(i => `
                <div style="display: flex; align-items: center; gap: 20px; padding: 20px; background: #fff; border-radius: 20px; margin-bottom: 15px; border: 1px solid #e2e8f0; transition: 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    <img src="${i.image}" style="width: 80px; height: 80px; border-radius: 16px; object-fit: cover; border: 1px solid #f1f5f9;">
                    <div style="flex: 1;">
                        <div style="font-weight: 800; color: #1e293b; font-size: 16px;">${i.name}</div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 6px; display: flex; gap: 15px;">
                            <span>الكمية: <b>${i.quantity}</b></span>
                            <span>سعر الوحدة: <b>₪${parseFloat(i.price).toFixed(2)}</b></span>
                        </div>
                    </div>
                    <div style="font-weight: 950; color: var(--primary); font-size: 18px;">₪${(parseFloat(i.price) * parseInt(i.quantity)).toFixed(2)}</div>
                </div>
            `).join('');

            const waMessage = `مرحباً ${data.name}، لاحظنا أنك لم تكمل طلبك في متجرنا. هل تحتاج مساعدة؟\n\nالمنتجات في سلتك:\n${(data.items || []).map(i => `- ${i.name} (الكمية: ${i.quantity})`).join('\n')}\n\nالإجمالي: ${total.toFixed(2)} ₪`;

            container.innerHTML = `
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px;">
                    <!-- Customer Info & Products -->
                    <div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 25px; border-radius: 24px; border: 1px solid #e2e8f0;">
                            <div>
                                <div style="font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">العميل</div>
                                <div style="font-weight: 900; color: #1e293b; font-size: 16px;">${data.name || '—'}</div>
                                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${data.email || 'لا يوجد بريد'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">رقم التواصل</div>
                                <div style="font-weight: 900; color: #1e293b; font-size: 16px;" dir="ltr">${data.phone || '—'}</div>
                            </div>
                            <div style="grid-column: span 2; padding-top: 15px; border-top: 1px solid #e2e8f0; margin-top: 5px;">
                                <div style="font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">العنوان</div>
                                <div style="font-weight: 800; color: #1e293b; font-size: 14px;">${data.city || '—'} - ${data.address || '—'}</div>
                            </div>
                        </div>

                        <h3 style="font-weight: 900; font-size: 18px; margin-bottom: 20px; color: #1e293b; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-boxes" style="color: #f97316;"></i> محتويات السلة
                        </h3>
                        <div style="margin-bottom: 30px;">
                            ${itemsHtml || '<p style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:20px;">لا توجد منتجات</p>'}
                        </div>
                    </div>

                    <!-- Summary & Actions -->
                    <div style="position: sticky; top: 20px;">
                        <div style="background: #0f172a; color: white; padding: 30px; border-radius: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
                            <div style="font-weight: 800; font-size: 13px; opacity: 0.6; text-transform: uppercase; margin-bottom: 15px;">ملخص القيمة</div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                                <span>عدد القطع</span>
                                <span>${(data.items || []).length} قطع</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                                <span style="font-weight: 800;">الإجمالي</span>
                                <span style="font-size: 32px; font-weight: 950; color: #fbbf24;">₪${total.toFixed(2)}</span>
                            </div>
                            
                            <div style="margin-top: 30px;">
                                <a href="https://wa.me/${(data.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}" target="_blank" 
                                   class="btn btn-primary" style="width:100%; height:60px; border-radius:18px; background: #22c55e; border: none; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 900; font-size: 16px; box-shadow: 0 10px 20px rgba(34, 197, 94, 0.2);">
                                    <i class="fab fa-whatsapp" style="font-size: 24px;"></i> مراسلة العميل
                                </a>
                                <p style="font-size: 11px; text-align: center; margin-top: 15px; opacity: 0.6; line-height: 1.5;">
                                    سيتم إرسال رسالة تذكير تحتوي على قائمة المنتجات التي اختارها العميل.
                                </p>
                            </div>
                        </div>

                        <div style="margin-top: 20px; background: #fff; padding: 20px; border-radius: 24px; border: 1px solid #e2e8f0; text-align: center;">
                            <div style="font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 5px;">تاريخ آخر نشاط</div>
                            <div style="font-weight: 800; color: #1e293b; font-size: 13px;">${new Date(data.updatedAt).toLocaleString('ar-EG')}</div>
                        </div>
                    </div>
                </div>
            `;

            switchTab('tab-abandoned-details');
        }

        window.closeAbandonedDetails = function() {
            switchTab('tab-abandoned');
        }

// --- Additional Event Listeners & Distributor Management ---

        // Modal functions are now unified in the main script block above to avoid duplication errors.
        document.getElementById('confirmModalYesBtn').addEventListener('click', () => {
            if(currentConfirmCallback) currentConfirmCallback();
            closeConfirmModal();
        });

        // --- Distributors Pagination ---
        let distributorsPage = 1;
        let distributorsPerPage = 50;
        let _distributorsData = [];

        function getFilteredDistributors() {
            return _distributorsData; // No search for now
        }

        function updateDistributorsPaginationUI() {
            const filtered = getFilteredDistributors();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / distributorsPerPage));
            if (distributorsPage > totalPages) distributorsPage = totalPages;

            const pagination = document.getElementById('distributorsPagination');
            if (!pagination) return;
            pagination.style.display = totalItems > 0 ? 'flex' : 'none';

            document.getElementById('distributorsPaginationInfo').textContent = `إجمالي ${totalItems} موزع — صفحة ${distributorsPage} من ${totalPages}`;

            const pageNav = document.getElementById('distributorsPaginationPages');
            const firstBtn = document.getElementById('distributorsPaginationFirst');
            const prevBtn = document.getElementById('distributorsPaginationPrev');
            const nextBtn = document.getElementById('distributorsPaginationNext');
            const lastBtn = document.getElementById('distributorsPaginationLast');
            const showNav = totalPages > 1;
            [firstBtn, prevBtn, nextBtn, lastBtn, pageNav].forEach(el => { if (el) el.style.display = showNav ? '' : 'none'; });
            if (!showNav) return;

            let pagesHTML = '';
            const range = 2;
            const start = Math.max(1, distributorsPage - range);
            const end = Math.min(totalPages, distributorsPage + range);
            if (start > 1) {
                pagesHTML += `<button onclick="goToDistributorsPage(1)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">1</button>`;
                if (start > 2) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
            }
            for (let p = start; p <= end; p++) {
                pagesHTML += `<button onclick="goToDistributorsPage(${p})" style="padding:6px 10px;border:1px solid ${p === distributorsPage ? 'var(--primary)' : 'var(--border)'};border-radius:6px;background:${p === distributorsPage ? 'var(--primary)' : 'white'};cursor:pointer;font-size:12px;font-weight:${p === distributorsPage ? '800' : '400'};color:${p === distributorsPage ? 'white' : 'var(--gray-600)'};">${p}</button>`;
            }
            if (end < totalPages) {
                if (end < totalPages - 1) pagesHTML += `<span style="padding:0 3px;color:var(--gray-400);">...</span>`;
                pagesHTML += `<button onclick="goToDistributorsPage(${totalPages})" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:12px;color:var(--gray-600);">${totalPages}</button>`;
            }
            pageNav.innerHTML = pagesHTML;

            firstBtn.style.opacity = distributorsPage <= 1 ? '0.3' : '1';
            firstBtn.disabled = distributorsPage <= 1;
            prevBtn.style.opacity = distributorsPage <= 1 ? '0.3' : '1';
            prevBtn.disabled = distributorsPage <= 1;
            nextBtn.style.opacity = distributorsPage >= totalPages ? '0.3' : '1';
            nextBtn.disabled = distributorsPage >= totalPages;
            lastBtn.style.opacity = distributorsPage >= totalPages ? '0.3' : '1';
            lastBtn.disabled = distributorsPage >= totalPages;
        }

        function goToDistributorsPage(dest) {
            const filtered = getFilteredDistributors();
            const totalPages = Math.max(1, Math.ceil(filtered.length / distributorsPerPage));
            if (dest === 'first') distributorsPage = 1;
            else if (dest === 'prev') distributorsPage = Math.max(1, distributorsPage - 1);
            else if (dest === 'next') distributorsPage = Math.min(totalPages, distributorsPage + 1);
            else if (dest === 'last') distributorsPage = totalPages;
            else if (typeof dest === 'number') distributorsPage = Math.max(1, Math.min(totalPages, dest));
            else distributorsPage = 1;
            renderDistributorsTable();
        }

        function changeDistributorsPerPage(val) {
            distributorsPerPage = parseInt(val) || 50;
            distributorsPage = 1;
            renderDistributorsTable();
        }

        // Distributors Management
        async function loadDistributors() {
            try {
                const data = await DB.getDistributors();
                _distributorsData = data;
                distributorsPage = 1;
                // Close any open details rows
                document.querySelectorAll('[id^="details-"]').forEach(row => row.style.display = 'none');
                renderDistributorsTable();
            } catch (e) { console.error('Distributors Load Error:', e); }
        }

        function renderDistributorsTable() {
            const tbody = document.getElementById('distributorsBody');
            if(!tbody) return;

            const filtered = getFilteredDistributors();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / distributorsPerPage));
            if (distributorsPage > totalPages) distributorsPage = totalPages;
            const start = (distributorsPage - 1) * distributorsPerPage;
            const end = Math.min(start + distributorsPerPage, totalItems);
            const pageData = filtered.slice(start, end);

            tbody.innerHTML = pageData.map(d => `
                <tr style="transition: background 0.2s;">
                    <td>
                        <span onclick="toggleDistributorProducts('${d.id}', '${d.phone}', this)" style="cursor:pointer; color:var(--primary); border-bottom:1.5px dashed var(--primary); display:inline-block; font-weight:800; padding:2px 0;" title="اضغط لعرض المنتجات التي اشتراها التاجر">
                            <i class="fas fa-shopping-bag" style="margin-left:5px; font-size:11px;"></i> ${d.name}
                        </span>
                    </td>
                    <td><a href="https://wa.me/${d.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--primary); text-decoration:none;"><i class="fab fa-whatsapp"></i> ${d.phone}</a></td>
                    <td>${d.businessName || '-'}</td>
                    <td>${new Date(d.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td>
                        <span class="badge ${d.status === 'approved' ? 'badge-success' : (d.status === 'pending' ? 'badge-pending' : '')}" style="${d.status === 'rejected' ? 'background:#fee2e2; color:#ef4444;' : ''}">
                            ${d.status === 'approved' ? 'نشط' : (d.status === 'pending' ? 'قيد المراجعة' : 'مرفوض')}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex; gap:5px;">
                            <button class="btn btn-primary" style="padding:8px 15px; font-size:11px;" onclick='showDistributorDetail(${JSON.stringify(d).replace(/'/g, "&apos;")})'>
                                <i class="fas fa-eye"></i> التفاصيل
                            </button>
                            <button class="btn btn-outline" style="padding:8px 15px; font-size:11px;" onclick='openDistributorModal(${JSON.stringify(d).replace(/'/g, "&apos;")})'>
                                <i class="fas fa-edit"></i> إدارة
                            </button>
                        </div>
                    </td>
                </tr>
                <tr id="details-${d.id}" style="display:none; background:#f8fafc;">
                    <td colspan="6" style="padding:15px 25px; border-bottom:2px solid var(--primary-light);">
                        <div style="border-right:3px solid var(--primary); padding-right:15px;">
                            <h4 style="margin:0 0 12px 0; font-weight:800; font-size:13.5px; color:var(--dark); display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-shopping-cart" style="color:var(--primary);"></i> المنتجات المشتراة بواسطة الموزع:
                            </h4>
                            <div id="purchased-container-${d.id}"></div>
                        </div>
                    </td>
                </tr>
            `).join('');
            updateDistributorsPaginationUI();
        }

        async function toggleDistributorProducts(id, phone, nameEl) {
            const detailsRow = document.getElementById(`details-${id}`);
            if(!detailsRow) return;
            
            const isHidden = detailsRow.style.display === 'none';
            if(isHidden) {
                // Close any other open details rows to keep it clean
                document.querySelectorAll('[id^="details-"]').forEach(row => row.style.display = 'none');
                
                detailsRow.style.display = 'table-row';
                
                const container = document.getElementById(`purchased-container-${id}`);
                if(container) {
                    container.innerHTML = '<div style="text-align:center; padding:15px; font-size:13px; color:var(--gray-600);"><i class="fas fa-spinner fa-spin" style="color:var(--primary);"></i> جاري تحميل المنتجات المشتراة...</div>';
                    try {
                        const products = await DB.getDistributorPurchasedProducts(phone);
                        if(products.length === 0) {
                            container.innerHTML = '<div style="text-align:center; padding:15px; font-size:13px; color:var(--gray-400);"><i class="fas fa-box-open" style="font-size:24px; opacity:0.3; display:block; margin-bottom:5px;"></i>لم يقم بشراء أي منتجات بعد.</div>';
                            return;
                        }
                        
                        container.innerHTML = `
                            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; padding:5px 0;">
                                ${products.map(p => {
                                    const variantText = (p.color || p.size) ? `<span style="font-size:10px; color:var(--gray-600); background:#fff; border:1px solid #e2e8f0; padding:1px 5px; border-radius:4px; margin-top:2px; display:inline-block;">${[p.color, p.size].filter(Boolean).join(' / ')}</span>` : '';
                                    return `
                                        <div style="display:flex; align-items:center; gap:10px; background:#fff; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0; box-shadow:var(--shadow-sm);">
                                            <img src="${p.image}" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;">
                                            <div style="flex:1; min-width:0;">
                                                <div style="font-weight:700; font-size:12px; color:var(--dark); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.name}">${p.name}</div>
                                                ${variantText}
                                                <div style="font-size:11px; color:var(--gray-600); margin-top:3px;">الكمية: <strong>${p.quantity}</strong></div>
                                            </div>
                                            <div style="font-weight:800; color:var(--primary); font-size:13px; flex-shrink:0;">
                                                ${p.totalSpent.toFixed(2)}$
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    } catch(e) {
                        container.innerHTML = '<div style="text-align:center; padding:15px; color:#ef4444; font-size:13px;">فشل تحميل المنتجات.</div>';
                    }
                }
            } else {
                detailsRow.style.display = 'none';
            }
        }

        window._currentDistDetail = null;
        window._openDistEditFromDetail = function() {
            if (window._currentDistDetail) openDistributorModal(window._currentDistDetail);
        };

        async function showDistributorDetail(dist) {
            window._currentDistDetail = dist;
            // Update URL with distributor ID so refresh keeps the context
            const url = new URL(window.location);
            url.searchParams.set('tab', 'distributor-detail');
            url.searchParams.set('distId', dist.id);
            window.history.replaceState({}, '', url);
            switchTab('tab-distributor-detail');
            document.getElementById('distDetailName').textContent = dist.name || 'الموزع';
            const statusLabels = { approved: 'نشط', pending: 'قيد المراجعة', rejected: 'مرفوض' };
            const statusColors = { approved: '#166534', pending: '#92400e', rejected: '#991b1b' };
            document.getElementById('distDetailStatus').innerHTML = `
                <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:8px;font-size:12px;font-weight:800;background:${dist.status === 'approved' ? '#f0fdf4' : dist.status === 'rejected' ? '#fef2f2' : '#fffbeb'};color:${statusColors[dist.status] || '#92400e'};border:1px solid ${dist.status === 'approved' ? '#bbf7d0' : dist.status === 'rejected' ? '#fecaca' : '#fef3c7'};">
                    <i class="fas ${dist.status === 'approved' ? 'fa-check-circle' : dist.status === 'rejected' ? 'fa-times-circle' : 'fa-clock'}"></i> ${statusLabels[dist.status] || dist.status}
                </span>
            `;

            const body = document.getElementById('distDetailBody');
            body.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary);"></i></div>';

            try {
                const orders = await DB.getOrders();
                const distOrders = orders.filter(o => {
                    const phoneMatch = o.customer && String(o.customer.phone) === String(dist.phone);
                    const idMatch = o.distributorId && String(o.distributorId) === String(dist.id);
                    return phoneMatch || idMatch;
                });
                const totalOrders = distOrders.length;
                const totalSpent = distOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
                const lastOrder = distOrders.length > 0 ? distOrders.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))[0] : null;

                const purchasedProducts = await DB.getDistributorPurchasedProducts(dist.phone);

                body.innerHTML = `
                    <div style="padding:25px;">
                        <!-- Stats Cards -->
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;margin-bottom:25px;">
                            <div style="background:#fff;padding:20px;border-radius:14px;border:1px solid var(--border);box-shadow:var(--shadow-sm);text-align:center;">
                                <div style="font-size:28px;font-weight:900;color:var(--primary);">${totalOrders}</div>
                                <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-top:5px;">إجمالي الطلبات</div>
                            </div>
                            <div style="background:#fff;padding:20px;border-radius:14px;border:1px solid var(--border);box-shadow:var(--shadow-sm);text-align:center;">
                                <div style="font-size:28px;font-weight:900;color:#10b981;">${totalSpent.toFixed(2)} ₪</div>
                                <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-top:5px;">إجمالي الإنفاق</div>
                            </div>
                            <div style="background:#fff;padding:20px;border-radius:14px;border:1px solid var(--border);box-shadow:var(--shadow-sm);text-align:center;">
                                <div style="font-size:28px;font-weight:900;color:#4f46e5;">${purchasedProducts.length}</div>
                                <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-top:5px;">منتجات مشتراة</div>
                            </div>
                            <div style="background:#fff;padding:20px;border-radius:14px;border:1px solid var(--border);box-shadow:var(--shadow-sm);text-align:center;">
                                <div style="font-size:14px;font-weight:900;color:var(--dark);">${lastOrder ? new Date(lastOrder.date || lastOrder.createdAt).toLocaleDateString('ar-EG') : '—'}</div>
                                <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-top:5px;">آخر طلب</div>
                            </div>
                        </div>

                        <!-- Info + Orders layout -->
                        <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;">
                            <!-- Distributor Info Card -->
                            <div style="background:#fff;padding:20px;border-radius:14px;border:1px solid var(--border);box-shadow:var(--shadow-sm);">
                                <h4 style="margin:0 0 15px 0;font-weight:800;font-size:15px;color:var(--dark);display:flex;align-items:center;gap:8px;">
                                    <i class="fas fa-user-tie" style="color:var(--primary);"></i> معلومات الموزع
                                </h4>
                                <div style="display:flex;flex-direction:column;gap:12px;">
                                    <div><span style="font-weight:700;color:var(--text-muted);font-size:12px;">الاسم:</span><br><span style="font-weight:800;font-size:14px;">${dist.name}</span></div>
                                    <div><span style="font-weight:700;color:var(--text-muted);font-size:12px;">رقم الهاتف:</span><br><a href="https://wa.me/${dist.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--primary);text-decoration:none;font-weight:800;font-size:14px;"><i class="fab fa-whatsapp"></i> ${dist.phone}</a></div>
                                    <div><span style="font-weight:700;color:var(--text-muted);font-size:12px;">الشركة/العمل:</span><br><span style="font-weight:700;font-size:14px;">${dist.businessName || '—'}</span></div>
                                    <div><span style="font-weight:700;color:var(--text-muted);font-size:12px;">المدينة:</span><br><span style="font-weight:700;font-size:14px;">${dist.city || '—'}</span></div>
                                    <div><span style="font-weight:700;color:var(--text-muted);font-size:12px;">العنوان:</span><br><span style="font-weight:700;font-size:14px;">${dist.address || '—'}</span></div>
                                    <div><span style="font-weight:700;color:var(--text-muted);font-size:12px;">البريد الإلكتروني:</span><br><span style="font-weight:700;font-size:14px;">${dist.email || '—'}</span></div>
                                    <div><span style="font-weight:700;color:var(--text-muted);font-size:12px;">تاريخ التسجيل:</span><br><span style="font-weight:700;font-size:14px;">${new Date(dist.createdAt).toLocaleDateString('ar-EG')}</span></div>
                                </div>
                            </div>

                            <!-- Orders List -->
                            <div style="background:#fff;padding:20px;border-radius:14px;border:1px solid var(--border);box-shadow:var(--shadow-sm);">
                                <h4 style="margin:0 0 15px 0;font-weight:800;font-size:15px;color:var(--dark);display:flex;align-items:center;gap:8px;">
                                    <i class="fas fa-shopping-bag" style="color:var(--primary);"></i> طلبات الموزع
                                </h4>
                                ${distOrders.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;"><i class="fas fa-box-open" style="display:block;font-size:32px;opacity:0.3;margin-bottom:10px;"></i>لا توجد طلبات بعد</div>' : `
                                    <div style="overflow-x:auto;">
                                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                                            <thead>
                                                <tr style="background:var(--gray-100);">
                                                    <th style="padding:10px;text-align:right;font-size:11px;">#</th>
                                                    <th style="padding:10px;text-align:right;font-size:11px;">التاريخ</th>
                                                    <th style="padding:10px;text-align:right;font-size:11px;">المبلغ</th>
                                                    <th style="padding:10px;text-align:right;font-size:11px;">الحالة</th>
                                                    <th style="padding:10px;text-align:right;font-size:11px;"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${distOrders.slice(0, 50).map(o => {
                                                    const statusColors = { pending: '#92400e', processing: '#92400e', shipped: '#4f46e5', delivered: '#166534', cancelled: '#991b1b' };
                                                    const statusLabels = { pending: 'قيد الانتظار', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
                                                    return `
                                                        <tr style="border-bottom:1px solid var(--gray-200);cursor:pointer;" onclick="viewOrder('${o.id}')">
                                                            <td style="padding:10px;font-weight:800;color:var(--primary);">#${o.id}</td>
                                                            <td style="padding:10px;">${new Date(o.date || o.createdAt).toLocaleDateString('ar-EG')}</td>
                                                            <td style="padding:10px;font-weight:800;">${parseFloat(o.total || 0).toFixed(2)} ₪</td>
                                                            <td style="padding:10px;">
                                                                <span style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;background:${o.status === 'delivered' ? '#f0fdf4' : o.status === 'cancelled' ? '#fef2f2' : '#fffbeb'};color:${statusColors[o.status] || '#92400e'};">
                                                                    ${statusLabels[o.status] || o.status}
                                                                </span>
                                                            </td>
                                                            <td style="padding:10px;"><i class="fas fa-chevron-left" style="color:var(--text-muted);font-size:11px;"></i></td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Purchased Products -->
                        <div style="margin-top:20px;background:#fff;padding:20px;border-radius:14px;border:1px solid var(--border);box-shadow:var(--shadow-sm);">
                            <h4 style="margin:0 0 15px 0;font-weight:800;font-size:15px;color:var(--dark);display:flex;align-items:center;gap:8px;">
                                <i class="fas fa-shopping-cart" style="color:var(--primary);"></i> المنتجات المشتراة
                            </h4>
                            ${purchasedProducts.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;"><i class="fas fa-box-open" style="display:block;font-size:32px;opacity:0.3;margin-bottom:10px;"></i>لم يقم بشراء أي منتجات بعد</div>' : `
                                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
                                    ${purchasedProducts.map(p => {
                                        const variantText = (p.color || p.size) ? `<span style="font-size:10px;color:var(--gray-600);background:#f8fafc;border:1px solid #e2e8f0;padding:1px 6px;border-radius:4px;display:inline-block;">${[p.color, p.size].filter(Boolean).join(' / ')}</span>` : '';
                                        return `
                                            <div style="display:flex;align-items:center;gap:12px;background:var(--gray-50);padding:12px;border-radius:12px;border:1px solid var(--gray-200);">
                                                <img src="${p.image}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23e2e8f0%22 width=%22100%22 height=%22100%22/></svg>'">
                                                <div style="flex:1;min-width:0;">
                                                    <div style="font-weight:700;font-size:13px;color:var(--dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
                                                    ${variantText}
                                                    <div style="display:flex;gap:12px;margin-top:3px;font-size:11px;color:var(--text-muted);">
                                                        <span>الكمية: <strong style="color:var(--dark);">${p.quantity}</strong></span>
                                                        <span>الإجمالي: <strong style="color:var(--primary);">${p.totalSpent.toFixed(2)} ₪</strong></span>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                `;
            } catch(e) {
                body.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">حدث خطأ أثناء تحميل التفاصيل</div>';
                console.error(e);
            }
        }

        function openDistributorModal(dist) {
            // Check if modal exists, if not create it
            let modal = document.getElementById('distEditModal');
            if(!modal) {
                modal = document.createElement('div');
                modal.id = 'distEditModal';
                modal.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); z-index:9999; backdrop-filter:blur(4px); align-items:center; justify-content:center;";
                modal.innerHTML = `
                    <div style="background:var(--white); padding:30px; border-radius:20px; width:95%; max-width:750px; box-shadow:var(--shadow-lg); max-height:90vh; overflow-y:auto;">
                        <h2 style="margin-bottom:20px; font-weight:800; color:var(--primary);"><i class="fas fa-user-tie"></i> إدارة الموزع</h2>
                        
                        <div style="display:flex; gap:25px; flex-wrap:wrap;">
                            <!-- Form Column -->
                            <div style="flex:1.2; min-width:280px;">
                                <form id="distEditForm">
                                    <input type="hidden" id="distEditId">
                                    <div class="form-group">
                                        <label class="label-luxury">الاسم</label>
                                        <input type="text" id="distEditName" class="input-luxury" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="label-luxury">رقم الهاتف (الواتساب)</label>
                                        <input type="text" id="distEditPhone" class="input-luxury" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="label-luxury">كلمة المرور (يمكنك تغييرها له هنا)</label>
                                        <input type="text" id="distEditPassword" class="input-luxury" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="label-luxury">حالة الحساب</label>
                                        <select id="distEditStatus" class="input-luxury">
                                            <option value="pending">قيد المراجعة</option>
                                            <option value="approved">موافق عليه (نشط)</option>
                                            <option value="rejected">مرفوض</option>
                                        </select>
                                    </div>
                                    <div style="display:flex; gap:10px; margin-top:20px;">
                                        <button type="button" class="btn btn-outline" style="flex:1;" onclick="document.getElementById('distEditModal').style.display='none'">إلغاء</button>
                                        <button type="submit" class="btn btn-primary" style="flex:1;">حفظ التعديلات</button>
                                    </div>
                                </form>
                            </div>
                            
                            <!-- Purchased Products Column -->
                            <div style="flex:1; min-width:280px; border-right:1px solid var(--gray-200); padding-right:20px;" id="distPurchasedArea">
                                <h3 style="font-weight:800; font-size:16px; margin-bottom:15px; color:var(--dark); display:flex; align-items:center; gap:8px;">
                                    <i class="fas fa-shopping-bag" style="color:var(--primary);"></i> المنتجات المشتراة
                                </h3>
                                <div id="distPurchasedList" style="max-height:350px; overflow-y:auto; padding-left:5px;">
                                    <div style="text-align:center; color:var(--gray-400); padding:20px;">جاري تحميل المنتجات...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                document.getElementById('distEditForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const body = {
                        id: document.getElementById('distEditId').value,
                        name: document.getElementById('distEditName').value,
                        phone: document.getElementById('distEditPhone').value,
                        password: document.getElementById('distEditPassword').value,
                        status: document.getElementById('distEditStatus').value
                    };
                    const data = await DB.editDistributor(body.id, body);
                    if(data) {
                        showToast('تم حفظ بيانات الموزع بنجاح');
                        document.getElementById('distEditModal').style.display='none';
                        loadDistributors();
                    }
                });
            }

            document.getElementById('distEditId').value = dist.id;
            document.getElementById('distEditName').value = dist.name;
            document.getElementById('distEditPhone').value = dist.phone;
            document.getElementById('distEditPassword').value = dist.password;
            document.getElementById('distEditStatus').value = dist.status;

            // Load purchased products dynamically
            const listContainer = document.getElementById('distPurchasedList');
            if(listContainer) {
                listContainer.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin" style="font-size:24px; color:var(--primary);"></i> جاري تحميل المنتجات...</div>';
                DB.getDistributorPurchasedProducts(dist.phone)
                    .then(products => {
                        if(products.length === 0) {
                            listContainer.innerHTML = '<div style="text-align:center; color:var(--gray-400); padding:30px; font-weight:600;"><i class="fas fa-box-open" style="font-size:36px; opacity:0.3; display:block; margin-bottom:10px;"></i>لم يقم بشراء أي منتجات بعد.</div>';
                            return;
                        }
                        
                        listContainer.innerHTML = products.map(p => {
                            const variantText = (p.color || p.size) ? `<span style="font-size:11px; color:var(--gray-600); background:#f1f5f9; padding:2px 6px; border-radius:4px; margin-top:3px; display:inline-block;">${[p.color, p.size].filter(Boolean).join(' / ')}</span>` : '';
                            return `
                                <div style="display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid #f1f5f9; background:#fafafa; border-radius:10px; margin-bottom:8px;">
                                    <img src="${p.image}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;">
                                    <div style="flex:1;">
                                        <div style="font-weight:700; font-size:13px; color:var(--dark);">${p.name}</div>
                                        ${variantText}
                                        <div style="font-size:12px; color:var(--gray-600); margin-top:4px;">الكمية المشتراة: <strong>${p.quantity}</strong></div>
                                    </div>
                                    <div style="text-align:left; font-weight:800; color:var(--primary); font-size:14px;">
                                        ${p.totalSpent.toFixed(2)}$
                                    </div>
                                </div>
                            `;
                        }).join('');
                    })
                    .catch(err => {
                        listContainer.innerHTML = '<div style="text-align:center; color:red; padding:20px;">فشل تحميل المنتجات.</div>';
                    });
            }
            
            modal.style.display = 'flex';
        }

        document.addEventListener('DOMContentLoaded', () => {
            if(typeof switchHeroType === 'function') {
                const savedType = document.getElementById('settings_heroType')?.value || 'slider';
                switchHeroType(savedType);
                renderSlides();
            }
            
            // Design Form Checkboxes & Serialization Submit Handler
            document.getElementById('designForm')?.addEventListener('submit', async function(e) {
                if (this.dataset.submitting === 'true') return;
                e.preventDefault();
                serializeSlider();
                if(typeof serializeHomeSections === 'function') serializeHomeSections();
                if(typeof serializeSidebarSections === 'function') serializeSidebarSections();

                const checkboxes = this.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    if (!cb.name) return;
                    let hidden = this.querySelector(`input[type="hidden"][name="${cb.name}"]`);
                    if (!hidden) {
                        hidden = document.createElement('input');
                        hidden.type = 'hidden';
                        hidden.name = cb.name;
                        this.appendChild(hidden);
                    }
                    hidden.value = cb.checked ? 'true' : 'false';
                    cb.removeAttribute('name');
                });

                this.dataset.submitting = 'true';
                try {
                    if (location.protocol === 'file:') {
                        // Running as a static file (no server) → save directly to Supabase
                        const formData = new FormData(this);
                        const settings = {};
                        for (const [k, v] of formData.entries()) {
                            if (k.endsWith('[]')) {
                                if (!Array.isArray(settings[k])) settings[k] = [];
                                settings[k].push(v);
                            } else {
                                settings[k] = v;
                            }
                        }
                        await DB.setSettings(settings);
                        if (typeof showToast === 'function') showToast('✅ تم حفظ التغييرات بنجاح!');
                        else alert('✅ تم حفظ التغييرات بنجاح!');
                        // Reload into memory so the builder reflects the saved state
                        const s = await DB.getSettings();
                        const safeParse = (val) => {
                            if (!val || typeof val !== 'string') return val;
                            try { return JSON.parse(val); } catch (e) { return null; }
                        };
                        if (s.home_sections_json) {
                            const p = safeParse(s.home_sections_json);
                            if (p) { window.homeSections = p; homeSections = p; }
                        }
                        if (s.sidebar_sections_json) {
                            const p2 = safeParse(s.sidebar_sections_json);
                            if (p2) window.sidebarSections = p2;
                        }
                    if (typeof renderHomeSections === 'function') renderHomeSections();

                    if (settings.sidebar_sections_json) {
                        const parsed = typeof settings.sidebar_sections_json === 'string' ? JSON.parse(settings.sidebar_sections_json) : settings.sidebar_sections_json;
                        window.sidebarSections = parsed;
                    }
                    if (typeof renderSidebarSections === 'function') renderSidebarSections();
                        if (typeof renderSidebarSections === 'function') renderSidebarSections();
                    } else {
                        this.submit();
                    }
                } catch(err) {
                    console.error('Save settings error:', err);
                    alert('حدث خطأ أثناء الحفظ: ' + (err && err.message ? err.message : err));
                } finally {
                    this.dataset.submitting = 'false';
                }
            });

            // Settings Form Checkboxes Submit Handler
            document.getElementById('settingsForm')?.addEventListener('submit', async function(e) {
                if (this.dataset.submitting === 'true') return;
                e.preventDefault();

                const checkboxes = this.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    if (!cb.name) return;
                    let hidden = this.querySelector(`input[type="hidden"][name="${cb.name}"]`);
                    if (!hidden) {
                        hidden = document.createElement('input');
                        hidden.type = 'hidden';
                        hidden.name = cb.name;
                        this.appendChild(hidden);
                    }
                    hidden.value = cb.checked ? 'true' : 'false';
                    cb.removeAttribute('name');
                });

                this.dataset.submitting = 'true';
                try {
                    if (location.protocol === 'file:') {
                        // Running as a static file (no server) → save directly to Supabase
                        const formData = new FormData(this);
                        const settings = {};
                        for (const [k, v] of formData.entries()) {
                            if (k.endsWith('[]')) {
                                if (!Array.isArray(settings[k])) settings[k] = [];
                                settings[k].push(v);
                            } else {
                                settings[k] = v;
                            }
                        }
                        await DB.setSettings(settings);
                        if (typeof showToast === 'function') showToast('✅ تم حفظ التغييرات بنجاح!');
                        else alert('✅ تم حفظ التغييرات بنجاح!');
                    } else {
                        this.submit();
                    }
                } catch(err) {
                    console.error('Save settings error:', err);
                    alert('حدث خطأ أثناء الحفظ: ' + (err && err.message ? err.message : err));
                } finally {
                    this.dataset.submitting = 'false';
                }
            });

            // Category Form Checkboxes Submit Handler
            document.getElementById('categoryForm')?.addEventListener('submit', function(e) {
                if (this.dataset.submitting === 'true') return;
                e.preventDefault();
                
                const checkboxes = this.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    if (!cb.name) return;
                    let hidden = this.querySelector(`input[type="hidden"][name="${cb.name}_val"]`);
                    if (!hidden) {
                        hidden = document.createElement('input');
                        hidden.type = 'hidden';
                        hidden.name = cb.name + '_val';
                        this.appendChild(hidden);
                    }
                    hidden.value = cb.checked ? 'true' : 'false';
                    cb.removeAttribute('name');
                });
                
                // Handled by first submit handler above - do nothing
            });

            // Popups Form Submit Handler
            document.getElementById('popupsForm')?.addEventListener('submit', async function(e) {
                if (this.dataset.submitting === 'true') return;
                e.preventDefault();
                this.dataset.submitting = 'true';
                try {
                    if (location.protocol === 'file:') {
                        const formData = new FormData(this);
                        const settings = {};
                        for (const [k, v] of formData.entries()) settings[k] = v;
                        // Normalize checkbox value: browser sends 'on' for checked
                        if (settings.popupEnabled === 'on') settings.popupEnabled = 'true';
                        else if (!settings.popupEnabled) settings.popupEnabled = 'false';
                        // Map popups_json → popups for _renderWelcomePopup to find
                        let popupsVal = settings.popups_json;
                        // If it's somehow an object, stringify it so Supabase stores as text
                        if (typeof popupsVal === 'object') popupsVal = JSON.stringify(popupsVal);
                        settings.popups = popupsVal;
                        settings.popups_json = popupsVal;
                        if (typeof showToast === 'function') showToast('✅ تم حفظ الحملات المنبثقة بنجاح!');
                        else alert('✅ تم حفظ الحملات المنبثقة بنجاح!');
                    } else {
                        this.submit();
                    }
                } catch(err) {
                    console.error('Save popups error:', err);
                    alert('حدث خطأ أثناء الحفظ: ' + (err && err.message ? err.message : err));
                } finally {
                    this.dataset.submitting = 'false';
                }
            });
        });

        // ── Order Details Logic ───────────────────────────────────────────────
        // ── Order Details Logic ───────────────────────────────────────────────
        function viewOrder(orderId) {
    if (typeof window.storeOrdersData === 'undefined') return;
    const order = window.storeOrdersData.find(o => o.id === orderId);
    if (!order) return;
    const cur = window.storeCurrency || '₪';
    switchTab('tab-order-details', false);
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('tab', 'order-details');
    newUrl.searchParams.set('orderId', orderId);
    window.history.pushState({}, '', newUrl);
    document.title = `تفاصيل الطلب #${orderId} | لوحة التحكم`;
    const container = document.getElementById('pageOrderBody');
    const defaultHeader = document.querySelector('#tab-order-details > div > div:first-child');
    if (defaultHeader) defaultHeader.style.display = 'none';

    const itemsTotal = order.items.reduce((s,i)=>s+(parseFloat(i.price)*parseInt(i.quantity)),0);
    
    let shippingCost = parseFloat(order.shippingCost);
    if (isNaN(shippingCost)) {
        // Fallback for old orders: try to infer from total if possible
        // but this is inaccurate if there was a discount
        shippingCost = parseFloat(order.total) - itemsTotal;
        if (shippingCost < 0) shippingCost = 0;
    }
    
    const discount = parseFloat(order.discount) || 0;
    
    const formattedOrderDate = (order.date || order.createdAt) ? new Date(order.date || order.createdAt).toLocaleString('ar-EG') : '—';
    const renderFirstVisit = () => {
        if(!order.firstVisit) return '—';
        if(order.firstVisit.includes('م') || order.firstVisit.includes('ص') || order.firstVisit.includes('/') || order.firstVisit.includes('،')) {
            return order.firstVisit;
        }
        const d = new Date(order.firstVisit);
        return isNaN(d.getTime()) ? order.firstVisit : d.toLocaleString('ar-EG');
    };
    const renderTimeSpent = () => {
        if(!order.timeSpent) return '—';
        if(typeof order.timeSpent === 'string' && (order.timeSpent.includes('دقيقه') || order.timeSpent.includes('دقيقة') || order.timeSpent.includes(':'))) {
            return order.timeSpent;
        }
        const ms = parseFloat(order.timeSpent);
        if(isNaN(ms)) return order.timeSpent;
        return Math.floor(ms / 60000) + ' دقيقة';
    };

    let pagesHTML = '—';
    if (Array.isArray(order.visitedPages) && order.visitedPages.length > 0) {
        pagesHTML = '<div style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto; padding:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; width:100%; box-sizing:border-box;" dir="ltr">';
        order.visitedPages.forEach((p, idx) => {
            pagesHTML += `
            <div style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:#ffffff; border:1px solid #f1f5f9; border-radius:6px; transition:0.2s; white-space:nowrap; overflow:hidden;" onmouseover="this.style.borderColor='var(--primary-light)'; this.style.background='#faf5ff';" onmouseout="this.style.borderColor='#f1f5f9'; this.style.background='#ffffff';">
                <span style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:var(--primary-light); color:var(--primary); font-size:10px; font-weight:800; flex-shrink:0;">${idx+1}</span>
                <a href="${p}" target="_blank" style="color:#4b5563; text-decoration:none; font-size:12px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; transition:0.2s;" onmouseover="this.style.color='var(--primary)';" onmouseout="this.style.color='#4b5563';" title="${p}">${p}</a>
            </div>`;
        });
        pagesHTML += '</div>';
    }

    let itemsHTML = '';
    order.items.forEach(item => {
        const variant = (item.color||item.size) ? `<span class="view-val" style="font-size:11px;color:#6b7280;display:block;margin-top:3px;">${item.color||''} ${item.size||''}</span>` : '';
        itemsHTML += `
        <div class="order-item-row" data-id="${item.id}" data-name="${item.name}" data-image="${item.image||''}" style="display:flex;align-items:center;justify-content:space-between;padding:15px 0;border-bottom:1px solid #f1f5f9;">
            <div style="text-align:left;">
                <div class="view-val" style="font-size:15px;font-weight:800;color:var(--primary);">${(item.price*item.quantity).toFixed(2)} ${cur}</div>
                <div class="view-val" style="font-size:11px;color:#6b7280;margin-top:4px;">${item.quantity} x ${item.price}</div>
                <div class="edit-val" style="display:none;align-items:center;gap:5px;flex-wrap:wrap;margin-top:4px;">
                    <input type="number" step="0.01" value="${item.price}" class="item-price-input" style="width:75px;padding:5px 8px;border:1.5px solid #cbd5e1;border-radius:8px;text-align:center;font-size:12px;font-weight:700;outline:none;" oninput="recalcInlineTotal()" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#cbd5e1'">
                    <span style="font-size:11px;color:#64748b;">x</span>
                    <input type="number" min="1" value="${item.quantity}" class="item-qty-input" style="width:55px;padding:5px 8px;border:1.5px solid #cbd5e1;border-radius:8px;text-align:center;font-size:12px;font-weight:700;outline:none;" oninput="recalcInlineTotal()" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#cbd5e1'">
                    <button type="button" onclick="this.closest('.order-item-row').remove();recalcInlineTotal();" style="width:28px;height:28px;background:#fee2e2;color:#ef4444;border:none;border-radius:6px;cursor:pointer;"><i class="fas fa-trash" style="font-size:10px;"></i></button>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;text-align:right;">
                <div>
                    <div style="font-size:14px;font-weight:800;color:#111827;">${item.name}</div>
                    ${variant}
                    <div class="edit-val" style="display:none;gap:5px;margin-top:5px;">
                        <input type="text" value="${item.color||''}" class="item-color-input" placeholder="اللون" style="width:60px;padding:4px 7px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:11px;outline:none;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#cbd5e1'">
                        <input type="text" value="${item.size||''}" class="item-size-input" placeholder="المقاس" style="width:60px;padding:4px 7px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:11px;outline:none;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#cbd5e1'">
                    </div>
                </div>
                <img src="${item.image||''}" style="width:60px;height:60px;border-radius:10px;object-fit:cover;border:1px solid #e2e8f0;">
            </div>
        </div>`;
    });

    let prodOptions = '<option value="">➕ إضافة منتج للطلب...</option>';
    if(typeof allProducts !== 'undefined') allProducts.forEach(p => { prodOptions += `<option value="${p.id}">${p.name} - ${p.price} ${cur}</option>`; });

    const storeName = document.querySelector('.sidebar-header h2')?.innerText || 'متجرنا';

    // Generate minimalist print-only items rows (no images, simple clean text table)
    let printItemsHTML = '';
    order.items.forEach((item, index) => {
        const specs = [];
        if (item.color) specs.push(`اللون: ${item.color}`);
        if (item.size) specs.push(`المقاس: ${item.size}`);
        const specsText = specs.length > 0 ? `(${specs.join(' - ')})` : '';
        
        printItemsHTML += `
        <tr style="border-bottom: 1.5px solid #000;">
            <td style="padding: 10px 8px; text-align: center; font-size: 13px; color: #000; border: 1.5px solid #000; font-weight: 400;">${index + 1}</td>
            <td style="padding: 10px; text-align: right; font-size: 13px; color: #000; border: 1.5px solid #000;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${item.image || '/public/img/no-image.png'}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; border:1px solid #eee;">
                    <div>
                        <div style="font-weight: 500; color: #000;">${item.name}</div>
                        ${specsText ? `<div style="font-size: 11px; color: #444; margin-top: 3px; font-weight: 400;">${specsText}</div>` : ''}
                    </div>
                </div>
            </td>
            <td style="padding: 10px 8px; text-align: center; font-size: 13px; color: #000; border: 1.5px solid #000; font-weight: 400;">${item.quantity}</td>
            <td style="padding: 10px 8px; text-align: center; font-size: 13px; color: #000; border: 1.5px solid #000; font-weight: 400;">${parseFloat(item.price).toFixed(2)} ${cur}</td>
            <td style="padding: 10px 8px; text-align: center; font-size: 13px; font-weight: 600; color: #000; border: 1.5px solid #000;">${(item.price * item.quantity).toFixed(2)} ${cur}</td>
        </tr>`;
    });

    const printInvoiceHTML = `
    <!-- Print Only Minimalist Commercial Sales Invoice -->
    <div class="print-only-invoice" style="display: none; padding: 40px; direction: rtl; font-family: 'Cairo', 'Tajawal', Arial, sans-serif; background: #fff !important; color: #000 !important; width: 100%; max-width: 100%; box-sizing: border-box; position: relative; font-weight: 400;">
        
        <!-- Store Identity & Invoice Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000 !important; padding-bottom: 20px; margin-bottom: 30px; width: 100%;">
            <div style="text-align: right; flex: 1.5;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #000 !important;">${storeName}</h2>
                <p style="margin: 0; font-size: 14px; color: #000 !important; font-weight: 400;">فاتورة مبيعات ضريبية مبسطة</p>
            </div>
            <div style="text-align: left; font-size: 14px; color: #000 !important; line-height: 1.8; flex: 1;">
                <div style="margin-bottom: 5px;"><strong style="font-weight: 600;">رقم الفاتورة:</strong> <span dir="ltr" style="font-weight: 600; font-size: 16px;">#${order.id}</span></div>
                <div style="margin-bottom: 5px;"><strong style="font-weight: 600;">تاريخ الإصدار:</strong> ${formattedOrderDate}</div>
                <div><strong style="font-weight: 600;">طريقة الدفع:</strong> ${order.paymentMethod || 'COD'}</div>
            </div>
        </div>

        <!-- Customer Info Summary -->
        <div style="background: #fff !important; border: 1.5px solid #000 !important; border-radius: 12px; padding: 20px; margin-bottom: 30px; font-size: 15px; line-height: 1.8; color: #000 !important; width: 100%; box-sizing: border-box; font-weight: 400;">
            <div style="display: flex; justify-content: space-between; gap: 30px; margin-bottom: 12px;">
                <div style="flex: 1;"><strong style="font-weight: 600;">العميل:</strong> ${order.customer.name || '—'}</div>
                <div style="flex: 1; text-align: left;"><strong style="font-weight: 600;">الهاتف:</strong> <span dir="ltr" style="font-weight: 600;">${order.customer.phone || '—'}</span></div>
            </div>
            <div style="border-top: 1px solid #000; padding-top: 12px;"><strong style="font-weight: 600;">العنوان:</strong> ${order.customer.city || '—'} ${order.customer.address ? ' - ' + order.customer.address : ''}</div>
            ${order.notes ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #000 !important;"><strong style="font-weight: 600;">ملاحظات العميل:</strong> ${order.notes}</div>` : ''}
        </div>

        <!-- Products Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 35px; font-size: 15px; border: 1.5px solid #000 !important; font-weight: 400;">
            <thead>
                <tr style="background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #000 !important; width: 50px; border: 1.5px solid #000 !important;">#</th>
                    <th style="padding: 12px 10px; text-align: right; font-weight: 600; color: #000 !important; border: 1.5px solid #000 !important;">اسم المنتج / الوصف</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #000 !important; width: 80px; border: 1.5px solid #000 !important;">الكمية</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #000 !important; width: 120px; border: 1.5px solid #000 !important;">سعر الوحدة</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #000 !important; width: 140px; border: 1.5px solid #000 !important;">الإجمالي</th>
                </tr>
            </thead>
            <tbody>
                ${printItemsHTML}
            </tbody>
        </table>

        <!-- Totals Financial Section -->
        <div style="display: flex; justify-content: flex-end; width: 100%;">
            <table style="width: 380px; border-collapse: collapse; font-size: 15px; border: 2px solid #000 !important; font-weight: 400;">
                <tr style="border-bottom: 1.5px solid #000 !important;">
                    <td style="padding: 10px 15px; font-weight: 500; color: #000 !important; background: #f8fafc !important; border-left: 1.5px solid #000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">مجموع المنتجات:</td>
                    <td style="padding: 10px 15px; text-align: left; font-weight: 600; color: #000 !important;">${itemsTotal.toFixed(2)} ${cur}</td>
                </tr>
                <tr style="border-bottom: 1.5px solid #000 !important;">
                    <td style="padding: 10px 15px; font-weight: 500; color: #000 !important; background: #f8fafc !important; border-left: 1.5px solid #000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">رسوم التوصيل:</td>
                    <td style="padding: 10px 15px; text-align: left; font-weight: 600; color: #000 !important;">${shippingCost > 0 ? shippingCost.toFixed(2) + ' ' + cur : 'شحن مجاني'}</td>
                </tr>
                ${discount > 0 ? `
                <tr style="border-bottom: 2px solid #000 !important;">
                    <td style="padding: 10px 15px; font-weight: 500; color: #000 !important; background: #f8fafc !important; border-left: 1.5px solid #000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">الخصم الإجمالي:</td>
                    <td style="padding: 10px 15px; text-align: left; font-weight: 600; color: #000 !important;">
                        -${discount.toFixed(2)} ${cur}
                        ${order.couponCode ? `<br><small style="color:#000 !important; font-weight:400; font-size: 12px;">(كوبون: ${order.couponCode})</small>` : ''}
                    </td>
                </tr>
                ` : ''}
                <tr style="background: #f1f5f9 !important; font-weight: 600; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                    <td style="padding: 18px 15px; font-size: 18px; border-left: 1.5 solid #000; color: #000 !important;">الإجمالي النهائي:</td>
                    <td style="padding: 18px 15px; text-align: left; font-size: 22px; color: #000 !important; font-weight: 700;">${parseFloat(order.total).toFixed(2)} ${cur}</td>
                </tr>
            </table>
        </div>

        <!-- Footer Thank you note -->
        <div style="text-align: center; border-top: 2px solid #000 !important; padding-top: 30px; margin-top: 60px; color: #000 !important; font-size: 16px; font-weight: 600;">
            نشكركم على ثقتكم في ${storeName}! نتمنى رؤيتكم مجدداً 🌸
        </div>
    </div>`;

    container.innerHTML = `
    <style>
        .order-detail-grid{display:grid;grid-template-columns:2.2fr 1fr;gap:20px;align-items:start;direction:rtl;}
        .od-card{background:#fff;border-radius:14px;border:1px solid #e5e7eb;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);}
        .od-card-title{font-size:15px;font-weight:800;color:#111827;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:12px;margin-bottom:15px;}
        .od-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #f1f5f9;}
        .od-row:last-child{border-bottom:none;}
        .od-label{font-size:13px;font-weight:500;color:#6b7280;display:flex;align-items:center;gap:8px;direction:rtl;}
        .od-label-icon{width:30px;height:30px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:13px;}
        .od-val{font-size:13px;font-weight:700;color:#111827;}
        .edit-input{width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;}
        .edit-input:focus{border-color:var(--primary);}
        @media(max-width:900px){.order-detail-grid{grid-template-columns:1fr;}}
    </style>

    <!-- Header -->
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:25px;flex-wrap:wrap;gap:15px;border-bottom:1px solid var(--border);padding-bottom:20px;direction:rtl;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
            <button onclick="switchTab(window.lastOrderListTab)" style="width:42px;height:42px;border-radius:10px;background:var(--white);border:1px solid var(--border);color:var(--text-muted);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;transition:0.2s;" onmouseover="this.style.color='var(--primary)';this.style.borderColor='var(--primary)';" onmouseout="this.style.color='var(--text-muted)';this.style.borderColor='var(--border)';"><i class="fas fa-arrow-right"></i></button>
            <div>
                <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:10px;">
                    الطلب #${order.id}
                    ${(() => {
                        const isW = order.isWholesale === true || order.isWholesale === 'true';
                        const oPhone = (order.customer?.phone || order.customerPhone || '').replace(/\s+/g, '');
                        const isDist = (window.storeDistributorsData || []).some(d => d.phone.replace(/\s+/g, '') === oPhone && d.status === 'approved');
                        return (isW || isDist) ? '<span style="background:#fff7ed; color:#c2410c; padding:4px 12px; border-radius:10px; font-size:12px; font-weight:900; border:1.5px solid #fdba74; display:flex; align-items:center; gap:5px;"><i class="fas fa-store"></i> طلب جملة</span>' : '<span style="background:#f0fafb; color:#0891b2; padding:4px 12px; border-radius:10px; font-size:12px; font-weight:900; border:1.5px solid #a5f3fc; display:flex; align-items:center; gap:5px;"><i class="fas fa-shopping-bag"></i> طلب مفرق (عادي)</span>';
                    })()}
                    <span style="font-size:12px;padding:4px 12px;border-radius:10px;font-weight:700;background:var(--primary-light);color:var(--primary);border:1.5px solid var(--primary-light);">${order.status||'جديد'}</span>
                </h2>
                <p style="margin:0;font-size:13px;color:var(--text-muted);">تاريخ الطلب: ${formattedOrderDate}</p>
            </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select style="border:1.5px solid var(--border);background:var(--bg);font-weight:700;color:var(--primary);font-size:13px;outline:none;cursor:pointer;padding:8px 12px;border-radius:10px;" onchange="changeOrderStatus('${order.id}',this.value)">
                ${['جديد','قيد المراجعة','قيد التنفيذ','تم الشحن','مكتمل','ملغي','تم الارجاع'].map(s=>`<option value="${s}" ${order.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <button onclick="printOrderInvoice()" style="padding:8px 14px;border-radius:10px;font-weight:700;font-size:13px;background:var(--white);border:1px solid var(--border);color:var(--text-main);cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="fas fa-print"></i> طباعة</button>
            <button onclick="confirmOrderWhatsApp('${order.id}')" style="padding:8px 16px;border-radius:10px;font-weight:700;font-size:13px;background:#25d366;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;gap:6px;transition:0.2s;" onmouseover="this.style.background='#128c7e';" onmouseout="this.style.background='#25d366';"><i class="fab fa-whatsapp" style="font-size:15px;"></i> تأكيد واتساب</button>
            <button class="btn-edit-order" onclick="toggleOrderEdit('${order.id}',true)" style="padding:8px 18px;border-radius:10px;font-weight:700;font-size:13px;background:var(--primary);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;gap:6px;transition:0.2s;"><i class="fas fa-edit"></i> تعديل الطلب</button>
            <button class="btn-save-order" onclick="submitInlineEdit(event,'${order.id}')" style="display:none;padding:8px 18px;border-radius:10px;font-weight:700;font-size:13px;background:#10b981;border:none;color:#fff;cursor:pointer;align-items:center;gap:6px;"><i class="fas fa-save"></i> حفظ التغييرات</button>
            <button class="btn-cancel-edit" onclick="toggleOrderEdit('${order.id}',false)" style="display:none;padding:8px 14px;border-radius:10px;font-weight:700;font-size:13px;background:#fff;border:1.5px solid var(--border);color:var(--text-muted);cursor:pointer;align-items:center;gap:6px;"><i class="fas fa-times"></i> إلغاء</button>
            <button onclick="deleteStoreOrder('${order.id}')" style="padding:8px 16px;border-radius:10px;font-weight:700;font-size:13px;background:#ef4444;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;gap:6px;transition:0.2s;" onmouseover="this.style.background='#dc2626';" onmouseout="this.style.background='#ef4444';"><i class="fas fa-trash-alt"></i> حذف الطلب</button>
        </div>
    </div>

    <!-- Grid -->
    <div class="order-detail-grid">
        <!-- Right: Products + Summary -->
        <div>
            <div class="od-card">
                <div class="od-card-title"><span>منتجات الطلب</span><i class="fas fa-shopping-bag" style="color:var(--primary);"></i></div>
                <div id="inline-items-list">${itemsHTML}</div>
                <div class="edit-val add-product-bar" style="display:none; margin-top:15px; text-align:center;">
                    <button onclick="openProductSelectorModal('${cur}')" style="background:var(--primary-light); color:var(--primary); border:1px dashed var(--primary); padding:10px 20px; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px; transition:0.3s;" onmouseover="this.style.background='var(--primary)'; this.style.color='#fff';" onmouseout="this.style.background='var(--primary-light)'; this.style.color='var(--primary)';"><i class="fas fa-plus-circle"></i> إضافة منتج للطلب</button>
                </div>
            </div>
            <div class="od-card">
                <div class="od-card-title"><span>ملخص الحساب</span><i class="fas fa-calculator" style="color:var(--primary);"></i></div>
                <div class="od-row">
                    <span class="od-label"><span class="od-label-icon"><i class="fas fa-tags"></i></span><span>نوع الطلب</span></span>
                    <span class="od-val">${(() => {
                        const isW = order.isWholesale === true || order.isWholesale === 'true';
                        const oPhone = (order.customer?.phone || order.customerPhone || '').replace(/\s+/g, '');
                        const isDist = (window.storeDistributorsData || []).some(d => d.phone.replace(/\s+/g, '') === oPhone && d.status === 'approved');
                        return (isW || isDist) ? 'جملة' : 'مفرق (عادي)';
                    })()}</span>
                </div>
                <div class="od-row">
                    <span class="od-label"><span class="od-label-icon"><i class="fas fa-credit-card"></i></span><span>وسيلة الدفع</span></span>
                    <span class="od-val">${order.paymentMethod||'COD'}</span>
                </div>
                <div class="od-row">
                    <span class="od-label"><span class="od-label-icon"><i class="fas fa-box"></i></span><span>مجموع المنتجات</span></span>
                    <span class="od-val view-val">${itemsTotal.toFixed(2)} ${cur}</span>
                </div>
                <div class="od-row">
                    <span class="od-label"><span class="od-label-icon"><i class="fas fa-truck"></i></span><span>رسوم التوصيل</span></span>
                    <div class="view-val od-val">${shippingCost>0?shippingCost+' '+cur:'شحن مجاني'}</div>
                    <div class="edit-val" style="display:none;"><input type="number" step="0.01" name="shippingCost" value="${shippingCost}" class="edit-input" style="width:100px;text-align:center;" oninput="recalcInlineTotal()" placeholder="رسوم الشحن"></div>
                </div>
                <div class="od-row">
                    <span class="od-label"><span class="od-label-icon"><i class="fas fa-tag"></i></span><span>الخصم ${order.couponCode ? `<span style="font-size:10px; color:var(--primary); margin-right:5px; background:var(--primary-light); padding:2px 6px; border-radius:4px;">كوبون: ${order.couponCode}</span>` : ''}</span></span>
                    <div class="view-val od-val" style="color:#ef4444;">${discount>0?'-'+discount+' '+cur:'لا يوجد'}</div>
                    <div class="edit-val" style="display:none; flex-direction:column; gap:5px;">
                        <input type="number" step="0.01" name="discount" value="${discount}" class="edit-input" style="width:100px;text-align:center;" oninput="recalcInlineTotal()" placeholder="الخصم">
                        <input type="text" name="couponCode" value="${order.couponCode || ''}" class="edit-input" style="width:100px;text-align:center; font-size:11px;" placeholder="كود الكوبون">
                    </div>
                </div>
                <div class="od-row" style="border-top:2px solid #e2e8f0;margin-top:8px;padding-top:15px;">
                    <span class="od-label" style="font-size:15px;font-weight:800;color:#111827;">الإجمالي النهائي</span>
                    <span style="font-size:20px;font-weight:900;color:var(--primary);" id="inline-total-display">${parseFloat(order.total).toFixed(2)} ${cur}</span>
                </div>
            </div>
        </div>

        <!-- Left: Customer + UTM -->
        <div>
            <div class="od-card">
                <div class="od-card-title"><span>بيانات العميل</span><i class="far fa-user" style="color:var(--primary);"></i></div>
                ${[
                    {label:'الاسم',icon:'fas fa-user',field:'name',val:order.customer.name||'',type:'text'},
                    {label:'الهاتف',icon:'fas fa-phone',field:'phone',val:order.customer.phone||'',type:'text',ltr:true},
                    {label:'البريد',icon:'far fa-envelope',field:'email',val:order.customer.email||'',type:'email',ltr:true},
                    {label:'المدينة',icon:'fas fa-city',field:'city',val:order.customer.city||'',type:'text'},
                    {label:'العنوان',icon:'fas fa-map-marker-alt',field:'address',val:order.customer.address||'',type:'text'},
                ].map(f=>`
                <div class="od-row">
                    <span class="od-label"><span class="od-label-icon"><i class="${f.icon}"></i></span><span>${f.label}</span></span>
                    <div>
                        <div class="view-val od-val" dir="${f.ltr?'ltr':'rtl'}" style="display:inline-flex;align-items:center;gap:6px;">
                            ${f.val ? `
                                <span>${f.val}</span>
                                <a href="javascript:void(0)" onclick="copyToClipboard('${f.val.replace(/'/g, "\\'")}', this, '${f.label}')" style="color:var(--text-muted);font-size:12px;display:inline-flex;align-items:center;vertical-align:middle;margin-right:4px;" title="نسخ">
                                    <i class="far fa-copy"></i>
                                </a>
                            ` : '—'}
                            ${f.field==='phone' && f.val ? `<a href="javascript:void(0)" onclick="confirmOrderWhatsApp('${order.id}')" style="color:#25d366;font-size:14px;display:inline-flex;align-items:center;vertical-align:middle;margin-right:4px;" title="تأكيد عبر واتساب"><i class="fab fa-whatsapp"></i></a>` : ''}
                        </div>
                        <input data-field="${f.field}" type="${f.type}" value="${f.val}" class="edit-val edit-input" style="display:none;${f.ltr?'direction:ltr;text-align:left;':''}" placeholder="${f.label}">
                    </div>
                </div>`).join('')}
                <div class="od-row" style="margin-top: 10px;">
                    <span class="od-label"><span class="od-label-icon"><i class="fas fa-sticky-note"></i></span><span>ملاحظات الطلب</span></span>
                    <div>
                        <div class="view-val od-val" style="white-space: pre-wrap; display:inline-flex; align-items:center; gap:6px;">
                            ${order.notes ? `
                                <span>${order.notes}</span>
                                <a href="javascript:void(0)" onclick="copyToClipboard('${order.notes.replace(/'/g, "\\'")}', this, 'ملاحظات الطلب')" style="color:var(--text-muted);font-size:12px;display:inline-flex;align-items:center;vertical-align:middle;margin-right:4px;" title="نسخ">
                                    <i class="far fa-copy"></i>
                                </a>
                            ` : 'لا يوجد ملاحظات'}
                        </div>
                        <textarea data-field="notes" class="edit-val edit-input" style="display:none; width: 100%; min-height: 60px;" placeholder="ملاحظات الطلب">${order.notes||''}</textarea>
                    </div>
                </div>
            </div>
            <div class="od-card visitor-tracking-card">
                <div class="od-card-title"><span>تتبع الزيارة</span><i class="fas fa-chart-line" style="color:var(--primary);"></i></div>
                <div class="od-row"><span class="od-label"><span class="od-label-icon"><i class="fas fa-calendar-alt"></i></span><span>أول زيارة</span></span><span class="od-val" dir="ltr">${renderFirstVisit()}</span></div>
                <div class="od-row"><span class="od-label"><span class="od-label-icon"><i class="fas fa-users"></i></span><span>عدد الجلسات</span></span><span class="od-val">${order.sessionCount || 1}</span></div>
                <div class="od-row"><span class="od-label"><span class="od-label-icon"><i class="fas fa-stopwatch"></i></span><span>الوقت المستغرق</span></span><span class="od-val">${renderTimeSpent()}</span></div>
                <div class="od-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;" onclick="toggleVisitedPagesList()">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-chevron-down" id="visitedPagesChevron" style="font-size:12px; color:var(--primary); transition: transform 0.3s; transform: rotate(0deg);"></i>
                            <span class="od-val" style="color:var(--primary); font-weight:800;">${Array.isArray(order.visitedPages) ? order.visitedPages.length : 0} صفحات</span>
                        </div>
                        <span class="od-label"><span class="od-label-icon"><i class="fas fa-file-alt"></i></span><span>الصفحات المزارة</span></span>
                    </div>
                    <div id="visitedPagesDropdownList" style="display:none; margin-top:5px; width: 100%;">
                        ${pagesHTML}
                    </div>
                </div>
                <div class="od-row"><span class="od-label"><span class="od-label-icon"><i class="far fa-eye"></i></span><span>المصدر</span></span><span class="od-val">${order.referrer||'مباشر'}</span></div>
                <div class="od-row"><span class="od-label"><span class="od-label-icon"><i class="fas fa-external-link-alt"></i></span><span>UTM Source</span></span><span class="od-val">${order.utm_source||'—'}</span></div>
                <div class="od-row"><span class="od-label"><span class="od-label-icon"><i class="fas fa-bullseye"></i></span><span>UTM Campaign</span></span><span class="od-val">${order.utm_campaign||'—'}</span></div>
            </div>
        </div>
    </div>
    ${printInvoiceHTML}`;
}

function toggleOrderEdit(orderId, editing) {
    const body = document.getElementById('pageOrderBody');
    if(!body) return;
    body.querySelectorAll('.view-val').forEach(el => el.style.display = editing ? 'none' : '');
    body.querySelectorAll('.edit-val').forEach(el => {
        el.style.display = editing ? (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' ? 'block' : 'flex') : 'none';
    });
    body.querySelectorAll('.add-product-bar').forEach(el => el.style.display = editing ? 'block' : 'none');
    body.querySelectorAll('.btn-edit-order').forEach(el => { el.style.display = editing ? 'none' : 'flex'; });
    body.querySelectorAll('.btn-save-order,.btn-cancel-edit').forEach(el => { el.style.display = editing ? 'flex' : 'none'; });
    if(!editing) {
        const sel = document.getElementById('inline-add-product-select');
        if(sel) sel.value = '';
    }
}

window.recalcInlineTotal = function() {
    const body = document.getElementById('pageOrderBody');
    if(!body) return;
    let sum = 0;
    body.querySelectorAll('#inline-items-list .order-item-row').forEach(row => {
        const p = parseFloat(row.querySelector('.item-price-input')?.value) || 0;
        const q = parseInt(row.querySelector('.item-qty-input')?.value) || 1;
        sum += p * q;
    });
    const ship = parseFloat(body.querySelector('input[name="shippingCost"]')?.value) || 0;
    const disc = parseFloat(body.querySelector('input[name="discount"]')?.value) || 0;
    const total = document.getElementById('inline-total-display');
    const cur = window.storeCurrency || '₪';
    if(total) total.textContent = (sum + ship - disc).toFixed(2) + ' ' + cur;
};

window.addProductInline = function(prodId, cur) {
    if(!prodId) return;
    const product = allProducts.find(p => String(p.id) === String(prodId));
    if(!product) return;
    const list = document.getElementById('inline-items-list');
    if(!list) return;
    const existing = list.querySelector(`.order-item-row[data-id="${product.id}"]`);
    if(existing) {
        const q = existing.querySelector('.item-qty-input');
        if(q) q.value = parseInt(q.value) + 1;
        recalcInlineTotal();
        document.getElementById('inline-add-product-select').value = '';
        return;
    }
    const row = document.createElement('div');
    row.className = 'order-item-row';
    row.dataset.id = product.id;
    row.dataset.name = product.name;
    row.dataset.image = product.image || '';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:15px 0;border-bottom:1px solid #f1f5f9;';
    row.innerHTML = `
        <div>
            <div class="view-val" style="display:none;"></div>
            <div class="edit-val" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                <input type="number" step="0.01" value="${product.price}" class="item-price-input" style="width:75px;padding:5px 8px;border:1.5px solid #cbd5e1;border-radius:8px;text-align:center;font-size:12px;font-weight:700;outline:none;" oninput="recalcInlineTotal()">
                <span style="font-size:11px;color:#64748b;">x</span>
                <input type="number" min="1" value="1" class="item-qty-input" style="width:55px;padding:5px 8px;border:1.5px solid #cbd5e1;border-radius:8px;text-align:center;font-size:12px;font-weight:700;outline:none;" oninput="recalcInlineTotal()">
                <button type="button" onclick="this.closest('.order-item-row').remove();recalcInlineTotal();" style="width:28px;height:28px;background:#fee2e2;color:#ef4444;border:none;border-radius:6px;cursor:pointer;"><i class="fas fa-trash" style="font-size:10px;"></i></button>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;text-align:right;">
            <div>
                <div style="font-size:14px;font-weight:800;color:#111827;">${product.name}</div>
                <div class="edit-val" style="display:flex;gap:5px;margin-top:4px;">
                    <input type="text" value="" class="item-color-input" placeholder="اللون" style="width:60px;padding:4px 7px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:11px;outline:none;">
                    <input type="text" value="" class="item-size-input" placeholder="المقاس" style="width:60px;padding:4px 7px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:11px;outline:none;">
                </div>
            </div>
            <img src="${product.image||''}" style="width:55px;height:55px;border-radius:10px;object-fit:cover;border:1px solid #e2e8f0;">
        </div>`;
    list.appendChild(row);
    recalcInlineTotal();
    document.getElementById('inline-add-product-select').value = '';
};

async function changeOrderStatus(orderId, newStatus) {
    try {
        const result = await DB.updateOrder(orderId, { status: newStatus });
        if (result) {
            const order = window.storeOrdersData.find(o => o.id === orderId);
            if(order) order.status = newStatus;
            showToast('✅ تم تحديث حالة الطلب');
        } else { showToast('❌ خطأ'); }
    } catch(err) { showToast('❌ فشل الاتصال'); }
}

async function deleteStoreOrder(orderId) {
    showConfirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيتم إعادة المنتجات للمخزون إذا لزم الأمر.', async () => {
        try {
            const result = await DB.deleteOrder(orderId);
            if (result) {
                showToast('✅ تم حذف الطلب بنجاح');
                setTimeout(() => {
                    window.location.href = 'dashboard.html?tab=orders';
                }, 1000);
            } else {
                showToast('❌ خطأ أثناء الحذف');
            }
        } catch(err) {
            showToast('❌ فشل الاتصال بالخادم');
        }
    });
}

async function addOrderNote(orderId) {
    const textarea = document.getElementById(`note-textarea-${orderId}`);
    if(!textarea) return;
    const noteText = textarea.value.trim();
    if(!noteText) { showToast('⚠️ اكتب ملاحظة أولاً'); return; }
    try {
        const result = await DB.updateOrder(orderId, { notes: noteText });
        if(result) {
            const order = window.storeOrdersData.find(o => o.id === orderId);
            if(order) order.notes = noteText;
            showToast('✅ تم حفظ الملاحظة');
            viewOrder(orderId);
        } else { showToast('❌ خطأ'); }
    } catch(err) { showToast('❌ فشل الاتصال'); }
}

window.recalculateModalTotal = window.recalcInlineTotal;
window.addProdToOrderModal = window.addProductInline;
function openEditOrderModal(orderId) { toggleOrderEdit(orderId, true); }

async function submitInlineEdit(event, orderId) {
    if(event) event.preventDefault();
    const body = document.getElementById('pageOrderBody');
    if(!body) return;
    const items = [];
    body.querySelectorAll('#inline-items-list .order-item-row').forEach(row => {
        items.push({
            id: row.dataset.id, name: row.dataset.name, image: row.dataset.image,
            price: parseFloat(row.querySelector('.item-price-input')?.value) || 0,
            quantity: parseInt(row.querySelector('.item-qty-input')?.value) || 1,
            color: row.querySelector('.item-color-input')?.value || '',
            size: row.querySelector('.item-size-input')?.value || ''
        });
    });
    const data = {
        orderId,
        name: body.querySelector('[data-field="name"]')?.value || '',
        phone: body.querySelector('[data-field="phone"]')?.value || '',
        email: body.querySelector('[data-field="email"]')?.value || '',
        city: body.querySelector('[data-field="city"]')?.value || '',
        address: body.querySelector('[data-field="address"]')?.value || '',
        shippingCost: body.querySelector('input[name="shippingCost"]')?.value || 0,
        discount: body.querySelector('input[name="discount"]')?.value || 0,
        couponCode: body.querySelector('input[name="couponCode"]')?.value || '',
        items: JSON.stringify(items)
    };
    try {
        const result = await DB.updateOrder(orderId, data);
        if(result) {
            const idx = window.storeOrdersData.findIndex(o => o.id === orderId);
            if(idx > -1) Object.assign(window.storeOrdersData[idx], data);
            showToast('✅ تم حفظ التغييرات بنجاح');
            viewOrder(orderId);
        } else { showToast('❌ خطأ في الحفظ'); }
    } catch(err) { showToast('❌ فشل الاتصال بالسيرفر'); }
}

async function submitEditOrder(event, orderId) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            
            // Gather updated items list
            const items = [];
            document.querySelectorAll('.modal-item-row').forEach(row => {
                items.push({
                    id: row.dataset.id,
                    name: row.dataset.name,
                    image: row.dataset.image,
                    price: parseFloat(row.querySelector('.item-price-input').value) || 0,
                    quantity: parseInt(row.querySelector('.item-qty-input').value) || 1,
                    color: row.querySelector('.item-color-input')?.value || '',
                    size: row.querySelector('.item-size-input')?.value || ''
                });
            });
            
            const data = {
                orderId,
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                city: formData.get('city'),
                address: formData.get('address'),
                shippingCost: formData.get('shippingCost'),
                discount: formData.get('discount'),
                couponCode: formData.get('couponCode') || '',
                items: JSON.stringify(items)
            };
            


            try {
                const result = await DB.updateOrder(orderId, data);
                if (result) {
                    // Update local store
                    const orderIndex = window.storeOrdersData.findIndex(o => o.id === orderId);
                    if (orderIndex > -1) {
                        Object.assign(window.storeOrdersData[orderIndex], data);
                    }
                    showToast('✅ تم تحديث بيانات ومنتجات الطلب بنجاح');
                    viewOrder(orderId); // Refresh UI
                } else {
                    showToast('❌حدث خطأ أثناء تحديث الطلب');
                }
            } catch (err) {
                console.error(err);
                showToast('❌ فشل في الاتصال بالسيرفر');
            }
        }

window.openProductSelectorModal = async function(cur) {
    let modal = document.getElementById('productSelectorModal');
    let selectedProductIds = [];

    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'productSelectorModal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(4px);';
        
        modal.innerHTML = `
            <div style="background:#fff; width:90%; max-width:600px; border-radius:20px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.2); display:flex; flex-direction:column; max-height:85vh; direction:rtl;">
                <div style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:var(--gray-50);">
                    <h3 style="margin:0; font-weight:800; color:var(--dark);"><i class="fas fa-box-open" style="color:var(--primary); margin-left:8px;"></i> اختر منتجات للإضافة</h3>
                    <button onclick="document.getElementById('productSelectorModal').style.display='none'" style="background:none; border:none; font-size:20px; color:var(--gray-400); cursor:pointer;"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding:15px; border-bottom:1px solid #e2e8f0;">
                    <div style="position:relative;">
                        <input type="text" id="productSelectorSearch" placeholder="ابحث باسم المنتج..." onkeyup="filterProductSelector()" style="width:100%; padding:12px 15px 12px 40px; border:2px solid #e2e8f0; border-radius:12px; font-size:14px; outline:none; font-family:inherit;">
                        <i class="fas fa-search" style="position:absolute; left:15px; top:50%; transform:translateY(-50%); color:var(--gray-400);"></i>
                    </div>
                </div>
                <div id="productSelectorList" style="padding:15px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:10px; background:#f8fafc;">
                    <div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin" style="font-size:24px; color:var(--primary);"></i> جاري تحميل المنتجات...</div>
                </div>
                <div style="padding:15px 20px; border-top:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                    <button id="productSelectorConfirmBtn" disabled style="padding:12px 24px; background:#e2e8f0; color:#94a3b8; border:none; border-radius:12px; font-weight:800; font-size:14px; cursor:not-allowed; transition:0.2s; font-family:inherit; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-plus"></i> إضافة المنتجات المحددة للطلب
                    </button>
                    <button onclick="document.getElementById('productSelectorModal').style.display='none'" style="padding:12px 20px; background:#fff; color:#64748b; border:1px solid #e2e8f0; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer; transition:0.2s; font-family:inherit;">
                        إلغاء
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    document.getElementById('productSelectorSearch').value = '';
    
    const confirmBtn = document.getElementById('productSelectorConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.style.background = '#e2e8f0';
    confirmBtn.style.color = '#94a3b8';
    confirmBtn.style.cursor = 'not-allowed';
    confirmBtn.style.boxShadow = 'none';
    confirmBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة المنتجات المحددة للطلب';
    confirmBtn.onclick = null;

    const list = document.getElementById('productSelectorList');
    
    let products = [];
    try {
        products = await DB.getProducts();
    } catch(e) {
        console.error(e);
    }
    window._productSelectorAllProducts = products;
    
    list.innerHTML = '';
    
    const updateConfirmBtnState = () => {
        if(selectedProductIds.length > 0) {
            confirmBtn.disabled = false;
            confirmBtn.style.background = 'var(--primary)';
            confirmBtn.style.color = '#fff';
            confirmBtn.style.cursor = 'pointer';
            confirmBtn.style.boxShadow = '0 10px 15px -3px rgba(79, 70, 229, 0.3)';
            confirmBtn.innerHTML = `<i class="fas fa-plus"></i> إضافة المنتجات المحددة للطلب (${selectedProductIds.length})`;
            
            confirmBtn.onclick = () => {
                selectedProductIds.forEach(id => {
                    addProductInline(id, cur);
                });
                modal.style.display = 'none';
                showToast(`✅ تمت إضافة ${selectedProductIds.length} منتجات بنجاح`);
            };
        } else {
            confirmBtn.disabled = true;
            confirmBtn.style.background = '#e2e8f0';
            confirmBtn.style.color = '#94a3b8';
            confirmBtn.style.cursor = 'not-allowed';
            confirmBtn.style.boxShadow = 'none';
            confirmBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة المنتجات المحددة للطلب';
            confirmBtn.onclick = null;
        }
    };

    if(products && products.length > 0) {
        products.forEach(p => {
            const row = document.createElement('div');
            row.className = 'ps-product-item';
            row.setAttribute('data-id', p.id);
            row.style.cssText = 'display:flex; align-items:center; gap:15px; padding:12px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; cursor:pointer; transition:all 0.2s;';
            
            row.onmouseover = () => {
                if(!selectedProductIds.includes(p.id)) {
                    row.style.borderColor = 'var(--primary)';
                    row.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
                }
            };
            row.onmouseout = () => {
                if(!selectedProductIds.includes(p.id)) {
                    row.style.borderColor = '#e2e8f0';
                    row.style.boxShadow = 'none';
                }
            };
            
            row.onclick = () => {
                if(selectedProductIds.includes(p.id)) {
                    selectedProductIds = selectedProductIds.filter(id => id !== p.id);
                    
                    row.style.borderColor = '#e2e8f0';
                    row.style.background = '#fff';
                    row.style.boxShadow = 'none';
                    
                    const indicator = row.querySelector('.ps-prod-indicator');
                    if(indicator) {
                        indicator.style.background = 'var(--primary-light)';
                        indicator.style.color = 'var(--primary)';
                        indicator.style.boxShadow = 'none';
                        indicator.innerHTML = '<i class="fas fa-plus"></i>';
                    }
                } else {
                    selectedProductIds.push(p.id);
                    
                    row.style.borderColor = 'var(--primary)';
                    row.style.background = '#f5f3ff';
                    row.style.boxShadow = '0 8px 20px rgba(79, 70, 229, 0.08)';
                    
                    const indicator = row.querySelector('.ps-prod-indicator');
                    if(indicator) {
                        indicator.style.background = '#10b981';
                        indicator.style.color = '#fff';
                        indicator.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
                        indicator.innerHTML = '<i class="fas fa-check"></i>';
                    }
                }
                
                updateConfirmBtnState();
            };
            
            row.innerHTML = `
                <img src="${p.image}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; border:1px solid #e2e8f0;">
                <div style="flex:1;">
                    <div class="ps-prod-name" style="font-weight:700; font-size:14px; color:var(--dark); margin-bottom:4px;">${p.name}</div>
                    <div style="font-size:12px; color:var(--gray-500);">السعر: <strong style="color:var(--primary);">${p.price} ${cur}</strong></div>
                </div>
                <div class="ps-prod-indicator" style="width:36px; height:36px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; transition:all 0.2s;">
                    <i class="fas fa-plus"></i>
                </div>
            `;
            list.appendChild(row);
        });
    } else {
        list.innerHTML = '<div style="text-align:center; color:var(--gray-400); padding:30px;">لا توجد منتجات متاحة</div>';
    }
};

window.filterProductSelector = function() {
    const term = document.getElementById('productSelectorSearch').value.toLowerCase();
    const items = document.querySelectorAll('.ps-product-item');
    items.forEach(item => {
        const name = item.querySelector('.ps-prod-name').innerText.toLowerCase();
        item.style.display = name.includes(term) ? 'flex' : 'none';
    });
};

// --- WhatsApp Confirmation logic ---
window.confirmOrderWhatsApp = function(orderId) {
    const order = window.storeOrdersData.find(o => o.id === orderId);
    if(!order) return;
    const cur = window.storeCurrency || '₪';
    
    let phone = order.customer.phone || '';
    phone = phone.replace(/\s+/g, '').replace('+', '');
    
    if (phone.startsWith('05')) {
        phone = '972' + phone.slice(1);
    } else if (phone.startsWith('07')) {
        phone = '962' + phone.slice(1);
    } else if (phone.startsWith('0')) {
        phone = '970' + phone.slice(1);
    }
    
    const itemsText = order.items.map(item => `- ${item.name} (${item.quantity} × ${item.price} ${cur})`).join('\n');
    
    const msg = `مرحباً ${order.customer.name}،\n\nنود تأكيد طلبك من متجرنا بقيمة إجمالية *${parseFloat(order.total).toFixed(2)} ${cur}*.\n\n*تفاصيل المنتجات:*\n${itemsText}\n\n*العنوان:*\n${order.customer.city} - ${order.customer.address}\n\nيرجى تأكيد الطلب بالرد على هذه الرسالة. شكراً لك!`;
    
    const encoded = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    window.open(url, '_blank');
};

// --- Visited Pages Toggle Accordion logic ---
window.toggleVisitedPagesList = function() {
    const list = document.getElementById('visitedPagesDropdownList');
    const chevron = document.getElementById('visitedPagesChevron');
    if (list.style.display === 'none' || !list.style.display) {
        list.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        list.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
};

// --- Copy to Clipboard logic ---
window.copyToClipboard = function(text, el, label) {
    if(!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showCopySuccess(el, label, text);
        } catch (err) {
            console.error('Failed to copy text', err);
        }
        document.body.removeChild(textArea);
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showCopySuccess(el, label, text);
    }).catch(err => {
        console.error('Failed to copy text', err);
    });
};

function showCopySuccess(el, label, val) {
    const icon = el.querySelector('i');
    if(icon) {
        icon.className = 'fas fa-check';
        icon.style.color = '#10b981';
        setTimeout(() => {
            icon.className = 'far fa-copy';
            icon.style.color = '';
        }, 1500);
    }

    if (!document.getElementById('ps-toast-style')) {
        const style = document.createElement('style');
        style.id = 'ps-toast-style';
        style.innerHTML = `
            .ps-toast {
                position: fixed;
                bottom: 30px;
                right: 30px;
                background: #10b981;
                color: #fff;
                padding: 14px 24px;
                border-radius: 14px;
                box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 14px;
                font-weight: 800;
                z-index: 9999;
                animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1), toastFadeOut 0.35s ease-in 2s forwards;
                direction: rtl;
                font-family: 'Tajawal', sans-serif;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .ps-toast-icon-wrap {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            }
            @keyframes toastSlideIn {
                from { transform: translateY(100px) scale(0.9); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes toastFadeOut {
                to { transform: translateY(-20px) scale(0.95); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    const toast = document.createElement('div');
    toast.className = 'ps-toast';
    toast.innerHTML = `
        <div class="ps-toast-icon-wrap"><i class="fas fa-check"></i></div>
        <div>
            <div style="font-size:13px; font-weight:800; margin-bottom:2px;">تم النسخ بنجاح</div>
            <div style="font-size:11px; font-weight:600; opacity:0.9;">تم نسخ ${label}: <span style="font-weight:800;">${val}</span></div>
        </div>
    `;

    document.querySelectorAll('.ps-toast').forEach(t => t.remove());
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2350);
}

// ===== Live New Orders Monitoring with Customizable Notification Sound =====
let dashboardAudioCtx = null;

function initDashboardAudio() {
    try {
        if (!dashboardAudioCtx) {
            dashboardAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (dashboardAudioCtx.state === 'suspended') {
            dashboardAudioCtx.resume();
        }
    } catch(e) {
        console.error("Failed to initialize AudioContext:", e);
    }
}

// Bind to multiple user interactions to guarantee unlocking the sound
['click', 'keydown', 'mousedown', 'touchstart'].forEach(type => {
    document.addEventListener(type, initDashboardAudio, { passive: true });
});

function playCashRegisterSound() {
    const soundType = localStorage.getItem('orderSoundType') || 'cashier';
    const volumePercent = parseInt(localStorage.getItem('orderSoundVolume') || '80');
    const customData = localStorage.getItem('customOrderSound') || null;
    playSoundCore(soundType, volumePercent, customData, 'order');
}

function playDistributorSound() {
    const soundType = localStorage.getItem('distributorSoundType') || 'bell';
    const volumePercent = parseInt(localStorage.getItem('orderSoundVolume') || '80');
    const customData = localStorage.getItem('customDistributorSound') || null;
    playSoundCore(soundType, volumePercent, customData, 'distributor');
}

function playSoundCore(soundType, volumePercent, customData, kind) {
    try {
        const gainVal = volumePercent / 100;
        if (gainVal <= 0) return; // Silent if volume is 0

        // Custom Sound playing logic
        if (soundType === 'custom') {
            if (customData) {
                const audio = new Audio(customData);
                audio.volume = gainVal;
                audio.play().catch(e => console.error("Custom audio play blocked:", e));
                return;
            } else {
                showToast(kind === 'distributor' ? 'ℹ️ لم تقم برفع ملف صوتي مخصص للموزعين بعد.' : 'ℹ️ لم تقم برفع ملف صوتي مخصص بعد. تم استخدام النغمة الافتراضية.');
            }
        }

        if (soundType === 'mane') {
            const audio = new Audio('audio/mane.mp3');
            audio.volume = gainVal;
            audio.play().catch(e => console.error("mane.mp3 play blocked:", e));
            return;
        }

        // Initialize or resume global AudioContext
        if (!dashboardAudioCtx) {
            dashboardAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (dashboardAudioCtx.state === 'suspended') {
            dashboardAudioCtx.resume();
        }

        const ctx = dashboardAudioCtx;

        if (soundType === 'cashier') {
            // Enhanced Real Money Cash Register sound
            // Ring 1: High metallic ping ("cha")
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1450, ctx.currentTime);
            gain1.gain.setValueAtTime(0, ctx.currentTime);
            gain1.gain.linearRampToValueAtTime(0.25 * gainVal, ctx.currentTime + 0.01);
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.25);

            // Ring 2: Higher metallic chime starting slightly later ("ching")
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1750, ctx.currentTime + 0.08);
            gain2.gain.setValueAtTime(0, ctx.currentTime + 0.08);
            gain2.gain.linearRampToValueAtTime(0.3 * gainVal, ctx.currentTime + 0.09);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc2.start(ctx.currentTime + 0.08);
            osc2.stop(ctx.currentTime + 0.5);

            // Ring 3: Coins rattling
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.connect(gain3);
            gain3.connect(ctx.destination);
            osc3.type = 'sawtooth';
            osc3.frequency.setValueAtTime(950, ctx.currentTime + 0.12);
            gain3.gain.setValueAtTime(0, ctx.currentTime + 0.12);
            gain3.gain.linearRampToValueAtTime(0.1 * gainVal, ctx.currentTime + 0.13);
            gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc3.start(ctx.currentTime + 0.12);
            osc3.stop(ctx.currentTime + 0.4);
            
        } else if (soundType === 'bell') {
            // Elegant crystal-clean classical bell chime
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // Note A5
            // Add high harmonics for metallic crystal shine
            const oscH = ctx.createOscillator();
            const gainH = ctx.createGain();
            oscH.connect(gainH);
            gainH.connect(ctx.destination);
            oscH.type = 'sine';
            oscH.frequency.setValueAtTime(1760, ctx.currentTime); // Octave up
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.4 * gainVal, ctx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            
            gainH.gain.setValueAtTime(0, ctx.currentTime);
            gainH.gain.linearRampToValueAtTime(0.15 * gainVal, ctx.currentTime + 0.01);
            gainH.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.2);
            oscH.start(ctx.currentTime);
            oscH.stop(ctx.currentTime + 0.8);
            
        } else if (soundType === 'success') {
            // Soft bubbily digital success chime
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            osc.type = 'sine';
            // Arpeggio frequency ramp
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.08); // E5
            osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.16); // G5
            osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.24); // C6
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.35 * gainVal, ctx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.6);
        }
    } catch(e) {
        console.error("Audio playback error:", e);
    }
}

function requestNotificationPermission() {
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    }
}

function showNativeNotification(title, options) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    
    options = options || {};
    options.icon = options.icon || "/favicon.ico";
    options.badge = options.badge || "/favicon.ico";
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, options).catch(err => {
                console.error("SW notification error, falling back:", err);
                try { new Notification(title, options); } catch(e) {}
            });
        });
    } else {
        try { new Notification(title, options); } catch(e) {}
    }
}

function showOrderNotification(order) {
    if (!order) return;
    
    const customer = order.customer || {};
    const customerName = customer.name || customer.phone || 'عميل';
    const customerCity = customer.city || '—';

    // Play selected notification sound
    playCashRegisterSound();

    // Show native OS/browser notification
    showNativeNotification(`💰 طلب جديد وارد بقيمة ${order.total} ₪!`, {
        body: `الزبون: ${customerName}\nالبلد/المدينة: ${customerCity}\nرقم الطلب: ${order.id}`,
        icon: "/favicon.ico",
        silent: false
    });

    // Show a premium visual push notification on the dashboard screen
    const liveAlert = document.createElement('div');
    liveAlert.style.position = 'fixed';
    liveAlert.style.bottom = '24px';
    liveAlert.style.left = '24px';
    liveAlert.style.background = '#10b981';
    liveAlert.style.color = '#ffffff';
    liveAlert.style.padding = '18px 25px';
    liveAlert.style.borderRadius = '16px';
    liveAlert.style.boxShadow = '0 10px 30px rgba(16,185,129,0.3)';
    liveAlert.style.zIndex = '999999';
    liveAlert.style.fontWeight = 'bold';
    liveAlert.style.display = 'flex';
    liveAlert.style.alignItems = 'center';
    liveAlert.style.gap = '12px';
    liveAlert.style.direction = 'rtl';
    liveAlert.style.cursor = 'pointer';
    liveAlert.style.fontFamily = 'inherit';
    liveAlert.style.border = '1px solid rgba(255,255,255,0.2)';
    liveAlert.style.animation = 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    liveAlert.innerHTML = `
        <div style="background:rgba(255,255,255,0.2); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px;">
            <i class="fas fa-coins"></i>
        </div>
        <div>
            <div style="font-size:14px; font-weight:800; margin-bottom:2px;">تم استلام طلب جديد وارد! 💰</div>
            <div style="font-size:12px; font-weight:600; opacity:0.9;">#${order.id} بقيمة ${order.total} ₪ للزبون ${customerName}</div>
            <div style="font-size:11px; font-weight:500; opacity:0.8;">المدينة: ${customerCity}</div>
        </div>
    `;

    liveAlert.onclick = function() {
        liveAlert.remove();
        if (typeof viewOrder === 'function') {
            viewOrder(order.id);
        }
    };

    document.body.appendChild(liveAlert);
    
    setTimeout(() => {
        liveAlert.style.transition = 'all 0.3s ease';
        liveAlert.style.opacity = '0';
        liveAlert.style.transform = 'translateY(20px)';
        setTimeout(() => liveAlert.remove(), 300);
    }, 8000);
}

let lastOrderCount = null;
async function monitorNewOrders() {
    try {
        const allOrders = await DB.getOrders();
        const data = { count: allOrders.length, newestOrder: allOrders[0] || null };
        
        if (lastOrderCount === null) {
            lastOrderCount = data.count;
        } else if (data.count > lastOrderCount) {
            lastOrderCount = data.count;
            showOrderNotification(data.newestOrder);
        }
    } catch(e) {
        console.error("Error monitoring orders:", e);
    }
}

// ===== Sound Configuration Management Helpers =====
function initSoundSettingsUI() {
    const soundType = localStorage.getItem('orderSoundType') || 'cashier';
    const volume = localStorage.getItem('orderSoundVolume') || '80';
    
    const soundSelect = document.getElementById('notifSoundSelect');
    const volumeSlider = document.getElementById('notifVolumeSlider');
    const volumeValSpan = document.getElementById('volumeVal');
    
    if (soundSelect) {
        soundSelect.value = soundType;
        handleSoundSelectionChange();
    }
    
    const distSelect = document.getElementById('distributorSoundSelect');
    if (distSelect) distSelect.value = localStorage.getItem('distributorSoundType') || 'bell';
    
    if (volumeSlider) {
        volumeSlider.value = volume;
    }
    
    if (volumeValSpan) {
        volumeValSpan.innerText = volume + '%';
    }
}

function handleSoundSelectionChange() {
    const select = document.getElementById('notifSoundSelect');
    if (!select) return;
    
    const val = select.value;
    localStorage.setItem('orderSoundType', val);
    
    const uploadGroup = document.getElementById('customSoundUploadGroup');
    if (uploadGroup) {
        uploadGroup.style.display = (val === 'custom') ? 'block' : 'none';
    }
    
    if (val !== 'custom') {
        const successMsg = document.getElementById('customSoundSuccessMsg');
        if (successMsg) successMsg.style.display = 'none';
    }
}

function updateVolumeLabel(val) {
    const volumeValSpan = document.getElementById('volumeVal');
    if (volumeValSpan) volumeValSpan.innerText = val + '%';
    localStorage.setItem('orderSoundVolume', val);
}

function uploadCustomSound(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 1.5MB to be safe for localStorage)
    if (file.size > 1.5 * 1024 * 1024) {
        showToast('⚠️ حجم الملف كبير جداً! اختر ملفاً أصغر من 1.5 ميجابايت.');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            localStorage.setItem('customOrderSound', e.target.result);
            document.getElementById('customSoundSuccessMsg').style.display = 'block';
            showToast('✅ تم حفظ صوتك المخصّص بنجاح!');
        } catch(err) {
            showToast('❌ ذاكرة المتصفح ممتلئة. يرجى اختيار ملف أصغر.');
        }
    };
    reader.readAsDataURL(file);
}

function playSelectedTestSound() {
    initDashboardAudio();
    playCashRegisterSound();
}

function handleDistributorSoundChange() {
    const select = document.getElementById('distributorSoundSelect');
    if (!select) return;
    localStorage.setItem('distributorSoundType', select.value);
}

function playDistributorTestSound() {
    initDashboardAudio();
    playDistributorSound();
}

function sendTestNotification() {
    if (!("Notification" in window)) {
        showToast("❌ متصفحك لا يدعم الإشعارات!");
        return;
    }
    
    if (Notification.permission !== "granted") {
        showToast("⚠️ الرجاء تفعيل الإذن أولاً من الصندوق أو إعدادات المتصفح!");
        return;
    }
    
    showToast("🧪 تم إرسال إشعار تجريبي... تحقق من جهازك!");
    
    // Play sound
    playSelectedTestSound();
    
    // Send native notification using SW or fallback
    showNativeNotification('💰 تجربة إشعارات المتجر', {
        body: 'إذا رأيت هذا الإشعار وسمعت الصوت، فهذا يعني أن نظامك جاهز ومفعّل بالكامل! 🔔✨',
        icon: '/favicon.ico',
        silent: false
    });
}

// Instantly check for new orders when the PWA/tab becomes active
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        monitorNewOrders();
    }
});

// Request permission on dashboard click and initialize polling
document.addEventListener('click', () => {
    requestNotificationPermission();
    initDashboardAudio();
    setTimeout(updateNotificationStatusUI, 100);
}, { once: true });

function requestPermissionManually() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            updateNotificationStatusUI();
            if (permission === 'granted') {
                showToast('✅ تم تفعيل الإشعارات بنجاح!');
                new Notification('💰 متجر مجوهرات UL', {
                    body: 'مبروك! تم تفعيل إشعارات طلبات المتجر بنجاح 🔔',
                    icon: '/favicon.ico'
                });
            }
        });
    }
}

function updateNotificationStatusUI() {
    const statusIcon = document.getElementById('notifStatusIcon');
    const statusText = document.getElementById('notifStatusText');
    const grantBtn = document.getElementById('grantNotifBtn');
    
    if (!statusIcon || !statusText || !grantBtn) return;
    
    if (!("Notification" in window)) {
        statusIcon.className = "fas fa-ban";
        statusIcon.style.color = "#ef4444";
        statusText.innerText = "متصفحك الحالي لا يدعم إشعارات النظام ❌";
        grantBtn.style.display = "none";
        return;
    }
    
    if (Notification.permission === "granted") {
        statusIcon.className = "fas fa-bell";
        statusIcon.style.color = "#10b981";
        statusText.innerHTML = "<span style='color:#10b981;'>مسموحة ومفعّلة بنجاح ✅ (ستصلك نغمة كاشير وتنبيه مع كل طلب جديد)</span>";
        grantBtn.style.display = "none";
    } else if (Notification.permission === "denied") {
        statusIcon.className = "fas fa-bell-slash";
        statusIcon.style.color = "#ef4444";
        statusText.innerHTML = "<span style='color:#ef4444;'>محظورة أو موقوفة ❌ (يرجى الضغط على قفل الأمان بجانب عنوان الموقع وتفعيل الإشعارات)</span>";
        grantBtn.style.display = "none";
    } else {
        statusIcon.className = "fas fa-bell-slash";
        statusIcon.style.color = "#eab308";
        statusText.innerHTML = "<span style='color:#eab308;'>بانتظار منح الإذن ⏳ (اضغط على الزر لتفعيل تنبيهات الطلبات الجديدة)</span>";
        grantBtn.style.display = "block";
    }
}

// Load sound settings on page load
document.addEventListener('DOMContentLoaded', () => {
    initSoundSettingsUI();
    updateNotificationStatusUI();
    loadPromotions();
    
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then(() => {
            updateNotificationStatusUI();
        });
    }
});

// Run immediately as well in case script defer loading is completed
initSoundSettingsUI();
setTimeout(updateNotificationStatusUI, 100);

// Start monitoring every 10 seconds
setInterval(monitorNewOrders, 10000);
monitorNewOrders();

// Register Service Worker for PWA support (only on http/https)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.error('Service Worker registration failed:', err);
        });
    });
}

// --- Page Editor Enhancements (Shortcodes & Image) ---

// ============================================================
// ===  PAGES MANAGEMENT  ====================================
// ============================================================

async function loadPagesList() {
    const tbody = document.getElementById('pagesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الصفحات...</td></tr>';
    
    try {
        const pages = await DB.getPages();
        
        if(pages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">لا يوجد صفحات حالياً. اضغط على "إنشاء صفحة جديدة" للبدء.</td></tr>';
            return;
        }
        
        tbody.innerHTML = pages.map(p => `
            <tr>
                <td style="font-weight:800;">${p.title}</td>
                <td style="font-family:monospace; font-size:12px;">index.html?page=${p.slug}</td>
                <td><span class="badge" style="background:#f1f5f9; color:#475569;">${p.type || 'general'}</span></td>
                <td>
                    <span class="badge" style="background:${p.status === 'public' ? '#dcfce7' : '#fef2f2'}; color:${p.status === 'public' ? '#16a34a' : '#ef4444'};">
                        ${p.status === 'public' ? 'منشورة' : 'مسودة'}
                    </span>
                </td>
                <td style="font-size:12px; color:var(--text-muted);">${new Date(p.updatedAt).toLocaleDateString('ar-EG')}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-icon" onclick="openPageEditor('${p.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                        <a href="index.html?page=${p.slug}" target="_blank" class="btn-icon" title="معاينة" style="display:flex; align-items:center; justify-content:center; text-decoration:none;"><i class="fas fa-eye"></i></a>
                        <button class="btn-icon" onclick="deletePage('${p.id}')" title="حذف" style="color:#ef4444;"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#ef4444;">فشل تحميل الصفحات</td></tr>';
    }
}
window.loadPagesList = loadPagesList;

function openPageEditor(pageId = null) {
    switchTab('tab-page-editor', false);
    const titleEl = document.getElementById('pageEditorTitle');
    
    // Reset form
    document.getElementById('page_id').value = '';
    document.getElementById('page_title').value = '';
    document.getElementById('page_slug').value = '';
    document.getElementById('page_content').value = '';
    document.getElementById('page_type').value = 'custom';
    document.getElementById('page_status').value = 'public';
    document.getElementById('page_thumbnail').value = '';
    document.getElementById('page_image_preview').innerHTML = '<i class="fas fa-image" style="font-size:30px; color:#cbd5e1;"></i><span>اضغط لرفع صورة المقال</span>';
    
    if(pageId) {
        titleEl.innerText = 'تعديل الصفحة';
        DB.getPages()
            .then(pages => {
                const p = pages.find(pg => pg.id === pageId);
                if(p) {
                    document.getElementById('page_id').value = p.id;
                    document.getElementById('page_title').value = p.title;
                    document.getElementById('page_slug').value = p.slug;
                    document.getElementById('page_content').value = p.content;
                    document.getElementById('page_type').value = p.type || 'custom';
                    document.getElementById('page_status').value = p.status || 'public';
                    document.getElementById('page_thumbnail').value = p.thumbnail || '';
                    if(p.thumbnail) {
                        document.getElementById('page_image_preview').innerHTML = `<img src="${p.thumbnail}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
                    }
                }
            });
    } else {
        titleEl.innerText = 'إضافة صفحة جديدة';
    }
}
window.openPageEditor = openPageEditor;

function autoGeneratePageSlug(val) {
    const slugInput = document.getElementById('page_slug');
    if(!document.getElementById('page_id').value) { // Only auto-generate for new pages
        slugInput.value = val.trim()
            .toLowerCase()
            .replace(/[^\u0621-\u064A0-9a-z ]/g, '') // Keep Arabic, Numbers, English, Spaces
            .replace(/\s+/g, '-');
    }
}
window.autoGeneratePageSlug = autoGeneratePageSlug;

async function saveStorePage() {
    const id = document.getElementById('page_id').value;
    const data = {
        title: document.getElementById('page_title').value,
        slug: document.getElementById('page_slug').value,
        content: document.getElementById('page_content').value,
        type: document.getElementById('page_type').value,
        status: document.getElementById('page_status').value,
        thumbnail: document.getElementById('page_thumbnail').value
    };

    if(!data.title || !data.slug) return alert('يرجى إكمال الحقول المطلوبة (العنوان والاسم اللطيف)');

    try {
        const result = await DB.savePage({ ...data, id: id || undefined });
        if(result) {
            if(window.showToast) showToast('✅ تم حفظ الصفحة بنجاح');
            switchTab('tab-pages');
        } else {
            alert('فشل حفظ الصفحة');
        }
    } catch(e) { alert('خطأ في الاتصال'); }
}
window.saveStorePage = saveStorePage;

async function deletePage(id) {
    if(!confirm('هل أنت متأكد من حذف هذه الصفحة؟')) return;
    try {
        const result = await DB.deletePage(id);
        if(result) {
            loadPagesList();
        }
    } catch(e) { alert('خطأ في الحذف'); }
}
window.deletePage = deletePage;

function triggerPageImageUpload() {
    document.getElementById('page_image_file').click();
}
window.triggerPageImageUpload = triggerPageImageUpload;

async function handlePageImageUpload(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    const previewArea = document.getElementById('page_image_preview');
    previewArea.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64 = e.target.result;
        try {
            const formData = new FormData();
            formData.append('image', base64);
            const res = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if(data.data && data.data.url) {
                document.getElementById('page_thumbnail').value = data.data.url;
                previewArea.innerHTML = `<img src="${data.data.url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
            }
        } catch(err) { previewArea.innerHTML = 'فشل الرفع'; }
    };
    reader.readAsDataURL(file);
}
window.handlePageImageUpload = handlePageImageUpload;

async function openProductSelectorForPage() {
    try {
        const products = await DB.getProducts();
        
        const productsHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:15px; max-height:400px; overflow-y:auto; padding:10px; direction:rtl;">
                ${products.map(p => `
                    <div onclick="insertProductShortcode('${p.id}')" style="cursor:pointer; border:1px solid #f1f5f9; border-radius:15px; padding:10px; text-align:center; transition:0.2s; background:#fff;">
                        <img src="${p.image}" style="width:100%; height:90px; object-fit:cover; border-radius:10px; margin-bottom:8px;">
                        <div style="font-size:11px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                        <div style="font-size:10px; color:var(--primary); font-weight:900; margin-top:3px;">${p.price} ₪</div>
                    </div>
                `).join('')}
            </div>
            <style>
                .product-item-select:hover { border-color:var(--primary) !important; transform:translateY(-2px); box-shadow:0 5px 15px rgba(0,0,0,0.05); }
            </style>
        `;

        Swal.fire({
            title: 'اختر منتجاً لإدراجه',
            html: productsHTML,
            showConfirmButton: false,
            showCloseButton: true,
            width: '700px'
        });
    } catch(e) {
        Swal.fire('خطأ', 'فشل تحميل المنتجات', 'error');
    }
}
window.openProductSelectorForPage = openProductSelectorForPage;

window.insertProductShortcode = function(id) {
    const editor = document.getElementById('page_content');
    const shortcode = `[product id="${id}"]`;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    
    // Insert at cursor position
    editor.value = editor.value.substring(0, start) + shortcode + editor.value.substring(end);
    
    Swal.close();
    if(window.showToast) showToast('✅ تم إدراج المنتج بنجاح');
    editor.focus();
};

window.filterSwalProducts = function(query) {
    const items = document.querySelectorAll('.product-mini-item');
    query = query.toLowerCase();
    items.forEach(item => {
        const name = item.innerText.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
};

window.insertTag = function(tag) {
    const editor = document.getElementById('page_content');
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const selectedText = text.substring(start, end);
    const replacement = `<${tag}>${selectedText}</${tag}>`;
    editor.value = text.substring(0, start) + replacement + text.substring(end);
    editor.focus();
    editor.setSelectionRange(start + tag.length + 2, start + tag.length + 2 + selectedText.length);
};

// --- PAGE TEMPLATES LOGIC ---
let pageTemplates = [
    {
        id: 'about-us',
        name: 'من نحن (نبذة فاخرة)',
        icon: 'fa-info-circle',
        title: 'عن متجرنا',
        content: `<h2 style="color:var(--primary); text-align:center;">قصة التميز والإبداع</h2>
<p style="text-align:center;">بدأنا في عام 2015 برؤية واضحة: تقديم أرقى المجوهرات التي تحكي قصصاً من الجمال.</p>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin:30px 0;">
    <div style="background:#f8fafc; padding:20px; border-radius:15px;">
        <h3 style="margin-top:0;">رؤيتنا</h3>
        <p>أن نصبح العلامة التجارية الأولى عالمياً في تصميم المجوهرات الفريدة.</p>
    </div>
    <div style="background:#f8fafc; padding:20px; border-radius:15px;">
        <h3 style="margin-top:0;">أهدافنا</h3>
        <p>الابتكار المستمر في التصميم مع المحافظة على أعلى معايير الحرفية.</p>
    </div>
</div>
<h2>لماذا يختارنا العملاء؟</h2>
<ul>
    <li><b>الأصالة:</b> جميع قطعنا مضمونة ومختومة بأختام الجودة.</li>
    <li><b>الحصرية:</b> قطعنا تصمم خصيصاً لتناسب ذوقك الرفيع.</li>
    <li><b>الضمان العالمي:</b> نقدم كفالة حقيقية على كافة المنتجات.</li>
</ul>`
    },
    {
        id: 'faq-template',
        name: 'الأسئلة الشائعة (FAQ)',
        icon: 'fa-question-circle',
        title: 'الأسئلة الشائعة',
        content: `<h2>أهم الأسئلة والاستفسارات</h2>
<div style="margin-bottom:20px;">
    <p style="font-weight:900; color:var(--primary); margin-bottom:5px;">س: هل المجوهرات مصنوعة من ذهب حقيقي؟</p>
    <p>ج: نعم، نقوم باستخدام أجود أنواع الذهب عيار 18 و 21، بالإضافة لفضة عيار 925.</p>
</div>
<div style="margin-bottom:20px;">
    <p style="font-weight:900; color:var(--primary); margin-bottom:5px;">س: كم تستغرق مدة التوصيل؟</p>
    <p>ج: يستغرق التوصيل داخل المدن الكبرى عادة 2-3 أيام عمل، وباقي المناطق 5 أيام.</p>
</div>
<div style="margin-bottom:20px;">
    <p style="font-weight:900; color:var(--primary); margin-bottom:5px;">س: هل يمكنني استرجاع المنتج؟</p>
    <p>ج: نعم، وفقاً لسياسة الاستبدال والاسترجاع، يمكنك الإرجاع خلال 3 أيام من الاستلام.</p>
</div>`
    },
    {
        id: 'wholesale-guide',
        name: 'دليل تجار الجملة',
        icon: 'fa-handshake',
        title: 'برنامج الموزعين والتجار',
        content: `<h2>انضم لشبكة موزعينا</h2>
<p>نقدم فرصاً استثنائية للتجار الراغبين في توزيع ماركتنا المسجلة بأسعار تنافسية جداً.</p>
<div style="background:var(--primary-light); padding:25px; border-radius:20px; margin:25px 0;">
    <h3>مميزات برنامج الجملة:</h3>
    <ul>
        <li>خصومات حصرية تصل لـ 40%.</li>
        <li>دعم تسويقي وصور احترافية للمنتجات.</li>
        <li>أولوية في الحصول على التشكيلات الجديدة.</li>
    </ul>
</div>
<p>للتسجيل، يرجى الضغط على زر "بوابة الموزعين" في القائمة العلوية وتعبئة طلب الانضمام.</p>`
    },
    {
        id: 'privacy-policy',
        name: 'سياسة الخصوصية',
        icon: 'fa-shield-alt',
        title: 'سياسة الخصوصية والأمان',
        content: `<h2>إشعار الخصوصية</h2>
<p>نحن في <b>{{STORE_NAME}}</b> نولي اهتماماً كبيراً لحماية بياناتك الشخصية.</p>
<h3>المعلومات التي نجمعها:</h3>
<p>نقوم بجمع بيانات التواصل والعنوان فقط لاستكمال معالجة طلبك.</p>
<h3>كيف نحمي بياناتك؟</h3>
<p>نستخدم تقنيات تشفير SSL متقدمة لضمان أمان معلوماتك المالية والشخصية.</p>`
    },
    {
        id: 'landing-promo',
        name: 'صفحة عرض صيفي',
        icon: 'fa-sun',
        title: 'عروض الصيف الكبرى 2026',
        content: `<div style="text-align:center; padding:50px 20px; background:linear-gradient(135deg, #4f46e5, #818cf8); border-radius:30px; color:#fff; margin-bottom:40px;">
    <h1 style="font-size:42px; font-weight:900; margin-bottom:10px;">عروض الصيف بدأت!</h1>
    <p style="font-size:18px; opacity:0.9;">وفر حتى 50% على تشكيلة السلاسل الصيفية</p>
</div>
<h2 style="text-align:center;">منتج الأسبوع المختار</h2>
<p style="text-align:center;">[product id="إدراج_ID_المنتج_هنا"]</p>
<div style="text-align:center; margin-top:40px;">
    <p style="font-size:14px; color:#64748b;">العرض صالح حتى نهاية شهر أغسطس 2026</p>
</div>`
    },
    {
        id: 'terms-conditions',
        name: 'الشروط والأحكام',
        icon: 'fa-file-contract',
        title: 'الشروط والأحكام',
        content: `<h2>اتفاقية الاستخدام</h2>
<p>مرحباً بك في متجرنا. باستخدامك لهذا الموقع، أنت توافق على الشروط التالية:</p>
<h3>1. الملكية الفكرية</h3>
<p>جميع التصاميم والصور في هذا الموقع هي ملكية خاصة وحصرية لبراندنا.</p>
<h3>2. سياسة الشراء</h3>
<p>يتم تأكيد الطلب فقط بعد التواصل الهاتفي أو عبر الواتساب من قبل فريقنا.</p>
<h3>3. الأسعار</h3>
<p>جميع الأسعار تشمل ضريبة القيمة المضافة ما لم يذكر خلاف ذلك.</p>`
    },
    {
        id: 'warranty-policy',
        name: 'سياسة الضمان والأصالة',
        icon: 'fa-certificate',
        title: 'ضمان الجودة والأصالة',
        content: `<div style="border:2px solid gold; padding:20px; border-radius:20px; text-align:center;">
    <h2 style="color:#b8860b;">شهادة ضمان ووفاء</h2>
    <p>نضمن لعملائنا الكرام أن جميع مجوهراتنا المختومة هي ذهب حقيقي مطابق للمواصفات العالمية.</p>
</div>
<table style="width:100%; border-collapse:collapse; margin-top:20px;">
    <tr style="background:#f1f5f9;">
        <th style="padding:10px; border:1px solid #ddd;">نوع المنتج</th>
        <th style="padding:10px; border:1px solid #ddd;">مدة الضمان</th>
    </tr>
    <tr>
        <td style="padding:10px; border:1px solid #ddd;">الذهب عيار 18/21</td>
        <td style="padding:10px; border:1px solid #ddd;">مدى الحياة (على العيار)</td>
    </tr>
    <tr>
        <td style="padding:10px; border:1px solid #ddd;">أحجار الزركون</td>
        <td style="padding:10px; border:1px solid #ddd;">سنة واحدة</td>
    </tr>
</table>`
    },
    {
        id: 'brand-ambassador',
        name: 'برنامج سفراء العلامة',
        icon: 'fa-users-cog',
        title: 'كن سفيراً لمجوهراتنا',
        content: `<h2 style="text-align:center;">هل أنت من محبي الموضة والأناقة؟</h2>
<p>نبحث دائماً عن أشخاص مبدعين لتمثيل علامتنا التجارية على منصات التواصل الاجتماعي.</p>
<div style="background:#fff7ed; padding:20px; border-radius:15px; border-right:5px solid #f97316;">
    <h3>المميزات التي ستحصل عليها:</h3>
    <ul>
        <li>قطع مجوهرات مجانية شهرياً.</li>
        <li>كود خصم خاص لمتابعيك.</li>
        <li>عمولة على كل عملية بيع تتم عبر كودك.</li>
    </ul>
</div>
<p style="text-align:center; margin-top:20px;">تواصل معنا عبر الانستقرام لتقديم طلب الانضمام.</p>`
    },
    {
        id: 'maintenance-page',
        name: 'صفحة صيانة مؤقتة',
        icon: 'fa-tools',
        title: 'المتجر تحت الصيانة',
        content: `<div style="text-align:center; padding:100px 20px;">
    <i class="fas fa-tools" style="font-size:80px; color:var(--primary); margin-bottom:20px;"></i>
    <h1>نحن نعمل على تحسين تجربتكم</h1>
    <p>نعتذر عن الانقطاع المؤقت، متجرنا تحت الصيانة لبعض الوقت لإطلاق التشكيلة الجديدة.</p>
    <p><b>سنعود خلال:</b> 4 ساعات من الآن</p>
</div>`
    }
];

// Load Custom Templates from LocalStorage
function loadCustomTemplates() {
    const saved = localStorage.getItem('customPageTemplates');
    if(saved) {
        try {
            const parsed = JSON.parse(saved);
            // Remove any old ones and merge
            pageTemplates = pageTemplates.filter(t => !t.isCustom);
            pageTemplates.push(...parsed);
        } catch(e) {}
    }
}
loadCustomTemplates();

function saveCurrentAsTemplate() {
    const title = document.getElementById('page_title').value;
    const content = document.getElementById('page_content').value;
    
    if(!title || !content) return Swal.fire('تنبيه', 'يجب إدخال عنوان ومحتوى أولاً لحفظه كقالب', 'warning');

    Swal.fire({
        title: 'حفظ كقالب جديد',
        input: 'text',
        inputLabel: 'اسم القالب',
        inputValue: title,
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const newTemplate = {
                id: 'custom-' + Date.now(),
                name: result.value + ' (قالب محفوظ)',
                icon: 'fa-star',
                title: title,
                content: content,
                isCustom: true
            };
            
            const savedRaw = localStorage.getItem('customPageTemplates');
            let saved = savedRaw ? JSON.parse(savedRaw) : [];
            saved.push(newTemplate);
            localStorage.setItem('customPageTemplates', JSON.stringify(saved));
            
            loadCustomTemplates();
            Swal.fire('نجاح', 'تم حفظ القالب بنجاح في متصفحك', 'success');
        }
    });
}
window.saveCurrentAsTemplate = saveCurrentAsTemplate;

async function livePreviewPage() {
    const title = document.getElementById('page_title').value || 'عنوان المعاينة';
    const content = document.getElementById('page_content').value || '<p style="text-align:center; color:#94a3b8;">المحتوى فارغ...</p>';
    
    // Process shortcodes [product id="..."]
    let rendered = content;
    const productRegex = /\[product id="([^"]+)"\]/g;
    let match;
    const productIds = [];
    while ((match = productRegex.exec(content)) !== null) {
        productIds.push(match[1]);
    }

    // Show loading state
    Swal.fire({
        title: 'جاري تجهيز المعاينة...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    if(productIds.length > 0) {
        try {
            const products = await DB.getProducts();
            rendered = rendered.replace(productRegex, (m, id) => {
                const p = products.find(i => i.id === id);
                if(!p) return `<div style="padding:20px; background:#fef2f2; border:1px dashed #ef4444; border-radius:10px; text-align:center; font-size:12px; color:#ef4444;">المنتج (ID: ${id}) غير موجود</div>`;
                return `
                    <div style="max-width:250px; margin:20px auto; border:1px solid #e2e8f0; border-radius:15px; overflow:hidden; background:#fff; text-align:center;">
                        <img src="${p.image}" style="width:100%; height:150px; object-fit:cover;">
                        <div style="padding:15px;">
                            <div style="font-weight:800; font-size:14px; margin-bottom:5px;">${p.name}</div>
                            <div style="color:var(--primary); font-weight:900;">${p.price} ₪</div>
                        </div>
                    </div>
                `;
            });
        } catch(e) { console.error(e); }
    }

    const previewHTML = `
        <div style="text-align:right; direction:rtl; padding:10px;">
            <div style="background:#fff; border-radius:20px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05); min-height:400px; border:1px solid #f1f5f9;">
                <h1 style="font-weight:900; color:var(--dark); margin-bottom:20px; font-size:28px;">${title}</h1>
                <hr style="border:none; border-top:1px solid #f1f5f9; margin-bottom:25px;">
                <div style="line-height:1.8; color:#334155; font-size:15px;">${rendered}</div>
            </div>
        </div>
    `;

    Swal.fire({
        title: '<i class="fas fa-eye"></i> معاينة الصفحة الحية',
        html: previewHTML,
        width: '900px',
        showConfirmButton: false,
        showCloseButton: true,
        background: '#f8fafc',
        customClass: {
            container: 'preview-swal-container',
            popup: 'luxury-swal-popup'
        }
    });
}
window.livePreviewPage = livePreviewPage;

function openPageTemplatesModal() {
    const categories = {
        'أساسي': pageTemplates.filter(t => !t.isCustom && ['about-us', 'contact-us', 'faq-template'].includes(t.id)),
        'سياسات': pageTemplates.filter(t => !t.isCustom && ['privacy-policy', 'terms-conditions', 'warranty-policy'].includes(t.id)),
        'تسويق': pageTemplates.filter(t => !t.isCustom && ['landing-promo', 'brand-ambassador', 'maintenance-page'].includes(t.id)),
        'قوالبك': pageTemplates.filter(t => t.isCustom)
    };

    const templatesHTML = `
        <div style="direction:rtl; text-align:right;">
            <div style="display:flex; gap:10px; margin-bottom:20px; overflow-x:auto; padding-bottom:10px; border-bottom:1px solid #f1f5f9;">
                ${Object.keys(categories).map((cat, idx) => `
                    <button onclick="filterTemplateCat('${cat}')" class="cat-btn ${idx===0?'active':''}" id="btn-cat-${cat}" style="padding:8px 15px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; font-size:12px; font-weight:800; white-space:nowrap; transition:0.2s;">
                        ${cat} (${categories[cat].length})
                    </button>
                `).join('')}
            </div>

            <div id="templatesGridWrapper" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:15px; max-height:450px; overflow-y:auto; padding:5px;">
                <!-- Templates will be rendered here by filterTemplateCat -->
            </div>
        </div>
        <style>
            .cat-btn:hover { background:#f8fafc; border-color:var(--primary); color:var(--primary); }
            .cat-btn.active { background:var(--primary) !important; border-color:var(--primary) !important; color:#fff !important; box-shadow:0 4px 10px rgba(79, 70, 229, 0.2); }
            .template-premium-card { border:1px solid #f1f5f9; border-radius:20px; padding:20px; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background:#fff; position:relative; overflow:hidden; }
            .template-premium-card:hover { transform:translateY(-5px); border-color:var(--primary); box-shadow:0 15px 30px rgba(0,0,0,0.05); }
            .template-icon-box { width:50px; height:50px; border-radius:15px; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:15px; transition:0.3s; }
            .template-premium-card:hover .template-icon-box { background:var(--primary); color:#fff; transform:rotate(10deg); }
        </style>
    `;

    Swal.fire({
        title: '<span style="font-weight:900;">مجموعة القوالب الفاخرة</span>',
        html: templatesHTML,
        width: '900px',
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: () => {
            window.pageTemplatesCategories = categories;
            filterTemplateCat(Object.keys(categories)[0]);
        }
    });
}
window.openPageTemplatesModal = openPageTemplatesModal;

window.filterTemplateCat = function(cat) {
    // Update buttons
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-cat-' + cat).classList.add('active');

    const list = window.pageTemplatesCategories[cat];
    const wrapper = document.getElementById('templatesGridWrapper');
    
    if(!list || list.length === 0) {
        wrapper.innerHTML = '<div style="grid-column:1/-1; padding:50px; text-align:center; color:#94a3b8;"><i class="fas fa-folder-open" style="font-size:40px; display:block; margin-bottom:10px;"></i> لا توجد قوالب في هذا القسم حالياً</div>';
        return;
    }

    wrapper.innerHTML = list.map(t => `
        <div class="template-premium-card" style="position:relative;">
            <div class="template-icon-box">
                <i class="fas ${t.icon}"></i>
            </div>
            <h4 style="margin:0 0 8px; font-size:15px; font-weight:900; color:var(--dark);">${t.name}</h4>
            <p style="margin:0; font-size:11px; color:#64748b; line-height:1.4;">تصميم احترافي جاهز بلمسات تسويقية عالية الجودة.</p>
            
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button onclick="previewTemplateOnly('${t.id}')" style="flex:1; padding:8px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:5px; transition:0.2s;">
                    <i class="fas fa-eye"></i> معاينة
                </button>
                <button onclick="handleTemplateSelect('${t.id}')" style="flex:1.5; padding:8px; border-radius:10px; border:none; background:var(--primary); color:#fff; cursor:pointer; font-size:11px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:5px; transition:0.2s;">
                    <i class="fas fa-check-circle"></i> استخدام
                </button>
            </div>
        </div>
    `).join('');
};

window.previewTemplateOnly = function(id) {
    const template = pageTemplates.find(t => t.id === id);
    if(!template) return;

    const previewHTML = `
        <div style="text-align:right; direction:rtl; padding:10px;">
            <div style="background:#fff; border-radius:20px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05); min-height:400px; border:1px solid #f1f5f9;">
                <div style="background:var(--primary-light); color:var(--primary); display:inline-block; padding:4px 12px; border-radius:30px; font-size:10px; font-weight:900; margin-bottom:15px;">وضع المعاينة قبل التطبيق</div>
                <h1 style="font-weight:900; color:var(--dark); margin-bottom:20px; font-size:28px;">${template.title}</h1>
                <hr style="border:none; border-top:1px solid #f1f5f9; margin-bottom:25px;">
                <div style="line-height:1.8; color:#334155; font-size:15px;">${template.content.replace(/\[product id="[^"]+"\]/g, '<div style="padding:20px; background:#f8fafc; border:2px dashed #e2e8f0; border-radius:15px; text-align:center; color:#94a3b8; font-size:12px; margin:10px 0;">[ مكان عرض المنتج سيظهر هنا ]</div>')}</div>
            </div>
            <div style="margin-top:20px; text-align:center;">
                 <button onclick="Swal.close(); usePageTemplate('${template.id}');" style="padding:12px 40px; background:var(--primary); color:#fff; border:none; border-radius:12px; font-weight:900; cursor:pointer; box-shadow:0 10px 20px rgba(79, 70, 229, 0.2);">أعجبني، استخدم هذا القالب الآن</button>
            </div>
        </div>
    `;

    Swal.fire({
        html: previewHTML,
        width: '900px',
        showConfirmButton: false,
        showCloseButton: true,
        background: '#f8fafc'
    });
};

// Helper function to bridge Swal and logic
window.handleTemplateSelect = function(id) {
    Swal.close();
    usePageTemplate(id);
};

function closePageTemplatesModal() {
    document.getElementById('pageTemplatesModal').style.display = 'none';
}
window.closePageTemplatesModal = closePageTemplatesModal;

function usePageTemplate(id) {
    const template = pageTemplates.find(t => t.id === id);
    if(!template) return;

    Swal.fire({
        title: 'استبدال المحتوى؟',
        text: 'سيتم استبدال المحتوى والاسم الحاليين بمحتوى القالب المختار. هل أنت متأكد؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary)',
        confirmButtonText: 'نعم، استبدل',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('page_title').value = template.title;
            document.getElementById('page_content').value = template.content;
            
            // Auto generate slug
            autoGeneratePageSlug(template.title);

            if(window.showToast) showToast('✅ تم تطبيق القالب بنجاح');
        }
    });
}
window.usePageTemplate = usePageTemplate;

// ============================================================
// ===  SEASONAL PROMOTIONS MANAGEMENT  =======================
// ============================================================

const OCCASIONS_META = {
    valentines:   { name: 'عيد الحب',          emoji: '💖' },
    mothers:      { name: 'عيد الأم',           emoji: '🌹' },
    newyear:      { name: 'رأس السنة',          emoji: '🎆' },
    blackfriday:  { name: 'الجمعة البيضاء',    emoji: '🛍️' },
    eid:          { name: 'عيد الفطر',          emoji: '🌙' },
    eidAdha:      { name: 'عيد الأضحى',         emoji: '🐑' },
    ramadan:      { name: 'رمضان',              emoji: '🕌' },
    summer:       { name: 'عروض الصيف',         emoji: '☀️' },
    backtoschool: { name: 'العودة للمدارس',     emoji: '🎒' },
    custom:       { name: 'مناسبة مخصصة',      emoji: '✨' }
};

let selectedOccasionId = null;
let currentDiscountType = 'percentage';
let selectedPromoCategories = [];
let editingPromoId = null;
let allPromotions = [];

// --- UI Navigation ---
function showPromoEditor() {
    document.getElementById('promoListView').style.display = 'none';
    document.getElementById('promoEditorView').style.display = 'block';
    
    // Update URL
    const newUrl = new URL(window.location);
    if (editingPromoId) {
        newUrl.searchParams.set('promoAction', 'edit');
        newUrl.searchParams.set('promoId', editingPromoId);
    } else {
        newUrl.searchParams.set('promoAction', 'new');
        newUrl.searchParams.delete('promoId');
        resetPromoForm();
    }
    window.history.pushState({}, '', newUrl);
}

function hidePromoEditor() {
    document.getElementById('promoListView').style.display = 'block';
    document.getElementById('promoEditorView').style.display = 'none';
    editingPromoId = null;
    
    // Cleanup URL
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('promoAction');
    newUrl.searchParams.delete('promoId');
    window.history.pushState({}, '', newUrl);
    
    loadPromotions(); // Refresh list
}

// --- Select Occasion ---
function selectOccasion(card) {
    document.querySelectorAll('.oc-item').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedOccasionId = card.dataset.id;

    // Show/hide custom name field
    const customGroup = document.getElementById('customOccasionNameGroup');
    if (customGroup) customGroup.style.display = selectedOccasionId === 'custom' ? 'block' : 'none';

    updatePromoPreview();
}

// --- Discount Type Toggle ---
function setDiscountType(type) {
    currentDiscountType = type;
    document.querySelectorAll('.discount-type-btn').forEach(b => b.classList.remove('active'));

    const btnMap = { percentage: 'dtypePercent', fixed: 'dtypeFixed', freeship: 'dtypeFreeship' };
    const activeBtn = document.getElementById(btnMap[type]);
    if (activeBtn) activeBtn.classList.add('active');

    const valueArea = document.getElementById('discountValueArea');
    const label = document.getElementById('discountValueLabel');
    const suffix = document.getElementById('discountValueSuffix');

    if (type === 'freeship') {
        if (valueArea) valueArea.style.opacity = '0.4';
        const input = document.getElementById('promoDiscountValue');
        if (input) { input.disabled = true; input.placeholder = 'شحن مجاني - لا حاجة لقيمة'; }
        if (suffix) suffix.textContent = '🚚';
        if (label) label.textContent = 'الشحن مجاني تلقائياً';
    } else {
        if (valueArea) valueArea.style.opacity = '1';
        const input = document.getElementById('promoDiscountValue');
        if (input) { input.disabled = false; input.placeholder = type === 'percentage' ? 'مثال: 20' : 'مثال: 15'; }
        if (suffix) suffix.textContent = type === 'percentage' ? '%' : '₪';
        if (label) label.textContent = type === 'percentage' ? 'قيمة الخصم (%)' : 'مبلغ الخصم الثابت';
    }

    updatePromoPreview();
}

// --- Date duration helper ---
function updatePromoDuration() {
    const start = document.getElementById('promoStartDate')?.value;
    const end = document.getElementById('promoEndDate')?.value;
    const display = document.getElementById('promoDurationDisplay');
    const durationText = document.getElementById('promoDurationText');
    if (!start || !end || !display || !durationText) return;

    const diffMs = new Date(end) - new Date(start);
    if (diffMs <= 0) {
        display.style.display = 'none';
        return;
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let text = '';
    if (diffDays > 0) text += `${diffDays} يوم `;
    if (diffHours > 0) text += `و ${diffHours} ساعة`;
    if (!text) text = 'أقل من ساعة';

    durationText.textContent = text;
    display.style.display = 'block';

    updatePromoPreview();
}

// --- Toggle scope ---
let selectedPromoProducts = [];

function togglePromoScope(mode) {
    const allProdCheck = document.getElementById('promoAllProducts');
    const specificScopeCheck = document.getElementById('promoSpecificScope');
    const manualSettings = document.getElementById('manualScopeSettings');
    
    const scopeAllBtn = document.getElementById('scopeAllBtn');
    const scopeManualBtn = document.getElementById('scopeManualBtn');
    
    if (!manualSettings) return;

    if (mode === 'all') {
        if (allProdCheck) allProdCheck.checked = true;
        if (specificScopeCheck) specificScopeCheck.checked = false;
        
        if (scopeAllBtn) scopeAllBtn.classList.add('active');
        if (scopeManualBtn) scopeManualBtn.classList.remove('active');
        
        manualSettings.style.display = 'none';
        // When going to 'all', we might want to keep the arrays for if they click manual again, 
        // but for saving it should be empty if 'all' is true. 
        // The savePromotion function handles this.
    } else {
        if (allProdCheck) allProdCheck.checked = false;
        if (specificScopeCheck) specificScopeCheck.checked = true;

        if (scopeAllBtn) scopeAllBtn.classList.remove('active');
        if (scopeManualBtn) scopeManualBtn.classList.add('active');

        manualSettings.style.display = 'block';
        renderPromoCategoryChips();
    }
}

async function loadRawProducts() {
    const container = document.getElementById('promoProductsCheckboxes');
    if (!container) return;

    try {
        const products = await DB.getProducts();
        
        if (products.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:12px;">لا يوجد منتجات متاحة</div>';
            return;
        }

        container.innerHTML = products.map(p => `
            <label style="display:flex; align-items:center; gap:10px; padding:8px; background:white; border:1px solid #eee; border-radius:8px; cursor:pointer; transition:0.2s;" class="promo-product-item">
                <input type="checkbox" value="${p.id}" ${selectedPromoProducts.includes(p.id) ? 'checked' : ''} onchange="togglePromoProduct('${p.id}', this.checked)">
                <img src="${p.image}" style="width:30px; height:30px; object-fit:cover; border-radius:4px;">
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:12px;">${p.name}</div>
                    <div style="font-size:10px; color:var(--text-muted);">${p.price} ₪</div>
                </div>
            </label>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; color:red; font-size:11px;">فشل تحميل المنتجات</div>';
    }
}

function togglePromoProduct(id, isChecked) {
    if (isChecked) {
        if (!selectedPromoProducts.includes(id)) selectedPromoProducts.push(id);
    } else {
        selectedPromoProducts = selectedPromoProducts.filter(pid => pid !== id);
    }
    updateSelectedProductsUI();
}

function updateSelectedProductsUI() {
    const badge = document.getElementById('selectedProductsBadge');
    const summary = document.getElementById('promoSelectionSummary');
    
    if (selectedPromoProducts.length > 0) {
        if (badge) {
            badge.style.display = 'inline-block';
            badge.textContent = `${selectedPromoProducts.length} مختارة`;
        }
        if (summary) summary.textContent = `${selectedPromoProducts.length} منتجات مختارة حالياً`;
    } else {
        if (badge) badge.style.display = 'none';
        if (summary) summary.textContent = 'لم يتم اختيار أي منتج';
    }
}

function openPromoProductsModal() {
    const modal = document.getElementById('promoProductsModal');
    if (modal) modal.style.display = 'flex';
    loadRawProducts();
    updateSelectedProductsUI();
}

function closePromoProductsModal() {
    const modal = document.getElementById('promoProductsModal');
    if (modal) modal.style.display = 'none';
}


function filterPromoProducts() {
    const query = document.getElementById('promoProductSearch').value.toLowerCase();
    const items = document.querySelectorAll('.promo-product-item');
    items.forEach(item => {
        const name = item.innerText.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}


function renderPromoCategoryChips() {
    const container = document.getElementById('promoCategoriesChips');
    if (!container) return;

    if (!window.allCategories || window.allCategories.length === 0) {
        const allCats = typeof allCategories !== 'undefined' ? allCategories : [];
        if (allCats.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">لا يوجد تصنيفات متاحة</span>';
            return;
        }
    }

    const cats = typeof allCategories !== 'undefined' ? allCategories : [];
    container.innerHTML = cats.map(c => {
        const isSelected = selectedPromoCategories.includes(c.id);
        return `<span onclick="togglePromoCategory('${c.id}', this)"
            style="padding:8px 16px; border-radius:50px; font-size:13px; font-weight:700; cursor:pointer; transition:0.2s;
            background:${isSelected ? 'var(--primary)' : '#f1f5f9'};
            color:${isSelected ? 'white' : 'var(--text-muted)'};
            border: 1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};"
            data-id="${c.id}">
            ${c.name}
        </span>`;
    }).join('');
}

function togglePromoCategory(catId, el) {
    const idx = selectedPromoCategories.indexOf(catId);
    if (idx > -1) {
        selectedPromoCategories.splice(idx, 1);
        el.style.background = '#f1f5f9';
        el.style.color = 'var(--text-muted)';
        el.style.borderColor = 'var(--border)';
    } else {
        selectedPromoCategories.push(catId);
        el.style.background = 'var(--primary)';
        el.style.color = 'white';
        el.style.borderColor = 'var(--primary)';
    }
}

// --- Live Preview Update ---
function updatePromoPreview() {
    const meta = selectedOccasionId ? OCCASIONS_META[selectedOccasionId] : null;
    const customName = document.getElementById('customOccasionName')?.value;

    const emojiEl = document.getElementById('previewEmoji');
    const nameEl = document.getElementById('previewOccasionName');
    const dateEl = document.getElementById('previewDateRange');
    const discEl = document.getElementById('previewDiscount');
    const bannerEl = document.getElementById('previewBanner');

    if (emojiEl) emojiEl.textContent = meta ? meta.emoji : '🎉';
    if (nameEl) {
        if (meta) {
            nameEl.textContent = selectedOccasionId === 'custom' && customName ? customName : meta.name;
        } else {
            nameEl.textContent = 'اختر مناسبة أولاً';
        }
    }

    // Dates
    const start = document.getElementById('promoStartDate')?.value;
    const end = document.getElementById('promoEndDate')?.value;
    if (dateEl) {
        if (start && end) {
            const s = new Date(start).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
            const e = new Date(end).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
            dateEl.textContent = `📅 ${s} — ${e}`;
        } else {
            dateEl.textContent = '—';
        }
    }

    // Discount
    const val = document.getElementById('promoDiscountValue')?.value;
    if (discEl) {
        if (currentDiscountType === 'freeship') {
            discEl.textContent = '🚚 شحن مجاني';
        } else if (val) {
            discEl.textContent = currentDiscountType === 'percentage'
                ? `خصم ${val}% 🔥`
                : `خصم ${val}₪ 🔥`;
        } else {
            discEl.textContent = 'حدد قيمة الخصم';
        }
    }

    // Banner
    const bannerText = document.getElementById('promoBannerText')?.value;
    const showBanner = document.getElementById('promoShowBanner')?.checked !== false;
    const designArea = document.getElementById('promoBannerDesignArea');
    
    if (designArea) {
        designArea.style.display = showBanner ? 'block' : 'none';
        designArea.style.opacity = showBanner ? '1' : '0.5';
    }

    if (bannerEl) {
        if (!showBanner) {
            bannerEl.style.display = 'none';
        } else {
            bannerEl.style.display = 'block';
            bannerEl.textContent = bannerText || '';
            const bannerImage = document.getElementById('promoBannerImage')?.value;
            const bgColor = document.getElementById('promoBannerBgColor')?.value || '#ef4444';
            const textColor = document.getElementById('promoBannerTextColor')?.value || '#ffffff';
            const customCss = document.getElementById('promoBannerCustomCss')?.value || '';

            // Reset first to avoid conflicts
            bannerEl.style.cssText = '';

            if (bannerImage) {
                bannerEl.style.background = `url('${bannerImage}') center/cover no-repeat`;
            } else {
                bannerEl.style.background = bgColor;
            }
            bannerEl.style.color = textColor;
            bannerEl.style.padding = '5px 15px';
            bannerEl.style.borderRadius = '50px';
            bannerEl.style.marginTop = '10px';
            
            if (customCss) {
                bannerEl.style.cssText += ';' + customCss;
            }
        }
    }
}

// --- Banner Presets ---
function applyBannerPreset(type) {
    const bgColorInput = document.getElementById('promoBannerBgColor');
    const textColorInput = document.getElementById('promoBannerTextColor');
    const customCssInput = document.getElementById('promoBannerCustomCss');
    const imageInput = document.getElementById('promoBannerImage');

    if (imageInput) imageInput.value = ''; // clear image by default
    
    if (type === 'blackfriday') {
        bgColorInput.value = 'radial-gradient(circle, #242424 0%, #000000 100%)';
        textColorInput.value = '#ffffff';
        customCssInput.value = 'border-bottom: 3px solid #d4af37; box-shadow: 0 6px 20px rgba(0,0,0,0.5); text-shadow: 0 0 5px rgba(255,255,255,0.3); font-weight: 900; letter-spacing: 1px; padding: 12px;';
    } else if (type === 'fire') {
        bgColorInput.value = 'linear-gradient(90deg, #d81b60 0%, #ff4500 50%, #ff8c00 100%)';
        textColorInput.value = '#ffffff';
        customCssInput.value = 'box-shadow: 0 6px 20px rgba(255, 69, 0, 0.35); text-shadow: 1px 1px 3px rgba(0,0,0,0.4); font-weight: 800; border-bottom: 2px solid #ff4500; padding: 12px;';
    } else if (type === 'gold_ribbon' || type === 'gold') {
        bgColorInput.value = 'linear-gradient(135deg, #a3762b 0%, #e7c97a 30%, #fef3c7 50%, #e7c97a 70%, #a3762b 100%)';
        textColorInput.value = '#111111';
        customCssInput.value = 'border: 1px solid #a3762b; border-bottom: 3px solid #78521a; box-shadow: inset 0 0 10px rgba(163,118,43,0.3), 0 6px 20px rgba(0,0,0,0.25); font-weight: 900; text-shadow: 0 1px 1px rgba(255,255,255,0.6); padding: 12px;';
    } else if (type === 'rose_petals' || type === 'blossom') {
        bgColorInput.value = 'linear-gradient(90deg, #fbcfe8 0%, #f472b6 50%, #db2777 100%)';
        textColorInput.value = '#ffffff';
        customCssInput.value = 'border-bottom: 3px solid #be185d; box-shadow: 0 6px 20px rgba(219,39,119,0.3); font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 12px;';
    } else if (type === 'deep_emerald' || type === 'emerald') {
        bgColorInput.value = 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)';
        textColorInput.value = '#ecfdf5';
        customCssInput.value = 'border: 1px solid #059669; border-bottom: 4px solid #fbbf24; box-shadow: 0 8px 15px rgba(6,78,59,0.25); text-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: 900; padding: 12px;';
    } else if (type === 'cosmic_dark' || type === 'midnight') {
        bgColorInput.value = 'radial-gradient(circle at top right, #1e1b4b, #000000)';
        textColorInput.value = '#818cf8';
        customCssInput.value = 'border-bottom: 4px solid #4f46e5; text-shadow: 0 0 10px rgba(129,140,248,0.5); box-shadow: 0 8px 25px rgba(0,0,0,0.4); font-weight: 900; padding: 12px;';
    } else if (type === 'winter') {

        bgColorInput.value = 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 50%, #475569 100%)';
        textColorInput.value = '#0f172a';
        customCssInput.value = 'border: 1px solid #cbd5e1; border-bottom: 3px solid #64748b; box-shadow: inset 0 0 8px rgba(255,255,255,0.6), 0 6px 20px rgba(15,23,42,0.12); font-weight: 900; padding: 12px;';
    } else if (type === 'national') {
        bgColorInput.value = 'linear-gradient(90deg, #0f5132 0%, #198754 50%, #0f5132 100%)';
        textColorInput.value = '#ffffff';
        customCssInput.value = 'border: 1px solid #198754; border-bottom: 3px solid #ffc107; box-shadow: 0 6px 20px rgba(15,81,50,0.4); text-shadow: 0 1px 3px rgba(0,0,0,0.5); font-weight: 800; padding: 12px;';
    } else if (type === 'cyber') {
        bgColorInput.value = 'linear-gradient(90deg, #00d2ff 0%, #0066ff 100%)';
        textColorInput.value = '#ffffff';
        customCssInput.value = 'border-bottom: 3px solid #0056b3; box-shadow: 0 0 15px rgba(0,102,255,0.5); text-shadow: 0 0 5px #fff; font-weight: 800; padding: 12px;';
    } else if (type === 'organic') {
        bgColorInput.value = 'linear-gradient(135deg, #1e3a1e 0%, #4a5d4e 100%)';
        textColorInput.value = '#fef3c7';
        customCssInput.value = 'border-bottom: 2px solid #d97706; box-shadow: 0 6px 20px rgba(30,58,30,0.3); font-weight: 700; padding: 12px;';
    } else if (type === 'wedding') {
        if (imageInput) imageInput.value = 'https://images.unsplash.com/photo-1549417229-aa67d3263c09?q=80&w=1000';
        bgColorInput.value = '#ffffff';
        textColorInput.value = '#333333';
        customCssInput.value = 'border-bottom: 2px solid #d4af37; box-shadow: 0 4px 15px rgba(0,0,0,0.06); font-weight: 800; padding: 12px; text-shadow: 1px 1px 1px rgba(255,255,255,0.9); font-family: "Cinzel", serif;';
    } else if (type === 'marble') {
        if (imageInput) imageInput.value = 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=1000';
        bgColorInput.value = '#ffffff';
        textColorInput.value = '#1e293b';
        customCssInput.value = 'border: 1px solid #e2e8f0; border-bottom: 3px solid #0f172a; box-shadow: 0 4px 15px rgba(0,0,0,0.05); font-weight: 800; padding: 12px;';
    } else if (type === 'valentine') {
        if (imageInput) imageInput.value = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1000';
        bgColorInput.value = '#ffffff';
        textColorInput.value = '#881337';
        customCssInput.value = 'border-bottom: 2px solid #fda4af; box-shadow: 0 4px 15px rgba(225,29,72,0.15); font-weight: 800; padding: 12px; text-shadow: 1px 1px 2px rgba(255,255,255,0.8);';
    } else if (type === 'festive') {
        if (imageInput) imageInput.value = 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1000';
        bgColorInput.value = '#ffffff';
        textColorInput.value = '#0f172a';
        customCssInput.value = 'border-bottom: 2px solid #fde047; box-shadow: 0 4px 15px rgba(234,179,8,0.2); font-weight: 900; padding: 12px; text-shadow: 1px 1px 1px rgba(255,255,255,0.9);';
    } else if (type === 'silk') {
        bgColorInput.value = 'linear-gradient(135deg, #fff5f5 0%, #ffe4e6 50%, #fecdd3 100%)';
        textColorInput.value = '#881337';
        customCssInput.value = 'border-bottom: 4px solid #fb7185; box-shadow: 0 8px 15px rgba(225,29,72,0.1); text-shadow: 1px 1px 1px rgba(255,255,255,0.8); font-weight: 900; padding: 12px; font-family: "Cinzel", serif;';
    } else if (type === 'midnight') {
        bgColorInput.value = 'radial-gradient(circle, #2a2a2a 0%, #0a0a0a 100%)';
        textColorInput.value = '#ffffff';
        customCssInput.value = 'border: 1.5px solid #333; border-bottom: 4px solid #d4af37; box-shadow: 0 8px 15px rgba(0,0,0,0.4); text-shadow: 0 0 10px rgba(212,175,55,0.4); font-weight: 900; padding: 12px;';
    } else if (type === 'mist') {
        bgColorInput.value = 'linear-gradient(145deg, #f8fafc, #e2e8f0)';
        textColorInput.value = '#1e293b';
        customCssInput.value = 'border: 1px solid #cbd5e1; border-bottom: 4px solid #3b82f6; box-shadow: inset 0 0 20px rgba(255,255,255,0.8), 0 8px 15px rgba(0,0,0,0.05); font-weight: 900; padding: 12px;';
    } else if (type === 'eid_gold') {
        bgColorInput.value = 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #047857 100%)';
        textColorInput.value = '#ffffff';
        customCssInput.value = 'border: 1.5px dashed #fcd34d; border-bottom: 4px solid #fcd34d; box-shadow: 0 8px 15px rgba(2,44,34,0.3); text-shadow: 0 0 8px rgba(252,211,77,0.4); font-weight: 900; padding: 12px;';
    } else if (type === 'emerald') {
        bgColorInput.value = 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)';
        textColorInput.value = '#ecfdf5';
        customCssInput.value = 'border: 1px solid #059669; border-bottom: 4px solid #fbbf24; box-shadow: 0 8px 15px rgba(6,78,59,0.25); text-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: 900; padding: 12px;';
    } else if (type === 'zen') {
        bgColorInput.value = '#ffffff';
        textColorInput.value = '#111111';
        customCssInput.value = 'border: 1.5px solid #eee; border-left: 8px solid #111; box-shadow: 0 5px 15px rgba(0,0,0,0.03); font-weight: 800; padding: 12px;';
    } else if (type === 'velvet') {
        bgColorInput.value = 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)';
        textColorInput.value = '#f5f3ff';
        customCssInput.value = 'border: 1px solid #7c3aed; border-bottom: 4px solid #fde047; box-shadow: 0 8px 15px rgba(76,29,149,0.3); text-shadow: 0 2px 4px rgba(0,0,0,0.2); font-weight: 900; padding: 12px;';
    }
    updatePromoPreview();
}

let allBannerPresets = [];

async function openBannerPresetsModal() {
    const modal = document.getElementById('bannerPresetsModal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    const grid = document.getElementById('bannerPresetsGrid');
    if (!grid) return;

    try {
        allBannerPresets = await DB.getBannerPresets();
        // Fallback: if DB is empty, use built-in default presets
        if (!allBannerPresets || allBannerPresets.length === 0) {
            allBannerPresets = [
                { id: 'default-luxury', name: 'تصميم فاخر 🌟', category: 'luxury', bgColor: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', textColor: '#ffffff', customCss: 'border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 40px rgba(0,0,0,0.3);', isDefault: true },
                { id: 'default-gold', name: 'ذهبي فاخر 💎', category: 'luxury', bgColor: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%)', textColor: '#ffffff', customCss: 'border:1px solid rgba(255,255,255,0.2);box-shadow:0 20px 40px rgba(0,0,0,0.2);', isDefault: true },
                { id: 'default-minimal-light', name: 'مودرن فاتح ✨', category: 'minimal', bgColor: '#ffffff', textColor: '#0f172a', customCss: 'border:2px solid #e2e8f0;box-shadow:0 10px 30px rgba(0,0,0,0.05);', isDefault: true },
                { id: 'default-minimal-dark', name: 'مودرن داكن ✨', category: 'minimal', bgColor: '#1e293b', textColor: '#f8fafc', customCss: 'border:2px solid #334155;box-shadow:0 10px 30px rgba(0,0,0,0.2);', isDefault: true },
                { id: 'default-eid', name: 'عيد مبارك 🎉', category: 'special', bgColor: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)', textColor: '#ffffff', customCss: 'border:2px solid #34d399;box-shadow:0 15px 35px rgba(16,185,129,0.2);', isDefault: true },
                { id: 'default-romantic', name: 'رومانسي 💝', category: 'special', bgColor: 'linear-gradient(135deg, #9d174d 0%, #db2777 50%, #f472b6 100%)', textColor: '#ffffff', customCss: 'border:2px solid #f9a8d4;box-shadow:0 15px 35px rgba(219,39,119,0.2);', isDefault: true },
                { id: 'default-summer', name: 'عروض الصيف ☀️', category: 'special', bgColor: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 50%, #7dd3fc 100%)', textColor: '#ffffff', customCss: 'border:2px solid #bae6fd;box-shadow:0 15px 35px rgba(14,165,233,0.2);', isDefault: true },
                { id: 'default-sale', name: 'تخفيضات 🔥', category: 'special', bgColor: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #fca5a5 100%)', textColor: '#ffffff', customCss: 'border:2px solid #fecaca;box-shadow:0 15px 35px rgba(220,38,38,0.2);', isDefault: true },
            ];
        }
        renderBannerPresets(allBannerPresets);
    } catch (e) {
        grid.innerHTML = '<div style="text-align:center; color:red; padding:20px;">فشل تحميل القوالب</div>';
    }
}

function renderBannerPresets(presets) {
    const grid = document.getElementById('bannerPresetsGrid');
    if (!grid) return;

    if (presets.length === 0) {
        grid.innerHTML = '<div style="text-align:center; padding:50px; color:#94a3b8; grid-column:1/-1;">لا يوجد قوالب متوفرة حالياً</div>';
        return;
    }

    grid.innerHTML = presets.map(p => `
        <div class="preset-item ${p.category}" onclick="applyBannerPresetModal('${p.id}')" style="background: white; border: 2px solid #f1f5f9; border-radius: 20px; padding: 20px; cursor: pointer; transition: 0.3s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='translateY(-5px)';" onmouseout="this.style.borderColor='#f1f5f9'; this.style.transform='none';">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-weight: 800; color: var(--text-main); font-size: 14px;">${p.isDefault ? '🌟' : '👤'} ${p.name}</span>
                <span style="${p.isDefault ? 'background: #fef3c7; color: #b45309;' : 'background: #dcfce7; color: #15803d;'} padding: 4px 10px; border-radius: 50px; font-size: 10px; font-weight: 800;">${p.isDefault ? 'PREMIUM' : 'MY PRESET'}</span>
            </div>
            <div style="background: ${p.bgColor}; color: ${p.textColor}; padding: 20px; border-radius: 15px; text-align: center; font-weight: 900; font-size: 16px; ${p.customCss}">
                ✨ معاينة نص البانر الترويجي
            </div>
        </div>
    `).join('');
}

function applyBannerPresetModal(id) {
    const preset = allBannerPresets.find(p => p.id === id);
    if (!preset) return;

    const bgColorInput = document.getElementById('promoBannerBgColor');
    const textColorInput = document.getElementById('promoBannerTextColor');
    const customCssInput = document.getElementById('promoBannerCustomCss');
    const imageInput = document.getElementById('promoBannerImage');

    if (bgColorInput) bgColorInput.value = preset.bgColor;
    if (textColorInput) textColorInput.value = preset.textColor;
    if (customCssInput) customCssInput.value = preset.customCss;
    if (imageInput) imageInput.value = ''; // Reset image when applying style

    const modal = document.getElementById('bannerPresetsModal');
    if (modal) modal.style.display = 'none';
    
    updatePromoPreview();
    showToast('✨ تم تطبيق قالب التصميم الجاهز بنجاح!', 'success');
}

async function saveCurrentAsPreset() {
    const name = prompt('أدخل اسماً للقالب الخاص بك:');
    if (!name) return;

    const bgColor = document.getElementById('promoBannerBgColor')?.value;
    const textColor = document.getElementById('promoBannerTextColor')?.value;
    const customCss = document.getElementById('promoBannerCustomCss')?.value;

    if (!bgColor) {
        showToast('يجب وجود لون خلفية على الأقل لحفظ القالب', 'error');
        return;
    }

    try {
        const data = await DB.saveBannerPreset({ name, bgColor, textColor, customCss });
        if (data) {
            showToast('✅ تم حفظ القالب بنجاح!', 'success');
        } else {
            showToast('❌ فشل حفظ القالب', 'error');
        }
    } catch (e) {
        showToast('❌ خطأ في الاتصال بالخادم', 'error');
    }
}

function filterPresets(category, btn) {
    // Update active tab UI
    document.querySelectorAll('.preset-tab').forEach(t => {
        t.style.background = 'white';
        t.style.color = 'var(--text-main)';
        t.style.boxShadow = 'var(--shadow-sm)';
    });
    btn.style.background = 'var(--primary)';
    btn.style.color = 'white';
    btn.style.boxShadow = 'none';

    // Filter items
    const items = document.querySelectorAll('.preset-item');
    items.forEach(item => {
        if (category === 'all' || item.classList.contains(category) || (category === 'special' && item.classList.contains('my-presets'))) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}



// Attach live input listeners
document.addEventListener('DOMContentLoaded', () => {
    const liveInputs = ['promoDiscountValue', 'promoBannerText', 'customOccasionName', 'promoBannerBgColor', 'promoBannerTextColor', 'promoBannerImage', 'promoBannerCustomCss'];
    liveInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePromoPreview);
    });

    // Load promotions when tab opened
    document.querySelectorAll('.tab-link[data-target="tab-promotions"]').forEach(link => {
        link.addEventListener('click', () => setTimeout(loadPromotions, 300));
    });

    // Initialize date fields with sensible defaults (today → +7 days)
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const toLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const startEl = document.getElementById('promoStartDate');
    const endEl = document.getElementById('promoEndDate');
    if (startEl && !startEl.value) startEl.value = toLocal(now);
    if (endEl && !endEl.value) endEl.value = toLocal(nextWeek);
    updatePromoDuration();
});

// --- Save Promotion ---
function resetPromoForm() {
    editingPromoId = null;
    selectedOccasionId = null;
    selectedPromoCategories = [];
    selectedPromoProducts = [];
    
    // Reset occasion cards UI
    document.querySelectorAll('.oc-item').forEach(c => c.classList.remove('selected'));
    const customGroup = document.getElementById('customOccasionNameGroup');
    if (customGroup) customGroup.style.display = 'none';

    // Reset buttons UI
    const scopeAllBtn = document.getElementById('scopeAllBtn');
    const scopeManualBtn = document.getElementById('scopeManualBtn');
    if (scopeAllBtn) scopeAllBtn.classList.add('active');
    if (scopeManualBtn) scopeManualBtn.classList.remove('active');
    
    const manualSettings = document.getElementById('manualScopeSettings');
    if (manualSettings) manualSettings.style.display = 'none';

    updateSelectedProductsUI();
    renderPromoCategoryChips();
    selectedPromoCategories = [];
    currentDiscountType = 'percentage';
    
    // Clear selections
    document.querySelectorAll('.occasion-card').forEach(c => c.classList.remove('selected'));
    
    // Reset inputs
    const ids = [
        'promoDiscountValue', 'promoMinOrder', 'promoBannerText', 
        'promoBannerBgColor', 'promoBannerTextColor', 'promoBannerImage', 
        'promoBannerCustomCss', 'promoStartDate', 'promoEndDate', 'customOccasionName'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'color') el.value = '#ffffff';
            else if (id === 'promoBannerBgColor') el.value = '#ef4444';
            else el.value = '';
        }
    });

    // Reset switches
    const showBanner = document.getElementById('promoShowBanner');
    if (showBanner) showBanner.checked = true;
    
    const allProds = document.getElementById('promoAllProducts');
    if (allProds) {
        allProds.checked = true;
        togglePromoScope();
    }

    // Reset UI
    setDiscountType('percentage');
    updatePromoPreview();
    
    const saveBtn = document.getElementById('savePromoBtn');
    const cancelBtn = document.getElementById('cancelPromoEditBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-rocket"></i> إطلاق العرض الموسمي';
        saveBtn.style.background = '';
    }
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function cancelPromoEdit() {
    hidePromoEditor();
    showToast('↩️ تم إلغاء التعديل');
}

async function editPromotion(id) {
    const promo = allPromotions.find(p => p.id === id);
    if (!promo) return;

    editingPromoId = id;
    showPromoEditor();
    
    // 1. Select occasion
    selectedOccasionId = promo.occasionId;
    document.querySelectorAll('.oc-item').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === selectedOccasionId);
    });
    
    const customGroup = document.getElementById('customOccasionNameGroup');
    if (customGroup) {
        customGroup.style.display = selectedOccasionId === 'custom' ? 'block' : 'none';
        if (selectedOccasionId === 'custom') {
            document.getElementById('customOccasionName').value = promo.occasionName;
        }
    }

    // 2. Dates — convert ISO to datetime-local format (YYYY-MM-DDThh:mm)
    const fmtDate = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    document.getElementById('promoStartDate').value = fmtDate(promo.startDate);
    document.getElementById('promoEndDate').value = fmtDate(promo.endDate);

    // 3. Discount
    setDiscountType(promo.discountType);
    document.getElementById('promoDiscountValue').value = promo.discountValue;
    document.getElementById('promoMinOrder').value = promo.minOrder;

    // 4. Banner
    document.getElementById('promoShowBanner').checked = promo.showBanner !== false;
    document.getElementById('promoBannerText').value = promo.bannerText || '';
    document.getElementById('promoBannerBgColor').value = promo.bannerBgColor || '#ef4444';
    document.getElementById('promoBannerTextColor').value = promo.bannerTextColor || '#ffffff';
    document.getElementById('promoBannerImage').value = promo.bannerImage || '';
    document.getElementById('promoBannerCustomCss').value = promo.bannerCustomCss || '';

    // 5. Scope
    const allProds = document.getElementById('promoAllProducts');
    const specificScope = document.getElementById('promoSpecificScope');
    if (allProds && specificScope) {
        const isAll = promo.allProducts !== false;
        allProds.checked = isAll;
        specificScope.checked = !isAll;
        selectedPromoCategories = promo.categories || [];
        selectedPromoProducts = promo.productIds || [];
        togglePromoScope(isAll ? 'all' : 'manual');
    }

    updatePromoPreview();
    
    // Update button UI
    const saveBtn = document.getElementById('savePromoBtn');
    const cancelBtn = document.getElementById('cancelPromoEditBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> تحديث بيانات العرض';
        saveBtn.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    }
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    // Scroll to form
    const formPanel = document.querySelector('.promo-config-card');
    if (formPanel) {
        formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function savePromotion() {
    if (!selectedOccasionId) {
        showToast('⚠️ يرجى اختيار المناسبة أولاً', 'error');
        return;
    }

    let startDate = document.getElementById('promoStartDate')?.value;
    let endDate = document.getElementById('promoEndDate')?.value;

    if (!startDate || !endDate) {
        showToast('⚠️ يرجى تحديد تاريخ البداية والانتهاء', 'error');
        return;
    }
    // Add local timezone offset so Supabase stores the correct local time
    const tzOffset = -new Date().getTimezoneOffset();
    const tzSign = tzOffset >= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
    const tzSuffix = tzSign + tzHours + ':' + tzMins;
    startDate = startDate + ':00' + tzSuffix;
    endDate = endDate + ':00' + tzSuffix;

    if (new Date(endDate) <= new Date(startDate)) {
        showToast('⚠️ تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية', 'error');
        return;
    }

    if (currentDiscountType !== 'freeship') {
        const val = parseFloat(document.getElementById('promoDiscountValue')?.value);
        if (!val || val <= 0) {
            showToast('⚠️ يرجى إدخال قيمة خصم صحيحة', 'error');
            return;
        }
    }

    const meta = OCCASIONS_META[selectedOccasionId];
    const customName = document.getElementById('customOccasionName')?.value;
    const occasionName = selectedOccasionId === 'custom' && customName ? customName : meta.name;

    const payload = {
        id: editingPromoId || undefined,
        occasionId: selectedOccasionId,
        occasionName,
        occasionEmoji: meta.emoji,
        startDate,
        endDate,
        discountType: currentDiscountType,
        discountValue: parseFloat(document.getElementById('promoDiscountValue')?.value) || 0,
        minOrder: parseFloat(document.getElementById('promoMinOrder')?.value) || 0,
        showBanner: document.getElementById('promoShowBanner')?.checked !== false,
        bannerText: document.getElementById('promoBannerText')?.value || '',
        bannerBgColor: document.getElementById('promoBannerBgColor')?.value || '#ef4444',
        bannerTextColor: document.getElementById('promoBannerTextColor')?.value || '#ffffff',
        bannerImage: document.getElementById('promoBannerImage')?.value || '',
        bannerCustomCss: document.getElementById('promoBannerCustomCss')?.value || '',
        allProducts: document.getElementById('promoAllProducts')?.checked !== false,
        categories: selectedPromoCategories,
        productIds: selectedPromoProducts
    };


    console.log('Sending Promotion Payload:', payload);

    const btn = document.getElementById('savePromoBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'; }

    try {
        const data = await DB.savePromotion(payload);

        if (data) {
            showToast(`✅ تم ${editingPromoId ? 'تحديث' : 'إطلاق'} عرض "${occasionName}" بنجاح! 🎉`);
            hidePromoEditor();
        } else {
            showToast('❌ فشل حفظ العرض', 'error');
        }
    } catch (e) {
        showToast('❌ حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> إطلاق العرض الموسمي'; }
    }
}

// --- Load Promotions Table ---
async function loadPromotions() {
    try {
        const promos = await DB.getPromotions();
        allPromotions = promos;
        const tbody = document.getElementById('promotionsTableBody');
        if (!tbody) return;

        const now = new Date();
        let activeCount = 0;
        let scheduledCount = 0;

        if (promos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#9ca3af;">
                <i class="fas fa-gift" style="font-size:32px; display:block; margin-bottom:10px; opacity:0.3;"></i>
                لا توجد عروض بعد. أنشئ عرضك الأول!
            </td></tr>`;
            return;
        }

        tbody.innerHTML = promos.map(p => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            const isActive = now >= start && now <= end;
            const isScheduled = now < start;
            const isExpired = now > end;

            if (isActive) activeCount++;
            if (isScheduled) scheduledCount++;

            const statusBadge = isActive
                ? `<span class="promo-status-badge promo-status-active">✅ نشط</span>`
                : isScheduled
                ? `<span class="promo-status-badge promo-status-scheduled">⏰ مجدول</span>`
                : `<span class="promo-status-badge promo-status-expired">⌛ منتهي</span>`;

            const discountLabel = p.discountType === 'freeship'
                ? '🚚 شحن مجاني'
                : p.discountType === 'percentage'
                ? `${p.discountValue}% خصم`
                : `خصم ${p.discountValue}₪`;

            const formatDate = d => new Date(d).toLocaleDateString('ar-SA', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Countdown for active/scheduled
            let countdownHtml = '';
            if (isActive) {
                const msLeft = end - now;
                const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
                const hrsLeft = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                countdownHtml = `<br><span class="promo-countdown">⏱ ${daysLeft > 0 ? daysLeft + ' يوم ' : ''}${hrsLeft} ساعة متبقية</span>`;
            } else if (isScheduled) {
                const msToStart = start - now;
                const daysToStart = Math.floor(msToStart / (1000 * 60 * 60 * 24));
                const hrsToStart = Math.floor((msToStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                if (daysToStart > 0) {
                    countdownHtml = `<br><span class="promo-countdown" style="background:#dbeafe; color:#1d4ed8;">🕐 يبدأ خلال ${daysToStart} يوم و ${hrsToStart} ساعة</span>`;
                } else if (hrsToStart > 0) {
                    countdownHtml = `<br><span class="promo-countdown" style="background:#dbeafe; color:#1d4ed8;">🕐 يبدأ خلال ${hrsToStart} ساعة</span>`;
                } else {
                    countdownHtml = `<br><span class="promo-countdown" style="background:#dbeafe; color:#1d4ed8;">🕐 يبدأ خلال أقل من ساعة</span>`;
                }
            }

            return `<tr>
                <td>
                    <span style="font-size:22px;">${p.occasionEmoji || '🎉'}</span>
                    <strong style="font-size:13px; margin-right:6px;">${p.occasionName}</strong>
                </td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; color:var(--text-muted);">
                    ${p.bannerText || '—'}
                </td>
                <td><strong style="color:var(--primary);">${discountLabel}</strong>${p.minOrder > 0 ? `<br><span style="font-size:11px; color:var(--text-muted);">حد أدنى: ${p.minOrder}₪</span>` : ''}</td>
                <td style="font-size:12px;">${formatDate(p.startDate)}</td>
                <td style="font-size:12px;">${formatDate(p.endDate)}${countdownHtml}</td>
                <td>${statusBadge}</td>
                <td style="white-space:nowrap;">
                    <button class="btn" style="padding:5px 10px; font-size:12px; background:#eff6ff; color:#3b82f6; border:1px solid #dbeafe; margin-left:5px;"
                        onclick="editPromotion('${p.id}')">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn" style="padding:5px 10px; font-size:12px; background:#fff1f2; color:#be123c; border:1px solid #ffe4e6;"
                        onclick="deletePromotion('${p.id}', '${p.occasionName}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>`;
        }).join('');

        // Update stats
        const activeCountEl = document.getElementById('activePromoCount');
        const scheduledCountEl = document.getElementById('scheduledPromoCount');
        if (activeCountEl) activeCountEl.textContent = activeCount;
        if (scheduledCountEl) scheduledCountEl.textContent = scheduledCount;

        handlePromoDeepLinking();

    } catch (e) {
        console.error('Promotions Load Error:', e);
    }
}

// --- Delete Promotion ---
async function deletePromotion(id, name) {
    if (!confirm(`هل أنت متأكد من حذف عرض "${name}"؟`)) return;
    try {
        const data = await DB.deletePromotion(id);
        if (data) {
            showToast(`🗑️ تم حذف عرض "${name}" بنجاح`);
            loadPromotions();
        } else {
            showToast('❌ فشل حذف العرض', 'error');
        }
    } catch (e) {
        showToast('❌ حدث خطأ أثناء الحذف', 'error');
    }
}

// Make functions globally accessible
window.selectOccasion = selectOccasion;
window.setDiscountType = setDiscountType;
window.updatePromoDuration = updatePromoDuration;
window.openPromoProductsModal = openPromoProductsModal;
window.closePromoProductsModal = closePromoProductsModal;
window.togglePromoScope = togglePromoScope;

window.togglePromoCategory = togglePromoCategory;
window.togglePromoProduct = togglePromoProduct;
window.filterPromoProducts = filterPromoProducts;
window.openBannerPresetsModal = openBannerPresetsModal;
window.saveCurrentAsPreset = saveCurrentAsPreset;
window.filterPresets = filterPresets;
window.applyBannerPresetModal = applyBannerPresetModal;
window.savePromotion = savePromotion;

window.loadPromotions = loadPromotions;
window.deletePromotion = deletePromotion;
window.updatePromoPreview = updatePromoPreview;


function handlePromoDeepLinking() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('promoAction');
    const id = params.get('promoId');

    // Only process if we haven't already (simple flag to prevent loops)
    if (window.promoDeepLinkProcessed) return;

    if (action === 'new') {
        window.promoDeepLinkProcessed = true;
        showPromoEditor();
    } else if (action === 'edit' && id) {
        window.promoDeepLinkProcessed = true;
        editPromotion(id);
    }
}

// ─── Reels (الريلز) Management ──────────────────────────────────────────
async function loadReels() {
    try {
        const reels = await DB.getReels();
        const tbody = document.getElementById('reels-table-body');
        if (!tbody) return;

        if (reels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:50px; color:#94a3b8;">لا توجد فيديوهات ريلز حالياً. ابدأ بإضافة أول فيديو!</td></tr>';
            return;
        }

        tbody.innerHTML = reels.map(reel => {
            const product = allProducts.find(p => String(p.id) === String(reel.productId));
            return `
                <tr>
                    <td>
                        <div style="position:relative; width:60px; height:80px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; background:#000;">
                            <video src="${reel.videoUrl}" style="width:100%; height:100%; object-fit:cover;"></video>
                            <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); color:#fff; font-size:10px;">
                                <i class="fas fa-play"></i>
                            </div>
                        </div>
                    </td>
                    <td style="font-weight:700;">${reel.title || 'بدون عنوان'}</td>
                    <td>${product ? `<span class="badge badge-success">${product.name}</span>` : '<span style="color:#94a3b8;">غير مرتبط</span>'}</td>
                    <td style="font-size:12px; color:#64748b;">${new Date(reel.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            <button onclick="editReel('${reel.id}')" class="btn btn-outline" style="padding:6px 12px; font-size:12px; color:var(--primary);"><i class="fas fa-edit"></i> تعديل</button>
                            <button onclick="deleteReel('${reel.id}')" class="btn btn-outline" style="padding:6px 12px; font-size:12px; color:#ef4444;"><i class="fas fa-trash"></i> حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading reels:', e);
    }
}

function showReelsList(updateUrl = true) {
    document.getElementById('reelsListView').style.display = 'block';
    document.getElementById('reelsEditorView').style.display = 'none';
    loadReels();
    loadReelsShuffleSetting();
    loadReelsEnabledSetting();

    if (updateUrl) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('reelAction');
        newUrl.searchParams.delete('reelId');
        window.history.pushState({}, '', newUrl);
    }
}

function showReelEditor(id = null, updateUrl = true) {
    const titleEl = document.getElementById('reelPageTitle');
    const form = document.getElementById('reelPageForm');
    const idInput = document.getElementById('reelPageId');
    const titleInput = document.getElementById('reelPageTitleInput');
    const urlInput = document.getElementById('reelPageVideoUrl');
    const productSelect = document.getElementById('reelPageProductId');

    // Reset form
    form.reset();
    idInput.value = id || '';
    
    // Fill products dropdown
    productSelect.innerHTML = '<option value="">-- اختر منتجاً ليظهر عند النقر --</option>' + 
        allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    if (id) {
        titleEl.innerText = 'تعديل فيديو الريل';
        DB.getReels().then(reels => {
            const reel = reels.find(r => r.id === id);
            if (reel) {
                titleInput.value = reel.title || '';
                urlInput.value = reel.videoUrl;
                productSelect.value = reel.productId || '';
                updateReelPreview();
            }
        });
    } else {
        titleEl.innerText = 'إضافة فيديو ريل جديد';
        updateReelPreview();
    }

    document.getElementById('reelsListView').style.display = 'none';
    document.getElementById('reelsEditorView').style.display = 'block';

    if (updateUrl) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('reelAction', id ? 'edit' : 'new');
        if (id) newUrl.searchParams.set('reelId', id);
        else newUrl.searchParams.delete('reelId');
        window.history.pushState({}, '', newUrl);
    }
}

function handleReelDeepLinking() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('reelAction');
    const id = params.get('reelId');

    if (action === 'new') {
        showReelEditor(null, false);
    } else if (action === 'edit' && id) {
        showReelEditor(id, false);
    }
}

function updateReelPreview() {
    const title = document.getElementById('reelPageTitleInput').value;
    const videoUrl = document.getElementById('reelPageVideoUrl').value;
    const productId = document.getElementById('reelPageProductId').value;

    const previewVideo = document.getElementById('reelPreviewVideo');
    const previewEmpty = document.getElementById('reelPreviewEmpty');
    const previewUI = document.getElementById('reelPreviewUI');
    const previewTitle = document.getElementById('reelPreviewTitle');
    const previewProduct = document.getElementById('reelPreviewProduct');

    if (videoUrl) {
        previewVideo.src = videoUrl;
        previewVideo.style.display = 'block';
        previewVideo.play().catch(() => {});
        previewEmpty.style.display = 'none';
        previewUI.style.display = 'flex';
    } else {
        previewVideo.style.display = 'none';
        previewEmpty.style.display = 'flex';
        previewUI.style.display = 'none';
    }

    previewTitle.innerText = title || 'عنوان الفيديو سيظهر هنا';
    
    if (productId) {
        const product = allProducts.find(p => String(p.id) === String(productId));
        if (product) {
            document.getElementById('reelPreviewProdImg').src = product.image;
            document.getElementById('reelPreviewProdName').innerText = product.name;
            document.getElementById('reelPreviewProdPrice').innerText = product.price + ' ₪';
            previewProduct.style.display = 'flex';
        } else {
            previewProduct.style.display = 'none';
        }
    } else {
        previewProduct.style.display = 'none';
    }
}

async function uploadReelVideoPage(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    const formData = new FormData();
    formData.append('image', file);

    Swal.fire({
        title: 'جاري رفع الفيديو...',
        text: 'يرجى الانتظار، قد يستغرق ذلك وقتاً حسب حجم الملف',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await fetch('https://api.imgbb.com/1/upload?key=b3c8f2f99f17b4556b4dbfc0597fb85b', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.data && result.data.url) {
            document.getElementById('reelPageVideoUrl').value = result.data.url;
            updateReelPreview();
            Swal.fire('تم الرفع!', 'تم رفع الفيديو بنجاح', 'success');
        } else {
            throw new Error(result.error || 'فشل الرفع');
        }
    } catch (e) {
        console.error('Upload error:', e);
        Swal.fire('خطأ في الرفع', e.message, 'error');
    }
}

async function editReel(id) {
    showReelEditor(id);
}

async function saveReel(event) {
    event.preventDefault();
    const id = document.getElementById('reelPageId').value;
    const data = {
        title: document.getElementById('reelPageTitleInput').value,
        videoUrl: document.getElementById('reelPageVideoUrl').value,
        productId: document.getElementById('reelPageProductId').value || null
    };

    if (!data.videoUrl) {
        Swal.fire('خطأ', 'يرجى اختيار فيديو أو وضع رابط', 'error');
        return;
    }

    try {
        const reelData = id ? { ...data, id } : data;
        const result = await DB.saveReel(reelData);

        if (result) {
            Swal.fire('تم الحفظ!', 'تم حفظ فيديو الريل بنجاح', 'success');
            showReelsList();
        } else {
            Swal.fire('خطأ', 'فشل حفظ الفيديو', 'error');
        }
    } catch (e) {
        console.error('Error saving reel:', e);
        Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
}

async function deleteReel(id) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "لن تتمكن من التراجع عن هذا الإجراء!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف!',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        try {
            const result = await DB.deleteReel(id);
            if (result) {
                Swal.fire('تم الحذف!', 'تم حذف الفيديو بنجاح', 'success');
                loadReels();
            }
        } catch (e) {
            console.error('Error deleting reel:', e);
        }
    }
}

async function loadReelsShuffleSetting() {
    try {
        const settings = await DB.getSettings();
        const toggle = document.getElementById('reelsShuffleToggle');
        if (toggle) {
            toggle.checked = settings.reelsShuffle !== false; // Default: true (random)
        }
    } catch (e) {
        console.error('Error loading reels settings:', e);
    }
}

async function saveReelsShuffleSetting() {
    const toggle = document.getElementById('reelsShuffleToggle');
    if (!toggle) return;
    const reelsShuffle = toggle.checked;
    try {
        const result = await DB.setSettings({ reelsShuffle });
        if (true) {
            showToast(reelsShuffle ? '🔀 سيتم عرض الريلز بشكل عشوائي للزوار' : '📋 سيتم عرض الريلز بترتيب الإضافة');
        } else {
            showToast('❌ فشل حفظ الإعداد', 'error');
        }
    } catch (e) {
        showToast('❌ خطأ في الاتصال بالخادم', 'error');
    }
}

async function loadReelsEnabledSetting() {
    try {
        const settings = await DB.getSettings();
        const toggle = document.getElementById('reelsEnabledToggle');
        if (toggle) {
            toggle.checked = settings.reelsEnabled !== false;
        }
    } catch (e) {
        console.error('Error loading reels enabled setting:', e);
    }
}

async function saveReelsEnabledSetting() {
    const toggle = document.getElementById('reelsEnabledToggle');
    if (!toggle) return;
    const reelsEnabled = toggle.checked;
    try {
        await DB.setSettings({ reelsEnabled });
        showToast(reelsEnabled ? '✅ تم تفعيل ميزة الريلز للزوار' : '❌ تم إخفاء ميزة الريلز عن الزوار');
    } catch (e) {
        showToast('❌ خطأ في الاتصال بالخادم', 'error');
    }
}

// Expose to window
window.loadReels = loadReels;
window.showReelEditor = showReelEditor;
window.showReelsList = showReelsList;
window.updateReelPreview = updateReelPreview;
window.uploadReelVideoPage = uploadReelVideoPage;
window.editReel = editReel;
window.saveReel = saveReel;
window.deleteReel = deleteReel;
window.handleReelDeepLinking = handleReelDeepLinking;
window.loadReelsShuffleSetting = loadReelsShuffleSetting;
window.saveReelsShuffleSetting = saveReelsShuffleSetting;
window.loadReelsEnabledSetting = loadReelsEnabledSetting;
window.saveReelsEnabledSetting = saveReelsEnabledSetting;

// ─── JSON Import & Export ──────────────────────────────────────────
function triggerJsonImport() {
    document.getElementById('jsonImportInput').click();
}

async function handleJsonImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const products = JSON.parse(e.target.result);
            if (!Array.isArray(products)) {
                throw new Error('الملف يجب أن يحتوي على مصفوفة منتجات (Array).');
            }

            const confirmResult = await Swal.fire({
                title: 'تأكيد الاستيراد',
                text: `هل أنت متأكد من استيراد ${products.length} منتج؟ سيتم تحديث المنتجات الموجودة مسبقاً (حسب ID أو SKU).`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'نعم، استورد الآن',
                cancelButtonText: 'إلغاء'
            });

            if (confirmResult.isConfirmed) {
                Swal.fire({
                    title: 'جاري الاستيراد...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                const result = await DB.importProducts(products);

                if (result) {
                    await Swal.fire('تم بنجاح!', 'تم استيراد المنتجات بنجاح', 'success');
                    window.location.reload();
                } else {
                    throw new Error(result.message);
                }
            }
        } catch (err) {
            console.error('Import error:', err);
            Swal.fire('خطأ في الاستيراد', err.message, 'error');
        } finally {
            event.target.value = ''; // Reset input
        }
    };
    reader.readAsText(file);
}

window.triggerJsonImport = triggerJsonImport;
window.handleJsonImport = handleJsonImport;

// ─── Product Feed ──────────────────────────────────────────────
function openProductFeedModal() {
    switchTab('tab-marketing-feed');
}

async function copyFeedLink(platform, format = 'xml') {
    // Copy the feed URL to clipboard
    const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const feedUrl = `${window.location.origin}${base}index.html?app=products-feed&platform=${platform}&format=${format}`;
    try {
        await navigator.clipboard.writeText(feedUrl);
        Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: `تم نسخ رابط ${platform.toUpperCase()} (${format.toUpperCase()})` });
    } catch {
        // Fallback: prompt
        prompt('انسخ الرابط:', feedUrl);
    }
}

async function downloadFeed(platform, format = 'csv') {
    try {
        const [products, settings] = await Promise.all([DB.getProducts(), DB.getSettings()]);
        const storeName = settings.storeName || 'Pro Store';
        const currency = settings.currency || 'ILS';
        const baseUrl = window.location.origin;

        const escXml = s => String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&apos;"}[c]));
        const escCsv = s => `"${String(s).replace(/"/g, '""')}"`;

        let content, filename, mime;

        if (format === 'xml') {
            let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n<channel>\n<title>${escXml(storeName)}</title>\n<link>${baseUrl}</link>\n<description>Product feed for ${escXml(storeName)}</description>\n`;
            products.forEach(p => {
                if (p.advanced && p.advanced.hiddenProduct) return;
                xml += `<item>\n<g:id>${escXml(p.id)}</g:id>\n<g:title>${escXml(p.name)}</g:title>\n<g:description>${escXml((p.description || '').replace(/<[^>]*>/g, '').substring(0, 5000))}</g:description>\n<g:link>${baseUrl}/index.html#?product=${p.id}</g:link>\n<g:image_link>${escXml(p.image || '')}</g:image_link>\n<g:availability>in stock</g:availability>\n<g:price>${p.price} ${currency}</g:price>${p.salePrice ? `\n<g:sale_price>${p.salePrice} ${currency}</g:sale_price>` : ''}\n<g:brand>${escXml(storeName)}</g:brand>\n<g:condition>new</g:condition>\n</item>\n`;
            });
            xml += `</channel>\n</rss>`;
            content = xml;
            filename = `products_feed_${platform}.xml`;
            mime = 'application/xml';
        } else {
            let csv = '';
            if (platform === 'google') {
                csv = 'id,title,description,link,image_link,availability,price,brand,condition,google_product_category\n';
                products.forEach(p => {
                    if (p.advanced && p.advanced.hiddenProduct) return;
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, '').substring(0, 5000))},${baseUrl}/index.html#?product=${p.id},${p.image},in stock,${p.price} ${currency},"${escCsv(storeName)}",new,\n`;
                });
            } else if (platform === 'snapchat') {
                csv = 'id,title,description,link,image_link,availability,price,brand,condition,item_group_id\n';
                products.forEach(p => {
                    if (p.advanced && p.advanced.hiddenProduct) return;
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, '').substring(0, 500))},${baseUrl}/index.html#?product=${p.id},${p.image},in stock,${p.price} ${currency},"${escCsv(storeName)}",new,${p.category || 'all'}\n`;
                });
            } else if (platform === 'tiktok') {
                csv = 'sku_id,title,description,product_link,image_link,stock,price,sale_price,category_id\n';
                products.forEach(p => {
                    if (p.advanced && p.advanced.hiddenProduct) return;
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, ''))},${baseUrl}/index.html#?product=${p.id},${p.image},999,${p.price} ${currency},${p.salePrice || ''},${p.category || '0'}\n`;
                });
            } else {
                csv = 'id,title,description,link,image_link,availability,price,sale_price,brand,condition\n';
                products.forEach(p => {
                    if (p.advanced && p.advanced.hiddenProduct) return;
                    csv += `${p.id},${escCsv(p.name)},${escCsv((p.description || '').replace(/<[^>]*>/g, '').substring(0, 5000))},${baseUrl}/index.html#?product=${p.id},${p.image},in stock,${p.price} ${currency},${p.salePrice ? p.salePrice + ' ' + currency : ''},"${escCsv(storeName)}",new\n`;
                });
            }
            content = '\uFEFF' + csv;
            filename = `products_feed_${platform}.csv`;
            mime = 'text/csv';
        }

        const blob = new Blob([content], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: `تم تحميل ملف ${filename}` });
    } catch (e) {
        console.error('Feed generation error:', e);
        Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'حدث خطأ أثناء إنشاء الملف' });
    }
}

window.openProductFeedModal = openProductFeedModal;
window.copyFeedLink = copyFeedLink;
window.downloadFeed = downloadFeed;

window.openProductFeedModal = openProductFeedModal;
window.copyFeedLink = copyFeedLink;

// ─── Welcome Popups System ─────────────────────────────────────
let popupCampaigns = [];

function initPopupsManager() {
    try {
        const input = document.getElementById('popups_json_input');
        let json = input ? input.value : '[]';
        // If the value is already an object (e.g. from Supabase JSONB auto-parse), stringify it
        if (typeof json === 'object') json = JSON.stringify(json);
        const parsed = json ? JSON.parse(json) : [];
        popupCampaigns = parsed;
        renderPopupsList();
    } catch(e) {
        console.error('Popups Init Error:', e);
        popupCampaigns = [];
        renderPopupsList();
    }
}

function renderPopupsList() {
    const container = document.getElementById('popupsListContainer');
    const noState = document.getElementById('noPopupsState');
    
    if (!container) return;

    if (popupCampaigns.length === 0) {
        container.innerHTML = '';
        noState.style.display = 'block';
        return;
    }

    noState.style.display = 'none';
    container.innerHTML = popupCampaigns.map((p, index) => `
        <div class="luxury-card popup-campaign-item" style="border:1px solid #e2e8f0; background:#f8fafc; padding:20px; border-radius:15px; position:relative;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:40px; height:40px; background:var(--primary); color:white; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px;">
                        <i class="fas ${p.type === 'image' ? 'fa-image' : 'fa-align-right'}"></i>
                    </div>
                    <div>
                        <h4 style="font-weight:800; color:#1e293b;">${p.title || 'حملة بدون عنوان'}</h4>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:11px; color:#64748b;">نوع العرض: ${p.type === 'image' ? 'صورة فقط' : 'نص وصورة'}</span>
                            <span class="badge" style="font-size:9px; background:${p.active !== false ? '#dcfce7' : '#fee2e2'}; color:${p.active !== false ? '#16a34a' : '#ef4444'};">
                                ${p.active !== false ? 'نشط' : 'متوقف'}
                            </span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <label class="switch-luxury" style="transform: scale(0.8);">
                        <input type="checkbox" ${p.active !== false ? 'checked' : ''} onchange="updatePopupData(${index}, 'active', this.checked); renderPopupsList();">
                        <span class="slider-luxury"></span>
                    </label>
                    <button type="button" class="btn btn-outline" style="padding:5px 12px; font-size:11px; color:#ef4444; border-color:#fecaca;" onclick="deletePopupCampaign(${index})">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
            
            <div class="section-grid" style="grid-template-columns: 1fr 1fr; gap:15px;">
                <div class="form-group">
                    <label class="label-luxury">العنوان</label>
                    <input type="text" class="input-luxury" value="${p.title || ''}" oninput="updatePopupData(${index}, 'title', this.value)">
                </div>
                <div class="form-group">
                    <label class="label-luxury">نوع المنبثق</label>
                    <select class="input-luxury" onchange="updatePopupData(${index}, 'type', this.value); renderPopupsList();">
                        <option value="full" ${p.type !== 'image' ? 'selected' : ''}>نص وصورة</option>
                        <option value="image" ${p.type === 'image' ? 'selected' : ''}>صورة فقط</option>
                    </select>
                </div>
            </div>
            
            <div class="section-grid" style="grid-template-columns: 1fr 1fr; gap:15px; margin-top:10px;">
                <div class="form-group">
                    <label class="label-luxury">رابط الصورة</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="popup_img_${index}" class="input-luxury" value="${p.image || ''}" oninput="updatePopupData(${index}, 'image', this.value)">
                        <button type="button" class="btn btn-outline" style="padding:0 12px;" onclick="triggerPopupUpload(${index})"><i class="fas fa-upload"></i></button>
                    </div>
                </div>
                <div class="form-group">
                    <label class="label-luxury">رابط التوجيه (اختياري)</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="popup_link_${index}" class="input-luxury" value="${p.link || ''}" oninput="updatePopupData(${index}, 'link', this.value)" placeholder="مثال: app=product.show.123">
                        <button type="button" class="btn btn-outline" style="padding:0 12px; font-size:11px; white-space:nowrap;" onclick="openLinkPicker(${index})">
                            <i class="fas fa-link"></i> اختيار رابط
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="section-grid" style="grid-template-columns: 2fr 1fr; gap:15px; margin-top:10px;">
                <div class="form-group">
                    <label class="label-luxury">وصف العرض</label>
                    <input type="text" class="input-luxury" value="${p.desc || ''}" oninput="updatePopupData(${index}, 'desc', this.value)" placeholder="اكتشف عروضنا الحصرية الآن!">
                </div>
                <div class="form-group">
                    <label class="label-luxury">تأخير الظهور (ثواني)</label>
                    <input type="number" class="input-luxury" value="${p.delay || 2}" oninput="updatePopupData(${index}, 'delay', this.value)">
                </div>
            </div>

            <!-- Advanced Features -->
            <div style="margin-top:20px; padding-top:20px; border-top:1px dashed #cbd5e1;">
                <h5 style="font-weight:800; font-size:12px; color:var(--primary); margin-bottom:15px;"><i class="fas fa-magic"></i> ميزات متقدمة للحملة</h5>
                
                <div class="section-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:15px;">
                    <div class="form-group">
                        <label class="label-luxury">كوبون الخصم (اختياري)</label>
                        <input type="text" class="input-luxury" value="${p.coupon || ''}" oninput="updatePopupData(${index}, 'coupon', this.value)" placeholder="SAVE20">
                    </div>
                    <div class="form-group">
                        <label class="label-luxury">طريقة الظهور</label>
                        <select class="input-luxury" onchange="updatePopupData(${index}, 'showOn', this.value)">
                            <option value="load" ${p.showOn === 'load' ? 'selected' : ''}>عند التحميل</option>
                            <option value="exit" ${p.showOn === 'exit' ? 'selected' : ''}>نية الخروج (Exit Intent)</option>
                            <option value="scroll" ${p.showOn === 'scroll' ? 'selected' : ''}>عند النزول 50% (Scroll)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="label-luxury">سياسة التكرار</label>
                        <select class="input-luxury" onchange="updatePopupData(${index}, 'repeat', this.value)">
                            <option value="always" ${p.repeat === 'always' ? 'selected' : ''}>كل زيارة</option>
                            <option value="once_session" ${p.repeat === 'once_session' ? 'selected' : ''}>مرة كل جلسة</option>
                            <option value="once_day" ${p.repeat === 'once_day' ? 'selected' : ''}>مرة يومياً</option>
                            <option value="once_forever" ${p.repeat === 'once_forever' ? 'selected' : ''}>مرة واحدة فقط</option>
                        </select>
                    </div>
                </div>

                <div class="section-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:15px; margin-top:10px;">
                    <div class="form-group">
                        <label class="label-luxury">التصميم (Theme)</label>
                        <select class="input-luxury" onchange="updatePopupData(${index}, 'theme', this.value)">
                            <option value="luxury" ${p.theme === 'luxury' ? 'selected' : ''}>فخامة (اللون الرئيسي)</option>
                            <option value="dark" ${p.theme === 'dark' ? 'selected' : ''}>ليلي (Dark Mode)</option>
                            <option value="glass" ${p.theme === 'glass' ? 'selected' : ''}>زجاجي (Glassmorphism)</option>
                            <option value="minimal" ${p.theme === 'minimal' ? 'selected' : ''}>بسيط (Minimalist)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="label-luxury">تأثير الحركة (Animation)</label>
                        <select class="input-luxury" onchange="updatePopupData(${index}, 'animation', this.value)">
                            <option value="popIn" ${p.animation === 'popIn' ? 'selected' : ''}>انبثاق (Pop In)</option>
                            <option value="slideUp" ${p.animation === 'slideUp' ? 'selected' : ''}>صعود (Slide Up)</option>
                            <option value="zoomIn" ${p.animation === 'zoomIn' ? 'selected' : ''}>تكبير (Zoom In)</option>
                            <option value="rotateIn" ${p.animation === 'rotateIn' ? 'selected' : ''}>دوران (Rotate In)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="label-luxury">مؤقت تنازلي (Urgency)</label>
                        <div style="display:flex; align-items:center; gap:10px; background:#fff; padding:8px; border-radius:10px; border:1.5px solid #e2e8f0;">
                            <input type="checkbox" ${p.showTimer ? 'checked' : ''} onchange="updatePopupData(${index}, 'showTimer', this.checked); renderPopupsList();">
                            <span style="font-size:11px; font-weight:700;">تفعيل</span>
                            ${p.showTimer ? `
                                <input type="number" class="input-luxury" style="padding:4px 8px; font-size:11px; width:60px;" value="${p.timerMinutes || 10}" oninput="updatePopupData(${index}, 'timerMinutes', this.value)">
                                <span style="font-size:10px; color:#64748b;">دقيقة</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    syncPopupsJSON();
}

function addNewPopupCampaign() {
    popupCampaigns.push({
        id: 'p' + Date.now(),
        title: 'عرض جديد 🔥',
        desc: 'اكتشف عروضنا الحصرية الآن!',
        image: '',
        link: '',
        delay: 2,
        active: true,
        type: 'full',
        coupon: '',
        showOn: 'load',
        repeat: 'always',
        theme: 'luxury',
        animation: 'popIn',
        showTimer: false,
        timerMinutes: 10
    });
    renderPopupsList();
    syncPopupsJSON();
    // Scroll to the new campaign card
    setTimeout(() => {
        const cards = document.querySelectorAll('#popupsListContainer > div');
        if (cards.length) {
            cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            cards[cards.length - 1].style.border = '2px solid #10b981';
            cards[cards.length - 1].style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2)';
        }
    }, 200);
    if (typeof showToast === 'function') showToast('✅ تمت إضافة حملة منبثقة جديدة — عدّل البيانات من الأسفل');
}

function updatePopupData(index, field, value) {
    popupCampaigns[index][field] = value;
    syncPopupsJSON();
}

async function deletePopupCampaign(index) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "سيتم حذف هذه الحملة المنبثقة نهائياً!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;
    popupCampaigns.splice(index, 1);
    renderPopupsList();
    syncPopupsJSON();
    // Auto-save to Supabase
    try {
        const settings = { popups_json: document.getElementById('popups_json_input').value };
        let popupsVal = settings.popups_json;
        if (typeof popupsVal === 'object') popupsVal = JSON.stringify(popupsVal);
        settings.popups = popupsVal;
        settings.popups_json = popupsVal;
        await DB.setSettings(settings);
        if (typeof showToast === 'function') showToast('🗑️ تم حذف الحملة وحفظ التغييرات');
    } catch(e) {
        console.error('Auto-save after delete failed:', e);
    }
}

function triggerPopupUpload(index) {
    triggerUpload(`popup_img_${index}`);
}

function syncPopupsJSON() {
    document.getElementById('popups_json_input').value = JSON.stringify(popupCampaigns);
}

async function openLinkPicker(index) {
    let currentTab = 'products';
    let allProducts = [];
    let allPages = [];
    let displayedCount = 20;
    let searchTimeout = null;
    
    // Fetch data upfront with loading state
    try {
        const [pRes, pgRes] = await Promise.all([
            DB.getProducts(),
            DB.getPages()
        ]);
        allProducts = pRes;
        allPages = pgRes;
    } catch(e) { console.error(e); }

    const generalLinks = [
        { id: 'app=cart', label: 'سلة المشتريات', icon: 'fa-shopping-cart', color: '#10b981' },
        { id: 'app=wishlist', label: 'قائمة الأمنيات', icon: 'fa-heart', color: '#f43f5e' },
        { id: 'app=orders', label: 'طلباتي السابقة', icon: 'fa-box', color: '#3b82f6' },
        { id: 'app=reels', label: 'صفحة الفيديوهات (Reels)', icon: 'fa-play-circle', color: '#8b5cf6' }
    ];

    const getFilteredData = (tab, query = '') => {
        const q = query.toLowerCase();
        if (tab === 'products') return allProducts.filter(p => p.name.toLowerCase().includes(q));
        if (tab === 'pages') return allPages.filter(p => p.title.toLowerCase().includes(q));
        return generalLinks;
    };

    const renderItems = (tab, query = '', limit = 20) => {
        const data = getFilteredData(tab, query);
        const items = data.slice(0, limit);
        let html = '';
        
        if (tab === 'products') {
            html = `<div class="explorer-grid">
                ${items.map(p => `
                    <div class="explorer-card" onclick="selectExplorerLink('${index}', 'app=product.show.${p.id}')">
                        <div class="img-box">
                            <img src="${p.images && p.images[0] ? p.images[0] : '/public/img/no-image.png'}" loading="lazy" onload="this.parentElement.classList.remove('skeleton')" class="skeleton">
                        </div>
                        <div class="info">
                            <div class="name">${p.name}</div>
                            <div class="meta">${p.price} ₪</div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        } else {
            html = `<div class="explorer-list">
                ${items.map(item => {
                    const isPage = tab === 'pages';
                    const link = isPage ? `/page/${item.slug}` : item.id;
                    const icon = isPage ? 'fa-file-alt' : item.icon;
                    const color = isPage ? 'var(--primary)' : item.color;
                    return `
                        <div class="explorer-list-item" onclick="selectExplorerLink('${index}', '${link}')">
                            <div class="icon-box" style="color:${color}"><i class="fas ${icon}"></i></div>
                            <div class="info">
                                <div class="name">${isPage ? item.title : item.label}</div>
                                <div class="meta">${link}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>`;
        }

        if (items.length < data.length) {
            html += `<div id="explorerLoader" style="text-align:center; padding:20px; color:#64748b; font-size:12px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل المزيد...</div>`;
        } else if (data.length === 0) {
            html = `<div style="text-align:center; padding:50px; color:#94a3b8;">
                <i class="fas fa-search" style="font-size:40px; margin-bottom:15px; opacity:0.2;"></i>
                <div style="font-weight:800;">لم يتم العثور على نتائج</div>
            </div>`;
        }
        
        return html;
    };

    Swal.fire({
        title: 'مستعرض روابط المتجر الذكي',
        width: '850px',
        html: `
            <div class="explorer-container">
                <div class="explorer-tabs">
                    <div class="explorer-tab active" id="tab-btn-products" onclick="switchExplorerTab('products')">
                        <i class="fas fa-box-open"></i> المنتجات (${allProducts.length})
                    </div>
                    <div class="explorer-tab" id="tab-btn-pages" onclick="switchExplorerTab('pages')">
                        <i class="fas fa-file-alt"></i> الصفحات (${allPages.length})
                    </div>
                    <div class="explorer-tab" id="tab-btn-general" onclick="switchExplorerTab('general')">
                        <i class="fas fa-th-large"></i> روابط عامة
                    </div>
                </div>
                
                <div class="explorer-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="explorerSearchInput" placeholder="ابحث باسم المنتج أو الصفحة..." autocomplete="off">
                </div>
                
                <div class="explorer-body" id="explorerBody">
                    ${renderItems('products')}
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        customClass: { popup: 'luxury-swal-popup' },
        didOpen: () => {
            const body = document.getElementById('explorerBody');
            const searchInput = document.getElementById('explorerSearchInput');

            window.switchExplorerTab = (tab) => {
                currentTab = tab;
                displayedCount = 20;
                document.querySelectorAll('.explorer-tab').forEach(t => t.classList.remove('active'));
                document.getElementById('tab-btn-' + tab).classList.add('active');
                body.innerHTML = renderItems(tab, searchInput.value, displayedCount);
                body.scrollTop = 0;
            };

            // Debounced Search
            searchInput.oninput = () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    displayedCount = 20;
                    body.innerHTML = renderItems(currentTab, searchInput.value, displayedCount);
                    body.scrollTop = 0;
                }, 300);
            };

            // Infinite Scroll
            body.onscroll = () => {
                if (body.scrollTop + body.clientHeight >= body.scrollHeight - 50) {
                    const data = getFilteredData(currentTab, searchInput.value);
                    if (displayedCount < data.length) {
                        displayedCount += 20;
                        body.innerHTML = renderItems(currentTab, searchInput.value, displayedCount);
                    }
                }
            };

            window.selectExplorerLink = (idx, link) => {
                updatePopupData(idx, 'link', link);
                renderPopupsList();
                Swal.close();
            };
        }
    });
}

function printOrderInvoice() {
    const invoiceEl = document.querySelector('.print-only-invoice');
    if (!invoiceEl) return;

    const printWindow = window.open('', '_blank', 'width=900,height=900');
    printWindow.document.write(`
        <html>
            <head>
                <title>طباعة فاتورة</title>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap">
                <style>
                    body { margin: 0; padding: 20px; direction: rtl; font-family: 'Cairo', sans-serif; background: #fff; font-weight: 400; color: #000; }
                    .print-only-invoice { display: block !important; width: 100%; }
                    @page { size: portrait; margin: 0; }
                    * { box-sizing: border-box; }
                    strong, b { font-weight: 600; }
                </style>
            </head>
            <body>
                ${invoiceEl.innerHTML}
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

window.addNewPopupCampaign = addNewPopupCampaign;
window.deletePopupCampaign = deletePopupCampaign;
window.triggerPopupUpload = triggerPopupUpload;
window.updatePopupData = updatePopupData;

