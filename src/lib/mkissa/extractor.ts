/**
 * Stream Extractor for mkissa.to embed sources
 * Handles XOR-decoded source URLs from the AllAnime API
 */

import { EpisodeSource, EpisodeData, TranslationType } from './api';

export interface ExtractedStream {
  provider: string;
  url: string;
  type: 'm3u8' | 'mp4' | 'iframe' | 'clock';
  quality?: string;
  originalUrl: string;
  proxyUrl?: string;
}

/**
 * Categorize all sources from episode data
 * Since embed pages are client-side rendered SPAs, we return:
 * - Clock URLs: AllAnime's own stream endpoint (Cloudflare-protected, returns m3u8)
 * - Iframe URLs: Embed pages (Filemoon, MP4Upload, etc.)
 * - Direct MP4: From episode info vidPath
 */
export function categorizeStreams(
  episodeData: EpisodeData | null,
  translationType: TranslationType = 'sub'
): ExtractedStream[] {
  const streams: ExtractedStream[] = [];

  if (!episodeData) return streams;

  // 1. Direct MP4 from episodeInfo
  const vidInfo = translationType === 'dub'
    ? episodeData?.episodeInfo?.vidInforsdub
    : episodeData?.episodeInfo?.vidInforssub;

  if (vidInfo?.vidPath) {
    const mp4Url = `https://api.allanime.day${vidInfo.vidPath}`;
    streams.push({
      provider: 'Direct MP4',
      url: mp4Url,
      type: 'mp4',
      quality: `${vidInfo.vidResolution}p`,
      originalUrl: mp4Url,
      proxyUrl: `/api/proxy/m3u8?url=${encodeURIComponent(mp4Url)}`,
    });
  }

  // 2. Categorize embed sources
  if (episodeData?.sourceUrls?.length) {
    // Sort by priority (higher = better)
    const sorted = [...episodeData.sourceUrls].sort((a, b) => b.priority - a.priority);

    for (const source of sorted) {
      const url = source.sourceUrl;
      if (!url) continue;

      // AllAnime clock endpoint (highest priority, returns m3u8)
      if (url.startsWith('/apivtwo/clock')) {
        const fullUrl = `https://api.allanime.day${url}`;
        streams.push({
          provider: source.sourceName || 'Default',
          url: fullUrl,
          type: 'clock',
          quality: 'Best (CF Protected)',
          originalUrl: fullUrl,
        });
        continue;
      }

      // Filemoon embed
      if (url.includes('bysekoze.com') || url.includes('filemoon')) {
        streams.push({
          provider: 'Fm-Hls (Filemoon)',
          url,
          type: 'iframe',
          originalUrl: url,
        });
        continue;
      }

      // MP4Upload embed
      if (url.includes('mp4upload')) {
        streams.push({
          provider: 'Mp4 (MP4Upload)',
          url,
          type: 'iframe',
          originalUrl: url,
        });
        continue;
      }

      // StreamSB embed
      if (url.includes('streamsb')) {
        streams.push({
          provider: 'Ss-Hls (StreamSB)',
          url,
          type: 'iframe',
          originalUrl: url,
        });
        continue;
      }

      // OK.ru embed
      if (url.includes('ok.ru')) {
        streams.push({
          provider: 'Ok (OK.ru)',
          url,
          type: 'iframe',
          originalUrl: url,
        });
        continue;
      }

      // Streamlare embed
      if (url.includes('streamlare')) {
        streams.push({
          provider: 'Sl-mp4 (Streamlare)',
          url,
          type: 'iframe',
          originalUrl: url,
        });
        continue;
      }

      // Uns/Vidstream embed
      if (url.includes('uns.bio') || url.includes('vidstream')) {
        streams.push({
          provider: 'Uni (Vidstream)',
          url,
          type: 'iframe',
          originalUrl: url,
        });
        continue;
      }

      // Generic source
      streams.push({
        provider: source.sourceName || 'Unknown',
        url,
        type: 'iframe',
        originalUrl: url,
      });
    }
  }

  return streams;
}
