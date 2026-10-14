import { DieType } from "./nat20";

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
  critDice: Record<DieType, boolean>; // which dice play the sound when they roll their max
}

const KEY = "nat20-sound/settings";

const DEFAULTS: Settings = {
  soundUrl: "",
  soundData: "",
  imageUrl: "",
  imageData: "",
  topText: "NAT 20",
  bottomText: "",
  volume: 0.8,
  who: "everyone",
  animation: true,
  rays: false,
  critDice: { D4: true, D6: true, D8: true, D10: true, D12: true, D20: true, D100: true },
};

export const TEST_CHANNEL = "nat20-sound/test";

// Background, popover and overlay share an origin, so localStorage is shared between them
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    // Merge per die, so settings saved before a die was added still get its default
    return { ...DEFAULTS, ...saved, critDice: { ...DEFAULTS.critDice, ...saved.critDice } };
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
