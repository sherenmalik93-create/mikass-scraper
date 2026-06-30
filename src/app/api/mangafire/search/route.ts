import { NextRequest, NextResponse } from 'next/server';
import { searchManga, filterManga } from '@/lib/mangafire/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const language = searchParams.get('language') || 'en';
  const type = searchParams.get('type') || '';
  const genre = searchParams.get('genre') || '';
  const sort = searchParams.get('sort') || '';
  const status = searchParams.get('status') || '';

  try {
    if (keyword) {
      const result = await searchManga(keyword, page, language);
      return NextResponse.json({ success: true, data: result });
    } else {
      const result = await filterManga({
        type: type || undefined,
        genre: genre || undefined,
        sort: sort || undefined,
        status: status || undefined,
      }, page, language);
      return NextResponse.json({ success: true, data: result });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
