// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// This file is never imported by client components.
// Prompts are returned to the browser only via the auth-gated /api/gemini-token route.

import { DR_YASMINE_PROMPT } from './scenario-prompts/prompt_dr_yasmine'
import { ENG_KHALED_PROMPT } from './scenario-prompts/prompt_eng_khaled'
import { MRS_NADIA_PROMPT } from './scenario-prompts/prompt_mrs_nadia'
import { DR_MARIAM_PROMPT } from './scenario-prompts/prompt_dr_mariam'

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
    label: "Dr. Yasmine — Cold Call",
    defaultVoice: "Aoede",
    prompt: DR_YASMINE_PROMPT,
    description: "Dr. Yasmine is a dentist. She applied for a clinic unit campaign in Tagamoa El Khames. (Cold Call)",
  },
  {
    id: "eng_khaled",
    label: "Eng. Khaled — Objection Handling",
    defaultVoice: "Charon",
    prompt: ENG_KHALED_PROMPT,
    description: "Eng. Khaled is a civil engineer. He is looking for an investment opportunity if it seems right. (Tests Objections)",
  },
  {
    id: "mrs_nadia",
    label: "Mrs. Nadia — Investment Buyer",
    defaultVoice: "Kore",
    prompt: MRS_NADIA_PROMPT,
    description: "Mrs. Nadia is a boutique owner. She is looking into investment properties. (Investment Buyer)",
  },
  {
    id: "dr_mariam",
    label: "Dr. Mariam — Cosmetic Clinic",
    defaultVoice: "Aoede",
    prompt: DR_MARIAM_PROMPT,
    description: "Dr. Mariam is an aesthetic medicine doctor looking for a cosmetic clinic unit. (Cold Call)",
  },
]

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
