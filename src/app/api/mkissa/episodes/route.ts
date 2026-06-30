import { NextRequest, NextResponse } from 'next/server';
import { getEpisodeSources } from '@/lib/mkissa/api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const showId = searchParams.get('showId');
    const episode = searchParams.get('episode');
    const translationType = (searchParams.get('type') as 'sub' | 'dub') || 'sub';

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

    return NextResponse.json({
      success: true,
      episode: episode,
      showId,
      translationType,
      sourceUrls: episodeData.sourceUrls || [],
      episodeInfo: episodeData.episodeInfo || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
