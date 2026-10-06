# Eggruks Nat 20

An [Owlbear Rodeo](https://www.owlbear.rodeo) extension. Whenever anyone rolls a natural 20 with the official Dice extension, Eggruk pops up on every player's screen with a choo choo. It also keeps a shared roll history for the table.

![Eggruks Nat 20](docs/hero.jpg)

## Install

1. In Owlbear Rodeo, open your [profile](https://www.owlbear.rodeo/profile) and click **Add Extension**.
2. Paste `https://aabotnes.github.io/eggruks-nat-20/manifest.json`
3. Enable **Eggruks Nat 20** and the official **Dice** extension in your room.

Everyone in the room gets it automatically; players don't need to install anything.

## Using it

Click the d20 icon in the top left of a room:

- **Roll history**: the latest rolls from every player, in dice notation, with natural 20s and 1s highlighted. Stored in the room; the GM can clear it.
- **Settings**: per-player sound, volume, pop-up image and captions, and whether to celebrate everyone's nat 20s or only your own. Use **Test** to preview.

Hidden rolls are never shown or celebrated.

## Development

```bash
npm install
npm run dev
```

Add `http://localhost:5173/eggruks-nat-20/manifest.json` as an extension in Owlbear Rodeo to test locally. Pushing to `main` deploys to GitHub Pages.

`art/build_eggruk.py` regenerates the egg-helmet variant of Eggruk (`pip install pillow resvg-py`).
