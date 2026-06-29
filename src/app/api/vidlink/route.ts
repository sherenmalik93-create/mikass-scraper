/**
 * Vidlink M3U8 Stream API
 *
 * GET /api/vidlink?tmdb=1265609
 * GET /api/vidlink?tmdb=1265609&action=streams
 * GET /api/vidlink?tmdb=1265609&action=raw
 * GET /api/vidlink?tmdb=1265609&kind=tv&season=1&episode=1
 *
 * Uses the vaplayer.ru backend (same as vidfast) but with "vidsrc" source
 * which maps to the vidlink/vidsrc provider chain.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchM3U8Streams,
  fetchRawM3U8,
  type MediaKind,
  type VaplayerSource,
} from "@/lib/vidfast/scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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
  const action = sp.get("action") || "streams";
  const source = (sp.get("source") || "vidsrc") as VaplayerSource;
  const season = sp.get("season") ? Number(sp.get("season")) : undefined;
  const episode = sp.get("episode") ? Number(sp.get("episode")) : undefined;

  if (!tmdbId) {
    return NextResponse.json(
      { error: "Missing tmdb parameter. Usage: /api/vidlink?tmdb=1265609" },
      { status: 400, headers: CORS }
    );
  }

  try {
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

    const playlistUrl = sources.find((s) => s.quality.includes("direct"))?.url;
    const masterUrl = sources.find((s) => s.type === "master")?.url;
    const bestUrl = playlistUrl || masterUrl;

    // If action=raw, also fetch the raw m3u8 playlist content
    let rawM3u8: string | null = null;
    if (action === "raw" && bestUrl) {
      try {
        rawM3u8 = await fetchRawM3U8(bestUrl);
      } catch {
        rawM3u8 = null;
      }
    }

    return NextResponse.json(
      {
        success: true,
        provider: "vidlink",
        tmdbId,
        kind,
        source,
        title: response.data?.title,
        imdbId: response.data?.imdb_id,
        fileName: response.data?.file_name,
        backdrop: response.data?.backdrop,
        sources,
        proxiedSources,
        proxyUrl: bestUrl
          ? `/api/proxy/m3u8?url=${encodeURIComponent(bestUrl)}&referer=${encodeURIComponent("https://nextgenmarketinghub.site/")}`
          : null,
        masterUrl: bestUrl,
        ...(rawM3u8 !== null ? { rawM3u8 } : {}),
      },
      { headers: CORS }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        provider: "vidlink",
        error: err instanceof Error ? err.message : "Unknown error",
        tmdbId,
        kind,
      },
      { status: 502, headers: CORS }
    );
  }
}
