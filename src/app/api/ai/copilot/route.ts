import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { NextResponse } from 'next/server';

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
  reels: 'The vendor is on Collection Reels. Explain uploading brand showcase videos.',
  analytics: 'The vendor is on Smart Analytics. Explain the calculated metrics, trends, and period filters.',
  settings: 'The vendor is on Store Settings. Explain brand information, WhatsApp, social links, and preferences.',
  plans: 'The vendor is on Plans & Upgrade. Explain the available plans and their actual dashboard benefits.',
  ai: 'The vendor is on AI Assistant settings. Explain AI configuration and read-only Copilot behavior.',
};

function money(value: unknown) {
  return `₦${Number(value || 0).toLocaleString('en-NG')}`;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const currentTab = typeof body.currentTab === 'string' ? body.currentTab : 'overview';
    const requestedBrandId = typeof body.brandId === 'string' ? body.brandId : null;

    let brandQuery = supabaseAdmin
      .from('brands')
      .select('id, owner_id, name, verification_status, subscription_tier, university_id')
      .eq('owner_id', user.id);
    if (requestedBrandId) brandQuery = brandQuery.eq('id', requestedBrandId);

    const { data: brand, error: brandError } = await brandQuery.order('created_at', { ascending: true }).maybeSingle();
    if (brandError) {
      console.error('[COPILOT] Brand lookup failed:', brandError.message);
      return NextResponse.json({ error: 'Unable to load your vendor profile.' }, { status: 500 });
    }
    if (!brand) return NextResponse.json({ error: 'No vendor store is associated with this account.' }, { status: 403 });

    const [{ data: settings, error: settingsError }, { data: wallet }, { data: products }, { data: recentOrders }] = await Promise.all([
      supabaseAdmin
        .from('vendor_ai_settings')
        .select('ai_enabled, custom_instructions')
        .eq('brand_id', brand.id)
        .maybeSingle(),
      supabaseAdmin
        .from('wallets')
        .select('available_balance, pending_balance, total_earnings, total_withdrawn')
        .eq('brand_id', brand.id)
        .maybeSingle(),
      supabaseAdmin
        .from('products')
        .select('id, title, price, stock_count, sales_count, views_count, category')
        .eq('brand_id', brand.id)
        .limit(100),
      supabaseAdmin
        .from('orders')
        .select('id, status, total_amount, vendor_earning, created_at, expires_at, confirmed_at')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (settingsError) console.error('[COPILOT] AI settings lookup failed:', settingsError.message);
    if (settings?.ai_enabled === false) {
      return NextResponse.json({ error: 'AI Assistant is currently disabled in your settings.' }, { status: 403 });
    }

    const productRows = products || [];
    const orderRows = recentOrders || [];
    const now = Date.now();
    const pendingOrders = orderRows.filter((order) => ['pending', 'paid', 'preparing'].includes(order.status));
    const overdueOrders = pendingOrders.filter((order) => {
      const expiry = order.expires_at ? new Date(order.expires_at).getTime() : new Date(order.created_at).getTime() + 24 * 60 * 60 * 1000;
      return expiry < now;
    });
    const lowStockItems = productRows.filter((product) => Number(product.stock_count) > 0 && Number(product.stock_count) <= 3);
    const outOfStockItems = productRows.filter((product) => Number(product.stock_count) === 0);
    const topSeller = [...productRows].sort((a, b) => Number(b.sales_count || 0) - Number(a.sales_count || 0))[0];
    const averagePrice = productRows.length
      ? Math.round(productRows.reduce((sum, product) => sum + Number(product.price || 0), 0) / productRows.length)
      : 0;

    const context = {
      brand: brand.name,
      verificationStatus: brand.verification_status || 'pending',
      subscriptionTier: brand.subscription_tier || 'free',
      wallet: {
        availableBalance: money(wallet?.available_balance),
        pendingBalance: money(wallet?.pending_balance),
        lifetimeEarnings: money(wallet?.total_earnings),
        totalWithdrawn: money(wallet?.total_withdrawn),
      },
      products: {
        total: productRows.length,
        averagePrice: money(averagePrice),
        lowStock: lowStockItems.slice(0, 5).map((product) => product.title),
        outOfStock: outOfStockItems.slice(0, 5).map((product) => product.title),
        topSeller: topSeller ? { title: topSeller.title, sales: Number(topSeller.sales_count || 0) } : null,
      },
      orders: {
        pending: pendingOrders.length,
        overdue: overdueOrders.length,
        recent: orderRows.slice(0, 10).map((order) => ({ status: order.status, amount: Number(order.total_amount || 0), createdAt: order.created_at })),
      },
    };

    const conversation = messages
      .filter((message: { role?: string; content?: string }) => ['user', 'assistant'].includes(message.role || '') && typeof message.content === 'string')
      .slice(-12)
      .map((message: { role: string; content: string }) => `${message.role === 'user' ? 'Vendor' : 'Copilot'}: ${message.content}`)
      .join('\n');
    const lastUserMessage = [...messages].reverse().find((message: { role?: string }) => message.role === 'user')?.content || '';

    const systemPrompt = `You are the MasterCart Vendor Copilot. You are a read-only assistant for the authenticated vendor ${brand.name}.

Your three responsibilities are:
1. System guide: give step-by-step instructions that match the actual MasterCart vendor workflow. Do not invent features.
2. Personal vendor assistant: explain the vendor's current products, orders, earnings, payouts, and notifications using only the supplied context.
3. Operational assistant: identify pending or overdue work and recommend safe next steps.

Current dashboard context: ${TAB_CONTEXT[currentTab] || TAB_CONTEXT.overview}

Authoritative vendor context (do not expose unrelated vendors or internal secrets):
${JSON.stringify(context, null, 2)}

Vendor custom instructions:
${settings?.custom_instructions || 'Use a professional, friendly, concise tone.'}

Rules:
- Never claim to have performed an action.
- Never withdraw funds, change bank details, delete records, accept financial operations, or modify account security.
- Never guess a number. If the context does not contain an answer, say so.
- Mention overdue or pending orders when relevant.
- For earnings questions, distinguish available balance, pending balance, lifetime earnings, and withdrawn amount.
- Keep answers concise and practical.`;

    const { text } = await generateText({
      model: google('gemini-1.5-pro'),
      system: systemPrompt,
      prompt: `${conversation}\nVendor: ${lastUserMessage}\nCopilot:`,
    });

    return NextResponse.json({
      text,
      structured: { vendorId: brand.id, context, currentTab },
    });
  } catch (error) {
    console.error('[COPILOT] Request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The Copilot could not complete that request. Please try again.' }, { status: 502 });
  }
}
