import OBR from "@owlbear-rodeo/sdk";
import { loadSettings, playSound, saveSettings, Settings, TEST_CHANNEL } from "./settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const soundUrl = $<HTMLInputElement>("soundUrl");
const soundFile = $<HTMLInputElement>("soundFile");
const volume = $<HTMLInputElement>("volume");
const animation = $<HTMLInputElement>("animation");
const rays = $<HTMLInputElement>("rays");
const imageUrl = $<HTMLInputElement>("imageUrl");
const imageFile = $<HTMLInputElement>("imageFile");
const topText = $<HTMLInputElement>("topText");
const bottomText = $<HTMLInputElement>("bottomText");
const who = $<HTMLSelectElement>("who");
const status = $<HTMLDivElement>("status");

function render() {
  const s = loadSettings();
  soundUrl.value = s.soundUrl;
  volume.value = String(s.volume);
  animation.checked = s.animation;
  rays.checked = s.rays;
  imageUrl.value = s.imageUrl;
  topText.value = s.topText;
  bottomText.value = s.bottomText;
  who.value = s.who;
  const notes = [];
  if (s.soundData) notes.push("Using uploaded sound.");
  if (s.imageData) notes.push("Using uploaded image.");
  status.textContent = notes.join(" ");
}

function save(patch: Partial<Settings>) {
  if (!saveSettings(patch)) status.textContent = "Couldn't save. The file is probably too large; try a URL instead.";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

soundUrl.addEventListener("change", () => save({ soundUrl: soundUrl.value.trim() }));
imageUrl.addEventListener("change", () => save({ imageUrl: imageUrl.value.trim() }));
topText.addEventListener("input", () => save({ topText: topText.value }));
bottomText.addEventListener("input", () => save({ bottomText: bottomText.value }));
volume.addEventListener("input", () => save({ volume: Number(volume.value) }));
animation.addEventListener("change", () => save({ animation: animation.checked }));
rays.addEventListener("change", () => save({ rays: rays.checked }));
who.addEventListener("change", () => save({ who: who.value as Settings["who"] }));

soundFile.addEventListener("change", async () => {
  const file = soundFile.files?.[0];
  if (!file) return;
  save({ soundData: await readAsDataUrl(file) });
  render();
});

imageFile.addEventListener("change", async () => {
  const file = imageFile.files?.[0];
  if (!file) return;
  save({ imageData: await readAsDataUrl(file) });
  render();
});

$("clear").addEventListener("click", () => {
  save({ soundData: "", imageData: "" });
  soundFile.value = "";
  imageFile.value = "";
  render();
});

// Outside Owlbear Rodeo, play the animation in a full-page frame over this page
function previewOverlay() {
  const frame = document.createElement("iframe");
  frame.src = `overlay.html?t=${Date.now()}`;
  frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:10;pointer-events:none";
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 4200);
}

// Play the sound here, straight from the click, so the browser doesn't block it
$("test").addEventListener("click", () => {
  const settings = loadSettings();
  playSound(settings).catch((e) => {
    status.textContent = `Couldn't play the sound: ${e instanceof Error ? e.message : e}`;
  });
  if (!settings.animation) return;
  if (OBR.isAvailable && OBR.isReady) {
    // Ask our background script to show the pop-up over the map
    OBR.broadcast.sendMessage(TEST_CHANNEL, {}, { destination: "LOCAL" });
  } else {
    previewOverlay();
  }
});

if (OBR.isAvailable) OBR.onReady(render);
render();
