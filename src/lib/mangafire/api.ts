/**
 * MangaFire API Client v2
 * Uses multiple strategies for Cloudflare bypass:
 * 1. z-ai-web-dev-sdk page_reader (handles CF automatically)
 * 2. Playwright headless browser (for full rendering)
 * 3. Direct fetch with user-provided cookies
 * 
 * Key mangafire endpoints (from keiyoushi Tachiyomi extension):
 * - Search: /filter?keyword=...&language[]=en&page=1
 * - Chapters: /ajax/manga/{mangaId}/chapter/{langCode}
 * - Pages: /ajax/read/chapter/{id}?vrf=...
 * - Manga detail: /manga/{slug}
 */

import ZAI from 'z-ai-web-dev-sdk';
import { JSDOM } from 'jsdom';

const BASE_URL = 'https://mangafire.to';

// CF Cookies cache (from user input or Playwright)
let cfCookies: string | null = null;
let cfCookieExpiry = 0;

// ZAI SDK instance (lazy init)
let zaiInstance: any = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ============== Types ==============

export interface MangaSearchResult {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  url: string;
  type?: string;
}

export interface MangaInfo {
  id: string;
  slug: string;
  title: string;
  altTitle?: string;
  thumbnail: string;
  description: string;
  status: string;
  type: string;
  genres: string[];
  author?: string;
  chapters: ChapterInfo[];
}

export interface ChapterInfo {
  id: string;
  number: number;
  title: string;
  url: string;
  date: string;
  lang: string;
}

export interface PageImage {
  index: number;
  url: string;
  offset: number;
  needsDescramble: boolean;
}

export interface PopularManga {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  url: string;
  type?: string;
}

// ============== Cookie Management ==============

export function setCFCookies(cookies: string, ttlMinutes: number = 30) {
  cfCookies = cookies;
  cfCookieExpiry = Date.now() + ttlMinutes * 60 * 1000;
}

export function getCFCookies(): string | null {
  if (cfCookies && Date.now() < cfCookieExpiry) {
    return cfCookies;
  }
  return null;
}

export function isCFCookiesValid(): boolean {
  return cfCookies !== null && Date.now() < cfCookieExpiry;
}

// ============== Fetching Strategies ==============

/**
 * Strategy 1: Direct fetch with CF cookies
 */
async function fetchWithCookies(url: string): Promise<string | null> {
  const cookies = getCFCookies();
  if (!cookies) return null;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': `${BASE_URL}/`,
        'Cookie': cookies,
      },
      redirect: 'follow',
    });

    const text = await res.text();
    if (text.includes('challenge-platform') || text.includes('Just a moment') || res.status === 403) {
      return null; // Cookies expired
    }
    return text;
  } catch {
    return null;
  }
}

/**
 * Strategy 2: z-ai page_reader (handles CF automatically)
 */
async function fetchWithPageReader(url: string): Promise<string | null> {
  try {
    const zai = await getZAI();
    const result = await zai.functions.invoke('page_reader', { url });
    if (result?.data?.html) {
      return result.data.html;
    }
    return null;
  } catch (error: any) {
    console.error('page_reader failed:', error.message);
    return null;
  }
}

/**
 * Strategy 3: Playwright headless browser
 */
async function fetchWithPlaywright(url: string): Promise<string | null> {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    // Load cookies if available
    const cookies = getCFCookies();
    if (cookies) {
      const cookiePairs = cookies.split('; ').map(pair => {
        const [name, ...valueParts] = pair.split('=');
        return {
          name,
          value: valueParts.join('='),
          domain: '.mangafire.to',
          path: '/',
        };
      });
      await context.addCookies(cookiePairs);
    }

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Wait for content or CF challenge
    await page.waitForTimeout(3000);
    
    // Check if CF challenge
    const title = await page.title();
    if (title.includes('Just a moment')) {
      // Wait for challenge to resolve
      await page.waitForTimeout(10000);
    }

    // Wait for manga content
    try {
      await page.waitForSelector('.unit, .manga-card, .item, li', { timeout: 8000 });
    } catch {
      // Content might not have these selectors
    }

    const html = await page.content();
    
    // Save cookies for reuse
    const newCookies = await context.cookies();
    const cookieStr = newCookies.map(c => `${c.name}=${c.value}`).join('; ');
    if (cookieStr && !html.includes('challenge-platform')) {
      cfCookies = cookieStr;
      cfCookieExpiry = Date.now() + 30 * 60 * 1000;
    }

    await browser.close();
    return html;
  } catch (error: any) {
    console.error('Playwright failed:', error.message);
    return null;
  }
}

/**
 * Multi-strategy fetch: tries cookies → page_reader → Playwright
 */
async function smartFetch(url: string, preferRendered: boolean = false): Promise<string> {
  // Strategy 1: Try with cached cookies
  const cookieResult = await fetchWithCookies(url);
  if (cookieResult) return cookieResult;

  // Strategy 2: Try with page_reader
  const readerResult = await fetchWithPageReader(url);
  if (readerResult) return readerResult;

  // Strategy 3: Try Playwright (only for rendered pages)
  if (preferRendered) {
    const pwResult = await fetchWithPlaywright(url);
    if (pwResult) return pwResult;
  }

  throw new Error('All fetch strategies failed. Cloudflare protection is blocking access.');
}

/**
 * Fetch AJAX endpoint (returns JSON)
 */
async function fetchAjax(path: string): Promise<any> {
  const url = `${BASE_URL}${path}`;
  
  // Try with cookies first
  const cookies = getCFCookies();
  if (cookies) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.5',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${BASE_URL}/`,
          'Cookie': cookies,
        },
      });
      const text = await res.text();
      if (!text.includes('challenge-platform') && !text.includes('Just a moment') && res.status !== 403) {
        return JSON.parse(text);
      }
    } catch {}
  }

  // Try page_reader
  try {
    const zai = await getZAI();
    const result = await zai.functions.invoke('page_reader', { url });
    if (result?.data?.html) {
      try {
        return JSON.parse(result.data.html);
      } catch {
        // Not JSON, might be HTML
      }
    }
  } catch {}

  // Try Playwright to get cookies and then retry
  try {
    await fetchWithPlaywright(`${BASE_URL}/home`);
    // If Playwright got cookies, try again
    const newCookies = getCFCookies();
    if (newCookies) {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${BASE_URL}/`,
          'Cookie': newCookies,
        },
      });
      const text = await res.text();
      if (!text.includes('challenge-platform') && res.status !== 403) {
        return JSON.parse(text);
      }
    }
  } catch {}

  return null;
}

// ============== Search ==============

export async function searchManga(
  keyword: string,
  page: number = 1,
  language: string = 'en'
): Promise<{ results: MangaSearchResult[]; hasNextPage: boolean }> {
  const encodedKeyword = encodeURIComponent(keyword);
  const path = `/filter?keyword=${encodedKeyword}&language[]=${language}&page=${page}`;
  const url = `${BASE_URL}${path}`;

  try {
    const html = await smartFetch(url, true);
    return parseSearchResults(html);
  } catch (error: any) {
    console.error('Search failed:', error.message);
    return { results: [], hasNextPage: false };
  }
}

function parseSearchResults(html: string): { results: MangaSearchResult[]; hasNextPage: boolean } {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const results: MangaSearchResult[] = [];

  // Strategy 1: Look for .unit .inner cards
  const cards = doc.querySelectorAll('.unit .inner, .original.card-lg .unit .inner');
  cards.forEach(card => {
    const link = card.querySelector('.info > a, a[href*="/manga/"]');
    const img = card.querySelector('img');
    if (link) {
      const href = link.getAttribute('href') || '';
      if (!href.includes('/manga/')) return;
      const slug = href.replace('/manga/', '').replace(/^\/+|\/+$/g, '');
      results.push({
        id: slug,
        slug,
        title: link.textContent?.trim() || img?.getAttribute('alt') || slug,
        thumbnail: img?.getAttribute('src') || img?.getAttribute('data-src') || '',
        url: href,
        type: card.querySelector('.type')?.textContent?.trim() || undefined,
      });
    }
  });

  // Strategy 2: Find any manga links
  if (results.length === 0) {
    const seen = new Set<string>();
    doc.querySelectorAll('a[href*="/manga/"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const slug = href.replace('/manga/', '').replace(/^\/+|\/+$/g, '');
      if (seen.has(slug) || !slug || slug.length < 2) return;
      seen.add(slug);
      const img = link.querySelector('img') || link.closest('.unit, .card, .item')?.querySelector('img');
      const title = link.getAttribute('title') || link.textContent?.trim() || slug.replace(/-/g, ' ');
      // Filter out navigation links
      if (title.length > 100 || title.length < 1) return;
      results.push({
        id: slug,
        slug,
        title,
        thumbnail: img?.getAttribute('src') || img?.getAttribute('data-src') || '',
        url: href,
      });
    });
  }

  const nextPage = doc.querySelector('.page-item.active + .page-item .page-link, a[rel="next"]');
  return { results, hasNextPage: nextPage !== null };
}

// ============== Popular / Home ==============

export async function getPopularManga(page: number = 1): Promise<{ results: PopularManga[]; hasNextPage: boolean }> {
  const path = `/filter?sort=most_viewed&language[]=en&page=${page}`;
  try {
    const html = await smartFetch(`${BASE_URL}${path}`, true);
    const parsed = parseSearchResults(html);
    return {
      results: parsed.results.map(r => ({ id: r.id, slug: r.slug, title: r.title, thumbnail: r.thumbnail, url: r.url, type: r.type })),
      hasNextPage: parsed.hasNextPage,
    };
  } catch { return { results: [], hasNextPage: false }; }
}

export async function getLatestUpdates(page: number = 1): Promise<{ results: PopularManga[]; hasNextPage: boolean }> {
  const path = `/filter?sort=recently_updated&language[]=en&page=${page}`;
  try {
    const html = await smartFetch(`${BASE_URL}${path}`, true);
    const parsed = parseSearchResults(html);
    return {
      results: parsed.results.map(r => ({ id: r.id, slug: r.slug, title: r.title, thumbnail: r.thumbnail, url: r.url, type: r.type })),
      hasNextPage: parsed.hasNextPage,
    };
  } catch { return { results: [], hasNextPage: false }; }
}

export async function getNewestManga(page: number = 1): Promise<{ results: PopularManga[]; hasNextPage: boolean }> {
  const path = `/filter?sort=newest&language[]=en&page=${page}`;
  try {
    const html = await smartFetch(`${BASE_URL}${path}`, true);
    const parsed = parseSearchResults(html);
    return {
      results: parsed.results.map(r => ({ id: r.id, slug: r.slug, title: r.title, thumbnail: r.thumbnail, url: r.url, type: r.type })),
      hasNextPage: parsed.hasNextPage,
    };
  } catch { return { results: [], hasNextPage: false }; }
}

// ============== Manga Detail ==============

export async function getMangaInfo(slug: string, language: string = 'en'): Promise<MangaInfo | null> {
  const path = `/manga/${slug}`;
  try {
    const html = await smartFetch(`${BASE_URL}${path}`, true);
    return parseMangaInfo(html, slug, language);
  } catch (error: any) {
    console.error('Manga info failed:', error.message);
    return null;
  }
}

function parseMangaInfo(html: string, slug: string, language: string): MangaInfo | null {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Title
  const titleEl = doc.querySelector('h1, .manga-title, .title');
  const title = titleEl?.textContent?.trim() || slug.replace(/-/g, ' ');

  // Thumbnail
  const thumbnailEl = doc.querySelector('.poster img, .cover img, img[src*="manga"], .thumbnail img, img[alt*="cover"]');
  const thumbnail = thumbnailEl?.getAttribute('src') || thumbnailEl?.getAttribute('data-src') || '';

  // Description
  const descEl = doc.querySelector('#synopsis .modal-content, .description, .synopsis, [itemprop="description"]');
  let description = descEl?.textContent?.trim() || '';

  // Status
  let status = 'Unknown';
  const statusText = doc.querySelector('.info > p, .status')?.textContent?.trim()?.toLowerCase() || '';
  if (statusText.includes('releasing')) status = 'Ongoing';
  else if (statusText.includes('completed')) status = 'Completed';
  else if (statusText.includes('hiatus')) status = 'On Hiatus';
  else if (statusText.includes('discontinued')) status = 'Discontinued';

  // Genres
  let genres: string[] = [];
  const genreLinks = doc.querySelectorAll('a[href*="/genre/"]');
  genres = Array.from(genreLinks).map(el => el.textContent?.trim() || '').filter(Boolean);

  // Author
  const authorEl = doc.querySelector('.author, [itemprop="author"], span:contains("Author") + span');
  const author = authorEl?.textContent?.trim();

  // Type
  const typeEl = doc.querySelector('.type, [itemprop="genre"]');
  const type = typeEl?.textContent?.trim() || '';

  // Alt title
  const altTitleEl = doc.querySelector('h6, .alt-title, .alternative');
  const altTitle = altTitleEl?.textContent?.trim();

  const mangaId = slug.split('.').pop() || slug;

  return {
    id: mangaId,
    slug,
    title,
    altTitle,
    thumbnail,
    description,
    status,
    type,
    genres,
    author,
    chapters: [],
  };
}

// ============== Chapters ==============

export async function getChapters(slug: string, language: string = 'en'): Promise<ChapterInfo[]> {
  const mangaId = slug.split('.').pop() || slug;
  const path = `/ajax/manga/${mangaId}/chapter/${language}`;

  try {
    const data = await fetchAjax(path);
    if (data?.result && typeof data.result === 'string') {
      return parseChapterHTML(data.result, language);
    }
  } catch (error: any) {
    console.error('AJAX chapters failed:', error.message);
  }

  // Fallback: parse from manga page
  try {
    const html = await smartFetch(`${BASE_URL}/manga/${slug}`, true);
    return parseChaptersFromHTML(html);
  } catch {
    return [];
  }
}

function parseChapterHTML(htmlFragment: string, language: string): ChapterInfo[] {
  const dom = new JSDOM(htmlFragment);
  const doc = dom.window.document;
  const chapters: ChapterInfo[] = [];

  doc.querySelectorAll('li, .chapter-item, .item').forEach(item => {
    const link = item.querySelector('a');
    const number = item.getAttribute('data-number') || '0';
    const spans = item.querySelectorAll('span');
    if (link) {
      const href = link.getAttribute('href') || '';
      chapters.push({
        id: href.replace('/read/', '').replace(/^\/+|\/+$/g, ''),
        number: parseFloat(number) || 0,
        title: spans[0]?.textContent?.trim() || `Chapter ${number}`,
        url: href,
        date: spans[1]?.textContent?.trim() || '',
        lang: language,
      });
    }
  });

  return chapters;
}

function parseChaptersFromHTML(html: string): ChapterInfo[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const chapters: ChapterInfo[] = [];
  const seen = new Set<string>();

  doc.querySelectorAll('a[href*="/read/"]').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href.includes('/read/')) return;
    if (seen.has(href)) return;
    seen.add(href);

    const text = link.textContent?.trim() || '';
    const numMatch = text.match(/(\d+\.?\d*)/);
    const num = numMatch ? parseFloat(numMatch[1]) : 0;

    chapters.push({
      id: href.replace('/read/', '').replace(/^\/+|\/+$/g, ''),
      number: num,
      title: text || `Chapter ${num}`,
      url: href,
      date: '',
      lang: 'en',
    });
  });

  return chapters;
}

// ============== Chapter Pages ==============

export async function getChapterPages(chapterUrl: string): Promise<PageImage[]> {
  try {
    const fullUrl = chapterUrl.startsWith('http') ? chapterUrl : `${BASE_URL}${chapterUrl}`;
    const html = await smartFetch(fullUrl, true);
    return extractImagesFromHTML(html);
  } catch (error: any) {
    console.error('Chapter pages failed:', error.message);
    return [];
  }
}

function extractImagesFromHTML(html: string): PageImage[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const images: PageImage[] = [];

  // Look for manga page images
  const selectors = [
    '.reader img', '.page-img img', '.manga-reader img',
    'img[src*="mfcdn"]', 'img[data-src*="mfcdn"]',
    'img[src*="mangafire"]', 'img[data-src*="mangafire"]',
    '.image-container img', '.chapter-img img',
  ];

  for (const selector of selectors) {
    const imgElements = doc.querySelectorAll(selector);
    if (imgElements.length > 0) {
      imgElements.forEach((img, index) => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (src && src.startsWith('http')) {
          images.push({ index, url: src, offset: 0, needsDescramble: false });
        }
      });
      if (images.length > 0) return images;
    }
  }

  // Try to find in scripts
  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    const urlMatches = content.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)[^"'\s]*/gi);
    if (urlMatches && urlMatches.length > 2) {
      urlMatches.forEach((url, index) => {
        images.push({ index, url: url.replace(/\\u002F/g, '/'), offset: 0, needsDescramble: false });
      });
      if (images.length > 0) return images;
    }
  }

  return images;
}

// ============== Image Descrambling ==============

export function descrambleImageUrl(url: string, offset: number): string {
  if (offset > 0) {
    return `/api/mangafire/proxy/image?url=${encodeURIComponent(url)}&offset=${offset}`;
  }
  return `/api/mangafire/proxy/image?url=${encodeURIComponent(url)}`;
}

// ============== Filter ==============

export interface FilterOptions {
  type?: string;
  genre?: string;
  status?: string;
  sort?: string;
}

export async function filterManga(
  options: FilterOptions,
  page: number = 1,
  language: string = 'en'
): Promise<{ results: MangaSearchResult[]; hasNextPage: boolean }> {
  const params = new URLSearchParams();
  params.set('language[]', language);
  params.set('page', page.toString());
  if (options.type) params.set('type[]', options.type);
  if (options.genre) params.set('genre[]', options.genre);
  if (options.status) params.set('status[]', options.status);
  if (options.sort) params.set('sort', options.sort);

  const path = `/filter?${params.toString()}`;
  try {
    const html = await smartFetch(`${BASE_URL}${path}`, true);
    return parseSearchResults(html);
  } catch { return { results: [], hasNextPage: false }; }
}

// ============== Constants ==============

export const GENRES = [
  'action', 'adventure', 'comedy', 'drama', 'fantasy',
  'horror', 'mystery', 'romance', 'sci-fi', 'slice-of-life',
  'sports', 'supernatural', 'suspense', 'ecchi', 'girls-love',
  'boys-love', 'avant-garde', 'gourmet', 'award-winning',
];

export const TYPES = ['manga', 'manhwa', 'manhua', 'novel', 'one-shot'];
export const STATUSES = ['releasing', 'completed', 'on_hiatus', 'discontinued'];
export const SORT_OPTIONS = ['recently_updated', 'newest', 'most_viewed', 'top_rated', 'title_az', 'title_za'];
