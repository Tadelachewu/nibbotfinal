import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { logSecurityEvent } from '@/lib/logger';
import { getAllowedImageType, hasValidImageSignature, detectImageType } from '@/lib/fileValidation';
import { scanBuffer } from '@/lib/virusScan';
import { getKBConfig } from '@/lib/kb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const defaultReportIdConfig = {
  prefix: 'NIB',
  yearEnabled: true,
  numberLength: 6,
  startValue: 100000,
  resetEveryYear: true
};

const defaultAvatarSettings = {
  botAvatarType: 'text' as const,
  botAvatarText: 'TT',
  botAvatarImage: '',
  userAvatarType: 'text' as const,
  userAvatarText: 'ME',
  userAvatarImage: '',
};

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

const BLOCKED_URL_EXTENSIONS = new Set([
  '.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.php', '.asp', '.aspx',
  '.jsp', '.cgi', '.exe', '.bat', '.cmd', '.sh', '.py', '.rb', '.pl',
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.pdf', '.zip',
  '.rar', '.7z', '.tar', '.gz', '.csv', '.xml', '.json', '.txt', '.md',
  '.svg',
]);

const ALLOWED_IMAGE_URL_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico',
]);

function validateImageUrl(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label}: invalid URL.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${label}: only HTTPS URLs are allowed.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${label}: invalid URL.`);
  }

  const pathname = parsed.pathname.toLowerCase();
  const extMatch = pathname.match(/\.[a-z0-9]+$/);
  if (extMatch) {
    const ext = extMatch[0];
    if (BLOCKED_URL_EXTENSIONS.has(ext)) {
      throw new Error(`${label}: URL does not point to an image file.`);
    }
    if (!ALLOWED_IMAGE_URL_EXTENSIONS.has(ext)) {
      throw new Error(`${label}: unsupported image format.`);
    }
  }
}

async function persistDataUrlImage(dataUrl: string, prefix: 'bot' | 'user' | 'logo') {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const base64 = match[2];

  const ext = getAllowedImageType(mime);
  if (!ext) return null;

  const approxBytes = Math.floor((base64.length * 3) / 4);
  const maxBytes = 600 * 1024;
  if (approxBytes > maxBytes) {
    throw new Error('Avatar image too large. Please upload an image under 600KB.');
  }

  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > maxBytes) {
    throw new Error('Avatar image too large. Please upload an image under 600KB.');
  }

  let actualExt = ext;
  if (!hasValidImageSignature(ext, bytes)) {
    const detected = detectImageType(bytes);
    if (!detected) {
      throw new Error('File content is not a valid image.');
    }
    actualExt = detected;
  }

  const scan = await scanBuffer(bytes);
  if (!scan.clean) {
    throw new Error(scan.threat || 'File rejected by malware scanner.');
  }

  const dirFs = path.join(process.cwd(), 'storage', 'uploads', prefix === 'logo' ? 'branding' : 'avatars');
  await fs.mkdir(dirFs, { recursive: true });

  const fileName = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${actualExt}`;
  const fileFs = path.join(dirFs, fileName);
  await fs.writeFile(fileFs, bytes);

  return `/uploads/${prefix === 'logo' ? 'branding' : 'avatars'}/${fileName}`;
}

export async function GET() {
  const [settings, kbConfig] = await Promise.all([
    prisma.appSettings.findUnique({
      where: { id: 1 },
      include: { reportId: true }
    }),
    getKBConfig(),
  ]);

  if (!settings) {
    return NextResponse.json({
      status: 'success',
      data: {
        supportedLanguages: [],
        systemTranslations: {},
        reportId: defaultReportIdConfig,
        ...defaultAvatarSettings,
        appLogo: '',
        showAdminPanelIcon: true,
        liveAgentEnabled: true,
        aiEnabled: kbConfig.enabled,
      }
    });
  }

  return NextResponse.json({
    status: 'success',
    data: {
      aiEnabled: kbConfig.enabled,
      supportedLanguages: (settings.supportedLanguages as any) ?? [],
      systemTranslations: (settings.systemTranslations as any) ?? {},
      botAvatarType: settings.botAvatarType ?? defaultAvatarSettings.botAvatarType,
      botAvatarText: settings.botAvatarText ?? defaultAvatarSettings.botAvatarText,
      botAvatarImage: settings.botAvatarImage ?? defaultAvatarSettings.botAvatarImage,
      userAvatarType: settings.userAvatarType ?? defaultAvatarSettings.userAvatarType,
      userAvatarText: settings.userAvatarText ?? defaultAvatarSettings.userAvatarText,
      userAvatarImage: settings.userAvatarImage ?? defaultAvatarSettings.userAvatarImage,
      appLogo: settings.appLogo ?? '',
      showAdminPanelIcon: settings.showAdminPanelIcon ?? true,
      liveAgentEnabled: settings.liveAgentEnabled ?? true,
      reportId: settings.reportId
        ? {
          prefix: settings.reportId.prefix,
          yearEnabled: settings.reportId.yearEnabled,
          numberLength: settings.reportId.numberLength,
          startValue: settings.reportId.startValue,
          resetEveryYear: settings.reportId.resetEveryYear
        }
        : defaultReportIdConfig
    }
  });
}

export async function PUT(req: Request) {
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const supportedLanguages = Array.isArray(body.supportedLanguages) ? body.supportedLanguages : [];
    const systemTranslations = body.systemTranslations && typeof body.systemTranslations === 'object' ? body.systemTranslations : {};
    const reportId = body.reportId && typeof body.reportId === 'object' ? body.reportId : null;
    const botAvatarType = body.botAvatarType === 'image' ? 'image' : 'text';
    const userAvatarType = body.userAvatarType === 'image' ? 'image' : 'text';
    const botAvatarText = typeof body.botAvatarText === 'string' ? body.botAvatarText.trim().slice(0, 6) : null;
    const userAvatarText = typeof body.userAvatarText === 'string' ? body.userAvatarText.trim().slice(0, 6) : null;
    const botAvatarImageRaw = typeof body.botAvatarImage === 'string' ? body.botAvatarImage.trim() : '';
    const userAvatarImageRaw = typeof body.userAvatarImage === 'string' ? body.userAvatarImage.trim() : '';
    const appLogoRaw = typeof body.appLogo === 'string' ? body.appLogo.trim() : '';
    const showAdminPanelIcon = typeof body.showAdminPanelIcon === 'boolean' ? body.showAdminPanelIcon : true;
    const liveAgentEnabled = typeof body.liveAgentEnabled === 'boolean' ? body.liveAgentEnabled : true;

    let botAvatarImage: string | null = null;
    let userAvatarImage: string | null = null;
    let appLogo: string | null = null;

    const rejectNonImageDataUrl = (val: string, label: string) => {
      if (val.startsWith('data:') && !val.startsWith('data:image/')) {
        throw new Error(`${label}: only image files (PNG, JPG, GIF, WebP) are allowed.`);
      }
    };

    try {
      if (botAvatarType === 'image' && botAvatarImageRaw) {
        rejectNonImageDataUrl(botAvatarImageRaw, 'Bot avatar');
        if (isHttpUrl(botAvatarImageRaw)) validateImageUrl(botAvatarImageRaw, 'Bot avatar');
      }
      botAvatarImage = botAvatarType !== 'image'
        ? null
        : botAvatarImageRaw.startsWith('data:image/')
          ? await persistDataUrlImage(botAvatarImageRaw, 'bot')
          : (isHttpUrl(botAvatarImageRaw) || botAvatarImageRaw.startsWith('/uploads/')) ? botAvatarImageRaw : null;

      if (userAvatarType === 'image' && userAvatarImageRaw) {
        rejectNonImageDataUrl(userAvatarImageRaw, 'User avatar');
        if (isHttpUrl(userAvatarImageRaw)) validateImageUrl(userAvatarImageRaw, 'User avatar');
      }
      userAvatarImage = userAvatarType !== 'image'
        ? null
        : userAvatarImageRaw.startsWith('data:image/')
          ? await persistDataUrlImage(userAvatarImageRaw, 'user')
          : (isHttpUrl(userAvatarImageRaw) || userAvatarImageRaw.startsWith('/uploads/')) ? userAvatarImageRaw : null;

      if (appLogoRaw) {
        rejectNonImageDataUrl(appLogoRaw, 'App logo');
        if (isHttpUrl(appLogoRaw)) validateImageUrl(appLogoRaw, 'App logo');
      }
      appLogo = appLogoRaw.startsWith('data:image/')
        ? await persistDataUrlImage(appLogoRaw, 'logo')
        : (isHttpUrl(appLogoRaw) || appLogoRaw.startsWith('/uploads/') || appLogoRaw === '') ? appLogoRaw : null;
    } catch (err: any) {
      return NextResponse.json(
        { status: 'error', message: err?.message || 'Invalid avatar image.' },
        { status: 400 }
      );
    }

    const existing = await prisma.appSettings.findUnique({ where: { id: 1 } });

    let reportIdId: number | null | undefined = existing?.reportIdId ?? null;
    if (reportId) {
      if (reportIdId) {
        await prisma.reportIdConfig.update({
          where: { id: reportIdId },
          data: {
            prefix: reportId.prefix ?? defaultReportIdConfig.prefix,
            yearEnabled: typeof reportId.yearEnabled === 'boolean' ? reportId.yearEnabled : defaultReportIdConfig.yearEnabled,
            numberLength: Number.isFinite(reportId.numberLength) ? reportId.numberLength : defaultReportIdConfig.numberLength,
            startValue: Number.isFinite(reportId.startValue) ? reportId.startValue : defaultReportIdConfig.startValue,
            resetEveryYear: typeof reportId.resetEveryYear === 'boolean' ? reportId.resetEveryYear : defaultReportIdConfig.resetEveryYear
          }
        });
      } else {
        const created = await prisma.reportIdConfig.create({
          data: {
            prefix: reportId.prefix ?? defaultReportIdConfig.prefix,
            yearEnabled: typeof reportId.yearEnabled === 'boolean' ? reportId.yearEnabled : defaultReportIdConfig.yearEnabled,
            numberLength: Number.isFinite(reportId.numberLength) ? reportId.numberLength : defaultReportIdConfig.numberLength,
            startValue: Number.isFinite(reportId.startValue) ? reportId.startValue : defaultReportIdConfig.startValue,
            resetEveryYear: typeof reportId.resetEveryYear === 'boolean' ? reportId.resetEveryYear : defaultReportIdConfig.resetEveryYear
          }
        });
        reportIdId = created.id;
      }
    }
    const saved = await prisma.appSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        supportedLanguages,
        systemTranslations,
        reportIdId: reportIdId ?? null,
        botAvatarType,
        botAvatarText,
        botAvatarImage,
        userAvatarType,
        userAvatarText,
        userAvatarImage,
        appLogo,
        ...({ showAdminPanelIcon, liveAgentEnabled } as any)
      },
      update: {
        supportedLanguages,
        systemTranslations,
        reportIdId: reportIdId ?? null,
        botAvatarType,
        botAvatarText,
        botAvatarImage,
        userAvatarType,
        userAvatarText,
        userAvatarImage,
        appLogo,
        ...({ showAdminPanelIcon, liveAgentEnabled } as any)
      },
      include: { reportId: true }
    });

    // Audit Log: Application Settings Update
    await logSecurityEvent({
      actor: session.username,
      action: 'UPDATE_SETTINGS',
      target: 'settings:global',
      details: {
        languagesCount: Array.isArray(supportedLanguages) ? supportedLanguages.length : 0,
        hasTranslationsUpdate: Object.keys(systemTranslations).length > 0,
        hasReportIdUpdate: !!reportId,
        avatarsChanged: true,
        logoChanged: !!appLogo
      },
      ip: session.ip,
      userAgent: session.userAgent
    });

    const nextToken = await rotateCsrfToken(session);
    const res = NextResponse.json({
      status: 'success',
      data: {
        supportedLanguages: (saved.supportedLanguages as any) ?? [],
        systemTranslations: (saved.systemTranslations as any) ?? {},
        botAvatarType: saved.botAvatarType ?? defaultAvatarSettings.botAvatarType,
        botAvatarText: saved.botAvatarText ?? defaultAvatarSettings.botAvatarText,
        botAvatarImage: saved.botAvatarImage ?? defaultAvatarSettings.botAvatarImage,
        userAvatarType: saved.userAvatarType ?? defaultAvatarSettings.userAvatarType,
        userAvatarText: saved.userAvatarText ?? defaultAvatarSettings.userAvatarText,
        userAvatarImage: saved.userAvatarImage ?? defaultAvatarSettings.userAvatarImage,
        appLogo: saved.appLogo ?? '',
        showAdminPanelIcon: (saved as any).showAdminPanelIcon ?? true,
        liveAgentEnabled: (saved as any).liveAgentEnabled ?? true,
        reportId: saved.reportId
          ? {
            prefix: saved.reportId.prefix,
            yearEnabled: saved.reportId.yearEnabled,
            numberLength: saved.reportId.numberLength,
            startValue: saved.reportId.startValue,
            resetEveryYear: saved.reportId.resetEveryYear
          }
          : defaultReportIdConfig
      }
    });
    res.headers.set('x-csrf-token', nextToken);
    return res;
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2022') {
        return NextResponse.json(
          { status: 'error', message: 'Database schema is out of date. Run `npx prisma db push` then restart the app.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { status: 'error', message: `Database error (${err.code}).` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: 'error', message: err?.message || 'Failed to save settings.' },
      { status: 500 }
    );
  }
}
