// ============================================
// Pro Store - Data Migration to Supabase
// Run this ONCE to import all existing data
// Open this file in browser after setting up tables
// ============================================

async function migrateData() {
  console.log('🚀 Starting data migration to Supabase...');

  // 1. Migrate Settings
  console.log('📝 Migrating settings...');
  const settingsData = {
    storeName: 'مجوهرات UL', domain: 'store.com', currency: '₪',
    socialLinks: '', cod: true, stripe: false, stripeKey: '',
    shippingCost: '0', metaTitle: 'مجوهرات UL', metaDesc: 'أفضل منتجات الأناقة',
    fbPixel: '', gtm: '', snapPixel: '', tiktokPixel: '',
    popupEnabled: false, popupImage: '',
    popupTitle: 'عرض خاص لفترة محدودة! 🔥',
    popupDesc: 'احصل على خصم إضافي عند طلبك الأول من المتجر.',
    popupLink: '',
    privacyPolicy: 'سياسة الخصوصية الخاصة بنا...',
    refundPolicy: 'يحق لك الاسترجاع خلال 14 يوماً...',
    aboutUs: 'نحن متجر متخصص في بيع أفضل المنتجات...',
    mainColor: '#fa0000', checkoutPhoneRequired: true, checkoutAddressRequired: true,
    thankYouMessage: 'شكراً لتسوقك معنا! سنتواصل معك قريباً لتأكيد الطلب.',
    cities: [{name:'الضفة',price:20},{name:'القدس',price:30},{name:'الداخل',price:70}],
    city_names: ['الخليل','القدس '], city_prices: ['20','30'],
    storePhone: '972568313507', adminEmail: 'saifpsx@gmail.com', adminPass: 'saifps4ps', adminPhone: '0591234567',
    announcementText: '🌟 أفضل المنتجات بأفضل الأسعار | توصيل سريع لباب المنزل',
    instagramUrl: 'https://instagram.com/ulsilver',
    facebookUrl: 'https://facebook.com/ulsilver',
    snapchatUrl: 'https://snapchat.com/add/ulsilver',
    whatsappUrl: '972568313507',
    showSlider: 'true', showSidebarFilter: 'true', showPwaBanner: 'true',
    showWhatsappBubble: 'true', heroType: 'slider',
    slider_json: '[]', home_sections_json: '[]',
    searchPlaceholders: 'ابحث عن ما تحب... , هدية الحب الابدي... , خاتم فضة... ,',
    brandsTitle: 'العلامات التجارية', showBrandsSidebar: false,
    popups_json: '[]', popups: [], reelsShuffle: true,
    storeLogo: '', bannerImage: '', bannerTitle: '', bannerDesc: '',
    bannerLink: '', videoUrl: '', videoTitle: '', videoDesc: ''
  };

  const settingsRows = Object.entries(settingsData).map(([key, value]) => ({
    key, value, updated_at: new Date().toISOString()
  }));

  const { error: settingsErr } = await supabase.from('settings').upsert(settingsRows, { onConflict: 'key' });
  if (settingsErr) console.error('Settings error:', settingsErr);
  else console.log('✅ Settings migrated');

  // 2. Migrate Categories
  console.log('📂 Migrating categories...');
  const categories = [
    { id: '1', name: 'خواتم' },
    { id: '2', name: 'قلائد' },
    { id: '3', name: 'أطقم كاملة' },
    { id: '4', name: 'أساور' },
    { id: '1779128748850', name: 'PANDORA', description: '', image: '', icon: '', parentId: null, metaTitle: '', metaDesc: '', priority: 0, isActive: true, isBrand: true },
    { id: '1779128785179', name: 'خواتم باندورا', description: '', image: '', icon: '', parentId: '1779128748850', metaTitle: '', metaDesc: '', priority: 0, isActive: true },
    { id: '1779132055984', name: 'YSL', description: '', image: '', icon: '', parentId: null, metaTitle: '', metaDesc: '', priority: 0, isActive: true, isBrand: true },
    { id: '1779132084083', name: 'Micheal Kors', description: '', image: '', icon: '', parentId: null, metaTitle: '', metaDesc: '', priority: 0, isActive: true, isBrand: true },
    { id: '1780334078143', name: 'سنسال', description: '', image: '', icon: '', parentId: null, metaTitle: '', metaDesc: '', priority: 0, isActive: true, isBrand: false }
  ];

  const catRows = categories.map(c => ({
    id: String(c.id), name: c.name, description: c.description || '',
    image: c.image || '', icon: c.icon || '', parent_id: c.parentId || null,
    meta_title: c.metaTitle || '', meta_desc: c.metaDesc || '',
    priority: c.priority || 0, is_active: c.isActive !== false, is_brand: c.isBrand || false
  }));

  const { error: catErr } = await supabase.from('categories').upsert(catRows, { onConflict: 'id' });
  if (catErr) console.error('Categories error:', catErr);
  else console.log('✅ Categories migrated');

  // 3. Migrate Products
  console.log('📦 Migrating products...');
  const products = [
    {
      id: '1780334290668', name: 'إسوارة لاكوست كابلز', price: 150, salePrice: null,
      wholesalePrice: 80, costPrice: 20, sku: '', image: '', images: [],
      description: 'إسوارة لاكوست كابلز - أناقة ومتانة عالية.',
      categories: ['4'], category: '4', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, landingSections: [], variants: [], variantsData: [],
      advanced: { hiddenProduct: false, isComingSoon: false, comingSoonDate: '', productVideo: '', isRecommended: true }
    },
    {
      id: '1780334248445', name: 'سنسال وإسوارة الفيونكة الحمراء الملكية', price: 150, salePrice: null,
      wholesalePrice: 80, costPrice: 20, sku: '', image: '', images: [],
      description: 'سنسال وإسوارة الفيونكة الحمراء الملكية.',
      categories: ['3'], category: '3', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, landingSections: [], variants: [], variantsData: [],
      advanced: { hiddenProduct: false, isComingSoon: false, comingSoonDate: '', productVideo: '', isRecommended: true }
    },
    {
      id: '1780334158525', name: 'سنسال وإسوارة الفيونكة الوردية اللامعة', price: 150, salePrice: null,
      wholesalePrice: 80, costPrice: 20, sku: '', image: '', images: [],
      description: 'سنسال وإسوارة الفيونكة الوردية اللامعة.',
      categories: ['3'], category: '3', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, landingSections: [], variants: [], variantsData: [],
      advanced: { hiddenProduct: false, isComingSoon: false, comingSoonDate: '', productVideo: '', isRecommended: true }
    },
    {
      id: '1780334091837', name: 'سنسال الإنفينيتي الذهبي اللامع', price: 50, salePrice: null,
      wholesalePrice: 18, costPrice: 12, sku: '', image: '', images: [],
      description: 'سنسال الإنفينيتي الذهبي اللامع.',
      categories: ['1780334078143'], category: '1780334078143', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, landingSections: [], variants: [], variantsData: [],
      advanced: { hiddenProduct: false, isComingSoon: false, comingSoonDate: '', productVideo: '', isRecommended: true }
    },
    {
      id: '1780333645465', name: 'اسوارة كارتير LOVE Unlimited المرنة (الذهبية)', price: 150, salePrice: null,
      wholesalePrice: 80, costPrice: 20, sku: '', image: '', images: [],
      description: 'اسوارة كارتير LOVE Unlimited المرنة.',
      categories: ['4'], category: '4', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, landingSections: [],
      variants: [{ name: 'المقاس', type: 'pills', values: [{value:'17',price:'',wholesalePrice:'',image:'',stock:'',color:'#4f46e5'},{value:'18',price:'',wholesalePrice:'',image:'',stock:'',color:'#4f46e5'},{value:'19',price:'',wholesalePrice:'',image:'',stock:'',color:'#4f46e5'}] }],
      variantsData: [],
      advanced: { hiddenProduct: false, isComingSoon: false, comingSoonDate: '', productVideo: '', isRecommended: true }
    },
    {
      id: '1779312433240', name: 'أساور توليب أحمر ذهبي', price: 80, salePrice: 60,
      wholesalePrice: 18, costPrice: 12, sku: '', image: '', images: [],
      description: 'أساور توليب أحمر ذهبي.',
      categories: ['4'], category: '4', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, landingSections: [], variants: [], variantsData: [],
      advanced: { hiddenProduct: false, isComingSoon: false, comingSoonDate: '', productVideo: '', isRecommended: true }
    },
    {
      id: '2', name: 'خاتم زفاف فضي كلاسيكي', price: 200, salePrice: null,
      wholesalePrice: 50, costPrice: 15, sku: '', image: '', images: [],
      description: 'خاتم فضة كلاسيكي مرصع بحجر الزركون النقي.',
      categories: ['1','2','3','4'], category: '1', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, landingSections: [],
      variants: [{ name: 'الاوان المتوفرة', type: 'image', values: [
        {value:'احمر',price:'100',wholesalePrice:'50',image:'',stock:'0',color:'#4f46e5'},
        {value:'ازرق',price:'100',wholesalePrice:'50',image:'',stock:'1',color:'#4f46e5'},
        {value:'اخضر',price:'100',wholesalePrice:'50',image:'',stock:'5',color:'#4f46e5'}
      ] }],
      variantsData: [],
      advanced: { hiddenProduct: false }
    },
    {
      id: '3', name: 'قلادة الزمرد الساحرة', price: 850, salePrice: null,
      costPrice: null, sku: '', image: '', images: [],
      description: 'قلادة فاخرة تتوسطها جوهرة زمرد خضراء.',
      categories: ['2'], category: '2', adminNote: '',
      fakeVisitors: false, fakeStock: false, fakeTimer: false,
      isLandingPage: false, variants: [], variantsData: [],
      advanced: { hiddenProduct: false }
    }
  ];

  const productRows = products.map(p => ({
    id: String(p.id), name: p.name, price: p.price,
    sale_price: p.salePrice, wholesale_price: p.wholesalePrice || null,
    cost_price: p.costPrice || null, sku: p.sku || '',
    image: p.image || '', images: p.images || [],
    description: p.description || '', categories: p.categories || [],
    category: p.category || '', admin_note: p.adminNote || '',
    fake_visitors: p.fakeVisitors || false, fake_stock: p.fakeStock || false,
    fake_timer: p.fakeTimer || false, is_landing_page: p.isLandingPage || false,
    landing_sections: p.landingSections || [], variants: p.variants || [],
    variants_data: p.variantsData || [], advanced: p.advanced || {},
    created_at: new Date().toISOString()
  }));

  const { error: prodErr } = await supabase.from('products').upsert(productRows, { onConflict: 'id' });
  if (prodErr) console.error('Products error:', prodErr);
  else console.log('✅ Products migrated');

  // 4. Migrate Orders
  console.log('📋 Migrating orders...');
  const orders = [
    {
      id: 'ORD-149276', date: '2026-06-07T22:42:29.276Z',
      customer: { name: 'سيف مسودة', phone: '0568313507', address: 'عين سارة', city: 'القدس - الخليل', email: '' },
      items: [{ id: '2', name: 'خاتم زفاف فضي كلاسيكي (ازرق)', price: 50, image: '', quantity: 1 }],
      total: 80, shippingCost: 30, discount: 0, couponCode: '', status: 'جديد',
      utm_source: '', utm_campaign: '', referrer: '', visitedPages: [],
      notes: '', timeSpent: '253:04 دقيقه', sessionCount: '51',
      firstVisit: '', ip: '', ipCountry: 'il', isWholesale: true, distributorId: 'DIST-1778965133143'
    },
    {
      id: 'ORD-872114', date: '2026-06-07T19:51:12.114Z',
      customer: { name: 'سيف مسودة', phone: '0568313507', address: 'الخليل', city: 'الداخل', email: '' },
      items: [
        { id: '2', name: 'خاتم زفاف فضي كلاسيكي (احمر)', price: 50, image: '', quantity: 1 },
        { id: '3', name: 'قلادة الزمرد الساحرة', price: 850, image: '', quantity: 1 }
      ],
      total: 970, shippingCost: 70, discount: 0, couponCode: '', status: 'جديد',
      utm_source: '', utm_campaign: '', referrer: '', visitedPages: [],
      notes: '', timeSpent: '81:47 دقيقه', sessionCount: '51',
      firstVisit: '', ip: '', ipCountry: 'il', isWholesale: true, distributorId: 'DIST-1778965133143'
    }
  ];

  const orderRows = orders.map(o => ({
    id: String(o.id), date: o.date, customer: o.customer, items: o.items,
    total: o.total, shipping_cost: o.shippingCost, discount: o.discount,
    coupon_code: o.couponCode, status: o.status, utm_source: o.utm_source,
    utm_campaign: o.utmCampaign, referrer: o.referrer, visited_pages: o.visitedPages,
    notes: o.notes, time_spent: o.timeSpent, session_count: o.sessionCount,
    first_visit: o.firstVisit, ip: o.ip, ip_country: o.ipCountry,
    is_wholesale: o.isWholesale, distributor_id: o.distributorId,
    stock_subtracted: false, created_at: o.date
  }));

  const { error: orderErr } = await supabase.from('orders').upsert(orderRows, { onConflict: 'id' });
  if (orderErr) console.error('Orders error:', orderErr);
  else console.log('✅ Orders migrated');

  // 5. Migrate Coupons
  console.log('🎟️ Migrating coupons...');
  const { error: couponErr } = await supabase.from('coupons').upsert([
    { code: 'FREE10', type: 'percentage', value: 10, min_order: 1, max_uses: 0, used_count: 0, target_phone: null, product_ids: [], created_at: '2026-05-19T00:15:19.346Z' }
  ], { onConflict: 'code' });
  if (couponErr) console.error('Coupons error:', couponErr);
  else console.log('✅ Coupons migrated');

  // 6. Migrate Distributors
  console.log('👤 Migrating distributors...');
  const { error: distErr } = await supabase.from('distributors').upsert([
    { id: 'DIST-1778965133143', name: 'سيف مسودة', phone: '0568313507', password: 'saifps4ps', business_name: 'ul', email: '', city: '', address: '', notes: '', status: 'approved', created_at: '2026-05-16T20:58:53.143Z' }
  ], { onConflict: 'id' });
  if (distErr) console.error('Distributors error:', distErr);
  else console.log('✅ Distributors migrated');

  // 7. Migrate Pages
  console.log('📄 Migrating pages...');
  const pages = [
    { id: 'PAGE-1', title: 'سياسة الخصوصية', slug: 'privacy-policy', content: '<h2>سياسة الخصوصية</h2><p>نحن نقدر خصوصيتكم ونلتزم بحماية بياناتكم الشخصية.</p>', type: 'policy', status: 'public' },
    { id: 'PAGE-2', title: 'سياسة الاستبدال والاسترجاع', slug: 'refund-policy', content: '<h2>سياسة الاستبدال والاسترجاع</h2><p>يمكن طلب الاسترجاع خلال 3 أيام من تاريخ الاستلام.</p>', type: 'policy', status: 'public' },
    { id: 'PAGE-3', title: 'من نحن', slug: 'about-us', content: '<h2>من نحن</h2><p>مرحباً بكم في متجرنا! نحن متخصصون في تقديم أرقى المجوهرات.</p>', type: 'about', status: 'public' },
    { id: 'PAGE-4', title: 'الشروط والأحكام', slug: 'terms', content: '<h2>الشروط والأحكام</h2><p>باستخدامك لهذا الموقع، أنت توافق على هذه الشروط.</p>', type: 'policy', status: 'public' }
  ];

  const pageRows = pages.map(p => ({
    id: p.id, title: p.title, slug: p.slug, content: p.content,
    type: p.type, status: p.status, thumbnail: '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }));

  const { error: pageErr } = await supabase.from('pages').upsert(pageRows, { onConflict: 'id' });
  if (pageErr) console.error('Pages error:', pageErr);
  else console.log('✅ Pages migrated');

  // 8. Migrate Reels
  console.log('🎬 Migrating reels...');
  const reels = [
    { id: 'reel_1780701053110', videoUrl: '', title: 'تألقي مع سوار الذهب', productId: '1780334290668', createdAt: '2026-06-05T23:10:53.110Z' },
    { id: 'reel_1781041194696', videoUrl: '', title: 'اساور فان كليف', productId: '1780333645465', createdAt: '2026-06-09T21:39:54.696Z' },
    { id: 'reel_1781041211160', videoUrl: '', title: 'طقم مطابق للذهب', productId: null, createdAt: '2026-06-09T21:40:11.160Z' },
    { id: 'reel_1781044892078', videoUrl: '', title: '', productId: null, createdAt: '2026-06-09T22:41:32.078Z' },
    { id: 'reel_1781044911613', videoUrl: '', title: '', productId: null, createdAt: '2026-06-09T22:41:51.613Z' },
    { id: 'reel_1781044920558', videoUrl: '', title: '', productId: null, createdAt: '2026-06-09T22:42:00.558Z' },
    { id: 'reel_1781044955038', videoUrl: '', title: '', productId: null, createdAt: '2026-06-09T22:42:35.038Z' }
  ];

  const reelRows = reels.map(r => ({
    id: r.id, video_url: r.videoUrl, title: r.title,
    product_id: r.productId, created_at: r.createdAt
  }));

  const { error: reelErr } = await supabase.from('reels').upsert(reelRows, { onConflict: 'id' });
  if (reelErr) console.error('Reels error:', reelErr);
  else console.log('✅ Reels migrated');

  // 9. Migrate Banner Presets
  console.log('🎨 Migrating banner presets...');
  const presets = [
    { id: 'gold_ribbon', name: 'الشريط الذهبي', category: 'luxury', bg_color: 'linear-gradient(135deg, #a3762b 0%, #e7c97a 30%, #fef3c7 50%, #e7c97a 70%, #a3762b 100%)', text_color: '#111111', custom_css: 'border: 1px solid #a3762b;', is_default: true },
    { id: 'rose_petals', name: 'بتلات الورد', category: 'minimal', bg_color: 'linear-gradient(90deg, #fbcfe8 0%, #f472b6 50%, #db2777 100%)', text_color: '#ffffff', custom_css: 'border-bottom: 3px solid #be185d;', is_default: true },
    { id: 'deep_emerald', name: 'الزمرد العميق', category: 'luxury', bg_color: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)', text_color: '#ecfdf5', custom_css: 'border: 1px solid #059669;', is_default: true }
  ];

  const presetRows = presets.map(p => ({
    id: p.id, name: p.name, category: p.category,
    bg_color: p.bg_color, text_color: p.text_color,
    custom_css: p.custom_css, is_default: p.is_default,
    created_at: new Date().toISOString()
  }));

  const { error: presetErr } = await supabase.from('banner_presets').upsert(presetRows, { onConflict: 'id' });
  if (presetErr) console.error('Banner presets error:', presetErr);
  else console.log('✅ Banner presets migrated');

  // 10. Initialize Analytics
  console.log('📊 Initializing analytics...');
  const { error: analyticsErr } = await supabase.from('analytics').upsert({
    id: 1, visits: 17, add_to_cart: 39, init_checkout: 12,
    history: [
      { date: '2026-05-20', visit: 151, add_to_cart: 45, init_checkout: 20, orders: 12, revenue: 1850 },
      { date: '2026-05-21', visit: 12, add_to_cart: 2, init_checkout: 1, orders: 0, revenue: 0 },
      { date: '2026-06-01', visit: 6, add_to_cart: 17, init_checkout: 4, orders: 0, revenue: 0 },
      { date: '2026-06-07', visit: 1, add_to_cart: 13, init_checkout: 6, orders: 0, revenue: 0 }
    ],
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });
  if (analyticsErr) console.error('Analytics error:', analyticsErr);
  else console.log('✅ Analytics initialized');

  console.log('🎉 Migration complete!');
}

// Run migration
migrateData().catch(console.error);
