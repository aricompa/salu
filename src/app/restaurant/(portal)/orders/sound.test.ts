import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in AudioContext: starts suspended unless told otherwise, and counts tones. */
class FakeAudioContext {
  static startRunning = false;
  static tones = 0;
  state: "suspended" | "running" = FakeAudioContext.startRunning ? "running" : "suspended";
  currentTime = 0;
  destination = {};
  async resume() {
    this.state = "running";
  }
  createGain() {
    const param = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    return { gain: param, connect: (to: unknown) => to };
  }
  createOscillator() {
    FakeAudioContext.tones += 1;
    return {
      type: "",
      frequency: { value: 0 },
      connect: (to: unknown) => to,
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
}

const load = async () => {
  vi.resetModules();
  return import("./sound");
};

describe("board sound", () => {
  beforeEach(() => {
    FakeAudioContext.startRunning = false;
    FakeAudioContext.tones = 0;
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is unsupported without WebAudio", async () => {
    const sound = await load();
    expect(sound.getSound()).toBe("unsupported");
  });

  it("turns on from a tap, remembers it and chimes for new orders", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sound = await load();
    expect(sound.getSound()).toBe("off");
    sound.chime();
    expect(FakeAudioContext.tones).toBe(0);

    await sound.turnSoundOn();
    expect(sound.getSound()).toBe("on");
    expect(window.localStorage.getItem("salu.board.sound")).toBe("on");
    const afterConfirm = FakeAudioContext.tones;
    sound.chime();
    expect(FakeAudioContext.tones).toBeGreaterThan(afterConfirm);

    sound.turnSoundOff();
    expect(window.localStorage.getItem("salu.board.sound")).toBe("off");
    const afterOff = FakeAudioContext.tones;
    sound.chime();
    expect(FakeAudioContext.tones).toBe(afterOff);
  });

  it("after a reload, says it needs a tap until the browser allows audio", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    window.localStorage.setItem("salu.board.sound", "on");
    const sound = await load();
    const changed = vi.fn();
    sound.subscribeSound(changed);
    expect(sound.getSound()).toBe("blocked");

    window.dispatchEvent(new Event("pointerdown"));
    await vi.waitFor(() => expect(sound.getSound()).toBe("on"));
    expect(changed).toHaveBeenCalled();
  });

  it("works when storage is blocked", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const sound = await load();
    expect(sound.getSound()).toBe("off");
    await sound.turnSoundOn();
    expect(sound.getSound()).toBe("on");
  });
});
