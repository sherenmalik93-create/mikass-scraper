import { NextRequest, NextResponse } from 'next/server';

/**
 * Generic mangafire proxy
 * Forwards requests to mangafire.to with proper headers
 * This allows the frontend to make AJAX requests through our server
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  
  if (!targetUrl || !targetUrl.startsWith('https://mangafire.to/')) {
    return NextResponse.json(
      { success: false, error: 'Invalid URL. Must be a mangafire.to URL.' },
      { status: 400 }
    );
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, text/html, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.5',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://mangafire.to/',
      'Origin': 'https://mangafire.to',
    };

    // Forward any cookies from the client
    const clientCookies = searchParams.get('cookies');
    if (clientCookies) {
      headers['Cookie'] = clientCookies;
    }

    const res = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
    });

    const contentType = res.headers.get('content-type') || 'text/html';
    const body = await res.text();

    // Check for CF challenge
    if (body.includes('challenge-platform') || body.includes('Just a moment') || res.status === 403) {
      return NextResponse.json({
        success: false,
        error: 'Cloudflare challenge detected. Try using the cookie-based approach.',
        status: res.status,
        needsCookies: true,
      }, { status: 403 });
    }

    // Return the response with appropriate content type
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(body);
        return NextResponse.json({ success: true, data: json });
      } catch {
        // Return as text if not valid JSON
      }
    }

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'X-Proxied-From': targetUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
