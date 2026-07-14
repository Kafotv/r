// ============================================
// Pro Store - Configuration
// ============================================

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://psoatzqqzdknrzslhvvt.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb2F0enFxemRrbnJ6c2xodnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1OTg4NTYsImV4cCI6MjA5OTE3NDg1Nn0.p98fbmfHp7tnYq5qChH3UVbZ_rHIw21kpFaknemhGPs',

  // imgbb
  IMGBB_API_KEY: 'b3c8f2f99f17b4556b4dbfc0597fb85b',
  IMGBB_UPLOAD_URL: 'https://api.imgbb.com/1/upload',

  // Store defaults (overridden by Supabase settings)
  STORE_NAME: 'مجوهرات UL',
  STORE_PHONE: '972568313507',
  CURRENCY: '₪',
  MAIN_COLOR: '#fa0000',

  // Push notification server (set this after deploying server.js)
  PUSH_SERVER_URL: '', // e.g. 'https://your-app.onrender.com'

  // Admin credentials are stored securely in Supabase settings table
  // Do NOT add passwords here — this file is public!
};
