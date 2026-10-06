export interface Settings {
  soundUrl: string;
  soundData: string; // uploaded file as a data URL; takes priority over soundUrl
  imageUrl: string;
  imageData: string; // uploaded image as a data URL; takes priority over imageUrl
  topText: string;
  bottomText: string;
  volume: number;
  who: "everyone" | "me";
  animation: boolean;
  rays: boolean;
}

const KEY = "nat20-sound/settings";

const DEFAULTS: Settings = {
  soundUrl: "",
  soundData: "",
  imageUrl: "",
  imageData: "",
  topText: "Much success! Very critical! wow!",
  bottomText: "Eggruk's seal of approval!",
  volume: 0.8,
  who: "everyone",
  animation: true,
  rays: false,
};

export const TEST_CHANNEL = "nat20-sound/test";

// Background, popover and overlay share an origin, so localStorage is shared between them
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadSettings(), ...patch }));
    return true;
  } catch {
    // Usually a quota error from a large upload
    return false;
  }
}

export function soundSource(s: Settings): string {
  return s.soundData || s.soundUrl;
}

export function imageSource(s: Settings): string {
  return s.imageData || s.imageUrl;
}

// Bundled with the extension; plays when no sound is configured
const DEFAULT_SOUND = "sounds/choochoo.mp3";

export function playSound(s: Settings = loadSettings()): Promise<void> {
  const audio = new Audio(soundSource(s) || DEFAULT_SOUND);
  audio.volume = s.volume;
  return audio.play();
}
