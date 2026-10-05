import { state, updateSettings } from "./state.js";
// Original local loop avoids the unverified redistribution rights of the old track.
const MUSIC = "public/assets/audio/corner-cup.wav";
const STEP = "public/assets/audio/step-dirt.wav";
// CC0 Freesound previews are bundled so coffee sounds also work offline.
const POUR = "public/assets/audio/coffee-pour-freesound.mp3";
const CUP = "public/assets/audio/cup-set-down-freesound.mp3";

let enabled = state.settings.sound;
let context;
let music;
const activeClips = new Set();
const clipVolumes = new WeakMap();

export const soundEnabled = () => enabled;

function getMusic() {
  if (!music) {
    music = new Audio(MUSIC);
    music.loop = true;
    music.volume = state.settings.music * .4;
    music.preload = "none";
  }
  return music;
}

function tone(frequency, duration = .09, type = "square", volume = .025) {
  if (!enabled || document.hidden || state.settings.sfx === 0) return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(Math.max(.0001, volume * state.settings.sfx), context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch { /* Keep the game playable if audio is unavailable. */ }
}

function clip(source, volume, maximumMs) {
  if (!enabled || document.hidden || state.settings.sfx === 0) return;
  try {
    const player = new Audio(source);
    player.volume = volume * state.settings.sfx;
    activeClips.add(player);
    clipVolumes.set(player, volume);
    player.addEventListener("ended", () => activeClips.delete(player), { once: true });
    void player.play().catch(() => activeClips.delete(player));
    if (maximumMs) setTimeout(() => { player.pause(); activeClips.delete(player); }, maximumMs);
  } catch { /* Keep the game playable if audio is unavailable. */ }
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
  updateSettings({ sound: enabled });
  if (enabled) {
    void getMusic().play().catch(() => {});
    tone(660, .08, "triangle");
  } else {
    music?.pause();
    for (const player of activeClips) player.pause();
    activeClips.clear();
  }
}

export function refreshVolumes() {
  if (music) music.volume = state.settings.music * .4;
  for (const player of activeClips) player.volume = clipVolumes.get(player) * state.settings.sfx;
}

export function resumeSound() {
  if (enabled && !document.hidden && getMusic().paused) void getMusic().play().catch(() => {});
}

export function playSound(kind, detail = {}) {
  if (!enabled) return;
  resumeSound();
  if (kind === "select") { tone(310, .035, "triangle", .014); return; }
  if (kind === "beat") { tone(760, .07, "triangle", .045); return; }
  if (kind === "turn-start") { tone(90, .08, "square", .025); setTimeout(() => tone(180, .09, "triangle", .025), 80); return; }
  if (kind === "coffee-ingredient") { tone(detail.correct ? 520 : 170, .08, detail.correct ? "triangle" : "sawtooth"); return; }
  if (kind === "coffee-brew") { clip(POUR, .23, 1900); tone(detail.grade === 2 ? 800 : 410, .13, "triangle"); return; }
  if (kind === "coffee-deliver") { clip(CUP, .4, 1650); setTimeout(() => clip(STEP, .3, 280), 160); tone(detail.correct ? 740 : 210, .16, "triangle"); return; }
  if (kind === "twist") { tone(300, .3, "sawtooth", .035); setTimeout(() => tone(590, .2, "triangle"), 130); return; }
  if (kind === "month-bill") { tone(390, .12, "triangle", .018); setTimeout(() => tone(330, .14, "triangle", .018), 130); return; }
  if (kind === "car-available") {
    [660, 880, 1100].forEach((frequency, index) => setTimeout(() => tone(frequency, .2, "triangle"), index * 110));
    return;
  }
  if (kind === "goal") {
    [70, 100, 140, 200, 270].forEach((frequency, index) => setTimeout(() => tone(frequency, .22, "sawtooth", .035), index * 130));
    setTimeout(() => tone(880, .3, "triangle"), 800);
    return;
  }
  if (["buy", "sell", "build", "commission", "coffee-ready", "employee-upgrade"].includes(kind)) {
    tone(kind === "goal" ? 880 : kind === "buy" ? 580 : 690, .16, "triangle");
    setTimeout(() => tone(kind === "goal" ? 1175 : 900, .18, "triangle"), 100);
    return;
  }
  if (kind === "no-money") { tone(180, .14, "sawtooth"); return; }
  tone(420, .045, "triangle", .018);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) music?.pause();
  else resumeSound();
});
