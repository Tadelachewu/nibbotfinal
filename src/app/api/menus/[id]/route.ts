import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';

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

function buildMenuResponse(menu: any) {
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
    menu.pendingUpdate && typeof menu.pendingUpdate === 'object'
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
    order: menu.order,
    isActive: typeof menu.isActive === 'boolean' ? menu.isActive : true,
    approvalStatus: menu.approvalStatus ?? 'approved',
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
    attachedMenuIds,
    trackClicks: Boolean(menu.trackClicks),
    clickCount: menu.clickCount ?? 0,
    sessionClickCount: menu.sessionClickCount ?? 0,
    translations: (menu.translations as any) ?? undefined
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action.trim() : '';
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ status: 'error', message: 'Invalid action.' }, { status: 400 });
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
  } else {
    if (action === 'approve') {
      const pendingUpdate =
        existing.pendingUpdate && typeof existing.pendingUpdate === 'object'
          ? (existing.pendingUpdate as Record<string, any>)
          : null;
      if (!pendingUpdate) {
        return NextResponse.json({ status: 'error', message: 'No pending update to approve.' }, { status: 409 });
      }

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
          order: Number.isFinite(pendingUpdate.order) ? pendingUpdate.order : undefined,
          isActive: typeof pendingUpdate.isActive === 'boolean' ? pendingUpdate.isActive : undefined,
          trackClicks: typeof pendingUpdate.trackClicks === 'boolean' ? pendingUpdate.trackClicks : undefined,
          translations: Object.prototype.hasOwnProperty.call(pendingUpdate, 'translations') ? (pendingUpdate.translations ?? null) : undefined,
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
    }
  }

  const updated = await prisma.menuItem.findUnique({
    where: { id },
    include: { attachments: true, kycMappings: { include: { kyc: true } } }
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: updated ? buildMenuResponse(updated) : null });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession();
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
      order: Number.isFinite(body.order) ? body.order : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      trackClicks: typeof body.trackClicks === 'boolean' ? body.trackClicks : undefined,
      translations: Object.prototype.hasOwnProperty.call(body, 'translations') ? (body.translations ?? null) : undefined,
      attachedMenuIds: Object.prototype.hasOwnProperty.call(body, 'attachedMenuIds') ? attachedMenuIds : undefined
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
        order: Number.isFinite(body.order) ? body.order : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        trackClicks: typeof body.trackClicks === 'boolean' ? body.trackClicks : undefined,
        clickCount: Number.isFinite(body.clickCount) ? body.clickCount : undefined,
        sessionClickCount: Number.isFinite(body.sessionClickCount) ? body.sessionClickCount : undefined,
        translations: body.translations ?? null
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
  const res = NextResponse.json({ status: 'success', data: updated ? buildMenuResponse(updated) : null });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession();
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
  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success' });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}
