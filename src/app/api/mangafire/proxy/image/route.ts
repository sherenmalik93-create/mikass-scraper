import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const PIECE_SIZE = 200;
const MIN_SPLIT_COUNT = 5;

/**
 * Image proxy with descrambling support
 * mangafire.to scrambles some manga page images by shuffling image slices
 * This proxy fetches the image, descrambles if needed, and returns it
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url') || '';
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!imageUrl) {
    return NextResponse.json(
      { success: false, error: 'url parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch the image
    const imgRes = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://mangafire.to/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!imgRes.ok) {
      return NextResponse.json(
        { success: false, error: `Image fetch failed: ${imgRes.status}` },
        { status: imgRes.status }
      );
    }

    const imageBuffer = Buffer.from(await imgRes.arrayBuffer());

    // If no offset, just proxy the image
    if (offset <= 0) {
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Descramble the image
    const descrambledBuffer = await descrambleImage(imageBuffer, offset);

    return new NextResponse(descrambledBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Image proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Descramble mangafire image
 * Based on keiyoushi extension's ImageInterceptor
 * The scrambling shuffles image slices using the offset value
 */
async function descrambleImage(imageBuffer: Buffer, offset: number): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  
  if (!metadata.width || !metadata.height) {
    return imageBuffer;
  }

  const width = metadata.width;
  const height = metadata.height;
  
  const pieceWidth = Math.min(PIECE_SIZE, Math.ceil(width / MIN_SPLIT_COUNT));
  const pieceHeight = Math.min(PIECE_SIZE, Math.ceil(height / MIN_SPLIT_COUNT));
  const xMax = Math.ceil(width / pieceWidth) - 1;
  const yMax = Math.ceil(height / pieceHeight) - 1;
  
  // Get raw pixel data
  const raw = await image.removeAlpha().raw().toBuffer();
  const channels = metadata.channels || 3;
  
  // Create output buffer
  const output = Buffer.alloc(raw.length);
  
  for (let y = 0; y <= yMax; y++) {
    for (let x = 0; x <= xMax; x++) {
      const xDst = pieceWidth * x;
      const yDst = pieceHeight * y;
      const w = Math.min(pieceWidth, width - xDst);
      const h = Math.min(pieceHeight, height - yDst);
      
      // Calculate source position with scrambling
      const xSrc = pieceWidth * (x === xMax ? x : ((xMax - x + offset) % xMax));
      const ySrc = pieceHeight * (y === yMax ? y : ((yMax - y + offset) % yMax));
      
      // Copy the piece from source to destination
      for (let row = 0; row < h; row++) {
        const srcStart = ((ySrc + row) * width + xSrc) * channels;
        const dstStart = ((yDst + row) * width + xDst) * channels;
        const copyLength = w * channels;
        
        raw.copy(output, dstStart, srcStart, srcStart + copyLength);
      }
    }
  }
  
  // Convert back to JPEG
  return sharp(output, {
    raw: {
      width,
      height,
      channels,
    },
  }).jpeg({ quality: 90 }).toBuffer();
}
