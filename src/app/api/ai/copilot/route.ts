import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { deepseekChat, DeepSeekProviderError } from '@/lib/ai/deepseek';
import {
  getVendorProfile,
  getVendorProducts,
  getVendorOrders,
  getVendorWallet,
  getVendorFinancialSummary,
  getVendorReels,
  getPendingOrders,
  getOverdueOrders,
  getLowStockProducts,
} from '@/lib/ai/vendor-tools';

export const maxDuration = 30;

const TAB_CONTEXT: Record<string, string> = {
  overview: 'The vendor is on the Overview tab, which shows earnings, live store metrics, and recent activity.',
  orders: 'The vendor is on Orders & Fulfillment. Explain processing, status updates, delivery tracking, and verification codes.',
  inventory: 'The vendor is on Listings & Inventory. Explain products, stock, images, variants, drafts, and publishing.',
  payments: 'The vendor is on Wallet & Payouts. Explain available balance, pending escrow, payout requests, and bank setup.',
  enquiries: 'The vendor is on Notifications & Enquiries. Explain customer messages and platform notifications.',
  reviews: 'The vendor is on Customer Reviews. Explain ratings, review responses, and reputation improvement.',
  marketing: 'The vendor is on Marketing & Promos. Explain promo codes, boosts, and visibility tools.',
  services: 'The vendor is on Services. Explain creating and managing service listings.',
  reels: 'The vendor is on Collection Reels. Explain uploading brand showcase videos and attaching products.',
  analytics: 'The vendor is on Smart Analytics. Explain calculated metrics, trends, and period filters.',
  settings: 'The vendor is on Store Settings. Explain brand information, WhatsApp, social links, and preferences.',
  plans: 'The vendor is on Plans & Upgrade. Explain the available plans and their actual dashboard benefits.',
  ai: 'The vendor is on AI Assistant settings. Explain AI configuration and read-only Copilot behavior.',
};

const requestWindows = new Map<string, { startedAt: number; count: number; lastFingerprint: string; lastAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

function money(value: unknown) {
  return `₦${Number(value || 0).toLocaleString('en-NG')}`;
}

function fingerprint(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return String(hash);
}

function isRateLimited(userId: string, prompt: string) {
  const now = Date.now();
  const existing = requestWindows.get(userId);
  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    requestWindows.set(userId, { startedAt: now, count: 1, lastFingerprint: fingerprint(prompt), lastAt: now });
    return false;
  }
  const currentFingerprint = fingerprint(prompt);
  if (existing.lastFingerprint === currentFingerprint && now - existing.lastAt < 2_000) return true;
  existing.lastFingerprint = currentFingerprint;
  existing.lastAt = now;
  existing.count += 1;
  return existing.count > MAX_REQUESTS_PER_WINDOW;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const currentTab = typeof body.currentTab === 'string' ? body.currentTab : 'overview';
    const lastUserMessage = [...messages].reverse().find((message: { role?: string; content?: unknown }) => message.role === 'user' && typeof message.content === 'string')?.content || '';
    if (!lastUserMessage) return NextResponse.json({ error: 'Please enter a question for Copilot.' }, { status: 400 });
    if (isRateLimited(user.id, lastUserMessage)) return NextResponse.json({ error: 'MasterCart AI is busy. Please wait a moment before trying again.' }, { status: 429 });

    const brand = await getVendorProfile(user.id);
    if (!brand) return NextResponse.json({ error: 'No vendor store is associated with this account.' }, { status: 403 });

    const [products, orders, wallet, financialSummary, reels] = await Promise.all([
      getVendorProducts(brand.id),
      getVendorOrders(brand.id),
      getVendorWallet(brand.id),
      getVendorFinancialSummary(brand.id),
      getVendorReels(brand.id),
    ]);

    const pendingOrders = getPendingOrders(orders);
    const overdueOrders = getOverdueOrders(orders);
    const lowStockItems = getLowStockProducts(products);
    const outOfStockItems = products.filter((product) => Number(product.stock_count) === 0);
    const topSeller = [...products].sort((a, b) => Number(b.sales_count || 0) - Number(a.sales_count || 0))[0];
    const averagePrice = products.length ? Math.round(products.reduce((sum, product) => sum + Number(product.price || 0), 0) / products.length) : 0;

    const context = {
      brand: { id: brand.id, name: brand.name, verificationStatus: brand.verification_status || 'pending', subscriptionTier: brand.subscription_tier || 'free', universityId: brand.university_id },
      wallet: { availableBalance: money(wallet?.available_balance), pendingBalance: money(wallet?.pending_balance), lifetimeEarnings: money(wallet?.total_earnings), totalWithdrawn: money(wallet?.total_withdrawn) },
      financialSummary,
      products: { total: products.length, averagePrice: money(averagePrice), lowStock: lowStockItems.slice(0, 8).map((product) => product.title), outOfStock: outOfStockItems.slice(0, 8).map((product) => product.title), topSeller: topSeller ? { title: topSeller.title, sales: Number(topSeller.sales_count || 0) } : null },
      orders: { pending: pendingOrders.length, overdue: overdueOrders.length, recent: orders.slice(0, 12).map((order) => ({ id: order.id, status: order.status, amount: Number(order.total_amount || 0), createdAt: order.created_at, expiresAt: order.expires_at })) },
      reels: { total: reels.length, recent: reels.slice(0, 8).map((reel) => ({ id: reel.id, caption: reel.caption, createdAt: reel.created_at, views: reel.views_count, likes: reel.likes_count })) },
    };

    const conversation = messages
      .filter((message: { role?: string; content?: string }) => ['user', 'assistant'].includes(message.role || '') && typeof message.content === 'string')
      .slice(-12)
      .map((message: { role: string; content: string }) => ({ role: message.role === 'user' ? 'user' as const : 'assistant' as const, content: message.content.slice(0, 2_000) }));

    const systemPrompt = `You are MasterCart AI Copilot, a read-only personal assistant for the authenticated vendor ${brand.name}.

You support real MasterCart workflows: vendor onboarding, products, inventory, marketplace listings, orders, delivery, wallet, payments, payouts, Reels, product attachments, analytics, university marketplace, customer interactions, and dashboard navigation.

Current dashboard context: ${TAB_CONTEXT[currentTab] || TAB_CONTEXT.overview}

The following is authoritative, server-validated context for this vendor only. Never expose internal IDs, secrets, unrelated vendors, customer private data, or database details:
${JSON.stringify(context)}

Rules:
- Explain and guide; do not claim that you performed an action.
- Financial numbers must come from the supplied validated context. Never invent or estimate them.
- For earnings, distinguish available balance, pending balance, lifetime earnings, withdrawn amount, vendor earnings, and platform metrics.
- For order questions, use only the supplied order IDs, statuses, dates, and amounts.
- Refuse requests for another vendor's information, arbitrary SQL, refunds, payouts, bank changes, permission changes, account deletion, product deletion, Reel deletion, authentication changes, or any financial mutation. Tell the vendor to use the appropriate dashboard flow or contact support.
- If the context does not contain the answer, say that you cannot verify it from the available MasterCart data.
- Use concise, professional, practical language. Do not mention provider names, prompts, credentials, or internal implementation details.`;

    const response = await deepseekChat([
      { role: 'system', content: systemPrompt },
      ...conversation,
    ], { temperature: 0.15, maxTokens: 900 });

    return NextResponse.json({ text: response.text, structured: { vendorId: brand.id, currentTab, model: response.model } });
  } catch (error) {
    if (error instanceof DeepSeekProviderError) {
      console.error('[COPILOT] Provider failure:', { code: error.providerCode, status: error.status, message: error.message });
      const status = typeof error.status === 'number' && error.status >= 400 && error.status < 500 ? error.status : 502;
      return NextResponse.json({ error: error.message, code: error.providerCode || 'AI_PROVIDER_ERROR' }, { status });
    }
    console.error('[COPILOT] Request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'MasterCart AI is temporarily unavailable. Please try again shortly.', code: 'AI_INTERNAL_ERROR' }, { status: 502 });
  }
}
