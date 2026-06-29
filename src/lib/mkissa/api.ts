/**
 * mkissa.to API Client
 * Uses AllAnime GraphQL API at api.allanime.day
 * With AES-256-CTR decryption for episode sources
 */

import { createDecipheriv, createHash } from 'crypto';

const API_BASE = 'https://api.allanime.day/api';
const ORIGIN = 'https://mkissa.to';

// GraphQL persisted query hashes
const HASHES = {
  search: 'a24c500a1b765c68ae1d8dd85174931f661c71369c89b92b88b75a725afc471c',
  showDetail: '043448386c7a686bc2aabfbb6b80f6074e795d350df48015023b079527b0848a',
  episodeSources: 'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec',
  popular: 'a0aca6827cc9a3ad7bc711da4d200a04adea8f1a7545dc418d5e92e74c3aad15',
  random: '8b0aa1b19369f6f1e9c102314f4b410249f2556dba1ee4c9df63c17151df9a7e',
} as const;

export type TranslationType = 'sub' | 'dub';
export type SortBy = 'Recent' | 'Popular' | 'Random';

export interface AnimeSearchResult {
  _id: string;
  name: string;
  thumbnail: string;
  englishName: string;
  nativeName: string;
  romajiName: string;
  score: number;
  status: string;
  season: { quarter: string; year: number };
  genres: string[];
  type: string;
  episodeCount: number;
}

export interface ShowDetail {
  _id: string;
  name: string;
  englishName: string;
  nativeName: string;
  romajiName: string;
  thumbnail: string;
  banner: string;
  score: number;
  status: string;
  season: { quarter: string; year: number };
  genres: string[];
  tags: string[];
  type: string;
  description: string;
  episodeCount: number;
  lastEpisodeDate: number;
  characters: any[];
}

export interface EpisodeSource {
  sourceUrl: string;
  priority: number;
  sourceName: string;
  stype: string;
  type: string;
  className: string;
  streamerId: string;
  downloads?: {
    sourceName: string;
    downloadUrl: string;
  };
  sandbox?: string;
}

export interface EpisodeInfo {
  vidResolution: number;
  vidPath: string;
  vidSize: number;
  vidDuration: number;
}

export interface EpisodeData {
  episodeString: string;
  sourceUrls: EpisodeSource[];
  show: any;
  episodeInfo?: {
    thumbnails: string[];
    vidInforssub?: EpisodeInfo;
    vidInforsdub?: EpisodeInfo;
    uploadDates: Record<string, string>;
  };
}

async function apiGet(variables: Record<string, any>, hash: string): Promise<any> {
  const url = new URL(API_BASE);
  url.searchParams.set('variables', JSON.stringify(variables));
  url.searchParams.set('extensions', JSON.stringify({
    persistedQuery: { version: 1, sha256Hash: hash },
  }));

  const res = await fetch(url.toString(), {
    headers: {
      'Origin': ORIGIN,
      'Referer': 'https://mkissa.to/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': '*/*',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();

  // Check for Cloudflare challenge
  if (typeof data === 'string' && data.includes('challenge-platform')) {
    throw new Error('Cloudflare challenge detected - API blocked');
  }

  return data;
}

/**
 * Search/browse anime
 */
export async function searchAnime(
  query?: string,
  options?: {
    sortBy?: SortBy;
    limit?: number;
    page?: number;
    translationType?: TranslationType;
    genres?: string[];
    types?: string[];
    year?: number;
    season?: string;
  }
): Promise<{ shows: AnimeSearchResult[]; pageInfo: { total: number } }> {
  const search: Record<string, any> = {};
  if (query) search.query = query;
  if (options?.sortBy) search.sortBy = options.sortBy;
  else if (!query) search.sortBy = 'Recent';
  if (options?.genres?.length) search.genres = options.genres;
  if (options?.types?.length) search.types = options.types;
  if (options?.year) search.year = options.year;
  if (options?.season) search.season = options.season;

  const variables: Record<string, any> = {
    search,
    limit: options?.limit ?? 25,
    page: options?.page ?? 1,
    translationType: options?.translationType ?? 'sub',
  };

  const data = await apiGet(variables, HASHES.search);
  const showsData = data?.data?.shows;
  if (showsData?.edges) {
    return { shows: showsData.edges, pageInfo: showsData.pageInfo ?? { total: 0 } };
  }
  return { shows: Array.isArray(showsData) ? showsData : [], pageInfo: { total: 0 } };
}

/**
 * Get show detail by ID
 */
export async function getShowDetail(showId: string): Promise<ShowDetail | null> {
  const data = await apiGet({ _id: showId }, HASHES.showDetail);
  return data?.data?.show ?? null;
}

/**
 * Get popular/trending anime
 */
export async function getPopular(
  options?: { size?: number; dateRange?: number; page?: number }
): Promise<any> {
  const variables = {
    type: 'anime',
    size: options?.size ?? 20,
    dateRange: options?.dateRange ?? 1,
    page: options?.page ?? 1,
    allowAdult: false,
    allowUnknown: false,
  };
  const data = await apiGet(variables, HASHES.popular);
  return data?.data?.popular ?? null;
}

/**
 * AES-256-CTR Decryption for episode sources
 * 
 * Key: SHA-256("Xot36i3lK3:v1")
 * Cipher: AES-256-CTR
 * Blob format: [1 byte prefix][12 bytes nonce][ciphertext][16 bytes trailing tag (discarded)]
 * IV/Counter: nonce (12 bytes) + 0x00000002 (4 bytes)
 */
function decryptTobeparsed(b64Blob: string): string {
  const data = Buffer.from(b64Blob, 'base64');

  if (data.length < 30) {
    throw new Error(`Blob too short: ${data.length} bytes`);
  }

  // Key: SHA-256 of passphrase
  const key = createHash('sha256').update('Xot36i3lK3:v1').digest();

  // Nonce: bytes 1-12 (skip 1-byte version prefix)
  const nonce = data.subarray(1, 13);

  // Ciphertext: bytes 13 to len-16 (discard last 16 bytes = GCM tag, no longer valid)
  const ciphertext = data.subarray(13, data.length - 16);

  // Counter: nonce (12 bytes) + 0x00000002 (4 bytes)
  const iv = Buffer.alloc(16);
  nonce.copy(iv, 0);
  iv[15] = 0x02;

  const decipher = createDecipheriv('aes-256-ctr', key, iv);
  return decipher.update(ciphertext).toString('utf8') + decipher.final().toString('utf8');
}

/**
 * Decode XOR-encoded source URLs
 * Format 1: "--" prefix → XOR with 0x38
 * Format 2: "ap/" prefix → raw hex decode
 */
export function decodeSourceUrl(raw: string): string {
  if (!raw) return raw;

  // XOR with 0x38
  if (raw.startsWith('--')) {
    const hex = raw.slice(2);
    return Buffer.from(hex, 'hex')
      .map(b => b ^ 56)
      .toString('utf8');
  }

  // Raw hex decode
  if (raw.startsWith('ap/')) {
    return Buffer.from(raw.slice(3), 'hex').toString('utf8');
  }

  return raw;
}

/**
 * Get episode sources (with decryption)
 */
export async function getEpisodeSources(
  showId: string,
  episodeString: string,
  translationType: TranslationType = 'sub'
): Promise<EpisodeData | null> {
  const variables = {
    showId,
    translationType,
    episodeString,
  };

  const data = await apiGet(variables, HASHES.episodeSources);

  // Episode data may be under data.episode, or encrypted fields may be directly on data
  let epData = data?.data?.episode;
  const directEncrypted = !epData && data?.data?._m && data?.data?.tobeparsed ? data.data : null;

  if (!epData && !directEncrypted) return null;

  // Check if sources are encrypted (either nested or at top level)
  const encryptedSource = epData?._m && epData?.tobeparsed ? epData : directEncrypted;

  if (encryptedSource) {
    try {
      const decryptedText = decryptTobeparsed(encryptedSource.tobeparsed);
      const decrypted = JSON.parse(decryptedText);
      // The decrypted data may contain an episode key
      const result = decrypted?.episode ?? decrypted ?? null;
      if (result) {
        // Decode any XOR-encoded source URLs
        if (result.sourceUrls) {
          result.sourceUrls = result.sourceUrls.map((src: EpisodeSource) => ({
            ...src,
            sourceUrl: decodeSourceUrl(src.sourceUrl),
          }));
        }
        return result;
      }
    } catch (err) {
      console.error('Decryption failed:', err);
      // Fall through to return whatever we have
    }
  }

  // If epData exists and is not encrypted, decode URLs
  if (epData?.sourceUrls) {
    epData.sourceUrls = epData.sourceUrls.map((src: EpisodeSource) => ({
      ...src,
      sourceUrl: decodeSourceUrl(src.sourceUrl),
    }));
  }

  return epData;
}

/**
 * Get direct MP4 URL from episode info
 */
export function getDirectMp4Url(episodeData: EpisodeData, translationType: TranslationType = 'sub'): string | null {
  const vidInfo = translationType === 'dub'
    ? episodeData?.episodeInfo?.vidInforsdub
    : episodeData?.episodeInfo?.vidInforssub;

  if (vidInfo?.vidPath) {
    return `https://api.allanime.day${vidInfo.vidPath}`;
  }
  return null;
}
