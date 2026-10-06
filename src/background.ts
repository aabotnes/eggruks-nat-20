import OBR from "@owlbear-rodeo/sdk";
import { recordRoll } from "./history";
import { finishedRoll, nat20RollKey } from "./nat20";
import { loadSettings, playSound, TEST_CHANNEL } from "./settings";

const OVERLAY_ID = "nat20-sound/overlay";
const ANIMATION_MS = 4200;

// Last celebrated roll per player, so metadata re-syncs don't retrigger
const lastRoll = new Map<string, string>();
let overlayTimer: number | undefined;

// OBR wraps errors as { error: { name, message } }, which logs as an unreadable object
function describe(e: unknown): string {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function showOverlay() {
  const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  window.clearTimeout(overlayTimer);
  // Closing a popover that isn't open may reject; that's fine
  await OBR.popover.close(OVERLAY_ID).catch(() => undefined);
  await OBR.popover.open({
    id: OVERLAY_ID,
    // Root-relative path (e.g. /eggruks-nat-20/overlay.html); OBR resolves it against our origin
    url: `${new URL("overlay.html", window.location.href).pathname}?t=${Date.now()}`,
    width,
    height,
    anchorReference: "POSITION",
    anchorPosition: { left: width / 2, top: height / 2 },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });
  overlayTimer = window.setTimeout(() => OBR.popover.close(OVERLAY_ID), ANIMATION_MS);
}

function celebrate() {
  const settings = loadSettings();
  playSound(settings).catch((e) => console.warn("[nat20-sound] could not play sound", describe(e)));
  if (settings.animation) {
    showOverlay().catch((e) => console.warn("[nat20-sound] could not show animation", describe(e)));
  }
}

function check(playerId: string, metadata: Record<string, unknown>, isMe: boolean, initial: boolean) {
  const key = nat20RollKey(metadata);
  if (!key) {
    lastRoll.delete(playerId);
    return;
  }
  if (lastRoll.get(playerId) === key) return;
  lastRoll.set(playerId, key);
  // Don't fire for rolls that were already on the table when we loaded
  if (initial) return;
  if (!isMe && loadSettings().who === "me") return;
  celebrate();
}

// Each player records their own rolls into the shared room history
let lastRecorded: string | undefined;
function recordMine(metadata: Record<string, unknown>) {
  const roll = finishedRoll(metadata);
  if (!roll || roll.key === lastRecorded) return;
  lastRecorded = roll.key;
  recordRoll(roll).catch((e) => console.warn("[nat20-sound] could not record roll", describe(e)));
}

OBR.onReady(async () => {
  const myId = await OBR.player.getId();
  const myMetadata = await OBR.player.getMetadata();
  check(myId, myMetadata, true, true);
  recordMine(myMetadata);
  for (const p of await OBR.party.getPlayers()) check(p.id, p.metadata, false, true);

  OBR.player.onChange((me) => {
    check(myId, me.metadata, true, false);
    recordMine(me.metadata);
  });
  OBR.party.onChange((players) => {
    for (const p of players) check(p.id, p.metadata, false, false);
  });

  // The popover's Test button plays the sound itself; we just show the animation
  OBR.broadcast.onMessage(TEST_CHANNEL, () => {
    showOverlay().catch((e) => console.warn("[nat20-sound] could not show animation", describe(e)));
  });
});
