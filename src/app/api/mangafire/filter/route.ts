import { NextRequest, NextResponse } from 'next/server';
import { GENRES, TYPES, STATUSES, SORT_OPTIONS } from '@/lib/mangafire/api';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      genres: GENRES,
      types: TYPES,
      statuses: STATUSES,
      sortOptions: SORT_OPTIONS,
    },
  });
}
