export const SLOTS = ["top", "bottom", "outerwear", "shoes", "accessory"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  top: "Tops",
  bottom: "Bottoms",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessories",
};

export const SUGGESTION_SLOT_RULES: Record<Slot, { min: number; max: number }> = {
  top: { min: 1, max: 2 },
  bottom: { min: 1, max: 1 },
  shoes: { min: 1, max: 1 },
  outerwear: { min: 0, max: 1 },
  accessory: { min: 0, max: 2 },
};

const RULE_NOUN: Record<Slot, [string, string]> = {
  top: ["top", "tops"],
  bottom: ["bottom", "bottoms"],
  shoes: ["pair of shoes", "pairs of shoes"],
  outerwear: ["outer layer", "outer layers"],
  accessory: ["accessory", "accessories"],
};

export function suggestionSlotError(counts: Partial<Record<Slot, number>>): string | null {
  for (const slot of SLOTS) {
    const rule = SUGGESTION_SLOT_RULES[slot];
    const count = counts[slot] ?? 0;
    const [one, many] = RULE_NOUN[slot];
    if (count < rule.min) {
      return rule.min === 1 ? `Add a ${one}.` : `Add ${rule.min} ${many}.`;
    }
    if (count > rule.max) {
      return rule.max === 1 ? `Use at most one ${one}.` : `Use at most ${rule.max} ${many}.`;
    }
  }
  return null;
}

export function isSlot(value: string): value is Slot {
  return (SLOTS as readonly string[]).includes(value);
}
