import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://api.allanime.day/api';

/**
 * Proxy for AllAnime GraphQL API
 * Forwards requests with proper Origin/Referer headers to bypass CORS/Cloudflare
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path');
    
    if (!targetPath) {
      // If no path, forward the entire query string to the API
      const queryString = searchParams.toString();
      const apiUrl = `${API_BASE}?${queryString.replace(/(^|&)path=[^&]*&?/, '')}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Origin': 'https://mkissa.to',
          'Referer': 'https://mkissa.to/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
      });

      const data = await response.json();
      return NextResponse.json(data, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    // Forward to specific path
    const apiUrl = `${API_BASE}${targetPath}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Origin': 'https://mkissa.to',
        'Referer': 'https://mkissa.to/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `API proxy error: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
