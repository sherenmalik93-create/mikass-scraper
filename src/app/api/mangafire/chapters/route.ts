import { NextRequest, NextResponse } from 'next/server';
import { getChapters } from '@/lib/mangafire/api';

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
    const chapters = await getChapters(slug, language);
    return NextResponse.json({ success: true, data: chapters });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
