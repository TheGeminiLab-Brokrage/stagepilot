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

  // ── UserExamResultsTab columns ────────────────────────────────────────────
  userExamColPhase1: 'Phase 1',
  userExamColPhase2: 'Phase 2',
  userExamColTotal: 'Total',
  userExamColResult: 'Result',
  userExamColDate: 'Date',
  userExamColDetails: 'Details',
  userExamColRecording: 'Recording',
  userExamColCallGrade: 'Call Grade',
  userExamColDownload: 'Download',

  // ── UserExamResultsTab content ────────────────────────────────────────────
  userExamPassed: 'Pass',
  userExamFailed: 'Fail',
  userExamViewDetails: 'View Details',
  userExamDetailsTitle: 'Exam Details',
  userExamNoDetails: 'No details saved for this exam.',
  userExamYourAnswer: 'Your answer:',
  userExamCorrectAnswer: 'Correct answer:',
  userExamNoRecording: 'No recording',
  userExamLoadRecording: '▶ Load Recording',
  userExamDownloadReport: 'Download Report',
  userExamGenerating: 'Generating…',
  userExamDownloaded: 'Downloaded',
  userExamAnalyzing: 'Analyzing…',
  userExamEmpty: 'No exams completed yet. Your results will appear here after finishing the exam.',
  userExamCount1: 'exam completed',
  userExamCountN: 'exams completed',

  // ── GradeModal ────────────────────────────────────────────────────────────
  gradeModalTitle: 'Call Assessment',
  gradeModalTotalScore: 'Total Score:',
  gradeModalOverall: 'Overall Feedback',
  criteriaIceBreaking: 'Ice Breaking',
  criteriaDiscovery: 'Discovery Questions',
  criteriaUnitRec: 'Unit Recommendation',
  criteriaActionTaking: 'Action Taking',

  // ── ExamResults completion screen ─────────────────────────────────────────
  examCompletedTitle: 'Exam Completed',
  examCompletedBody: 'Thank you! Your answers have been recorded. Your result will be reviewed by the administration and you will be notified.',
  examRetakeBtn: 'Retake Exam ↺',
  examBackHomeBtn: 'Back to Home',

  // ── PracticeClient ────────────────────────────────────────────────────────
  practiceStatusIdle: 'Ready to Practice',
  practiceStatusConnecting: 'Connecting',
  practiceStatusListening: 'Listening',
  practiceStatusSpeaking: 'Speaking',
  practiceStatusEnding: 'Ending…',
  practiceStatusError: 'Connection Error',
  practiceScenarios: 'Scenarios',
  practiceClients: 'Clients',
  practiceEducational: 'Educational',
  practiceStart: 'Start',
  practiceSaving: 'Saving…',
  practiceNew: '↺ New',
  practiceEndSession: 'End Session',

  // ── PracticeClient card labels ─────────────────────────────────────────
  practiceScenarioLabel: 'Scenario',
  practiceAskAbout: 'Ask about',
  practiceWhatToPractice: 'What to practice',
  practiceHowToUse: 'How to use',
  practiceNoScenario: 'No scenario selected',
  practiceStartWith: 'Start with',

  // ── Admin table columns & actions ─────────────────────────────────────
  adminColName: 'Name',
  adminColPhase1: 'Phase 1',
  adminColPhase2: 'Phase 2',
  adminColPhase3: 'Phase 3',
  adminColTotal: 'Total',
  adminColResult: 'Result',
  adminColDate: 'Date',
  adminColTime: 'Time',
  adminColDuration: 'Duration',
  adminColTrainee: 'Trainee',
  adminColScenario: 'Scenario',
  adminColAdmin: 'Admin',
  adminColEmail: 'Email',
  adminColTeam: 'Team',
  adminColRole: 'Role',
  adminColJoined: 'Joined',
  adminViewDetails: 'Details',
  adminReport: 'Report',
  adminDownloaded: 'Downloaded',

  // ── Admin page sections ────────────────────────────────────────────────
  adminUsersInCompany: 'users in your company',
  adminAddNewUser: 'Add New User',
  adminExamResultsTitle: 'Exam Results',
  adminExamsCompleted: 'exams completed',
  adminExamRecordingsTitle: 'AI Test Exam Recordings',
  adminRecordingsCount: 'recordings',
  adminPracticeSessionsTitle: 'Practice Sessions',
  adminSessionsRecorded: 'sessions recorded',

  // ── UserTable actions & modals ─────────────────────────────────────────
  adminSetPasswordBtn: 'Set password',
  adminRemoveBtn: 'Remove',
  adminSetNewPasswordTitle: 'Set new password',
  adminRemoveUserTitle: 'Remove user?',
  adminCannotUndo: 'This cannot be undone.',
  adminCancel: 'Cancel',
  adminSave: 'Save',
  adminSaving: 'Saving…',
  adminPasswordUpdated: 'Password updated.',
  adminPasswordMinErr: 'Password must be at least 8 characters',
  adminUnassigned: '— unassigned —',
  adminYouLabel: '(you)',

  // ── CreateUserForm ─────────────────────────────────────────────────────
  adminLabelFullName: 'Full name',
  adminLabelPassword: 'Password',
  adminLabelRole: 'Role',
  adminPlaceholderPassword: 'Min. 8 characters',
  adminNoTeam: 'No team',
  adminCreateUserBtn: 'Create User',
  adminCreatingBtn: 'Creating…',
  adminUserCreatedMsg: 'User created successfully. They can log in now.',
  adminRoleExam: 'Exam',
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

  // ── UserExamResultsTab columns ────────────────────────────────────────────
  userExamColPhase1: 'المرحلة الأولى',
  userExamColPhase2: 'المرحلة الثانية',
  userExamColTotal: 'الإجمالي',
  userExamColResult: 'النتيجة',
  userExamColDate: 'التاريخ',
  userExamColDetails: 'التفاصيل',
  userExamColRecording: 'المكالمة',
  userExamColCallGrade: 'تقييم المكالمة',
  userExamColDownload: 'تنزيل',

  // ── UserExamResultsTab content ────────────────────────────────────────────
  userExamPassed: 'ناجح',
  userExamFailed: 'راسب',
  userExamViewDetails: 'عرض التفاصيل',
  userExamDetailsTitle: 'تفاصيل الاختبار',
  userExamNoDetails: 'لا توجد تفاصيل محفوظة لهذا الاختبار.',
  userExamYourAnswer: 'إجابتك:',
  userExamCorrectAnswer: 'الإجابة الصحيحة:',
  userExamNoRecording: 'لا يوجد تسجيل',
  userExamLoadRecording: '▶ تشغيل المكالمة',
  userExamDownloadReport: 'تنزيل التقرير',
  userExamGenerating: 'جاري التوليد…',
  userExamDownloaded: 'تم التحميل',
  userExamAnalyzing: 'جاري التحليل…',
  userExamEmpty: 'لم تُكمل أي اختبار بعد. بعد إنهاء الاختبار ستظهر نتائجك هنا.',
  userExamCount1: 'اختبار مكتمل',
  userExamCountN: 'اختبارات مكتملة',

  // ── GradeModal ────────────────────────────────────────────────────────────
  gradeModalTitle: 'تقييم المكالمة',
  gradeModalTotalScore: 'الدرجة الإجمالية:',
  gradeModalOverall: 'التقييم العام',
  criteriaIceBreaking: 'كسر الجليد',
  criteriaDiscovery: 'أسئلة الاستكشاف',
  criteriaUnitRec: 'توصية الوحدة',
  criteriaActionTaking: 'اتخاذ الإجراء',

  // ── ExamResults completion screen ─────────────────────────────────────────
  examCompletedTitle: 'تم إنهاء الاختبار',
  examCompletedBody: 'شكراً! تم تسجيل إجاباتك بنجاح. سيتم مراجعة نتيجتك من قِبل الإدارة وسيتم إبلاغك بها.',
  examRetakeBtn: 'إعادة الامتحان ↺',
  examBackHomeBtn: 'العودة للرئيسية',

  // ── PracticeClient ────────────────────────────────────────────────────────
  practiceStatusIdle: 'جاهز للتدريب',
  practiceStatusConnecting: 'جاري الاتصال',
  practiceStatusListening: 'يستمع',
  practiceStatusSpeaking: 'يتحدث',
  practiceStatusEnding: 'جاري الإنهاء…',
  practiceStatusError: 'خطأ في الاتصال',
  practiceScenarios: 'السيناريوهات',
  practiceClients: 'العملاء',
  practiceEducational: 'تعليمي',
  practiceStart: 'ابدأ',
  practiceSaving: 'جاري الحفظ…',
  practiceNew: '↺ جديد',
  practiceEndSession: 'إنهاء الجلسة',

  // ── PracticeClient card labels ─────────────────────────────────────────
  practiceScenarioLabel: 'السيناريو',
  practiceAskAbout: 'اسأل عن',
  practiceWhatToPractice: 'ما تتدرب عليه',
  practiceHowToUse: 'كيف تستخدمه',
  practiceNoScenario: 'لم يُختر سيناريو',
  practiceStartWith: 'ابدأ مع',

  // ── Admin table columns & actions ─────────────────────────────────────
  adminColName: 'الاسم',
  adminColPhase1: 'المرحلة ١',
  adminColPhase2: 'المرحلة ٢',
  adminColPhase3: 'المرحلة ٣',
  adminColTotal: 'الإجمالي',
  adminColResult: 'النتيجة',
  adminColDate: 'التاريخ',
  adminColTime: 'الوقت',
  adminColDuration: 'المدة',
  adminColTrainee: 'المتدرب',
  adminColScenario: 'السيناريو',
  adminColAdmin: 'المسؤول',
  adminColEmail: 'البريد الإلكتروني',
  adminColTeam: 'الفريق',
  adminColRole: 'الدور',
  adminColJoined: 'تاريخ الانضمام',
  adminViewDetails: 'عرض التفاصيل',
  adminReport: 'تقرير',
  adminDownloaded: 'تم التحميل',

  // ── Admin page sections ────────────────────────────────────────────────
  adminUsersInCompany: 'مستخدم في شركتك',
  adminAddNewUser: 'إضافة مستخدم جديد',
  adminExamResultsTitle: 'نتائج الاختبار',
  adminExamsCompleted: 'اختبار مكتمل',
  adminExamRecordingsTitle: 'تسجيلات اختبار الذكاء الاصطناعي',
  adminRecordingsCount: 'تسجيل',
  adminPracticeSessionsTitle: 'جلسات التدريب',
  adminSessionsRecorded: 'جلسة مسجلة',

  // ── UserTable actions & modals ─────────────────────────────────────────
  adminSetPasswordBtn: 'تعيين كلمة المرور',
  adminRemoveBtn: 'إزالة',
  adminSetNewPasswordTitle: 'تعيين كلمة مرور جديدة',
  adminRemoveUserTitle: 'إزالة المستخدم؟',
  adminCannotUndo: 'لا يمكن التراجع عن هذا.',
  adminCancel: 'إلغاء',
  adminSave: 'حفظ',
  adminSaving: 'جاري الحفظ…',
  adminPasswordUpdated: 'تم تحديث كلمة المرور.',
  adminPasswordMinErr: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل',
  adminUnassigned: '— غير مخصص —',
  adminYouLabel: '(أنت)',

  // ── CreateUserForm ─────────────────────────────────────────────────────
  adminLabelFullName: 'الاسم الكامل',
  adminLabelPassword: 'كلمة المرور',
  adminLabelRole: 'الدور',
  adminPlaceholderPassword: '8 أحرف على الأقل',
  adminNoTeam: 'بدون فريق',
  adminCreateUserBtn: 'إنشاء مستخدم',
  adminCreatingBtn: 'جاري الإنشاء…',
  adminUserCreatedMsg: 'تم إنشاء المستخدم بنجاح. يمكنه تسجيل الدخول الآن.',
  adminRoleExam: 'اختبار',
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
