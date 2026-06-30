/**
 * Stream Extraction API
 * Uses Playwright headless browser to extract m3u8/mp4 URLs from embed pages
 * and to bypass Cloudflare protection on the clock endpoint
 */
import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin
chromium.use(stealth());

const BROWSER_TIMEOUT = 30000;

interface ExtractResult {
  provider: string;
  url: string;
  type: 'm3u8' | 'mp4';
  quality?: string;
}

/**
 * Extract m3u8/mp4 from Filemoon embed using browser
 */
async function extractFilemoon(embedUrl: string): Promise<ExtractResult[]> {
  const results: ExtractResult[] = [];
  let browser;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    const m3u8Urls: string[] = [];
    const mp4Urls: string[] = [];
    
    // Intercept network responses
    page.on('response', async (response) => {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      
      if (url.includes('.m3u8') || ct.includes('mpegurl')) {
        m3u8Urls.push(url);
      }
      if (url.includes('.mp4') && !url.includes('.js') && !url.includes('.css')) {
        mp4Urls.push(url);
      }
    });
    
    // Navigate to the embed page
    await page.goto(embedUrl, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT });
    
    // Try to get video details from API first
    const videoId = embedUrl.split('/e/').pop()?.split('?')[0] || '';
    if (videoId) {
      try {
        const host = new URL(embedUrl).hostname;
        const apiRes = await context.request.get(`https://${host}/api/videos/${videoId}/embed/details`, {
          headers: { 'Referer': embedUrl }
        });
        if (apiRes.ok()) {
          const details = await apiRes.json();
          if (details?.embed_frame_url) {
            // Navigate to the actual player frame
            await page.goto(details.embed_frame_url, { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT });
          }
        }
      } catch {}
    }
    
    // Click to play
    await page.click('body').catch(() => {});
    await page.waitForTimeout(5000);
    
    // Check for video element
    const videoSrc = await page.evaluate(() => {
      const v = document.querySelector('video');
      return v?.src || '';
    });
    
    if (videoSrc) {
      if (videoSrc.includes('.m3u8')) {
        m3u8Urls.push(videoSrc);
      } else if (videoSrc.includes('.mp4')) {
        mp4Urls.push(videoSrc);
      }
    }
    
    // Build results
    for (const url of m3u8Urls) {
      results.push({ provider: 'Filemoon', url, type: 'm3u8' });
    }
    for (const url of mp4Urls) {
      results.push({ provider: 'Filemoon', url, type: 'mp4' });
    }
    
  } catch (err: any) {
    console.error('Filemoon extraction failed:', err.message);
  } finally {
    await browser?.close().catch(() => {});
  }
  
  return results;
}

/**
 * Extract m3u8 from the clock endpoint using browser (CF bypass)
 */
async function extractClock(clockUrl: string): Promise<ExtractResult[]> {
  const results: ExtractResult[] = [];
  let browser;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    const m3u8Urls: string[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.m3u8')) {
        m3u8Urls.push(url);
      }
    });
    
    // Visit mkissa.to first to establish session
    await page.goto('https://mkissa.to', { waitUntil: 'networkidle', timeout: BROWSER_TIMEOUT });
    
    // Now try the clock URL using the browser's fetch (has CF cookies)
    const clockId = clockUrl.split('id=')[1]?.split('&')[0] || '';
    if (clockId) {
      // Navigate to an episode page on mkissa.to (SPA navigation, no CF challenge)
      // This triggers the player which loads the clock URL
      const result = await page.evaluate(async (id) => {
        try {
          const res = await fetch('https://api.allanime.day/apivtwo/clock?id=' + id);
          return await res.text();
        } catch {
          return null;
        }
      }, clockId);
      
      if (result && result.includes('.m3u8')) {
        const m3u8Match = result.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
        if (m3u8Match) {
          m3u8Urls.push(m3u8Match[0]);
        }
      }
    }
    
    for (const url of m3u8Urls) {
      results.push({ provider: 'AllAnime CDN', url, type: 'm3u8' });
    }
    
  } catch (err: any) {
    console.error('Clock extraction failed:', err.message);
  } finally {
    await browser?.close().catch(() => {});
  }
  
  return results;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const type = searchParams.get('type') || 'iframe'; // iframe or clock
  
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }
  
  try {
    let streams: ExtractResult[] = [];
    
    if (type === 'clock') {
      streams = await extractClock(url);
    } else {
      // Detect provider from URL
      if (url.includes('bysekoze.com') || url.includes('filemoon') || url.includes('q8y5z.com')) {
        streams = await extractFilemoon(url);
      } else {
        // Generic: try browser extraction
        streams = await extractFilemoon(url);
      }
    }
    
    // Build proxied URLs for playable streams
    const result = streams.map(s => ({
      ...s,
      proxyUrl: `/api/proxy/m3u8?url=${encodeURIComponent(s.url)}`,
    }));
    
    return NextResponse.json({ success: true, streams: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
