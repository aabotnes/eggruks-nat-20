"""Builds the Eggruk pop-up images into public/eggruk/.

Props are drawn as vector shapes in Eggruk's palette and outline style,
rendered to pixels and composited onto the original art as WebP.
Needs: pip install pillow resvg-py
Run from the nat20-sound folder:  python art/build_eggruk.py
"""

import io
import shutil
from pathlib import Path

import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "eggruk.webp"
OUT = ROOT / "public" / "eggruk"

INK = "#312000"  # Eggruk's outline colour

DEFS = f"""
<defs>
  <radialGradient id="shell" cx="0.38" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#fffdf4"/>
    <stop offset="0.55" stop-color="#f3ead2"/>
    <stop offset="1" stop-color="#d8c79d"/>
  </radialGradient>
</defs>
"""


def zigzag(x0: float, x1: float, teeth: int, y_hi: float, y_lo: float) -> str:
    """Jagged broken-shell rim from x1 back to x0."""
    pts = []
    for i in range(teeth + 1):
        x = x1 - (x1 - x0) * i / teeth
        y = y_lo if i % 2 else y_hi
        # Vary the teeth a little so it looks hand-cracked
        y += (-6, 4, -2, 7, -4, 2)[i % 6]
        pts.append(f"L{x:.1f} {y:.1f}")
    return " ".join(pts)


HELMET = f"""
<g transform="rotate(-7 585 205)" stroke="{INK}" stroke-linejoin="round" stroke-linecap="round">
  <!-- Shell, top half of an egg with a cracked rim -->
  <path d="M478 198 A107 165 0 0 1 692 198 {zigzag(478, 692, 14, 196, 216)} Z"
        fill="url(#shell)" stroke-width="8"/>
  <!-- Speckles -->
  <g fill="#b49a62" stroke="none" opacity="0.8">
    <ellipse cx="545" cy="90" rx="6" ry="4"/>
    <ellipse cx="620" cy="70" rx="4" ry="3"/>
    <ellipse cx="650" cy="140" rx="6" ry="4"/>
    <ellipse cx="520" cy="160" rx="4" ry="3"/>
    <ellipse cx="590" cy="125" rx="3" ry="2"/>
  </g>
  <!-- Highlight -->
  <path d="M528 120 Q540 70 585 52" fill="none" stroke="#fff" stroke-width="9" opacity="0.85"/>
  <!-- Cracks running up from the rim -->
  <path d="M612 206 L620 178 L608 160 L622 132" fill="none" stroke-width="4"/>
  <path d="M520 202 L528 184 L518 170" fill="none" stroke-width="4"/>
  <path d="M660 200 L654 186 L664 174" fill="none" stroke-width="3.5"/>
  <!-- Yolk dribbling down the side of his head -->
  <path d="M664 210 Q676 212 678 230 Q680 252 672 262 Q664 268 662 254 Q660 240 652 232 Q646 216 664 210 Z"
        fill="#ffc21a" stroke-width="5"/>
  <ellipse cx="664" cy="228" rx="4" ry="6" fill="#fff3b0" stroke="none"/>
</g>
"""

def build(name: str, overlay: str):
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
{DEFS}
{overlay}
</svg>"""
    props = Image.open(io.BytesIO(bytes(resvg_py.svg_to_bytes(svg_string=svg)))).convert("RGBA")
    base = Image.open(SRC).convert("RGBA")
    Image.alpha_composite(base, props).save(OUT / name, "WEBP", quality=90, method=6)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC, OUT / "eggruk.webp")
    build("eggruk-helmet.webp", HELMET)
    for f in sorted(OUT.iterdir()):
        print(f"{f.name}: {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
