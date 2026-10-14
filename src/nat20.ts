// Shapes match the official Owlbear Rodeo Dice extension (github.com/owlbear-rodeo/dice)
export const ROLL_KEY = "rodeo.owlbear.dice/roll";
export const VALUES_KEY = "rodeo.owlbear.dice/rollValues";

export const DIE_TYPES = ["D4", "D6", "D8", "D10", "D12", "D20", "D100"] as const;
export type DieType = (typeof DIE_TYPES)[number];

export interface Die {
  id: string;
  type: string; // "D4" | "D6" | "D8" | "D10" | "D12" | "D20" | "D100"
}

export interface Dice {
  dice: (Die | Dice)[];
  combination?: "HIGHEST" | "LOWEST" | "SUM" | "NONE";
  bonus?: number;
  hidden?: boolean;
}

export type RollValues = Record<string, number | null>;

export interface FinishedRoll {
  key: string; // identifies this particular roll
  roll: Dice;
  values: RollValues;
  dice: { type: string; value: number }[];
  maxed: Set<DieType>; // die types that rolled their maximum
}

export function isDice(value: unknown): value is Dice {
  return typeof value === "object" && value !== null && Array.isArray((value as Dice).dice);
}

function collectDice(roll: Dice, out: Die[] = []): Die[] {
  for (const d of roll.dice) {
    if (isDice(d)) collectDice(d, out);
    else if (d && typeof d.id === "string") out.push(d);
  }
  return out;
}

// Raw face value that counts as the maximum. The dice extension stores a d10's "10" face as 0;
// a lone d100 (tens die) tops out at 90
const MAX_FACE: Record<string, number> = { D4: 4, D6: 6, D8: 8, D10: 0, D12: 12, D20: 20, D100: 90 };

/** Collect the die types that rolled their maximum, treating a d100 + d10 pair as one percentile roll */
function collectMaxed(group: Dice, values: RollValues, out: Set<DieType>) {
  const dice = group.dice.filter((d): d is Die => !isDice(d) && !!d && typeof d.id === "string");
  const d100 = dice.filter((d) => d.type === "D100");
  const d10 = dice.filter((d) => d.type === "D10");
  // Same rule the dice extension uses to combine a percentile roll: exactly one d100 and one d10, summed
  const percentile =
    group.dice.length === 2 && d100.length === 1 && d10.length === 1 && (group.combination ?? "SUM") === "SUM";

  if (percentile) {
    // 00 + 0 is a roll of 100
    if (values[d100[0].id] === 0 && values[d10[0].id] === 0) out.add("D100");
  } else {
    for (const d of dice) {
      if (d.type in MAX_FACE && values[d.id] === MAX_FACE[d.type]) out.add(d.type as DieType);
    }
  }
  for (const d of group.dice) if (isDice(d)) collectMaxed(d, values, out);
}

/**
 * Returns a player's latest roll once every die has settled,
 * or null if it's still rolling, hidden, or there is no roll.
 */
export function finishedRoll(metadata: Record<string, unknown>): FinishedRoll | null {
  const roll = metadata[ROLL_KEY];
  const values = metadata[VALUES_KEY] as RollValues | undefined;
  if (!isDice(roll) || !values) return null;

  const dice = collectDice(roll);
  if (dice.length === 0) return null;
  if (dice.some((d) => typeof values[d.id] !== "number")) return null;

  const maxed = new Set<DieType>();
  collectMaxed(roll, values, maxed);
  return {
    key: dice.map((d) => d.id).join(","),
    roll,
    values,
    dice: dice.map((d) => ({ type: d.type, value: values[d.id] as number })),
    maxed,
  };
}
