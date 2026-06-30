import { NextRequest, NextResponse } from 'next/server';
import { getPopularManga, getLatestUpdates, getNewestManga } from '@/lib/mangafire/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') || 'popular';
  const page = parseInt(searchParams.get('page') || '1');

  try {
    let result;
    switch (section) {
      case 'popular':
        result = await getPopularManga(page);
        break;
      case 'latest':
        result = await getLatestUpdates(page);
        break;
      case 'newest':
        result = await getNewestManga(page);
        break;
      default:
        result = await getPopularManga(page);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
