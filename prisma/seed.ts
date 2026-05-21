import { config } from 'dotenv';
config({ override: true });
import { PrismaClient, ResponseType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/lib/auth';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

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
                ui_prev: { en: 'Prev', am: 'ወደ ኋላ' },
                ui_next: { en: 'Next', am: 'ቀጣይ' },
                ui_related: { en: 'Related', am: 'ተዛማጅ' },
                ui_placeholder_report_id: { en: 'Enter reference ID...', am: 'የሪፖርት ቁጥር እዚህ ያስገቡ...' },
                ui_placeholder_input: { en: 'Enter requested information...', am: 'እዚህ ይጻፉ...' },
                ui_error_bool: { en: 'Please enter "true" or "false" only', am: 'እባክዎ "true" ወይም "false" ብቻ ያስገቡ' },
                ui_error_number: { en: 'Please enter a valid number', am: 'እባክዎ ቁጥር ብቻ ያስገቡ' },
                ui_error_phone: { en: 'Please enter a valid Ethiopian phone number (e.g., 0911... or +251...)', am: 'እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ' },
                ui_error_email: { en: 'Please enter a valid email address', am: 'እባክዎ ትክክለኛ ኢሜል ያስገቡ' },
                ui_toast_required_title: { en: 'Required Field', am: 'የግዴታ መስክ' },
                ui_toast_required_desc: { en: 'Please provide this information to continue.', am: 'እባክዎ ይህንን መረጃ ያስገቡ' },
                ui_toast_invalid_title: { en: 'Invalid Input', am: 'ትክክል ያልሆነ ግብዓት' },
                ui_skip: { en: 'Skip', am: 'ዘለል' },
                ui_cancel: { en: 'Cancel', am: 'ሰርዝ' },
                ui_skipped: { en: '[Skipped]', am: '[ዘለል]' },
                ui_loading_submitting_report: { en: 'Submitting your report...', am: 'ሪፖርት እየላክን ነው...' },
                ui_loading_connecting: { en: 'Connecting to secure server...', am: 'ደህንነቱ ከተጠበቀ አገልጋይ ጋር በመገናኘት ላይ...' },
                ui_report_submit_success: { en: 'Your report has been submitted successfully. Thank you.', am: 'ሪፖርትዎ በተሳካ ሁኔታ ቀርቧል። እናመሰግናለን።' },
                ui_report_submit_fail: { en: "Sorry, we couldn't submit your report.", am: 'ይቅርታ፣ ሪፖርትዎን ማስገባት አልቻልንም።' },
                ui_results_intro: { en: 'Here are the results:', am: 'የተገኙ ውጤቶች የሚከተሉት ናቸው' },
                ui_no_data: { en: 'No data found.', am: 'ምንም መረጃ አልተገኘም።' },
                ui_error_processing: { en: 'Sorry, an error occurred while processing your request.', am: 'ይቅርታ፣ ጥያቄዎን ለማካሄድ ስህተት ተከስቷል።' },
                ui_request_success: { en: 'Your request was processed successfully.', am: 'ጥያቄዎ በተሳካ ሁኔታ ተከናውኗል።' },
                ui_admin_feedback: { en: 'Admin Feedback', am: 'የአስተዳዳሪ ምላሽ' },
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
                ui_prev: { en: 'Prev', am: 'ወደ ኋላ' },
                ui_next: { en: 'Next', am: 'ቀጣይ' },
                ui_related: { en: 'Related', am: 'ተዛማጅ' },
                ui_placeholder_report_id: { en: 'Enter reference ID...', am: 'የሪፖርት ቁጥር እዚህ ያስገቡ...' },
                ui_placeholder_input: { en: 'Enter requested information...', am: 'እዚህ ይጻፉ...' },
                ui_error_bool: { en: 'Please enter "true" or "false" only', am: 'እባክዎ "true" ወይም "false" ብቻ ያስገቡ' },
                ui_error_number: { en: 'Please enter a valid number', am: 'እባክዎ ቁጥር ብቻ ያስገቡ' },
                ui_error_phone: { en: 'Please enter a valid Ethiopian phone number (e.g., 0911... or +251...)', am: 'እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ' },
                ui_error_email: { en: 'Please enter a valid email address', am: 'እባክዎ ትክክለኛ ኢሜል ያስገቡ' },
                ui_toast_required_title: { en: 'Required Field', am: 'የግዴታ መስክ' },
                ui_toast_required_desc: { en: 'Please provide this information to continue.', am: 'እባክዎ ይህንን መረጃ ያስገቡ' },
                ui_toast_invalid_title: { en: 'Invalid Input', am: 'ትክክል ያልሆነ ግብዓት' },
                ui_skip: { en: 'Skip', am: 'ዘለል' },
                ui_cancel: { en: 'Cancel', am: 'ሰርዝ' },
                ui_skipped: { en: '[Skipped]', am: '[ዘለል]' },
                ui_loading_submitting_report: { en: 'Submitting your report...', am: 'ሪፖርት እየላክን ነው...' },
                ui_loading_connecting: { en: 'Connecting to secure server...', am: 'ደህንነቱ ከተጠበቀ አገልጋይ ጋር በመገናኘት ላይ...' },
                ui_report_submit_success: { en: 'Your report has been submitted successfully. Thank you.', am: 'ሪፖርትዎ በተሳካ ሁኔታ ቀርቧል። እናመሰግናለን።' },
                ui_report_submit_fail: { en: "Sorry, we couldn't submit your report.", am: 'ይቅርታ፣ ሪፖርትዎን ማስገባት አልቻልንም።' },
                ui_results_intro: { en: 'Here are the results:', am: 'የተገኙ ውጤቶች የሚከተሉት ናቸው' },
                ui_no_data: { en: 'No data found.', am: 'ምንም መረጃ አልተገኘም።' },
                ui_error_processing: { en: 'Sorry, an error occurred while processing your request.', am: 'ይቅርታ፣ ጥያቄዎን ለማካሄድ ስህተት ተከስቷል።' },
                ui_request_success: { en: 'Your request was processed successfully.', am: 'ጥያቄዎ በተሳካ ሁኔታ ተከናውኗል።' },
                ui_admin_feedback: { en: 'Admin Feedback', am: 'የአስተዳዳሪ ምላሽ' },
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
            role: 'admin'
        },
        update: {
            email: adminEmail,
            passwordHash: hashedPassword,
            role: 'admin'
        },
    });

    const checkerUser = process.env.CHECKER_USERNAME || 'checker';
    const checkerPass = process.env.CHECKER_INITIAL_PASSWORD || process.env.CHECKER_PASSWORD || 'Checker@1234';
    const checkerEmail = process.env.CHECKER_EMAIL || 'checker@nib.local';
    const checkerPasswordHash = await hashPassword(checkerPass);

    await prisma.adminCredential.upsert({
        where: { username: checkerUser },
        create: {
            username: checkerUser,
            email: checkerEmail,
            passwordHash: checkerPasswordHash,
            role: 'checker'
        },
        update: {
            email: checkerEmail,
            passwordHash: checkerPasswordHash,
            role: 'checker'
        }
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
