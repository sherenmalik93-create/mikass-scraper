/**
 * Vidfast M3U8 Stream API
 *
 * GET /api/vidfast?tmdb=1265609
 * GET /api/vidfast?tmdb=1265609&action=scrape
 * GET /api/vidfast?tmdb=1265609&action=streams&source=justhd
 * GET /api/vidfast?tmdb=1265609&action=raw&source=auto
 * GET /api/vidfast?tmdb=1265609&action=multi
 * GET /api/vidfast?tmdb=1265609&kind=tv&season=1&episode=1
 * GET /api/vidfast?action=sources
 */

import { NextRequest, NextResponse } from "next/server";
import {
  scrapeVidfastM3U8,
  scrapeVidfastMeta,
  fetchM3U8Streams,
  scrapeAllSources,
  AVAILABLE_SOURCES,
  type MediaKind,
  type VaplayerSource,
} from "@/lib/vidfast/scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Content-Length": "0" } });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tmdbId = sp.get("tmdb");
  const kind = (sp.get("kind") || "movie") as MediaKind;
  const action = sp.get("action") || "scrape";
  const source = (sp.get("source") || "auto") as VaplayerSource;
  const season = sp.get("season") ? Number(sp.get("season")) : undefined;
  const episode = sp.get("episode") ? Number(sp.get("episode")) : undefined;
  const includeRaw = sp.get("raw") !== "false";

  // ---- List available sources ----
  if (action === "sources") {
    return NextResponse.json(
      {
        sources: AVAILABLE_SOURCES,
        apiDocs: {
          scrape: "/api/vidfast?tmdb=ID&action=scrape",
          streams: "/api/vidfast?tmdb=ID&action=streams",
          raw: "/api/vidfast?tmdb=ID&action=raw",
          multi: "/api/vidfast?tmdb=ID&action=multi",
          meta: "/api/vidfast?tmdb=ID&action=meta",
        },
      },
      { headers: CORS }
    );
  }

  // ---- All other actions require tmdb ID ----
  if (!tmdbId) {
    return NextResponse.json(
      { error: "Missing tmdb parameter. Usage: /api/vidfast?tmdb=1265609" },
      { status: 400, headers: CORS }
    );
  }

  try {
    switch (action) {
      case "scrape": {
        const result = await scrapeVidfastM3U8({
          tmdbId,
          kind,
          source,
          season,
          episode,
          includeRawPlaylist: includeRaw,
        });
        return NextResponse.json(result, { headers: CORS });
      }

      case "streams": {
        const { response, sources } = await fetchM3U8Streams(
          tmdbId,
          kind,
          source,
          season,
          episode
        );
        const proxiedSources = sources.map((s) => ({
          ...s,
          url: `/api/proxy/m3u8?url=${encodeURIComponent(s.url)}&referer=${encodeURIComponent("https://nextgenmarketinghub.site/")}`,
        }));
        return NextResponse.json(
          {
            success: true,
            tmdbId,
            kind,
            source,
            title: response.data?.title,
            imdbId: response.data?.imdb_id,
            fileName: response.data?.file_name,
            backdrop: response.data?.backdrop,
            sources,
            proxiedSources,
            thumbnailsUrl: response.thumbnails_url,
          },
          { headers: CORS }
        );
      }

      case "raw": {
        const { sources } = await fetchM3U8Streams(
          tmdbId,
          kind,
          source,
          season,
          episode
        );
        const masterUrl = sources.find((s) => s.type === "master")?.url;
        let rawM3u8: string | null = null;
        if (masterUrl) {
          try {
            const { fetchRawM3U8 } = await import("@/lib/vidfast/scraper");
            rawM3u8 = await fetchRawM3U8(masterUrl);
          } catch {
            rawM3u8 = null;
          }
        }
        return NextResponse.json(
          {
            success: true,
            tmdbId,
            kind,
            source,
            masterUrl,
            allUrls: sources.map((s) => s.url),
            rawM3u8,
            proxyUrl: masterUrl
              ? `/api/proxy/m3u8?url=${encodeURIComponent(masterUrl)}&referer=${encodeURIComponent("https://nextgenmarketinghub.site/")}`
              : null,
          },
          { headers: CORS }
        );
      }

      case "multi": {
        const results = await scrapeAllSources({
          tmdbId,
          kind,
          season,
          episode,
          includeRaw: true,
        });
        return NextResponse.json(
          { success: true, tmdbId, kind, results },
          { headers: CORS }
        );
      }

      case "meta": {
        const meta = await scrapeVidfastMeta(tmdbId, kind, season, episode);
        return NextResponse.json(
          { success: true, meta },
          { headers: CORS }
        );
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action "${action}". Use: scrape, streams, raw, multi, meta, or sources`,
          },
          { status: 400, headers: CORS }
        );
    }
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        tmdbId,
        kind,
        action,
      },
      { status: 502, headers: CORS }
    );
  }
}
