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
                ui_offline: { en: 'Offline', am: 'ከመስመር ውጭ' },
                ui_checking: { en: 'Checking...', am: 'በመፈተሽ ላይ...' },
                ui_report_status_btn: { en: 'Check Report Status', am: 'የሪፖርት ሁኔታ አረጋግጥ' },
                ui_select_option: { en: 'Please select an option:', am: 'እባክዎ አማራጭ ይምረጡ፡' },
                ui_welcome_subtitle: { en: 'How can we assist you today?', am: 'ዛሬ እንዴት ልንረዳዎ እንችላለን?' },
                ui_enter_report_id: { en: 'Please enter your Report Reference ID:', am: 'እባክዎ የሪፖርት ቁጥርዎን ያስገቡ፡' },
                ui_status_resolved: { en: 'Resolved', am: 'ተፈትቷል' },
                ui_status_reviewed: { en: 'Reviewed', am: 'በመመርመር ላይ' },
                ui_status_pending: { en: 'Pending', am: 'በጥበቃ ላይ' },
                ui_status_label: { en: 'Report Status', am: 'የሪፖርት ሁኔታ' },
                ui_original_request: { en: 'Original Request', am: 'የቀረበ ጥያቄ' },
                ui_error_fallback: { en: 'An error occurred.', am: 'ስህተት ተከስቷል።' },
                ui_welcome_am: { en: 'Welcome to Nib International Bank', am: 'እንኳን ወደ ንብ ኢንተርናሽናል ባንክ በደህና መጡ!' },
                ui_welcome_en: { en: 'Welcome to Nib International Bank', am: 'Welcome to Nib International Bank' },
                ui_back: { en: 'Back', am: 'ተመለስ' },
                ui_home: { en: 'Home', am: 'ዋና ገጽ' }
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
                ui_offline: { en: 'Offline', am: 'ከመስመር ውጭ' },
                ui_checking: { en: 'Checking...', am: 'በመፈተሽ ላይ...' },
                ui_report_status_btn: { en: 'Check Report Status', am: 'የሪፖርት ሁኔታ አረጋግጥ' },
                ui_select_option: { en: 'Please select an option:', am: 'እባክዎ አማራጭ ይምረጡ፡' },
                ui_welcome_subtitle: { en: 'How can we assist you today?', am: 'ዛሬ እንዴት ልንረዳዎ እንችላለን?' },
                ui_enter_report_id: { en: 'Please enter your Report Reference ID:', am: 'እባክዎ የሪፖርት ቁጥርዎን ያስገቡ፡' },
                ui_status_resolved: { en: 'Resolved', am: 'ተፈትቷል' },
                ui_status_reviewed: { en: 'Reviewed', am: 'በመመርመር ላይ' },
                ui_status_pending: { en: 'Pending', am: 'በጥበቃ ላይ' },
                ui_status_label: { en: 'Report Status', am: 'የሪፖርት ሁኔታ' },
                ui_original_request: { en: 'Original Request', am: 'የቀረበ ጥያቄ' },
                ui_error_fallback: { en: 'An error occurred.', am: 'ስህተት ተከስቷል።' },
                ui_welcome_am: { en: 'Welcome to Nib International Bank', am: 'እንኳን ወደ ንብ ኢንተርናሽናል ባንክ በደህና መጡ!' },
                ui_welcome_en: { en: 'Welcome to Nib International Bank', am: 'Welcome to Nib International Bank' },
                ui_back: { en: 'Back', am: 'ተመለስ' },
                ui_home: { en: 'Home', am: 'ዋና ገጽ' }
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

    const bankingPrisma = prisma as any;
    if (!bankingPrisma.account || !bankingPrisma.transaction) {
        throw new Error('Prisma Client is missing banking models. Run: npx prisma generate');
    }

    const accountSeeds = [
        { accountId: '88991122', name: 'Alemu Bekele', balance: 8500.0, currency: 'ETB', type: 'savings', status: 'active' },
        { accountId: '99887766', name: 'Hanna Tesfaye', balance: 12500.0, currency: 'ETB', type: 'checking', status: 'active' },
        { accountId: '11223344', name: 'Samuel Desta', balance: 4200.0, currency: 'ETB', type: 'savings', status: 'active' },
        { accountId: '22334455', name: 'Mekdes Girma', balance: 31000.0, currency: 'ETB', type: 'checking', status: 'active' },
        { accountId: '33445566', name: 'Kebede Mamo', balance: 975.5, currency: 'ETB', type: 'savings', status: 'active' },
        { accountId: '44556677', name: 'Selamawit Abebe', balance: 89000.0, currency: 'ETB', type: 'checking', status: 'active' },
        { accountId: '55667788', name: 'Biruk Hailu', balance: 1550.0, currency: 'ETB', type: 'savings', status: 'active' },
        { accountId: '66778899', name: 'Saba Worku', balance: 50200.0, currency: 'ETB', type: 'checking', status: 'active' },
        { accountId: '77889900', name: 'Yonatan Asrat', balance: 760.0, currency: 'ETB', type: 'savings', status: 'active' },
        { accountId: '99001122', name: 'Rahel Fikru', balance: 24000.0, currency: 'ETB', type: 'checking', status: 'active' },
        { accountId: '10101010', name: 'Mulugeta Tadesse', balance: 120.0, currency: 'ETB', type: 'savings', status: 'active' },
        { accountId: '20202020', name: 'Sara Yimer', balance: 6400.0, currency: 'ETB', type: 'savings', status: 'frozen' },
        { accountId: '30303030', name: 'Daniel Yohannes', balance: 3300.0, currency: 'ETB', type: 'checking', status: 'active' },
        { accountId: '40404040', name: 'Lidya Solomon', balance: 9800.0, currency: 'ETB', type: 'savings', status: 'active' },
        { accountId: '50505050', name: 'Fitsum Kassa', balance: 150000.0, currency: 'ETB', type: 'checking', status: 'active' }
    ];

    for (const acc of accountSeeds) {
        await bankingPrisma.account.upsert({
            where: { accountId: acc.accountId },
            create: { ...acc },
            update: { ...acc }
        });
    }

    const accounts = await bankingPrisma.account.findMany({
        where: { accountId: { in: accountSeeds.map(a => a.accountId) } }
    });
    const accountIdToDbId = new Map(accounts.map((a: any) => [a.accountId, a.id]));

    const tx = (referenceId: string, senderAccountId: string, receiverAccountId: string, amount: number, createdAt: string, type: string, remark?: string) => {
        const fee = Math.round(amount * 0.005 * 100) / 100;
        return {
            referenceId,
            senderId: accountIdToDbId.get(senderAccountId)!,
            receiverId: accountIdToDbId.get(receiverAccountId)!,
            amount,
            currency: 'ETB',
            fee,
            totalDebit: amount + fee,
            remark: remark ?? null,
            status: 'completed',
            type,
            createdAt: new Date(createdAt)
        };
    };

    const transactionSeeds = [
        tx('TXN-000001', '88991122', '99887766', 1000, '2026-03-20T09:15:00.000Z', 'transfer', 'Utilities'),
        tx('TXN-000002', '99887766', '88991122', 500, '2026-03-21T12:40:00.000Z', 'transfer', 'Refund'),
        tx('TXN-000003', '22334455', '11223344', 2500, '2026-03-18T08:10:00.000Z', 'transfer', 'Salary'),
        tx('TXN-000004', '11223344', '33445566', 300, '2026-03-22T15:05:00.000Z', 'transfer', 'Lunch'),
        tx('TXN-000005', '44556677', '55667788', 1800, '2026-03-23T17:30:00.000Z', 'transfer', 'Rent'),
        tx('TXN-000006', '66778899', '77889900', 750, '2026-03-24T10:20:00.000Z', 'transfer', 'Airtime'),
        tx('TXN-000007', '99001122', '30303030', 4200, '2026-03-25T06:55:00.000Z', 'transfer', 'School fee'),
        tx('TXN-000008', '50505050', '40404040', 9900, '2026-03-25T19:05:00.000Z', 'transfer', 'Supplier payment'),
        tx('TXN-000009', '40404040', '50505050', 1500, '2026-03-26T09:00:00.000Z', 'transfer', 'Reimbursement'),
        tx('TXN-000010', '77889900', '10101010', 50, '2026-03-26T13:45:00.000Z', 'transfer', 'Coffee')
    ];

    for (const t of transactionSeeds) {
        await bankingPrisma.transaction.upsert({
            where: { referenceId: t.referenceId },
            create: t,
            update: t
        });
    }

    // Admin credential
    const adminUser = 'admin';
    const adminPass = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@1234';

    // prisma/seed.ts

    // ...

    const hashedPassword = await hashPassword(adminPass);

    const adminEmail = process.env.ADMIN_EMAIL || 'tade2024bdugit@gmail.com';

    await prisma.adminCredential.upsert({
        where: { username: adminUser },
        create: {
            username: adminUser,
            email: adminEmail,
            passwordHash: hashedPassword,
        },
        update: {
            email: adminEmail,
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
