const express = require('express');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Firebase Admin ──
let serviceAccount;
try {
  serviceAccount = require('./data/firebase-service-account.json');
} catch (_) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_B64:', err);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
}

if (serviceAccount) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase Admin initialized');
} else {
  console.warn('⚠️ Firebase Admin not initialized — no service account found');
}

// ── Supabase (service role) ──
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://psoatzqqzdknrzslhvvt.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
} else {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set — cannot query FCM tokens');
}

// ── API Key check ──
function auth(req, res, next) {
  const key = process.env.API_SECRET_KEY;
  if (!key) return next(); // no key configured = allow all
  if (req.headers.authorization === `Bearer ${key}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Send push notification for new order ──
app.post('/api/notify-order', auth, async (req, res) => {
  try {
    const { orderId, total, customerName } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    if (!supabase) throw new Error('Supabase not configured');
    if (!admin.apps.length) throw new Error('Firebase Admin not configured');

    const { data: tokens, error } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('role', 'admin');

    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      return res.json({ sent: 0, total: 0, message: 'No admin tokens' });
    }

    const payload = {
      notification: {
        title: 'طلب جديد وارد! \uD83D\uDED2',
        body: `طلب رقم ${orderId} بقيمة ${total || '?'} \u20AA من ${customerName || 'عميل'}`,
      },
      android: {
        notification: {
          sound: 'mane',
          channelId: 'orders_channel_v3', // unique channel to force sound binding
        }
      },
      data: {
        orderId: String(orderId),
        type: 'new_order',
        url: '/dashboard.html',
      },
      webpush: {
        fcmOptions: { link: '/dashboard.html' },
      },
    };

    const responses = await Promise.allSettled(
      tokens.map(t => admin.messaging().send({ ...payload, token: t.token }))
    );

    const sent = responses.filter(r => r.status === 'fulfilled').length;
    const errors = responses.filter(r => r.status === 'rejected').map(r => r.reason?.code);
    console.log(`Push sent to ${sent}/${tokens.length} devices`);
    if (errors.length) console.warn('FCM errors:', errors.join(', '));

    res.json({ sent, total: tokens.length });
  } catch (err) {
    console.error('Push error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Health ──
app.get('/health', (_req, res) => res.json({ ok: true, firebase: admin.apps.length > 0, supabase: !!supabase }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`\uD83D\uDD14 Push notification server on port ${PORT}`));
