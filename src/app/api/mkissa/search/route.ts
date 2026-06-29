import { NextRequest, NextResponse } from 'next/server';
import { searchAnime } from '@/lib/mkissa/api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || undefined;
    const sortBy = (searchParams.get('sort') as any) || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const translationType = (searchParams.get('type') as 'sub' | 'dub') || 'sub';
    const genres = searchParams.get('genres')?.split(',').filter(Boolean) || undefined;
    const types = searchParams.get('types')?.split(',').filter(Boolean) || undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;

    const results = await searchAnime(query, {
      sortBy,
      page,
      limit,
      translationType,
      genres,
      types,
      year,
    });

    return NextResponse.json({
      success: true,
      query,
      page,
      limit,
      ...results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
