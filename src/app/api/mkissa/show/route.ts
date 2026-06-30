import { NextRequest, NextResponse } from 'next/server';
import { getShowDetail } from '@/lib/mkissa/api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing id parameter' },
        { status: 400 }
      );
    }

    const show = await getShowDetail(id);

    if (!show) {
      return NextResponse.json(
        { success: false, error: 'Show not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, show });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
