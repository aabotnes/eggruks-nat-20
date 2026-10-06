import OBR from "@owlbear-rodeo/sdk";
import { clearHistory, HistoryEntry, readHistory } from "./history";

const SHOW_MAX = 60;
const TAB_KEY = "nat20-sound/tab";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const list = $<HTMLUListElement>("historyList");

// --- Tabs -------------------------------------------------------------------

const tabs = [
  { tab: $("tabHistory"), panel: $("panelHistory") },
  { tab: $("tabSettings"), panel: $("panelSettings") },
];

function selectTab(id: string) {
  for (const { tab, panel } of tabs) {
    const selected = tab.id === id;
    tab.setAttribute("aria-selected", String(selected));
    panel.hidden = !selected;
  }
  try {
    localStorage.setItem(TAB_KEY, id);
  } catch {
    // Remembering the tab is only a convenience
  }
}

for (const { tab } of tabs) tab.addEventListener("click", () => selectTab(tab.id));
try {
  const saved = localStorage.getItem(TAB_KEY);
  if (saved && tabs.some((t) => t.tab.id === saved)) selectTab(saved);
} catch {
  // Fall back to the default tab
}

// --- Rendering --------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function timeAgo(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(at).toLocaleDateString();
}

/** Whether the d20s in this roll count as a natural 20 or a natural 1. */
function d20Result(entry: HistoryEntry): "crit" | "fumble" | null {
  const d20s = entry.dice.filter((d) => d.sides === 20).map((d) => d.value);
  if (d20s.length === 0) return null;
  // With advantage only the best die counts, with disadvantage only the worst
  const counted = entry.mode === "highest" ? Math.max(...d20s) : entry.mode === "lowest" ? Math.min(...d20s) : null;
  const has = (v: number) => (counted === null ? d20s.includes(v) : counted === v);
  if (has(20)) return "crit";
  if (has(1)) return "fumble";
  return null;
}

function renderEntry(entry: HistoryEntry): HTMLLIElement {
  const result = d20Result(entry);
  const li = el("li", `roll${result ? ` is-${result}` : ""}`);

  const bar = el("span", "bar");
  bar.style.background = entry.color;

  const who = el("span", "who", entry.name);
  if (result === "crit") who.append(el("span", "badge crit", "NAT 20"));
  if (result === "fumble") who.append(el("span", "badge fumble", "NAT 1"));

  const total = el("span", "total", entry.total === null ? "–" : String(entry.total));

  // e.g. "d20 20 14 · d6 3 · +5 · adv · 2m ago"
  const detail = el("span", "detail");
  const groups = new Map<number, number[]>();
  for (const d of entry.dice) groups.set(d.sides, [...(groups.get(d.sides) ?? []), d.value]);
  const parts: (string | HTMLElement)[] = [];
  for (const [sides, values] of groups) {
    const group = el("span");
    group.append(`d${sides} `);
    values.forEach((v, i) => {
      const cls = sides === 20 && v === 20 ? "die crit" : sides === 20 && v === 1 ? "die fumble" : "die";
      group.append(el("span", cls, String(v)));
      if (i < values.length - 1) group.append(" ");
    });
    parts.push(group);
  }
  if (entry.bonus) parts.push(entry.bonus > 0 ? `+${entry.bonus}` : String(entry.bonus));
  if (entry.mode === "highest") parts.push("adv");
  if (entry.mode === "lowest") parts.push("dis");
  parts.push(el("span", "when", timeAgo(entry.at)));
  parts.forEach((p, i) => {
    detail.append(p);
    if (i < parts.length - 1) detail.append(" · ");
  });

  li.append(bar, who, total, detail);
  return li;
}

let current: HistoryEntry[] = [];

function render(entries: HistoryEntry[] = current) {
  current = entries;
  list.replaceChildren();
  if (entries.length === 0) {
    list.append(el("li", "empty", "No rolls yet. Roll some dice!"));
    return;
  }
  for (const entry of entries.slice(0, SHOW_MAX)) list.append(renderEntry(entry));
}

// Keep the "2m ago" labels fresh
window.setInterval(() => render(), 30_000);

// --- Data -------------------------------------------------------------------

function demoHistory(): HistoryEntry[] {
  const now = Date.now();
  const players = [
    { playerId: "a", name: "Eggruk", color: "#7bc043" },
    { playerId: "b", name: "Mira the Bard", color: "#e05fc4" },
    { playerId: "c", name: "GM", color: "#4f8ff7" },
  ];
  return [
    { ...players[0], at: now - 5_000, dice: [{ sides: 20, value: 20 }], bonus: 7, total: 27 },
    { ...players[1], at: now - 70_000, dice: [{ sides: 20, value: 14 }, { sides: 20, value: 6 }], bonus: 3, total: 17, mode: "highest" },
    { ...players[2], at: now - 180_000, dice: [{ sides: 6, value: 4 }, { sides: 6, value: 2 }, { sides: 6, value: 6 }], bonus: 0, total: 12 },
    { ...players[1], at: now - 420_000, dice: [{ sides: 20, value: 1 }], bonus: 3, total: 4 },
    { ...players[0], at: now - 3_900_000, dice: [{ sides: 8, value: 5 }, { sides: 4, value: 3 }], bonus: 2, total: 10 },
  ];
}

const clearButton = $<HTMLButtonElement>("clearHistory");
let confirmTimer: number | undefined;

// Two clicks to clear, since it wipes everyone's history
clearButton.addEventListener("click", () => {
  if (!confirmTimer) {
    clearButton.textContent = "Click again to clear everyone's history";
    confirmTimer = window.setTimeout(() => {
      clearButton.textContent = "Clear history";
      confirmTimer = undefined;
    }, 3000);
    return;
  }
  window.clearTimeout(confirmTimer);
  confirmTimer = undefined;
  clearButton.textContent = "Clear history";
  clearHistory().catch((e) => console.warn("[nat20-sound] could not clear history", e));
});

if (OBR.isAvailable) {
  OBR.onReady(async () => {
    render(readHistory(await OBR.room.getMetadata()));
    OBR.room.onMetadataChange((metadata) => render(readHistory(metadata)));
    // Only the GM can wipe the shared history
    $("historyActions").hidden = (await OBR.player.getRole()) !== "GM";
  });
} else {
  $("historyNote").textContent = "Preview with example rolls. Open the extension in Owlbear Rodeo to see your room's history.";
  render(demoHistory());
}
