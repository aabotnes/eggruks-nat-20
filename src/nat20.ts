// Shapes match the official Owlbear Rodeo Dice extension (github.com/owlbear-rodeo/dice)
export const ROLL_KEY = "rodeo.owlbear.dice/roll";
export const VALUES_KEY = "rodeo.owlbear.dice/rollValues";

interface Die {
  id: string;
  type: string; // "D4" | "D6" | "D8" | "D10" | "D12" | "D20" | "D100"
}

interface Dice {
  dice: (Die | Dice)[];
  hidden?: boolean;
}

type RollValues = Record<string, number | null>;

function isDice(value: unknown): value is Dice {
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
 * Returns a key identifying a finished roll that contains a natural 20,
 * or null if the roll is still in progress, hidden, or has no nat 20.
 */
export function nat20RollKey(metadata: Record<string, unknown>): string | null {
  const roll = metadata[ROLL_KEY];
  const values = metadata[VALUES_KEY] as RollValues | undefined;
  if (!isDice(roll) || !values) return null;

  const dice = collectDice(roll);
  if (dice.length === 0) return null;
  // Wait until every die has settled
  if (dice.some((d) => values[d.id] === null || values[d.id] === undefined)) return null;

  const hasNat20 = dice.some((d) => d.type === "D20" && values[d.id] === 20);
  return hasNat20 ? dice.map((d) => d.id).join(",") : null;
}
