const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const FCM_TOKENS_PATH = path.join(__dirname, '../data/fcm-tokens.json');

let firebaseApp = null;

function getFirebaseApp() {
    if (firebaseApp) return firebaseApp;
    try {
        const serviceAccount = require(path.join(__dirname, '../data/firebase-service-account.json'));
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch(e) {
        // Already initialized
        try { firebaseApp = admin.app(); } catch(e2) {
            console.error('Firebase Admin init error:', e2.message);
            return null;
        }
    }
    return firebaseApp;
}

function removeInvalidToken(badToken) {
    try {
        if (!fs.existsSync(FCM_TOKENS_PATH)) return;
        let tokens = JSON.parse(fs.readFileSync(FCM_TOKENS_PATH, 'utf8'));
        const before = tokens.length;
        tokens = tokens.filter(t => t.token !== badToken);
        if (tokens.length < before) {
            fs.writeFileSync(FCM_TOKENS_PATH, JSON.stringify(tokens, null, 2));
            console.log('🗑️ Removed expired/invalid FCM token');
        }
    } catch(e) {
        console.warn('Could not remove invalid token:', e.message);
    }
}

/**
 * Send push notification to a single FCM token
 */
async function sendPushNotification(token, title, body, data = {}) {
    try {
        const app = getFirebaseApp();
        if (!app) return { success: false, error: 'Firebase not initialized' };

        const message = {
            notification: { 
                title, 
                body,
                ...(data.imageUrl ? { image: data.imageUrl } : {})
            },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
            token
        };

        const response = await admin.messaging(app).send(message);
        console.log('✅ FCM push sent:', response);
        return { success: true, response };
    } catch (err) {
        console.error('❌ FCM push error:', err.message, '| token:', token.slice(0, 20) + '...');
        
        // Auto-remove invalid/expired tokens
        const errMsg = (err.message || '') + (err.code || '');
        const isInvalid = errMsg.includes('registration-token-not-registered') 
                       || errMsg.includes('invalid-registration-token')
                       || errMsg.includes('INVALID_ARGUMENT');
        if (isInvalid) {
            removeInvalidToken(token);
        }
        
        return { success: false, error: err.message };
    }
}

/**
 * Send push to ALL registered tokens, returns summary
 */
async function sendPushToAll(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) return [];
    const results = await Promise.all(
        tokens.map(token => sendPushNotification(token, title, body, data))
    );
    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`📊 FCM Summary: ${sent} sent, ${failed} failed out of ${tokens.length} tokens`);
    return results;
}

module.exports = { sendPushNotification, sendPushToAll };
