import { NextRequest, NextResponse } from 'next/server';
import { getChapterPages, descrambleImageUrl } from '@/lib/mangafire/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapterUrl = searchParams.get('url') || '';

  if (!chapterUrl) {
    return NextResponse.json(
      { success: false, error: 'url parameter is required (chapter URL path)' },
      { status: 400 }
    );
  }

  try {
    const pages = await getChapterPages(chapterUrl);
    
    // Transform URLs through our proxy for CORS and descrambling
    const proxiedPages = pages.map(page => ({
      ...page,
      proxyUrl: descrambleImageUrl(page.url, page.offset),
      originalUrl: page.url,
    }));

    return NextResponse.json({ success: true, data: proxiedPages });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
