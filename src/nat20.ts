// Shapes match the official Owlbear Rodeo Dice extension (github.com/owlbear-rodeo/dice)
export const ROLL_KEY = "rodeo.owlbear.dice/roll";
export const VALUES_KEY = "rodeo.owlbear.dice/rollValues";

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

  return {
    key: dice.map((d) => d.id).join(","),
    roll,
    values,
    dice: dice.map((d) => ({ type: d.type, value: values[d.id] as number })),
  };
}

/** Key of a finished roll that contains a natural 20, otherwise null. */
export function nat20RollKey(metadata: Record<string, unknown>): string | null {
  const roll = finishedRoll(metadata);
  return roll && roll.dice.some((d) => d.type === "D20" && d.value === 20) ? roll.key : null;
}
