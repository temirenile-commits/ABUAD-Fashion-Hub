export type TourStep = {
  element: string;
  title: string;
  description: string;
  route: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
};

export const TOURS: Record<string, TourStep[]> = {
  customer_onboarding: [
    { 
      element: '#tour-navbar-logo', 
      title: '👋 Welcome to Master Cart', 
      description: 'We are thrilled to have you! Master Cart is the premier digital marketplace designed exclusively for university students and campus entrepreneurs.', 
      route: '/' 
    },
    { 
      element: '#tour-search-bar', 
      title: '👉 Find Anything Instantly', 
      description: 'Use this search bar to quickly find specific products, your favorite vendors, or campus services. It searches across all categories in real-time!', 
      route: '/' 
    },
    { 
      element: '#tour-category-delicacies', 
      title: '👇 Craving Campus Food?', 
      description: 'Tap here to enter the Delicacies Hub. You can order from top campus chefs, see weekly dish rankings, and get meals delivered straight to your hostel.', 
      route: '/' 
    },
    { 
      element: '#tour-cart-btn', 
      title: '👉 Your Shopping Cart', 
      description: 'Items you want to buy go here. Checkout is fast and 100% secured by our Escrow system.', 
      route: '/' 
    },
    { 
      element: '#tour-user-account', 
      title: '👉 Your Personal Dashboard', 
      description: 'Let\'s head over to your dashboard. This is where you track orders, confirm deliveries, and manage your profile.', 
      route: '/' 
    },
    { 
      element: '#tour-customer-orders', 
      title: '👇 Track Your Orders Here', 
      description: 'Every purchase you make will appear here with live tracking updates. You will see when it is "Paid", "In Transit", and "Delivered".', 
      route: '/dashboard/customer' 
    },
    {
      element: '#tour-customer-orders',
      title: '⚖️ Terms & Conditions: Escrow',
      description: 'When you pay, your money is held in Escrow. The vendor does NOT get paid until you receive your item and click "Confirm Delivery". If the item is fake or never arrives, you are entitled to a full refund.',
      route: '/dashboard/customer'
    }
  ],

  vendor_onboarding: [
    { 
      element: '#tour-vendor-overview', 
      title: '👋 Welcome, Campus Entrepreneur!', 
      description: 'This is your Vendor Dashboard. From here, you control your entire digital storefront, monitor sales, and grow your brand.', 
      route: '/dashboard/vendor' 
    },
    { 
      element: '#tour-vendor-wallet', 
      title: '👉 Your Digital Wallet', 
      description: 'When customers confirm they have received their orders, the Escrow funds are instantly released into this wallet. You can withdraw to your local bank account at any time!', 
      route: '/dashboard/vendor' 
    },
    { 
      element: '#tour-vendor-add-product', 
      title: '👇 List Your First Product', 
      description: 'Click here to upload a new product. You can add multiple images, set detailed descriptions, and even configure different variants (like sizes and colors) with unique pricing.', 
      route: '/dashboard/vendor' 
    },
    { 
      element: '#tour-vendor-orders-tab', 
      title: '👉 Manage Incoming Orders', 
      description: 'All your customer orders will queue up here. Make sure to mark them as "Ready" so that campus logistics riders can come and pick them up for delivery.', 
      route: '/dashboard/vendor' 
    },
    {
      element: '#tour-vendor-overview',
      title: '⚖️ Terms & Conditions: Vendor Policy',
      description: 'By selling on Master Cart, you agree to fulfill orders promptly and authentically. Platform commissions are automatically deducted at checkout. Fraudulent activity or failure to deliver will result in Escrow refunds to the customer and potential store suspension.',
      route: '/dashboard/vendor'
    }
  ],

  admin_onboarding: [
    {
      element: '#tour-admin-finances',
      title: '👑 Global Admin Command',
      description: 'Welcome to the Super Admin Dashboard. This section handles global platform payouts, commissions, and revenue analytics across all universities.',
      route: '/admin'
    },
    {
      element: '#tour-admin-refunds',
      title: '👉 Refund Queue',
      description: 'Monitor stale or disputed orders here. You have the power to manually trigger refunds for customers if vendors fail to deliver within the SLA timeframe.',
      route: '/admin'
    },
    {
      element: '#tour-admin-delivery',
      title: '👇 Logistics Configuration',
      description: 'Set global delivery fees and adjust agent payout margins. These numbers directly affect the checkout cost for all users.',
      route: '/admin'
    },
    {
      element: '#tour-admin-settings',
      title: '👉 Campus Customization',
      description: 'Configure subscription tiers, credit limits, and features independently for every single university campus registered on Master Cart.',
      route: '/admin'
    }
  ],

  uni_admin_onboarding: [
    {
      element: '#tour-uni-admin-overview',
      title: '🎓 Local Campus Admin',
      description: 'Welcome to your localized dashboard. You only see data, vendors, and orders relevant to your specific University.',
      route: '/university-admin'
    },
    {
      element: '#tour-uni-admin-vendors',
      title: '👉 Vendor Management',
      description: 'Approve or reject local vendor applications, monitor their activity, and handle local disputes within your campus jurisdiction.',
      route: '/university-admin'
    },
    {
      element: '#tour-uni-admin-notices',
      title: '👇 Local Billboards',
      description: 'Publish announcements or promotional banners that will only be visible to students logging in from your university.',
      route: '/university-admin'
    }
  ],

  feature_escrow: [
    { 
      element: '#tour-user-account', 
      title: '🔐 How Escrow Works', 
      description: 'Let\'s head to your dashboard to see how Escrow protects you.', 
      route: '/' 
    },
    { 
      element: '#tour-customer-orders', 
      title: '👇 Protected Orders', 
      description: 'Your payment is held safely by Master Cart. The vendor only gets paid AFTER you click "Confirm Delivery" here.', 
      route: '/dashboard/customer' 
    }
  ],

  feature_variants: [
    { 
      element: '#tour-vendor-add-product', 
      title: '🎨 Adding Variants', 
      description: 'Let\'s open the product form to see how to add size/color variants.', 
      route: '/dashboard/vendor' 
    },
    { 
      element: '#tour-product-variants-section', 
      title: '👇 Variant Pricing', 
      description: 'When you add a variant (e.g., Size L), you can give it a specific price. Customers checking out with this variant will pay this exact amount!', 
      route: '/dashboard/vendor' 
    }
  ]
};
