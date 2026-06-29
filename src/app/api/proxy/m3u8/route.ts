import { NextRequest, NextResponse } from 'next/server';

// Referer table for CDN domains that require specific headers
const REFERER_TABLE: Record<string, string> = {
  'allanime.day': 'https://mkissa.to/',
  'api.allanime.day': 'https://mkissa.to/',
  'bysekoze.com': 'https://mkissa.to/',
  'mp4upload.com': 'https://mkissa.to/',
  'ok.ru': 'https://mkissa.to/',
  'uns.bio': 'https://mkissa.to/',
  'allanime.uns.bio': 'https://mkissa.to/',
  'wp.youtube-anime.com': 'https://mkissa.to/',
  'nextgenmarketinghub.site': 'https://mkissa.to/',
  'cdnwjw': 'https://mkissa.to/',
  'filemoon': 'https://mkissa.to/',
  'fm-hls': 'https://mkissa.to/',
  'vidstream': 'https://mkissa.to/',
};

function getRefererForHost(urlStr: string): string {
  try {
    const host = new URL(urlStr).hostname;
    for (const [domain, ref] of Object.entries(REFERER_TABLE)) {
      if (host.includes(domain)) return ref;
    }
  } catch {}
  return 'https://mkissa.to/';
}

function isPlaylistContentType(ct: string | null): boolean {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return (
    lower.includes('mpegurl') ||
    lower.includes('mpeg-url') ||
    lower.includes('x-mpegurl') ||
    lower.includes('vnd.apple.mpegurl') ||
    lower.includes('audio/mpegurl') ||
    lower.includes('octet-stream') // Some servers return this for m3u8
  );
}

function isTextContentType(ct: string | null): boolean {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return (
    lower.includes('text/') ||
    lower.includes('json') ||
    lower.includes('xml') ||
    lower.includes('vtt') ||
    lower.includes('srt')
  );
}

/**
 * Rewrite URLs inside m3u8 playlists so HLS.js keeps using the proxy
 * Handles: absolute URLs, relative URLs, protocol-relative URLs
 */
function rewritePlaylistUrls(content: string, playlistUrl: string): string {
  let baseUrl: string;
  try {
    const parsed = new URL(playlistUrl);
    // Base for relative URLs is the directory containing the playlist
    baseUrl = parsed.href.substring(0, parsed.href.lastIndexOf('/') + 1);
  } catch {
    return content;
  }

  const lines = content.split('\n');
  const rewritten: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments (but process #EXT-X-MAP:URI=... and #EXT-X-KEY URI=...)
    if (trimmed === '' || (trimmed.startsWith('#') && !trimmed.includes('URI='))) {
      rewritten.push(line);
      continue;
    }

    // Handle #EXT-X-MAP:URI="..." or #EXT-X-KEY:...URI="..."
    if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
      line = line.replace(/URI="([^"]+)"/g, (match, uri) => {
        const absoluteUrl = resolveUrl(uri, baseUrl);
        if (absoluteUrl) {
          return `URI="${buildProxyUrl(absoluteUrl)}"`;
        }
        return match;
      });
      rewritten.push(line);
      continue;
    }

    // Skip other tags
    if (trimmed.startsWith('#')) {
      rewritten.push(line);
      continue;
    }

    // This is a URL line (variant playlist or segment)
    const absoluteUrl = resolveUrl(trimmed, baseUrl);
    if (absoluteUrl) {
      rewritten.push(buildProxyUrl(absoluteUrl));
    } else {
      rewritten.push(line);
    }
  }

  return rewritten.join('\n');
}

function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Protocol-relative
    if (url.startsWith('//')) {
      const baseParsed = new URL(baseUrl);
      return `${baseParsed.protocol}${url}`;
    }
    // Relative path
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

function buildProxyUrl(targetUrl: string): string {
  return `/api/proxy/m3u8?url=${encodeURIComponent(targetUrl)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    const referer = getRefererForHost(targetUrl);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': new URL(referer).origin,
      'Referer': referer,
    };

    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}`, url: targetUrl },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const urlPath = targetUrl.toLowerCase();

    // Determine if this is a playlist, subtitle, or binary segment
    const isM3U8 =
      isPlaylistContentType(contentType) ||
      urlPath.endsWith('.m3u8') ||
      urlPath.includes('.m3u8?');

    const isVTT =
      contentType.includes('vtt') ||
      urlPath.endsWith('.vtt') ||
      urlPath.endsWith('.srt');

    if (isM3U8) {
      // It's a playlist - rewrite URLs and serve
      const text = await response.text();
      const rewritten = rewritePlaylistUrls(text, targetUrl);

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (isVTT) {
      // Subtitle file - serve as-is
      const text = await response.text();
      return new NextResponse(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/vtt',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Binary segment (.ts, .mp4, .m4s, etc.) - stream through
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'video/mp2t',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Proxy error: ${err.message}` },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}
