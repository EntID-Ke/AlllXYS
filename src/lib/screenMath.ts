import { aspectRatios } from "../data/presets";
import type { AspectRatio, ScreenSpec, ViewSpec } from "../types";
import { degToRad, fromMm, isFiniteNumber, mmToIn, radToDeg, toMm } from "./units";

export interface ScreenGeometry {
  widthMm: number;
  heightMm: number;
  diagonalMm: number;
  areaMm2: number;
  aspect: AspectRatio;
  derivedFrom: "diagonal" | "physical" | "fallback";
}

export interface ScreenMetrics extends ScreenGeometry {
  pxW: number;
  pxH: number;
  diagonalPx: number;
  ppi: number;
  pitchXmm: number;
  pitchYmm: number;
}

export interface PpdMetrics extends ScreenMetrics {
  distanceMm: number;
  hvaDeg: number;
  vvaDeg: number;
  dvaDeg: number;
  ppdHAvg: number;
  ppdVAvg: number;
  ppdDAvg: number;
  ppdHLocalCenter: number;
  ppdVLocalCenter: number;
  cvdLocalXmm: number | null;
  cvdLocalYmm: number | null;
  cvdAvgHmm: number | null;
  cvdAvgVmm: number | null;
  pvdMm: number;
  pvdAngleDeg: number;
  clarityLabel: string;
}

export interface ValidationMessage {
  field: string;
  message: string;
}

function positiveMm(value: number | "", unit: ScreenSpec["diagonalUnit"]): number | null {
  const mm = toMm(value, unit);
  return mm !== null && mm > 0 ? mm : null;
}

export function getAspect(spec: Pick<ScreenSpec, "aspectId" | "customAspectA" | "customAspectB">): AspectRatio {
  if (spec.aspectId === "custom") {
    const a = Number(spec.customAspectA);
    const b = Number(spec.customAspectB);
    return {
      id: "custom",
      label: `${a || 16}:${b || 9}`,
      a: a > 0 ? a : 16,
      b: b > 0 ? b : 9
    };
  }
  return aspectRatios.find((item) => item.id === spec.aspectId) ?? aspectRatios.find((item) => item.id === "16-9")!;
}

export function solveScreenGeometryStrict(spec: ScreenSpec): ScreenGeometry | null {
  const aspect = getAspect(spec);
  const ratio = aspect.a / aspect.b;
  const diag = positiveMm(spec.diagonal, spec.diagonalUnit);
  const w = positiveMm(spec.width, spec.widthUnit);
  const h = positiveMm(spec.height, spec.heightUnit);

  if (!Number.isFinite(ratio) || ratio <= 0) return null;

  if (spec.mode === "physical") {
    if (w && h) {
      return {
        widthMm: w,
        heightMm: h,
        diagonalMm: Math.hypot(w, h),
        areaMm2: w * h,
        aspect: { ...aspect, label: `${(w / h).toFixed(2)}:1` },
        derivedFrom: "physical"
      };
    }
    if (w && !h) {
      const heightMm = w / ratio;
      return {
        widthMm: w,
        heightMm,
        diagonalMm: Math.hypot(w, heightMm),
        areaMm2: w * heightMm,
        aspect,
        derivedFrom: "physical"
      };
    }
    if (!w && h) {
      const widthMm = h * ratio;
      return {
        widthMm,
        heightMm: h,
        diagonalMm: Math.hypot(widthMm, h),
        areaMm2: widthMm * h,
        aspect,
        derivedFrom: "physical"
      };
    }
    return null;
  }

  if (!diag) return null;
  const divisor = Math.hypot(aspect.a, aspect.b);
  const widthMm = (diag * aspect.a) / divisor;
  const heightMm = (diag * aspect.b) / divisor;
  return {
    widthMm,
    heightMm,
    diagonalMm: diag,
    areaMm2: widthMm * heightMm,
    aspect,
    derivedFrom: "diagonal"
  };
}

export function validateScreenSpec(spec: ScreenSpec, requireResolution = false): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const values: [keyof ScreenSpec, number | ""][] = [
    ["diagonal", spec.diagonal],
    ["width", spec.width],
    ["height", spec.height],
    ["customAspectA", spec.customAspectA],
    ["customAspectB", spec.customAspectB],
    ["pxW", spec.pxW],
    ["pxH", spec.pxH]
  ];
  values.forEach(([field, value]) => {
    if (value !== "" && (!Number.isFinite(value) || Number(value) <= 0)) {
      messages.push({ field: String(field), message: "数值必须大于 0" });
    }
  });
  if (spec.aspectId === "custom" && (Number(spec.customAspectA) <= 0 || Number(spec.customAspectB) <= 0)) {
    messages.push({ field: "aspect", message: "宽高比的两个数都必须大于 0" });
  }
  if (requireResolution) {
    if (!Number.isInteger(Number(spec.pxW)) || Number(spec.pxW) <= 0) {
      messages.push({ field: "pxW", message: "水平分辨率必须为正整数" });
    }
    if (!Number.isInteger(Number(spec.pxH)) || Number(spec.pxH) <= 0) {
      messages.push({ field: "pxH", message: "垂直分辨率必须为正整数" });
    }
  }
  return messages;
}

export function solveScreenGeometry(spec: ScreenSpec): ScreenGeometry {
  const strict = solveScreenGeometryStrict(spec);
  if (strict) return strict;
  const aspect = getAspect(spec);
  const ratio = aspect.a / aspect.b;
  const diag = toMm(spec.diagonal, spec.diagonalUnit);
  const w = toMm(spec.width, spec.widthUnit);
  const h = toMm(spec.height, spec.heightUnit);

  if (spec.mode === "physical") {
    if (w && h) {
      return {
        widthMm: w,
        heightMm: h,
        diagonalMm: Math.hypot(w, h),
        areaMm2: w * h,
        aspect: { ...aspect, label: `${(w / h).toFixed(2)}:1` },
        derivedFrom: "physical"
      };
    }
    if (w && !h) {
      const heightMm = w / ratio;
      return {
        widthMm: w,
        heightMm,
        diagonalMm: Math.hypot(w, heightMm),
        areaMm2: w * heightMm,
        aspect,
        derivedFrom: "physical"
      };
    }
    if (!w && h) {
      const widthMm = h * ratio;
      return {
        widthMm,
        heightMm: h,
        diagonalMm: Math.hypot(widthMm, h),
        areaMm2: widthMm * h,
        aspect,
        derivedFrom: "physical"
      };
    }
  }

  const diagonalMm = diag && diag > 0 ? diag : 27 * 25.4;
  const divisor = Math.hypot(aspect.a, aspect.b);
  const widthMm = (diagonalMm * aspect.a) / divisor;
  const heightMm = (diagonalMm * aspect.b) / divisor;
  return {
    widthMm,
    heightMm,
    diagonalMm,
    areaMm2: widthMm * heightMm,
    aspect,
    derivedFrom: diag ? "diagonal" : "fallback"
  };
}

export function solveScreenMetrics(spec: ScreenSpec): ScreenMetrics | null {
  const geometry = solveScreenGeometryStrict(spec);
  if (!geometry) return null;
  const pxW = Number(spec.pxW);
  const pxH = Number(spec.pxH);
  if (!Number.isInteger(pxW) || !Number.isInteger(pxH) || pxW <= 0 || pxH <= 0) return null;
  const diagonalPx = Math.hypot(pxW, pxH);
  const ppi = diagonalPx / mmToIn(geometry.diagonalMm);
  return {
    ...geometry,
    pxW,
    pxH,
    diagonalPx,
    ppi,
    pitchXmm: geometry.widthMm / pxW,
    pitchYmm: geometry.heightMm / pxH
  };
}

export function viewingAngleDeg(sizeMm: number, distanceMm: number): number {
  if (!Number.isFinite(sizeMm) || !Number.isFinite(distanceMm) || sizeMm <= 0 || distanceMm <= 0) return Number.NaN;
  return radToDeg(2 * Math.atan(sizeMm / (2 * distanceMm)));
}

export function localPpdAt(positionMm: number, pitchMm: number, distanceMm: number): number {
  if (!Number.isFinite(positionMm) || !Number.isFinite(pitchMm) || !Number.isFinite(distanceMm) || pitchMm <= 0 || distanceMm <= 0) return Number.NaN;
  const halfPitch = pitchMm / 2;
  const left = positionMm - halfPitch;
  const right = positionMm + halfPitch;
  const deltaRad = Math.atan2((right - left) * distanceMm, distanceMm * distanceMm + left * right);
  const deltaDeg = radToDeg(deltaRad);
  if (!Number.isFinite(deltaDeg) || deltaDeg <= 0) return Number.NaN;
  return 1 / deltaDeg;
}

export function comfortAngle(mode: ViewSpec["comfortMode"], custom: number | ""): number {
  if (mode === "desktop") return 60;
  if (mode === "nhk") return 30;
  if (mode === "thx") return 36;
  if (mode === "cinema") return 40;
  const customAngle = Number(custom);
  if (mode === "custom" && Number.isFinite(customAngle) && customAngle > 0) return Math.min(120, Math.max(1, customAngle));
  return 50;
}

export function distanceForAveragePpd(sizeMm: number, pixels: number, targetPpd: number): number | null {
  if (!Number.isFinite(sizeMm) || !Number.isFinite(pixels) || !Number.isFinite(targetPpd) || sizeMm <= 0 || pixels <= 0 || targetPpd <= 0) return null;
  const targetAngleDeg = pixels / targetPpd;
  if (targetAngleDeg <= 0 || targetAngleDeg >= 179.8) return null;
  return sizeMm / (2 * Math.tan(degToRad(targetAngleDeg) / 2));
}

export function distanceForLocalPpd(pitchMm: number, targetPpd: number): number | null {
  if (!Number.isFinite(pitchMm) || !Number.isFinite(targetPpd) || pitchMm <= 0 || targetPpd <= 0) return null;
  return pitchMm / (2 * Math.tan(Math.PI / (360 * targetPpd)));
}

export function solvePpdMetrics(spec: ScreenSpec, view: ViewSpec): PpdMetrics | null {
  const metrics = solveScreenMetrics(spec);
  const distanceMm = toMm(view.distance, view.distanceUnit);
  if (!metrics || !distanceMm || distanceMm <= 0) return null;

  const hvaDeg = viewingAngleDeg(metrics.widthMm, distanceMm);
  const vvaDeg = viewingAngleDeg(metrics.heightMm, distanceMm);
  const dvaDeg = viewingAngleDeg(metrics.diagonalMm, distanceMm);
  const targetCandidate = Number(view.targetPpd);
  const target = Number.isFinite(targetCandidate) && targetCandidate > 0 ? Math.max(1, targetCandidate) : 60;
  const localX = localPpdAt(0, metrics.pitchXmm, distanceMm);
  const localY = localPpdAt(0, metrics.pitchYmm, distanceMm);
  const pvdAngleDeg = comfortAngle(view.comfortMode, view.customComfortAngle);
  const pvdMm = metrics.widthMm / (2 * Math.tan(degToRad(pvdAngleDeg) / 2));
  const minLocal = Math.min(localX, localY);

  return {
    ...metrics,
    distanceMm,
    hvaDeg,
    vvaDeg,
    dvaDeg,
    ppdHAvg: metrics.pxW / hvaDeg,
    ppdVAvg: metrics.pxH / vvaDeg,
    ppdDAvg: metrics.diagonalPx / dvaDeg,
    ppdHLocalCenter: localX,
    ppdVLocalCenter: localY,
    cvdLocalXmm: distanceForLocalPpd(metrics.pitchXmm, target),
    cvdLocalYmm: distanceForLocalPpd(metrics.pitchYmm, target),
    cvdAvgHmm: distanceForAveragePpd(metrics.widthMm, metrics.pxW, target),
    cvdAvgVmm: distanceForAveragePpd(metrics.heightMm, metrics.pxH, target),
    pvdMm,
    pvdAngleDeg,
    clarityLabel: classifyPpd(minLocal)
  };
}

export function classifyPpd(ppd: number): string {
  if (ppd >= 120) return "接近极高视觉要求";
  if (ppd >= 80) return "20-15 级别 / 很高";
  if (ppd >= 60) return "20-20 级别 / 视网膜感";
  if (ppd >= 40) return "及格清晰度 / 可接受";
  if (ppd >= 30) return "偏低清晰度 / 勉强可用";
  return "像素结构容易察觉";
}

export function localPpdCurve(metrics: ScreenMetrics, distanceMm: number, axis: "x" | "y", samples = 81) {
  const size = axis === "x" ? metrics.widthMm : metrics.heightMm;
  const pitch = axis === "x" ? metrics.pitchXmm : metrics.pitchYmm;
  const result: { positionMm: number; ratio: number; ppd: number }[] = [];
  const usableSamples = Math.max(2, Math.floor(samples));
  const startPositionMm = -size / 2 + pitch / 2;
  const sampleRangeMm = size - pitch;
  for (let i = 0; i < usableSamples; i += 1) {
    const ratio = i / (usableSamples - 1);
    const positionMm = startPositionMm + sampleRangeMm * ratio;
    result.push({ positionMm, ratio, ppd: localPpdAt(positionMm, pitch, distanceMm) });
  }
  return result;
}

export function equivalentForSecond(primary: PpdMetrics, secondary: ScreenMetrics, mode: ViewSpec["ppdMode"], distanceMm: number) {
  const target = mode === "average" ? primary.ppdHAvg : primary.ppdHLocalCenter;
  const safeDistanceMm = Number.isFinite(distanceMm) && distanceMm > 0 ? distanceMm : primary.distanceMm;
  const distanceToMatch =
    mode === "average"
      ? distanceForAveragePpd(secondary.widthMm, secondary.pxW, target)
      : distanceForLocalPpd(secondary.pitchXmm, target);
  const requiredWidth =
    mode === "average"
      ? 2 * safeDistanceMm * Math.tan(degToRad(secondary.pxW / target) / 2)
      : secondary.pxW * 2 * safeDistanceMm * Math.tan(Math.PI / (360 * target));
  const requiredDiagonal = requiredWidth * (secondary.diagonalMm / secondary.widthMm);
  const requiredPxW =
    mode === "average"
      ? Math.ceil(target * viewingAngleDeg(secondary.widthMm, safeDistanceMm))
      : Math.ceil(secondary.widthMm / (2 * safeDistanceMm * Math.tan(Math.PI / (360 * target))));
  const requiredPxH = Math.ceil(requiredPxW * (secondary.pxH / secondary.pxW));
  const metricAtSameDistance =
    mode === "average"
      ? secondary.pxW / viewingAngleDeg(secondary.widthMm, safeDistanceMm)
      : localPpdAt(0, secondary.pitchXmm, safeDistanceMm);

  return {
    target,
    metricAtSameDistance,
    distanceToMatch,
    requiredDiagonal,
    requiredDiagonalIn: fromMm(requiredDiagonal, "in"),
    requiredPxW,
    requiredPxH
  };
}

export function screenToQueryValue(spec: ScreenSpec): string {
  return [
    spec.name,
    spec.mode,
    spec.diagonal,
    spec.diagonalUnit,
    spec.width,
    spec.widthUnit,
    spec.height,
    spec.heightUnit,
    spec.aspectId,
    spec.customAspectA,
    spec.customAspectB,
    spec.pxW,
    spec.pxH
  ].join("|");
}

export function finiteOr(value: number | "", fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

