-- ============================================
-- Pro Store - Supabase Database Schema
-- ============================================

-- 1. Settings (key-value store for all store config)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  sale_price NUMERIC,
  wholesale_price NUMERIC,
  cost_price NUMERIC,
  sku TEXT DEFAULT '',
  image TEXT DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  description TEXT DEFAULT '',
  categories JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT '',
  admin_note TEXT DEFAULT '',
  fake_visitors BOOLEAN DEFAULT false,
  fake_stock BOOLEAN DEFAULT false,
  fake_timer BOOLEAN DEFAULT false,
  is_landing_page BOOLEAN DEFAULT false,
  landing_sections JSONB DEFAULT '[]'::jsonb,
  variants JSONB DEFAULT '[]'::jsonb,
  variants_data JSONB DEFAULT '[]'::jsonb,
  advanced JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  parent_id TEXT,
  meta_title TEXT DEFAULT '',
  meta_desc TEXT DEFAULT '',
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_brand BOOLEAN DEFAULT false
);

-- 4. Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT now(),
  customer JSONB DEFAULT '{}'::jsonb,
  items JSONB DEFAULT '[]'::jsonb,
  total NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  coupon_code TEXT DEFAULT '',
  status TEXT DEFAULT 'جديد',
  utm_source TEXT DEFAULT '',
  utm_campaign TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  visited_pages JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  time_spent TEXT DEFAULT '',
  session_count TEXT DEFAULT '1',
  first_visit TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  ip_country TEXT DEFAULT '',
  is_wholesale BOOLEAN DEFAULT false,
  distributor_id TEXT DEFAULT '',
  stock_subtracted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 5. Coupons
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'percentage',
  value NUMERIC DEFAULT 0,
  min_order NUMERIC DEFAULT 0,
  max_uses INT DEFAULT 0,
  used_count INT DEFAULT 0,
  target_phone TEXT,
  product_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Distributors
CREATE TABLE IF NOT EXISTS distributors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  password TEXT NOT NULL,
  business_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Pages
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT DEFAULT '',
  type TEXT DEFAULT 'page',
  status TEXT DEFAULT 'draft',
  thumbnail TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Reels
CREATE TABLE IF NOT EXISTS reels (
  id TEXT PRIMARY KEY,
  video_url TEXT NOT NULL,
  title TEXT DEFAULT '',
  product_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 9. Promotions
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  occasion_id TEXT NOT NULL,
  occasion_name TEXT DEFAULT '',
  occasion_emoji TEXT DEFAULT '',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  discount_type TEXT DEFAULT 'percentage',
  discount_value NUMERIC DEFAULT 0,
  min_order NUMERIC DEFAULT 0,
  show_banner BOOLEAN DEFAULT true,
  banner_text TEXT DEFAULT '',
  banner_bg_color TEXT DEFAULT '#ef4444',
  banner_text_color TEXT DEFAULT '#ffffff',
  banner_image TEXT DEFAULT '',
  banner_custom_css TEXT DEFAULT '',
  all_products BOOLEAN DEFAULT true,
  categories JSONB DEFAULT '[]'::jsonb,
  product_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Notifications (marketing)
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY,
  title TEXT DEFAULT 'تنبيه جديد',
  message TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  target TEXT DEFAULT 'all',
  target_phone TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  views INT DEFAULT 0,
  read_by JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ
);

-- 11. Analytics
CREATE TABLE IF NOT EXISTS analytics (
  id INT PRIMARY KEY DEFAULT 1,
  visits INT DEFAULT 0,
  add_to_cart INT DEFAULT 0,
  init_checkout INT DEFAULT 0,
  history JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default analytics row
INSERT INTO analytics (id, visits, add_to_cart, init_checkout, history)
VALUES (1, 0, 0, 0, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 12. Abandoned carts
CREATE TABLE IF NOT EXISTS abandoned (
  session_id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Pending Reviews
CREATE TABLE IF NOT EXISTS pending_reviews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rating INT DEFAULT 5,
  text TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Custom Templates
CREATE TABLE IF NOT EXISTS custom_templates (
  id BIGINT PRIMARY KEY,
  title TEXT DEFAULT '',
  message TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. FCM Tokens
CREATE TABLE IF NOT EXISTS fcm_tokens (
  token TEXT PRIMARY KEY,
  role TEXT DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Wholesale Prices
CREATE TABLE IF NOT EXISTS wholesale_prices (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  wholesale_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Banner Presets
CREATE TABLE IF NOT EXISTS banner_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'my-presets',
  bg_color TEXT NOT NULL,
  text_color TEXT DEFAULT '#ffffff',
  custom_css TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Enable Row Level Security (RLS)
-- Since we use anon key, we need permissive policies
-- ============================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_presets ENABLE ROW LEVEL SECURITY;

-- Allow anon (public) full access for now (can be tightened later)
CREATE POLICY "Allow all for anon" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON distributors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON reels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON promotions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON abandoned FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON pending_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON custom_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON fcm_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON wholesale_prices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON banner_presets FOR ALL USING (true) WITH CHECK (true);
