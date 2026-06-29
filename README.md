# Vidfast Scraper

A self-hostable m3u8 stream scraper that extracts **raw HLS playlist URLs and content** from **vidfast.pro** and **vidlink/vidsrc** providers via the vaplayer.ru backend API. Includes a built-in **CORS proxy** for browser-side HLS.js playback.

Built with **Next.js 16 · TypeScript · Tailwind CSS 4**. Deploys to **Vercel** in one click.

---

## Features

- **Vidfast M3U8 Scraper** — Extract raw m3u8 stream URLs from `vidfast.pro/movie/{tmdb_id}`
  - Scrapes RSC payload for encrypted `en` token
  - Calls vaplayer.ru API to get stream URLs
  - Returns raw m3u8 playlist content
  - 4 source options: `auto`, `justhd`, `vidsrc`, `vidfast`
- **Vidlink Scraper** — Extract m3u8 streams via the vidlink/vidsrc provider chain
- **CORS Proxy** — Built-in `/api/proxy/m3u8` that:
  - Rewrites all URLs inside m3u8 playlists back through itself
  - Sets correct Referer headers per upstream host
  - Streams binary segments without buffering
  - Handles Range requests for MP4
- **4-tab GUI** — Scraper, Vidlink, Test Lab, API Docs
- **Vercel-ready** — Pure Node.js, no native dependencies

---

## How It Works

```
1. Fetch vidfast.pro/movie/{tmdb_id}
   → Parse RSC payload → Extract encrypted `en` token + metadata

2. Call streamdata.vaplayer.ru/api.php?tmdb={id}&source={source}
   → Get m3u8 stream URLs from VA Player backend

3. Return raw m3u8 URLs + playlist content
   → Proxied URLs ready for HLS.js
```

The vaplayer.ru API is the shared backend for vidfast.pro, vidsrc.pm, nextgencloudfabric.com, and other VA Player sites.

---

## Quick Start (Local Dev)

```bash
git clone https://github.com/sherenmalik93-create/vidfast-scraper.git
cd vidfast-scraper
bun install
bun run dev
# → http://localhost:3000
```

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel auto-detects Next.js — no build config needed.
4. Click **Deploy**. Done.

---

## API Reference

### Vidfast Scraper

| Endpoint | Description |
| --- | --- |
| `GET /api/vidfast?tmdb=ID&action=scrape` | Full pipeline: meta + m3u8 URLs + raw playlist + proxied URLs |
| `GET /api/vidfast?tmdb=ID&action=streams` | Just m3u8 stream URLs (fastest) |
| `GET /api/vidfast?tmdb=ID&action=raw` | m3u8 URLs + raw playlist content |
| `GET /api/vidfast?tmdb=ID&action=multi` | Try all sources (justhd, vidsrc, auto, vidfast) |
| `GET /api/vidfast?tmdb=ID&action=meta` | Only scrape vidfast.pro for en token + metadata |
| `GET /api/vidfast?action=sources` | List available sources |

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `tmdb` | string | Yes | TMDB movie/TV ID (e.g. `1265609`) |
| `action` | string | No | `scrape` \| `streams` \| `raw` \| `multi` \| `meta` \| `sources` (default: `scrape`) |
| `kind` | string | No | `movie` \| `tv` (default: `movie`) |
| `source` | string | No | `auto` \| `justhd` \| `vidsrc` \| `vidfast` (default: `auto`) |
| `season` | number | No | Season number (TV only) |
| `episode` | number | No | Episode number (TV only) |

### Vidlink Scraper

| Endpoint | Description |
| --- | --- |
| `GET /api/vidlink?tmdb=ID&action=streams` | Vidlink/vidsrc m3u8 stream URLs |
| `GET /api/vidlink?tmdb=ID&action=raw` | Vidlink m3u8 + raw playlist content |

**Parameters:** Same as Vidfast (default source is `vidsrc`).

### CORS Proxy

| Endpoint | Description |
| --- | --- |
| `GET /api/proxy/m3u8?url={encoded}` | Proxy any m3u8/segment URL with CORS headers and playlist URL rewriting |
| `GET /api/proxy/m3u8?url={encoded}&referer={encoded}` | Override Referer header |
| `GET /api/proxy/m3u8?url={encoded}&format=m3u8` | Force m3u8 format detection |
| `GET /api/proxy/m3u8?url={encoded}&format=vtt` | Force VTT subtitle format |

---

## HLS.js Usage

```javascript
import Hls from 'hls.js';

const hls = new Hls();

// Option 1: Use the proxied URL from the API response
hls.loadSource(result.proxiedSources[0].url);
hls.attachMedia(videoElement);

// Option 2: Use the proxy directly with a raw m3u8 URL
hls.loadSource('/api/proxy/m3u8?url=' + encodeURIComponent(masterUrl));
hls.attachMedia(videoElement);
```

---

## Example Response

```jsonc
// GET /api/vidfast?tmdb=1265609&action=scrape
{
  "success": true,
  "meta": {
    "tmdbId": "1265609",
    "title": "War Machine",
    "year": "2026",
    "backdrop": "https://image.tmdb.org/t/p/original/...",
    "enToken": "abc123...",
    "host": "vidfast.pro"
  },
  "sources": [
    { "url": "https://nextgenmarketinghub.site/playlist/abc/master.m3u8", "quality": "auto", "type": "master" }
  ],
  "rawM3u8": "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=...\n...",
  "proxiedSources": [
    { "url": "/api/proxy/m3u8?url=https%3A%2F%2Fnextgenmarketinghub.site%2F...", "quality": "auto", "type": "master" }
  ],
  "proxyM3u8Url": "/api/proxy/m3u8?url=..."
}
```

---

## Key Files

| Path | Purpose |
| --- | --- |
| `src/lib/vidfast/scraper.ts` | Core scraper: vidfast.pro RSC parser + vaplayer.ru API client |
| `src/app/api/vidfast/route.ts` | Vidfast API route (scrape, streams, raw, multi, meta) |
| `src/app/api/vidlink/route.ts` | Vidlink API route (streams, raw) |
| `src/app/api/proxy/m3u8/route.ts` | CORS proxy with m3u8 playlist rewriting |
| `src/app/page.tsx` | GUI: Scraper + Vidlink + Test Lab + API Docs |

---

## License

MIT
