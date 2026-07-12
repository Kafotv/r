// Store Front Main JS - Static Version (Supabase Backend)
// All fetch() calls replaced with DB.*() calls for GitHub Pages deployment.

// ─── Script Block #1 ───

        function playSfx(type) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                if (type === 'add') {
                    [[523, 0], [784, 0.13]].forEach(([freq, delay]) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain); gain.connect(ctx.destination);
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                        gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
                        osc.start(ctx.currentTime + delay);
                        osc.stop(ctx.currentTime + delay + 0.35);
                    });
                } else if (type === 'click') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(660, ctx.currentTime);
                    gain.gain.setValueAtTime(0.2, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.1);
                } else if (type === 'remove') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(380, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.22);
                    gain.gain.setValueAtTime(0.28, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.22);
                }
            } catch(e) {}
        }

        function showSlide(index, sliderEl) {
            if (!sliderEl) return;
            const slides = sliderEl.querySelectorAll('.slide');
            const dots = sliderEl.querySelectorAll('.dot');
            if (!slides.length) return;
            let current = index;
            if(current >= slides.length) current = 0;
            if(current < 0) current = slides.length - 1;
            sliderEl.setAttribute('data-current', current);
            slides.forEach(s => s.classList.remove('active'));
            dots.forEach(d => d.classList.remove('active'));
            if (slides[current]) slides[current].classList.add('active');
            if (dots[current]) dots[current].classList.add('active');
        }

        function startAutoSlide() {
            const sliders = document.querySelectorAll('.hero-slider, #heroSlider');
            sliders.forEach(slider => {
                const slides = slider.querySelectorAll('.slide');
                if (slides.length <= 1) return;
                const speed = parseInt(slider.getAttribute('data-speed')) || 5;
                if (slider.autoSlideInterval) clearInterval(slider.autoSlideInterval);
                slider.autoSlideInterval = setInterval(() => {
                    let current = parseInt(slider.getAttribute('data-current') || 0);
                    showSlide(current + 1, slider);
                }, speed * 1000);
            });
        }

        window.addEventListener('load', () => { startAutoSlide(); });

        function goToSlide(index, el) { 
            const slider = el.closest('.hero-slider') || document.getElementById('heroSlider');
            if (!slider) return;
            showSlide(index, slider);
            startAutoSlide();
        }
        function nextSlide(el) { 
            const slider = el.closest('.hero-slider') || document.getElementById('heroSlider');
            if (!slider) return;
            let current = parseInt(slider.getAttribute('data-current') || 0);
            showSlide(current + 1, slider); 
        }
        function prevSlide(el) { 
            const slider = el.closest('.hero-slider') || document.getElementById('heroSlider');
            if (!slider) return;
            let current = parseInt(slider.getAttribute('data-current') || 0);
            showSlide(current - 1, slider); 
        }

        function showToast(msg) {
            const toast = document.getElementById('globalToast');
            if(!toast) return;
            toast.querySelector('span').innerText = msg;
            toast.classList.add('visible');
            setTimeout(() => toast.classList.remove('visible'), 3000);
        }

        function openModal(id) {
            const m = document.getElementById(id);
            if (m) m.classList.add('active');
            if (id === 'wishlistModal') renderWishlistModal();
            if (id === 'cartModal') renderCartModal();
        }
        function closeModal(id) {
            const m = document.getElementById(id);
            if (m) m.classList.remove('active');
        }
        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
                e.target.classList.remove('active');
            }
        });

        function openQuickAdd(id, name, price, image, colorsStr, sizesStr) {
            const colors = colorsStr ? colorsStr.split(',') : [];
            const sizes = sizesStr ? sizesStr.split(',') : [];
            if(colors.length === 0 && sizes.length === 0) {
                addToCart(id, name, price, image);
                openModal('cartModal');
                return;
            }
            let html = `<div style="text-align:center; margin-bottom:20px;">
                <img src="${image}" style="width:100px; height:100px; border-radius:10px; object-fit:cover; margin-bottom:10px;">
                <h4 style="font-weight:800;">${name}</h4>
                <p style="color:var(--primary); font-weight:800;">${price} ₪</p>
            </div>`;
            if(colors.length > 0) {
                html += `<div class="qa-option-group" style="margin-bottom:20px;">
                    <label style="display:block; font-weight:800; font-size:12px; margin-bottom:10px;">اختر اللون:</label>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;" id="qaColors">
                        ${colors.map(c => `<span class="option-pill" onclick="selectQAPill(this)" data-val="${c}">${c}</span>`).join('')}
                    </div>
                    <div class="qa-error-msg" style="color:#ef4444; font-size:10px; font-weight:700; margin-top:5px; display:none;">يرجى اختيار اللون</div>
                </div>`;
            }
            if(sizes.length > 0) {
                html += `<div class="qa-option-group" style="margin-bottom:25px;">
                    <label style="display:block; font-weight:800; font-size:12px; margin-bottom:10px;">اختر المقاس:</label>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;" id="qaSizes">
                        ${sizes.map(s => `<span class="option-pill" onclick="selectQAPill(this)" data-val="${s}">${s}</span>`).join('')}
                    </div>
                    <div class="qa-error-msg" style="color:#ef4444; font-size:10px; font-weight:700; margin-top:5px; display:none;">يرجى اختيار المقاس</div>
                </div>`;
            }
            html += `<style>.qa-option-group .option-pill.selected{background:var(--primary);color:white;border-color:var(--primary);}.qa-option-group .error-border{border:1px solid #ef4444;padding:10px;border-radius:12px;background:#fff5f5;animation:qaShake .5s ease-in-out;}@keyframes qaShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}50%{transform:translateX(5px)}75%{transform:translateX(-5px)}}</style>
                <button onclick="confirmQuickAdd('${id}','${name}',${price},'${image}')" style="width:100%; padding:15px; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:800; cursor:pointer;">تأكيد الإضافة للسلة</button>`;
            document.getElementById('quickAddBody').innerHTML = html;
            openModal('quickAddModal');
        }

        function selectQAPill(el) {
            playSfx('click');
            const container = el.parentNode;
            Array.from(container.children).forEach(p => p.classList.remove('selected'));
            el.classList.add('selected');
            container.classList.remove('error-border');
            const errorMsg = container.parentNode.querySelector('.qa-error-msg');
            if (errorMsg) errorMsg.style.display = 'none';
        }

        function confirmQuickAdd(id, name, price, image) {
            const colorGroup = document.getElementById('qaColors');
            const sizeGroup = document.getElementById('qaSizes');
            let hasError = false;
            if (colorGroup) {
                const selected = colorGroup.querySelector('.selected');
                if (!selected) {
                    colorGroup.classList.add('error-border');
                    colorGroup.parentNode.querySelector('.qa-error-msg').style.display = 'block';
                    hasError = true;
                }
            }
            if (sizeGroup) {
                const selected = sizeGroup.querySelector('.selected');
                if (!selected) {
                    sizeGroup.classList.add('error-border');
                    sizeGroup.parentNode.querySelector('.qa-error-msg').style.display = 'block';
                    hasError = true;
                }
            }
            if (hasError) return;
            const color = colorGroup ? colorGroup.querySelector('.selected')?.dataset.val : '';
            const size = sizeGroup ? sizeGroup.querySelector('.selected')?.dataset.val : '';
            const optStr = [color ? ` (${color})` : '', size ? ` (${size})` : ''].join('');
            addToCart(id, name + optStr, price, image, color, size);
            closeModal('quickAddModal');
        }

        // ── Cart Modal ──
        function renderCartModal() {
            const cart = getCart();
            const container = document.getElementById('cartModalItems');
            if (!container) return;
            if (cart.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:40px 0;"><i class="fa fa-shopping-bag" style="font-size:40px; opacity:0.15;"></i><p style="color:var(--gray-400); margin-top:10px;">سلتك فارغة</p></div>';
                document.getElementById('cartStepItems').style.display = 'block';
                document.getElementById('cartStepCheckout').style.display = 'none';
                document.getElementById('cartStepPayment').style.display = 'none';
                recalculateCartTotals();
                return;
            }
            container.innerHTML = cart.map((item, i) => `
                <div style="display:flex; align-items:center; gap:15px; padding-bottom:15px; border-bottom:1px solid var(--gray-200);">
                    <img src="${item.image || ''}" style="width:65px; height:65px; border-radius:10px; object-fit:cover;">
                    <div style="flex:1;">
                        <h4 style="font-weight:800; font-size:14px; margin:0 0 5px 0;">${item.name}</h4>
                        <p style="color:var(--primary); font-weight:800; margin:0;">${item.price} ₪ ${item.isWholesale ? '<span style="font-size:11px; font-weight:bold; color:#10b981; background:#10b98115; padding:2px 6px; border-radius:4px; margin-right:5px; display:inline-block; vertical-align:middle;">جملة</span>' : ''}</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="updateCartQuantity(${i}, -1)" style="width:30px; height:30px; border-radius:8px; border:1px solid var(--gray-200); background:white; cursor:pointer; font-weight:800;">-</button>
                        <span style="font-weight:800; min-width:20px; text-align:center;">${item.quantity}</span>
                        <button onclick="updateCartQuantity(${i}, 1)" style="width:30px; height:30px; border-radius:8px; border:1px solid var(--gray-200); background:white; cursor:pointer; font-weight:800;">+</button>
                    </div>
                    <button onclick="removeFromCartModal(${i})" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:16px;"><i class="fa fa-trash-alt"></i></button>
                </div>
            `).join('');
            recalculateCartTotals();
        }

        let activeCoupon = null;
        let storeActivePromotions = [];

        async function fetchActivePromotions() {
            try {
                const { data } = await DB.supabase.from('promotions').select('*');
                const now = new Date();
                storeActivePromotions = (data || []).filter(p => {
                    const start = new Date(p.start_date);
                    const end = new Date(p.end_date);
                    return now >= start && now <= end;
                });
                if (storeActivePromotions.length > 0) {
                    const promo = storeActivePromotions[0];
                    if (promo.show_banner !== false) {
                        let banner = document.getElementById('promoBanner');
                        if (!banner) {
                            banner = document.createElement('div');
                            banner.id = 'promoBanner';
                            document.body.insertBefore(banner, document.body.firstChild);
                        }
                        banner.innerHTML = `<span>${promo.occasion_emoji || ''} ${promo.occasion_name || ''}: ${promo.banner_text || 'عروض مميزة بانتظارك!'}</span>`;
                        if (promo.banner_bg_color) banner.style.cssText = `background: ${promo.banner_bg_color};`;
                    }
                }
            } catch (e) { console.error('Failed to load promotions', e); }
        }
        document.addEventListener('DOMContentLoaded', fetchActivePromotions);

        function recalculateCartTotals() {
            const cart = getCart();
            let subTotal = 0;
            cart.forEach(item => { subTotal += item.price * item.quantity; });
            const subTotalEl = document.getElementById('subTotalLabel');
            if (subTotalEl) subTotalEl.innerText = subTotal.toFixed(2);
            const totalEl = document.getElementById('modalTotalLabel');
            if (totalEl) totalEl.innerText = subTotal.toFixed(2);
            let discount = 0;
            const couponInput = document.getElementById('couponInput');
            const couponBtn = document.getElementById('couponBtn');
            const couponFeedback = document.getElementById('couponFeedback');
            if (activeCoupon) {
                if (subTotal >= (activeCoupon.min_order || 0)) {
                    if (activeCoupon.type === 'percentage') discount = subTotal * (activeCoupon.value / 100);
                    else if (activeCoupon.type === 'fixed') discount = activeCoupon.value;
                    document.getElementById('discountRow').style.display = 'flex';
                    document.getElementById('discountLabel').innerText = discount.toFixed(2) + '-';
                    if (couponInput && couponBtn && couponFeedback) {
                        couponInput.value = activeCoupon.code;
                        couponInput.style.borderColor = '#10b981';
                        couponInput.style.backgroundColor = '#f0fdf4';
                        couponInput.style.color = '#10b981';
                        couponInput.readOnly = true;
                        couponBtn.innerText = 'إلغاء';
                        couponBtn.style.backgroundColor = '#ef4444';
                        couponFeedback.style.display = 'flex';
                        couponFeedback.innerHTML = `<span>✓ الكوبون مُفعّل -خصم ${discount.toFixed(2)} ₪</span><span onclick="removeCoupon()" style="cursor:pointer; font-size:12px; text-decoration:underline;">إلغاء</span>`;
                    }
                } else {
                    showToast(`الحد الأدنى لهذا الكوبون هو ${activeCoupon.minOrder} ₪`);
                    removeCoupon();
                    return;
                }
            } else {
                document.getElementById('discountRow').style.display = 'none';
            }
            let cities = [];
            try { cities = JSON.parse(localStorage.getItem('store_cities') || '[]'); } catch(e) {}
            if (cities.length === 0 && window.StoreInit && StoreInit.settings) {
                cities = StoreInit.settings.cities || [];
                if (typeof cities === 'string') try { cities = JSON.parse(cities); } catch(e) { cities = []; }
            }
            const checkedRegion = document.querySelector('input[name="custRegion"]:checked');
            const regionName = checkedRegion ? checkedRegion.value : 'الضفة';
            const matchedCity = cities.find(c => c.name === regionName);
            const shipping = subTotal > 0 ? (matchedCity ? parseInt(matchedCity.price) : 20) : 0;
            const finalTotal = subTotal > 0 ? Math.max(0, subTotal - discount + shipping) : 0;
            document.getElementById('shippingTotalLabel').innerText = shipping + ' ₪';
            document.getElementById('finalTotalLabel').innerText = finalTotal.toFixed(2);
        }

        function showCheckoutForm() {
            if (getCart().length === 0) return;
            document.getElementById('cartStepItems').style.display = 'none';
            document.getElementById('cartStepCheckout').style.display = 'block';

            // Auto-fill for logged-in distributors
            const distName = localStorage.getItem('distributorName');
            const distPhone = localStorage.getItem('distributorPhone');
            const distCity = localStorage.getItem('distributorCity');
            const distAddress = localStorage.getItem('distributorAddress');
            if (distName) {
                const nameEl = document.getElementById('custName');
                if (nameEl && !nameEl.value) nameEl.value = distName;
            }
            if (distPhone) {
                const phoneEl = document.getElementById('custPhone');
                if (phoneEl && !phoneEl.value) phoneEl.value = distPhone;
            }
            if (distCity) {
                const cityEl = document.getElementById('custCityName');
                if (cityEl && !cityEl.value) cityEl.value = distCity;
            }
            if (distAddress) {
                const addrEl = document.getElementById('custAddress');
                if (addrEl && !addrEl.value) addrEl.value = distAddress;
            }

            try {
                const cart = getCart();
                const sessionId = localStorage.getItem('store_session_id') || (() => {
                    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                    localStorage.setItem('store_session_id', id);
                    return id;
                })();
                DB.trackAbandoned(sessionId, {
                    name: '', city: '', address: '', phone: '', email: '', items: cart
                }).catch(() => {});
            } catch(e) {}
        }
        function backToCart() {
            document.getElementById('cartStepItems').style.display = 'block';
            document.getElementById('cartStepCheckout').style.display = 'none';
        }
        function backToCheckout() {
            document.getElementById('cartStepCheckout').style.display = 'block';
            document.getElementById('cartStepPayment').style.display = 'none';
        }
        window.showPaymentStep = function showPaymentStep() {
            const nameEl = document.getElementById('custName');
            const cityEl = document.getElementById('custCityName');
            const addrEl = document.getElementById('custAddress');
            const phoneEl = document.getElementById('custPhone');
            
            const name = nameEl ? nameEl.value.trim() : '';
            const city = cityEl ? cityEl.value.trim() : '';
            const address = addrEl ? addrEl.value.trim() : '';
            const phone = phoneEl ? phoneEl.value.trim() : '';

            let hasError = false;

            if (nameEl) nameEl.style.borderColor = '';
            if (cityEl) cityEl.style.borderColor = '';
            if (addrEl) addrEl.style.borderColor = '';
            if (phoneEl) phoneEl.style.borderColor = '';

            if (!name) {
                if (nameEl) nameEl.style.borderColor = '#ef4444';
                hasError = true;
            }
            if (!city) {
                if (cityEl) cityEl.style.borderColor = '#ef4444';
                hasError = true;
            }
            if (!address) {
                if (addrEl) addrEl.style.borderColor = '#ef4444';
                hasError = true;
            }
            if (!phone) {
                if (phoneEl) phoneEl.style.borderColor = '#ef4444';
                hasError = true;
            }

            if (hasError) {
                showToast('يرجى إكمال جميع الحقول المطلوبة');
                return;
            }

            // Simple phone format check (between 7 to 15 digits)
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length < 7 || cleanPhone.length > 15) {
                if (phoneEl) phoneEl.style.borderColor = '#ef4444';
                showToast('يرجى إدخال رقم هاتف صحيح');
                return;
            }

            document.getElementById('cartStepCheckout').style.display = 'none';
            document.getElementById('cartStepPayment').style.display = 'block';
        }

        function updateShippingByRegion(region) { recalculateCartTotals(); }

        async function applyCoupon() {
            const input = document.getElementById('couponInput');
            const btn = document.getElementById('couponBtn');
            const feedback = document.getElementById('couponFeedback');
            const code = input.value.trim();
            if (activeCoupon) { removeCoupon(); return; }
            if(!code) return;
            try {
                const { data: coupons } = await DB.supabase.from('coupons').select('*').eq('code', code.toUpperCase());
                const coupon = coupons && coupons[0];
                if (coupon) {
                    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
                        if (input) { input.style.borderColor = '#ef4444'; input.style.backgroundColor = '#fef2f2'; }
                        if (feedback) {
                            feedback.style.display = 'flex';
                            feedback.style.color = '#ef4444';
                            feedback.style.background = '#fef2f2';
                            feedback.innerHTML = '<span><i class="fas fa-times-circle"></i> هذا الكوبون استُنفد بالفعل</span>';
                        }
                        return;
                    }
                    const cart = getCart();
                    let subTotal = 0;
                    cart.forEach(item => { subTotal += item.price * item.quantity; });
                    if (subTotal < (coupon.min_order || 0)) {
                        showToast(`الحد الأدنى لتفعيل هذا الكوبون هو ${coupon.min_order} ₪`);
                        return;
                    }
                    activeCoupon = coupon;
                    recalculateCartTotals();
                    showToast('تم تطبيق كود الخصم بنجاح! 🎉');
                } else {
                    showToast('كود الخصم غير صالح');
                    if (input) { input.style.borderColor = '#ef4444'; input.style.backgroundColor = '#fef2f2'; }
                }
            } catch(e) { showToast('حدث خطأ أثناء التحقق من كود الخصم'); }
        }

        function removeCoupon() {
            const input = document.getElementById('couponInput');
            const btn = document.getElementById('couponBtn');
            const feedback = document.getElementById('couponFeedback');
            activeCoupon = null;
            recalculateCartTotals();
            if (input && btn && feedback) {
                input.value = '';
                input.style.borderColor = 'var(--gray-200)';
                input.style.backgroundColor = '#ffffff';
                input.style.color = 'inherit';
                input.readOnly = false;
                btn.innerText = 'تطبيق';
                btn.style.backgroundColor = 'var(--dark)';
                feedback.style.display = 'none';
                feedback.innerHTML = '';
                feedback.style.color = '#10b981';
                feedback.style.background = '#e6f4ea';
            }
            showToast('تم إلغاء كود الخصم');
        }

        function removeFromCartModal(i) {
            playSfx('remove');
            const cart = getCart();
            cart.splice(i, 1);
            saveCart(cart);
            renderCartModal();
        }

        function updateCartQuantity(i, delta) {
            playSfx('click');
            const cart = getCart();
            if(cart[i]) {
                cart[i].quantity += delta;
                if(cart[i].quantity <= 0) cart.splice(i, 1);
                saveCart(cart);
                renderCartModal();
            }
        }

        function toggleOrderDetails(btn) {
            playSfx('click');
            const detail = btn.parentElement.nextElementSibling;
            const isHidden = detail.style.display === 'none';
            detail.style.display = isHidden ? 'flex' : 'none';
            btn.innerHTML = isHidden ? 'إخفاء التفاصيل <i class="fa fa-chevron-up"></i>' : 'عرض التفاصيل <i class="fa fa-chevron-down"></i>';
        }

        function playSuccessSound() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                [{ f: 523.25, d: 0.15 }, { f: 659.25, d: 0.15 }, { f: 783.99, d: 0.15 }, { f: 1046.50, d: 0.40 }]
                .forEach((note, index) => {
                    const delay = index * 0.12;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
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

        function launchConfetti() {
            try {
                const canvas = document.createElement('canvas');
                canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999;';
                document.body.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                let width = canvas.width = window.innerWidth;
                let height = canvas.height = window.innerHeight;
                const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#fa0000'];
                const pieces = [];
                for (let i = 0; i < 150; i++) {
                    pieces.push({
                        x: Math.random() * width, y: Math.random() * height - height,
                        r: Math.random() * 6 + 4, d: Math.random() * height,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        tilt: Math.random() * 10 - 5, tiltAngleIncremental: Math.random() * 0.07 + 0.02, tiltAngle: 0
                    });
                }
                let animationFrame;
                function draw() {
                    ctx.clearRect(0, 0, width, height);
                    pieces.forEach(p => {
                        ctx.beginPath();
                        ctx.lineWidth = p.r;
                        ctx.strokeStyle = p.color;
                        ctx.moveTo(p.x, p.y);
                        const tiltAngle = 0.07 * Math.sin(p.tiltAngle);
                        ctx.lineTo(p.x + Math.cos(p.tilt) * p.r * 1.5, p.y + Math.sin(p.tilt) * p.r);
                        ctx.stroke();
                        p.tiltAngle += p.tiltAngleIncremental;
                        p.x += Math.sin(p.d) + 0.5;
                        p.y += p.d * 0.5 + 1;
                        p.d += 0.1;
                    });
                    animationFrame = requestAnimationFrame(draw);
                }
                draw();
                setTimeout(() => { cancelAnimationFrame(animationFrame); canvas.remove(); }, 3500);
            } catch (e) {}
        }

        async function finalizeCartCheckout(event) {
            if (event) event.preventDefault();
            const cart = getCart();
            if(cart.length === 0) return false;
            const form = document.querySelector('form[onsubmit*="finalizeCartCheckout"]');
            if (!form) return false;

            const tracking = {
                utm_source: localStorage.getItem('store_utm_source') || '',
                utm_campaign: localStorage.getItem('store_utm_campaign') || '',
                referrer: localStorage.getItem('store_referrer') || '',
                visitedPages: JSON.parse(localStorage.getItem('store_visited_pages') || '[]'),
                sessionCount: localStorage.getItem('store_session_count') || '1',
                firstVisit: localStorage.getItem('store_first_visit') || '',
            };
            const sessionStart = parseInt(sessionStorage.getItem('store_session_start') || Date.now());
            const diffMs = Date.now() - sessionStart;
            const minutes = Math.floor(diffMs / 60000);
            const seconds = Math.floor((diffMs % 60000) / 1000);
            tracking.timeSpent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds} دقيقه`;

            const distPhone = localStorage.getItem('distributorPhone');
            const distName = localStorage.getItem('distributorName');
            const distId = localStorage.getItem('distributorId');

            const customerPhone = document.getElementById('custPhone') ? document.getElementById('custPhone').value : '';
            const cleanPhone = customerPhone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                alert('يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام (مثلاً: 059xxxxxxx)');
                const phoneInput = document.getElementById('custPhone');
                if (phoneInput) { phoneInput.focus(); phoneInput.style.borderColor = '#ef4444'; }
                return false;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> جاري إرسال الطلب...';
            }

            try {
                let cities = [];
                try { cities = JSON.parse(localStorage.getItem('store_cities') || '[]'); } catch(e) {}
                if (cities.length === 0 && window.StoreInit && StoreInit.settings) {
                    cities = StoreInit.settings.cities || [];
                    if (typeof cities === 'string') try { cities = JSON.parse(cities); } catch(e) { cities = []; }
                }
                const checkedRegion = document.querySelector('input[name="custRegion"]:checked');
                const regionName = checkedRegion ? checkedRegion.value : 'الضفة';
                const matchedCity = cities.find(c => c.name === regionName);
                const shipping = matchedCity ? parseInt(matchedCity.price) : 20;

                const finalTotalVal = parseFloat(document.getElementById('finalTotalLabel').innerText || '0').toFixed(2);
                const discount = parseFloat(document.getElementById('discountLabel')?.innerText || '0');
                const couponCode = activeCoupon ? activeCoupon.code : '';

                const orderData = {
                    customer: {
                        name: document.getElementById('custName') ? document.getElementById('custName').value : '',
                        phone: customerPhone,
                        phone2: document.getElementById('custPhone2') ? document.getElementById('custPhone2').value : '',
                        address: document.getElementById('custAddress') ? document.getElementById('custAddress').value : '',
                        city: document.getElementById('custCityName') ? document.getElementById('custCityName').value : '',
                        region: regionName,
                        email: ''
                    },
                    items: cart.map(item => ({
                        id: item.id, name: item.name, price: item.price,
                        image: item.image || '', quantity: item.quantity
                    })),
                    total: parseFloat(finalTotalVal),
                    shippingCost: shipping,
                    discount: discount,
                    couponCode: couponCode,
                    notes: document.getElementById('custNotes') ? document.getElementById('custNotes').value : '',
                    isWholesale: !!(distPhone && distId),
                    distributorId: distId || null,
                    ...tracking
                };

                const result = await DB.createOrder(orderData);
                if (result) {
                    if (couponCode) {
                        DB.incrementCouponUsage(couponCode).catch(() => {});
                    }
                    playSuccessSound();
                    launchConfetti();
                    if (typeof window.trackStoreEvent === 'function') {
                        window.trackStoreEvent('Purchase', { total: finalTotalVal, orderId: result.id });
                    }
                    try {
                        const sessionId = localStorage.getItem('store_session_id');
                        if (sessionId) {
                            DB.supabase.from('abandoned').delete().eq('session_id', sessionId).catch(() => {});
                            localStorage.removeItem('store_session_id');
                        }
                    } catch(e) {}
                    const storePhone = String(window.storePhone || '970599000000');
                    const orderId = typeof result === 'string' ? result : (result.id || result);
                    const whatsappMsg = `مرحباً، لدي استفسار بخصوص طلبي رقم ${orderId} بقيمة ${finalTotalVal} ₪.`;
                    const whatsappLink = `https://wa.me/${storePhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;
                    localStorage.removeItem('cart');
                    if (document.getElementById('cart-count')) document.getElementById('cart-count').innerText = '0';
                    if (document.getElementById('floatingCartCount')) document.getElementById('floatingCartCount').innerText = '0';
                    const floatBar = document.getElementById('floatingCartBar');
                    if (floatBar) floatBar.style.display = 'none';
                    const modalBody = document.querySelector('#cartModal .modal-body');
                    if (modalBody) {
                        modalBody.innerHTML = `<div style="text-align:center; padding:35px 15px; background:#fff; border-radius:20px; direction:rtl;">
                            <div style="width:80px;height:80px;background:#dcfce7;color:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 20px;"><i class="fa fa-check"></i></div>
                            <h3 style="font-weight:900;margin-bottom:10px;font-size:22px;color:var(--dark);">تم استلام طلبك بنجاح! 🎉</h3>
                            <p style="color:#64748b;font-size:14px;margin-bottom:20px;line-height:1.6;">سنقوم بالتواصل معك قريباً لتأكيد الطلب وترتيب عملية التوصيل.</p>
                            <div style="background:#f8fafc;padding:15px;border-radius:12px;margin-bottom:20px;border:1px solid #e2e8f0;text-align:right;">
                                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:#64748b;"><span>رقم الطلب:</span><strong style="color:var(--dark);font-family:monospace;">${result}</strong></div>
                                <div style="display:flex;justify-content:space-between;font-size:13px;color:#64748b;"><span>المبلغ الإجمالي:</span><strong style="color:var(--primary);font-size:16px;font-weight:800;">${finalTotalVal} ₪</strong></div>
                            </div>
                            <a href="${whatsappLink}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:#25d366;color:white;border:none;border-radius:12px;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none;margin-bottom:20px;box-shadow:0 6px 15px rgba(37,211,102,0.25);"><i class="fab fa-whatsapp" style="font-size:20px;"></i> تواصل عبر الواتساب 💬</a>
                            <div style="display:flex;gap:10px;">
                                <button onclick="closeModal('cartModal');location.reload();" style="flex:1;padding:12px;background:var(--primary);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;">العودة للتسوق</button>
                                <button onclick="closeModal('cartModal');openModal('ordersModal')" style="flex:1;padding:12px;background:var(--gray-200);color:var(--dark);border:none;border-radius:10px;font-weight:700;cursor:pointer;">تتبع طلباتي</button>
                            </div>
                        </div>`;
                    }
                } else {
                    alert('حدث خطأ أثناء تقديم الطلب، يرجى المحاولة مرة أخرى.');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; }
                }
            } catch (err) {
                console.error("Checkout Error:", err);
                alert('حدث خطأ أثناء تقديم الطلب: ' + (err.message || 'يرجى المحاولة مرة أخرى'));
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnHtml; }
            }
            return false;
        }

        function renderWishlistModal() {
            let favs = getFavorites();
            const body = document.getElementById('wishlistBody');
            if(!body) return;
            
            // Self-heal legacy formats or incomplete objects
            favs = favs.map(item => {
                if (!item) return null;
                const itemId = typeof item === 'string' ? item : item.id;
                let itemName = typeof item === 'object' ? item.name : '';
                let itemPrice = typeof item === 'object' ? item.price : '';
                let itemImage = typeof item === 'object' ? item.image : '';
                let itemIsWholesale = (typeof item === 'object' ? item.isWholesale : false) || !!(window.wholesalePrices && window.wholesalePrices[itemId]);

                if (window.wholesalePrices && window.wholesalePrices[itemId]) {
                    itemPrice = parseFloat(window.wholesalePrices[itemId]);
                }

                if (!itemName && window.StoreInit && Array.isArray(window.StoreInit.products)) {
                    const p = window.StoreInit.products.find(prod => String(prod.id) === String(itemId));
                    if (p) {
                        itemName = p.name;
                        if (!window.wholesalePrices || !window.wholesalePrices[itemId]) {
                            itemPrice = p.price;
                        }
                        itemImage = p.image;
                    }
                }
                return {
                    id: itemId,
                    name: itemName || 'منتج',
                    price: itemPrice || 0,
                    image: itemImage || '',
                    isWholesale: itemIsWholesale
                };
            }).filter(Boolean);

            if(favs.length === 0) {
                body.innerHTML = '<div class="empty-state" style="padding:40px 0;"><i class="fa fa-heart" style="opacity:0.2;"></i><p>قائمة المفضلة فارغة</p></div>';
                return;
            }
             body.innerHTML = favs.map(item => `
                <div class="modal-item" style="display:flex; align-items:center;">
                    <a href="#?product=${item.id}" onclick="closeModal('wishlistModal')" style="display:flex; flex:1; align-items:center; gap:15px; text-decoration:none; color:inherit;">
                        <img src="${item.image}" style="width:60px; height:60px; border-radius:10px; object-fit:cover;">
                        <div class="modal-item-info">
                            <div class="modal-item-name" style="font-size:14px; font-weight:700;">${item.name}</div>
                            <div class="modal-item-price" style="font-size:14px; color:var(--primary); font-weight:800;">${item.price} ₪ ${item.isWholesale ? '<span style="font-size:10px; font-weight:bold; color:#10b981; background:#10b98115; padding:2px 5px; border-radius:4px; margin-right:4px; display:inline-block; vertical-align:middle;">جملة</span>' : ''}</div>
                        </div>
                    </a>
                    <div style="display:flex; gap:10px;">
                        <button class="cart-icon-btn" onclick="addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.image}'); closeModal('wishlistModal');"><i class="fa fa-shopping-bag"></i></button>
                        <button style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:16px;" onclick="toggleFavorite('${item.id}'); renderWishlistModal();"><i class="fa fa-trash-alt"></i></button>
                    </div>
                </div>
            `).join('');
        }

        async function searchOrders() {
            const phone = document.getElementById('orderPhoneInput').value;
            if(!phone) return alert('يرجى إدخل رقم الجوال');
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) return alert('يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام');
            const body = document.getElementById('ordersResults');
            body.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa fa-spinner fa-spin"></i> جاري البحث...</div>';
            try {
                const orders = await DB.getOrdersByPhone(phone);
                if(orders.length === 0) {
                    body.innerHTML = '<div class="empty-state"><p>ليس هناك طلبات سابقة للرقم المدخل آخر 14 يوم</p></div>';
                } else {
                    body.innerHTML = orders.map(o => `
                        <div style="background:var(--gray-100); border-radius:15px; padding:20px; margin-bottom:15px; border:1px solid var(--gray-200);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                                <div><strong style="display:block; font-size:16px;">طلب #${o.id}</strong><span style="font-size:12px; color:var(--gray-400);">${new Date(o.created_at || o.date).toLocaleDateString('ar-EG')}</span></div>
                                <span class="badge" style="position:static; background:var(--primary-light); color:var(--primary); font-size:12px;">${o.status || 'قيد المراجعة'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-weight:800; color:var(--primary);">الإجمالي: ${o.total} ₪</div>
                                <button onclick="toggleOrderDetails(this)" style="background:var(--white); border:1px solid var(--gray-200); padding:5px 15px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">عرض التفاصيل <i class="fa fa-chevron-down"></i></button>
                            </div>
                            <div class="order-items-detail" style="display:none; margin-top:15px; border-top:1px dashed var(--gray-200); padding-top:15px; gap:12px; flex-direction:column;">
                                ${(o.items || []).map(item => `
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <img src="${item.image || ''}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                                        <div style="flex:1;"><div style="font-size:13px; font-weight:700;">${item.name}</div><div style="font-size:11px; color:var(--gray-600);">الكمية: ${item.quantity} | السعر: ${item.price} ₪</div></div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('');
                }
            } catch(e) { body.innerHTML = '<div class="empty-state"><p>حدث خطأ أثناء البحث</p></div>'; }
        }

// ─── Script Block #2: Distributor Logic ───

        function forgotDistPassword() {
            const phone = document.getElementById('distLoginPhone').value;
            const storePhone = window.storePhone || '';
            let msg = 'مرحباً، أنا مسجل كموزع ونسيت كلمة المرور الخاصة بي، أرجو إعادة تعيينها.';
            if (!phone) {
                const phoneInput = document.getElementById('distLoginPhone');
                phoneInput.style.borderColor = '#ef4444';
                phoneInput.focus();
                const errBox = document.getElementById('distLoginErrorMsg');
                errBox.innerText = 'يرجى كتابة رقم هاتفك في الخانة المحددة باللون الأحمر أولاً.';
                errBox.style.display = 'block';
                return;
            }
            msg += '\nرقم هاتفي المسجل هو: ' + phone;
            if (!storePhone) { alert('يرجى من الإدارة إضافة رقم واتساب في الإعدادات أولاً'); return; }
            window.open('https://wa.me/' + storePhone + '?text=' + encodeURIComponent(msg), '_blank');
        }

        function switchDistTab(tab) {
            document.getElementById('distLoginForm').style.display = tab === 'login' ? 'block' : 'none';
            document.getElementById('distRegForm').style.display = tab === 'register' ? 'block' : 'none';
            document.getElementById('distRegSuccess').style.display = 'none';
            document.getElementById('distPendingUi').style.display = 'none';
            document.getElementById('distLoginErrorMsg').style.display = 'none';
            document.getElementById('distRegErrorMsg').style.display = 'none';
            document.getElementById('distLoginTabBtn').style.background = tab === 'login' ? 'var(--white)' : 'transparent';
            document.getElementById('distLoginTabBtn').style.boxShadow = tab === 'login' ? 'var(--shadow-sm)' : 'none';
            document.getElementById('distRegTabBtn').style.background = tab === 'register' ? 'var(--white)' : 'transparent';
            document.getElementById('distRegTabBtn').style.boxShadow = tab === 'register' ? 'var(--shadow-sm)' : 'none';
        }

        async function distLogin() {
            const phone = document.getElementById('distLoginPhone').value;
            const password = document.getElementById('distLoginPassword').value;
            if(!phone || !password) return showToast('يرجى إدخال رقم الهاتف وكلمة المرور');
            try {
                // 1) Check admin first (before distributor lookup)
                const { data: adminPhoneRow } = await DB.supabase.from('settings').select('value').eq('key','adminPhone').single();
                const { data: adminPassRow } = await DB.supabase.from('settings').select('value').eq('key','adminPass').single();
                const adminPhone = String(adminPhoneRow?.value || '').replace(/"/g,'');
                const adminPass = String(adminPassRow?.value || '').replace(/"/g,'');
                if (adminPhone && phone === adminPhone && password === adminPass) {
                    localStorage.setItem('admin_logged', 'true');
                    localStorage.removeItem('distributorPhone');
                    localStorage.removeItem('distributorName');
                    localStorage.removeItem('distributorId');
                    localStorage.removeItem('distributorCity');
                    localStorage.removeItem('distributorAddress');
                    if (typeof closeModal === 'function') closeModal('distributorModal');
                    showAdminDashboard();
                    updateProfileDropdown();
                    return;
                }

                // 2) Normal distributor login
                const { data: distributors } = await DB.supabase.from('distributors').select('*').eq('phone', phone);
                const dist = distributors && distributors[0];
                if (!dist) {
                    const errEl = document.getElementById('distLoginErrorMsg');
                    errEl.innerText = 'رقم الهاتف غير مسجل في نظام الموزعين';
                    errEl.style.display = 'block';
                    return;
                }
                if (dist.status === 'pending') {
                    document.getElementById('distLoginForm').style.display = 'none';
                    document.getElementById('distPendingUi').style.display = 'block';
                    return;
                }
                if (dist.status === 'rejected') {
                    const errEl = document.getElementById('distLoginErrorMsg');
                    errEl.innerText = 'تم رفض طلب الانضمام من الإدارة';
                    errEl.style.display = 'block';
                    return;
                }
                if (dist.password !== password) {
                    const errEl = document.getElementById('distLoginErrorMsg');
                    errEl.innerText = 'كلمة المرور غير صحيحة';
                    errEl.style.display = 'block';
                    return;
                }
                localStorage.setItem('distributorPhone', phone);
                localStorage.setItem('distributorName', dist.name);
                localStorage.setItem('distributorId', dist.id);
                localStorage.setItem('distributorCity', dist.city || '');
                localStorage.setItem('distributorAddress', dist.address || '');
                showToast('تم تسجيل الدخول بنجاح');
                if (typeof closeModal === 'function') closeModal('distributorModal');
                checkDistributorSession();
                if (window.togglePublicStore) window.togglePublicStore(false);
            } catch(e) { showToast('حدث خطأ بالاتصال'); }
        }

        async function distRegister() {
            const name = document.getElementById('distRegName').value;
            const phone = document.getElementById('distRegPhone').value;
            const password = document.getElementById('distRegPassword').value;
            const city = document.getElementById('distRegCity').value;
            const address = document.getElementById('distRegAddress').value;
            if(!name || !phone || !password || !city || !address) return showToast('يرجى إكمال جميع الحقول المطلوبة (*)');
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                const errEl = document.getElementById('distRegErrorMsg');
                errEl.innerText = 'يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام';
                errEl.style.display = 'block';
                return;
            }
            try {
                const { data: existing } = await DB.supabase.from('distributors').select('id').eq('phone', phone);
                if (existing && existing.length > 0) {
                    const errEl = document.getElementById('distRegErrorMsg');
                    errEl.innerText = 'رقم الهاتف مسجل بالفعل';
                    errEl.style.display = 'block';
                    return;
                }
                await DB.supabase.from('distributors').insert({
                    id: 'DIST-' + Date.now(),
                    name, phone, password, city, address, status: 'pending'
                });
                document.getElementById('distRegForm').style.display = 'none';
                document.getElementById('distRegSuccess').style.display = 'block';
            } catch(e) { showToast('حدث خطأ بالاتصال'); }
        }

        function distLogout() {
            localStorage.removeItem('distributorPhone');
            localStorage.removeItem('distributorName');
            localStorage.removeItem('distributorId');
            localStorage.removeItem('distributorCity');
            localStorage.removeItem('distributorAddress');
            localStorage.removeItem('distributor_auth');
            localStorage.removeItem('admin_logged');
            location.reload();
        }

        window.switchDistSubTab = function(tab) {
            const productsSec = document.getElementById('distSubSecProducts');
            const ordersSec = document.getElementById('distSubSecOrders');
            const productsBtn = document.getElementById('subTabBtnProducts');
            const ordersBtn = document.getElementById('subTabBtnOrders');
            if(tab === 'products') {
                productsSec.style.display = 'block';
                ordersSec.style.display = 'none';
                productsBtn.style.background = 'var(--primary)';
                productsBtn.style.color = 'white';
                ordersBtn.style.background = 'transparent';
                ordersBtn.style.color = 'var(--dark)';
            } else {
                productsSec.style.display = 'none';
                ordersSec.style.display = 'block';
                productsBtn.style.background = 'transparent';
                productsBtn.style.color = 'var(--dark)';
                ordersBtn.style.background = 'var(--primary)';
                ordersBtn.style.color = 'white';
                loadDistMyOrders();
            }
        }

        async function loadDistMyOrders() {
            const phone = localStorage.getItem('distributorPhone');
            const id = localStorage.getItem('distributorId');
            if(!phone) return;
            const tbody = document.getElementById('distMyOrdersTable');
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل طلباتك...</td></tr>';
            try {
                const { data: orders } = await DB.supabase.from('orders').select('*');
                const myOrders = (orders || []).filter(o => (o.customer && o.customer.phone === phone) || o.distributor_id === id);
                if(myOrders.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--gray-400); font-size:14px;">لم تقم بإجراء أي طلبات جملة حتى الآن</td></tr>';
                    return;
                }
                tbody.innerHTML = myOrders.map(o => `
                    <tr style="border-bottom:1px solid var(--gray-200);">
                        <td style="padding:15px; font-weight:800; color:var(--primary);">#${o.id}</td>
                        <td style="padding:15px; font-size:13px; color:var(--gray-600);">${new Date(o.created_at || o.date).toLocaleDateString('ar-EG')}</td>
                        <td style="padding:15px;"><div style="font-size:13px; font-weight:700;">${(o.items || []).map(i => i.name).join('، ')}</div></td>
                        <td style="padding:15px; font-weight:800; font-size:16px;">${parseFloat(o.total).toFixed(2)} ₪</td>
                        <td style="padding:15px;"><span style="padding:5px 12px; border-radius:30px; font-size:12px; font-weight:700; background:var(--gray-100); border:1px solid var(--gray-200); color:var(--primary);">${o.status || 'جديد'}</span></td>
                    </tr>
                `).join('');
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#ef4444;">فشل تحميل الطلبات</td></tr>';
            }
        }

        async function loadDistWholesaleProducts(phone) {
            const grid = document.getElementById('distWholesaleGrid');
            if(!grid) return;
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
            try {
                const { data: products } = await DB.supabase.from('products').select('*');
                const { data: wholesalePrices } = await DB.supabase.from('wholesale_prices').select('*').eq('phone', phone);
                const pricesMap = {};
                (products || []).forEach(p => {
                    if (p.wholesale_price !== undefined && p.wholesale_price !== null && parseFloat(p.wholesale_price) > 0) {
                        pricesMap[p.id] = p.wholesale_price;
                    }
                });
                (wholesalePrices || []).forEach(wp => {
                    if (wp.wholesale_price !== undefined && wp.wholesale_price !== null && parseFloat(wp.wholesale_price) > 0) {
                        pricesMap[wp.product_id] = wp.wholesale_price;
                    }
                });
                const wholesaleItems = (products || []).filter(p => pricesMap[p.id]);
                if(wholesaleItems.length === 0) {
                    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; border:1px dashed var(--gray-400); border-radius:15px; color:var(--gray-600);">لا توجد منتجات جملة مخصصة لك حالياً.</div>';
                    return;
                }
                const currency = (window.StoreInit && StoreInit.settings) ? (StoreInit.settings.currency || '₪') : '₪';
                grid.innerHTML = wholesaleItems.map(p => {
                    const price = pricesMap[p.id];
                    return `
                        <div class="product-card" style="background:#fff; border-radius:15px; border:1px solid var(--gray-200); overflow:hidden; display:flex; flex-direction:column;">
                            <img src="${p.image || ''}" style="width:100%; height:180px; object-fit:cover;">
                            <div style="padding:15px; flex:1; display:flex; flex-direction:column;">
                                <h3 style="font-size:14px; font-weight:800; margin-bottom:10px; color:var(--dark);">${p.name}</h3>
                                <div style="margin-top:auto; display:flex; justify-content:space-between; align-items:center;">
                                    <div><span style="font-size:12px; color:var(--gray-400); text-decoration:line-through;">${currency}${p.price}</span><br><span style="font-size:18px; font-weight:900; color:var(--primary);">${currency}${price}</span></div>
                                    <button onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${price}, '${(p.image || '').replace(/'/g, "\\'")}')" style="background:var(--primary); color:white; border:none; padding:8px 15px; border-radius:8px; font-weight:800; cursor:pointer;"><i class="fa fa-cart-plus"></i></button>
                                </div>
                            </div>
                        </div>`;
                }).join('');
            } catch(e) {
                grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#ef4444;">فشل تحميل المنتجات</div>';
            }
        }

        function showAdminDashboard() {
            document.getElementById('distLoginForm').style.display = 'none';
            document.getElementById('distPendingUi').style.display = 'none';
            document.getElementById('distLoginErrorMsg').style.display = 'none';
            const section = document.getElementById('distDashboardSection');
            if (section) {
                section.style.display = 'block';
                const nameEl = document.getElementById('distWelcomeName');
                if (nameEl) nameEl.innerText = 'أهلاً بك، المدير';
                // Inject admin button
                if (!document.getElementById('adminDashBtn')) {
                    const adminBtn = document.createElement('a');
                    adminBtn.id = 'adminDashBtn';
                    adminBtn.href = 'dashboard.html';
                    adminBtn.innerHTML = '<i class="fas fa-shield-halved"></i> لوحة التحكم';
                    adminBtn.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:10px;font-weight:800;text-decoration:none;margin:15px;font-size:15px;';
                    section.prepend(adminBtn);
                }
            }
        }

        function updateProfileDropdown() {
            const wrap = document.getElementById('distProfileWrap');
            const items = document.getElementById('profileDropdownItems');
            const mobileIcon = document.getElementById('distProfileIconMobile');
            if (!wrap || !items) return;
            const isAdmin = localStorage.getItem('admin_logged') === 'true';
            const isDist = localStorage.getItem('distributorPhone') && localStorage.getItem('distributorId');
            const show = isDist || isAdmin;
            wrap.style.display = show ? '' : 'none';
            if (mobileIcon) mobileIcon.style.display = show ? '' : 'none';
            let html = '';
            if (isDist) {
                html += `<a href="javascript:void(0)" onclick="window.openDistributorPortal();closeProfileDropdown()"><i class="fa fa-user-tie"></i> الملف الشخصي</a>`;
            }
            if (isAdmin) {
                html += `<a href="dashboard.html"><i class="fa fa-shield-halved"></i> لوحة التحكم</a>`;
            }
            if (isDist || isAdmin) {
                html += `<div class="dropdown-divider"></div><a href="javascript:void(0)" onclick="distLogout();closeProfileDropdown()" style="color:#ef4444;"><i class="fa fa-sign-out-alt"></i> خروج</a>`;
            }
            if (!isDist && !isAdmin) {
                html += `<a href="javascript:void(0)" onclick="openModal('distributorModal');closeProfileDropdown()"><i class="fa fa-sign-in-alt"></i> تسجيل الدخول</a>`;
            }
            items.innerHTML = html;
        }

        function toggleProfileDropdown(e) {
            e.stopPropagation();
            const dd = document.getElementById('profileDropdown');
            if (!dd) return;
            updateProfileDropdown();
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        }

        function closeProfileDropdown() {
            const dd = document.getElementById('profileDropdown');
            if (dd) dd.style.display = 'none';
        }

        document.addEventListener('click', (e) => {
            const dd = document.getElementById('profileDropdown');
            const wrap = document.getElementById('distProfileWrap');
            if (dd && wrap && !wrap.contains(e.target)) dd.style.display = 'none';
        });

        async function checkDistributorSession(showDashboard = true) {
            console.log('🔍 checkDistributorSession fired. admin_logged:', localStorage.getItem('admin_logged'), 'distPhone:', localStorage.getItem('distributorPhone'), 'distId:', localStorage.getItem('distributorId'));
            updateProfileDropdown();
            // Check admin session first
            if (localStorage.getItem('admin_logged') === 'true') {
                if (showDashboard) showAdminDashboard();
                return;
            }
            const phone = localStorage.getItem('distributorPhone');
            const id = localStorage.getItem('distributorId');
            if (!phone || !id) return;
            // Best-effort: apply wholesale prices if available (non-blocking, no UI change)
            try {
                let pricesMap = window.wholesalePrices;
                if (!pricesMap) {
                    const { data: dist } = await DB.supabase.from('distributors').select('id, status').eq('id', id).single();
                    if (dist && dist.status === 'approved') {
                        pricesMap = {};
                        const { data: products } = await DB.supabase.from('products').select('id, wholesale_price');
                        (products || []).forEach(p => {
                            if (p.wholesale_price !== undefined && p.wholesale_price !== null && parseFloat(p.wholesale_price) > 0) {
                                pricesMap[p.id] = p.wholesale_price;
                            }
                        });
                        const { data: wholesalePrices } = await DB.supabase.from('wholesale_prices').select('*').eq('phone', phone);
                        (wholesalePrices || []).forEach(wp => {
                            if (wp.wholesale_price !== undefined && wp.wholesale_price !== null && parseFloat(wp.wholesale_price) > 0) {
                                pricesMap[wp.product_id] = wp.wholesale_price;
                            }
                        });
                        window.wholesalePrices = pricesMap;
                    }
                }
                 if (pricesMap && Object.keys(pricesMap).length > 0) {
                    const priceEls = document.querySelectorAll('.product-price .current-price');
                    priceEls.forEach(el => {
                        const card = el.closest('.product-card');
                        if (card) {
                            const pid = card.getAttribute('data-product-id') || card.querySelector('[onclick*="addToCart"]')?.getAttribute('onclick')?.match(/'(\d+)'/)?.[1];
                            if (pid && pricesMap[pid]) {
                                const priceContainer = el.closest('.product-price');
                                if (priceContainer && !priceContainer.getAttribute('data-wholesale-applied')) {
                                    const oldPriceVal = parseFloat(el.innerText.replace(/[^0-9.]/g, ''));
                                    if (!isNaN(oldPriceVal)) {
                                        const currency = el.innerText.replace(/[0-9. \t\r\n]/g, '') || '₪';
                                        priceContainer.setAttribute('data-wholesale-applied', 'true');
                                        priceContainer.innerHTML = `
                                            <span class="current-price" style="color:#10b981; font-weight:800; font-size:14px; display:inline-flex; align-items:center; gap:3px;">
                                                <i class="fas fa-tags" style="font-size:10px;"></i> جملة: ${currency}${parseFloat(pricesMap[pid]).toFixed(2)}
                                            </span>
                                            <span class="old-price" style="text-decoration:line-through; color:var(--gray-400); font-size:11px; font-weight:700;">
                                                ${currency}${oldPriceVal.toFixed(2)}
                                            </span>
                                        `;
                                    }
                                }
                            }
                        }
                    });
                }
            } catch(e) { console.warn('Wholesale price load skipped:', e.message); }
            // Only show the dashboard UI when explicitly requested
            if (!showDashboard) return;
            const section = document.getElementById('distDashboardSection');
            if (section) {
                section.style.display = 'block';
                const nameEl = document.getElementById('distWelcomeName');
                if (nameEl) nameEl.innerText = `أهلاً بك، ${localStorage.getItem('distributorName') || ''}`;
                loadDistWholesaleProducts(phone);
            }
        }

        // Exposed so the store can re-apply wholesale pricing after rendering products
        window.applyDistributorPricing = function() {
            checkDistributorSession(false);
            if (typeof updateFavUI === 'function') updateFavUI();
        };

        // Open the distributor portal: show dashboard if logged in, else login modal
        window.openDistributorPortal = function() {
            const isAdmin = localStorage.getItem('admin_logged') === 'true';
            const phone = localStorage.getItem('distributorPhone');
            const id = localStorage.getItem('distributorId');
            if (isAdmin || (phone && id)) {
                checkDistributorSession(true);
                if (window.togglePublicStore) window.togglePublicStore(false);
                const sec = document.getElementById('distDashboardSection');
                if (sec) sec.scrollIntoView({ behavior: 'smooth' });
            } else {
                openModal('distributorModal');
            }
        };

        window.togglePublicStore = function(showPublic) {
            const distSection = document.getElementById('distDashboardSection');
            const publicSection = document.getElementById('publicMarketingContent');
            const returnBtn = document.getElementById('btnReturnToDash');
            if (showPublic) {
                if (distSection) distSection.style.display = 'none';
                if (publicSection) publicSection.style.display = 'block';
                if (returnBtn) returnBtn.style.display = 'flex';
            } else {
                if (distSection) distSection.style.display = 'block';
                if (publicSection) publicSection.style.display = 'none';
                if (returnBtn) returnBtn.style.display = 'none';
            }
        };

// ─── Floating Cart Bar Logic ───
        function updateFloatingCartBar() {
            const cart = getCart();
            const bar = document.getElementById('floatingCartBar');
            if (!bar) return;
            if (cart.length === 0) {
                bar.classList.remove('visible');
                setTimeout(() => {
                    if (!bar.classList.contains('visible')) bar.style.display = 'none';
                }, 300);
                return;
            }
            bar.style.display = 'flex';
            setTimeout(() => {
                bar.classList.add('visible');
            }, 50);
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            document.getElementById('floatingCartCount').innerText = totalItems;
            document.getElementById('floatingCartTotal').innerText = totalPrice.toFixed(2);
        }
        const _origSaveCart = window.saveCart;
        window.saveCart = function(cart) {
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartUI();
            updateFloatingCartBar();
        };

// ─── Phone Validation on CustPhone ───
        document.addEventListener('DOMContentLoaded', () => {
            const phoneInput = document.getElementById('custPhone');
            const msgDiv = document.getElementById('phone-validation-msg');
            if (phoneInput && msgDiv) {
                phoneInput.addEventListener('input', function() {
                    const val = this.value.replace(/\D/g, '');
                    if (val.length > 0 && val.length !== 10) {
                        this.style.borderColor = '#ef4444';
                        msgDiv.style.display = 'block';
                    } else {
                        this.style.borderColor = val.length === 10 ? '#10b981' : 'var(--gray-200)';
                        msgDiv.style.display = 'none';
                    }
                });
            }
            if (document.getElementById('cartStepItems')) renderCartModal();
            // Apply wholesale pricing for logged-in distributors (does not show dashboard)
            checkDistributorSession(false);
            updateFloatingCartBar();
        });

// ─── SPA Navigation (simplified for static - just reload) ───
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            const href = link.getAttribute('href');
            if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.includes('?app=')) return;
        });

// ─── Back to Top & Scroll Logic ───
        window.addEventListener('scroll', () => {
            const btn = document.getElementById('backToTop');
            if (btn) {
                if (window.scrollY > 300) {
                    btn.classList.add('visible');
                } else {
                    btn.classList.remove('visible');
                }
            }
        }, { passive: true });

// ─── FCM Registration ───
    async function initFCM() {
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
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            const messaging = firebase.messaging();
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const swPath = window.location.pathname.includes('/r/') ? '/r/firebase-messaging-sw.js' : '/firebase-messaging-sw.js';
                const scopePath = window.location.pathname.includes('/r/') ? '/r/firebase-cloud-messaging-push-scope' : '/firebase-cloud-messaging-push-scope';
                const reg = await navigator.serviceWorker.register(swPath, { scope: scopePath });
                const token = await messaging.getToken({ serviceWorkerRegistration: reg });
                if (token) {
                    await DB.supabase.from('fcm_tokens').upsert({ token, role: 'customer', created_at: new Date().toISOString() }, { onConflict: 'token' });
                    localStorage.setItem('fcm_registered', 'true');
                    localStorage.setItem('fcm_token', token);
                }
            }
        } catch (e) { console.warn('FCM Init failed:', e.message); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFCM);
    else initFCM();

// ─── Reels Check ───
    async function checkNewReels() {
        try {
            const { data: reels } = await DB.supabase.from('reels').select('*');
            const notification = document.getElementById('reels-notification');
            const toast = document.getElementById('newReelFloatingToast');
            if (!reels || reels.length === 0) {
                if (notification) notification.style.display = 'none';
                if (toast) { toast.classList.remove('show'); toast.style.display = 'none'; }
                return;
            }
            const seenReels = JSON.parse(localStorage.getItem('seenReels') || '[]');
            const reelIds = reels.map(r => r.id);
            const hasNew = reelIds.some(id => !seenReels.includes(id));
            const urlParams = new URLSearchParams(window.location.search);
            const isReelsPage = urlParams.get('app') === 'reels' || window.location.hash.includes('app=reels');
            if (hasNew) {
                if (notification) notification.style.display = 'block';
                if (toast && !isReelsPage) {
                    toast.style.display = 'flex';
                    setTimeout(() => { toast.classList.add('show'); setTimeout(() => window.dismissNewReelToast(), 7000); }, 150);
                }
            } else {
                if (notification) notification.style.display = 'none';
                if (toast) { toast.classList.remove('show'); setTimeout(() => toast.style.display = 'none', 500); }
            }
            if (isReelsPage) {
                localStorage.setItem('seenReels', JSON.stringify(reelIds));
                if (notification) notification.style.display = 'none';
                if (toast) { toast.classList.remove('show'); toast.style.display = 'none'; }
            }
        } catch (e) { console.error('Error checking new reels:', e); }
    }
    window.dismissNewReelToast = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const toast = document.getElementById('newReelFloatingToast');
        if (toast) { toast.classList.remove('show'); setTimeout(() => toast.style.display = 'none', 500); }
        // Mark all current reels as seen so the toast doesn't reappear on next load
        DB.getReels().then(reels => {
            if (reels && reels.length) {
                localStorage.setItem('seenReels', JSON.stringify(reels.map(r => r.id)));
            }
        }).catch(() => {});
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkNewReels);
    else checkNewReels();

    // Show profile icon if distributor is already logged in
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { if (typeof updateProfileDropdown === 'function') updateProfileDropdown(); });
    else if (typeof updateProfileDropdown === 'function') updateProfileDropdown();

    function scrollReels(direction) {
        const container = document.getElementById('reels-container');
        if (container) container.scrollBy({ left: direction * 300 * -1, behavior: 'smooth' });
    }
    function unmuteAllVideos() {
        document.querySelectorAll('.reel-video-player').forEach(v => { v.muted = false; });
        document.querySelectorAll('.unmute-overlay').forEach(o => o.style.display = 'none');
    }
    function scrollReel(dir) {
        const container = document.querySelector('.reels-page-container');
        if (container) container.scrollBy({ top: dir * window.innerHeight, behavior: 'smooth' });
    }
    function shareReel(reelId) {
        const modal = document.getElementById('reelShareModal');
        const sheet = document.getElementById('reelShareSheet');
        if (!modal || !sheet) return;
        const shareUrl = `${window.location.origin}/?app=reels${reelId ? '#reel-' + reelId : ''}`;
        const encodedUrl = encodeURIComponent(shareUrl);
        const title = encodeURIComponent('شاهد هذا الريل المميز! 🎬');
        const urlText = document.getElementById('reelShareUrlText');
        if (urlText) urlText.textContent = shareUrl;
        const wa = document.getElementById('shareWA');
        const tg = document.getElementById('shareTG');
        const xBtn = document.getElementById('shareX');
        const fb = document.getElementById('shareFB');
        if (wa) wa.href = `https://wa.me/?text=${title}%20${encodedUrl}`;
        if (tg) tg.href = `https://t.me/share/url?url=${encodedUrl}&text=${title}`;
        if (xBtn) xBtn.href = `https://twitter.com/intent/tweet?text=${title}&url=${encodedUrl}`;
        if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        modal._shareUrl = shareUrl;
        modal.style.display = 'flex';
        setTimeout(() => { sheet.style.transform = 'translateY(0)'; }, 30);
    }
    window.closeReelShare = function() {
        const modal = document.getElementById('reelShareModal');
        const sheet = document.getElementById('reelShareSheet');
        if (!modal || !sheet) return;
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => { modal.style.display = 'none'; }, 380);
    };
    window.copyReelLink = function() {
        const modal = document.getElementById('reelShareModal');
        const label = document.getElementById('copyBtnLabel');
        const btn = document.getElementById('copyReelLinkBtn');
        const url = modal?._shareUrl || window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            if (label) label.textContent = '✓ تم النسخ!';
            if (btn) btn.style.background = 'rgba(34,197,94,0.2)';
            setTimeout(() => { if (label) label.textContent = 'نسخ الرابط'; if (btn) btn.style.background = 'rgba(255,255,255,0.08)'; }, 2000);
        });
    };
    function toggleReelLike(id) {
        const btn = event ? event.currentTarget : null;
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (!icon) return;
        icon.classList.toggle('fa-solid');
        icon.style.color = icon.classList.contains('fa-solid') ? '#ef4444' : '#fff';
        if (icon.classList.contains('fa-solid')) {
            icon.style.transform = 'scale(1.3)';
            setTimeout(() => { icon.style.transform = 'scale(1)'; }, 200);
        }
    }
    function initReelsPage() {
        const container = document.querySelector('.reels-page-container');
        if (!container) return;
        const videos = document.querySelectorAll('.reel-video-player');
        const handleFirstInteraction = () => { unmuteAllVideos(); document.removeEventListener('click', handleFirstInteraction, true); document.removeEventListener('touchstart', handleFirstInteraction, true); };
        document.addEventListener('click', handleFirstInteraction, true);
        document.addEventListener('touchstart', handleFirstInteraction, true);
        if (window.location.hash) {
            const targetEl = document.getElementById(window.location.hash.substring(1));
            if (targetEl) targetEl.scrollIntoView();
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                const section = video.parentElement;
                const productCard = section.querySelector('.reel-product-card');
                if (entry.isIntersecting) {
                    video.play().catch(e => console.warn('Auto-play blocked'));
                    const indicator = section.querySelector('.play-pause-indicator');
                    if (indicator) { indicator.style.display = 'none'; indicator.style.opacity = '0'; }
                    if (productCard) {
                        if (video.cardTimeout) clearTimeout(video.cardTimeout);
                        video.cardTimeout = setTimeout(() => { if (video.parentElement && video.currentTime > 0) productCard.classList.add('show'); }, 1000);
                    }
                } else {
                    video.pause(); video.currentTime = 0; video.loopCount = 0;
                    if (productCard) productCard.classList.remove('show');
                    const scrollIndicator = section.querySelector('.reels-scroll-indicator');
                    if (scrollIndicator) scrollIndicator.classList.remove('show');
                    if (video.cardTimeout) clearTimeout(video.cardTimeout);
                }
            });
        }, { threshold: 0.6 });
        videos.forEach(v => {
            v.muted = true;
            v.setAttribute('playsinline', '');
            v.loopCount = 0;
            v.addEventListener('ended', () => {
                v.loopCount++;
                v.play().catch(e => console.warn('Manual loop play blocked'));
                if (v.loopCount >= 2) {
                    const section = v.parentElement;
                    let indicator = section.querySelector('.reels-scroll-indicator');
                    if (!indicator) {
                        indicator = document.createElement('div');
                        indicator.className = 'reels-scroll-indicator';
                        indicator.innerHTML = '<div class="scroll-mouse"><div class="scroll-wheel"></div></div><div class="scroll-text">اسحب لأسفل للمزيد</div>';
                        section.appendChild(indicator);
                    }
                    setTimeout(() => indicator.classList.add('show'), 100);
                    setTimeout(() => indicator.classList.remove('show'), 5000);
                }
            });
            observer.observe(v);
            const section = v.parentElement;
            section.addEventListener('click', (e) => {
                if (e.target.closest('.reel-product-card') || e.target.closest('.reel-side-actions') || e.target.closest('.unmute-overlay') || e.target.closest('.reel-back-btn') || e.target.closest('.reels-navigation')) return;
                const indicator = section.querySelector('.play-pause-indicator');
                if (v.paused) {
                    v.play();
                    if (indicator) {
                        indicator.innerHTML = '<i class="fa fa-play"></i>';
                        indicator.style.display = 'flex'; indicator.style.opacity = '1';
                        indicator.style.transform = 'translate(-50%, -50%) scale(1.5)';
                        setTimeout(() => { indicator.style.opacity = '0'; indicator.style.transform = 'translate(-50%, -50%) scale(1)'; setTimeout(() => indicator.style.display = 'none', 300); }, 400);
                    }
                } else {
                    v.pause();
                    if (indicator) {
                        indicator.innerHTML = '<i class="fa fa-play"></i>';
                        indicator.style.display = 'flex'; indicator.style.opacity = '1';
                        indicator.style.transform = 'translate(-50%, -50%) scale(1)';
                    }
                }
            });
        });
        setTimeout(() => { if (videos[0]) videos[0].play().catch(e => {}); }, 500);
    }

    window.scrollReels = scrollReels;
    window.unmuteAllVideos = unmuteAllVideos;
    window.scrollReel = scrollReel;
    window.shareReel = shareReel;
    window.toggleReelLike = toggleReelLike;
    window.initReelsPage = initReelsPage;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initReelsPage);
    else initReelsPage();
