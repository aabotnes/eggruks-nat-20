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

export function isMaxFace(type: string, value: number): boolean {
  return type in MAX_FACE && value === MAX_FACE[type];
}

function isDie(value: Die | Dice): value is Die {
  return !isDice(value) && !!value && typeof value.id === "string";
}

/** Same rule the dice extension uses to combine a percentile roll: exactly one d100 and one d10, summed */
function percentilePair(group: Dice): [Die, Die] | null {
  if (group.dice.length !== 2 || (group.combination ?? "SUM") !== "SUM") return null;
  const dice = group.dice.filter(isDie);
  const d100 = dice.find((d) => d.type === "D100");
  const d10 = dice.find((d) => d.type === "D10");
  return d100 && d10 ? [d100, d10] : null;
}

/** A percentile roll's result: 00 + 0 is 100 */
function percentileValue([d100, d10]: [Die, Die], values: RollValues): number {
  const tens = values[d100.id] as number;
  const ones = values[d10.id] as number;
  return tens === 0 && ones === 0 ? 100 : tens + ones;
}

/** A lone die's value as players read it: the dice extension stores a d10's "10" face as 0 */
function dieValue(d: Die, values: RollValues): number {
  const v = values[d.id] as number;
  return d.type === "D10" && v === 0 ? 10 : v;
}

/** Value of a die or group before its own bonus is added. Mirrors the dice extension's getCombinedDiceValue. */
export function combinedValue(dice: Dice, values: RollValues): number | null {
  const bonus = dice.bonus ?? 0;
  const pair = percentilePair(dice);
  if (pair) return percentileValue(pair, values) + bonus;
  const parts = dice.dice.map((d) => (isDice(d) ? combinedValue(d, values) : dieValue(d, values)));
  if (parts.some((v) => typeof v !== "number" || Number.isNaN(v))) return null;
  const nums = parts as number[];
  switch (dice.combination) {
    case "HIGHEST":
      return Math.max(...nums) + bonus;
    case "LOWEST":
      return Math.min(...nums) + bonus;
    case "NONE":
      return null;
    default:
      return nums.reduce((a, b) => a + b, 0) + bonus;
  }
}

/** The die or group that a highest/lowest group keeps, e.g. the better d20 when rolling with advantage */
function keptPart(group: Dice, values: RollValues): Die | Dice | undefined {
  const scored = group.dice.map((d) => ({ d, v: isDice(d) ? combinedValue(d, values) : dieValue(d, values) }));
  const pick = group.combination === "HIGHEST" ? Math.max : Math.min;
  const best = pick(...scored.map((s) => s.v ?? NaN));
  return scored.find((s) => s.v === best)?.d;
}

/**
 * Collect the die types that rolled their maximum, treating a d100 + d10 pair as one percentile roll.
 * In a highest/lowest group only the kept die counts, so a 20 dropped by disadvantage isn't a nat 20.
 */
function collectMaxed(group: Dice, values: RollValues, out: Set<DieType>) {
  const pair = percentilePair(group);
  if (pair) {
    if (percentileValue(pair, values) === 100) out.add("D100");
    return;
  }
  let parts = group.dice;
  if (group.combination === "HIGHEST" || group.combination === "LOWEST") {
    const kept = keptPart(group, values);
    parts = kept ? [kept] : [];
  }
  for (const d of parts) {
    if (isDice(d)) collectMaxed(d, values, out);
    else if (isDie(d) && isMaxFace(d.type, values[d.id] as number)) out.add(d.type as DieType);
  }
}

/** Every die as players read it, with a percentile pair merged into a single d100 */
export function readFaces(group: Dice, values: RollValues, out: { sides: number; value: number }[] = []) {
  const pair = percentilePair(group);
  if (pair) {
    out.push({ sides: 100, value: percentileValue(pair, values) });
    return out;
  }
  for (const d of group.dice) {
    if (isDice(d)) readFaces(d, values, out);
    else if (isDie(d)) out.push({ sides: parseInt(d.type.slice(1), 10) || 0, value: dieValue(d, values) });
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
