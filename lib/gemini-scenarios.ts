// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// This file is never imported by client components.
// Prompts are returned to the browser only via the auth-gated /api/gemini-token route.

import { DR_YASMINE_PROMPT } from './scenario-prompts/prompt_dr_yasmine'
import { ENG_KHALED_PROMPT } from './scenario-prompts/prompt_eng_khaled'
import { MRS_NADIA_PROMPT } from './scenario-prompts/prompt_mrs_nadia'

export interface Scenario {
  id: string;
  label: string;
  prompt: string;
  defaultVoice: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "dr_yasmine",
    label: "Dr. Yasmine — Cold Call",
    defaultVoice: "Aoede",
    prompt: DR_YASMINE_PROMPT,
  },
  {
    id: "eng_khaled",
    label: "Eng. Khaled — Objection Handling",
    defaultVoice: "Charon",
    prompt: ENG_KHALED_PROMPT,
  },
  {
    id: "mrs_nadia",
    label: "Mrs. Nadia — Investment Buyer",
    defaultVoice: "Kore",
    prompt: MRS_NADIA_PROMPT,
  },
]

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
