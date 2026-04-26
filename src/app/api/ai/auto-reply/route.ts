import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { receiverId, senderId, content } = await req.json();

    if (!receiverId || !senderId || !content) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Check if the receiver is a vendor and get their brand
    const { data: brand } = await supabaseAdmin.from('brands').select('id, name, description').eq('owner_id', receiverId).single();
    if (!brand) return NextResponse.json({ success: true, message: 'Receiver is not a vendor' });

    // Check AI settings
    const { data: settings } = await supabaseAdmin.from('vendor_ai_settings').select('*').eq('brand_id', brand.id).single();
    if (!settings || !settings.ai_enabled || !settings.auto_reply_enabled) {
      return NextResponse.json({ success: true, message: 'Auto-reply disabled' });
    }

    // Fetch product context
    const { data: products } = await supabaseAdmin.from('products').select('title, price, stock_count, category').eq('brand_id', brand.id);
    const productList = products?.map(p => `- ${p.title} (₦${p.price}) - ${p.stock_count > 0 ? 'In Stock' : 'Out of Stock'}`).join('\n') || 'No products listed.';

    const systemPrompt = `You are the automated customer service AI for the brand "${brand.name}".
Your job is to answer customer questions politely and accurately based on the store's inventory.

STORE INFO:
Name: ${brand.name}
Description: ${brand.description || 'A great fashion brand.'}

PRODUCTS AVAILABLE:
${productList}

VENDOR'S CUSTOM AI INSTRUCTIONS:
${settings.custom_instructions || 'None.'}

RULES:
1. Answer the customer's message based ONLY on the products available above.
2. If the customer asks about something you don't know or if they ask to negotiate, say "The vendor is currently unavailable to answer this, but they will get back to you shortly."
3. Do NOT make up prices or products.
4. Keep the answer under 3 sentences. Be friendly and concise.`;

    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      prompt: `Customer message: "${content}"`,
    });

    // Insert the AI's reply into the messages table
    await supabaseAdmin.from('messages').insert({
      sender_id: receiverId, // AI speaks on behalf of the vendor
      receiver_id: senderId,
      content: text,
      answered_by_ai: true
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Auto-Reply Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
