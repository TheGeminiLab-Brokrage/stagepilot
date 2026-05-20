// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// This file is never imported by client components.
// Prompts are returned to the browser only via the auth-gated /api/gemini-token route.

import { DR_YASMINE_PROMPT } from './scenario-prompts/prompt_dr_yasmine'
import { DR_MARIAM_PROMPT } from './scenario-prompts/prompt_dr_mariam'
import { MOHAMMED_TGL_PROMPT } from './scenario-prompts/prompt_mohammed_tgl'
import { MOHAMMED_MADINET_MASR_PROMPT } from './scenario-prompts/prompt_mohammed_madinet_masr'
import { MONA_HASSAN_PROMPT } from './scenario-prompts/prompt_mona_hassan'
import { ALI_PROMPT } from './scenario-prompts/prompt_ali'
import { HESHAM_PROMPT } from './scenario-prompts/prompt_hesham'

export interface Scenario {
  id: string;
  label: string;
  prompt: string;
  defaultVoice: string;
  description: string;
  category: string;
  subcategory: 'Clients' | 'Educational';
  name: string;
  job: string;
  tag: string;
  iconType: 'tooth' | 'sparkle' | 'chart' | 'tower';
  context: string;
  practiceGoal: string;
  nameAr?: string;
  jobAr?: string;
  tagAr?: string;
  contextAr?: string;
  practiceGoalAr?: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "dr_yasmine",
    label: "Dr. Yasmine — Inbound Lead",
    defaultVoice: "Zephyr",
    prompt: DR_YASMINE_PROMPT,
    description: "Dr. Yasmine is a dentist. She submitted a Facebook ad form about a clinic unit and is expecting a callback. (Inbound Lead)",
    category: "Clinics",
    subcategory: "Clients",
    name: "Dr. Yasmine",
    job: "Dentist",
    tag: "Facebook Ad — Clinic Unit",
    iconType: "tooth",
    context: "She filled out a Facebook ad form about a clinic unit in El Tagamo3 El Khamis. She's at work between patients — distracted and neutral. She doesn't know who's calling or from which company.",
    practiceGoal: "Master discovery with a guarded professional. She opens cold and warms up only if you earn it. The hidden layer: the clinic is for her son finishing his dentistry degree — she won't mention it unless you ask the right question.",
    nameAr: "د. ياسمين",
    jobAr: "طبيبة أسنان",
    tagAr: "إعلان فيسبوك — وحدة عيادة",
    contextAr: "ملأت نموذج إعلان فيسبوك عن وحدة عيادة في التجمع الخامس. مشغولة بين المرضى — مشتتة وغير مبالية. لا تعرف من يتصل ولا من أي شركة.",
    practiceGoalAr: "أتقن الاستكشاف مع متخصصة متحفظة. تبدأ بارودة وتنفتح فقط إذا استحققتها. الطبقة الخفية: العيادة لابنها الذي يكمل دكتوراه الأسنان — لن تذكره إلا إذا سألت السؤال الصح.",
  },
  {
    id: "dr_mariam",
    label: "Dr. Mariam — Cosmetic Clinic",
    defaultVoice: "Zephyr",
    prompt: DR_MARIAM_PROMPT,
    description: "Dr. Mariam is an aesthetic medicine doctor looking for a cosmetic clinic unit. Will only meet if project is Mercon VX 90 or VX Golden Square. (Inbound Lead)",
    category: "Clinics",
    subcategory: "Clients",
    name: "Dr. Mariam",
    job: "Cosmetic & Aesthetic Doctor",
    tag: "Clinic Unit Inquiry",
    iconType: "sparkle",
    context: "She submitted a clinic unit inquiry online. Calm and professional, she evaluates every answer quietly. She has strict technical requirements for a cosmetic clinic — layout, electrical load, privacy, and building image all matter.",
    practiceGoal: "Navigate a technically demanding buyer who deflects every meeting attempt. She'll only agree to a site visit for Mercon VX 90 or VX Golden Square — and only after all her requirements are genuinely satisfied, not just acknowledged.",
    nameAr: "د. مريم",
    jobAr: "طبيبة تجميل وتخسيس",
    tagAr: "استفسار وحدة عيادة",
    contextAr: "قدّمت استفساراً عن وحدة عيادة عبر الإنترنت. هادئة ومحترفة، تُقيّم كل إجابة بصمت. اشتراطات تقنية صارمة: التصميم، الحمل الكهربائي، الخصوصية، وصورة المبنى.",
    practiceGoalAr: "تعامل مع مشترية متطلبة تقنياً تصرف كل محاولة لتحديد موعد. ستوافق فقط على ميركون VX 90 أو VX Golden Square — وبعد استيفاء جميع متطلباتها فعلياً لا مجرد الإقرار بها.",
  },
  {
    id: "hesham",
    label: "Hesham — Inbound Lead",
    defaultVoice: "Charon",
    prompt: HESHAM_PROMPT,
    description: "Hesham is a 52-year-old civil engineer from Port Said who submitted a Facebook lead form about a clinic investment in Access Point. He's exploring — not committed — and gives nothing away unless directly asked. (Inbound Lead)",
    category: "Clinics",
    subcategory: "Clients",
    name: "Hesham",
    job: "Civil Engineer",
    tag: "Facebook Lead — Clinic Investment",
    iconType: "chart",
    context: "He filled out a Facebook lead form about a clinic unit in Access Point, New Nargis, New Cairo. He's a remote buyer from Port Said — calm, reserved, and gives nothing away. Every detail about him must be earned through the right question.",
    practiceGoal: "Qualify a cold inbound lead through targeted questions. Uncover his hidden motive (buying for his daughter who studies dentistry), handle a strong privacy objection about the shared reception, and close for sending materials on WhatsApp.",
    nameAr: "هشام",
    jobAr: "مهندس مدني",
    tagAr: "ليد فيسبوك — وحدة طبية",
    contextAr: "ملأ نموذج فيسبوك عن وحدة طبية في Access Point، النرجس الجديدة، القاهرة الجديدة. مشترٍ بعيد من بورسعيد — هادئ ومتحفظ ولا يعطي أي معلومة إلا لمن يسأل السؤال الصح.",
    practiceGoalAr: "أهّل ليداً بارداً عبر أسئلة محددة. اكشف دافعه الخفي (يشتري لبنته الدارسة للأسنان)، تعامل مع اعتراض الخصوصية الخاص بالريسبشن المشترك، وأغلق بإرسال المواد على الواتس.",
  },
  {
    id: "mohammed_tgl",
    label: "محمد — TGL Sales Strategist",
    defaultVoice: "Charon",
    prompt: MOHAMMED_TGL_PROMPT,
    description: "محمد — TGL's internal sales strategist. Ask anything about the clinic projects in the portfolio. Strategy, comparisons, buyer targeting.",
    category: "Clinics",
    subcategory: "Educational",
    name: "Mohammed",
    nameAr: "محمد",
    job: "TGL Sales Strategist",
    tag: "40+ Clinic Projects",
    iconType: "chart",
    context: "TGL's senior internal strategist with command over 40+ clinic unit projects across New Cairo. He'll ask your name first, then guide you through any project, location, price range, or buyer type you want to understand.",
    practiceGoal: "Every answer comes in two layers: the direct facts, then one strategic angle you probably haven't considered. Use him before real calls to learn the full TGL portfolio, sharpen comparisons, and find the right project for the right doctor.",
    jobAr: "استراتيجي مبيعات TGL",
    tagAr: "+٤٠ مشروع عيادة",
    contextAr: "كبير الاستراتيجيين الداخليين في TGL، خبرة معمقة في +٤٠ مشروع وحدة عيادة بالقاهرة الجديدة. سيسألك عن اسمك أولاً، ثم يرشدك في أي مشروع أو موقع أو فئة سعرية أو نوع مشترٍ.",
    practiceGoalAr: "كل إجابة في طبقتين: الحقائق المباشرة، ثم زاوية استراتيجية نادراً ما تخطر على البال. استخدمه قبل المكالمات الحقيقية لتتعلم محفظة TGL كاملاً وتجد المشروع الصح للطبيب الصح.",
  },
  {
    id: "mohammed_madinet_masr",
    label: "محمد — Madinet Masr Strategist",
    defaultVoice: "Charon",
    prompt: MOHAMMED_MADINET_MASR_PROMPT,
    description: "محمد — Madinet Masr's internal sales strategist. Ask anything about Taj City and Sarai. Strategy, comparisons, buyer targeting.",
    category: "Clinics",
    subcategory: "Educational",
    name: "Mohammed",
    nameAr: "محمد",
    job: "Madinet Masr Strategist",
    tag: "Taj City & Sarai",
    iconType: "tower",
    context: "Madinet Masr's internal strategist with deep knowledge of Taj City and Sarai across all phases — unit types, pricing, payment plans, delivery timelines, and the developer's 65-year track record.",
    practiceGoal: "Master the Madinet Masr pitch. Learn when to lead with Taj City vs Sarai, how to use the developer's history as a trust anchor, and how to answer price and delivery questions with the precision that closes deals.",
    jobAr: "استراتيجي مدينة مصر",
    tagAr: "طاج سيتي وسراي",
    contextAr: "استراتيجي داخلي في مدينة مصر، خبير معمق في طاج سيتي وسراي عبر جميع المراحل — أنواع الوحدات والأسعار وخطط السداد ومواعيد التسليم وسجل الشركة الممتد لـ٦٥ عاماً.",
    practiceGoalAr: "أتقن عرض مدينة مصر. تعلّم متى تبدأ بطاج سيتي أو سراي، وكيف توظّف تاريخ الشركة أداةً للثقة، وكيف تجيب عن أسئلة السعر والتسليم بدقة تغلق الصفقات.",
  },
  {
    id: "mona_hassan",
    label: "منى حسن — Sarai Buyer (Cold Call)",
    defaultVoice: "Zephyr",
    prompt: MONA_HASSAN_PROMPT,
    description: "منى حسن is a busy businesswoman privately interested in Sarai compound. Two-phase knowledge test: developer credibility first, then Sarai details. Ends call if agent scores below 70% in Phase 1. (Cold Call — Residential Buyer)",
    category: "Madinet Masr",
    subcategory: "Clients",
    name: "Mona Hassan",
    nameAr: "منى حسن",
    job: "Businesswoman",
    tag: "Madinet Masr — Sarai",
    iconType: "tower",
    context: "A busy businesswoman who came across a Madinet Masr ad for Sarai. Privately interested but never shows it. She runs a silent two-phase knowledge test from the first exchange — the agent doesn't know they're being scored.",
    practiceGoal: "The highest-pressure scenario in the suite. Phase 1: prove you know Madinet Masr's credibility and track record. Score below 70% and she ends the call — politely, but firmly. Pass Phase 1 and she opens up to Sarai details.",
    jobAr: "سيدة أعمال",
    tagAr: "مدينة مصر — سراي",
    contextAr: "سيدة أعمال مشغولة صادفت إعلان مدينة مصر عن سراي. مهتمة في الخفاء ولا تُظهر ذلك. تُجري اختباراً صامتاً ثنائي المرحلة منذ أول تبادل — الموظف لا يعلم أنه يُقيَّم.",
    practiceGoalAr: "أعلى سيناريو ضغطاً في المجموعة. المرحلة الأولى: أثبت معرفتك بمصداقية مدينة مصر وسجلها. أقل من ٧٠٪ وتنهي المكالمة — بأدب لكن بحزم. اجتز المرحلة الأولى وستنفتح معك على تفاصيل سراي.",
  },
  {
    id: "ali",
    label: "علي — Knowledge Quiz",
    defaultVoice: "Charon",
    prompt: ALI_PROMPT,
    description: "علي — an internal AI quiz master that calls agents and tests their knowledge of commercial clinic units across New Cairo. Egyptian Arabic only.",
    category: "Clinics",
    subcategory: "Educational",
    name: "Ali",
    nameAr: "علي",
    job: "Internal Training System",
    tag: "Clinic Knowledge Quiz",
    iconType: "chart",
    context: "An internal AI training system that calls agents and quizzes them on available commercial clinic units in New Cairo — location, developer, sizes, prices, payment plans, and delivery dates. It never answers questions; it only asks them.",
    practiceGoal: "Test your full product knowledge under pressure. علي asks one question at a time and scores every answer. Cover all projects you claim to know — wrong or missing answers are corrected on the spot. No hints, no mercy, Egyptian Arabic only.",
    jobAr: "نظام تدريب داخلي",
    tagAr: "اختبار معرفة العيادات",
    contextAr: "نظام تدريب داخلي يتصل بالموظفين ويختبر معرفتهم بوحدات العيادات التجارية المتاحة في القاهرة الجديدة — الموقع والمطور والمساحات والأسعار وخطط السداد ومواعيد التسليم. لا يجيب على أسئلة، فقط يسأل.",
    practiceGoalAr: "اختبر معرفتك الكاملة بالمنتج تحت الضغط. علي يسأل سؤالاً واحداً في كل مرة ويصحح كل إجابة. غطِّ جميع المشاريع التي تدّعي معرفتها — الإجابات الخاطئة أو الناقصة تُصحَّح فوراً. لا تلميحات، بالعامية المصرية فقط.",
  },
]

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
