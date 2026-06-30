import { NextRequest, NextResponse } from 'next/server';
import { setCFCookies, isCFCookiesValid } from '@/lib/mangafire/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookies = body.cookies;
    if (!cookies || typeof cookies !== 'string') {
      return NextResponse.json({ success: false, error: 'cookies string is required' }, { status: 400 });
    }
    const ttl = body.ttl || 30;
    setCFCookies(cookies, ttl);
    return NextResponse.json({ success: true, message: `CF cookies set, valid for ${ttl} minutes`, isValid: isCFCookiesValid() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    hasCookies: isCFCookiesValid(),
    message: isCFCookiesValid() ? 'CF cookies valid' : 'No CF cookies. Set via POST.',
  });
}
