export const MILES_ONBOARDING_VERSION = 1;

export type OnboardingMode = 'public' | 'authenticated';
export type OnboardingRole = string;

export type MilesOnboardingStep = {
  id: string;
  route: string;
  title: string;
  message: string;
  target?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  duration?: number;
  capability?: string;
  permission?: string;
  activate?: string;
  optional?: boolean;
};

type CapabilitySource = { capabilities: string[]; roles: string[]; permissions?: string[] };

const PUBLIC_STEPS: MilesOnboardingStep[] = [
  { id: 'public-welcome', route: '/', title: 'Hi, I’m Miles', message: 'I’m your MasterCart guide. You can explore the marketplace, discover products and vendors, and ask me questions whenever you need help.' },
  { id: 'public-marketplace', route: '/', target: '[data-miles-tour="marketplace-overview"]', side: 'bottom', title: 'Welcome to MasterCart', message: 'This is the public marketplace. You can browse what is available before creating an account.' },
  { id: 'public-search', route: '/', target: '[data-miles-tour="marketplace-search"]', side: 'bottom', capability: 'search_guidance', title: 'Search products and vendors', message: 'Use search terms such as a product name, a category, or a store name to find relevant results.' },
  { id: 'public-discovery', route: '/explore', target: '[data-miles-tour="product-discovery"]', side: 'top', title: 'Explore discovery', message: 'Explore is where you can discover products and vendors across the public marketplace.', capability: 'product_discovery' },
  { id: 'public-reels', route: '/reels', target: '[data-miles-tour="reels-feed"]', side: 'left', title: 'Discover through Reels', message: 'Public Reels can help you discover products and stores through short-form content.', capability: 'reels_guidance' },
];

const CUSTOMER_STEPS: MilesOnboardingStep[] = [
  { id: 'customer-welcome', route: '/', title: 'Welcome back — let’s get you oriented', message: 'I’ll show you the parts of MasterCart that are available to you. You can skip at any time and ask me to show you around again later.' },
  { id: 'customer-marketplace', route: '/', target: '[data-miles-tour="marketplace-overview"]', side: 'bottom', title: 'Your marketplace', message: 'This is your starting point for discovering products, vendors, categories, and campus services.', capability: 'marketplace_guidance' },
  { id: 'customer-search', route: '/', target: '[data-miles-tour="marketplace-search"]', side: 'bottom', title: 'Search naturally', message: 'Search by product, category, vendor, or a phrase such as “JT clothing”. I’ll help you refine the search when needed.', capability: 'search_guidance' },
  { id: 'customer-cart', route: '/', target: '[data-miles-tour="cart"]', side: 'bottom', title: 'Your cart', message: 'Items you choose can be reviewed here before checkout. Your cart is private to your account.', capability: 'cart_guidance' },
  { id: 'customer-products', route: '/explore', target: '[data-miles-tour="product-discovery"]', side: 'top', title: 'Product discovery', message: 'Open a product to review its details, media, availability, vendor, and purchase options.', capability: 'product_questions' },
  { id: 'customer-vendors', route: '/vendors', target: '[data-miles-tour="vendor-stores"]', side: 'top', title: 'Vendor discovery', message: 'Browse stores and open a vendor profile to learn what that store offers.', capability: 'marketplace_guidance' },
  { id: 'customer-orders', route: '/dashboard/customer', target: '[data-miles-tour="customer-orders"]', side: 'right', title: 'Orders and delivery', message: 'Your customer dashboard is where you can follow orders, delivery progress, and available order actions.', capability: 'customer_orders' },
  { id: 'customer-reels', route: '/reels', target: '[data-miles-tour="reels-feed"]', side: 'left', title: 'Reels', message: 'Reels can help you discover products and vendors visually.', capability: 'reels_guidance' },
  { id: 'customer-finish', route: '/', title: 'You’re ready to explore', message: 'That’s the customer tour. I’ll return to normal Miles chat now, and you can say “show me around again” whenever you want a refresher.' },
];

const VENDOR_STEPS: MilesOnboardingStep[] = [
  { id: 'vendor-welcome', route: '/dashboard/vendor', title: 'Welcome to your vendor workspace', message: 'I’ll show you the vendor tools that your current account and permissions make available.' },
  { id: 'vendor-dashboard', route: '/dashboard/vendor', target: '[data-miles-tour="vendor-overview"]', side: 'right', title: 'Your vendor dashboard', message: 'This is your store workspace for managing products, orders, store performance, and the vendor tools enabled for you.', capability: 'vendor_products' },
  { id: 'vendor-products', route: '/dashboard/vendor', target: '[data-miles-tour="vendor-product-upload"]', side: 'bottom', title: 'Products and listings', message: 'Use the product tools to create and manage listings. Miles can help you prepare descriptions, understand fields, and review changes.', capability: 'vendor_listing_guidance' },
  { id: 'vendor-orders', route: '/dashboard/vendor', target: '[data-miles-tour="vendor-orders"]', side: 'bottom', title: 'Incoming orders', message: 'This is where you follow order progress and the next action available to your store.', capability: 'vendor_orders' },
  { id: 'vendor-wallet', route: '/dashboard/vendor', target: '[data-miles-tour="vendor-wallet"]', side: 'left', title: 'Wallet and payouts', message: 'Financial information remains scoped to your authorized vendor account. Ask Miles for explanations, but sensitive actions stay confirmation-gated.', capability: 'vendor_wallet' },
  { id: 'vendor-reels', route: '/reels', target: '[data-miles-tour="reels-feed"]', side: 'left', title: 'Vendor Reels', message: 'Use Reels when your account has access to publish or manage vendor content.', capability: 'vendor_reels', optional: true },
  { id: 'vendor-analytics', route: '/dashboard/vendor', title: 'Analytics', message: 'When analytics are available to your account, use them to understand product and store performance.', capability: 'vendor_analytics', optional: true },
  { id: 'vendor-finish', route: '/dashboard/vendor', title: 'Your vendor guide is complete', message: 'You can now use the workspace, and Miles remains available for normal chat and confirmation-gated assistance.' },
];

const ADMIN_STEPS: MilesOnboardingStep[] = [
  { id: 'admin-welcome', route: '/admin', title: 'Welcome to your administration workspace', message: 'I’ll show only the administrative modules that your actual role and permissions authorize.' },
  { id: 'admin-overview', route: '/admin', target: '[data-miles-tour="admin-overview"]', activate: 'financials', side: 'bottom', title: 'Administrative overview', message: 'Use the dashboard to understand the operational areas available to your scope.', capability: 'operational_monitoring', permission: 'analytics', optional: true },
  { id: 'admin-vendors', route: '/admin', target: '[data-miles-tour="admin-vendors"]', activate: 'refunds', side: 'bottom', title: 'Operational management', message: 'Administrative actions such as vendor or order management appear only when your permissions allow them.', capability: 'vendor_management', permission: 'vendors', optional: true },
  { id: 'admin-analytics', route: '/admin', target: '[data-miles-tour="admin-settings"]', activate: 'settings', side: 'bottom', title: 'Analytics and configuration', message: 'Analytics and configuration tools are shown only when your permission set includes them.', capability: 'admin_analytics', permission: 'settings', optional: true },
  { id: 'admin-finish', route: '/admin', title: 'Your admin guide is complete', message: 'I’ll return to normal Miles chat. Ask me to show you around again whenever your workflow needs a refresher.' },
];

const UNIVERSITY_ADMIN_STEPS: MilesOnboardingStep[] = [
  { id: 'university-admin-welcome', route: '/university-admin', title: 'Welcome to your university workspace', message: 'This tour is scoped to your university and the permissions assigned to your administrative account.' },
  { id: 'university-admin-overview', route: '/university-admin', target: '[data-miles-tour="university-admin-overview"]', activate: 'overview', side: 'right', title: 'University overview', message: 'This workspace covers the university-level functions available to your account.', capability: 'university_scope_monitoring' },
  { id: 'university-admin-vendors', route: '/university-admin', target: '[data-miles-tour="university-admin-vendors"]', activate: 'vendors', side: 'right', title: 'Vendor management', message: 'Review and manage university vendors only when your assigned permissions authorize those actions.', capability: 'vendor_management', permission: 'vendors', optional: true },
  { id: 'university-admin-notices', route: '/university-admin', target: '[data-miles-tour="university-admin-notices"]', activate: 'notices', side: 'right', title: 'University communications', message: 'Use authorized notices and marketplace information tools to communicate with your university community.', capability: 'university_statistics', permission: 'notices', optional: true },
  { id: 'university-admin-finish', route: '/university-admin', title: 'Your university guide is complete', message: 'Miles will now return to normal chat and continue respecting your university scope.' },
];

const RIDER_STEPS: MilesOnboardingStep[] = [
  { id: 'rider-welcome', route: '/dashboard/delivery', target: '[data-miles-tour="rider-overview"]', side: 'left', title: 'Welcome to delivery operations', message: 'I’ll show you the delivery tools available to your account.' },
  { id: 'rider-orders', route: '/dashboard/delivery', target: '[data-miles-tour="rider-available-deliveries"]', side: 'bottom', title: 'Available deliveries', message: 'This is where authorized delivery work appears for you to review and act on.', capability: 'delivery_guidance' },
  { id: 'rider-status', route: '/dashboard/delivery', target: '[data-miles-tour="rider-queue"]', side: 'bottom', title: 'Delivery status', message: 'Keep statuses accurate so customers, vendors, and the platform receive the right updates.', capability: 'delivery_guidance' },
  { id: 'rider-finish', route: '/dashboard/delivery', title: 'You’re ready to deliver', message: 'Your delivery guide is complete. Miles remains available for normal assistance.' },
];

export function getOnboardingForRole(role: OnboardingRole, source?: CapabilitySource): MilesOnboardingStep[] {
  const normalized = role.toLowerCase();
  const roles = new Set(source?.roles || [normalized]);
  const isFullAdmin = roles.has('super_admin') || roles.has('admin');
  const base = CUSTOMER_STEPS.slice(0, -1);
  const extras: MilesOnboardingStep[] = [];
  if (normalized === 'vendor' || roles.has('vendor')) extras.push(...VENDOR_STEPS);
  if (normalized === 'university_admin' || normalized === 'university_staff' || roles.has('university_admin') || roles.has('university_staff')) extras.push(...UNIVERSITY_ADMIN_STEPS);
  if (normalized === 'rider' || normalized === 'delivery' || roles.has('rider') || roles.has('delivery')) extras.push(...RIDER_STEPS);
  if (normalized === 'admin' || normalized === 'super_admin' || normalized === 'sub_admin' || normalized === 'customer_support_agent' || roles.has('admin') || roles.has('super_admin') || roles.has('sub_admin') || roles.has('customer_support_agent')) extras.push(...ADMIN_STEPS);
  const steps = extras.length ? [...base, ...extras.filter((step, index, list) => list.findIndex((candidate) => candidate.id === step.id) === index)] : CUSTOMER_STEPS;
  const capabilities = new Set(source?.capabilities || []);
  const permissions = new Set((source?.permissions || []).map((permission) => permission.toLowerCase()));
  return steps.filter((step) => {
    if (!step.capability && !step.permission) return true;
    if (isFullAdmin) return true;
    if (step.permission && (permissions.has(step.permission.toLowerCase()) || permissions.has('*'))) return true;
    if (step.permission) return false;
    return capabilities.has(step.capability || '') || !step.optional;
  });
}

export function getPublicOnboarding(): MilesOnboardingStep[] {
  return PUBLIC_STEPS;
}

export function hasCapability(source: CapabilitySource | null, capability: string) {
  return Boolean(source?.capabilities.includes(capability) || source?.roles.includes('super_admin') || source?.roles.includes('admin'));
}
