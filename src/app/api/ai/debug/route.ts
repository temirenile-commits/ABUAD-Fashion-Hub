import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API Key missing in environment' });
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    return NextResponse.json({ 
      success: true, 
      models: data.models?.map((m: any) => ({
        name: m.name,
        methods: m.supportedGenerationMethods
      })) || [],
      raw: data
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
