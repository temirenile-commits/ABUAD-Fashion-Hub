import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, vendorId, brandId, currentTab } = await req.json();

    if (!vendorId || !brandId) {
      return NextResponse.json({ error: 'Missing vendor context' }, { status: 400 });
    }

    // Check if AI is enabled for this vendor
    const { data: settings } = await supabaseAdmin
      .from('vendor_ai_settings')
      .select('ai_enabled, custom_instructions')
      .eq('brand_id', brandId)
      .single();

    if (settings && settings.ai_enabled === false) {
      return NextResponse.json({ error: 'AI Assistant is currently disabled in your settings.' }, { status: 403 });
    }

    // Fetch rich live context
    const [{ data: brand }, { data: wallet }, { data: products }, { data: recentOrders }] = await Promise.all([
      supabaseAdmin.from('brands').select('*').eq('id', brandId).single(),
      supabaseAdmin.from('wallets').select('*').eq('brand_id', brandId).single(),
      supabaseAdmin.from('products').select('id, title, price, original_price, stock_count, sales_count, views_count, category').eq('brand_id', brandId),
      supabaseAdmin.from('orders').select('id, status, total_amount, created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(10),
    ]);

    // Derive pricing & sales insights
    const totalProducts = products?.length || 0;
    const lowStockItems = products?.filter(p => p.stock_count > 0 && p.stock_count <= 3) || [];
    const outOfStockItems = products?.filter(p => p.stock_count === 0) || [];
    const topSeller = products?.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))[0];
    const pendingOrders = recentOrders?.filter(o => o.status === 'pending').length || 0;
    const avgPrice = products && products.length > 0
      ? (products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length).toFixed(0)
      : '0';

    const tabContext: Record<string, string> = {
      overview: 'The vendor is currently on the OVERVIEW tab â€” this shows their earnings summary, live stats, and recent activity. Guide them through what each metric means.',
      orders: 'The vendor is currently on the ORDERS & FULFILLMENT tab. Help them understand how to process orders, update statuses, track deliveries, and use verification codes.',
      inventory: 'The vendor is currently on the LISTINGS & INVENTORY tab. Help them add products, edit listings, manage stock, upload images, set variants, and create drafts.',
      payments: 'The vendor is currently on the WALLET & PAYOUTS tab. Explain available vs pending balance, the 24-hour escrow hold, how to request a payout, and bank setup.',
      enquiries: 'The vendor is currently on the NOTIFICATIONS & ENQUIRIES tab. Help them view and respond to customer messages and platform notifications.',
      reviews: 'The vendor is currently on the CUSTOMER REVIEWS tab. Help them understand ratings, respond to reviews, and improve their reputation.',
      marketing: 'The vendor is currently on the MARKETING & PROMOS tab. Help them create promo codes, understand boost packages, and grow visibility.',
      services: 'The vendor is currently on the SERVICES tab. Help them create and manage service listings.',
      reels: 'The vendor is currently on the COLLECTION REELS tab. Help them upload brand showcase videos.',
      analytics: 'The vendor is currently on the SMART ANALYTICS tab. Help them understand charts, trends, and make data-driven decisions.',
      settings: 'The vendor is currently on the STORE SETTINGS tab. Help them update brand info, WhatsApp number, social links, and store preferences.',
      plans: 'The vendor is currently on the PLANS & UPGRADE tab. Help them understand the Quarter, Half Year, and Full Power plans and what each includes.',
      ai: 'The vendor is currently on the AI ASSISTANT tab. Help them understand how to configure and use their AI Copilot.',
    };

    const activeTabContext = tabContext[currentTab] || 'The vendor is browsing their dashboard.';

    const systemPrompt = `You are the Master Cart Vendor Copilot â€” a smart, friendly, and expert AI assistant built directly into the vendor dashboard.

Your primary roles are:
1. **Dashboard Guide**: Walk the vendor through every part of their dashboard, step by step, based on what tab they are currently on.
2. **Business Advisor**: Give real-time, data-driven insights about their pricing strategy, stock levels, and sales performance.
3. **Action Coach**: Tell them exactly what to do next to grow their store, fix issues, or improve performance.

---
ðŸ“ CURRENT CONTEXT:
${activeTabContext}

---
ðŸ“Š LIVE STORE DATA:
- Brand: ${brand?.name} | Status: ${brand?.verification_status || 'Pending'} | Tier: ${brand?.subscription_tier || 'Free'}
- Available Balance: ₦${wallet?.available_balance?.toLocaleString() || 0}
- Pending (Escrow): ₦${wallet?.pending_balance?.toLocaleString() || 0}
- Lifetime Earnings: ₦${wallet?.total_earnings?.toLocaleString() || 0}
- Total Withdrawn: ₦${wallet?.total_withdrawn?.toLocaleString() || 0}
- Total Products: ${totalProducts}
- Average Product Price: ₦${avgPrice}
- Top Seller: ${topSeller ? `"${topSeller.title}" (${topSeller.sales_count || 0} sales, ${topSeller.views_count || 0} views)` : 'None yet'}
- Low Stock Items (â‰¤3 left): ${lowStockItems.length} items ${lowStockItems.slice(0, 3).map(p => `"${p.title}"`).join(', ')}
- Out of Stock Items: ${outOfStockItems.length}
- Pending Orders right now: ${pendingOrders}

---
ðŸŽ¯ VENDOR CUSTOM INSTRUCTIONS:
${settings?.custom_instructions || 'None. Use professional, friendly tone.'}

---
ðŸ”’ HARD RULES (Never Break):
1. You are READ-ONLY. Do NOT withdraw funds, delete products, or change bank details.
2. Base all advice ONLY on the live data above. Do not invent numbers.
3. If the vendor asks something outside the scope of their store, politely redirect them.
4. Keep responses concise â€” use bullet points and emojis for clarity.
5. If low stock or out of stock items exist, always proactively mention them.
6. If pending orders exist, always remind the vendor to process them.

---
HOW TO ANSWER:
- If asked "how do I...": Give step-by-step instructions specific to Master Cart.
- If asked about earnings/wallet: Reference the exact live numbers above.
- If asked about pricing: Compare their average price (₦${avgPrice}) to typical campus market prices and give strategic advice.
- If asked generally: Give a short contextual overview of the current tab, then offer 2-3 quick tips.`;

    const lastUserMsg = messages.filter((m: any) => m.role === 'user').slice(-1)[0]?.content || '';
    const conversationHistory = messages.map((m: any) => `${m.role === 'user' ? 'Vendor' : 'AI'}: ${m.content}`).join('\n');

    console.log('Calling Gemini with model: gemini-1.5-pro');
    const { text } = await generateText({
      model: google('gemini-1.5-pro'),
      system: systemPrompt,
      prompt: conversationHistory + `\nVendor: ${lastUserMsg}\nAI:`,
    });

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Copilot Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

