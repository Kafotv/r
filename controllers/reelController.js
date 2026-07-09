const dbHelper = require('../utils/dbHelper');

const reelController = {
    // جلب جميع الريلز
    getReels: (req, res) => {
        try {
            const db = dbHelper.readData();
            res.json(db.reels || []);
        } catch (e) {
            console.error('Error fetching reels:', e);
            res.status(500).json({ error: 'فشل جلب الريلز' });
        }
    },

    // إضافة ريل جديد
    addReel: (req, res) => {
        try {
            const { videoUrl, title, productId } = req.body;
            if (!videoUrl) {
                return res.status(400).json({ error: 'رابط الفيديو مطلوب' });
            }

            const db = dbHelper.readData();
            db.reels = db.reels || [];

            const newReel = {
                id: 'reel_' + Date.now(),
                videoUrl,
                title: title || '',
                productId: productId || null,
                createdAt: new Date().toISOString()
            };

            db.reels.push(newReel);
            dbHelper.writeData(db);

            res.json({ success: true, reel: newReel });
        } catch (e) {
            console.error('Error adding reel:', e);
            res.status(500).json({ error: 'فشل إضافة الريل' });
        }
    },

    // حذف ريل
    deleteReel: (req, res) => {
        try {
            const { id } = req.params;
            const db = dbHelper.readData();
            db.reels = db.reels || [];

            db.reels = db.reels.filter(r => r.id !== id);
            dbHelper.writeData(db);

            res.json({ success: true });
        } catch (e) {
            console.error('Error deleting reel:', e);
            res.status(500).json({ error: 'فشل حذف الريل' });
        }
    },

    // تحديث ريل
    updateReel: (req, res) => {
        try {
            const { id } = req.params;
            const { title, productId, videoUrl } = req.body;
            const db = dbHelper.readData();
            db.reels = db.reels || [];

            const index = db.reels.findIndex(r => r.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'الريل غير موجود' });
            }

            db.reels[index] = {
                ...db.reels[index],
                title: title !== undefined ? title : db.reels[index].title,
                productId: productId !== undefined ? productId : db.reels[index].productId,
                videoUrl: videoUrl !== undefined ? videoUrl : db.reels[index].videoUrl,
                updatedAt: new Date().toISOString()
            };

            dbHelper.writeData(db);
            res.json({ success: true, reel: db.reels[index] });
        } catch (e) {
            console.error('Error updating reel:', e);
            res.status(500).json({ error: 'فشل تحديث الريل' });
        }
    }
};

module.exports = reelController;
