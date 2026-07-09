const express = require('express');
const path = require('path');
const queryRouter = require('./core/queryRouter');
const dbHelper = require('./utils/dbHelper');

const fs = require('fs');

// FCM Tokens storage path
const FCM_TOKENS_PATH = path.join(__dirname, 'data', 'fcm-tokens.json');
const PRESETS_PATH = path.join(__dirname, 'data', 'banner_presets.json');


function readFcmTokens() {
    if (!fs.existsSync(FCM_TOKENS_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(FCM_TOKENS_PATH, 'utf8')); } catch(e) { return []; }
}

function saveFcmToken(token, role) {
    let tokens = readFcmTokens();
    if (!tokens.find(t => t.token === token)) {
        tokens.push({ token, role: role || 'admin', createdAt: new Date().toISOString() });
        fs.writeFileSync(FCM_TOKENS_PATH, JSON.stringify(tokens, null, 2));
    }
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const accountController = require('./controllers/accountController');
const reelController = require('./controllers/reelController');

// Serve dynamic pages
app.get('/page/:slug', accountController.render_page);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));

// API لرفع الملفات (صور وفيديو - Base64)
app.post('/api/upload', (req, res) => {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'بيانات ناقصة' });

    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // Sanitize filename: keep only safe characters
    const ext = path.extname(name) || '';
    const baseName = path.basename(name, ext)
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_')  // replace special chars with _
        .replace(/_+/g, '_')                    // collapse multiple underscores
        .substring(0, 60);                       // limit length
    const safeFileName = Date.now() + '-' + baseName + ext.toLowerCase();
    const filePath = path.join(uploadDir, safeFileName);

    // Strip base64 header (works for images, video, audio, any type)
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) return res.status(500).json({ error: 'فشل حفظ الملف' });
        res.json({ url: `/uploads/${safeFileName}` });
    });
});

// API لرفع الفيديو (Multipart - بدون حد حجم base64)
app.post('/api/upload-file', (req, res) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    let fileBuffer = Buffer.alloc(0);
    let originalName = 'video.mp4';
    let boundary = '';

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'Invalid multipart request' });
    boundary = '--' + boundaryMatch[1];

    req.on('data', chunk => { fileBuffer = Buffer.concat([fileBuffer, chunk]); });
    req.on('end', () => {
        try {
            // Parse multipart manually
            const str = fileBuffer.toString('binary');
            const parts = str.split(boundary);
            for (const part of parts) {
                if (part.includes('filename="')) {
                    const nameMatch = part.match(/filename="([^"]+)"/);
                    if (nameMatch) originalName = nameMatch[1];
                    // Find double CRLF (header/body separator)
                    const bodyStart = part.indexOf('\r\n\r\n') + 4;
                    const bodyEnd = part.lastIndexOf('\r\n');
                    if (bodyStart > 4 && bodyEnd > bodyStart) {
                        const fileData = Buffer.from(part.slice(bodyStart, bodyEnd), 'binary');
                        const ext = path.extname(originalName) || '.mp4';
                        const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 60);
                        const safeFileName = Date.now() + '-' + baseName + ext.toLowerCase();
                        const filePath = path.join(uploadDir, safeFileName);
                        fs.writeFileSync(filePath, fileData);
                        return res.json({ url: `/uploads/${safeFileName}` });
                    }
                }
            }
            res.status(400).json({ error: 'لم يتم العثور على ملف في الطلب' });
        } catch(e) {
            console.error('Upload-file error:', e);
            res.status(500).json({ error: 'فشل حفظ الملف' });
        }
    });
});

// API للحصول على المنتجات
app.get('/api/products', (req, res) => {
    const dbPath = path.join(__dirname, 'data', 'db.json');
    if (!fs.existsSync(dbPath)) return res.json([]);
    const db = JSON.parse(fs.readFileSync(dbPath));
    res.json(db.products || []);
});

// Product Feed for Ads (Facebook/Google)
app.get('/api/products/feed', accountController.export_product_feed);

// Import Products from JSON
app.post('/api/products/import-json', accountController.import_products_json);

// API للحصول على التصنيفات
app.get('/api/categories', (req, res) => {
    const dbPath = path.join(__dirname, 'data', 'db.json');
    if (!fs.existsSync(dbPath)) return res.json([]);
    const db = JSON.parse(fs.readFileSync(dbPath));
    res.json(db.categories || []);
});

// ===== API Testimonials (Customer Reviews) Submission & Approval =====

// API لإرسال تقييم جديد من قبل الزبون (بانتظار المراجعة)
app.post('/api/testimonials/submit', (req, res) => {
    try {
        const { name, rating, text, avatar } = req.body;
        if (!name || !text) {
            return res.status(400).json({ error: 'الاسم ونص التقييم مطلوبان' });
        }
        
        const db = dbHelper.readData();
        db.pending_reviews = db.pending_reviews || [];
        
        const newReview = {
            id: 'rev_' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: name.trim(),
            rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
            text: text.trim(),
            avatar: avatar ? avatar.trim() : '',
            createdAt: new Date().toISOString()
        };
        
        db.pending_reviews.push(newReview);
        dbHelper.writeData(db);
        
        res.json({ success: true, review: newReview });
    } catch(e) {
        console.error('Error submitting testimonial:', e);
        res.status(500).json({ error: 'فشل إرسال التقييم' });
    }
});

// API لجلب التقييمات المعلقة (للوحة التحكم)
app.get('/api/testimonials/pending', (req, res) => {
    try {
        const db = dbHelper.readData();
        res.json(db.pending_reviews || []);
    } catch(e) {
        res.status(500).json({ error: 'فشل جلب التقييمات المعلقة' });
    }
});

// API للموافقة على تقييم معلق وحذفه من قائمة الانتظار
app.post('/api/testimonials/approve', (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'معرف التقييم مطلوب' });
        
        const db = dbHelper.readData();
        db.pending_reviews = db.pending_reviews || [];
        
        // حذف من القائمة المعلقة
        db.pending_reviews = db.pending_reviews.filter(r => r.id !== id);
        dbHelper.writeData(db);
        
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'فشل الموافقة على التقييم' });
    }
});

// API لرفض وحذف تقييم معلق
app.post('/api/testimonials/reject', (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'معرف التقييم مطلوب' });
        
        const db = dbHelper.readData();
        db.pending_reviews = db.pending_reviews || [];
        
        // حذف من القائمة المعلقة
        db.pending_reviews = db.pending_reviews.filter(r => r.id !== id);
        dbHelper.writeData(db);
        
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'فشل رفض التقييم' });
    }
});

// ===== Reels (الريلز) APIs =====
app.get('/api/reels', reelController.getReels);
app.post('/api/reels', reelController.addReel);
app.put('/api/reels/:id', reelController.updateReel);
app.delete('/api/reels/:id', reelController.deleteReel);

// API لجلب الإعدادات (للوحة التحكم - قراءة home_sections_json وغيرها)
app.get('/api/settings', (req, res) => {
    try {
        const db = dbHelper.readData();
        res.json(db.settings || {});
    } catch(e) {
        res.status(500).json({ error: 'فشل جلب الإعدادات' });
    }
});

// API لحفظ الإعدادات (من تاب التقييمات - لإضافة تقييم معتمد لقسم الآراء)
app.post('/api/settings', (req, res) => {
    try {
        const db = dbHelper.readData();
        // Only allow updating home_sections_json and safe settings keys
        const allowed = ['home_sections_json', 'reelsShuffle'];
        allowed.forEach(key => {
            if (req.body[key] !== undefined) {
                db.settings = db.settings || {};
                db.settings[key] = req.body[key];
            }
        });
        dbHelper.writeData(db);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'فشل حفظ الإعدادات' });
    }
});

// API للحصول على جميع الطلبات (للوحة التحكم)
app.get('/api/orders', (req, res) => {
    try {
        const orders = dbHelper.readOrders() || [];
        res.json(orders);
    } catch(e) {
        res.status(500).json({ error: 'Failed to read orders' });
    }
});

// Get orders count for dashboard live notification
app.get('/api/dashboard/orders-count', (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        
        const orders = dbHelper.readOrders() || [];
        const newestOrder = orders.length > 0 ? orders[0] : null;
        res.json({
            count: orders.length,
            newestOrder: newestOrder ? {
                id: newestOrder.id,
                name: newestOrder.customer ? newestOrder.customer.name : '—',
                city: newestOrder.customer ? newestOrder.customer.city : '—',
                total: newestOrder.total
            } : null
        });
    } catch(e) {
        res.status(500).json({ error: 'Failed to read orders' });
    }
});

// ===== FCM Push Notification APIs =====

// Register a new FCM device token (called when admin opens dashboard)
app.post('/api/fcm/register-token', (req, res) => {
    try {
        const { token, role } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });
        saveFcmToken(token, role);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Failed to save token' });
    }
});

// Send push to all registered admin devices (called after new order is placed)
app.post('/api/fcm/notify-new-order', async (req, res) => {
    try {
        const { orderId, name, total, city } = req.body;
        const tokens = readFcmTokens();
        
        if (tokens.length === 0) {
            return res.json({ success: false, message: 'No registered admin devices' });
        }
        
        // Try to use firebase-admin if available
        let results = [];
        try {
            const { sendPushToAll } = require('./utils/fcmHelper');
            results = await sendPushToAll(
                tokens.map(t => t.token),
                `💰 طلب جديد وارد بقيمة ${total} ₪!`,
                `الزبون: ${name} | المدينة: ${city}`,
                { orderId: String(orderId), total: String(total) }
            );
        } catch(fcmErr) {
            console.warn('firebase-admin not available:', fcmErr.message);
        }
        
        res.json({ success: true, results });
    } catch(e) {
        res.status(500).json({ error: 'Failed to send push' });
    }
});

// ===== Coupons Management APIs =====
app.post('/api/marketing/send-notification', async (req, res) => {
    try {
        const { title, message, url, imageUrl, target, targetPhone } = req.body;
        if (!message) return res.status(400).json({ error: 'نص الرسالة مطلوب' });

        const db = dbHelper.readData();
        db.notifications = db.notifications || [];

        const newNotification = {
            id: Date.now(),
            title: title || 'تنبيه جديد',
            message,
            url: url || null,
            imageUrl: imageUrl || null,
            target, // 'all', 'merchants', 'users', 'specific'
            targetPhone: target === 'specific' ? targetPhone : null,
            sentAt: new Date().toISOString(),
            views: 0, // إحصائية المشاهدات
            readBy: []
        };

        db.notifications.push(newNotification);
        dbHelper.writeData(db);

        // --- إرسال الإشعار فعلياً عبر Firebase ---
        const tokensData = readFcmTokens();
        let targetTokens = [];

        if (target === 'all') {
            targetTokens = tokensData.map(t => t.token);
        } else if (target === 'merchants') {
            targetTokens = tokensData.filter(t => t.role === 'admin').map(t => t.token);
        } else if (target === 'users') {
            targetTokens = tokensData.filter(t => t.role === 'customer' || !t.role).map(t => t.token);
        }

        if (targetTokens.length > 0) {
            try {
                const { sendPushToAll } = require('./utils/fcmHelper');
                await sendPushToAll(
                    targetTokens,
                    newNotification.title,
                    newNotification.message,
                    { 
                        url: newNotification.url || '', 
                        imageUrl: newNotification.imageUrl || '',
                        notifId: String(newNotification.id)
                    }
                );
            } catch(fcmErr) {
                console.error('⚠️ FCM Marketing Error:', fcmErr.message);
            }
        }

        res.json({ success: true, notification: newNotification });
    } catch(e) {
        res.status(500).json({ error: 'فشل إرسال الإشعار' });
    }
});

app.get('/api/marketing/notifications', (req, res) => {
    try {
        const db = dbHelper.readData();
        res.json(db.notifications || []);
    } catch(e) {
        res.status(500).json({ error: 'فشل جلب الإشعارات' });
    }
});

app.delete('/api/marketing/notifications/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const db = dbHelper.readData();
        db.notifications = (db.notifications || []).filter(n => n.id !== id);
        dbHelper.writeData(db);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'فشل حذف الإشعار' });
    }
});

app.put('/api/marketing/notifications/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, message, url, imageUrl, target, targetPhone } = req.body;
        const db = dbHelper.readData();
        
        const idx = (db.notifications || []).findIndex(n => n.id === id);
        if(idx === -1) return res.status(404).json({ error: 'الإشعار غير موجود' });

        db.notifications[idx] = {
            ...db.notifications[idx],
            title, message, url, imageUrl, target, targetPhone,
            updatedAt: new Date().toISOString()
        };

        dbHelper.writeData(db);

        // --- إعادة إرسال الإشعار بعد التعديل عبر Firebase ---
        const tokensData = readFcmTokens();
        let targetTokens = [];

        if (target === 'all') {
            targetTokens = tokensData.map(t => t.token);
        } else if (target === 'merchants') {
            targetTokens = tokensData.filter(t => t.role === 'admin').map(t => t.token);
        } else if (target === 'users') {
            targetTokens = tokensData.filter(t => t.role === 'customer' || !t.role).map(t => t.token);
        }

        if (targetTokens.length > 0) {
            try {
                const { sendPushToAll } = require('./utils/fcmHelper');
                await sendPushToAll(
                    targetTokens,
                    db.notifications[idx].title,
                    db.notifications[idx].message,
                    { 
                        url: db.notifications[idx].url || '', 
                        imageUrl: db.notifications[idx].imageUrl || '',
                        notifId: String(db.notifications[idx].id)
                    }
                );
            } catch(fcmErr) {
                console.error('⚠️ FCM Update/Resend Error:', fcmErr.message);
            }
        }

        res.json({ success: true, notification: db.notifications[idx] });
    } catch(e) {
        res.status(500).json({ error: 'فشل تحديث وإرسال الإشعار' });
    }
});

// ===== Custom Templates APIs =====
app.post('/api/marketing/custom-templates', (req, res) => {
    try {
        const { title, message, imageUrl } = req.body;
        const db = dbHelper.readData();
        db.customTemplates = db.customTemplates || [];
        
        const newTemplate = { id: Date.now(), title, message, imageUrl: imageUrl || null };
        db.customTemplates.push(newTemplate);
        dbHelper.writeData(db);
        res.json({ success: true, template: newTemplate });
    } catch(e) { res.status(500).json({ error: 'فشل حفظ القالب' }); }
});

app.get('/api/marketing/custom-templates', (req, res) => {
    try {
        const db = dbHelper.readData();
        res.json(db.customTemplates || []);
    } catch(e) { res.status(500).json({ error: 'فشل جلب القوالب' }); }
});

app.delete('/api/marketing/custom-templates/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const db = dbHelper.readData();
        db.customTemplates = (db.customTemplates || []).filter(t => t.id !== id);
        dbHelper.writeData(db);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'فشل حذف القالب' }); }
});

// ===== Upload Marketing Image (Manual Multipart) =====
app.post('/api/marketing/upload-image', (req, res) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    let fileBuffer = Buffer.alloc(0);
    let originalName = 'marketing-image.png';
    let boundary = '';

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'Invalid multipart request' });
    boundary = '--' + boundaryMatch[1];

    req.on('data', chunk => { fileBuffer = Buffer.concat([fileBuffer, chunk]); });
    req.on('end', () => {
        try {
            const str = fileBuffer.toString('binary');
            const parts = str.split(boundary);
            for (const part of parts) {
                if (part.includes('filename="')) {
                    const nameMatch = part.match(/filename="([^"]+)"/);
                    if (nameMatch) originalName = nameMatch[1];
                    const bodyStart = part.indexOf('\r\n\r\n') + 4;
                    const bodyEnd = part.lastIndexOf('\r\n');
                    if (bodyStart > 4 && bodyEnd > bodyStart) {
                        const fileData = Buffer.from(part.slice(bodyStart, bodyEnd), 'binary');
                        const ext = path.extname(originalName) || '.png';
                        const fileName = Date.now() + "_notif" + ext.toLowerCase();
                        const filePath = path.join(uploadDir, fileName);
                        fs.writeFileSync(filePath, fileData);
                        return res.json({ success: true, imageUrl: `/uploads/${fileName}` });
                    }
                }
            }
            res.status(400).json({ error: 'لم يتم العثور على ملف' });
        } catch(e) {
            res.status(500).json({ error: 'فشل حفظ الملف المرفوع' });
        }
    });
});

app.get('/api/coupons', (req, res) => {
    try {
        const db = dbHelper.readData();
        res.json(db.coupons || []);
    } catch(e) {
        res.status(500).json({ error: 'فشل قراءة الكوبونات' });
    }
});

app.post('/api/coupons', (req, res) => {
    try {
        const { code, type, value, minOrder, maxUses, targetPhone, productIds } = req.body;
        if (!code || !type || value === undefined) {
            return res.status(400).json({ error: 'بيانات الكوبون غير كاملة' });
        }
        
        const db = dbHelper.readData();
        db.coupons = db.coupons || [];
        
        const upperCode = code.trim().toUpperCase();
        const existing = db.coupons.find(c => c.code.toUpperCase() === upperCode);
        if (existing) {
            return res.status(400).json({ error: 'كود الخصم هذا مسجل بالفعل' });
        }
        
        const newCoupon = {
            code: upperCode,
            type: type, // 'percentage' or 'fixed'
            value: parseFloat(value) || 0,
            minOrder: parseFloat(minOrder) || 0,
            maxUses: parseInt(maxUses) || 0,
            usedCount: 0,
            targetPhone: targetPhone ? targetPhone.trim() : null,
            productIds: Array.isArray(productIds) ? productIds : [],
            createdAt: new Date().toISOString()
        };
        
        db.coupons.push(newCoupon);
        dbHelper.writeData(db);
        res.json({ success: true, coupon: newCoupon });
    } catch(e) {
        res.status(500).json({ error: 'فشل حفظ الكوبون' });
    }
});

app.delete('/api/coupons/:code', (req, res) => {
    try {
        const codeToDelete = req.params.code.trim().toUpperCase();
        const db = dbHelper.readData();
        db.coupons = db.coupons || [];
        
        const filtered = db.coupons.filter(c => c.code.toUpperCase() !== codeToDelete);
        db.coupons = filtered;
        dbHelper.writeData(db);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'فشل حذف الكوبون' });
    }
});

app.put('/api/coupons/:code', (req, res) => {
    try {
        const oldCode = req.params.code.trim().toUpperCase();
        const { code, type, value, minOrder, maxUses, targetPhone, productIds } = req.body;
        const db = dbHelper.readData();
        db.coupons = db.coupons || [];

        const index = db.coupons.findIndex(c => c.code.toUpperCase() === oldCode);
        if (index === -1) return res.status(404).json({ error: 'الكوبون غير موجود' });

        // التحديث
        db.coupons[index] = {
            ...db.coupons[index],
            code: code.trim().toUpperCase(),
            type,
            value: parseFloat(value),
            minOrder: parseFloat(minOrder),
            maxUses: parseInt(maxUses),
            targetPhone: targetPhone ? targetPhone.trim() : null,
            productIds: Array.isArray(productIds) ? productIds : [],
            updatedAt: new Date().toISOString()
        };

        dbHelper.writeData(db);
        res.json({ success: true, coupon: db.coupons[index] });
    } catch(e) {
        res.status(500).json({ error: 'فشل تحديث الكوبون' });
    }
});

app.get('/api/validate-coupon', (req, res) => {
    try {
        const code = (req.query.code || '').trim().toUpperCase();
        const phone = (req.query.phone || '').trim();
        const cartJson = req.query.cart || '[]';
        let cart = [];
        try { cart = JSON.parse(cartJson); } catch(e) { cart = []; }

        if (!code) return res.json({ valid: false, error: 'يرجى إدخال كود الخصم' });
        
        const db = dbHelper.readData();
        const coupon = (db.coupons || []).find(c => c.code.toUpperCase() === code);
        
        if (!coupon) return res.json({ valid: false, error: 'كود الخصم غير موجود' });
        
        // 1. التحقق من عدد الاستخدامات
        if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
            return res.json({ valid: false, error: 'عذراً، هذا الكوبون استنفد عدد مرات الاستخدام المسموح بها' });
        }

        // 2. التحقق من رقم الهاتف
        if (coupon.targetPhone && coupon.targetPhone !== phone) {
            return res.json({ valid: false, error: 'هذا الكوبون مخصص لعميل آخر بموجب رقم الهاتف' });
        }

        // 3. التحقق من المنتجات المشمولة
        if (coupon.productIds && coupon.productIds.length > 0) {
            const hasRestrictedItems = cart.some(item => coupon.productIds.includes(String(item.id)));
            if (!hasRestrictedItems) {
                return res.json({ valid: false, error: 'هذا الكوبون لا يشمل المنتجات الموجودة في سلتك حالياً' });
            }
        }
        
        res.json({ valid: true, coupon });
    } catch(e) {
        res.json({ valid: false, error: 'فشل التحقق من الكوبون' });
    }
});

// ===== Distributor APIs =====
// ===== Distributor APIs =====

// Register as distributor
app.post('/api/distributor/register', (req, res) => {
    const { name, phone, password, businessName, email, notes, city, address } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: 'الاسم والهاتف وكلمة المرور مطلوبة' });
    
    // --- Phone Number Validation (Backend) ---
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
        return res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح مكون من 10 أرقام' });
    }

    const distributors = dbHelper.readDistributors();
    const existing = distributors.find(d => d.phone === phone);
    if (existing) return res.status(400).json({ error: 'هذا الرقم مسجل مسبقاً' });
    const newDist = {
        id: 'DIST-' + Date.now(),
        name, phone, password, businessName: businessName || '', email: email || '',
        city: city || '', address: address || '',
        notes: notes || '', status: 'pending',
        createdAt: new Date().toISOString()
    };
    distributors.push(newDist);
    dbHelper.writeDistributors(distributors);
    res.json({ success: true, id: newDist.id });
});

// Distributor login (by phone)
app.post('/api/distributor/login', (req, res) => {
    const { phone, password } = req.body;
    const distributors = dbHelper.readDistributors();
    const dist = distributors.find(d => d.phone === phone);
    if (!dist) return res.status(404).json({ error: 'الرقم غير مسجل' });
    if (dist.password !== password) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    if (dist.status === 'pending') return res.status(403).json({ error: 'طلبك قيد المراجعة من الإدارة' });
    if (dist.status === 'rejected') return res.status(403).json({ error: 'تم رفض طلبك. تواصل مع الإدارة' });
    res.json({ success: true, distributor: dist });
});

// Get all distributors (admin)
app.get('/api/distributors', (req, res) => {
    res.json(dbHelper.readDistributors());
});

// Approve / Reject distributor (admin)
app.post('/api/distributor/status', (req, res) => {
    const { id, status } = req.body;
    const distributors = dbHelper.readDistributors();
    const idx = distributors.findIndex(d => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'موزع غير موجود' });
    distributors[idx].status = status;
    dbHelper.writeDistributors(distributors);
    res.json({ success: true });
});

// Edit distributor (admin)
app.post('/api/distributor/edit', (req, res) => {
    const { id, name, phone, password, businessName, status } = req.body;
    const distributors = dbHelper.readDistributors();
    const idx = distributors.findIndex(d => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'موزع غير موجود' });
    if (name) distributors[idx].name = name;
    if (phone) distributors[idx].phone = phone;
    if (password) distributors[idx].password = password; // Admin changes password
    if (businessName !== undefined) distributors[idx].businessName = businessName;
    if (status) distributors[idx].status = status;
    dbHelper.writeDistributors(distributors);
    res.json({ success: true });
});

// ===== Pages Management APIs =====

app.get('/api/pages', (req, res) => {
    try {
        res.json(dbHelper.readPages());
    } catch (e) {
        res.status(500).json({ error: 'فشل جلب الصفحات' });
    }
});

app.post('/api/pages', (req, res) => {
    try {
        const { id, title, slug, content, type, status } = req.body;
        if (!title || !slug || !content) return res.status(400).json({ error: 'البيانات الأساسية مطلوبة' });

        const pages = dbHelper.readPages();
        const now = new Date().toISOString();

        if (id) {
            // Update
            const idx = pages.findIndex(p => p.id === id);
            if (idx === -1) return res.status(404).json({ error: 'الصفحة غير موجودة' });
            
            // Check slug uniqueness (excluding current)
            if (pages.some(p => p.slug === slug && p.id !== id)) {
                return res.status(400).json({ error: 'الرابط الفرعي (Slug) مستخدم بالفعل' });
            }

            pages[idx] = { ...pages[idx], title, slug, content, type, status, updatedAt: now };
        } else {
            // Create
            if (pages.some(p => p.slug === slug)) {
                return res.status(400).json({ error: 'الرابط الفرعي (Slug) مستخدم بالفعل' });
            }
            const newPage = { id: 'PAGE-' + Date.now(), title, slug, content, type, status, createdAt: now, updatedAt: now };
            pages.push(newPage);
        }

        dbHelper.writePages(pages);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'فشل حفظ الصفحة' });
    }
});

app.delete('/api/pages/:id', (req, res) => {
    try {
        const id = req.params.id;
        let pages = dbHelper.readPages();
        pages = pages.filter(p => p.id !== id);
        dbHelper.writePages(pages);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'فشل حذف الصفحة' });
    }
});

// Get purchased products for distributor (admin)
app.get('/api/distributor/purchased-products', (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    
    const orders = dbHelper.readOrders();
    const distOrders = orders.filter(o => o.customer && o.customer.phone === phone);
    
    const productsMap = {};
    distOrders.forEach(o => {
        (o.items || []).forEach(item => {
            const variantKey = `${item.id}-${item.color || ''}-${item.size || ''}`;
            if (!productsMap[variantKey]) {
                productsMap[variantKey] = {
                    id: item.id,
                    name: item.name,
                    image: item.image,
                    color: item.color || '',
                    size: item.size || '',
                    quantity: 0,
                    totalSpent: 0,
                    orders: []
                };
            }
            productsMap[variantKey].quantity += parseInt(item.quantity || 1);
            productsMap[variantKey].totalSpent += parseFloat(item.price || 0) * parseInt(item.quantity || 1);
            productsMap[variantKey].orders.push({
                orderId: o.id,
                date: o.date,
                status: o.status,
                price: item.price,
                quantity: item.quantity
            });
        });
    });
    
    res.json(Object.values(productsMap));
});


// Get wholesale prices for logged-in distributor
app.get('/api/wholesale-prices', (req, res) => {
    const { phone } = req.query;
    const distributors = dbHelper.readDistributors();
    const dist = distributors.find(d => d.phone === phone && d.status === 'approved');
    if (!dist) return res.status(403).json({ error: 'غير مصرح' });
    const db = dbHelper.readData();
    const prices = {};
    (db.products || []).forEach(p => {
        if (p.wholesalePrice) prices[p.id] = p.wholesalePrice;
    });
    res.json({ prices, distributor: dist });
});

// الموجه الذكي (Smart Router)
app.use('/', queryRouter);

// نظام معالجة الأخطاء
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('حدث خطأ في النظام، جارِ المعالجة!');
});

// AI Product Generation API (Simulated)
app.post('/api/ai/generate', (req, res) => {
    const { reviews_count, faqs_count, features_count, language, dialect, country, description } = req.body;
    
    // Simulate AI processing delay
    setTimeout(() => {
        const generatedData = {
            name: `${description.substring(0, 30)}...`,
            description: `
<div style="font-family: inherit; line-height: 1.6;">
    <h2 style="color:var(--primary); border-bottom: 2px solid var(--primary); padding-bottom: 10px; margin-bottom: 20px;">نظرة عامة على المنتج</h2>
    <p>هذا المنتج المبتكر تم تطويره خصيصاً ليناسب السوق في <strong>${country}</strong>. باستخدام أحدث التقنيات، نضمن لك تجربة مستخدم لا مثيل لها تلبي كافة احتياجاتك اليومية والاحترافية.</p>
    
    <div style="background: #f8fafc; padding: 20px; border-radius: 15px; margin: 25px 0; border: 1px dashed var(--primary);">
        <h3 style="margin-top: 0;"><i class="fas fa-star"></i> لماذا تختار هذا المنتج؟</h3>
        <ul style="padding-right: 20px;">
            ${Array.from({length: features_count}).map((_, i) => `<li style="margin-bottom: 10px;"><strong>الميزة ${i+1}:</strong> تصميم عصري ومتانة عالية تضمن لك الاستخدام لفترات طويلة دون تراجع في الأداء.</li>`).join('')}
        </ul>
    </div>

    <h3><i class="fas fa-question-circle"></i> الأسئلة الشائعة (FAQ)</h3>
    <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 30px;">
        ${Array.from({length: faqs_count}).map((_, i) => `
            <div style="background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px;">
                <p style="margin: 0; font-weight: 700; color: var(--primary);">س: هل المنتج متوفر بلهجة ${dialect}؟</p>
                <p style="margin: 10px 0 0 0; color: #64748b;">ج: نعم، المنتج يدعم اللغة ${language} وجميع الخصائص موجهة لخدمة العملاء في ${country}.</p>
            </div>
        `).join('')}
    </div>

    <h3><i class="fas fa-comments"></i> مراجعات العملاء الموثقة</h3>
    <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
        ${Array.from({length: reviews_count}).map((_, i) => `
            <div style="background: #fff; border: 1px solid #eee; padding: 15px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 800; font-size: 14px;">عميل موثق من ${country}</span>
                    <div style="color: #f59e0b; font-size: 12px;">
                        <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                    </div>
                </div>
                <p style="margin: 0; font-size: 13px; color: #475569;">"تجربة شرائية رائعة، المنتج وصل في وقت قياسي وبجودة فاقت توقعاتي. أنصح الجميع بالتعامل مع هذا المتجر."</p>
            </div>
        `).join('')}
    </div>
</div>
            `.trim()
        };
        res.json(generatedData);
    }, 2000);
});

app.get('/api/abandoned', (req, res) => {
    try {
        const abandonedPath = path.join(__dirname, 'data', 'abandoned.json');
        if (!fs.existsSync(abandonedPath)) return res.json([]);
        const data = JSON.parse(fs.readFileSync(abandonedPath, 'utf8') || '[]');
        // Return sorted by most recent first
        data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        res.json(data);
    } catch(e) { res.json([]); }
});

app.post('/api/abandoned', (req, res) => {
    try {
        const abandonedPath = path.join(__dirname, 'data', 'abandoned.json');
        const existing = fs.existsSync(abandonedPath) ? JSON.parse(fs.readFileSync(abandonedPath,'utf8')||'[]') : [];
        const { sessionId, name, phone, email, items, city, address } = req.body;
        if(!sessionId || !phone) return res.json({ ok: false });
        const idx = existing.findIndex(c => c.sessionId === sessionId || c.phone === phone);
        const entry = { sessionId, name, phone, email, city, address, items: items||[], updatedAt: new Date().toISOString() };
        if(idx > -1) existing[idx] = { ...existing[idx], ...entry };
        else existing.push(entry);
        fs.writeFileSync(abandonedPath, JSON.stringify(existing, null, 2));
        res.json({ ok: true });
    } catch(e) { res.json({ ok: false }); }
});

app.delete('/api/abandoned/:sessionId', (req, res) => {
    try {
        const abandonedPath = path.join(__dirname, 'data', 'abandoned.json');
        let data = fs.existsSync(abandonedPath) ? JSON.parse(fs.readFileSync(abandonedPath,'utf8')||'[]') : [];
        data = data.filter(c => c.sessionId !== req.params.sessionId && c.phone !== req.params.sessionId);
        fs.writeFileSync(abandonedPath, JSON.stringify(data, null, 2));
        res.json({ ok: true });
    } catch(e) { res.json({ ok: false }); }
});

// ===== Analytics APIs =====
app.post('/api/analytics/event', (req, res) => {
    try {
        const { event } = req.body; // 'visit', 'add_to_cart', 'init_checkout'
        if (!['visit', 'add_to_cart', 'init_checkout'].includes(event)) return res.json({ ok: false });

        const stats = dbHelper.readAnalytics();
        const today = new Date().toISOString().split('T')[0];

        // Update overall counts
        stats[event] = (stats[event] || 0) + 1;

        // Update history (daily tracking)
        let dayEntry = stats.history.find(h => h.date === today);
        if (!dayEntry) {
            dayEntry = { date: today, visit: 0, add_to_cart: 0, init_checkout: 0, orders: 0, revenue: 0 };
            stats.history.push(dayEntry);
        }
        dayEntry[event] = (dayEntry[event] || 0) + 1;

        // Keep history to last 30 days
        if (stats.history.length > 30) stats.history.shift();

        dbHelper.writeAnalytics(stats);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false }); }
});

app.get('/api/analytics/stats', (req, res) => {
    try {
        const analytics = dbHelper.readAnalytics();
        const orders = dbHelper.readOrders();
        const db = dbHelper.readData();

        // Calculate total revenue and today's orders
        const today = new Date().toISOString().split('T')[0];
        let totalRevenue = 0;
        let todayRevenue = 0;
        let todayOrders = 0;

        orders.forEach(o => {
            const total = parseFloat(o.total || 0);
            totalRevenue += total;
            const orderDate = new Date(o.date || o.createdAt).toISOString().split('T')[0];
            if (orderDate === today) {
                todayOrders++;
                todayRevenue += total;
            }
        });

        const avgOrderValue = orders.length > 0 ? (totalRevenue / orders.length) : 0;

        // Update history with accurate order count and revenue if missing or needs update
        let dayEntry = analytics.history.find(h => h.date === today);
        if (dayEntry) {
            dayEntry.orders = todayOrders;
            dayEntry.revenue = todayRevenue;
        }

        // Calculate City Stats
        const cityMap = {};
        orders.forEach(o => {
            const city = o.customer ? o.customer.city : 'غير محدد';
            const rev = parseFloat(o.total || 0);
            if (!cityMap[city]) cityMap[city] = { name: city, revenue: 0 };
            cityMap[city].revenue += rev;
        });
        const cityStats = Object.values(cityMap).sort((a, b) => b.revenue - a.revenue);

        // Calculate Top Products
        const prodMap = {};
        orders.forEach(o => {
            (o.items || []).forEach(item => {
                if (!prodMap[item.id]) {
                    prodMap[item.id] = { 
                        id: item.id, 
                        name: item.name, 
                        image: item.image, 
                        count: 0, 
                        revenue: 0 
                    };
                }
                const qty = parseInt(item.quantity || 1);
                prodMap[item.id].count += qty;
                prodMap[item.id].revenue += parseFloat(item.price || 0) * qty;
            });
        });
        const topProducts = Object.values(prodMap).sort((a, b) => b.count - a.count).slice(0, 10);

        res.json({
            summary: {
                totalRevenue,
                todayRevenue,
                todayOrders,
                avgOrderValue,
                totalProducts: (db.products || []).length,
                totalVisits: analytics.visit || 0,
                totalAddToCart: analytics.add_to_cart || 0,
                totalInitCheckout: analytics.init_checkout || 0,
                totalOrders: orders.length
            },
            history: analytics.history,
            cityStats,
            topProducts
        });
    } catch (e) { res.status(500).json({ error: 'Failed to fetch analytics' }); }
});

// ===== Seasonal Promotions APIs =====
const PROMOTIONS_PATH = path.join(__dirname, 'data', 'promotions.json');

function readPromotions() {
    if (!fs.existsSync(PROMOTIONS_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(PROMOTIONS_PATH, 'utf8')); } catch(e) { return []; }
}
function writePromotions(data) {
    fs.writeFileSync(PROMOTIONS_PATH, JSON.stringify(data, null, 2));
}

// GET all promotions (admin)
app.get('/api/promotions', (req, res) => {
    try { res.json(readPromotions()); } catch(e) { res.status(500).json({ error: 'فشل قراءة العروض' }); }
});

// GET all products (for dashboard/scope selection)
app.get('/api/raw-products', (req, res) => {
    try {
        const db = dbHelper.readData();
        res.json(db.products || []);
    } catch(e) { res.status(500).json({ error: 'فشل قراءة المنتجات' }); }
});

// GET active promotion for storefront (public)
app.get('/api/promotions/active', (req, res) => {
    try {
        const now = new Date();
        const promos = readPromotions();
        const active = promos.filter(p => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            return now >= start && now <= end;
        });
        res.json(active);
    } catch(e) { res.status(500).json({ error: 'فشل قراءة العروض النشطة' }); }
});

// POST create promotion
app.post('/api/promotions', (req, res) => {
    try {
        const { occasionId, occasionName, occasionEmoji, startDate, endDate,
                discountType, discountValue, minOrder, showBanner, bannerText, bannerBgColor, bannerTextColor, bannerImage, bannerCustomCss,
                allProducts, categories, productIds } = req.body;
        if (!occasionId || !startDate || !endDate) {
            return res.status(400).json({ error: 'بيانات العرض غير مكتملة' });
        }
        const promos = readPromotions();
        const newPromo = {
            id: 'PROMO-' + Date.now(),
            occasionId, occasionName, occasionEmoji,
            startDate, endDate,
            discountType: discountType || 'percentage',
            discountValue: parseFloat(discountValue) || 0,
            minOrder: parseFloat(minOrder) || 0,
            showBanner: showBanner !== false,
            bannerText: bannerText || '',
            bannerBgColor: bannerBgColor || '#ef4444',
            bannerTextColor: bannerTextColor || '#ffffff',
            bannerImage: bannerImage || '',
            bannerCustomCss: bannerCustomCss || '',
            allProducts: allProducts !== false,
            categories: categories || [],
            productIds: productIds || [],
            createdAt: new Date().toISOString()
        };
        promos.push(newPromo);
        writePromotions(promos);
        res.json({ success: true, promotion: newPromo });
    } catch(e) { res.status(500).json({ error: 'فشل حفظ العرض' }); }
});

// PUT update promotion
app.put('/api/promotions/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        let promos = readPromotions();
        const index = promos.findIndex(p => p.id === id);
        
        if (index === -1) return res.status(404).json({ error: 'العرض غير موجود' });
        
        promos[index] = {
            ...promos[index],
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        
        writePromotions(promos);
        res.json({ success: true, promotion: promos[index] });
    } catch(e) { res.status(500).json({ error: 'فشل تحديث العرض' }); }
});

// DELETE promotion
app.delete('/api/promotions/:id', (req, res) => {
    try {
        let promos = readPromotions();
        promos = promos.filter(p => p.id !== req.params.id);
        writePromotions(promos);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'فشل حذف العرض' }); }
});

// --- Banner Presets APIs ---
function readPresets() {
    if (!fs.existsSync(PRESETS_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8')); } catch(e) { return []; }
}

function writePresets(presets) {
    fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2));
}

app.get('/api/banner-presets', (req, res) => {
    try { res.json(readPresets()); } catch(e) { res.status(500).json({ error: 'فشل قراءة القوالب' }); }
});

app.post('/api/banner-presets', (req, res) => {
    try {
        const { name, category, bgColor, textColor, customCss } = req.body;
        if (!name || !bgColor) return res.status(400).json({ error: 'بيانات القالب غير مكتملة' });
        
        const presets = readPresets();
        const newPreset = {
            id: 'PRESET-' + Date.now(),
            name,
            category: category || 'my-presets',
            bgColor,
            textColor,
            customCss,
            isDefault: false,
            createdAt: new Date().toISOString()
        };
        presets.push(newPreset);
        writePresets(presets);
        res.json({ success: true, preset: newPreset });
    } catch(e) { res.status(500).json({ error: 'فشل حفظ القالب' }); }
});

// ===== Distributor Management APIs =====
app.get('/api/distributors', (req, res) => {
    try {
        const db = dbHelper.readData();
        res.json(db.distributors || []);
    } catch(e) {
        res.status(500).json({ error: 'فشل جلب الموزعين' });
    }
});

app.post('/api/distributor/status', (req, res) => {
    try {
        const { id, status } = req.body;
        const db = dbHelper.readData();
        const idx = (db.distributors || []).findIndex(d => d.id == id);
        if(idx !== -1) {
            db.distributors[idx].status = status;
            dbHelper.writeData(db);
        }
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'فشل تحديث حالة الموزع' });
    }
});

// ===== Products Pricing APIs =====
app.post('/api/products/bulk-wholesale', (req, res) => {
    try {
        const { updates } = req.body;
        const db = dbHelper.readData();
        
        updates.forEach(upd => {
            const pIdx = db.products.findIndex(p => p.id == upd.id);
            if(pIdx !== -1) {
                db.products[pIdx].wholesalePrice = upd.wholesalePrice;
            }
        });
        
        dbHelper.writeData(db);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'فشل تحديث الأسعار' });
    }
});

// ===== Pages Management APIs =====
app.get('/api/pages', (req, res) => {
    try { res.json(dbHelper.readPages()); } catch(e) { res.status(500).json({ error: 'فشل جلب الصفحات' }); }
});

app.post('/api/pages', (req, res) => {
    try {
        const { title, slug, content, type, status, thumbnail } = req.body;
        if (!title || !slug) return res.status(400).json({ error: 'العنوان والرابط الفرعي مطلوبان' });
        
        const pages = dbHelper.readPages();
        const newPage = {
            id: 'PAGE-' + Date.now(),
            title, slug, content, type, status, thumbnail,
            updatedAt: new Date().toISOString()
        };
        pages.push(newPage);
        dbHelper.writePages(pages);
        res.json({ success: true, page: newPage });
    } catch(e) { res.status(500).json({ error: 'فشل حفظ الصفحة' }); }
});

app.put('/api/pages/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        let pages = dbHelper.readPages();
        const index = pages.findIndex(p => p.id === id);
        
        if (index === -1) return res.status(404).json({ error: 'الصفحة غير موجودة' });
        
        pages[index] = {
            ...pages[index],
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        
        dbHelper.writePages(pages);
        res.json({ success: true, page: pages[index] });
    } catch(e) { res.status(500).json({ error: 'فشل تحديث الصفحة' }); }
});

app.delete('/api/pages/:id', (req, res) => {
    try {
        let pages = dbHelper.readPages();
        pages = pages.filter(p => p.id !== req.params.id);
        dbHelper.writePages(pages);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'فشل حذف الصفحة' }); }
});
// ===== Analytics APIs (Behavior Tracking) =====
app.post('/api/analytics/event', (req, res) => {
    try {
        const { event } = req.body;
        if (!event) return res.status(400).json({ error: 'Event name required' });

        const analytics = dbHelper.readAnalytics();
        const today = new Date().toISOString().split('T')[0];

        // Ensure history structure
        if (!analytics.history) analytics.history = [];
        let dayData = analytics.history.find(h => h.date === today);
        if (!dayData) {
            dayData = { date: today, visit: 0, add_to_cart: 0, init_checkout: 0, orders: 0, revenue: 0 };
            analytics.history.push(dayData);
        }

        // Limit history to last 30 days
        if (analytics.history.length > 30) analytics.history.shift();

        // Increment event counts
        if (event === 'visit') {
            analytics.visits = (analytics.visits || 0) + 1;
            dayData.visit++;
        } else if (event === 'add_to_cart') {
            analytics.add_to_cart = (analytics.add_to_cart || 0) + 1;
            dayData.add_to_cart++;
        } else if (event === 'init_checkout') {
            analytics.start_checkout = (analytics.start_checkout || 0) + 1;
            dayData.init_checkout++;
        }

        dbHelper.writeAnalytics(analytics);
        res.json({ success: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Analytics failure' }); }
});

app.get('/api/analytics/stats', (req, res) => {
    try {
        const analytics = dbHelper.readAnalytics();
        const orders = dbHelper.readOrders();
        const today = new Date().toISOString().split('T')[0];

        // 1. Core Summary
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        const todayOrders = orders.filter(o => (o.date || o.createdAt || '').startsWith(today));
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        // 2. City Stats
        const cityMap = {};
        orders.forEach(o => {
            const city = (o.customer && o.customer.city) ? o.customer.city : 'غير معروف';
            if (!cityMap[city]) cityMap[city] = { orders: 0, revenue: 0 };
            cityMap[city].orders++;
            cityMap[city].revenue += parseFloat(o.total) || 0;
        });
        const cityStats = Object.entries(cityMap)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // 3. Top Products (by quantity in orders)
        const productMap = {};
        orders.forEach(o => {
            if (o.items) {
                o.items.forEach(item => {
                    if (!productMap[item.id]) productMap[item.id] = { name: item.name, image: item.image, count: 0, revenue: 0 };
                    productMap[item.id].count += item.quantity || 1;
                    productMap[item.id].revenue += (parseFloat(item.price) * (item.quantity || 1)) || 0;
                });
            }
        });
        const topProducts = Object.values(productMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 4. Sync history
        analytics.history.forEach(h => {
            const hOrders = orders.filter(o => (o.date || o.createdAt || '').startsWith(h.date));
            h.orders = hOrders.length;
            h.revenue = hOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        });

        res.json({
            summary: {
                totalVisits: analytics.visits || 0,
                totalAddToCart: analytics.add_to_cart || 0,
                totalInitCheckout: analytics.start_checkout || 0,
                totalOrders: totalOrders,
                totalRevenue: totalRevenue,
                todayOrders: todayOrders.length,
                todayRevenue: todayOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0),
                avgOrderValue: avgOrderValue
            },
            history: analytics.history || [],
            cityStats,
            topProducts
        });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Stats failure' }); }
});


app.listen(port, () => {

    console.log(`🚀 النظام الاحترافي يعمل بنجاح على الرابط http://localhost:${port}`);
});
