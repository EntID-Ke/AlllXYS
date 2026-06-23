import { aspectRatios, createScreen, createSizeScreen } from "../data/presets";
import type { AppState, LengthUnit, PageId, ScreenSpec, SizeScreenSpec } from "../types";

export const defaultState: AppState = {
  theme: "dark",
  primary: createScreen("primary", "主屏", 27, 3840, 2160),
  secondary: createScreen("secondary", "副屏", 32, 3840, 2160),
  view: {
    distance: 60,
    distanceUnit: "cm",
    secondaryDistance: "",
    secondaryDistanceUnit: "cm",
    targetPpd: 60,
    ppdMode: "average",
    comfortMode: "general",
    customComfortAngle: 50,
    compareEnabled: true,
    secondaryMode: "ray"
  },
  angle: {
    screen: createScreen("angle-screen", "姿态屏幕", 6.7, 2796, 1290),
    distance: 35,
    distanceUnit: "cm",
    yaw: 18,
    pitch: -8,
    roll: 0,
    showRoll: false,
    showGrid: false
  },
  size: {
    screens: [createSizeScreen(0, 27), createSizeScreen(1, 32), createSizeScreen(2, 34, "21-9"), createSizeScreen(3, 6.7, "19-5-9")],
    visualMode: "overlay",
    sceneMode: "flat",
    align: "center",
    displayUnit: "cm",
    equivalentMode: "free",
    tvMode: false
  }
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberOrBlank(value: unknown, fallback: number | ""): number | "" {
  if (value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

const lengthUnitValues = ["mm", "cm", "m", "in", "ft"] as const satisfies readonly LengthUnit[];
const aspectIds = aspectRatios.map((item) => item.id);

function sanitizeScreen(value: unknown, base: ScreenSpec): ScreenSpec {
  const input = isRecord(value) ? value : {};
  return {
    ...base,
    id: stringValue(input.id, base.id),
    name: stringValue(input.name, base.name),
    presetId: stringValue(input.presetId, base.presetId ?? ""),
    resolutionId: stringValue(input.resolutionId, base.resolutionId ?? ""),
    mode: enumValue(input.mode, ["diagonal", "physical"] as const, base.mode),
    diagonal: numberOrBlank(input.diagonal, base.diagonal),
    diagonalUnit: enumValue(input.diagonalUnit, lengthUnitValues, base.diagonalUnit),
    width: numberOrBlank(input.width, base.width),
    widthUnit: enumValue(input.widthUnit, lengthUnitValues, base.widthUnit),
    height: numberOrBlank(input.height, base.height),
    heightUnit: enumValue(input.heightUnit, lengthUnitValues, base.heightUnit),
    aspectId: enumValue(input.aspectId, aspectIds, base.aspectId),
    customAspectA: positiveNumber(input.customAspectA, Number(base.customAspectA) || 16),
    customAspectB: positiveNumber(input.customAspectB, Number(base.customAspectB) || 9),
    pxW: numberOrBlank(input.pxW, base.pxW),
    pxH: numberOrBlank(input.pxH, base.pxH)
  };
}

function sanitizeSizeScreen(value: unknown, base: SizeScreenSpec): SizeScreenSpec {
  const input = isRecord(value) ? value : {};
  return {
    ...sanitizeScreen(value, base),
    color: typeof input.color === "string" && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : base.color,
    enabled: typeof input.enabled === "boolean" ? input.enabled : base.enabled
  };
}

function normalizeState(partial: Partial<AppState> | null): AppState {
  const base = jsonClone(defaultState);
  const input: Record<string, unknown> = isRecord(partial) ? partial : {};
  const view: Record<string, unknown> = isRecord(input.view) ? input.view : {};
  const angle: Record<string, unknown> = isRecord(input.angle) ? input.angle : {};
  const size: Record<string, unknown> = isRecord(input.size) ? input.size : {};
  const sizeScreens = Array.isArray(size.screens) ? size.screens : [];
  if (!partial) return base;
  return {
    ...base,
    theme: enumValue(input.theme, ["light", "dark"] as const, base.theme),
    primary: sanitizeScreen(input.primary, base.primary),
    secondary: sanitizeScreen(input.secondary, base.secondary),
    view: {
      ...base.view,
      distance: numberOrBlank(view.distance, base.view.distance),
      distanceUnit: enumValue(view.distanceUnit, lengthUnitValues, base.view.distanceUnit),
      secondaryDistance: numberOrBlank(view.secondaryDistance, base.view.secondaryDistance),
      secondaryDistanceUnit: enumValue(view.secondaryDistanceUnit, lengthUnitValues, base.view.secondaryDistanceUnit),
      targetPpd: positiveNumber(view.targetPpd, base.view.targetPpd),
      ppdMode: enumValue(view.ppdMode, ["average", "local"] as const, base.view.ppdMode),
      comfortMode: enumValue(view.comfortMode, ["desktop", "general", "nhk", "thx", "cinema", "custom"] as const, base.view.comfortMode),
      customComfortAngle: numberOrBlank(view.customComfortAngle, base.view.customComfortAngle),
      compareEnabled: typeof view.compareEnabled === "boolean" ? view.compareEnabled : base.view.compareEnabled,
      secondaryMode: enumValue(view.secondaryMode, ["ray", "physical"] as const, base.view.secondaryMode)
    },
    angle: {
      ...base.angle,
      distance: numberOrBlank(angle.distance, base.angle.distance),
      distanceUnit: enumValue(angle.distanceUnit, lengthUnitValues, base.angle.distanceUnit),
      yaw: Number.isFinite(Number(angle.yaw)) ? Number(angle.yaw) : base.angle.yaw,
      pitch: Number.isFinite(Number(angle.pitch)) ? Number(angle.pitch) : base.angle.pitch,
      roll: Number.isFinite(Number(angle.roll)) ? Number(angle.roll) : base.angle.roll,
      showRoll: typeof angle.showRoll === "boolean" ? angle.showRoll : base.angle.showRoll,
      showGrid: typeof angle.showGrid === "boolean" ? angle.showGrid : base.angle.showGrid,
      screen: sanitizeScreen(angle.screen, base.angle.screen)
    },
    size: {
      ...base.size,
      visualMode: enumValue(size.visualMode, ["overlay", "side-by-side"] as const, base.size.visualMode),
      sceneMode: enumValue(size.sceneMode, ["flat", "room"] as const, base.size.sceneMode),
      align: enumValue(size.align, ["center", "bottom", "bottom-left", "bottom-right"] as const, base.size.align),
      displayUnit: enumValue(size.displayUnit, lengthUnitValues, base.size.displayUnit),
      equivalentMode: enumValue(size.equivalentMode, ["free", "same-width", "same-height", "same-diagonal"] as const, base.size.equivalentMode),
      tvMode: typeof size.tvMode === "boolean" ? size.tvMode : base.size.tvMode,
      screens: base.size.screens.map((screen, index) => sanitizeSizeScreen(sizeScreens[index], screen))
    }
  };
}

export function encodeState(state: AppState): string {
  const json = JSON.stringify(diffValue(state, defaultState) ?? {});
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeState(encoded: string | null): AppState {
  if (!encoded) return normalizeState(null);
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return normalizeState(JSON.parse(json) as Partial<AppState>);
  } catch (error) {
    console.warn("Failed to decode state from URL:", error);
    return normalizeState(null);
  }
}

export function getInitialPage(): PageId {
  const hash = window.location.hash.replace("#", "");
  if (hash === "home" || hash === "angle" || hash === "size" || hash === "ppd") return hash;
  return "home";
}

export function getInitialState(): AppState {
  const params = new URLSearchParams(window.location.search);
  const shortKey = params.get("k");
  if (shortKey) {
    const cached = window.localStorage.getItem(`ppdscope:${shortKey}`);
    if (cached) {
      try {
        return normalizeState(JSON.parse(cached) as Partial<AppState>);
      } catch (error) {
        console.warn("Failed to read short state from localStorage:", error);
        return decodeState(params.get("s"));
      }
    }
  }
  return decodeState(params.get("s"));
}

export function writeUrl(page: PageId, state: AppState) {
  const url = stateUrl(page, state);
  window.history.replaceState(null, "", url);
}

export function shareUrlForState(page: PageId, state: AppState) {
  return `${window.location.origin}${stateUrl(page, state)}`;
}

function stateUrl(page: PageId, state: AppState) {
  const encoded = encodeState(state);
  const shortKey = writeShortState(state);
  const url = shortKey ? `${window.location.pathname}?k=${shortKey}&s=${encoded}#${page}` : `${window.location.pathname}?s=${encoded}#${page}`;
  return url;
}

function writeShortState(state: AppState): string | null {
  try {
    const diff = diffValue(state, defaultState) ?? {};
    const json = JSON.stringify(diff);
    const key = shortHash(json);
    window.localStorage.setItem(`ppdscope:${key}`, json);
    return key;
  } catch (error) {
    console.warn("Failed to write short state to localStorage:", error);
    return null;
  }
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function diffValue<T>(value: T, base: T): unknown {
  if (JSON.stringify(value) === JSON.stringify(base)) return undefined;
  if (!value || !base || Array.isArray(value) || Array.isArray(base) || typeof value !== "object" || typeof base !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(value)]);
  keys.forEach((key) => {
    const next = diffValue((value as Record<string, unknown>)[key], (base as Record<string, unknown>)[key]);
    if (next !== undefined) output[key] = next;
  });
  return Object.keys(output).length ? output : undefined;
}
