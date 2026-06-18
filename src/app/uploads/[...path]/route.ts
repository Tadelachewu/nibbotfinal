import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'uploads');

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return new NextResponse('Not found.', { status: 404 });
  }

  for (const seg of segments) {
    if (seg === '..' || seg === '.' || seg.includes('\\') || seg.includes('/')) {
      return new NextResponse('Not found.', { status: 404 });
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(seg)) {
      return new NextResponse('Not found.', { status: 404 });
    }
  }

  const ext = path.extname(segments[segments.length - 1]).toLowerCase();
  const mimeType = MIME_TYPES[ext];
  if (!mimeType) {
    return new NextResponse('Not found.', { status: 404 });
  }

  const filePath = path.join(STORAGE_ROOT, ...segments);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(STORAGE_ROOT) + path.sep)) {
    return new NextResponse('Not found.', { status: 404 });
  }

  try {
    const data = await fs.readFile(resolved);
    const filename = path.basename(resolved);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found.', { status: 404 });
  }
}
