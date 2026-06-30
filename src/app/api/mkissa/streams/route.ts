import { NextRequest, NextResponse } from 'next/server';
import { getEpisodeSources } from '@/lib/mkissa/api';
import { categorizeStreams } from '@/lib/mkissa/extractor';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const showId = searchParams.get('showId');
    const episode = searchParams.get('episode');
    const translationType = (searchParams.get('type') as 'sub' | 'dub') || 'sub';
    const shouldExtract = searchParams.get('extract') === 'true';

    if (!showId || !episode) {
      return NextResponse.json(
        { success: false, error: 'Missing showId or episode parameter' },
        { status: 400 }
      );
    }

    const episodeData = await getEpisodeSources(showId, episode, translationType);

    if (!episodeData) {
      return NextResponse.json(
        { success: false, error: 'Episode not found or decryption failed' },
        { status: 404 }
      );
    }

    // Categorize all streams
    const streams = categorizeStreams(episodeData, translationType);

    // If extract=true, use Playwright to extract playable m3u8/mp4 URLs
    let extractedStreams: any[] = [];
    if (shouldExtract) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { chromium } = require('playwright');
        let browser;

        try {
          browser = await chromium.launch({ headless: true });
          const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          });
          const page = await context.newPage();

          const m3u8Urls: string[] = [];
          const mp4Urls: string[] = [];

          // Intercept network responses for m3u8
          page.on('response', (response: any) => {
            const url = response.url();
            const ct = response.headers()['content-type'] || '';
            if (url.includes('.m3u8') || ct.includes('mpegurl')) {
              // Only capture master playlists (not variant playlists)
              if (url.includes('master.m3u8') || url.includes('index.m3u8') || (!url.includes('index-v') && !url.includes('seg-'))) {
                m3u8Urls.push(url);
              }
            }
            if (url.includes('.mp4') && !url.includes('.js') && !url.includes('.css') && !url.includes('.png')) {
              mp4Urls.push(url);
            }
          });

          // === Filemoon extraction ===
          for (const stream of streams) {
            if (stream.type === 'iframe' && (stream.url.includes('bysekoze.com') || stream.url.includes('filemoon'))) {
              try {
                // Navigate directly to the embed URL (not the player frame URL)
                // This is crucial - the player frame URL doesn't trigger video loading
                await page.goto(stream.url, { waitUntil: 'networkidle', timeout: 15000 });
                await page.waitForTimeout(3000);

                // Click the player frame to trigger video loading
                try {
                  await page.click('.video-page__player-frame, .video-page__placeholder, .jw8-player-shell', { timeout: 5000 });
                } catch {
                  await page.click('body').catch(() => {});
                }
                
                // Wait for m3u8 requests
                await page.waitForTimeout(8000);

                // Step 4: Also check video element directly
                const videoSrc = await page.evaluate(() => document.querySelector('video')?.src || '');
                if (videoSrc.includes('.m3u8') && !m3u8Urls.includes(videoSrc)) m3u8Urls.push(videoSrc);
                if (videoSrc.includes('.mp4') && !mp4Urls.includes(videoSrc)) mp4Urls.push(videoSrc);
              } catch (err: any) {
                console.error('Filemoon extraction error:', err.message);
              }
            }
          }

          // === Clock endpoint extraction ===
          for (const stream of streams) {
            if (stream.type === 'clock') {
              try {
                await page.goto('https://mkissa.to', { waitUntil: 'networkidle', timeout: 15000 });
                const clockId = stream.url.split('id=')[1]?.split('&')[0] || '';
                if (!clockId) continue;

                const res = await context.request.get(
                  'https://api.allanime.day/apivtwo/clock?id=' + clockId,
                  { headers: { 'Origin': 'https://mkissa.to', 'Referer': 'https://mkissa.to/' } }
                );
                if (res.ok()) {
                  const body = await res.text();
                  const m3u8Match = body.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
                  if (m3u8Match) m3u8Urls.push(m3u8Match[0]);
                }
              } catch (err: any) {
                console.error('Clock extraction error:', err.message);
              }
            }
          }

          // Deduplicate and build results
          const uniqueM3u8 = [...new Set(m3u8Urls)];
          const uniqueMp4 = [...new Set(mp4Urls)];

          extractedStreams = [
            ...uniqueM3u8.map(url => ({
              provider: 'Extracted (m3u8)',
              url,
              type: 'm3u8' as const,
              proxyUrl: `/api/proxy/m3u8?url=${encodeURIComponent(url)}`,
              originalUrl: url,
            })),
            ...uniqueMp4.map(url => ({
              provider: 'Extracted (mp4)',
              url,
              type: 'mp4' as const,
              proxyUrl: `/api/proxy/m3u8?url=${encodeURIComponent(url)}`,
              originalUrl: url,
            })),
          ];

        } catch (err: any) {
          console.error('Browser extraction failed:', err.message);
        } finally {
          await browser?.close().catch(() => {});
        }
      } catch (err: any) {
        console.error('Playwright not available:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      episode,
      showId,
      translationType,
      streams,
      extractedStreams,
      rawSources: episodeData.sourceUrls || [],
      episodeInfo: episodeData.episodeInfo || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
