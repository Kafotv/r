// Store Front Main JS
// Split from views/store.html to maximize performance, clean markup, and enable browser caching.

// ─── Script Block #1 ───

        // ── Sound Effects (Web Audio API) ─────────────────────────────────────
        function playSfx(type) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                if (type === 'add') {
                    // Two-tone upward ding - satisfying add to cart
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
                    // Soft short beep for quantity change
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
                    // Descending swoosh for removal
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
        // ─────────────────────────────────────────────────────────────────────


        // Hero Slider Logic
        function showSlide(index, sliderEl) {
            if (!sliderEl) return;
            const slides = sliderEl.querySelectorAll('.slide');
            const dots = sliderEl.querySelectorAll('.dot');
            if (!slides.length) return;
            
            let current = index;
            if(current >= slides.length) current = 0;
            if(current < 0) current = slides.length - 1;
            
            // Store current index on the element
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
                
                // Clear existing if any
                if (slider.autoSlideInterval) clearInterval(slider.autoSlideInterval);
                
                slider.autoSlideInterval = setInterval(() => {
                    let current = parseInt(slider.getAttribute('data-current') || 0);
                    showSlide(current + 1, slider);
                }, speed * 1000);
            });
        }

        // Initialize on load
        window.addEventListener('load', () => {
            startAutoSlide();
        });

        function goToSlide(index, el) { 
            const slider = el.closest('.hero-slider') || document.getElementById('heroSlider');
            if (!slider) return;
            showSlide(index, slider);
            startAutoSlide(); // Reset all timers or just this one? Resetting all is safer for simple logic
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

        function openQuickAdd(id, name, price, image, colorsStr, sizesStr) {
            const colors = colorsStr ? colorsStr.split(',') : [];
            const sizes = sizesStr ? sizesStr.split(',') : [];

            if(colors.length === 0 && sizes.length === 0) {
                addToCart(id, name, price, image);
                openModal('cartModal');
                return;
            }

            let html = `
                <div style="text-align:center; margin-bottom:20px;">
                    <img src="${image}" style="width:100px; height:100px; border-radius:10px; object-fit:cover; margin-bottom:10px;">
                    <h4 style="font-weight:800;">${name}</h4>
                    <p style="color:var(--primary); font-weight:800;">${price} ₪</p>
                </div>
            `;

            if(colors.length > 0) {
                html += `
                    <div class="qa-option-group" style="margin-bottom:20px;">
                        <label style="display:block; font-weight:800; font-size:12px; margin-bottom:10px;">اختر اللون:</label>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;" id="qaColors">
                            ${colors.map((c, i) => `<span class="option-pill" onclick="selectQAPill(this)" data-val="${c}">${c}</span>`).join('')}
                        </div>
                        <div class="qa-error-msg" style="color:#ef4444; font-size:10px; font-weight:700; margin-top:5px; display:none;">يرجى اختيار اللون</div>
                    </div>
                `;
            }

            if(sizes.length > 0) {
                html += `
                    <div class="qa-option-group" style="margin-bottom:25px;">
                        <label style="display:block; font-weight:800; font-size:12px; margin-bottom:10px;">اختر المقاس:</label>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;" id="qaSizes">
                            ${sizes.map((s, i) => `<span class="option-pill" onclick="selectQAPill(this)" data-val="${s}">${s}</span>`).join('')}
                        </div>
                        <div class="qa-error-msg" style="color:#ef4444; font-size:10px; font-weight:700; margin-top:5px; display:none;">يرجى اختيار المقاس</div>
                    </div>
                `;
            }

            html += `
                <style>
                    .qa-option-group .option-pill.selected { background: var(--primary); color: white; border-color: var(--primary); }
                    .qa-option-group .error-border { border: 1px solid #ef4444; padding: 10px; border-radius: 12px; background: #fff5f5; animation: qaShake 0.5s ease-in-out; }
                    @keyframes qaShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-5px); } }
                </style>
                <button onclick="confirmQuickAdd('${id}','${name}',${price},'${image}')" style="width:100%; padding:15px; background:var(--primary); color:white; border:none; border-radius:12px; font-weight:800; cursor:pointer;">تأكيد الإضافة للسلة</button>
            `;

            document.getElementById('quickAddBody').innerHTML = html;
            openModal('quickAddModal');
        }

        function selectQAPill(el) {
            playSfx('click');
            const container = el.parentNode;
            Array.from(container.children).forEach(p => p.classList.remove('selected'));
            el.classList.add('selected');
            
            // Remove error styling on select
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

            const color = colorGroup?.querySelector('.selected')?.getAttribute('data-val') || '';
            const size = sizeGroup?.querySelector('.selected')?.getAttribute('data-val') || '';
            
            let finalName = name;
            if(color || size) finalName += ` (${color} ${size})`.replace('  ',' ');
            
            addToCart(id, finalName, price, image);
            closeModal('quickAddModal');
            openModal('cartModal');
        }

        function openModal(id) {
            document.getElementById(id).classList.add('active');
            document.body.style.overflow = 'hidden';
            if(id === 'wishlistModal') renderWishlistModal();
            if(id === 'cartModal') renderCartModal();
        }
        window.closeModal = function(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('active');
            
            // If we closed the cart modal after a success message, we should refresh to restore structure
            if (id === 'cartModal' && modal && modal.querySelector('.fa-check')) {
                window.location.href = '/';
                return;
            }

            // Re-handle body overflow based on page
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('app') === 'reels') {
                document.body.classList.add('reels-mode');
            } else {
                document.body.classList.remove('reels-mode');
                document.body.style.overflow = '';
            }
        };

        // ─── Lightbox Modal Logic ───
        window.openLightboxModal = function(imgSrc) {
            if (!imgSrc) return;
            
            let lightbox = document.getElementById('lightboxModal');
            if (!lightbox) {
                lightbox = document.createElement('div');
                lightbox.id = 'lightboxModal';
                lightbox.className = 'modal lightbox-modal';
                lightbox.innerHTML = `
                    <div class="modal-content lightbox-content" style="max-width: 95%; background: transparent; box-shadow: none; border:none; padding:0; position:relative; display: flex; flex-direction: column; align-items: center;">
                        <!-- Controls Container: Pinned just above the image -->
                        <div style="width: 100%; max-width: 500px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 0 5px;">
                            <button onclick="closeModal('lightboxModal')" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 10px 18px; border-radius: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(15px); font-family: inherit; font-size: 14px;">
                                <i class="fa fa-arrow-right"></i> <span class="hide-mobile">رجوع</span>
                            </button>
                            
                            <div onclick="closeModal('lightboxModal')" style="width: 45px; height: 45px; background: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); border: 2px solid rgba(255,255,255,0.2);">
                                <i class="fa fa-times" style="font-size: 20px;"></i>
                            </div>
                        </div>

                        <!-- Image -->
                        <img id="lightboxImg" src="" style="max-width: 100%; max-height: 75vh; border-radius: 12px; box-shadow: 0 25px 70px rgba(0,0,0,0.7); object-fit: contain; cursor: zoom-out;" onclick="closeModal('lightboxModal')">
                        
                        <!-- Helper Text -->
                        <div style="margin-top: 20px; color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 700; text-align: center;">
                            انقر على الصورة أو (X) للإغلاق
                        </div>
                    </div>

                    <style>
                        @media (max-width: 768px) {
                            .hide-mobile { display: none; }
                            .lightbox-content { width: 95%; }
                        }
                    </style>
                `;
                document.body.appendChild(lightbox);

                // Close on background click
                lightbox.addEventListener('click', (e) => {
                    if (e.target === lightbox) closeModal('lightboxModal');
                });
                
                if (!document.getElementById('lightboxStyles')) {
                    const style = document.createElement('style');
                    style.id = 'lightboxStyles';
                    style.innerHTML = `
                        .lightbox-modal { background: rgba(0,0,0,0.96) !important; display: none; align-items: center; justify-content: center; z-index: 100000; padding: 20px !important; }
                        .lightbox-modal.active { display: flex !important; }
                        .lightbox-content { animation: lightboxZoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); width: auto; }
                        @keyframes lightboxZoom { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
                    `;
                    document.head.appendChild(style);
                }
            }
            
            const img = document.getElementById('lightboxImg');
            if (img) img.src = imgSrc;
            
            openModal('lightboxModal');
        };

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) closeModal(activeModal.id);
            }
        });

        let activeCoupon = null;
        let storeActivePromotions = [];

        async function fetchActivePromotions() {
            try {
                const res = await fetch('/api/promotions/active');
                storeActivePromotions = await res.json();
                
                if (Array.isArray(storeActivePromotions)) {
                    console.log('Active Promotions Data:', storeActivePromotions);
                } else {
                    console.warn('Active Promotions Data is not an array:', storeActivePromotions);
                    storeActivePromotions = [];
                }
                
                // Show banner if there's an active promotion
                if (storeActivePromotions.length > 0) {
                    const promo = storeActivePromotions[0];
                    if (promo.showBanner !== false) {
                        let banner = document.getElementById('promoBanner');
                        if (!banner) {
                            banner = document.createElement('div');
                            banner.id = 'promoBanner';
                            document.body.insertBefore(banner, document.body.firstChild);
                        }
                        banner.innerHTML = `<span>${promo.occasionEmoji} ${promo.occasionName}: ${promo.bannerText || 'عروض مميزة بانتظارك!'}</span>`;
                        
                        if (promo.bannerImage || promo.bannerBgColor || promo.bannerTextColor || promo.bannerCustomCss) {
                            let cssTextString = '';
                            if (promo.bannerImage) {
                                cssTextString += `background: url('${promo.bannerImage}') center/cover no-repeat !important; `;
                            } else if (promo.bannerBgColor) {
                                cssTextString += `background: ${promo.bannerBgColor} !important; `;
                            }
                            
                            if (promo.bannerTextColor) {
                                cssTextString += `color: ${promo.bannerTextColor} !important; `;
                            }
                            
                            if (promo.bannerCustomCss) {
                                cssTextString += promo.bannerCustomCss;
                            }
                            
                            banner.style.cssText = cssTextString;
                        }
                    }
                    
                    if(document.getElementById('cartModalItems')) recalculateCartTotals();
                }
            } catch (e) { console.error('Failed to load promotions', e); }
        }

        // Call on load
        document.addEventListener('DOMContentLoaded', fetchActivePromotions);

        function recalculateCartTotals() {
            const cart = getCart();
            let subTotal = 0;
            cart.forEach(item => {
                subTotal += item.price * item.quantity;
            });

            const subTotalEl = document.getElementById('subTotalLabel');
            if (subTotalEl) subTotalEl.innerText = subTotal.toFixed(2);

            const totalEl = document.getElementById('modalTotalLabel');
            if (totalEl) totalEl.innerText = subTotal.toFixed(2);

            let discount = 0;
            let promoDiscount = 0;
            
            // 1. Apply Coupon Discount
            const couponInput = document.getElementById('couponInput');
            const couponBtn = document.getElementById('couponBtn');
            const couponFeedback = document.getElementById('couponFeedback');
            
            if (activeCoupon) {
                if (subTotal >= (activeCoupon.minOrder || 0)) {
                    if (activeCoupon.type === 'percentage') {
                        discount = subTotal * (activeCoupon.value / 100);
                    } else if (activeCoupon.type === 'fixed') {
                        discount = activeCoupon.value;
                    }
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
                        couponFeedback.innerHTML = `
                            <span>✅ تم تطبيق الخصم (${activeCoupon.code}) بقيمة ${discount.toFixed(2)} ₪</span>
                            <span onclick="removeCoupon()" style="color:#ef4444; cursor:pointer; text-decoration:underline; margin-right:10px;">إلغاء الكود</span>
                        `;
                    }
                } else {
                    showToast(`الحد الأدنى لتفعيل هذا الكوبون هو ${activeCoupon.minOrder} ₪`);
                    activeCoupon = null;
                    document.getElementById('discountRow').style.display = 'none';
                    if (couponInput && couponBtn && couponFeedback) {
                        removeCoupon();
                    }
                }
            } else {
                document.getElementById('discountRow').style.display = 'none';
            }

            // 2. Apply Seasonal Promotion Discount
            let isFreeShippingPromo = false;
            let promoRow = document.getElementById('promoDiscountRow');
            if (!promoRow && storeActivePromotions.length > 0) {
                promoRow = document.createElement('div');
                promoRow.id = 'promoDiscountRow';
                promoRow.style = 'display:none; justify-content:space-between; margin-bottom:15px; color:#ef4444; font-weight:800;';
                promoRow.innerHTML = `<span><i class="fas fa-gift"></i> عرض <span id="promoOccasionName"></span></span><span id="promoDiscountLabel"></span>`;
                document.getElementById('discountRow').after(promoRow);
            }

            if (storeActivePromotions.length > 0) {
                const promo = storeActivePromotions[0]; // Apply first active promotion
                if (subTotal >= (promo.minOrder || 0)) {
                    if (promo.discountType === 'percentage') {
                        promoDiscount = subTotal * (promo.discountValue / 100);
                    } else if (promo.discountType === 'fixed') {
                        promoDiscount = promo.discountValue;
                    } else if (promo.discountType === 'freeship') {
                        isFreeShippingPromo = true;
                    }

                    if (promoRow && (promoDiscount > 0 || isFreeShippingPromo)) {
                        promoRow.style.display = 'flex';
                        document.getElementById('promoOccasionName').innerText = promo.occasionName;
                        document.getElementById('promoDiscountLabel').innerText = isFreeShippingPromo ? 'شحن مجاني' : promoDiscount.toFixed(2) + '-';
                    } else if (promoRow) {
                        promoRow.style.display = 'none';
                    }
                } else if (promoRow) {
                    promoRow.style.display = 'none';
                }
            } else if (promoRow) {
                promoRow.style.display = 'none';
            }

            let shippingPrice = 0;
            // Get shipping price based on region
            const selectedRegion = document.querySelector('input[name="custRegion"]:checked');
            if (selectedRegion) {
                const region = selectedRegion.value;
                // Default prices if settings not found
                const regionPrices = {
                    'الضفة': 20,
                    'القدس': 30,
                    'الداخل': 50
                };
                shippingPrice = regionPrices[region] || 0;
            }
            
            if (isFreeShippingPromo) {
                shippingPrice = 0;
            }
            
            const shippingTotalEl = document.getElementById('shippingTotalLabel');
            if (shippingTotalEl) shippingTotalEl.innerText = isFreeShippingPromo ? 'مجاني (عرض)' : shippingPrice.toFixed(2);

            const finalTotal = Math.max(0, subTotal - discount - promoDiscount + shippingPrice);
            const finalTotalEl = document.getElementById('finalTotalLabel');
            if (finalTotalEl) finalTotalEl.innerText = finalTotal.toFixed(2);

            const modalCartTotalInput = document.getElementById('modalCartTotal');
            if (modalCartTotalInput) modalCartTotalInput.value = finalTotal.toFixed(2);

            const modalShippingCostInput = document.getElementById('modalShippingCost');
            if (modalShippingCostInput) modalShippingCostInput.value = shippingPrice.toFixed(2);

            const modalDiscountInput = document.getElementById('modalDiscount');
            if (modalDiscountInput) modalDiscountInput.value = (discount + promoDiscount).toFixed(2);

            const modalCouponCodeInput = document.getElementById('modalCouponCode');
            if (modalCouponCodeInput) modalCouponCodeInput.value = activeCoupon ? activeCoupon.code : '';
        }

        function renderCartModal() {
            const cart = getCart();
            const container = document.getElementById('cartModalItems');
            const totalEl = document.getElementById('modalTotalLabel');
            const subTotalEl = document.getElementById('subTotalLabel');
            const finalTotalEl = document.getElementById('finalTotalLabel');

            // Reset to Step 1
            document.getElementById('cartStepItems').style.display = 'block';
            document.getElementById('cartStepCheckout').style.display = 'none';
            document.getElementById('cartStepPayment').style.display = 'none';

            if(cart.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:40px; width:100%;"><i class="fa fa-shopping-bag" style="font-size:50px; opacity:0.1; margin-bottom:15px;"></i><p>السلة فارغة</p></div>';
                totalEl.innerText = '0';
                activeCoupon = null;
                return;
            }

            container.innerHTML = cart.map((item, i) => {
                return `
                    <div class="modal-item" style="padding:10px; border-radius:12px; background:var(--gray-100);">
                        <img src="${item.image}" style="width:50px; height:50px;">
                        <div class="modal-item-info">
                            <div class="modal-item-name" style="font-size:13px;">${item.name}</div>
                            <div class="modal-item-price" style="font-size:14px; font-weight:800; color:var(--primary);">${item.price} ₪</div>
                            <div style="display:flex; align-items:center; gap:10px; margin-top:5px;">
                                <button onclick="updateCartQuantity(${i}, -1)" style="background:var(--white); border:1px solid var(--gray-200); width:28px; height:28px; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">-</button>
                                <span style="font-weight:800; font-size:14px; min-width:20px; text-align:center;">${item.quantity}</span>
                                <button onclick="updateCartQuantity(${i}, 1)" style="background:var(--white); border:1px solid var(--gray-200); width:28px; height:28px; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">+</button>
                            </div>
                        </div>
                        <button style="background:none; border:none; color:#f43f5e; cursor:pointer;" onclick="removeFromCartModal(${i})"><i class="fa fa-trash-alt"></i></button>
                    </div>
                `;
            }).join('');

            document.getElementById('modalCartData').value = JSON.stringify(cart);
            recalculateCartTotals();
        }

        function showCheckoutForm() {
            if(getCart().length === 0) return showToast('السلة فارغة حالياً!');
            
            if (window.trackEvent) trackEvent('init_checkout');

            // Pre-fill if distributor is logged in
            const distPhone = localStorage.getItem('distributorPhone');
            const distName = localStorage.getItem('distributorName');
            const distCity = localStorage.getItem('distributorCity');
            const distAddress = localStorage.getItem('distributorAddress');
            
            if(distPhone) {
                if(document.getElementById('custName') && !document.getElementById('custName').value) {
                    document.getElementById('custName').value = distName || '';
                }
                if(document.getElementById('custPhone') && !document.getElementById('custPhone').value) {
                    document.getElementById('custPhone').value = distPhone || '';
                }
                if(document.getElementById('custCityName') && !document.getElementById('custCityName').value && distCity) {
                    document.getElementById('custCityName').value = distCity;
                }
                if(document.getElementById('custAddress') && !document.getElementById('custAddress').value && distAddress) {
                    document.getElementById('custAddress').value = distAddress;
                }
            }

            // --- Phone Real-time Validation Setup ---
            const phoneInput = document.getElementById('custPhone');
            const errorMsg = document.getElementById('phone-validation-msg');
            if (phoneInput && !phoneInput.hasAttribute('data-realtime-listen')) {
                phoneInput.addEventListener('input', function() {
                    const val = this.value.replace(/\D/g, '');
                    if (val.length === 10) {
                        this.style.borderColor = '#10b981'; // Green
                        this.style.backgroundColor = '#f0fdf4';
                        if(errorMsg) errorMsg.style.display = 'none';
                    } else if (val.length > 0) {
                        this.style.borderColor = '#ef4444'; // Red
                        this.style.backgroundColor = '#fff1f2';
                        if(errorMsg) errorMsg.style.display = 'block';
                    } else {
                        this.style.borderColor = 'var(--gray-200)';
                        this.style.backgroundColor = 'white';
                        if(errorMsg) errorMsg.style.display = 'none';
                    }
                });
                phoneInput.setAttribute('data-realtime-listen', 'true');
            }

            document.getElementById('cartStepItems').style.display = 'none';
            document.getElementById('cartStepCheckout').style.display = 'block';
        }

        window.updateShippingByRegion = function(region) {
            recalculateCartTotals();
            playSfx('click');
        }

        function showPaymentStep() {
            const fields = [
                document.getElementById('custName'),
                document.getElementById('custCityName'),
                document.getElementById('custAddress'),
                document.getElementById('custPhone')
            ];
            
            let hasError = false;
            fields.forEach(f => {
                if(!f || !f.value.trim()) {
                    if(f) f.classList.add('input-error');
                    hasError = true;
                } else {
                    f.classList.remove('input-error');
                }
            });

            // ... phone validation existing code ...
            const phoneField = document.getElementById('custPhone');
            const phoneVal = phoneField.value.replace(/\D/g, '');
            const errorMsg = document.getElementById('phone-validation-msg');
            
            if (phoneVal.length !== 10 && phoneField.value.trim() !== '') {
                phoneField.style.borderColor = '#ef4444';
                phoneField.style.backgroundColor = '#fff1f2';
                if(errorMsg) errorMsg.style.display = 'block';
                hasError = true;
            }

            if(hasError) {
                showToast('يرجى التأكد من البيانات باللون الأحمر');
                return;
            }

            recalculateCartTotals();

            // Copy to final hidden fields
            document.getElementById('finalName').value = fields[0].value;
            const region = document.querySelector('input[name="custRegion"]:checked').value;
            document.getElementById('finalCity').value = region + ' - ' + fields[1].value;
            document.getElementById('finalAddress').value = fields[2].value;
            document.getElementById('finalPhone').value = fields[3].value;
            document.getElementById('finalPhone2').value = document.getElementById('custPhone2').value;
            const custNotesField = document.getElementById('custNotes');
            if(custNotesField) {
                document.getElementById('finalNotes').value = custNotesField.value;
            }

            document.getElementById('cartStepCheckout').style.display = 'none';
            document.getElementById('cartStepPayment').style.display = 'block';

            // Track abandoned cart - customer filled details but hasn't paid yet
            try {
                const cart = getCart();
                const sessionId = localStorage.getItem('store_session_id') || (() => {
                    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                    localStorage.setItem('store_session_id', id);
                    return id;
                })();
                fetch('/api/abandoned', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        name: fields[0].value,
                        city: fields[1].value,
                        address: fields[2].value,
                        phone: fields[3].value,
                        email: '',
                        items: cart
                    })
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

        async function applyCoupon() {
            const input = document.getElementById('couponInput');
            const btn = document.getElementById('couponBtn');
            const feedback = document.getElementById('couponFeedback');
            const code = input.value.trim();
            
            if (activeCoupon) {
                removeCoupon();
                return;
            }
            if(!code) return;
            
            try {
                const res = await fetch(`/api/validate-coupon?code=${encodeURIComponent(code)}`);
                const data = await res.json();
                if(data.valid) {
                    const coupon = data.coupon;
                    const cart = getCart();
                    let subTotal = 0;
                    cart.forEach(item => { subTotal += item.price * item.quantity; });
                    
                    if(subTotal < coupon.minOrder) {
                        showToast(`الحد الأدنى لتفعيل هذا الكوبون هو ${coupon.minOrder} ₪`);
                        return;
                    }
                    
                    activeCoupon = coupon;
                    recalculateCartTotals();
                    showToast('تم تطبيق كود الخصم بنجاح! 🎉');
                } else {
                    showToast(data.error || 'كود الخصم غير صالح');
                    if (input) {
                        input.style.borderColor = '#ef4444';
                        input.style.backgroundColor = '#fef2f2';
                    }
                }
            } catch(e) {
                showToast('حدث خطأ أثناء التحقق من كود الخصم');
            }
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
                if(cart[i].quantity <= 0) {
                    cart.splice(i, 1);
                }
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
            } catch(e) {
                console.error("Audio error:", e);
            }
        }

        function launchConfetti() {
            try {
                const canvas = document.createElement('canvas');
                canvas.style.position = 'fixed';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.width = '100vw';
                canvas.style.height = '100vh';
                canvas.style.pointerEvents = 'none';
                canvas.style.zIndex = '999999';
                document.body.appendChild(canvas);

                const ctx = canvas.getContext('2d');
                let width = canvas.width = window.innerWidth;
                let height = canvas.height = window.innerHeight;

                window.addEventListener('resize', () => {
                    width = canvas.width = window.innerWidth;
                    height = canvas.height = window.innerHeight;
                });

                const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#fa0000'];
                const confettiCount = 150;
                const pieces = [];

                for (let i = 0; i < confettiCount; i++) {
                    pieces.push({
                        x: Math.random() * width,
                        y: Math.random() * height - height,
                        r: Math.random() * 6 + 4,
                        d: Math.random() * height,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        tilt: Math.random() * 10 - 5,
                        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                        tiltAngle: 0
                    });
                }

                let frames = 0;

                function draw() {
                    ctx.clearRect(0, 0, width, height);

                    pieces.forEach((p, idx) => {
                        p.tiltAngle += p.tiltAngleIncremental;
                        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
                        p.x += Math.sin(p.tiltAngle);
                        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

                        ctx.beginPath();
                        ctx.lineWidth = p.r / 2;
                        ctx.strokeStyle = p.color;
                        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
                        ctx.stroke();
                    });

                    update();
                }

                function update() {
                    let remaining = 0;
                    pieces.forEach(p => {
                        if (p.y < height) remaining++;
                    });

                    if (remaining > 0 && frames < 300) {
                        frames++;
                        requestAnimationFrame(draw);
                    } else {
                        if (canvas.parentNode) {
                            canvas.parentNode.removeChild(canvas);
                        }
                    }
                }

                draw();
            } catch (e) {
                console.error("Confetti error:", e);
            }
        }

        async function finalizeCartCheckout(event) {
            if (event) event.preventDefault();
            
            const cart = getCart();
            if(cart.length === 0) return false;
            
            const form = document.querySelector('form[action="/?app=order.submit"]');
            if (!form) return false;

            const tracking = {
                utm_source: localStorage.getItem('store_utm_source') || '',
                utm_campaign: localStorage.getItem('store_utm_campaign') || '',
                referrer: localStorage.getItem('store_referrer') || '',
                visitedPages: localStorage.getItem('store_visited_pages') || '[]',
                sessionCount: localStorage.getItem('store_session_count') || '1',
                firstVisit: localStorage.getItem('store_first_visit') || '',
                sessionId: localStorage.getItem('store_session_id') || ''
            };
            
            const sessionStart = parseInt(sessionStorage.getItem('store_session_start') || Date.now());
            const diffMs = Date.now() - sessionStart;
            const minutes = Math.floor(diffMs / 60000);
            const seconds = Math.floor((diffMs % 60000) / 1000);
            tracking.timeSpent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds} دقيقه`;
            
            for (let key in tracking) {
                let input = form.querySelector(`input[name="${key}"]`);
                if (!input) {
                    input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    form.appendChild(input);
                }
                input.value = tracking[key];
            }

            // --- Wholesaler Data ---
            const distPhone = localStorage.getItem('distributorPhone');
            const distName = localStorage.getItem('distributorName');
            const distId = localStorage.getItem('distributorId');

            if(distPhone && distId) {
                // Inject Wholesale Flags
                let isWholesaleInput = form.querySelector('input[name="isWholesale"]');
                if(!isWholesaleInput) {
                    isWholesaleInput = document.createElement('input');
                    isWholesaleInput.type = 'hidden';
                    isWholesaleInput.name = 'isWholesale';
                    form.appendChild(isWholesaleInput);
                }
                isWholesaleInput.value = 'true';

                let distIdInput = form.querySelector('input[name="distributorId"]');
                if(!distIdInput) {
                    distIdInput = document.createElement('input');
                    distIdInput.type = 'hidden';
                    distIdInput.name = 'distributorId';
                    form.appendChild(distIdInput);
                }
                distIdInput.value = distId;

                // Prefill form if empty
                const nameInput = form.querySelector('input[name="customerName"]');
                const phoneInput = form.querySelector('input[name="customerPhone"]');
                if(nameInput && !nameInput.value) nameInput.value = distName || '';
                if(phoneInput && !phoneInput.value) phoneInput.value = distPhone;
            }

            // --- Phone Number Validation ---
            const customerPhoneInput = form.querySelector('input[name="customerPhone"]');
            if (customerPhoneInput) {
                const phoneVal = customerPhoneInput.value.replace(/\D/g, ''); // إزالة أي رموز غير أرقام
                if (phoneVal.length !== 10) {
                    alert('يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام (مثلاً: 059xxxxxxx)');
                    customerPhoneInput.focus();
                    customerPhoneInput.style.borderColor = '#ef4444';
                    return false;
                }
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> جاري إرسال الطلب...';
            }

            try {
                const formData = new FormData(form);
                const searchParams = new URLSearchParams(formData);

                const response = await fetch('/?app=order.submit&ajax=true', {
                    method: 'POST',
                    body: searchParams,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                const result = await response.json();
                if (result.success) {
                    playSuccessSound();
                    launchConfetti();

                    // Tracking Purchase
                    const finalTotalVal = parseFloat(document.getElementById('finalTotalLabel').innerText || '0').toFixed(2);
                    if (typeof window.trackStoreEvent === 'function') {
                        window.trackStoreEvent('Purchase', { total: finalTotalVal, orderId: result.orderId });
                    }

                    try {
                        const sessionId = localStorage.getItem('store_session_id');
                        if (sessionId) {
                            fetch('/api/abandoned/' + sessionId, { method: 'DELETE' }).catch(() => {});
                            localStorage.removeItem('store_session_id');
                        }
                    } catch(e) {}

                    const whatsappMsg = `مرحباً مجوهرات UL، لدي استفسار بخصوص طلبي رقم ${result.orderId} بقيمة ${finalTotalVal} ₪.`;
                    const whatsappLink = `https://wa.me/${(window.storePhone || '970599000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;

                    localStorage.removeItem('cart');
                    if (document.getElementById('cart-count')) document.getElementById('cart-count').innerText = '0';
                    if (document.getElementById('floatingCartCount')) document.getElementById('floatingCartCount').innerText = '0';
                    const floatBar = document.getElementById('floatingCartBar');
                    if (floatBar) floatBar.style.display = 'none';

                    const modalBody = document.querySelector('#cartModal .modal-body');
                    if (modalBody) {
                        modalBody.innerHTML = `
                            <div style="text-align:center; padding:35px 15px; background:#fff; border-radius:20px; direction:rtl;">
                                <div style="width: 80px; height: 80px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 0 auto 20px;">
                                    <i class="fa fa-check"></i>
                                </div>
                                <h3 style="font-weight:900; margin-bottom:10px; font-size:22px; color:var(--dark);">تم استلام طلبك بنجاح! 🎉</h3>
                                <p style="color:#64748b; font-size:14px; margin-bottom:20px; line-height:1.6;">سنقوم بالتواصل معك قريباً لتأكيد الطلب وترتيب عملية التوصيل.</p>
                                
                                <!-- تفاصيل الفاتورة الفاخرة للعميل -->
                                <div style="background:#f8fafc; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #e2e8f0; text-align:right;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px; color:#64748b;">
                                        <span>رقم الطلب الخاص بك:</span>
                                        <strong style="color:var(--dark); font-family:monospace;">${result.orderId}</strong>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; font-size:13px; color:#64748b;">
                                        <span>المبلغ الإجمالي للتسليم:</span>
                                        <strong style="color:var(--primary); font-size:16px; font-weight:800;">${finalTotalVal} ₪</strong>
                                    </div>
                                </div>

                                <!-- زر تواصل عبر الواتساب -->
                                <a href="${whatsappLink}" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:14px; background:#25d366; color:white; border:none; border-radius:12px; font-weight:800; font-size:16px; cursor:pointer; text-decoration:none; margin-bottom:20px; box-shadow:0 6px 15px rgba(37,211,102,0.25);">
                                    <i class="fab fa-whatsapp" style="font-size:20px;"></i> تواصل معنا عبر الواتساب 💬
                                </a>

                                <div style="display:flex; gap:10px;">
                                    <button onclick="closeModal('cartModal'); window.location.href='/'" style="flex:1; padding:12px; background:var(--primary); color:white; border:none; border-radius:10px; font-weight:700; cursor:pointer;">العودة للتسوق</button>
                                    <button onclick="closeModal('cartModal'); openModal('ordersModal')" style="flex:1; padding:12px; background:var(--gray-200); color:var(--dark); border:none; border-radius:10px; font-weight:700; cursor:pointer;">تتبع طلباتي</button>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    alert(result.message || 'حدث خطأ أثناء تقديم الطلب، يرجى المحاولة مرة أخرى.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnHtml;
                    }
                }
            } catch (err) {
                console.error("Checkout Error:", err);
                alert('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت وإعادة المحاولة.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
            }

            return false;
        }

        function renderWishlistModal() {
            const favs = getFavorites();
            const body = document.getElementById('wishlistBody');
            if(favs.length === 0) {
                body.innerHTML = '<div class="empty-state" style="padding:40px 0;"><i class="fa fa-heart" style="opacity:0.2;"></i><p>قائمة المفضلة فارغة</p></div>';
                return;
            }
            body.innerHTML = favs.map(item => `
                <div class="modal-item" style="display:flex; align-items:center;">
                    <a href="/?app=product.show.${item.id}" onclick="closeModal('wishlistModal')" style="display:flex; flex:1; align-items:center; gap:15px; text-decoration:none; color:inherit;">
                        <img src="${item.image}" style="width:60px; height:60px; border-radius:10px; object-fit:cover;">
                        <div class="modal-item-info">
                            <div class="modal-item-name" style="font-size:14px; font-weight:700;">${item.name}</div>
                            <div class="modal-item-price" style="font-size:14px; color:var(--primary); font-weight:800;">${item.price}</div>
                        </div>
                    </a>
                    <div style="display:flex; gap:10px;">
                        <button class="cart-icon-btn" onclick="addToCart('${item.id}', '${item.name}', ${item.price}, '${item.image}'); closeModal('wishlistModal');"><i class="fa fa-shopping-bag"></i></button>
                        <button style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:16px;" onclick="toggleFavorite('${item.id}'); renderWishlistModal();"><i class="fa fa-trash-alt"></i></button>
                    </div>
                </div>
            `).join('');
        }

        async function searchOrders() {
            const phone = document.getElementById('orderPhoneInput').value;
            if(!phone) return alert('يرجى إدخل رقم الجوال');
            
            // --- Phone Number Validation ---
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                return alert('يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام');
            }
            
            const body = document.getElementById('ordersResults');
            body.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa fa-spinner fa-spin"></i> جاري البحث...</div>';
            
            try {
                const res = await fetch(`/?app=orders.view&phone=${phone}&format=json`);
                const orders = await res.json();
                if(orders.length === 0) {
                    body.innerHTML = '<div class="empty-state"><p>ليس هناك طلبات سابقة للرقم المدخل آخر 14 يوم</p></div>';
                } else {
                    body.innerHTML = orders.map(o => `
                        <div style="background:var(--gray-100); border-radius:15px; padding:20px; margin-bottom:15px; border:1px solid var(--gray-200);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                                <div>
                                    <strong style="display:block; font-size:16px;">طلب #${o.id}</strong>
                                    <span style="font-size:12px; color:var(--gray-400);">${new Date(o.date).toLocaleDateString('ar-EG')}</span>
                                </div>
                                <span class="badge" style="position:static; background:var(--primary-light); color:var(--primary); font-size:12px;">${o.status || 'قيد المراجعة'}</span>
                            </div>
                            
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-weight:800; color:var(--primary);">الإجمالي: ${o.total}</div>
                                <button onclick="toggleOrderDetails(this)" style="background:var(--white); border:1px solid var(--gray-200); padding:5px 15px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">عرض التفاصيل <i class="fa fa-chevron-down"></i></button>
                            </div>
                            
                            <div class="order-items-detail" style="display:none; margin-top:15px; border-top:1px dashed var(--gray-200); padding-top:15px; gap:12px; flex-direction:column;">
                                ${o.items.map(item => `
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <img src="${item.image}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                                        <div style="flex:1;">
                                            <div style="font-size:13px; font-weight:700;">${item.name}</div>
                                            <div style="font-size:11px; color:var(--gray-600);">الكمية: ${item.quantity} | السعر: ${item.price}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('');
                }
            } catch(e) {
                body.innerHTML = '<div class="empty-state"><p>حدث خطأ أثناء البحث</p></div>';
            }
        }

        function toggleOrderDetails(btn) {
            const detail = btn.parentElement.nextElementSibling;
            const isHidden = detail.style.display === 'none';
            detail.style.display = isHidden ? 'flex' : 'none';
            btn.innerHTML = isHidden ? 'إخفاء التفاصيل <i class="fa fa-chevron-up"></i>' : 'عرض التفاصيل <i class="fa fa-chevron-down"></i>';
        }
    

// ─── Script Block #2 ───

        // --- Distributor Logic ---
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
                
                phoneInput.addEventListener('input', function() {
                    this.style.borderColor = 'var(--gray-200)';
                    errBox.style.display = 'none';
                }, {once: true});
                
                return;
            }
            msg += '\\nرقم هاتفي المسجل هو: ' + phone;
            if (!storePhone) {
                alert('يرجى من الإدارة إضافة رقم واتساب في الإعدادات أولاً');
                return;
            }
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
                const res = await fetch('/api/distributor/login', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({phone, password})
                });
                const data = await res.json();
                if(data.error) {
                    if (data.error.includes('قيد المراجعة')) {
                        document.getElementById('distLoginForm').style.display = 'none';
                        document.getElementById('distPendingUi').style.display = 'block';
                    } else {
                        const errEl = document.getElementById('distLoginErrorMsg');
                        errEl.innerText = data.error;
                        errEl.style.display = 'block';
                    }
                    return;
                }
                localStorage.setItem('distributorPhone', phone);
                localStorage.setItem('distributorName', data.distributor.name);
                localStorage.setItem('distributorId', data.distributor.id);
                localStorage.setItem('distributorCity', data.distributor.city || '');
                localStorage.setItem('distributorAddress', data.distributor.address || '');
                showToast('تم تسجيل الدخول بنجاح');
                checkDistributorSession();
            } catch(e) { showToast('حدث خطأ بالاتصال'); }
        }

        async function distRegister() {
            const name = document.getElementById('distRegName').value;
            const phone = document.getElementById('distRegPhone').value;
            const password = document.getElementById('distRegPassword').value;
            const businessName = document.getElementById('distRegBusiness').value;
            const city = document.getElementById('distRegCity').value;
            const address = document.getElementById('distRegAddress').value;

            if(!name || !phone || !password || !city || !address) return showToast('يرجى إكمال جميع الحقول المطلوبة (*)');
            
            // --- Phone Number Validation ---
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                const errEl = document.getElementById('distRegErrorMsg');
                errEl.innerText = 'يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام (مثلاً: 059xxxxxxx)';
                errEl.style.display = 'block';
                return;
            }

            try {
                const res = await fetch('/api/distributor/register', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({name, phone, password, businessName, city, address})
                });
                const data = await res.json();
                if(data.error) {
                    const errEl = document.getElementById('distRegErrorMsg');
                    errEl.innerText = data.error;
                    errEl.style.display = 'block';
                    return;
                }
                
                // Show Success UI
                document.getElementById('distRegForm').style.display = 'none';
                document.getElementById('distRegSuccess').style.display = 'block';
                
            } catch(e) { showToast('حدث خطأ بالاتصال'); }
        }

        function distLogout() {
            localStorage.removeItem('distributorPhone');
            localStorage.removeItem('distributorName');
            localStorage.removeItem('distributorId');
            localStorage.setItem('distributorCity', '');
            localStorage.setItem('distributorAddress', '');
            localStorage.removeItem('distributor_auth');
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
                const res = await fetch('/api/orders');
                const orders = await res.json();
                
                const myOrders = orders.filter(o => 
                    (o.customer && o.customer.phone === phone) || 
                    o.distributorId === id
                );
                
                if(myOrders.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--gray-400); font-size:14px;"><i class="fas fa-info-circle"></i> لم تقم بإجراء أي طلبات جملة حتى الآن</td></tr>';
                    return;
                }
                
                tbody.innerHTML = myOrders.map(o => `
                    <tr style="border-bottom:1px solid var(--gray-200); transition:0.2s;" onmouseover="this.style.background='var(--gray-100)'" onmouseout="this.style.background='white'">
                        <td style="padding:15px; font-weight:800; color:var(--primary);">#${o.id}</td>
                        <td style="padding:15px; font-size:13px; color:var(--gray-600);">${new Date(o.date || o.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td style="padding:15px;">
                            <div style="font-size:13px; font-weight:700;">${o.items.map(i => i.name).join('، ')}</div>
                            <div style="font-size:11px; color:var(--gray-400);">${o.items.length} منتجات</div>
                        </td>
                        <td style="padding:15px; font-weight:800; font-size:16px;">${parseFloat(o.total).toFixed(2)} ₪</td>
                        <td style="padding:15px;">
                            <span style="padding:5px 12px; border-radius:30px; font-size:12px; font-weight:700; background:var(--gray-100); border:1px solid var(--gray-200); color:var(--primary);">
                                ${o.status || 'جديد'}
                            </span>
                        </td>
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
                const pRes = await fetch('/api/products');
                const products = await pRes.json();
                const wRes = await fetch('/api/wholesale-prices?phone=' + phone);
                const wData = await wRes.json();
                
                const pricesMap = wData.prices || {};
                const wholesaleItems = products.filter(p => pricesMap[p.id]);
                
                if(wholesaleItems.length === 0) {
                    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; border:1px dashed var(--gray-400); border-radius:15px; color:var(--gray-600);">لا توجد منتجات جملة مخصصة لك حالياً.</div>';
                    return;
                }

                grid.innerHTML = wholesaleItems.map(p => {
                    const price = pricesMap[p.id];
                    
                    let colors = p.colors ? p.colors.join(',') : '';
                    let sizes = p.sizes ? p.sizes.join(',') : '';
                    if (p.variants && Array.isArray(p.variants)) {
                        const colorVar = p.variants.find(v => v.name.includes('اللون') || v.type === 'swatch');
                        const sizeVar = p.variants.find(v => v.name.includes('المقاس') || v.type === 'pills');
                        if (colorVar && colorVar.values) colors = colorVar.values.map(v => typeof v === 'object' ? v.value : v).join(',');
                        if (sizeVar && sizeVar.values) sizes = sizeVar.values.map(v => typeof v === 'object' ? v.value : v).join(',');
                    }

                    return `
                        <div class="product-card" style="background:#fff; border-radius:15px; border:1px solid var(--gray-200); overflow:hidden; display:flex; flex-direction:column;">
                            <img src="${p.image}" style="width:100%; height:180px; object-fit:cover;">
                            <div style="padding:15px; flex:1; display:flex; flex-direction:column;">
                                <h3 style="font-size:14px; font-weight:800; margin-bottom:10px; color:var(--dark);">${p.name}</h3>
                                <div style="margin-top:auto;">
                                    <div style="font-size:12px; color:var(--gray-400); text-decoration:line-through;">${p.price} ₪</div>
                                    <div style="font-size:18px; font-weight:900; color:var(--primary);">${price} ₪ <i class="fa fa-tag" style="font-size:12px;"></i></div>
                                    <button onclick="openQuickAdd('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${price}, '${p.image}', '${colors}', '${sizes}')" style="width:100%; margin-top:10px; padding:10px; background:var(--primary); color:white; border:none; border-radius:10px; font-weight:800; cursor:pointer; font-size:13px;"><i class="fa fa-shopping-cart"></i> طلب سريع</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } catch(e) { grid.innerHTML = 'خطأ بتحميل المنتجات'; }
        }

        async function checkDistributorSession() {
            const phone = localStorage.getItem('distributorPhone');
            const name = localStorage.getItem('distributorName');
            const id = localStorage.getItem('distributorId');
            
            const dashSec = document.getElementById('distDashboardSection');
            const publicSec = document.getElementById('publicMarketingContent');
            
            if(phone) {
                // Modal Profile UI
                if(document.getElementById('distAuthSection')) {
                    document.getElementById('distAuthSection').style.display = 'none';
                    document.getElementById('distProfileSection').style.display = 'block';
                    document.getElementById('distProfileName').innerText = 'أهلاً بك، ' + name;
                }
                
                // Main Page Logic
                if(dashSec) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const isDistView = urlParams.get('view') === 'distributor';
                    
                    if(isDistView) {
                        dashSec.style.display = 'block';
                        if(publicSec) publicSec.style.display = 'none';
                    } else {
                        dashSec.style.display = 'none';
                        if(publicSec) publicSec.style.display = 'block';
                    }

                    document.getElementById('distWelcomeName').innerText = 'أهلاً بك، ' + name;
                    loadDistWholesaleProducts(phone);
                    loadDistMyOrders();
                }

                // Fetch wholesale prices and override UI for public areas (ALWAYS DO THIS IF LOGGED IN)
                try {
                    const res = await fetch('/api/wholesale-prices?phone=' + phone);
                    const data = await res.json();
                    if(data.prices) {
                        window.wholesalePrices = data.prices;
                        // Target all types of product cards (Standard, New Arrivals, Recommended, Winning)
                        document.querySelectorAll('.product-card, .arr-sl-card, .rec-sl-card, .premium-winning-sec').forEach(card => {
                            // Find the add to cart button which contains the openQuickAdd call
                            const addBtn = card.querySelector('.cart-icon-btn') || 
                                           card.querySelector('button[onclick*="openQuickAdd"]') ||
                                           card.querySelector('.arr-sl-cart') ||
                                           card.querySelector('.rec-sl-cart') ||
                                           card.querySelector('.win-btn-secondary');

                            if(!addBtn) return;

                            const onclickStr = addBtn.getAttribute('onclick');
                            if(!onclickStr) return;

                            const match = onclickStr.match(/openQuickAdd\('([^']+)'/);
                            if(match && window.wholesalePrices[match[1]]) {
                                const newPrice = window.wholesalePrices[match[1]];
                                
                                // Find the price element based on the card type
                                const priceEl = card.querySelector('.product-price') || 
                                                card.querySelector('.arr-sl-price-new') || 
                                                card.querySelector('.rec-sl-price-new') ||
                                                card.querySelector('.win-price-new');

                                if(priceEl) {
                                    // Prevent duplicate processing
                                    if (priceEl.getAttribute('data-wholesale-applied')) return;
                                    
                                    const oldPriceText = priceEl.innerText.trim();
                                    priceEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;"><span style="font-size:1.15em;font-weight:900;color:var(--primary);">${newPrice}</span><i class="fa fa-tag" style="color:var(--primary);font-size:0.8em;"></i><span style="font-size:0.72em;text-decoration:line-through;color:var(--gray-400);font-weight:500;">${oldPriceText}</span></span>`;
                                    priceEl.setAttribute('data-wholesale-applied', 'true');
                                }
                                
                                // Update the price in the onclick function so adding to cart uses the wholesale price
                                const newOnclick = onclickStr.replace(/,\s*[\d.]+\s*,/, `, ${newPrice},`);
                                addBtn.setAttribute('onclick', newOnclick);
                            }
                        });
                        
                        const curPath = window.location.search;
                        if(curPath.includes('product.show')) {
                            const idMatch = curPath.match(/product\.show\.([^&]+)/);
                            if(idMatch && window.wholesalePrices[idMatch[1]]) {
                                const pPriceEl = document.querySelector('.product-price-large');
                                if(pPriceEl && !pPriceEl.getAttribute('data-wholesale-applied')) {
                                    const oldPriceText = pPriceEl.innerText.trim();
                                    pPriceEl.innerHTML = `سعر الجملة: ${window.wholesalePrices[idMatch[1]]} ₪ <span style="font-size:16px; font-weight:normal; color:var(--gray-400); text-decoration:line-through;">${oldPriceText}</span>`;
                                    pPriceEl.setAttribute('data-wholesale-applied', 'true');
                                }
                                document.querySelectorAll('button[onclick^="addToCart"]').forEach(btn => {
                                   const onclickStr = btn.getAttribute('onclick');
                                   if (onclickStr.includes('wholesale-applied')) return;
                                   const newOnclick = onclickStr.replace(/,\s*[\d.]+\s*,/, `, ${window.wholesalePrices[idMatch[1]]},`);
                                   btn.setAttribute('onclick', newOnclick + ' // wholesale-applied');
                                });
                            }
                        }
                    }
                } catch(e) { console.error('Wholesale fetch failed'); }
            } else {
                if(document.getElementById('distAuthSection')) {
                    document.getElementById('distAuthSection').style.display = 'block';
                    document.getElementById('distProfileSection').style.display = 'none';
                }
                if(dashSec) dashSec.style.display = 'none';
                if(publicSec) publicSec.style.display = 'block';
            }
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            checkDistributorSession();
        });

        // Update all UI components (badges, floating bar, etc.)
        window.updateCartUI = function() {
            const cart = getCart();
            const count = cart.reduce((sum, item) => sum + item.quantity, 0);
            
            // Update all cart badges (header, floating bar, mobile nav)
            const cartBadges = document.querySelectorAll('#cart-count, #floatingCartCount, .cart-count');
            cartBadges.forEach(b => b.innerText = count);
            
            // Update floating cart total price
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const totalEl = document.getElementById('floatingCartTotal');
            if(totalEl) totalEl.innerText = total.toFixed(2);
            
            // Show/Hide floating bar
            const bar = document.getElementById('floatingCartBar');
            if(bar) {
                if(count > 0) {
                    bar.classList.add('visible');
                } else {
                    bar.classList.remove('visible');
                }
            }
            
            updateFavUI();
        };

        window.togglePublicStore = function(showPublic) {
            const dashSec = document.getElementById('distDashboardSection');
            const publicSec = document.getElementById('publicMarketingContent');
            const returnBtn = document.getElementById('btnReturnToDash');
            
            if(showPublic) {
                if(dashSec) dashSec.style.display = 'none';
                if(publicSec) publicSec.style.display = 'block';
                if(returnBtn) returnBtn.style.display = 'flex';
                
                // Update URL to remove distributor view
                const url = new URL(window.location);
                url.searchParams.delete('view');
                window.history.pushState({}, '', url);
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                if(dashSec) dashSec.style.display = 'block';
                if(publicSec) publicSec.style.display = 'none';
                if(returnBtn) returnBtn.style.display = 'none';
                
                // Update URL to show distributor view
                const url = new URL(window.location);
                url.searchParams.set('view', 'distributor');
                window.history.pushState({}, '', url);
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        // Initialize on load
        document.addEventListener('DOMContentLoaded', () => {
            updateCartUI();
            if (typeof updateFavUI === 'function') updateFavUI();
        });
    

// ─── Script Block #3 ───

        // PWA Install Logic
        let deferredPrompt = null;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const banner = document.getElementById('pwaInstallBanner');
            if (banner) banner.style.display = 'flex';
        });

        window.installPWA = function() {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(result => {
                if (result.outcome === 'accepted') {
                    if(window.showToast) showToast('تم تثبيت التطبيق بنجاح! 🎉');
                }
                deferredPrompt = null;
                document.getElementById('pwaInstallBanner').style.display = 'none';
            });
        };

        // Hide banner if already installed
        window.addEventListener('appinstalled', () => {
            document.getElementById('pwaInstallBanner').style.display = 'none';
            deferredPrompt = null;
        });

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    

// ─── Script Block #4 ───

    // ── Typewriter Search Placeholder ─────────────────────────────────────────
    (function() {
        const input = document.getElementById('searchInput');
        if (!input) return;
        const texts = window.searchPlaceholders || [];
        if (!texts || texts.length === 0) {
            input.placeholder = 'ابحث عن ما تحب...';
            return;
        }
        let ti = 0, ci = 0, deleting = false;
        let typeTimer;

        function type() {
            if (document.activeElement === input) {
                typeTimer = setTimeout(type, 1000);
                return;
            }
            const current = texts[ti];
            if (!deleting) {
                ci++;
                input.placeholder = current.slice(0, ci) + '|';
                if (ci === current.length) {
                    deleting = true;
                    typeTimer = setTimeout(type, 1800);
                    return;
                }
                typeTimer = setTimeout(type, 85);
            } else {
                ci--;
                input.placeholder = current.slice(0, ci) + (ci > 0 ? '|' : '');
                if (ci === 0) {
                    deleting = false;
                    ti = (ti + 1) % texts.length;
                    typeTimer = setTimeout(type, 400);
                    return;
                }
                typeTimer = setTimeout(type, 45);
            }
        }
        type();
    })();
    

// ─── Script Block #5 ───

    (function() {
        if (!localStorage.getItem('store_referrer')) {
            localStorage.setItem('store_referrer', document.referrer || 'مباشر (Direct)');
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
        utmKeys.forEach(key => {
            if (urlParams.has(key)) {
                localStorage.setItem('store_' + key, urlParams.get(key));
            }
        });

        let sessionCount = parseInt(localStorage.getItem('store_session_count') || '0');
        if (!sessionStorage.getItem('session_active')) {
            sessionCount++;
            localStorage.setItem('store_session_count', sessionCount);
            sessionStorage.setItem('session_active', 'true');
        }

        if (!localStorage.getItem('store_first_visit')) {
            localStorage.setItem('store_first_visit', new Date().toLocaleString());
        }

        if (!sessionStorage.getItem('store_session_start')) {
            sessionStorage.setItem('store_session_start', Date.now());
        }

        let visitedPages = JSON.parse(localStorage.getItem('store_visited_pages') || '[]');
        const currentPath = window.location.pathname + window.location.search;
        if (!visitedPages.includes(currentPath)) {
            visitedPages.push(currentPath);
            if (visitedPages.length > 10) visitedPages.shift();
            localStorage.setItem('store_visited_pages', JSON.stringify(visitedPages));
        }
    })();

    // ── Load More Products Client-Side Lazy Reveal ──
    window.loadMoreProducts = function() {
        // Find the button that was clicked
        const btn = document.activeElement || document.getElementById('btnLoadMore');
        if (!btn) return;
        
        // Find the parent product grid (which sits right before the load-more-container or nearby)
        const container = btn.closest('.load-more-container').previousElementSibling;
        if (!container || !container.classList.contains('product-grid')) return;
        
        // Find all hidden cards in this grid
        const hiddenCards = Array.from(container.querySelectorAll('.hidden-product-card'));
        
        // Show the next 12 of them
        const toShow = hiddenCards.slice(0, 12);
        toShow.forEach(card => {
            card.style.display = 'flex';
            card.style.opacity = '0';
            card.style.transform = 'translateY(15px)';
            
            // Trigger layout reflow for animation
            card.offsetHeight;
            
            card.style.transition = 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
            card.classList.remove('hidden-product-card');
        });
        
        // If there are no more hidden cards, remove the button container
        const remaining = container.querySelectorAll('.hidden-product-card').length;
        if (remaining === 0) {
            btn.closest('.load-more-container').remove();
        }
    };

    // ─── Instant Navigation & Pre-fetching Engine (Turbo SPA) ───
    (function() {
        const prefetchedPages = new Map();
        const activeRequests = new Map();
        
        // Add a modern micro-progress bar at the top of the screen for network loads
        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'position:fixed; top:0; left:0; height:3px; background:var(--primary); z-index:99999; transition:width 0.4s ease, opacity 0.4s ease; width:0%; opacity:0; pointer-events:none; box-shadow:0 0 8px var(--primary);';
        document.body.appendChild(progressBar);
        
        function startProgress() {
            progressBar.style.opacity = '1';
            progressBar.style.width = '30%';
            setTimeout(() => {
                if (progressBar.style.width === '30%') progressBar.style.width = '70%';
            }, 300);
        }
        
        function endProgress() {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.opacity = '0';
                setTimeout(() => {
                    progressBar.style.width = '0%';
                }, 400);
            }, 100);
        }

        function getLocalURL(urlStr) {
            try {
                if (!urlStr) return null;
                const url = new URL(urlStr, window.location.origin);
                if (url.origin === window.location.origin) {
                    // Ignore admin, login, api, and static file extensions
                    if (url.pathname.includes('/admin') || url.pathname.includes('/api') || url.pathname.match(/\.(jpg|png|webp|gif|svg|mp4)$/) || url.search.includes('account=login')) {
                        return null;
                    }
                    return url.pathname + url.search;
                }
            } catch(e) {}
            return null;
        }

        function prefetchPage(url) {
            if (prefetchedPages.has(url) || activeRequests.has(url)) return;
            
            const controller = new AbortController();
            activeRequests.set(url, controller);
            
            fetch(url, { signal: controller.signal })
                .then(res => res.text())
                .then(html => {
                    prefetchedPages.set(url, html);
                    activeRequests.delete(url);
                })
                .catch(() => {
                    activeRequests.delete(url);
                });
        }

        // Intercept mouse hovers and touches to start prefetching instantly
        function handleLinkHover(e) {
            const link = e.target.closest('a');
            if (!link) return;
            const localUrl = getLocalURL(link.getAttribute('href'));
            if (localUrl && localUrl !== (window.location.pathname + window.location.search)) {
                prefetchPage(localUrl);
            }
        }

        // Swap document main-container smoothly with premium fade-out and fade-in
        async function swapPage(url, htmlContent, isBackAction = false) {
            startProgress();
            
            const mainContainer = document.querySelector('.main-container');
            if (!mainContainer) {
                window.location.href = url;
                return;
            }

            // Parse retrieved HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const newMain = doc.querySelector('.main-container');
            const newTitle = doc.querySelector('title');

            if (!newMain) {
                window.location.href = url;
                return;
            }

            // Premium fade-out
            mainContainer.style.transition = 'opacity 0.12s cubic-bezier(0.4, 0, 0.2, 1)';
            mainContainer.style.opacity = '0.3';
            
            await new Promise(r => setTimeout(r, 120));

            // Update title & URL
            if (newTitle) document.title = newTitle.innerText;
            if (!isBackAction) {
                window.history.pushState({ url }, '', url);
            }

            // Swap body content
            mainContainer.innerHTML = newMain.innerHTML;

            // Execute scripts inside the new main container (since innerHTML doesn't execute them)
            mainContainer.querySelectorAll('script').forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Reset scroll perfectly
            window.scrollTo({ top: 0, behavior: 'instant' });

            // Premium fade-in
            mainContainer.style.opacity = '1';

            // Re-initialize dynamic elements
            initNewPage();
            
            endProgress();
        }

        // Main navigation interceptor
        async function handleLinkClick(e) {
            const link = e.target.closest('a');
            if (!link) return;
            
            // Let browser handle normal clicks with modifier keys
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            
            const href = link.getAttribute('href');
            if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

            const localUrl = getLocalURL(href);
            if (!localUrl) return;

            e.preventDefault();
            
            // If it's already prefetched, swap it instantly!
            if (prefetchedPages.has(localUrl)) {
                swapPage(localUrl, prefetchedPages.get(localUrl));
                return;
            }

            // Otherwise, fetch now and show progress
            startProgress();
            try {
                const res = await fetch(localUrl);
                const html = await res.text();
                prefetchedPages.set(localUrl, html);
                swapPage(localUrl, html);
            } catch(err) {
                window.location.href = localUrl;
            }
        }

        function initNewPage() {
            // 0. Close any open modals during SPA navigation
            document.querySelectorAll('.modal.active').forEach(m => {
                m.classList.remove('active');
            });

            // Handle body overflow based on page type
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('app') === 'reels') {
                document.body.classList.add('reels-mode');
            } else {
                document.body.classList.remove('reels-mode');
                document.body.style.overflow = '';
            }

            // 1. Re-initialize Hero Slider logic
            window.currentSlide = 0;
            const slides = document.querySelectorAll('.slide');
            if (slides.length > 0 && typeof window.showSlide === 'function') {
                window.showSlide(0);
            }
            
            // 2. Re-trigger wholesale pricing overrides
            if (window.checkDistributorSession) {
                window.checkDistributorSession();
            }

            // 3. Re-trigger cart/fav counts
            if (window.updateCartUI) {
                window.updateCartUI();
            }

            // 4. Reset Typewriter placeholders if search input exists
            const input = document.getElementById('searchInput');
            if (input && window.searchPlaceholders) {
                input.placeholder = window.searchPlaceholders[0] || 'ابحث عن ما تحب...';
            }

            // 5. Re-initialize Reels Page if we are on it
             if (window.initReelsPage) {
                 window.initReelsPage();
             }

             // 6. Check for new reels to update badge
             if (typeof checkNewReels === 'function') {
                 checkNewReels();
             }
         }

        // Listeners for full dynamic SPA navigation
        document.addEventListener('mouseover', handleLinkHover, { passive: true });
        document.addEventListener('touchstart', handleLinkHover, { passive: true });
        document.addEventListener('click', handleLinkClick);

        // Support browser back/forward buttons (Popstate)
        window.addEventListener('popstate', async (e) => {
            const currentUrl = window.location.pathname + window.location.search;
            if (prefetchedPages.has(currentUrl)) {
                swapPage(currentUrl, prefetchedPages.get(currentUrl), true);
            } else {
                startProgress();
                try {
                    const res = await fetch(currentUrl);
                    const html = await res.text();
                    prefetchedPages.set(currentUrl, html);
                    swapPage(currentUrl, html, true);
                } catch(err) {
                    window.location.reload();
                }
            }
        });
        window.addEventListener('scroll', () => {
            const btn = document.getElementById('backToTop');
            const footer = document.querySelector('.main-footer');
            if (btn && footer) {
                const scrollPos = window.scrollY + window.innerHeight;
                const footerTop = footer.offsetTop;
                const isMobile = window.innerWidth <= 768;
                const baseBottom = isMobile ? 85 : 30;
                
                if (window.scrollY > 300) {
                    btn.classList.add('visible');
                    
                    if (scrollPos >= footerTop) {
                        // LANDED (STRADDLING FOOTER TOP EDGE)
                        const diff = scrollPos - footerTop;
                        const btnHeight = isMobile ? 40 : 45;
                        // This makes the button's center align with footer's top edge
                        btn.style.bottom = (diff - (btnHeight / 2)) + 'px';
                        btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)'; 
                        btn.style.background = 'var(--primary)'; 
                        btn.style.color = '#fff'; 
                        btn.style.border = '2px solid #fff'; // Subtle border to highlight it on the edge
                    } else {
                        // FLOATING
                        btn.style.bottom = baseBottom + 'px';
                        btn.style.boxShadow = '0 5px 15px rgba(0,0,0,0.15)';
                        btn.style.background = 'var(--primary)';
                        btn.style.color = '#fff';
                        btn.style.border = 'none';
                    }
                    
                    btn.style.left = isMobile ? '20px' : '30px';
                } else {
                    btn.classList.remove('visible');
                }
            }
        });

        // Initialize first page load
        initNewPage();
    })();
    
    // ─── Firebase FCM Registration (for Marketing Push) ───
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

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            const messaging = firebase.messaging();
            
            // Request permission
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await messaging.getToken();

                if (token) {
                    const response = await fetch('/api/fcm/register-token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, role: 'customer' })
                    });
                    
                    if (response.ok) {
                        console.log('✅ FCM Token Registered (Customer)');
                        localStorage.setItem('fcm_registered', 'true');
                        localStorage.setItem('fcm_token', token);
                    } else {
                        console.error('❌ FCM Registration failed:', response.statusText);
                    }
                }
            }
        } catch (e) {
            console.warn('FCM Init failed:', e.message);
        }
    }

    // Call on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFCM);
    } else {
        initFCM();
    }
    
    // ─── Reels (الريلز) Logic ──────────────────────────────────────────────
    async function checkNewReels() {
        try {
            const res = await fetch('/api/reels');
            const reels = await res.json();
            const notification = document.getElementById('reels-notification');
            const toast = document.getElementById('newReelFloatingToast');
            
            if (!reels || reels.length === 0) {
                if (notification) notification.style.display = 'none';
                if (toast) {
                    toast.classList.remove('show');
                    toast.style.display = 'none';
                }
                return;
            }

            // Get seen reels from localStorage
            const seenReels = JSON.parse(localStorage.getItem('seenReels') || '[]');
            const reelIds = reels.map(r => r.id);
            
            // Check if there are any new reels
            const hasNew = reelIds.some(id => !seenReels.includes(id));
            
            const urlParams = new URLSearchParams(window.location.search);
            const isReelsPage = urlParams.get('app') === 'reels';

            if (hasNew) {
                if (notification) notification.style.display = 'block';
                if (toast && !isReelsPage) {
                    toast.style.display = 'flex';
                    setTimeout(() => {
                        toast.classList.add('show');
                        // Auto-dismiss after 7 seconds
                        setTimeout(() => {
                            window.dismissNewReelToast();
                        }, 7000);
                    }, 150);
                }
            } else {
                if (notification) notification.style.display = 'none';
                if (toast) {
                    toast.classList.remove('show');
                    setTimeout(() => toast.style.display = 'none', 500);
                }
            }

            // If we are currently on the reels page, mark all as seen
            if (isReelsPage) {
                localStorage.setItem('seenReels', JSON.stringify(reelIds));
                if (notification) notification.style.display = 'none';
                if (toast) {
                    toast.classList.remove('show');
                    toast.style.display = 'none';
                }
            }
        } catch (e) {
            console.error('Error checking new reels:', e);
        }
    }

    window.dismissNewReelToast = function(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const toast = document.getElementById('newReelFloatingToast');
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.style.display = 'none', 500);
        }
    };

    // Initialize Reels check on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkNewReels);
    } else {
        checkNewReels();
    }

    function scrollReels(direction) {
        const container = document.getElementById('reels-container');
        if (!container) return;
        const scrollAmount = 300;
        container.scrollBy({ left: direction * scrollAmount * -1, behavior: 'smooth' });
    }

    // ─── Reels Page (TikTok Mode) Logic ────────────────────────────────────
    function unmuteAllVideos() {
        const videos = document.querySelectorAll('.reel-video-player');
        videos.forEach(v => {
            v.muted = false;
        });
        document.querySelectorAll('.unmute-overlay').forEach(o => o.style.display = 'none');
    }

    function scrollReel(dir) {
        const container = document.querySelector('.reels-page-container');
        if (container) {
            container.scrollBy({ top: dir * window.innerHeight, behavior: 'smooth' });
        }
    }

    function shareReel(reelId) {
        console.log('shareReel called for reel:', reelId);
        const modal = document.getElementById('reelShareModal');
        const sheet = document.getElementById('reelShareSheet');
        console.log('Modal element:', modal);
        console.log('Sheet element:', sheet);
        if (!modal || !sheet) {
            console.error('Could not find reelShareModal or reelShareSheet in DOM!');
            return;
        }

        // Build the share URL — points to this exact reel
        const shareUrl = `${window.location.origin}/?app=reels${reelId ? '#reel-' + reelId : ''}`;
        const encodedUrl = encodeURIComponent(shareUrl);
        const title = encodeURIComponent('شاهد هذا الريل المميز! 🎬');

        // Populate URL preview text
        const urlText = document.getElementById('reelShareUrlText');
        if (urlText) urlText.textContent = shareUrl;

        // Set social share hrefs
        const wa = document.getElementById('shareWA');
        const tg = document.getElementById('shareTG');
        const xBtn = document.getElementById('shareX');
        const fb = document.getElementById('shareFB');
        if (wa) wa.href = `https://wa.me/?text=${title}%20${encodedUrl}`;
        if (tg) tg.href = `https://t.me/share/url?url=${encodedUrl}&text=${title}`;
        if (xBtn) xBtn.href = `https://twitter.com/intent/tweet?text=${title}&url=${encodedUrl}`;
        if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

        // Reset copy button
        const copyLabel = document.getElementById('copyBtnLabel');
        if (copyLabel) copyLabel.textContent = 'نسخ الرابط';
        modal._shareUrl = shareUrl;

        // Show modal with animation
        modal.style.display = 'flex';
        setTimeout(() => {
            sheet.style.transform = 'translateY(0)';
        }, 30);
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
            setTimeout(() => {
                if (label) label.textContent = 'نسخ الرابط';
                if (btn) btn.style.background = 'rgba(255,255,255,0.08)';
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.cssText = 'position:fixed;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (label) label.textContent = '✓ تم النسخ!';
            if (btn) btn.style.background = 'rgba(34,197,94,0.2)';
            setTimeout(() => {
                if (label) label.textContent = 'نسخ الرابط';
                if (btn) btn.style.background = 'rgba(255,255,255,0.08)';
            }, 2000);
        });
    };

    function toggleReelLike(id) {
        // Use event.currentTarget if available, or find by context
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

    // ─── Reels Page Initialization ──────────────────────────────────────────
    function initReelsPage() {
        const container = document.querySelector('.reels-page-container');
        if (!container) return;
        
        console.log("Reels page initialized");
        const videos = document.querySelectorAll('.reel-video-player');

        // Automatically unmute all videos on first tap/click anywhere on screen
        const handleFirstInteraction = () => {
            if (typeof unmuteAllVideos === 'function') {
                unmuteAllVideos();
            }
            document.removeEventListener('click', handleFirstInteraction, true);
            document.removeEventListener('touchstart', handleFirstInteraction, true);
        };
        document.addEventListener('click', handleFirstInteraction, true);
        document.addEventListener('touchstart', handleFirstInteraction, true);
        
        // Handle deep linking to specific reel
        if (window.location.hash) {
            const targetId = window.location.hash.substring(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView();
            }
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                const section = video.parentElement;
                const productCard = section.querySelector('.reel-product-card');

                if (entry.isIntersecting) {
                    console.log("Video intersecting:", video.src);
                    video.play().catch(e => console.warn('Auto-play blocked'));
                    
                    const indicator = section.querySelector('.play-pause-indicator');
                    if (indicator) {
                        indicator.style.display = 'none';
                        indicator.style.opacity = '0';
                    }

                    if (productCard) {
                        // Clear any existing timeout
                        if (video.cardTimeout) clearTimeout(video.cardTimeout);
                        
                        video.cardTimeout = setTimeout(() => {
                            if (video.parentElement && video.currentTime > 0) {
                                productCard.classList.add('show');
                            }
                        }, 1000);
                    }
                } else {
                    video.pause();
                    video.currentTime = 0;
                    video.loopCount = 0; // Reset loop count when scrolling away
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
            v.loopCount = 0; // Track how many times it has finished
            
            v.addEventListener('ended', () => {
                v.loopCount++;
                console.log("Video loop count:", v.loopCount);
                
                // Manually loop the video since we removed the 'loop' attribute to catch 'ended' event
                v.play().catch(e => console.warn('Manual loop play blocked'));

                if (v.loopCount >= 2) {
                    const section = v.parentElement;
                    let indicator = section.querySelector('.reels-scroll-indicator');
                    
                    if (!indicator) {
                        indicator = document.createElement('div');
                        indicator.className = 'reels-scroll-indicator';
                        indicator.innerHTML = `
                            <div class="scroll-mouse">
                                <div class="scroll-wheel"></div>
                            </div>
                            <div class="scroll-text">اسحب لأسفل للمزيد</div>
                        `;
                        section.appendChild(indicator);
                    }
                    
                    setTimeout(() => indicator.classList.add('show'), 100);
                    
                    // Hide after 5 seconds to not be annoying
                    setTimeout(() => {
                        indicator.classList.remove('show');
                    }, 5000);
                }
            });

            observer.observe(v);
            
            const section = v.parentElement;
            // Use click instead of pointerdown to avoid blocking scroll
            section.addEventListener('click', (e) => {
                if (e.target.closest('.reel-product-card') || 
                    e.target.closest('.reel-side-actions') || 
                    e.target.closest('.unmute-overlay') ||
                    e.target.closest('.reel-back-btn') ||
                    e.target.closest('.reels-navigation')) return;
                
                const indicator = section.querySelector('.play-pause-indicator');
                
                if (v.paused) {
                    v.play().catch(err => console.error("Play failed:", err));
                    if (indicator) {
                        indicator.innerHTML = '<i class="fa fa-play"></i>';
                        // Flash and hide
                        indicator.style.display = 'flex';
                        indicator.style.opacity = '1';
                        indicator.style.transform = 'translate(-50%, -50%) scale(1.5)';
                        setTimeout(() => {
                            indicator.style.opacity = '0';
                            indicator.style.transform = 'translate(-50%, -50%) scale(1)';
                            setTimeout(() => { indicator.style.display = 'none'; }, 300);
                        }, 400);
                    }
                } else {
                    v.pause();
                    if (indicator) {
                        indicator.innerHTML = '<i class="fa fa-play"></i>';
                        indicator.style.display = 'flex';
                        indicator.style.opacity = '1';
                        indicator.style.transform = 'translate(-50%, -50%) scale(1)';
                    }
                }
            });
        });

        function showIndicator(indicator) {
            // This function is now handled inline for better control
        }

        // Auto-play first video
        setTimeout(() => {
            if (videos[0]) videos[0].play().catch(e => {});
        }, 500);
    }

    window.scrollReels = scrollReels;
    window.unmuteAllVideos = unmuteAllVideos;
    window.scrollReel = scrollReel;
    window.shareReel = shareReel;
    window.toggleReelLike = toggleReelLike;
    window.initReelsPage = initReelsPage;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReelsPage);
    } else {
        initReelsPage();
    }


    
