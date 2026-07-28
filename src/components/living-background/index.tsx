import { AmberClassic } from "./amber-classic";
import { BreathingAurora } from "./breathing-aurora";
import { AmbientFilm } from "./ambient-film";
import { ResponsiveDawn } from "./responsive-dawn";

export const BG_CONCEPTS = {
  "1": { name: "Amber Classic", node: <AmberClassic /> },
  "2": { name: "Breathing Aurora", node: <BreathingAurora /> },
  "3": { name: "Ambient Film", node: <AmbientFilm /> },
  "4": { name: "Responsive Dawn", node: <ResponsiveDawn /> },
} as const;

export type BgVariant = keyof typeof BG_CONCEPTS;

export function normalizeBg(value?: string): BgVariant {
  return value === "2" || value === "3" || value === "4" ? value : "1";
}

/**
 * Living background. The founder-chosen default is Amber Classic (1);
 * the previous lab concepts remain reachable via `?bg=2|3|4` for comparison.
 */
export function LivingBackground({ variant }: { variant?: string }) {
  return BG_CONCEPTS[normalizeBg(variant)].node;
}
