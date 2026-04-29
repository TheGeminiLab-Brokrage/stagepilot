// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// This file is never imported by client components.
// Prompts are returned to the browser only via the auth-gated /api/gemini-token route.

import { DR_YASMINE_PROMPT } from './scenario-prompts/prompt_dr_yasmine'
import { DR_MARIAM_PROMPT } from './scenario-prompts/prompt_dr_mariam'
import { MOHAMMED_TGL_PROMPT } from './scenario-prompts/prompt_mohammed_tgl'
import { MOHAMMED_MADINET_MASR_PROMPT } from './scenario-prompts/prompt_mohammed_madinet_masr'
import { MONA_HASSAN_PROMPT } from './scenario-prompts/prompt_mona_hassan'

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
  },
  {
    id: "mohammed_tgl",
    label: "محمد — TGL Sales Strategist",
    defaultVoice: "Charon",
    prompt: MOHAMMED_TGL_PROMPT,
    description: "محمد — TGL's internal sales strategist. Ask anything about the clinic projects in the portfolio. Strategy, comparisons, buyer targeting.",
    category: "Clinics",
    subcategory: "Educational",
    name: "محمد",
    job: "TGL Sales Strategist",
    tag: "40+ Clinic Projects",
    iconType: "chart",
    context: "TGL's senior internal strategist with command over 40+ clinic unit projects across New Cairo. He'll ask your name first, then guide you through any project, location, price range, or buyer type you want to understand.",
    practiceGoal: "Every answer comes in two layers: the direct facts, then one strategic angle you probably haven't considered. Use him before real calls to learn the full TGL portfolio, sharpen comparisons, and find the right project for the right doctor.",
  },
  {
    id: "mohammed_madinet_masr",
    label: "محمد — Madinet Masr Strategist",
    defaultVoice: "Charon",
    prompt: MOHAMMED_MADINET_MASR_PROMPT,
    description: "محمد — Madinet Masr's internal sales strategist. Ask anything about Taj City and Sarai. Strategy, comparisons, buyer targeting.",
    category: "Clinics",
    subcategory: "Educational",
    name: "محمد",
    job: "Madinet Masr Strategist",
    tag: "Taj City & Sarai",
    iconType: "tower",
    context: "Madinet Masr's internal strategist with deep knowledge of Taj City and Sarai across all phases — unit types, pricing, payment plans, delivery timelines, and the developer's 65-year track record.",
    practiceGoal: "Master the Madinet Masr pitch. Learn when to lead with Taj City vs Sarai, how to use the developer's history as a trust anchor, and how to answer price and delivery questions with the precision that closes deals.",
  },
  {
    id: "mona_hassan",
    label: "منى حسن — Sarai Buyer (Cold Call)",
    defaultVoice: "Zephyr",
    prompt: MONA_HASSAN_PROMPT,
    description: "منى حسن is a busy businesswoman privately interested in Sarai compound. Two-phase knowledge test: developer credibility first, then Sarai details. Ends call if agent scores below 70% in Phase 1. (Cold Call — Residential Buyer)",
    category: "Madinet Masr",
    subcategory: "Clients",
    name: "منى حسن",
    job: "Businesswoman",
    tag: "Madinet Masr — Sarai",
    iconType: "tower",
    context: "A busy businesswoman who came across a Madinet Masr ad for Sarai. Privately interested but never shows it. She runs a silent two-phase knowledge test from the first exchange — the agent doesn't know they're being scored.",
    practiceGoal: "The highest-pressure scenario in the suite. Phase 1: prove you know Madinet Masr's credibility and track record. Score below 70% and she ends the call — politely, but firmly. Pass Phase 1 and she opens up to Sarai details.",
  },
]

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
