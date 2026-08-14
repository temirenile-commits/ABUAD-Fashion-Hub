import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    provider: 'deepseek',
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
    serverOnly: true,
  });
}
