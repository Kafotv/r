// ── Sound Effects (Web Audio API - No external files needed) ──────────────────
const _audioCtx = () => new (window.AudioContext || window.webkitAudioContext)();

function playAddToCartSound() {
    try {
        const ctx = _audioCtx();
        [0, 0.12].forEach((delay, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(i === 0 ? 523 : 784, ctx.currentTime + delay);
            gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.35);
        });
    } catch(e) {}
}

function playQuantitySound() {
    try {
        const ctx = _audioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
    } catch(e) {}
}

function playRemoveSound() {
    try {
        const ctx = _audioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
}
// ─────────────────────────────────────────────────────────────────────────────

function getCart() {
    return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

window.trackEvent = function(eventName) {
    try {
        if (window.DB && DB.trackEvent) {
            DB.trackEvent(eventName);
        }
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    if (!sessionStorage.getItem('visited')) {
        trackEvent('visit');
        sessionStorage.setItem('visited', 'true');
    }
});

function addToCart(id, name, price, image, color, size) {
    let isWholesale = false;
    // Override price with wholesale price if logged in as a distributor/merchant
    if (window.wholesalePrices && window.wholesalePrices[id]) {
        isWholesale = true;
        const product = window.StoreInit && Array.isArray(window.StoreInit.products) 
            ? window.StoreInit.products.find(p => String(p.id) === String(id)) 
            : null;
        
        if (product) {
            const retailPrice = parseFloat(product.price);
            const salePrice = product.salePrice ? parseFloat(product.salePrice) : null;
            if (price === retailPrice || (salePrice && price === salePrice)) {
                price = parseFloat(window.wholesalePrices[id]);
            }
        } else {
            const wsPrice = parseFloat(window.wholesalePrices[id]);
            if (price > wsPrice) {
                price = wsPrice;
            }
        }
    }
    let cart = getCart();
    let existingItem = cart.find(item => item.id === id && item.color === color && item.size === size);
    
    if (existingItem) {
        existingItem.quantity += 1;
        if (isWholesale) existingItem.isWholesale = true;
        playQuantitySound();
    } else {
        cart.push({ id, name, price, image, color, size, quantity: 1, isWholesale });
        playAddToCartSound();
    }
    
    saveCart(cart);
    showToast('تمت إضافة المنتج للسلة بنجاح! 🛒');
    
    trackEvent('add_to_cart');
    
    if (typeof window.trackStoreEvent === 'function') {
        window.trackStoreEvent('AddToCart', { id, name, price, color, size });
    }
}

function updateCartUI() {
    let cart = getCart();
    let total = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountEl = document.getElementById('cart-count');
    if(cartCountEl) cartCountEl.innerText = total;
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = total; });
    if (typeof updateFloatingCartBar === 'function') {
        updateFloatingCartBar();
    }
    updateFavUI();
}

// Wishlist Logic
function getFavorites() {
    let list = JSON.parse(localStorage.getItem('wishlist')) || [];
    return list.filter(item => {
        if (!item) return false;
        const id = typeof item === 'string' ? item : item.id;
        return id && id !== 'undefined';
    });
}

function saveFavorites(wishlist) {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateFavUI();
}

function toggleFavorite(id, name, price, image) {
    if (!id || id === 'undefined') return;
    let wishlist = getFavorites();
    let index = wishlist.findIndex(item => item.id === id);
    
    if (typeof playSfx === 'function') playSfx('click');

    if (index !== -1) {
        wishlist.splice(index, 1);
        showToast('تمت إزالة المنتج من المفضلة 💔');
    } else {
        let isWholesale = false;
        if (window.wholesalePrices && window.wholesalePrices[id]) {
            isWholesale = true;
            const product = window.StoreInit && Array.isArray(window.StoreInit.products) 
                ? window.StoreInit.products.find(p => String(p.id) === String(id)) 
                : null;
            if (product) {
                name = product.name;
                image = product.image;
                price = parseFloat(window.wholesalePrices[id]);
            } else {
                price = parseFloat(window.wholesalePrices[id]);
            }
        } else if (!name && window.StoreInit && Array.isArray(window.StoreInit.products)) {
            const p = window.StoreInit.products.find(prod => String(prod.id) === String(id));
            if (p) {
                name = p.name;
                price = p.price;
                image = p.image;
            }
        }
        wishlist.push({ id, name: name || 'منتج', price: price || 0, image: image || '', isWholesale });
        showToast('تمت إضافة المنتج للمفضلة ❤️');
    }
    
    saveFavorites(wishlist);

    if (window.event && window.event.currentTarget) {
        const btn = window.event.currentTarget;
        const isFavBtn = btn.classList.contains('fav-btn') || 
                         btn.classList.contains('arr-sl-fav') || 
                         btn.classList.contains('rec-sl-fav');
        
        if (isFavBtn) {
            const isInWishlist = wishlist.some(item => String(item.id) === String(id));
            btn.classList.toggle('active', isInWishlist);
            const icon = btn.querySelector('i');
            if (icon) {
                if (isInWishlist) {
                    icon.classList.remove('fa-regular', 'far');
                    icon.classList.add('fa-solid', 'fas');
                } else {
                    icon.classList.remove('fa-solid', 'fas');
                    icon.classList.add('fa-regular', 'far');
                }
            }
        }
    }
}

function updateFavUI() {
    const favCountEl = document.querySelectorAll('.fav-count, #fav-count');
    let wishlist = getFavorites();
    
    favCountEl.forEach(el => {
        el.innerText = wishlist.length;
    });

    const allFavBtns = document.querySelectorAll('.fav-btn, .arr-sl-fav, .rec-sl-fav');
    allFavBtns.forEach(btn => {
        let id = btn.getAttribute('data-id');
        if (!id) {
            const onclick = btn.getAttribute('onclick');
            const match = onclick ? onclick.match(/toggleFavorite\(['"]([^'"]+)['"]/) : null;
            if (match) id = match[1];
        }

        if (id) {
            const isInWishlist = wishlist.some(item => String(item.id) === String(id));
            btn.classList.toggle('active', isInWishlist);
            const icon = btn.querySelector('i');
            if (icon) {
                if (isInWishlist) {
                    icon.classList.remove('fa-regular', 'far');
                    icon.classList.add('fa-solid', 'fas');
                } else {
                    icon.classList.remove('fa-solid', 'fas');
                    icon.classList.add('fa-regular', 'far');
                }
            }
        }
    });
}

function showToast(message) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: #000; color: #fff; padding: 12px 30px; border-radius: 50px;
            font-size: 14px; font-weight: 600; z-index: 9999;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2); transition: 0.3s;
            display: flex; align-items: center; gap: 10px;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    toast.style.display = 'flex';
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 2500);
}

// ── window.cart API (used by store-init.js product/quick-add flows) ──────────
window.cart = {
    init() {
        updateCartUI();
    },
    addItem(item) {
        const id = item.id;
        const color = item.color || undefined;
        const size = item.size || undefined;
        const qty = parseInt(item.quantity) || 1;
        let cart = getCart();
        const existing = cart.find(i => i.id === id && i.color === color && i.size === size);
        if (existing) {
            existing.quantity += qty;
        } else {
            cart.push({
                id,
                name: item.name,
                price: item.price,
                image: item.image,
                color,
                size,
                quantity: qty
            });
        }
        saveCart(cart);
        showToast('تمت إضافة المنتج للسلة بنجاح! 🛒');
        trackEvent('add_to_cart');
        if (typeof window.trackStoreEvent === 'function') {
            window.trackStoreEvent('AddToCart', item);
        }
    },
    getItems() {
        return getCart();
    },
    getCount() {
        return getCart().reduce((sum, item) => sum + (item.quantity || 0), 0);
    },
    removeItem(index) {
        const cart = getCart();
        cart.splice(index, 1);
        saveCart(cart);
    },
    updateQuantity(index, delta) {
        const cart = getCart();
        if (!cart[index]) return;
        cart[index].quantity = Math.max(1, (cart[index].quantity || 1) + delta);
        saveCart(cart);
    }
};
