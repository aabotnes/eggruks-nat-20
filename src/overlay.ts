import { imageSource, loadSettings } from "./settings";

const PARTICLES = ["😂", "🔥", "💯", "🎲", "😎", "‼️", "👌", "💥", "🤯", "🗿"];
const PARTICLE_COUNT = 40;

function starPoints(): string {
  return Array.from({ length: 32 }, (_, i) => {
    const r = i % 2 ? 130 : 190;
    const a = (i / 32) * Math.PI * 2;
    return `${(200 + r * Math.cos(a)).toFixed(1)},${(200 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

// Eggruk himself; one is picked at random for each nat 20
const EGGRUK_IMAGES = ["eggruk/eggruk.webp", "eggruk/eggruk-helmet.webp"];

// Fallback if an image fails to load: a "NAT 20!" starburst
const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs><radialGradient id="g"><stop offset="0" stop-color="#fff6a0"/><stop offset=".6" stop-color="#ffc400"/><stop offset="1" stop-color="#ff6a00"/></radialGradient></defs>
  <polygon fill="url(#g)" stroke="#7a2e00" stroke-width="8" stroke-linejoin="round" points="${starPoints()}"/>
  <text x="200" y="185" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="72" fill="#c40000" stroke="#fff" stroke-width="4" paint-order="stroke">NAT</text>
  <text x="200" y="275" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="110" fill="#c40000" stroke="#fff" stroke-width="5" paint-order="stroke">20!</text>
</svg>`);

// Spray emojis out from the centre of the screen
function burst() {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const el = document.createElement("div");
    el.className = "particle";
    el.textContent = PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
    document.body.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 45; // vmax
    const spin = (Math.random() - 0.5) * 1080;
    const delay = 120 + Math.random() * 900;
    el.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2) rotate(0deg)", opacity: 1 },
        // Stay fully opaque for most of the flight, then fade out at the edges
        { opacity: 1, offset: 0.75 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * dist}vmax), calc(-50% + ${Math.sin(angle) * dist}vmax)) scale(${1 + Math.random() * 1.5}) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      { duration: 1600 + Math.random() * 1200, delay, easing: "cubic-bezier(.1,.8,.3,1)", fill: "both" },
    );
  }
}

// Shrink a caption until it fits the screen, leaving room for the wobble
function fitCaption(el: HTMLElement) {
  const maxWidth = window.innerWidth * 0.75;
  const width = el.scrollWidth;
  if (width > maxWidth) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${(size * maxWidth) / width}px`;
  }
}

const settings = loadSettings();
if (!settings.rays) document.getElementById("rays")!.remove();
for (const [id, text] of [["top", settings.topText], ["bottom", settings.bottomText]]) {
  const el = document.getElementById(id)!;
  el.textContent = text;
  fitCaption(el);
}

const img = document.getElementById("pop") as HTMLImageElement;
img.onerror = () => {
  if (img.src !== FALLBACK_IMAGE) img.src = FALLBACK_IMAGE;
};
img.onload = () => {
  document.getElementById("stage")!.classList.add("go");
  burst();
};
img.src = imageSource(settings) || EGGRUK_IMAGES[Math.floor(Math.random() * EGGRUK_IMAGES.length)];
