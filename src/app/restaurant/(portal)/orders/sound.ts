/**
 * The board's alert sound, as a tiny external store for useSyncExternalStore: one
 * AudioContext per tab. Browsers only start audio after a tap, so the choice is
 * remembered, but after a reload the state is "blocked" until the next tap anywhere.
 */
export type Sound = "unsupported" | "off" | "on" | "blocked";

const SOUND_KEY = "salu.board.sound";

let ctx: AudioContext | null = null;
let state: Sound | null = null;
const listeners = new Set<() => void>();

function set(next: Sound) {
  state = next;
  for (const listener of listeners) listener();
}

/** Storage can be blocked (private mode), so neither helper throws. */
function remembered(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

function remember(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Not remembered; the toggle still works for this visit.
  }
}

function unlockOnNextTap(context: AudioContext) {
  const unlock = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    void context.resume().then(() => set(context.state === "running" ? "on" : "blocked"));
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

export function getSound(): Sound {
  if (state === null) {
    if (typeof window.AudioContext === "undefined") state = "unsupported";
    else if (!remembered()) state = "off";
    else {
      ctx = new AudioContext();
      state = ctx.state === "running" ? "on" : "blocked";
      if (state === "blocked") unlockOnNextTap(ctx);
    }
  }
  return state;
}

/** The server can't know: it renders the "off" toggle. */
export const getServerSound = (): Sound => "off";

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called from a tap, so the browser lets audio start. Plays the chime so staff hear it. */
export async function turnSoundOn(): Promise<void> {
  ctx ??= new AudioContext();
  await ctx.resume();
  if (ctx.state !== "running") return set("blocked");
  remember(true);
  set("on");
  playChime(ctx);
}

export function turnSoundOff(): void {
  remember(false);
  set("off");
}

/** The new-order alert, if sound is on. */
export function chime(): void {
  if (state === "on" && ctx) playChime(ctx);
}

/** A short two-note chime made with WebAudio, so there's no audio file to load. */
function playChime(context: AudioContext): void {
  const start = context.currentTime;
  for (const [i, frequency] of [880, 1320].entries()) {
    const at = start + i * 0.18;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    osc.connect(gain).connect(context.destination);
    osc.start(at);
    osc.stop(at + 0.4);
  }
}
