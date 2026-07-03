import { BreathingAurora } from "./breathing-aurora";
import { AmbientFilm } from "./ambient-film";
import { ResponsiveDawn } from "./responsive-dawn";

export const BG_CONCEPTS = {
  "1": { name: "Breathing Aurora", node: <BreathingAurora /> },
  "2": { name: "Ambient Film", node: <AmbientFilm /> },
  "3": { name: "Responsive Dawn", node: <ResponsiveDawn /> },
} as const;

export type BgVariant = keyof typeof BG_CONCEPTS;

export function normalizeBg(value?: string): BgVariant {
  return value === "2" || value === "3" ? value : "1";
}

/**
 * Temporary living-background lab. Renders one of three concepts behind the hero,
 * chosen by the `?bg=1|2|3` query param (default: 1). After the founder picks a
 * winner this switch is replaced by the single chosen component.
 */
export function LivingBackground({ variant }: { variant?: string }) {
  return BG_CONCEPTS[normalizeBg(variant)].node;
}
