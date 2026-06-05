import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const DEFAULT_MAX_UPLOAD_BYTES = 600 * 1024;

function safeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
}

function hasPngSignature(bytes: Buffer) {
  return bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
}

function hasJpegSignature(bytes: Buffer) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function hasGifSignature(bytes: Buffer) {
  if (bytes.length < 6) return false;
  const header = bytes.subarray(0, 6).toString('ascii');
  return header === 'GIF87a' || header === 'GIF89a';
}

function hasWebpSignature(bytes: Buffer) {
  return bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

export async function POST(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const actor = await prisma.adminCredential.findUnique({
    where: { username: session.username },
    select: { role: true },
  });
  if (actor?.role !== 'admin') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const maxBytesRaw = Number(process.env.MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD_BYTES);
  const maxBytes = Number.isFinite(maxBytesRaw) && maxBytesRaw > 0 ? Math.floor(maxBytesRaw) : DEFAULT_MAX_UPLOAD_BYTES;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid upload payload.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ status: 'error', message: "Missing file field 'file'." }, { status: 400 });
  }

  const allowed = new Map<string, string>([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif'],
  ]);

  const mimeType = String(file.type || '').toLowerCase();
  const ext = allowed.get(mimeType);
  if (!ext) {
    return NextResponse.json({ status: 'error', message: 'Unsupported file type.' }, { status: 415 });
  }

  if (typeof file.size === 'number' && file.size > maxBytes) {
    return NextResponse.json({ status: 'error', message: 'File too large.' }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) {
    return NextResponse.json({ status: 'error', message: 'File too large.' }, { status: 413 });
  }

  const signatureOk =
    (ext === 'png' && hasPngSignature(bytes)) ||
    (ext === 'jpg' && hasJpegSignature(bytes)) ||
    (ext === 'gif' && hasGifSignature(bytes)) ||
    (ext === 'webp' && hasWebpSignature(bytes));
  if (!signatureOk) {
    return NextResponse.json({ status: 'error', message: 'File content does not match declared type.' }, { status: 415 });
  }

  const userDir = safeSegment(session.username);
  const dirFs = path.join(process.cwd(), 'public', 'uploads', 'admin', userDir);
  await fs.mkdir(dirFs, { recursive: true });

  const original = safeSegment(file.name || 'upload');
  const fileName = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}-${original}.${ext}`;
  const fileFs = path.join(dirFs, fileName);
  await fs.writeFile(fileFs, bytes);

  const publicPath = `/uploads/admin/${userDir}/${fileName}`;

  await prisma.interactionLog.create({
    data: {
      sessionId: `admin:${session.username}`,
      userMessage: 'SECURITY_EVENT',
      botResponse: JSON.stringify({
        type: 'File Uploaded',
        actor: session.username,
        role: actor.role,
        endpoint: '/api/upload',
        originalName: file.name || '',
        mimeType,
        size: bytes.length,
        storedPath: publicPath,
      }),
      status: 'success',
      endpoint: '/api/upload',
      responseTime: 0,
      tags: ['security', 'admin', 'upload'],
    },
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({
    status: 'success',
    data: {
      url: publicPath,
      uploadedBy: session.username,
    },
  });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}
