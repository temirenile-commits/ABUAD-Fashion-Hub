import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, vendorId, brandId } = await req.json();

    if (!vendorId || !brandId) {
      return NextResponse.json({ error: 'Missing vendor context' }, { status: 400 });
    }

    // Check if AI is enabled for this vendor
    const { data: settings } = await supabaseAdmin.from('vendor_ai_settings').select('ai_enabled, custom_instructions').eq('brand_id', brandId).single();
    
    if (settings && settings.ai_enabled === false) {
      return NextResponse.json({ error: 'AI Assistant is currently disabled in your settings.' }, { status: 403 });
    }

    // Fetch rich context
    const { data: brand } = await supabaseAdmin.from('brands').select('*').eq('id', brandId).single();
    const { data: wallet } = await supabaseAdmin.from('wallets').select('*').eq('brand_id', brandId).single();
    const { data: products } = await supabaseAdmin.from('products').select('id, title, price, stock_count').eq('brand_id', brandId);
    
    // Calculate simple stats
    const totalProducts = products?.length || 0;
    const lowStockProducts = products?.filter(p => p.stock_count > 0 && p.stock_count <= 3)?.length || 0;
    const outOfStockProducts = products?.filter(p => p.stock_count === 0)?.length || 0;

    const systemPrompt = `You are the ABUAD Fashion Hub Vendor Copilot.
You are a helpful, professional AI assistant built directly into the vendor dashboard. 
Your job is to help the vendor understand their metrics, manage their store, and guide them on how to use the dashboard.

CONTEXT ABOUT THE VENDOR'S STORE:
- Vendor Brand Name: ${brand?.name || 'Unknown'}
- Verification Status: ${brand?.verification_status || 'Unknown'}
- Subscription Tier: ${brand?.subscription_tier || 'Free'}
- Available Balance: ₦${wallet?.available_balance || 0}
- Pending (Escrow) Balance: ₦${wallet?.pending_balance || 0}
- Lifetime Earnings: ₦${wallet?.total_earnings || 0}
- Total Products Listed: ${totalProducts}
- Low Stock Items: ${lowStockProducts}
- Out of Stock Items: ${outOfStockProducts}

VENDOR'S CUSTOM INSTRUCTIONS:
${settings?.custom_instructions || 'None provided.'}

INSTRUCTIONS:
- Answer questions accurately based ONLY on the context above.
- If asked how to withdraw, tell them they need a minimum of ₦1,000 and to go to the Payments & Wallet tab.
- If asked about Escrow, explain it's held for 24 hours after delivery to protect the customer.
- Be concise, supportive, and professional.
- Do NOT perform actions (like withdrawing funds or deleting products) directly. You are currently read-only.
- Format responses cleanly using Markdown. If you use lists, keep them short.`;

    const { text } = await generateText({
      model: google('models/gemini-1.5-flash-latest'),
      system: systemPrompt,
      prompt: messages.map((m: any) => `${m.role}: ${m.content}`).join('\n') + '\nassistant:',
    });

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Copilot Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
