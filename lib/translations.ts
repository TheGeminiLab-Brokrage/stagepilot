const en = {
  // ── Navbar links ──────────────────────────────────────────────────────────
  navAiPractice: 'AI Practice',
  navExam: 'Exam',
  navMyCalls: 'My Calls',
  navTeamCalls: 'Team Calls',
  navUploadCall: 'Upload Call',
  navAdmin: 'Admin',
  navKnowledgeBase: 'Knowledge Base',

  // ── Role badge names ──────────────────────────────────────────────────────
  roleAgent: 'Agent',
  roleTeamLeader: 'Team Leader',
  roleSuperAdmin: 'Super Admin',
  roleTrainee: 'Trainee',
  roleExam: 'Exam',

  // ── Dashboard page header ─────────────────────────────────────────────────
  headingMyCalls: 'My Calls',
  headingTeamCalls: 'Team Calls',
  subtitleMyCalls: 'Your processed call recordings',
  subtitleTeamCalls: 'Reviewing calls for',
  btnUploadCall: '+ Upload Call',

  // ── StatsCards ────────────────────────────────────────────────────────────
  statTotalProcessed: 'Total Processed',
  statAiAccuracy: 'AI Accuracy',
  statOfCalls: 'of',
  statCalls: 'calls',
  statThisWeek: 'This Week',
  statLast7Days: 'last 7 days',
  statErrors: 'Errors',
  statStageBreakdown: 'Stage Breakdown',

  // ── FilterBar ─────────────────────────────────────────────────────────────
  filterStage: 'Stage',
  filterSearchClient: 'Search client…',
  filterAllTeams: 'All teams',
  filterSearchAgent: 'Search agent…',
  filterClearAll: 'Clear all',

  // ── CallsTable column headers ─────────────────────────────────────────────
  colFile: 'File',
  colClient: 'Client',
  colAgent: 'Agent',
  colCampaign: 'Campaign',
  colAiStage: 'AI Stage',
  colAgentStage: 'Agent Stage',
  colCorrection: 'Correction',
  colStatus: 'Status',
  colDate: 'Date',

  // ── CallsTable content ────────────────────────────────────────────────────
  noCallsYet: 'No calls yet.',
  uploadFirstCall: 'Upload your first call',
  statusProcessing: 'Processing…',
  statusDone: 'Done',
  statusError: 'Error',
  correctBtn: 'Correct →',
  removeCorrection: '— remove correction —',

  // ── Delete modal ──────────────────────────────────────────────────────────
  deleteModalTitle: 'Remove client?',
  deleteModalUnknown: 'Unknown client',
  deleteModalBody: 'This call record will be permanently deleted.',
  deleteModalCancel: 'Cancel',
  deleteModalConfirm: 'Remove',

  // ── CallDetailModal sections ───────────────────────────────────────────────
  sectionCallRecording: 'Call Recording',
  sectionSummary: 'Summary',
  sectionTripleC: 'Triple C Analysis',
  sectionPainPoints: 'Client Pain Points',
  sectionAgentFeedback: 'Agent Feedback',
  sectionAiReasoning: 'AI Stage Reasoning',
  modalCampaign: 'Campaign:',
  modalAgent: 'Agent:',
  modalWas: 'was:',
  modalLoading: 'Loading…',
  modalLoadRecording: '▶ Load Recording',
  modalGetDownloadLink: '⬇ Get Download Link',
  modalNotPlayable: 'not playable in browser',
  modalDownload: '⬇ Download Recording',
  modalAnalysisNA: 'Analysis not available',
  modalNoDetail: 'No detail available',

  // ── Triple C items ─────────────────────────────────────────────────────────
  tripleCNeedLabel: 'Clear Need',
  tripleCNeedDesc: 'Did the prospect articulate a specific pain point?',
  tripleCBudgetLabel: 'Clear Budget',
  tripleCBudgetDesc: 'Was budget or willingness to invest confirmed?',
  tripleCPathLabel: 'Clear Path',
  tripleCPathDesc: 'Did the agent lock in a clear next step — a follow-up call, meeting, or any confirmed action with the client?',

  // ── UploadForm ────────────────────────────────────────────────────────────
  uploadDropZone: 'Drag & drop audio file here',
  uploadClickBrowse: 'or click to browse',
  uploadSupportedFormats: 'M4A, MP3, WAV, AMR, AAC, FLAC supported',
  uploadRemoveFile: 'Remove',
  uploadStageLabel: 'Your Stage Assessment',
  uploadStagePlaceholder: 'Select the call stage…',
  uploadUploading: 'Uploading…',
  uploadSuccess: 'Uploaded! Processing in the background — redirecting…',
  uploadSubmitBtn: 'Process Call',
  uploadSubmittingBtn: 'Uploading…',

  // ── Admin page ────────────────────────────────────────────────────────────
  adminHeading: 'User Management',

  // ── Exam tab labels ───────────────────────────────────────────────────────
  examTabExam: 'Exam',
  examTabResults: 'Exam Results',

  // ── Exam phase labels ─────────────────────────────────────────────────────
  examPhase1: '1 — Questions',
  examPhase2: '2 — Scenarios',
  examPhase3: '3 — Simulation',
  examResults: 'Results',

  // ── Exam gate / intro screens ──────────────────────────────────────────────
  examTagline: 'Certification Exam',
  examReadyQuestion: 'are you ready?',
  examIntroBody: 'The exam consists of 3 phases: multiple choice questions, scenarios, and a live call simulation.',
  examIntroPhase1Label: 'Phase 1',
  examIntroPhase2Label: 'Phase 2',
  examIntroPhase3Label: 'Phase 3',
  examIntroPhase1Desc: 'Questions',
  examIntroPhase2Desc: 'Scenarios',
  examIntroPhase3Desc: 'Simulation',
  examIntroWarning: 'Warning: You have only one attempt per day',
  examStartBtn: 'Start Exam',
  examLoading: 'Loading…',
  examBlockedTitle: 'You have used your daily exam attempt',
  examBlockedBody: 'Only one attempt is allowed per day. Come back tomorrow to try again.',
  examBlockedLogout: 'Sign Out',
  examStartError: 'An error occurred. Please try again.',

  // ── Stage names ───────────────────────────────────────────────────────────
  stageDoneDeal: 'done deal',
  stagePotentialToClose: 'potential to close',
  stageMeetingScheduled: 'meeting scheduled',
  stageMeetingDone: 'meeting done',
  stageInterestedFollowUp: 'interested / follow up',
  stageNotInterested: 'not interested',
  stageLowBudget: 'low budget',
}

const ar: typeof en = {
  // ── Navbar links ──────────────────────────────────────────────────────────
  navAiPractice: 'تدريب بالذكاء الاصطناعي',
  navExam: 'الامتحان',
  navMyCalls: 'مكالماتي',
  navTeamCalls: 'مكالمات الفريق',
  navUploadCall: 'رفع مكالمة',
  navAdmin: 'الإدارة',
  navKnowledgeBase: 'قاعدة المعرفة',

  // ── Role badge names ──────────────────────────────────────────────────────
  roleAgent: 'وكيل',
  roleTeamLeader: 'قائد فريق',
  roleSuperAdmin: 'مدير النظام',
  roleTrainee: 'متدرب',
  roleExam: 'امتحان',

  // ── Dashboard page header ─────────────────────────────────────────────────
  headingMyCalls: 'مكالماتي',
  headingTeamCalls: 'مكالمات الفريق',
  subtitleMyCalls: 'تسجيلاتك المعالجة',
  subtitleTeamCalls: 'مراجعة مكالمات',
  btnUploadCall: '+ رفع مكالمة',

  // ── StatsCards ────────────────────────────────────────────────────────────
  statTotalProcessed: 'إجمالي المعالجة',
  statAiAccuracy: 'دقة الذكاء الاصطناعي',
  statOfCalls: 'من',
  statCalls: 'مكالمة',
  statThisWeek: 'هذا الأسبوع',
  statLast7Days: 'آخر 7 أيام',
  statErrors: 'أخطاء',
  statStageBreakdown: 'توزيع المراحل',

  // ── FilterBar ─────────────────────────────────────────────────────────────
  filterStage: 'المرحلة',
  filterSearchClient: 'البحث عن عميل…',
  filterAllTeams: 'كل الفرق',
  filterSearchAgent: 'البحث عن وكيل…',
  filterClearAll: 'مسح الكل',

  // ── CallsTable column headers ─────────────────────────────────────────────
  colFile: 'الملف',
  colClient: 'العميل',
  colAgent: 'الوكيل',
  colCampaign: 'الحملة',
  colAiStage: 'مرحلة الذكاء الاصطناعي',
  colAgentStage: 'مرحلة الوكيل',
  colCorrection: 'التصحيح',
  colStatus: 'الحالة',
  colDate: 'التاريخ',

  // ── CallsTable content ────────────────────────────────────────────────────
  noCallsYet: 'لا مكالمات حتى الآن.',
  uploadFirstCall: 'ارفع مكالمتك الأولى',
  statusProcessing: 'جاري المعالجة…',
  statusDone: 'تم',
  statusError: 'خطأ',
  correctBtn: 'تصحيح ←',
  removeCorrection: '— إزالة التصحيح —',

  // ── Delete modal ──────────────────────────────────────────────────────────
  deleteModalTitle: 'إزالة العميل؟',
  deleteModalUnknown: 'عميل غير معروف',
  deleteModalBody: 'سيتم حذف سجل هذه المكالمة نهائيًا.',
  deleteModalCancel: 'إلغاء',
  deleteModalConfirm: 'إزالة',

  // ── CallDetailModal sections ───────────────────────────────────────────────
  sectionCallRecording: 'تسجيل المكالمة',
  sectionSummary: 'الملخص',
  sectionTripleC: 'تحليل Triple C',
  sectionPainPoints: 'نقاط ألم العميل',
  sectionAgentFeedback: 'ملاحظات الوكيل',
  sectionAiReasoning: 'مبررات مرحلة الذكاء الاصطناعي',
  modalCampaign: 'الحملة:',
  modalAgent: 'الوكيل:',
  modalWas: 'كانت:',
  modalLoading: 'جاري التحميل…',
  modalLoadRecording: '▶ تحميل التسجيل',
  modalGetDownloadLink: '⬇ الحصول على رابط التنزيل',
  modalNotPlayable: 'لا يمكن تشغيله في المتصفح',
  modalDownload: '⬇ تنزيل التسجيل',
  modalAnalysisNA: 'التحليل غير متاح',
  modalNoDetail: 'لا تفاصيل متاحة',

  // ── Triple C items ─────────────────────────────────────────────────────────
  tripleCNeedLabel: 'احتياج واضح',
  tripleCNeedDesc: 'هل عبّر العميل المحتمل عن نقطة ألم محددة؟',
  tripleCBudgetLabel: 'ميزانية واضحة',
  tripleCBudgetDesc: 'هل تم تأكيد الميزانية أو الاستعداد للاستثمار؟',
  tripleCPathLabel: 'مسار واضح',
  tripleCPathDesc: 'هل حدد الوكيل خطوة تالية واضحة — مكالمة متابعة أو اجتماع أو إجراء مؤكد مع العميل؟',

  // ── UploadForm ────────────────────────────────────────────────────────────
  uploadDropZone: 'اسحب وأفلت ملف الصوت هنا',
  uploadClickBrowse: 'أو انقر للتصفح',
  uploadSupportedFormats: 'M4A, MP3, WAV, AMR, AAC, FLAC مدعومة',
  uploadRemoveFile: 'إزالة',
  uploadStageLabel: 'تقييمك للمرحلة',
  uploadStagePlaceholder: 'اختر مرحلة المكالمة…',
  uploadUploading: 'جاري الرفع…',
  uploadSuccess: 'تم الرفع! المعالجة جارية في الخلفية — جاري التحويل…',
  uploadSubmitBtn: 'معالجة المكالمة',
  uploadSubmittingBtn: 'جاري الرفع…',

  // ── Admin page ────────────────────────────────────────────────────────────
  adminHeading: 'إدارة المستخدمين',

  // ── Exam tab labels ───────────────────────────────────────────────────────
  examTabExam: 'الاختبار',
  examTabResults: 'نتائج الاختبار',

  // ── Exam phase labels ─────────────────────────────────────────────────────
  examPhase1: '١ — الأسئلة',
  examPhase2: '٢ — السيناريوهات',
  examPhase3: '٣ — المحاكاة',
  examResults: 'النتيجة',

  // ── Exam gate / intro screens ──────────────────────────────────────────────
  examTagline: 'الاختبار التقييمي',
  examReadyQuestion: 'أنت جاهز؟',
  examIntroBody: 'الاختبار يتكوّن من ٣ مراحل: أسئلة متعددة الخيارات، سيناريوهات، ومحاكاة مكالمة حيّة.',
  examIntroPhase1Label: 'المرحلة ١',
  examIntroPhase2Label: 'المرحلة ٢',
  examIntroPhase3Label: 'المرحلة ٣',
  examIntroPhase1Desc: 'أسئلة',
  examIntroPhase2Desc: 'سيناريوهات',
  examIntroPhase3Desc: 'محاكاة',
  examIntroWarning: 'تنبيه: لديك محاولة واحدة فقط في اليوم',
  examStartBtn: 'ابدأ الاختبار',
  examLoading: 'جاري التحميل…',
  examBlockedTitle: 'لقد استخدمت محاولة الاختبار اليومية',
  examBlockedBody: 'يُسمح بمحاولة واحدة فقط في اليوم. عد غداً للمحاولة مجدداً.',
  examBlockedLogout: 'تسجيل الخروج',
  examStartError: 'حدث خطأ. حاول مرة أخرى.',

  // ── Stage names ───────────────────────────────────────────────────────────
  stageDoneDeal: 'صفقة منجزة',
  stagePotentialToClose: 'احتمال إغلاق',
  stageMeetingScheduled: 'اجتماع مجدول',
  stageMeetingDone: 'اجتماع منتهي',
  stageInterestedFollowUp: 'مهتم / متابعة',
  stageNotInterested: 'غير مهتم',
  stageLowBudget: 'ميزانية منخفضة',
}

export const translations = { en, ar }
export type TranslationKey = keyof typeof en

// Maps English stage name → translation key
export const STAGE_KEY_MAP: Record<string, TranslationKey> = {
  'done deal': 'stageDoneDeal',
  'potential to close': 'stagePotentialToClose',
  'meeting scheduled': 'stageMeetingScheduled',
  'meeting done': 'stageMeetingDone',
  'interested / follow up': 'stageInterestedFollowUp',
  'not interested': 'stageNotInterested',
  'low budget': 'stageLowBudget',
}
