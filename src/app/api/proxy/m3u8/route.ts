/**
 * Streaming CORS proxy for upstream m3u8 / segment URLs.
 *
 * Design goals:
 *   1. STREAM, don't buffer. Pipe upstream bytes through a ReadableStream
 *      so we never hold a full segment in memory and bypass Vercel's
 *      4.5MB response body limit.
 *   2. Forward Range headers both ways so MP4 byte-range requests work.
 *   3. Handle CORS preflight (OPTIONS).
 *   4. Auto-pick the right Referer per upstream host so CDN doesn't 403 us.
 *   5. Rewrite every URI inside m3u8 playlists so the player keeps calling
 *      us instead of going direct.
 *
 * Usage:
 *   GET /api/proxy/m3u8?url=<encoded>
 *   GET /api/proxy/m3u8?url=<encoded>&referer=<encoded>
 *   GET /api/proxy/m3u8?url=<encoded>&format=vtt
 *   GET /api/proxy/m3u8?url=<encoded>&format=m3u8
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Per-host Referer table. When the upstream URL's host matches one of these,
 * we send that host's page as the Referer.
 */
const REFERER_BY_HOST: Array<{ match: RegExp; referer: string }> = [
  // --- Vidfast / VA Player CDN domains ---
  { match: /nextgenmarketinghub\.site$/i, referer: "https://nextgencloudfabric.com/" },
  { match: /nextgencloudfabric\.com$/i, referer: "https://vidsrc.pm/" },
  { match: /vidapi\.cloud$/i, referer: "https://nextgencloudfabric.com/" },
  { match: /streamdata\.vaplayer\.ru$/i, referer: "https://vidfast.pro/" },
  { match: /vidfast\.pro$/i, referer: "https://vidfast.pro/" },
  // --- Vidlink / VidSrc family ---
  { match: /vidsrc\.pm$/i, referer: "https://vidsrc.pm/" },
  { match: /vidsrc\.to$/i, referer: "https://vidsrc.to/" },
  { match: /vidsrc\.cc$/i, referer: "https://vidsrc.cc/" },
  { match: /2embed\.cc$/i, referer: "https://2embed.cc/" },
  { match: /vidlink\./i, referer: "https://vidlink.to/" },
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers":
    "Content-Type, Content-Length, Content-Range, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickReferer(targetUrl: string, override?: string | null): string {
  if (override) return override;
  let host = "";
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    /* ignore */
  }
  for (const r of REFERER_BY_HOST) {
    if (r.match.test(host)) return r.referer;
  }
  // Fall back to the upstream origin itself
  try {
    const u = new URL(targetUrl);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return "https://vidfast.pro/";
  }
}

function buildUpstreamHeaders(target: string, referer: string, req: NextRequest) {
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Referer: referer,
    Origin: referer.replace(/\/$/, ""),
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const range = req.headers.get("range");
  if (range) headers["Range"] = range;
  return headers;
}

/**
 * Rewrite every URI inside an m3u8 playlist so it goes back through this
 * proxy. Handles:
 *   - Plain URI lines (variants, segments)
 *   - #EXT-X-KEY URI="..."
 *   - #EXT-X-MAP URI="..."
 *   - #EXT-X-MEDIA URI="..."
 */
function rewritePlaylistUrls(
  body: string,
  baseUrl: string,
  referer?: string
): string {
  const proxy = "/api/proxy/m3u8?url=";
  const refererSuffix = referer
    ? `&referer=${encodeURIComponent(referer)}`
    : "";
  const lines = body.split(/\r?\n/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        // Rewrite URI="..." attributes inside #EXT-X-* tags
        return line.replace(/URI="([^"]+)"/g, (_m, rawUri: string) => {
          let absolute: string;
          if (/^https?:\/\//i.test(rawUri)) {
            absolute = rawUri;
          } else {
            try {
              absolute = new URL(rawUri, baseUrl).href;
            } catch {
              return _m;
            }
          }
          return `URI="${proxy}${encodeURIComponent(absolute)}${refererSuffix}"`;
        });
      }
      // Plain URI line
      let absolute: string;
      if (/^https?:\/\//i.test(trimmed)) {
        absolute = trimmed;
      } else {
        try {
          absolute = new URL(trimmed, baseUrl).href;
        } catch {
          return line;
        }
      }
      return `${proxy}${encodeURIComponent(absolute)}${refererSuffix}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// OPTIONS - CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Content-Length": "0" },
  });
}

// ---------------------------------------------------------------------------
// HEAD
// ---------------------------------------------------------------------------

export async function HEAD(req: NextRequest) {
  return GET(req);
}

// ---------------------------------------------------------------------------
// GET - main proxy
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  const format = req.nextUrl.searchParams.get("format"); // "vtt" | "m3u8"
  const refererOverride = req.nextUrl.searchParams.get("referer");

  if (!urlParam) {
    return NextResponse.json(
      { error: "Missing url parameter." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let target: string;
  try {
    target = decodeURIComponent(urlParam);
  } catch {
    return NextResponse.json(
      { error: "Invalid url encoding." },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json(
      { error: "url must be absolute http(s)." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const referer = pickReferer(target, refererOverride);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: buildUpstreamHeaders(target, referer, req),
      cache: "no-store",
      redirect: "follow",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to reach upstream.",
      },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          upstream.headers.get("content-type") || "text/plain",
      },
    });
  }

  const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
  const lowerTarget = target.toLowerCase();
  const isPlaylistForced = format === "m3u8";
  const isSubtitleForced = format === "vtt";

  // --- m3u8 PLAYLIST branch ---
  const looksLikePlaylistByMeta =
    isPlaylistForced ||
    contentType.includes("mpegurl") ||
    contentType.includes("m3u8") ||
    lowerTarget.endsWith(".m3u8") ||
    lowerTarget.includes(".m3u8?");

  if (looksLikePlaylistByMeta) {
    const body = await upstream.text();
    if (body.trimStart().startsWith("#EXTM3U")) {
      const rewritten = rewritePlaylistUrls(body, target, referer);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "public, max-age=10, s-maxage=30",
        },
      });
    }
    // False positive - fall through to binary
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    });
  }

  // --- VTT SUBTITLE branch ---
  if (
    isSubtitleForced ||
    contentType.includes("text/vtt") ||
    lowerTarget.endsWith(".vtt")
  ) {
    const body = await upstream.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  }

  // --- Binary segment / MP4 / TS branch - STREAM IT THROUGH ---
  const passthroughHeaders: Record<string, string> = {
    ...CORS_HEADERS,
    "Content-Type":
      upstream.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "public, max-age=300, s-maxage=3600",
  };

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) passthroughHeaders["Content-Length"] = contentLength;
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) passthroughHeaders["Content-Range"] = contentRange;
  passthroughHeaders["Accept-Ranges"] =
    upstream.headers.get("accept-ranges") || "bytes";

  const status = upstream.status === 206 ? 206 : 200;

  return new NextResponse(upstream.body as ReadableStream<Uint8Array>, {
    status,
    headers: passthroughHeaders,
  });
}
