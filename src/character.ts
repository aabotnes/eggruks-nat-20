import OBR, { Item } from "@owlbear-rodeo/sdk";

// Item metadata marking which player a token belongs to; shared with everyone in the room
export const OWNER_KEY = "eggruks-nat-20/owner";
const MENU_ID = "eggruks-nat-20/character";

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

/** Right-click a token to set (or remove) it as your character */
export function setupCharacterMenu(myId: string) {
  const icon = new URL("icon.svg", window.location.href).pathname;
  const onCharacter = { key: "layer", value: "CHARACTER" };
  return OBR.contextMenu.create({
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
      const removing = token.metadata[OWNER_KEY] === myId;
      // Each player has one character, so unmark any other token we claimed
      const claimed = await OBR.scene.items.getItems((item) => item.metadata[OWNER_KEY] === myId);
      const ids = [...new Set([...claimed.map((item) => item.id), token.id])];
      await OBR.scene.items.updateItems(ids, (items) => {
        for (const item of items) {
          if (item.id === token.id && !removing) item.metadata[OWNER_KEY] = myId;
          else delete item.metadata[OWNER_KEY];
        }
      });
    },
  });
}
