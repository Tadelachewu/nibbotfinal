import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function simpleHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'nib_' + Math.abs(hash).toString(36) + '_' + str.length.toString(36);
}

async function main() {
  console.log('Seeding database...');

  // Report ID config
  await prisma.reportIdConfig.createMany({
    data: [
      {
        prefix: 'NIB',
        yearEnabled: true,
        numberLength: 6,
        startValue: 100000,
        resetEveryYear: true
      }
    ],
    skipDuplicates: true
  });

  const reportConfig = await prisma.reportIdConfig.findFirst();

  // App settings (singleton)
  await prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      supportedLanguages: [
        { code: 'en', name: 'English', isDefault: true },
        { code: 'am', name: 'Amharic' }
      ],
      systemTranslations: {
        ui_online: { en: 'Online', am: 'አየር ላይ' },
        ui_offline: { en: 'Offline', am: 'ከመስመር ውጭ' }
      },
      reportIdId: reportConfig ? reportConfig.id : undefined
    },
    update: {
      supportedLanguages: [
        { code: 'en', name: 'English', isDefault: true },
        { code: 'am', name: 'Amharic' }
      ],
      systemTranslations: {
        ui_online: { en: 'Online', am: 'አየር ላይ' },
        ui_offline: { en: 'Offline', am: 'ከመስመር ውጭ' }
      },
      reportIdId: reportConfig ? reportConfig.id : undefined
    }
  });

  // Menu items
  await prisma.menuItem.createMany({
    data: [
      {
        id: '1',
        parentId: null,
        name: 'Our Services',
        nameAm: 'የእኛ አገልግሎቶች',
        responseType: 'static',
        content: '<p>Explore what we can do for you.</p>',
        contentAm: '<p>ለእርስዎ ምን ማድረግ እንደምንችል ይመርምሩ።</p>',
        order: 0,
        trackClicks: true,
        clickCount: 15,
        sessionClickCount: 10
      },
      {
        id: 'fraud-report-test',
        parentId: null,
        name: 'Report Fraud',
        nameAm: 'ማጭበርበር ሪፖርት ያድርጉ',
        responseType: 'report',
        order: 1,
        content: '<p>Thank you for your report. Our security team has been notified and will review it shortly.</p>',
        contentAm: '<p>ለሪፖርትዎ እናመሰግናለን። የደህንነት ቡድናችን መረጃ ደርሶታል እና በቅርቡ ይመረምረዋል።</p>',
        trackClicks: true,
        clickCount: 8,
        sessionClickCount: 5
      },
      {
        id: 'ex-rate',
        parentId: null,
        name: 'Exchange Rates',
        nameAm: 'የምንዛሬ ተመኖች',
        responseType: 'api',
        order: 2,
        trackClicks: true,
        clickCount: 24,
        sessionClickCount: 18
      },
      {
        id: 'path-param-test',
        parentId: null,
        name: 'Profile Lookup',
        nameAm: 'የመገለጫ ፍለጋ',
        responseType: 'api',
        order: 3,
        trackClicks: false,
        clickCount: 0,
        sessionClickCount: 0
      }
    ],
    skipDuplicates: true
  });

  // KYC fields
  await prisma.kycField.createMany({
    data: [
      {
        id: 'fraud-acc',
        name: 'account_number',
        prompt: 'Please enter the affected account number:',
        promptAm: 'እባክዎ የተጎዳውን የሂሳብ ቁጥር ያስገቡ፡',
        type: 'text',
        order: 0,
        required: true
      },
      {
        id: 'fraud-desc',
        name: 'description',
        prompt: 'Briefly describe the suspicious activity (Optional):',
        promptAm: 'እባክዎ አጠራጣሪ እንቅስቃሴውን በአጭሩ ይግለጹ (አማራጭ)፡',
        type: 'text',
        order: 1,
        required: false
      },
      {
        id: 'kyc-profile-id',
        name: 'account_id',
        prompt: 'Please enter a User ID to lookup (try: user_123)',
        promptAm: 'እባክዎ መለያዎን ያስገቡ (ለምሳሌ: user_123)',
        type: 'text',
        order: 0,
        required: true
      }
    ],
    skipDuplicates: true
  });

  // MenuKYC mappings
  await prisma.menuKyc.createMany({
    data: [
      { menuId: 'fraud-report-test', kycId: 'fraud-acc', order: 0 },
      { menuId: 'fraud-report-test', kycId: 'fraud-desc', order: 1 },
      { menuId: 'path-param-test', kycId: 'kyc-profile-id', order: 0 }
    ],
    skipDuplicates: true
  });

  // Menu attachments for the 'Our Services' menu
  await prisma.menuAttachment.createMany({
    data: [
      { menuId: '1', attachedMenuId: 'ex-rate' },
      { menuId: '1', attachedMenuId: 'path-param-test' },
      { menuId: '1', attachedMenuId: 'fraud-report-test' }
    ],
    skipDuplicates: true
  });

  // Admin credential
  const adminUser = 'admin';
  const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'Admin@1234';

  await prisma.adminCredential.createMany({
    data: [
      {
        username: adminUser,
        usernameHash: simpleHash(adminUser),
        passwordHash: simpleHash(adminPass)
      }
    ],
    skipDuplicates: true
  });

  console.log('Seeding finished.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
