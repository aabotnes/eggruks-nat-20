import OBR, { buildImage, buildText, Item } from "@owlbear-rodeo/sdk";
import { findCharacter } from "./character";
import { FinishedRoll, isMaxFace } from "./nat20";

// Local items only exist on this client, so each player draws everyone's dice for themselves
const BADGE_KEY = "eggruks-nat-20/roll-badge";
const MAX_DICE = 6; // bigger rolls show nothing
const SHOW_MS = 10000;
const SIZE = 0.4; // die size in grid cells
const IMAGE_PX = 100; // the die SVGs are 100x100

const timers = new Map<string, number>();

/** Face as players read it: the dice extension stores d10 "10" as 0, and d100 faces as 0-90 */
function faceLabel(type: string, value: number, roll: FinishedRoll): string {
  if (type === "D100") return value === 0 ? "00" : String(value);
  // In a percentile roll the d10 is the ones digit, so 0 stays 0
  if (type === "D10" && value === 0) return roll.dice.some((d) => d.type === "D100") ? "0" : "10";
  return String(value);
}

export async function clearRollBadges(playerId: string) {
  window.clearTimeout(timers.get(playerId));
  timers.delete(playerId);
  const items = await OBR.scene.local.getItems((item) => item.metadata[BADGE_KEY] === playerId);
  if (items.length > 0) await OBR.scene.local.deleteItems(items.map((item) => item.id));
}

/** Show a player's roll as small dice above their character token for a few seconds */
export async function showRollBadges(playerId: string, roll: FinishedRoll) {
  if (!(await OBR.scene.isReady())) return;
  await clearRollBadges(playerId);
  const count = roll.dice.length;
  if (count === 0 || count > MAX_DICE) return;

  const token = await findCharacter(playerId);
  if (!token || !token.visible) return;

  const [bounds, dpi] = await Promise.all([OBR.scene.items.getItemBounds([token.id]), OBR.scene.grid.getDpi()]);
  const size = dpi * SIZE;
  const gap = size * 0.15;
  const firstX = bounds.center.x - ((count - 1) * (size + gap)) / 2;
  const y = bounds.min.y - size * 0.7;

  const items: Item[] = [];
  roll.dice.forEach((die, i) => {
    const x = firstX + i * (size + gap);
    const shared = (zIndex: number): Partial<Item> => ({
      attachedTo: token.id,
      // Follow the token around, but don't spin or grow with it
      disableAttachmentBehavior: ["ROTATION", "SCALE", "COPY"],
      metadata: { [BADGE_KEY]: playerId },
      zIndex,
    });

    const image = buildImage(
      {
        url: new URL(`dice/${die.type.toLowerCase()}.svg`, window.location.href).href,
        mime: "image/svg+xml",
        width: IMAGE_PX,
        height: IMAGE_PX,
      },
      { dpi: IMAGE_PX / SIZE, offset: { x: IMAGE_PX / 2, y: IMAGE_PX / 2 } },
    )
      .position({ x, y })
      .layer("ATTACHMENT")
      .locked(true)
      .disableHit(true)
      .build();

    // A triangle's visual centre sits lower than its box centre
    const textY = y - size / 2 + (die.type === "D4" ? size * 0.12 : 0);
    const label = faceLabel(die.type, die.value, roll);
    const text = buildText()
      .textType("PLAIN")
      .plainText(label)
      .width(size)
      .height(size)
      .padding(0)
      .fontSize(size * (label.length > 1 ? 0.36 : 0.44))
      .fontWeight(800)
      .textAlign("CENTER")
      .textAlignVertical("MIDDLE")
      .fillColor(isMaxFace(die.type, die.value) ? "#ffd23f" : "#ffffff")
      .strokeColor("#000000")
      .strokeWidth(size * 0.05)
      .position({ x: x - size / 2, y: textY })
      .layer("TEXT")
      .locked(true)
      .disableHit(true)
      .build();

    items.push(Object.assign(image, shared(i)), Object.assign(text, shared(i)));
  });

  await OBR.scene.local.addItems(items);
  timers.set(
    playerId,
    window.setTimeout(() => clearRollBadges(playerId).catch(() => undefined), SHOW_MS),
  );
}
