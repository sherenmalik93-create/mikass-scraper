import { NextRequest, NextResponse } from 'next/server';
import { getMangaInfo, getChapters } from '@/lib/mangafire/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || '';
  const language = searchParams.get('language') || 'en';

  if (!slug) {
    return NextResponse.json(
      { success: false, error: 'slug parameter is required' },
      { status: 400 }
    );
  }

  try {
    const [info, chapters] = await Promise.all([
      getMangaInfo(slug, language),
      getChapters(slug, language),
    ]);

    if (!info) {
      return NextResponse.json(
        { success: false, error: 'Manga not found' },
        { status: 404 }
      );
    }

    info.chapters = chapters;

    return NextResponse.json({ success: true, data: info });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
