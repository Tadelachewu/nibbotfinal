import 'dotenv/config';
import { PrismaClient, ResponseType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/lib/auth';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({
    log: ['warn', 'error'],
    adapter,
});



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
    const menus = [
        {
            id: '1',
            parentId: null,
            name: 'Our Services',
            nameAm: 'የእኛ አገልግሎቶች',
            responseType: ResponseType.static,
            content: '<p>Explore what we can do for you.</p>',
            contentAm: '<p>ለእርስዎ ምን ማድረግ እንደምንችል ይመርምሩ።</p>',
            order: 0,
            isActive: true,
            trackClicks: true,
            clickCount: 15,
            sessionClickCount: 10
        },
        {
            id: 'fraud-report-test',
            parentId: null,
            name: 'Report Fraud',
            nameAm: 'ማጭበርበር ሪፖርት ያድርጉ',
            responseType: ResponseType.report,
            order: 1,
            isActive: true,
            content: '<p>Thank you for your report. Our security team has been notified and will review it shortly.</p>',
            contentAm: '<p>ለሪፖርትዎ እናመሰግናለን። የደህንነት ቡድናችን መረጃ ደርሶታል እና በቅርቡ ይመረምረዋል።</p>',
            trackClicks: true,
            clickCount: 8,
            sessionClickCount: 5,
            apiConfig: {
                name: 'Fraud Report Collection',
                endpoint: '',
                method: 'POST',
                rootKey: 'data',
                headers: {},
                timeout: 0,
                retry: 0,
                loginRequired: true,
                defaultPriority: 'high',
                requiredKYC: [],
                requestParameters: [],
                responseMapping: {
                    type: 'message',
                    template: 'Report Submitted! Your Reference ID is {{response.id}}',
                    errorFallback: 'Report submission failed.',
                    timeoutMessage: 'Timeout.',
                    authRequiredMessage: 'Auth Required.'
                }
            }
        },
        {
            id: 'ex-rate',
            parentId: null,
            name: 'Exchange Rates',
            nameAm: 'የምንዛሬ ተመኖች',
            responseType: ResponseType.api,
            order: 2,
            isActive: true,
            trackClicks: true,
            clickCount: 24,
            sessionClickCount: 18,
            apiConfig: {
                name: 'Daily Exchange Rates',
                endpoint: '/api/test/exchange-rate',
                method: 'GET',
                rootKey: 'data',
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000,
                retry: 1,
                loginRequired: false,
                requiredKYC: [],
                requestParameters: [{ apiKey: 'base', sourceType: 'static', sourceValue: 'USD' }],
                authConfig: {
                    type: 'apiKey',
                    apiKey: { header: 'X-API-KEY', value: 'secret-123' }
                },
                responseMapping: {
                    type: 'table',
                    template: 'Here are the current rates for {{response.base}}:',
                    tableColumns: [
                        { header: 'Currency', headerAm: 'ምንዛሬ', key: 'currency' },
                        { header: 'Rate', headerAm: 'ተመን', key: 'rate' },
                        { header: 'Last Update', headerAm: 'መጨረሻ የዘመነው', key: 'updated' }
                    ],
                    errorFallback: 'Could not retrieve exchange rates.',
                    timeoutMessage: 'Request timed out.',
                    authRequiredMessage: 'Login required.'
                }
            }
        },
        {
            id: 'path-param-test',
            parentId: null,
            name: 'Profile Lookup',
            nameAm: 'የመገለጫ ፍለጋ',
            responseType: ResponseType.api,
            order: 3,
            isActive: true,
            trackClicks: false,
            clickCount: 0,
            sessionClickCount: 0,
            apiConfig: {
                name: 'Dynamic Path Parameter Lookup',
                endpoint: '/api/test/profile/{{account_id}}',
                method: 'GET',
                rootKey: 'data',
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000,
                retry: 0,
                loginRequired: true,
                requiredKYC: [],
                requestParameters: [],
                authConfig: {
                    type: 'bearer',
                    bearer: { header: 'Authorization', template: 'Bearer {{user_token}}' }
                },
                responseMapping: {
                    type: 'message',
                    template: 'Found Profile: {{response.data.full_name}} (Email: {{response.data.email}}). Status: {{response.data.kyc_status}}.',
                    templateAm: 'መገለጫ ተገኝቷል: {{response.data.full_name}} (ኢሜል: {{response.data.email}})',
                    errorFallback: 'Profile not found.',
                    timeoutMessage: 'Timeout.',
                    authRequiredMessage: 'Auth Required.'
                }
            }
        }
    ];

    for (const menu of menus) {
        const { id, parentId, ...rest } = menu as any;
        const connectParent = typeof parentId === 'string' && parentId ? { connect: { id: parentId } } : undefined;

        await prisma.menuItem.upsert({
            where: { id },
            create: {
                id,
                ...rest,
                parent: connectParent
            },
            update: {
                ...rest,
                ...(parentId === null ? { parent: { disconnect: true } } : {}),
                ...(connectParent ? { parent: connectParent } : {})
            }
        });
    }

    // KYC fields
    await prisma.kYCField.createMany({
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
    await prisma.menuKYC.createMany({
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
    const adminPass = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@1234';

    // prisma/seed.ts

    // ...

    const hashedPassword = await hashPassword(adminPass);

    await prisma.adminCredential.upsert({
        where: { username: adminUser },
        create: {
            username: adminUser,
            passwordHash: hashedPassword,
        },
        update: {
            passwordHash: hashedPassword,
        },
    });

    // ...

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
