import OBR, { Item, Player } from "@owlbear-rodeo/sdk";

// Item metadata marking which player a token belongs to; shared with everyone in the room
export const OWNER_KEY = "eggruks-nat-20/owner";
// Item metadata remembering who owned a token before a player took control of it
const PREVIOUS_OWNER_KEY = "eggruks-nat-20/previousOwner";
// Player metadata: a player's request to set (tokenId) or remove (null) their character
const CLAIM_KEY = "eggruks-nat-20/claim";
// Room metadata: whether claiming a character also gives the player control of the token
export const ALLOW_CONTROL_KEY = "eggruks-nat-20/allowControl";
// Room metadata: the newest claim the GM has handled per player, so claims aren't redone on reload
const HANDLED_KEY = "eggruks-nat-20/claimsHandled";
const MENU_ID = "eggruks-nat-20/character";

interface Claim {
  tokenId: string | null;
  at: number;
}

/** Players may take control of their character only once the GM has switched it on */
export function controlAllowed(roomMetadata: Record<string, unknown>): boolean {
  return roomMetadata[ALLOW_CONTROL_KEY] === true;
}

/**
 * The token a player has marked as their character. Owlbear Rodeo has no built-in link between
 * players and tokens, so if nothing is marked, fall back to the one character token they created.
 */
export async function findCharacter(playerId: string): Promise<Item | undefined> {
  const tokens = await OBR.scene.items.getItems((item) => item.layer === "CHARACTER");
  const marked = tokens.find((t) => t.metadata[OWNER_KEY] === playerId);
  if (marked) return marked;
  const created = tokens.filter((t) => t.createdUserId === playerId && t.metadata[OWNER_KEY] === undefined);
  return created.length === 1 ? created[0] : undefined;
}

/**
 * Make tokenId playerId's character (or clear their character when tokenId is null).
 * With giveControl, the player also becomes the token's owner so they can move it; a token
 * they stop using goes back to whoever owned it before.
 */
async function assignCharacter(playerId: string, tokenId: string | null, giveControl: boolean) {
  const affected = await OBR.scene.items.getItems(
    (item) => item.metadata[OWNER_KEY] === playerId || item.id === tokenId,
  );
  if (affected.length === 0) return;
  await OBR.scene.items.updateItems(affected, (items) => {
    for (const item of items) {
      if (item.id === tokenId) {
        item.metadata[OWNER_KEY] = playerId;
        if (giveControl && item.createdUserId !== playerId) {
          // Keep the original owner, even if another player had claimed it in between
          if (item.metadata[PREVIOUS_OWNER_KEY] === undefined) item.metadata[PREVIOUS_OWNER_KEY] = item.createdUserId;
          item.createdUserId = playerId;
        }
      } else {
        // The player's previous character: unmark it and hand control back
        delete item.metadata[OWNER_KEY];
        const previous = item.metadata[PREVIOUS_OWNER_KEY];
        if (typeof previous === "string" && item.createdUserId === playerId) item.createdUserId = previous;
        delete item.metadata[PREVIOUS_OWNER_KEY];
      }
    }
  });
}

/** Right-click a token to set (or remove) it as your character */
export async function setupCharacterMenu(myId: string) {
  const icon = new URL("icon.svg", window.location.href).pathname;
  const onCharacter = { key: "layer", value: "CHARACTER" };
  await OBR.contextMenu.create({
    id: MENU_ID,
    // The first icon whose filter matches is shown
    icons: [
      {
        icon,
        label: "Remove as my character",
        filter: { min: 1, max: 1, every: [onCharacter, { key: ["metadata", OWNER_KEY], value: myId }] },
      },
      { icon, label: "Set as my character", filter: { min: 1, max: 1, every: [onCharacter] } },
    ],
    async onClick(context) {
      const token = context.items[0];
      const tokenId = token.metadata[OWNER_KEY] === myId ? null : token.id;
      if ((await OBR.player.getRole()) === "GM") {
        // The GM can edit any token, and already controls everything
        await assignCharacter(myId, tokenId, false);
      } else {
        // Players usually can't edit tokens they don't own, so ask the GM's extension to do it
        await OBR.player.setMetadata({ [CLAIM_KEY]: { tokenId, at: Date.now() } satisfies Claim });
      }
    },
  });
}

/**
 * Runs in the GM's background page: carry out players' character requests, giving them
 * control of the token when the room allows it.
 */
export function handleCharacterClaims() {
  let busy = Promise.resolve();

  async function process(players: Player[]) {
    if (!(await OBR.scene.isReady())) return;
    const room = await OBR.room.getMetadata();
    const handled = { ...((room[HANDLED_KEY] as Record<string, number> | undefined) ?? {}) };
    const giveControl = controlAllowed(room);
    let changed = false;
    for (const player of players) {
      const claim = player.metadata[CLAIM_KEY] as Claim | undefined;
      if (!claim || typeof claim.at !== "number" || claim.at <= (handled[player.id] ?? 0)) continue;
      await assignCharacter(player.id, claim.tokenId, giveControl);
      handled[player.id] = claim.at;
      changed = true;
    }
    if (changed) await OBR.room.setMetadata({ [HANDLED_KEY]: handled });
  }

  // Handle one batch at a time so two quick claims can't interleave
  const run = (players: Player[]) => {
    busy = busy
      .then(() => process(players))
      .catch((e) => console.warn("[nat20-sound] could not assign character", JSON.stringify(e)));
  };

  OBR.party.getPlayers().then(run);
  OBR.party.onChange(run);
  // Claims made while no scene was open are handled once one opens
  OBR.scene.onReadyChange(async (ready) => {
    if (ready) run(await OBR.party.getPlayers());
  });
}
