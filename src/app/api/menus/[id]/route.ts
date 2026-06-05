import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';

function parseBoolean(value: string | null) {
  return value === '1' || value === 'true';
}

function splitContentBlocks(content: string) {
  const str = String(content || '');
  if (!str.trim()) return [];

  const looksLikeHtml = str.includes('<') && str.includes('>');
  if (looksLikeHtml) {
    const closingTag = /(<\/(?:p|li|h[1-6]|blockquote|pre|tr|table|div)>)/i;
    if (closingTag.test(str)) {
      const parts = str.split(closingTag);
      const blocks: string[] = [];
      let buf = '';
      for (const part of parts) {
        if (!part) continue;
        buf += part;
        if (closingTag.test(part)) {
          blocks.push(buf);
          buf = '';
        }
      }
      if (buf.trim()) blocks.push(buf);
      return blocks;
    }
  }

  const blocks = str
    .split(/\n\s*\n/g)
    .map(s => s.trim())
    .filter(Boolean);

  return blocks.length ? blocks.map(b => `${b}\n\n`) : [str];
}

function paginateBlocks(blocks: string[], page: number, maxChars: number) {
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const limit = Number.isFinite(maxChars) && maxChars > 200 ? Math.min(Math.floor(maxChars), 20000) : 2000;

  const pages: string[] = [];
  let buf = '';

  const flush = () => {
    if (buf) pages.push(buf);
    buf = '';
  };

  for (const block of blocks) {
    const next = buf + block;
    if (next.length <= limit) {
      buf = next;
      continue;
    }

    if (buf) {
      flush();
      if (block.length <= limit) {
        buf = block;
        continue;
      }
    }

    let i = 0;
    while (i < block.length) {
      pages.push(block.slice(i, i + limit));
      i += limit;
    }
  }
  flush();

  const pageCount = pages.length || 1;
  const idx = Math.min(safePage, Math.max(0, pageCount - 1));
  return { content: pages[idx] ?? '', page: idx, totalPages: pageCount, hasMore: idx < pageCount - 1, maxChars: limit };
}

function applyPendingUpdate(menu: any) {
  const pending = (menu.pendingStatus === 'pending' || menu.pendingStatus === 'rejected') && menu.pendingUpdate && typeof menu.pendingUpdate === 'object';
  if (!pending) return menu;
  const update = menu.pendingUpdate as Record<string, any>;
  const merged: any = { ...menu, ...update };
  if (Object.prototype.hasOwnProperty.call(update, 'apiConfig')) merged.apiConfig = update.apiConfig ?? null;
  if (Object.prototype.hasOwnProperty.call(update, 'content')) merged.content = update.content ?? null;
  if (Object.prototype.hasOwnProperty.call(update, 'contentAm')) merged.contentAm = update.contentAm ?? null;
  if (Object.prototype.hasOwnProperty.call(update, 'nameAm')) merged.nameAm = update.nameAm ?? null;
  if (Object.prototype.hasOwnProperty.call(update, 'parentId')) merged.parentId = update.parentId ?? null;
  if (Object.prototype.hasOwnProperty.call(update, 'translations')) merged.translations = update.translations ?? null;
  return merged;
}

function getLocalizedContent(menu: any, lang: string) {
  const code = String(lang || 'en').toLowerCase().trim();
  if (!code || code === 'en') return String(menu.content || '');
  if (code === 'am') return String(menu.contentAm || menu.content || '');
  const t = menu.translations && typeof menu.translations === 'object' ? (menu.translations as any) : null;
  const fromTranslations = t?.[code]?.content;
  if (typeof fromTranslations === 'string') return fromTranslations;
  return String(menu.content || '');
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(req.url);
  const { id } = await ctx.params;

  const adminPreviewRequested = parseBoolean(searchParams.get('adminPreview'));
  const lang = searchParams.get('lang') || 'en';
  const page = Number(searchParams.get('page') || '0');
  const maxChars = Number(searchParams.get('maxChars') || '2000');

  let role: 'admin' | 'checker' | null = null;
  if (adminPreviewRequested) {
    const session = await getValidatedAdminSession(false);
    if (!session?.username) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
    }
    const actor = await prisma.adminCredential.findUnique({ where: { username: session.username }, select: { role: true } });
    role = actor?.role === 'admin' || actor?.role === 'checker' ? actor.role : null;
    if (!role) {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }
  }

  const menu = await prisma.menuItem.findUnique({
    where: { id },
    select: {
      id: true,
      responseType: true,
      isActive: true,
      approvalStatus: true,
      content: true,
      contentAm: true,
      translations: true,
      pendingStatus: true,
      pendingUpdate: true,
    }
  });

  if (!menu) {
    return NextResponse.json({ status: 'error', message: 'Not found.' }, { status: 404 });
  }

  if (!adminPreviewRequested) {
    if (menu.isActive === false || (menu.approvalStatus ?? 'approved') !== 'approved') {
      return NextResponse.json({ status: 'error', message: 'Not found.' }, { status: 404 });
    }
  }

  const effective = adminPreviewRequested ? applyPendingUpdate(menu) : menu;
  const full = getLocalizedContent(effective, lang);
  const blocks = splitContentBlocks(full);
  const paged = paginateBlocks(blocks, page, maxChars);

  return NextResponse.json({
    status: 'success',
    data: {
      id: menu.id,
      responseType: menu.responseType,
      lang,
      page: paged.page,
      totalPages: paged.totalPages,
      hasMore: paged.hasMore,
      maxChars: paged.maxChars,
      totalChars: full.length,
      content: paged.content,
    }
  });
}

function ensureRootPrefix(path: string, rootKey: string) {
  const clean = String(path || '').trim();
  const rk = String(rootKey || '').trim() || 'data';
  if (!clean) return clean;
  if (clean === rk) return clean;
  if (clean.startsWith(`${rk}.`) || clean.startsWith(`${rk}[`)) return clean;
  return `${rk}.${clean}`;
}

function normalizeApiConfig(apiConfig: any) {
  if (!apiConfig || typeof apiConfig !== 'object') return apiConfig;

  const rootKey = typeof apiConfig.rootKey === 'string' && apiConfig.rootKey.trim() ? apiConfig.rootKey.trim() : 'data';
  const responseMapping = apiConfig.responseMapping && typeof apiConfig.responseMapping === 'object' ? apiConfig.responseMapping : undefined;
  const tableMappingModeRaw = typeof responseMapping?.tableMappingMode === 'string' ? responseMapping.tableMappingMode.trim() : '';
  const tableMappingMode = tableMappingModeRaw === 'exact_path' || tableMappingModeRaw === 'array_path'
    ? tableMappingModeRaw
    : 'array_path';

  const normalizedResponseMapping = responseMapping
    ? (() => {
      const next: any = { ...responseMapping };
      if (tableMappingMode === 'array_path') {
        if (typeof next.tableDataKey === 'string' && next.tableDataKey.trim()) {
          next.tableDataKey = ensureRootPrefix(next.tableDataKey, rootKey);
        }
      } else if (tableMappingMode === 'exact_path') {
        if (Array.isArray(next.tableColumns)) {
          next.tableColumns = next.tableColumns.map((col: any) => {
            if (!col || typeof col !== 'object') return col;
            const key = typeof col.key === 'string' ? col.key.trim() : '';
            return key ? { ...col, key: ensureRootPrefix(key, rootKey) } : col;
          });
        }
      }
      next.tableMappingMode = tableMappingMode;
      return next;
    })()
    : undefined;

  return {
    ...apiConfig,
    rootKey,
    ...(normalizedResponseMapping ? { responseMapping: normalizedResponseMapping } : {})
  };
}

function extractTemplateVars(template: string) {
  const str = String(template || '');
  return Array.from(str.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g))
    .map(m => (m[1] || '').trim())
    .filter(Boolean);
}

function validateEndpointTemplate(endpoint: string, kycFieldNames: string[]) {
  const vars = extractTemplateVars(endpoint);
  if (!vars.length) return { ok: true as const, vars, invalid: [] as string[], missingKyc: [] as string[] };

  const allowed = new Set(['user_id', 'user_token', 'user.id', 'user.token']);
  const kycSet = new Set((kycFieldNames || []).map(v => String(v || '').trim()).filter(Boolean));

  const invalid: string[] = [];
  const missingKyc: string[] = [];

  for (const v of vars) {
    if (allowed.has(v)) continue;
    if (v.startsWith('kyc.')) {
      const key = v.slice(4).trim();
      if (!key) invalid.push(v);
      else if (!kycSet.has(key)) missingKyc.push(key);
      continue;
    }
    if (v.includes('.')) {
      invalid.push(v);
      continue;
    }
    if (!kycSet.has(v)) missingKyc.push(v);
  }

  return { ok: invalid.length === 0 && missingKyc.length === 0, vars, invalid, missingKyc };
}

function buildMenuResponse(menu: any, isAdmin: boolean = false) {
  const attachedMenuIds = Array.isArray(menu.attachments)
    ? menu.attachments.map((a: any) => a.attachedMenuId)
    : [];

  const kycFields = Array.isArray(menu.kycMappings)
    ? menu.kycMappings
      .slice()
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((m: any) => ({
        id: m.kyc.id,
        name: m.kyc.name,
        prompt: m.kyc.prompt,
        promptAm: m.kyc.promptAm ?? undefined,
        type: m.kyc.type,
        validation: m.kyc.validation ?? undefined,
        order: m.order ?? m.kyc.order ?? 0,
        required: Boolean(m.kyc.required)
      }))
    : [];

  const apiConfig = menu.apiConfig
    ? {
      ...(normalizeApiConfig(menu.apiConfig) as Record<string, any>),
      requiredKYC: Array.isArray(menu.apiConfig.requiredKYC) ? menu.apiConfig.requiredKYC : [],
      requestParameters: Array.isArray(menu.apiConfig.requestParameters) ? menu.apiConfig.requestParameters : [],
      headers: menu.apiConfig.headers && typeof menu.apiConfig.headers === 'object' ? menu.apiConfig.headers : {},
      kycFields
    }
    : undefined;

  const pendingUpdate =
    isAdmin && menu.pendingUpdate && typeof menu.pendingUpdate === 'object'
      ? (menu.pendingUpdate as Record<string, any>)
      : undefined;

  return {
    id: menu.id,
    parentId: menu.parentId ?? null,
    name: menu.name,
    nameAm: menu.nameAm ?? undefined,
    responseType: menu.responseType,
    content: menu.content ?? undefined,
    contentAm: menu.contentAm ?? undefined,
    apiConfig,
    supportAssignee: Object.prototype.hasOwnProperty.call(menu, 'supportAssignee') ? (menu.supportAssignee ?? null) : null,
    order: menu.order,
    isActive: typeof menu.isActive === 'boolean' ? menu.isActive : true,
    approvalStatus: menu.approvalStatus ?? 'approved',
    attachedMenuIds,
    trackClicks: Boolean(menu.trackClicks),
    clickCount: menu.clickCount ?? 0,
    sessionClickCount: menu.sessionClickCount ?? 0,
    translations: (menu.translations as any) ?? undefined,
    ...(isAdmin ? {
      createdBy: typeof menu.createdBy === 'string' ? menu.createdBy : undefined,
      reviewedBy: typeof menu.reviewedBy === 'string' ? menu.reviewedBy : undefined,
      reviewedAt: menu.reviewedAt ? new Date(menu.reviewedAt).toISOString() : undefined,
      rejectionReason: typeof menu.rejectionReason === 'string' ? menu.rejectionReason : undefined,
      pendingUpdate,
      pendingStatus: typeof menu.pendingStatus === 'string' ? menu.pendingStatus : undefined,
      pendingCreatedBy: typeof menu.pendingCreatedBy === 'string' ? menu.pendingCreatedBy : undefined,
      pendingReviewedBy: typeof menu.pendingReviewedBy === 'string' ? menu.pendingReviewedBy : undefined,
      pendingReviewedAt: menu.pendingReviewedAt ? new Date(menu.pendingReviewedAt).toISOString() : undefined,
      pendingRejectionReason: typeof menu.pendingRejectionReason === 'string' ? menu.pendingRejectionReason : undefined,
    } : {})
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action.trim() : '';
  if (action !== 'approve' && action !== 'reject' && action !== 'discard_pending') {
    return NextResponse.json({ status: 'error', message: 'Invalid action.' }, { status: 400 });
  }

  if (action === 'discard_pending') {
    const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
    if (!actor || actor.role !== 'admin') {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }

    const existing = await prisma.menuItem.findUnique({
      where: { id },
      select: { id: true, approvalStatus: true, pendingStatus: true, pendingUpdate: true }
    });
    const hasPending = (existing?.pendingStatus === 'pending' || existing?.pendingStatus === 'rejected') &&
      !!existing?.pendingUpdate &&
      typeof existing.pendingUpdate === 'object';
    if (!existing || !hasPending) {
      return NextResponse.json({ status: 'error', message: 'No pending update to discard.' }, { status: 409 });
    }

    const reviewedAt = new Date();
    await prisma.menuItem.update({
      where: { id },
      data: {
        pendingUpdate: Prisma.DbNull,
        pendingStatus: null,
        pendingCreatedBy: null,
        pendingReviewedBy: session.username,
        pendingReviewedAt: reviewedAt,
        pendingRejectionReason: null
      }
    });

    await logSecurityEvent({
      actor: session.username ?? 'unknown',
      action: 'UPDATE_MENU',
      target: `menu:${id}`,
      details: { action: 'discard_pending', fieldsChanged: ['pendingUpdate', 'pendingStatus'] },
      ip: session.ip,
      userAgent: session.userAgent
    });

    const updated = await prisma.menuItem.findUnique({
      where: { id },
      include: { attachments: true, kycMappings: { include: { kyc: true } } }
    });

    const nextToken = await rotateCsrfToken(session);
    const res = NextResponse.json({ status: 'success', data: updated ? buildMenuResponse(updated, true) : null });
    res.headers.set('x-csrf-token', nextToken);
    return res;
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  if (!actor || actor.role !== 'checker') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const existing = await prisma.menuItem.findUnique({
    where: { id },
    include: { attachments: true, kycMappings: { include: { kyc: true } } }
  });
  if (!existing) {
    return NextResponse.json({ status: 'error', message: 'Not found.' }, { status: 404 });
  }
  const isNewMenuPending = existing.approvalStatus === 'pending';
  const isUpdatePending = existing.pendingStatus === 'pending' || existing.pendingStatus === 'rejected';
  if (!isNewMenuPending && !isUpdatePending) {
    return NextResponse.json({ status: 'error', message: 'Menu is not pending approval.' }, { status: 409 });
  }

  const makerUsername = isNewMenuPending ? existing.createdBy : existing.pendingCreatedBy;
  if (typeof makerUsername === 'string' && makerUsername === session.username) {
    return NextResponse.json({ status: 'error', message: 'Maker cannot approve their own menu.' }, { status: 403 });
  }

  const reviewedAt = new Date();
  let auditDetails: any = { action };
  if (isNewMenuPending) {
    const data: any = { reviewedBy: session.username, reviewedAt };
    if (action === 'approve') {
      data.approvalStatus = 'approved';
      data.rejectionReason = null;
    } else {
      const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
      if (!reason) {
        return NextResponse.json({ status: 'error', message: 'Rejection reason is required.' }, { status: 400 });
      }
      data.approvalStatus = 'rejected';
      data.rejectionReason = reason;
    }
    await prisma.menuItem.update({ where: { id }, data });
    auditDetails = { ...auditDetails, fieldsChanged: Object.keys(data), approvalStatus: data.approvalStatus };
  } else {
    if (action === 'approve') {
      const pendingUpdate =
        existing.pendingUpdate && typeof existing.pendingUpdate === 'object'
          ? (existing.pendingUpdate as Record<string, any>)
          : null;
      if (!pendingUpdate) {
        return NextResponse.json({ status: 'error', message: 'No pending update to approve.' }, { status: 409 });
      }
      auditDetails = { ...auditDetails, fieldsChanged: Object.keys(pendingUpdate), pendingStatus: null };

      const attachedMenuIds: string[] = Array.isArray(pendingUpdate.attachedMenuIds)
        ? pendingUpdate.attachedMenuIds
        : [];

      const pendingApiConfigRaw =
        pendingUpdate.apiConfig && typeof pendingUpdate.apiConfig === 'object'
          ? (pendingUpdate.apiConfig as Record<string, any>)
          : null;

      const kycFields: any[] = Array.isArray(pendingApiConfigRaw?.kycFields) ? pendingApiConfigRaw!.kycFields : [];

      const pendingApiConfig = pendingApiConfigRaw
        ? (() => {
          const { kycFields: _omit, rootKey, ...rest } = pendingApiConfigRaw;
          const normalizedRootKey = typeof rootKey === 'string' && rootKey.trim() ? rootKey.trim() : 'data';
          return normalizeApiConfig({ ...rest, rootKey: normalizedRootKey });
        })()
        : undefined;

      if (pendingApiConfig?.endpoint && pendingUpdate.responseType === 'api') {
        const kycNames = Array.isArray(kycFields) ? kycFields.map(f => f?.name).filter(Boolean) : [];
        const validation = validateEndpointTemplate(String(pendingApiConfig.endpoint), kycNames);
        if (!validation.ok) {
          const parts: string[] = [];
          if (validation.invalid.length) parts.push(`Invalid placeholders: ${validation.invalid.join(', ')}`);
          if (validation.missingKyc.length) parts.push(`Missing KYC fields: ${validation.missingKyc.join(', ')}`);
          return NextResponse.json({ status: 'error', message: `Endpoint template invalid. ${parts.join('. ')}` }, { status: 400 });
        }
      }

      await prisma.menuItem.update({
        where: { id },
        data: {
          ...(() => {
            if (!Object.prototype.hasOwnProperty.call(pendingUpdate, 'parentId')) return {};
            if (typeof pendingUpdate.parentId === 'string' && pendingUpdate.parentId.trim()) {
              return { parent: { connect: { id: pendingUpdate.parentId.trim() } } };
            }
            return { parent: { disconnect: true } };
          })(),
          name: pendingUpdate.name ?? undefined,
          nameAm: Object.prototype.hasOwnProperty.call(pendingUpdate, 'nameAm') ? (pendingUpdate.nameAm ?? null) : undefined,
          responseType: pendingUpdate.responseType ?? undefined,
          content: Object.prototype.hasOwnProperty.call(pendingUpdate, 'content') ? (pendingUpdate.content ?? null) : undefined,
          contentAm: Object.prototype.hasOwnProperty.call(pendingUpdate, 'contentAm') ? (pendingUpdate.contentAm ?? null) : undefined,
          apiConfig: Object.prototype.hasOwnProperty.call(pendingUpdate, 'apiConfig')
            ? (pendingApiConfig ?? null)
            : undefined,
          supportAssignee: Object.prototype.hasOwnProperty.call(pendingUpdate, 'supportAssignee') ? (pendingUpdate.supportAssignee ?? null) : undefined,
          order: Number.isFinite(pendingUpdate.order) ? pendingUpdate.order : undefined,
          isActive: typeof pendingUpdate.isActive === 'boolean' ? pendingUpdate.isActive : undefined,
          trackClicks: typeof pendingUpdate.trackClicks === 'boolean' ? pendingUpdate.trackClicks : undefined,
          translations: Object.prototype.hasOwnProperty.call(pendingUpdate, 'translations') ? (pendingUpdate.translations ?? null) : undefined,
          attachmentDescription: Object.prototype.hasOwnProperty.call(pendingUpdate, 'attachmentDescription') ? (pendingUpdate.attachmentDescription ?? null) : undefined,
          pendingUpdate: Prisma.DbNull,
          pendingStatus: null,
          pendingCreatedBy: null,
          pendingReviewedBy: session.username,
          pendingReviewedAt: reviewedAt,
          pendingRejectionReason: null
        }
      });

      await prisma.menuAttachment.deleteMany({ where: { menuId: id } });
      if (attachedMenuIds.length) {
        await prisma.menuAttachment.createMany({
          data: attachedMenuIds.map(attachedMenuId => ({ menuId: id, attachedMenuId })),
          skipDuplicates: true
        });
      }

      if (Array.isArray(pendingApiConfigRaw?.kycFields)) {
        for (const field of kycFields) {
          if (!field?.id || !field?.name || !field?.prompt || !field?.type) continue;
          await prisma.kYCField.upsert({
            where: { id: field.id },
            create: {
              id: field.id,
              name: field.name,
              prompt: field.prompt,
              promptAm: field.promptAm ?? null,
              type: field.type,
              validation: field.validation ?? null,
              order: Number.isFinite(field.order) ? field.order : 0,
              required: Boolean(field.required)
            },
            update: {
              name: field.name,
              prompt: field.prompt,
              promptAm: field.promptAm ?? null,
              type: field.type,
              validation: field.validation ?? null,
              order: Number.isFinite(field.order) ? field.order : 0,
              required: Boolean(field.required)
            }
          });
        }

        await prisma.menuKYC.deleteMany({ where: { menuId: id } });
        if (kycFields.length) {
          await prisma.menuKYC.createMany({
            data: kycFields
              .filter(f => f?.id)
              .map((f, idx) => ({
                menuId: id,
                kycId: f.id,
                order: Number.isFinite(f.order) ? f.order : idx
              })),
            skipDuplicates: true
          });
        }
      }
    } else {
      const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
      if (!reason) {
        return NextResponse.json({ status: 'error', message: 'Rejection reason is required.' }, { status: 400 });
      }
      await prisma.menuItem.update({
        where: { id },
        data: {
          pendingStatus: 'rejected',
          pendingReviewedBy: session.username,
          pendingReviewedAt: reviewedAt,
          pendingRejectionReason: reason
        }
      });
      auditDetails = {
        ...auditDetails,
        fieldsChanged: ['pendingStatus', 'pendingReviewedBy', 'pendingReviewedAt', 'pendingRejectionReason'],
        pendingStatus: 'rejected'
      };
    }
  }

  // Audit Log: Menu Update
  await logSecurityEvent({
    actor: session.username ?? 'unknown',
    action: 'UPDATE_MENU',
    target: `menu:${id}`,
    details: auditDetails,
    ip: session.ip,
    userAgent: session.userAgent
  });

  const updated = await prisma.menuItem.findUnique({
    where: { id },
    include: { attachments: true, kycMappings: { include: { kyc: true } } }
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: updated ? buildMenuResponse(updated, true) : null });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(true);
  if (!session) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  if (session.username) {
    const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
    if (!actor || actor.role !== 'admin') {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const existing = await prisma.menuItem.findUnique({
    where: { id },
    select: { id: true, approvalStatus: true, pendingStatus: true }
  });
  if (!existing) {
    return NextResponse.json({ status: 'error', message: 'Not found.' }, { status: 404 });
  }

  const supportAssignee =
    Object.prototype.hasOwnProperty.call(body, 'supportAssignee')
      ? (typeof body.supportAssignee === 'string' && body.supportAssignee.trim() ? body.supportAssignee.trim() : null)
      : undefined;

  if (typeof supportAssignee === 'string') {
    const supportUser = await prisma.adminCredential.findUnique({ where: { username: supportAssignee } });
    if (!supportUser || supportUser.role !== 'support') {
      return NextResponse.json({ status: 'error', message: 'Support assignee must be a Support user.' }, { status: 400 });
    }
  }

  const attachedMenuIds: string[] = Array.isArray(body.attachedMenuIds) ? body.attachedMenuIds : [];
  const kycFields: any[] = body.apiConfig?.kycFields && Array.isArray(body.apiConfig.kycFields) ? body.apiConfig.kycFields : [];
  const apiConfig = body.apiConfig && typeof body.apiConfig === 'object'
    ? (() => {
      const { kycFields: _omit, rootKey, ...rest } = body.apiConfig;
      const normalizedRootKey = typeof rootKey === 'string' && rootKey.trim() ? rootKey.trim() : 'data';
      return normalizeApiConfig({ ...rest, rootKey: normalizedRootKey });
    })()
    : undefined;

  if (apiConfig?.endpoint && body.responseType === 'api') {
    const kycNames = Array.isArray(kycFields) ? kycFields.map(f => f?.name).filter(Boolean) : [];
    const validation = validateEndpointTemplate(String(apiConfig.endpoint), kycNames);
    if (!validation.ok) {
      const parts: string[] = [];
      if (validation.invalid.length) parts.push(`Invalid placeholders: ${validation.invalid.join(', ')}`);
      if (validation.missingKyc.length) parts.push(`Missing KYC fields: ${validation.missingKyc.join(', ')}`);
      return NextResponse.json({ status: 'error', message: `Endpoint template invalid. ${parts.join('. ')}` }, { status: 400 });
    }
  }

  if (existing.approvalStatus === 'approved') {
    const pendingUpdate = {
      parentId: Object.prototype.hasOwnProperty.call(body, 'parentId')
        ? (typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null)
        : undefined,
      name: body.name ?? undefined,
      nameAm: Object.prototype.hasOwnProperty.call(body, 'nameAm') ? (body.nameAm ?? null) : undefined,
      responseType: body.responseType ?? undefined,
      content: Object.prototype.hasOwnProperty.call(body, 'content') ? (body.content ?? null) : undefined,
      contentAm: Object.prototype.hasOwnProperty.call(body, 'contentAm') ? (body.contentAm ?? null) : undefined,
      apiConfig: Object.prototype.hasOwnProperty.call(body, 'apiConfig') ? (apiConfig ? { ...(apiConfig as any), kycFields } : null) : undefined,
      supportAssignee,
      order: Number.isFinite(body.order) ? body.order : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      trackClicks: typeof body.trackClicks === 'boolean' ? body.trackClicks : undefined,
      translations: Object.prototype.hasOwnProperty.call(body, 'translations') ? (body.translations ?? null) : undefined,
      attachedMenuIds: Object.prototype.hasOwnProperty.call(body, 'attachedMenuIds') ? attachedMenuIds : undefined,
      attachmentDescription: Object.prototype.hasOwnProperty.call(body, 'attachmentDescription') ? (typeof body.attachmentDescription === 'string' ? body.attachmentDescription : null) : undefined
    };

    await prisma.menuItem.update({
      where: { id },
      data: {
        pendingUpdate,
        pendingStatus: 'pending',
        pendingCreatedBy: session.username ?? null,
        pendingReviewedBy: null,
        pendingReviewedAt: null,
        pendingRejectionReason: null
      }
    });
  } else {
    await prisma.menuItem.update({
      where: { id },
      data: {
        ...(() => {
          if (!Object.prototype.hasOwnProperty.call(body, 'parentId')) return {};
          if (typeof body.parentId === 'string' && body.parentId.trim()) {
            return { parent: { connect: { id: body.parentId.trim() } } };
          }
          return { parent: { disconnect: true } };
        })(),
        name: body.name ?? undefined,
        nameAm: body.nameAm ?? null,
        responseType: body.responseType ?? undefined,
        content: body.content ?? null,
        contentAm: body.contentAm ?? null,
        apiConfig: apiConfig ?? null,
        supportAssignee,
        order: Number.isFinite(body.order) ? body.order : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        trackClicks: typeof body.trackClicks === 'boolean' ? body.trackClicks : undefined,
        clickCount: Number.isFinite(body.clickCount) ? body.clickCount : undefined,
        sessionClickCount: Number.isFinite(body.sessionClickCount) ? body.sessionClickCount : undefined,
        translations: body.translations ?? null,
        attachmentDescription: Object.prototype.hasOwnProperty.call(body, 'attachmentDescription') ? (typeof body.attachmentDescription === 'string' ? body.attachmentDescription : null) : undefined,
        approvalStatus: 'pending',
        rejectionReason: null
      }
    });

    await prisma.menuAttachment.deleteMany({ where: { menuId: id } });
    if (attachedMenuIds.length) {
      await prisma.menuAttachment.createMany({
        data: attachedMenuIds.map(attachedMenuId => ({ menuId: id, attachedMenuId })),
        skipDuplicates: true
      });
    }

    if (Array.isArray(body.apiConfig?.kycFields)) {
      for (const field of kycFields) {
        if (!field?.id || !field?.name || !field?.prompt || !field?.type) continue;
        await prisma.kYCField.upsert({
          where: { id: field.id },
          create: {
            id: field.id,
            name: field.name,
            prompt: field.prompt,
            promptAm: field.promptAm ?? null,
            type: field.type,
            validation: field.validation ?? null,
            order: Number.isFinite(field.order) ? field.order : 0,
            required: Boolean(field.required)
          },
          update: {
            name: field.name,
            prompt: field.prompt,
            promptAm: field.promptAm ?? null,
            type: field.type,
            validation: field.validation ?? null,
            order: Number.isFinite(field.order) ? field.order : 0,
            required: Boolean(field.required)
          }
        });
      }

      await prisma.menuKYC.deleteMany({ where: { menuId: id } });
      if (kycFields.length) {
        await prisma.menuKYC.createMany({
          data: kycFields
            .filter(f => f?.id)
            .map((f, idx) => ({
              menuId: id,
              kycId: f.id,
              order: Number.isFinite(f.order) ? f.order : idx
            })),
          skipDuplicates: true
        });
      }
    }
  }

  const updated = await prisma.menuItem.findUnique({
    where: { id },
    include: { attachments: true, kycMappings: { include: { kyc: true } } }
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: updated ? buildMenuResponse(updated, true) : null });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(true);
  if (!session) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(_, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  if (session.username) {
    const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
    if (!actor || actor.role !== 'admin') {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  await prisma.menuItem.delete({ where: { id } });

  // Audit Log: Menu Deletion
  await logSecurityEvent({
    actor: session.username ?? 'unknown',
    action: 'DELETE_MENU',
    target: `menu:${id}`,
    ip: session.ip,
    userAgent: session.userAgent
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success' });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}
