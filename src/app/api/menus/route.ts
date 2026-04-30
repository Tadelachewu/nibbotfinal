import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // Normalize request parameters
  const requestParameters = Array.isArray(apiConfig.requestParameters) 
    ? apiConfig.requestParameters.map((param: any) => ({
        apiKey: String(param.apiKey || ''),
        sourceType: ['kyc', 'static', 'user_profile', 'admin_default'].includes(param.sourceType) ? param.sourceType : 'kyc',
        sourceValue: String(param.sourceValue || ''),
        isEnabled: param.isEnabled !== false, // Default to true
        isUserConfigurable: param.isUserConfigurable !== false // Default to true
      }))
    : [];

  return {
    ...apiConfig,
    rootKey,
    ...(normalizedResponseMapping ? { responseMapping: normalizedResponseMapping } : {}),
    ...(requestParameters.length > 0 ? { requestParameters } : {})
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
    attachmentDescription: typeof menu.attachmentDescription === 'string' ? menu.attachmentDescription : undefined,
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactiveRequested =
    searchParams.get('includeInactive') === '1' || searchParams.get('includeInactive') === 'true';
  const adminPreviewRequested =
    searchParams.get('adminPreview') === '1' || searchParams.get('adminPreview') === 'true';
  const wantsAdminData = includeInactiveRequested || adminPreviewRequested;
  const adminSession = wantsAdminData ? await getValidatedAdminSession() : null;

  if (wantsAdminData && !adminSession?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const actor = wantsAdminData && adminSession?.username
    ? await prisma.adminCredential.findUnique({ where: { username: adminSession.username } })
    : null;

  const role = actor?.role ?? null;

  if (includeInactiveRequested && role !== 'admin') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  if (adminPreviewRequested && role !== 'admin' && role !== 'checker') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const includeAll = includeInactiveRequested || adminPreviewRequested;
  const isAdmin = Boolean(role);

  const menus = await prisma.menuItem.findMany({
    include: {
      attachments: true,
      kycMappings: { include: { kyc: true } }
    },
    where: includeAll ? undefined : { isActive: true, approvalStatus: 'approved' },
    orderBy: { order: 'asc' }
  });

  if (includeAll) {
    const toBackfill = menus.filter(m => {
      const cfg: any = m.apiConfig;
      if (!cfg || typeof cfg !== 'object') return false;
      const rootKey = cfg.rootKey;
      return !(typeof rootKey === 'string' && rootKey.trim());
    });

    if (toBackfill.length) {
      await prisma.$transaction(
        toBackfill.map(m => {
          const cfg: any = m.apiConfig;
          return prisma.menuItem.update({
            where: { id: m.id },
            data: { apiConfig: { ...(cfg || {}), rootKey: 'data' } }
          });
        })
      );
    }
  }

  return NextResponse.json({ status: 'success', data: menus.map(m => buildMenuResponse(m, isAdmin)) });
}

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : crypto.randomUUID();
  const parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null;
  const supportAssignee =
    Object.prototype.hasOwnProperty.call(body, 'supportAssignee')
      ? (typeof body.supportAssignee === 'string' && body.supportAssignee.trim() ? body.supportAssignee.trim() : null)
      : undefined;
  const attachedMenuIds: string[] = Array.isArray(body.attachedMenuIds) ? body.attachedMenuIds : [];
  const kycFields: any[] = body.apiConfig?.kycFields && Array.isArray(body.apiConfig.kycFields) ? body.apiConfig.kycFields : [];
  const apiConfig = body.apiConfig && typeof body.apiConfig === 'object'
    ? (() => {
      const { kycFields: _omit, rootKey, ...rest } = body.apiConfig;
      const normalizedRootKey = typeof rootKey === 'string' && rootKey.trim() ? rootKey.trim() : 'data';
      return normalizeApiConfig({ ...rest, rootKey: normalizedRootKey });
    })()
    : undefined;

  if (typeof supportAssignee === 'string') {
    const supportUser = await prisma.adminCredential.findUnique({ where: { username: supportAssignee } });
    if (!supportUser || supportUser.role !== 'support') {
      return NextResponse.json({ status: 'error', message: 'Support assignee must be a Support user.' }, { status: 400 });
    }
  }

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

  await prisma.menuItem.create({
    data: {
      id,
      parent: parentId ? { connect: { id: parentId } } : undefined,
      name: body.name ?? '',
      nameAm: body.nameAm ?? null,
      responseType: body.responseType,
      content: body.content ?? null,
      contentAm: body.contentAm ?? null,
      apiConfig: apiConfig ?? null,
      supportAssignee,
      order: Number.isFinite(body.order) ? body.order : 0,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      approvalStatus: 'pending',
      createdBy: session.username ?? null,
      trackClicks: Boolean(body.trackClicks),
      clickCount: Number.isFinite(body.clickCount) ? body.clickCount : 0,
      sessionClickCount: Number.isFinite(body.sessionClickCount) ? body.sessionClickCount : 0,
      translations: body.translations ?? null,
      attachmentDescription: typeof body.attachmentDescription === 'string' ? body.attachmentDescription : null
    }
  });

  if (attachedMenuIds.length) {
    await prisma.menuAttachment.createMany({
      data: attachedMenuIds.map(attachedMenuId => ({ menuId: id, attachedMenuId })),
      skipDuplicates: true
    });
  }

  if (kycFields.length) {
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

  const created = await prisma.menuItem.findUnique({
    where: { id },
    include: { attachments: true, kycMappings: { include: { kyc: true } } }
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: created ? buildMenuResponse(created, true) : null });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}
