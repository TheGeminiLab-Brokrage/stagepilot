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
  },
]

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
