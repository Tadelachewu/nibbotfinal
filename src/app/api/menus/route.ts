import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    attachedMenuIds,
    trackClicks: Boolean(menu.trackClicks),
    clickCount: menu.clickCount ?? 0,
    sessionClickCount: menu.sessionClickCount ?? 0,
    translations: (menu.translations as any) ?? undefined
  };
}

export async function GET() {
  const menus = await prisma.menuItem.findMany({
    include: {
      attachments: true,
      kycMappings: { include: { kyc: true } }
    },
    orderBy: { order: 'asc' }
  });

  return NextResponse.json({ status: 'success', data: menus.map(buildMenuResponse) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : crypto.randomUUID();
  const attachedMenuIds: string[] = Array.isArray(body.attachedMenuIds) ? body.attachedMenuIds : [];
  const kycFields: any[] = body.apiConfig?.kycFields && Array.isArray(body.apiConfig.kycFields) ? body.apiConfig.kycFields : [];
  const apiConfig = body.apiConfig && typeof body.apiConfig === 'object'
    ? (() => {
        const { kycFields: _omit, ...rest } = body.apiConfig;
        return rest;
      })()
    : undefined;

  await prisma.menuItem.create({
    data: {
      id,
      parentId: body.parentId ?? null,
      name: body.name ?? '',
      nameAm: body.nameAm ?? null,
      responseType: body.responseType,
      content: body.content ?? null,
      contentAm: body.contentAm ?? null,
      apiConfig: apiConfig ?? null,
      order: Number.isFinite(body.order) ? body.order : 0,
      trackClicks: Boolean(body.trackClicks),
      clickCount: Number.isFinite(body.clickCount) ? body.clickCount : 0,
      sessionClickCount: Number.isFinite(body.sessionClickCount) ? body.sessionClickCount : 0,
      translations: body.translations ?? null
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

  return NextResponse.json({ status: 'success', data: created ? buildMenuResponse(created) : null });
}

