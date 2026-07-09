// ── Sound Effects (Web Audio API - No external files needed) ──────────────────
const _audioCtx = () => new (window.AudioContext || window.webkitAudioContext)();

function playAddToCartSound() {
    try {
        const ctx = _audioCtx();
        // Two-tone "ding" - satisfying add sound
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
        // Descending "swoosh" for removal
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
        fetch('/api/analytics/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: eventName })
        }).catch(() => {});
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    // Track visit only once per session entry
    if (!sessionStorage.getItem('visited')) {
        trackEvent('visit');
        sessionStorage.setItem('visited', 'true');
    }
});

function addToCart(id, name, price, image, color, size) {
    let cart = getCart();
    let existingItem = cart.find(item => item.id === id && item.color === color && item.size === size);
    
    if (existingItem) {
        existingItem.quantity += 1;
        playQuantitySound();
    } else {
        cart.push({ id, name, price, image, color, size, quantity: 1 });
        playAddToCartSound();
    }
    
    saveCart(cart);
    showToast('تمت إضافة المنتج للسلة بنجاح! 🛒');
    
    // Internal Tracking
    trackEvent('add_to_cart');
    
    // Pixel Tracking
    if (typeof window.trackStoreEvent === 'function') {
        window.trackStoreEvent('AddToCart', { id, name, price, color, size });
    }
}

function updateCartUI() {
    const cartCountEl = document.getElementById('cart-count');
    if(cartCountEl) {
        let cart = getCart();
        let total = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountEl.innerText = total;
    }
    updateFavUI();
}

// Wishlist Logic
function getFavorites() {
    return JSON.parse(localStorage.getItem('wishlist')) || [];
}

function saveFavorites(wishlist) {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateFavUI();
}

function toggleFavorite(id, name, price, image) {
    let wishlist = getFavorites();
    let index = wishlist.findIndex(item => item.id === id);
    
    // Play sound if available
    if (typeof playSfx === 'function') playSfx('click');

    if (index !== -1) {
        wishlist.splice(index, 1);
        showToast('تمت إزالة المنتج من المفضلة 💔');
    } else {
        wishlist.push({ id, name, price, image });
        showToast('تمت إضافة المنتج للمفضلة ❤️');
    }
    
    saveFavorites(wishlist);

    // Update the button visual state immediately if event exists
    if (window.event && window.event.currentTarget) {
        const btn = window.event.currentTarget;
        const isFavBtn = btn.classList.contains('fav-btn') || 
                         btn.classList.contains('arr-sl-fav') || 
                         btn.classList.contains('rec-sl-fav');
        
        if (isFavBtn) {
            const isInWishlist = wishlist.some(item => item.id === id);
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

    // Also update all heart buttons on the page
    const allFavBtns = document.querySelectorAll('.fav-btn, .arr-sl-fav, .rec-sl-fav');
    allFavBtns.forEach(btn => {
        // We need the ID. We can try to extract it from the onclick attribute if not present in data-id
        let id = btn.getAttribute('data-id');
        if (!id) {
            const onclick = btn.getAttribute('onclick');
            const match = onclick ? onclick.match(/toggleFavorite\(['"]([^'"]+)['"]/) : null;
            if (match) id = match[1];
        }

        if (id) {
            const isInWishlist = wishlist.some(item => item.id === id);
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
