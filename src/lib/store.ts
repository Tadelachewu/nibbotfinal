import { Language, ReportIdConfig } from './types';

const defaultLanguages: Language[] = [
  { code: 'en', name: 'English', isDefault: true },
  { code: 'am', name: 'Amharic' }
];

export const defaultSystemTranslations: Record<string, Record<string, string>> = {
  ui_bank_name: { en: 'Nib International Bank', am: 'ንብ ኢንተርናሽናል ባንክ' },
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
  ui_placeholder_input: { en: 'Enter requested information...', am: 'እዚህ ይጽፉ...' },
  ui_error_bool: { en: 'Please enter "true" or "false" only', am: 'እባክዎ "true" ወይም "false" ብቻ ያስገቡ' },
  ui_error_number: { en: 'Please enter a valid number', am: 'እባክዎ ቁጥር ብቻ ያስገቡ' },
  ui_error_phone: { en: 'Please enter a valid Ethiopian phone number (e.g., 0911... or +251...)', am: 'እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ' },
  ui_error_email: { en: 'Please enter a valid email address', am: 'እባክዎ ትክክለኛ ኢሜይል ያስገቡ' },
  ui_toast_required_title: { en: 'Required Field', am: 'የግዴታ መስክ' },
  ui_toast_required_desc: { en: 'Please provide this information to continue.', am: 'እባክዎ ይህንን መረጃ ያስገቡ' },
  ui_toast_invalid_title: { en: 'Invalid Input', am: 'ትክክል ያልሆነ ግብዓት' },
  ui_skip: { en: 'Skip', am: 'ዘለል' },
  ui_cancel: { en: 'Cancel', am: 'ሰርዝ' },
  ui_skipped: { en: '[Skipped]', am: '[ዘለል]' },
  ui_loading_submitting_report: { en: 'Submitting your report...', am: 'ሪፖርት እየላክን ነው...' },
  ui_loading_connecting: { en: 'Connecting to secure server...', am: 'ደህንነቱ ከተጠበቀ አገልጋይ ጋር በመገናኘት ላይ...' },
  ui_loading: { en: 'Loading...', am: 'በመጫን ላይ...' },
  ui_read_more: { en: 'Read more', am: 'ተጨማሪ አንብብ' },
  ui_load_more: { en: 'Load more', am: 'ተጨማሪ ጫን' },
  ui_report_submit_success: { en: 'Your report has been submitted successfully. Thank you.', am: 'ሪፖርትዎ በተሳካ ሁኔታ ቀርቧል። እናመሰግናለን።' },
  ui_report_submit_fail: { en: "Sorry, we couldn't submit your report.", am: 'ይቅርታ፣ ሪፖርትዎን ማስገባት አልቻልንም።' },
  ui_report_found: { en: 'Report {{id}} found:', am: 'ሪፖርት ቁጥር {{id}} ተገኝቷል፡' },
  ui_report_not_found: { en: "Sorry, we couldn't find a report with reference {{id}}.", am: 'ይቅርታ፣ ሪፖርት ቁጥር {{id}} ማግኘት አልቻልንም።' },
  ui_results_intro: { en: 'Here are the results:', am: 'የተገኙ ውጤቶች የሚከተሉት ናቸው' },
  ui_no_data: { en: 'No data found.', am: 'ምንም መረጃ አልተገኘም።' },
  ui_error_processing: { en: 'Sorry, an error occurred while processing your request.', am: 'ይቅርታ፣ ጥያቄዎን ለማካሄድ ስህተት ተከስቷል።' },
  ui_request_success: { en: 'Your request was processed successfully.', am: 'ጥያቄዎ በተሳካ ሁኔታ ተከናውኗል።' },
  ui_admin_feedback: { en: 'Admin Feedback', am: 'የአስተዳዳሪ ምላሽ' },
  ui_rate_service: { en: 'Rate the service', am: 'አገልጋይቱን ደረጃ ይስጡ' },
  ui_rate_hint: { en: 'Your feedback helps us improve support service quality.', am: 'አስተያየትዎ የድጋፍ አገልጋይ ጥራት ለማሻሻል ይረዳል።' },
  ui_rating_label: { en: 'Rating', am: 'ደረጃ' },
  ui_rating_comment_prompt: { en: 'Thank you. Please type any feedback (optional), or click Skip.', am: 'እናመሰግናለን። አስተያየት ካለ ያስገቡ (አማራጭ) ወይም ዘለልን ይጫኑ።' },
  ui_placeholder_feedback: { en: 'Enter feedback (optional)...', am: 'አስተያየት ያስገቡ (አማራጭ)...' },
  ui_rating_submitting: { en: 'Submitting your rating...', am: 'ደረጃዎን እየላክን ነው...' },
  ui_rating_thanks: { en: 'Thanks for your feedback.', am: 'አስተያየትዎን እናመሰግናለን።' },
  ui_rating_error: { en: 'Sorry, we could not save your rating.', am: 'ይቅርታ፣ ደረጃዎን ማስቀመጥ አልቻልንም።' },
  ui_rating_received: { en: 'Rating Received', am: 'ደረጃ ተቀብለናል' },
  ui_status_resolved: { en: 'Resolved', am: 'ተፈትቷል' },
  ui_status_reviewed: { en: 'Reviewed', am: 'በመመርመር ላይ' },
  ui_status_pending: { en: 'Pending', am: 'በጥበቃ ላይ' },
  ui_status_label: { en: 'Report Status', am: 'የሪፖርት ሁኔታ' },
  ui_original_request: { en: 'Original Request', am: 'የቀረበ ጥያቄ' },
  ui_error_fallback: { en: 'An error occurred.', am: 'ስህተት ተከስቷል።' },
  ui_welcome_am: { en: 'Welcome to Nib International Bank', am: 'እንኳን ወደ ንብ ኢንተርናሽናል ባንክ በደህና መጡ!' },
  ui_welcome_en: { en: 'Welcome to Nib International Bank', am: 'Welcome to Nib International Bank' },
  ui_back: { en: 'Back', am: 'ተመለስ' },
  ui_home: { en: 'Home', am: 'ዋና ገፅ' },
  ui_settings: { en: 'Settings', am: 'ቅንብሮች' },
  ui_user_profile: { en: 'User Profile', am: 'የተጠቃሚ መገለጫ' }
};

export const defaultReportIdConfig: ReportIdConfig = {
  prefix: 'NIB',
  yearEnabled: true,
  numberLength: 6,
  startValue: 100000,
  resetEveryYear: true
};

export { defaultLanguages };
