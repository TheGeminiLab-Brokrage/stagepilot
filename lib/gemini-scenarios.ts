// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// This file is never imported by client components.
// Prompts are returned to the browser only via the auth-gated /api/gemini-token route.

import { DR_YASMINE_PROMPT } from './scenario-prompts/prompt_dr_yasmine'
import { DR_MARIAM_PROMPT } from './scenario-prompts/prompt_dr_mariam'
import { MOHAMMED_TGL_PROMPT } from './scenario-prompts/prompt_mohammed_tgl'
import { MOHAMMED_MADINET_MASR_PROMPT } from './scenario-prompts/prompt_mohammed_madinet_masr'

export interface Scenario {
  id: string;
  label: string;
  prompt: string;
  defaultVoice: string;
  description: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "dr_yasmine",
    label: "Dr. Yasmine — Inbound Lead",
    defaultVoice: "Zephyr",
    prompt: DR_YASMINE_PROMPT,
    description: "Dr. Yasmine is a dentist. She submitted a Facebook ad form about a clinic unit and is expecting a callback. (Inbound Lead)",
  },
  {
    id: "dr_mariam",
    label: "Dr. Mariam — Cosmetic Clinic",
    defaultVoice: "Zephyr",
    prompt: DR_MARIAM_PROMPT,
    description: "Dr. Mariam is an aesthetic medicine doctor looking for a cosmetic clinic unit. Will only meet if project is Mercon VX 90 or VX Golden Square. (Inbound Lead)",
  },
  {
    id: "mohammed_tgl",
    label: "محمد — TGL Sales Strategist",
    defaultVoice: "Charon",
    prompt: MOHAMMED_TGL_PROMPT,
    description: "محمد — TGL's internal sales strategist. Ask anything about the clinic projects in the portfolio. Strategy, comparisons, buyer targeting.",
  },
  {
    id: "mohammed_madinet_masr",
    label: "محمد — Madinet Masr Strategist",
    defaultVoice: "Charon",
    prompt: MOHAMMED_MADINET_MASR_PROMPT,
    description: "محمد — Madinet Masr's internal sales strategist. Ask anything about Taj City and Sarai. Strategy, comparisons, buyer targeting.",
  },
]

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
