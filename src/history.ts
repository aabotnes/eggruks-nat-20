import OBR from "@owlbear-rodeo/sdk";
import { Dice, FinishedRoll, isDice, RollValues } from "./nat20";

// Each player writes only their own key, so simultaneous rolls never overwrite each other
export const HISTORY_PREFIX = "com.aabotnes.eggruks-nat-20/history/";
// Room metadata is limited to 16 KB shared by every extension, so keep this small
const MAX_PER_PLAYER = 15;

/** Stored compactly: room metadata space is tight. */
interface StoredRoll {
  k: string; // short hash of the dice ids, to avoid recording the same roll twice
  at: number; // unix seconds
  d: [number, number][]; // [sides, value] per die
  b?: number; // bonus
  s: number | null; // total, null when the dice aren't combined
  m?: "H" | "L"; // highest / lowest (advantage / disadvantage)
}

interface StoredPlayer {
  name: string;
  color: string;
  rolls: StoredRoll[];
}

export interface HistoryEntry {
  playerId: string;
  name: string;
  color: string;
  at: number; // ms
  dice: { sides: number; value: number }[];
  bonus: number;
  total: number | null;
  mode?: "highest" | "lowest";
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Total of a roll, honouring advantage-style combinations and bonuses. */
function evaluate(dice: Dice, values: RollValues): number | null {
  const parts: number[] = [];
  for (const d of dice.dice) {
    const v = isDice(d) ? evaluate(d, values) : values[d.id];
    if (typeof v !== "number") return null;
    parts.push(v);
  }
  let total: number;
  switch (dice.combination) {
    case "HIGHEST":
      total = Math.max(...parts);
      break;
    case "LOWEST":
      total = Math.min(...parts);
      break;
    case "NONE":
      return null;
    default:
      total = parts.reduce((a, b) => a + b, 0);
  }
  return total + (dice.bonus ?? 0);
}

export function toStored(roll: FinishedRoll): StoredRoll {
  const stored: StoredRoll = {
    k: hash(roll.key),
    at: Math.floor(Date.now() / 1000),
    d: roll.dice.map((d) => [parseInt(d.type.slice(1), 10) || 0, d.value]),
    s: evaluate(roll.roll, roll.values),
  };
  if (roll.roll.bonus) stored.b = roll.roll.bonus;
  if (roll.roll.combination === "HIGHEST") stored.m = "H";
  if (roll.roll.combination === "LOWEST") stored.m = "L";
  return stored;
}

/** Append the current player's finished roll to the room history (once per roll). */
export async function recordRoll(roll: FinishedRoll) {
  const [id, name, color, metadata] = await Promise.all([
    OBR.player.getId(),
    OBR.player.getName(),
    OBR.player.getColor(),
    OBR.room.getMetadata(),
  ]);
  const key = HISTORY_PREFIX + id;
  const existing = metadata[key] as StoredPlayer | undefined;
  const stored = toStored(roll);
  if (existing?.rolls[0]?.k === stored.k) return;
  const rolls = [stored, ...(existing?.rolls ?? [])].slice(0, MAX_PER_PLAYER);
  await OBR.room.setMetadata({ [key]: { name, color, rolls } satisfies StoredPlayer });
}

/** All players' rolls from room metadata, newest first. */
export function readHistory(metadata: Record<string, unknown>): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (!key.startsWith(HISTORY_PREFIX) || !value) continue;
    const player = value as StoredPlayer;
    for (const r of player.rolls ?? []) {
      entries.push({
        playerId: key.slice(HISTORY_PREFIX.length),
        name: player.name,
        color: player.color,
        at: r.at * 1000,
        dice: r.d.map(([sides, value]) => ({ sides, value })),
        bonus: r.b ?? 0,
        total: r.s,
        mode: r.m === "H" ? "highest" : r.m === "L" ? "lowest" : undefined,
      });
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}

/** Remove every player's history from the room. */
export async function clearHistory() {
  const metadata = await OBR.room.getMetadata();
  const cleared: Record<string, undefined> = {};
  for (const key of Object.keys(metadata)) {
    if (key.startsWith(HISTORY_PREFIX)) cleared[key] = undefined;
  }
  await OBR.room.setMetadata(cleared);
}
