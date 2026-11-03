import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { recordRoll } from "./history";
import { findCharacter, setupCharacterMenu } from "./character";
import { DieType, finishedRoll } from "./nat20";
import { showRollBadges } from "./rollBadges";
import { DEFAULT_TOP_TEXT, loadSettings, playSound, Settings, TEST_CHANNEL } from "./settings";

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

/** Size of the area to cover. The viewport API only works while a scene is open. */
async function screenSize(): Promise<[number, number]> {
  try {
    return await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  } catch {
    // No scene: fall back to the screen size, which this hidden background page can still read
    return [window.screen.availWidth, window.screen.availHeight];
  }
}

/** The image of a player's character token, if they have one the table can see */
async function tokenImage(playerId: string): Promise<string | undefined> {
  if (!(await OBR.scene.isReady())) return undefined;
  const token = await findCharacter(playerId);
  // A token the GM has hidden would give away that it's on the map
  return token && token.visible && isImage(token) ? token.image.url : undefined;
}

async function showOverlay(settings: Settings, playerId: string, top?: string) {
  const query = new URLSearchParams({ t: String(Date.now()) });
  if (settings.tokenImage) {
    const image = await tokenImage(playerId).catch(() => undefined);
    if (image) query.set("img", image);
  }
  if (top !== undefined) query.set("top", top);
  const [width, height] = await screenSize();
  window.clearTimeout(overlayTimer);
  // Closing a popover that isn't open may reject; that's fine
  await OBR.popover.close(OVERLAY_ID).catch(() => undefined);
  await OBR.popover.open({
    id: OVERLAY_ID,
    // Root-relative path (e.g. /eggruks-nat-20/overlay.html); OBR resolves it against our origin
    url: `${new URL("overlay.html", window.location.href).pathname}?${query}`,
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
  overlayTimer = window.setTimeout(() => OBR.popover.close(OVERLAY_ID).catch(() => undefined), ANIMATION_MS);
}

const SIDES: Record<DieType, number> = { D4: 4, D6: 6, D8: 8, D10: 10, D12: 12, D20: 20, D100: 100 };

function celebrate(settings: Settings, playerId: string, crits: DieType[]) {
  playSound(settings).catch((e) => console.warn("[nat20-sound] could not play sound", describe(e)));
  const nat20 = crits.includes("D20");
  // By default the pop-up is reserved for nat 20s and other crits just get the sound
  if (!settings.animation || !(nat20 || settings.popupAllCrits)) return;
  // The default "NAT 20" caption would be wrong for other dice, so say which one maxed instead
  const top =
    nat20 || settings.topText !== DEFAULT_TOP_TEXT ? undefined : `NAT ${Math.max(...crits.map((type) => SIDES[type]))}`;
  showOverlay(settings, playerId, top).catch((e) => console.warn("[nat20-sound] could not show animation", describe(e)));
}

function check(playerId: string, metadata: Record<string, unknown>, isMe: boolean, initial: boolean) {
  const roll = finishedRoll(metadata);
  if (!roll) {
    lastRoll.delete(playerId);
    return;
  }
  if (lastRoll.get(playerId) === roll.key) return;
  lastRoll.set(playerId, roll.key);
  // Don't fire for rolls that were already on the table when we loaded
  if (initial) return;

  const settings = loadSettings();
  if (settings.rollBadges) {
    showRollBadges(playerId, roll).catch((e) => console.warn("[nat20-sound] could not show dice on token", describe(e)));
  }
  if (!isMe && settings.who === "me") return;
  const crits = [...roll.maxed].filter((type) => settings.critDice[type]);
  if (crits.length > 0) celebrate(settings, playerId, crits);
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
  setupCharacterMenu(myId).catch((e) => console.warn("[nat20-sound] could not add character menu", describe(e)));
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
    showOverlay(loadSettings(), myId).catch((e) => console.warn("[nat20-sound] could not show animation", describe(e)));
  });
});
