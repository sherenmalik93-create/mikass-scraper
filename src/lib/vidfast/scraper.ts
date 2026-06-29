/**
 * Vidfast M3U8 Stream Scraper
 *
 * Extracts raw m3u8 playlist URLs from vidfast.pro and related providers
 * (vidsrc.pm, vidsrc.to, 2embed, etc.) using the vaplayer.ru backend API.
 *
 * How it works:
 *   1. Fetch vidfast.pro/movie/{tmdb_id} -> parse RSC payload -> extract `en` token
 *   2. Call streamdata.vaplayer.ru/api.php with tmdb ID -> get m3u8 stream URLs
 *   3. Return raw m3u8 URLs + playlist content through our CORS proxy
 *
 * The vaplayer.ru API is the shared backend for vidfast.pro, vidsrc.pm,
 * nextgencloudfabric.com, and other Video/Audio Player (VA Player) sites.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VidfastMovieMeta {
  tmdbId: string;
  title: string;
  year: string;
  backdrop: string;
  enToken: string;
  host: string;
}

export interface VidfastTvMeta extends VidfastMovieMeta {
  season?: number;
  episode?: number;
}

export interface M3U8StreamSource {
  url: string;
  quality: string;
  type: "master" | "variant";
}

export interface VaplayerResponse {
  status_code: string | number;
  data?: {
    title: string;
    imdb_id: string;
    file_name: string;
    backdrop: string;
    stream_urls: string[];
  };
  default_subs?: unknown[];
  thumbnails_url?: string;
}

export interface VidfastScrapeResult {
  success: boolean;
  meta: VidfastMovieMeta | null;
  sources: M3U8StreamSource[];
  subtitles: string[];
  rawM3u8: string | null;
  rawApiResponse: VaplayerResponse | null;
  proxiedSources: M3U8StreamSource[];
  proxyM3u8Url: string | null;
  error?: string;
}

export type MediaKind = "movie" | "tv";
export type VaplayerSource = "justhd" | "vidsrc" | "auto" | "vidfast";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const VIDFAST_BASE = "https://vidfast.pro";
const VAPLAYER_API = "https://streamdata.vaplayer.ru/api.php";
const NEXTGEN_CDN_HOST = "nextgenmarketinghub.site";

/**
 * Available "source" values for the vaplayer API.
 * Each source returns different CDN URLs / quality variants.
 */
export const AVAILABLE_SOURCES: VaplayerSource[] = [
  "justhd",
  "vidsrc",
  "auto",
  "vidfast",
];

// ---------------------------------------------------------------------------
// Step 1: Scrape vidfast.pro RSC payload -> extract `en` token + metadata
// ---------------------------------------------------------------------------

/**
 * Fetch the vidfast.pro page and parse the RSC (React Server Components)
 * payload to extract the encrypted `en` token and movie metadata.
 */
export async function scrapeVidfastMeta(
  tmdbId: string,
  kind: MediaKind = "movie",
  season?: number,
  episode?: number
): Promise<VidfastMovieMeta> {
  const path =
    kind === "tv"
      ? `/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}`
      : `/movie/${tmdbId}`;

  const url = `${VIDFAST_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`vidfast.pro returned ${res.status} for ${url}`);
  }

  const html = await res.text();

  // Parse RSC payload - the `en` token and metadata are embedded in a
  // self.__next_f.push() call like:
  //   5:["$","$L11",null,{"en":"...","host":"vidfast.pro","id":"1265609","title":"War Machine","year":"2026","backdrop":"..."}]
  const enMatch = html.match(/"en":"([^"]+)"/);
  const hostMatch = html.match(/"host":"([^"]+)"/);
  const titleMatch = html.match(/"title":"([^"]+)"/);
  const yearMatch = html.match(/"year":"([^"]+)"/);
  const backdropMatch = html.match(/"backdrop":"([^"]+)"/);

  if (!enMatch) {
    throw new Error(
      `Could not extract 'en' token from vidfast.pro page (${url}). ` +
        `The page structure may have changed.`
    );
  }

  return {
    tmdbId,
    title: titleMatch?.[1] ?? "",
    year: yearMatch?.[1] ?? "",
    backdrop: backdropMatch?.[1] ?? "",
    enToken: enMatch[1],
    host: hostMatch?.[1] ?? "vidfast.pro",
  };
}

// ---------------------------------------------------------------------------
// Step 2: Call vaplayer.ru API -> get m3u8 stream URLs
// ---------------------------------------------------------------------------

/**
 * Call the vaplayer.ru stream API to get m3u8 playlist URLs for a given
 * TMDB ID. This is the shared backend used by vidfast.pro, vidsrc.pm,
 * nextgencloudfabric.com, and other VA Player sites.
 */
export async function fetchM3U8Streams(
  tmdbId: string,
  kind: MediaKind = "movie",
  source: VaplayerSource = "auto",
  season?: number,
  episode?: number,
  token?: string,
  ts?: number
): Promise<{ response: VaplayerResponse; sources: M3U8StreamSource[] }> {
  const params = new URLSearchParams({
    type: kind,
    tmdb: tmdbId,
    source,
    token: token ?? "scrape",
    ts: String(ts ?? Math.floor(Date.now() / 1000)),
  });

  if (kind === "tv") {
    params.set("season", String(season ?? 1));
    params.set("episode", String(episode ?? 1));
  }

  const apiUrl = `${VAPLAYER_API}?${params.toString()}`;

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: "https://vidfast.pro/",
      Origin: "https://vidfast.pro",
      Accept: "application/json, */*",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`vaplayer API returned ${res.status}`);
  }

  const response: VaplayerResponse = await res.json();

  if (String(response.status_code) !== "200" || !response.data?.stream_urls) {
    throw new Error(
      `vaplayer API error: status=${response.status_code}, ` +
        `no stream_urls in response`
    );
  }

  // Parse stream URLs into labeled sources
  const sources: M3U8StreamSource[] = response.data.stream_urls.map(
    (url, i) => {
      const isPlaylist = url.includes("/playlist/");
      const isMaster = url.endsWith("/master.m3u8") || !isPlaylist;
      return {
        url,
        quality: isMaster
          ? i === 0
            ? "auto"
            : `${1080 - i * 360}p`
          : "playlist",
        type: isMaster ? "master" : "variant",
      };
    }
  );

  return { response, sources };
}

// ---------------------------------------------------------------------------
// Step 3: Fetch raw m3u8 playlist content
// ---------------------------------------------------------------------------

/**
 * Fetch the actual m3u8 playlist content from a stream URL.
 * This returns the raw #EXTM3U text so you can inspect qualities,
 * segments, and encryption keys.
 */
export async function fetchRawM3U8(
  m3u8Url: string,
  referer?: string
): Promise<string> {
  const ref = referer ?? `https://${NEXTGEN_CDN_HOST}/`;

  const res = await fetch(m3u8Url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: ref,
      Accept: "application/vnd.apple.mpegurl, */*",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`m3u8 fetch returned ${res.status}`);
  }

  const text = await res.text();
  if (!text.trimStart().startsWith("#EXTM3U")) {
    throw new Error("Response is not a valid m3u8 playlist");
  }
  return text;
}

// ---------------------------------------------------------------------------
// Convenience: Full pipeline (scrape + fetch m3u8)
// ---------------------------------------------------------------------------

/**
 * Full pipeline: scrape vidfast.pro -> extract en token -> call vaplayer API ->
 * get m3u8 URLs -> optionally fetch raw playlist content.
 */
export async function scrapeVidfastM3U8(opts: {
  tmdbId: string;
  kind?: MediaKind;
  source?: VaplayerSource;
  season?: number;
  episode?: number;
  includeRawPlaylist?: boolean;
}): Promise<VidfastScrapeResult> {
  const {
    tmdbId,
    kind = "movie",
    source = "auto",
    season,
    episode,
    includeRawPlaylist = true,
  } = opts;

  try {
    // Step 1: Scrape meta from vidfast.pro (extracts en token)
    let meta: VidfastMovieMeta | null = null;
    try {
      meta = await scrapeVidfastMeta(tmdbId, kind, season, episode);
    } catch (err) {
      console.warn(
        "[vidfast] Meta scrape failed, continuing with vaplayer API only:",
        err instanceof Error ? err.message : err
      );
    }

    // Step 2: Call vaplayer API to get m3u8 stream URLs
    const { response, sources } = await fetchM3U8Streams(
      tmdbId,
      kind,
      source,
      season,
      episode,
      meta?.enToken
    );

    // Step 3: Build proxied URLs (through our CORS proxy)
    const proxiedSources: M3U8StreamSource[] = sources.map((s) => ({
      ...s,
      url: `/api/proxy/m3u8?url=${encodeURIComponent(s.url)}&referer=${encodeURIComponent(`https://${NEXTGEN_CDN_HOST}/`)}`,
    }));

    // Step 4: Fetch raw m3u8 content from the first (master) stream
    let rawM3u8: string | null = null;
    const masterUrl = sources.find((s) => s.type === "master")?.url;
    if (includeRawPlaylist && masterUrl) {
      try {
        rawM3u8 = await fetchRawM3U8(masterUrl);
      } catch (err) {
        console.warn(
          "[vidfast] Raw m3u8 fetch failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    // Build the proxy URL for the master playlist
    const proxyM3u8Url = masterUrl
      ? `/api/proxy/m3u8?url=${encodeURIComponent(masterUrl)}&referer=${encodeURIComponent(`https://${NEXTGEN_CDN_HOST}/`)}`
      : null;

    return {
      success: true,
      meta,
      sources,
      subtitles: response.default_subs?.map(String) ?? [],
      rawM3u8,
      rawApiResponse: response,
      proxiedSources,
      proxyM3u8Url,
    };
  } catch (err) {
    return {
      success: false,
      meta: null,
      sources: [],
      subtitles: [],
      rawM3u8: null,
      rawApiResponse: null,
      proxiedSources: [],
      proxyM3u8Url: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Multi-source: Try all providers and return results from each
// ---------------------------------------------------------------------------

export interface MultiSourceResult {
  source: VaplayerSource;
  success: boolean;
  sources: M3U8StreamSource[];
  proxiedSources: M3U8StreamSource[];
  rawM3u8?: string | null;
  error?: string;
}

/**
 * Try all vaplayer sources (justhd, vidsrc, auto, vidfast) and return
 * results from each. This lets the client pick the best source.
 */
export async function scrapeAllSources(opts: {
  tmdbId: string;
  kind?: MediaKind;
  season?: number;
  episode?: number;
  includeRaw?: boolean;
}): Promise<MultiSourceResult[]> {
  const { tmdbId, kind = "movie", season, episode, includeRaw = false } = opts;

  const results = await Promise.allSettled(
    AVAILABLE_SOURCES.map(async (source) => {
      try {
        const { sources } = await fetchM3U8Streams(
          tmdbId,
          kind,
          source,
          season,
          episode
        );
        const proxiedSources: M3U8StreamSource[] = sources.map((s) => ({
          ...s,
          url: `/api/proxy/m3u8?url=${encodeURIComponent(s.url)}&referer=${encodeURIComponent(`https://${NEXTGEN_CDN_HOST}/`)}`,
        }));

        let rawM3u8: string | null = null;
        if (includeRaw) {
          const masterUrl = sources.find((s) => s.type === "master")?.url;
          if (masterUrl) {
            try {
              rawM3u8 = await fetchRawM3U8(masterUrl);
            } catch {
              rawM3u8 = null;
            }
          }
        }

        return {
          source,
          success: true,
          sources,
          proxiedSources,
          rawM3u8,
        } satisfies MultiSourceResult;
      } catch (err) {
        return {
          source,
          success: false,
          sources: [],
          proxiedSources: [],
          error: err instanceof Error ? err.message : "Failed",
        } satisfies MultiSourceResult;
      }
    })
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          source: "auto" as VaplayerSource,
          success: false,
          sources: [],
          proxiedSources: [],
          error: "Unknown error",
        }
  );
}
