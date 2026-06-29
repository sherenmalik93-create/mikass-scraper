# Mkissa Scraper

mkissa.to anime stream scraper with HLS player and CORS proxy.

## Features
- 🔍 Search & browse anime from mkissa.to (AllAnime API)
- 🔓 AES-GCM decryption of episode sources
- 🎬 Stream extraction from Filemoon, MP4Upload, OK.ru, Uns/Vidstream
- 📺 Built-in HLS.js player with controls
- 🔄 CORS proxy for m3u8 streams (rewrites playlists, streams segments)
- 🚀 Ready to deploy on Vercel

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/mkissa/search?q=naruto` | Search anime |
| `GET /api/mkissa/show?id=XXX` | Get show details |
| `GET /api/mkissa/episodes?showId=XXX&episode=1` | Get episode sources |
| `GET /api/mkissa/streams?showId=XXX&episode=1` | Extract direct stream URLs |
| `GET /api/proxy/m3u8?url=XXX` | CORS proxy for streams |

## Tech Stack
- Next.js 16 + TypeScript
- HLS.js for video playback
- Web Crypto API for AES-GCM decryption
- Tailwind CSS + shadcn/ui

## Deploy
```bash
git push  # Deploy to Vercel automatically
```
