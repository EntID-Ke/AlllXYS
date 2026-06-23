import type { LengthUnit } from "../types";

const MM_PER_UNIT: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function toMm(value: number | "", unit: LengthUnit): number | null {
  if (value === "" || !Number.isFinite(value) || value < 0) return null;
  return value * MM_PER_UNIT[unit];
}

export function fromMm(mm: number, unit: LengthUnit): number {
  return mm / MM_PER_UNIT[unit];
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number | null {
  const mm = toMm(value, from);
  return mm === null ? null : fromMm(mm, to);
}

export function mmToIn(mm: number): number {
  return mm / MM_PER_UNIT.in;
}

export function inToMm(inch: number): number {
  return inch * MM_PER_UNIT.in;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fixed = abs >= 1000 ? Math.max(0, digits - 1) : digits;
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fixed
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
