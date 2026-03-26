import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

async function isAdminAuthenticated() {
  const session = await getIronSession<{ username?: string }>(await cookies(), sessionOptions);
  return Boolean(session.username);
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
      ...(menu.apiConfig as Record<string, any>),
      rootKey: typeof (menu.apiConfig as any).rootKey === 'string' && String((menu.apiConfig as any).rootKey).trim()
        ? String((menu.apiConfig as any).rootKey).trim()
        : 'data',
      requiredKYC: Array.isArray(menu.apiConfig.requiredKYC) ? menu.apiConfig.requiredKYC : [],
      requestParameters: Array.isArray(menu.apiConfig.requestParameters) ? menu.apiConfig.requestParameters : [],
      headers: menu.apiConfig.headers && typeof menu.apiConfig.headers === 'object' ? menu.apiConfig.headers : {},
      kycFields
    }
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
    attachedMenuIds,
    trackClicks: Boolean(menu.trackClicks),
    clickCount: menu.clickCount ?? 0,
    sessionClickCount: menu.sessionClickCount ?? 0,
    translations: (menu.translations as any) ?? undefined
  };
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const attachedMenuIds: string[] = Array.isArray(body.attachedMenuIds) ? body.attachedMenuIds : [];
  const kycFields: any[] = body.apiConfig?.kycFields && Array.isArray(body.apiConfig.kycFields) ? body.apiConfig.kycFields : [];
  const apiConfig = body.apiConfig && typeof body.apiConfig === 'object'
    ? (() => {
      const { kycFields: _omit, rootKey, ...rest } = body.apiConfig;
      const normalizedRootKey = typeof rootKey === 'string' && rootKey.trim() ? rootKey.trim() : 'data';
      return { ...rest, rootKey: normalizedRootKey };
    })()
    : undefined;

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

  const updated = await prisma.menuItem.findUnique({
    where: { id },
    include: { attachments: true, kycMappings: { include: { kyc: true } } }
  });

  return NextResponse.json({ status: 'success', data: updated ? buildMenuResponse(updated) : null });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ status: 'success' });
}
