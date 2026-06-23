import type { AngleSpec, ScreenSpec } from "../types";
import { degToRad, radToDeg, toMm } from "./units";
import { solveScreenGeometry, solveScreenGeometryStrict } from "./screenMath";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AnglePointResult {
  key: "center" | "left" | "right" | "top" | "bottom";
  label: string;
  color: string;
  local: Vec3;
  world: Vec3;
  baseline: Vec3;
  azimuthDeg: number;
  elevationDeg: number;
  baselineAzimuthDeg: number;
  baselineElevationDeg: number;
  deltaAzimuthDeg: number;
  deltaElevationDeg: number;
}

export interface AngleResult {
  widthMm: number;
  heightMm: number;
  distanceMm: number;
  points: AnglePointResult[];
  totalHorizontalDeg: number;
  totalVerticalDeg: number;
  horizontalAsymmetryDeg: number;
  verticalAsymmetryDeg: number;
  normalDeviationDeg: number;
  sanity: {
    symmetricWhenNeutral: boolean;
    yawDominatesHorizontal: boolean;
    pitchDominatesVertical: boolean;
  };
}

const pointColors: Record<AnglePointResult["key"], string> = {
  center: "#ffffff",
  left: "#2f80ed",
  right: "#f2994a",
  top: "#1c9c76",
  bottom: "#9b51e0"
};

export function rotatePoint(point: Vec3, yawDeg: number, pitchDeg: number, rollDeg: number): Vec3 {
  const yaw = degToRad(yawDeg);
  const pitch = degToRad(pitchDeg);
  const roll = degToRad(rollDeg);

  const rz = {
    x: point.x * Math.cos(roll) - point.y * Math.sin(roll),
    y: point.x * Math.sin(roll) + point.y * Math.cos(roll),
    z: point.z
  };
  const rx = {
    x: rz.x,
    y: rz.y * Math.cos(pitch) - rz.z * Math.sin(pitch),
    z: rz.y * Math.sin(pitch) + rz.z * Math.cos(pitch)
  };
  return {
    x: rx.x * Math.cos(yaw) + rx.z * Math.sin(yaw),
    y: rx.y,
    z: -rx.x * Math.sin(yaw) + rx.z * Math.cos(yaw)
  };
}

function translate(point: Vec3, distanceMm: number): Vec3 {
  return { x: point.x, y: point.y, z: point.z + distanceMm };
}

function azimuth(point: Vec3): number {
  return radToDeg(Math.atan2(point.x, point.z));
}

function elevation(point: Vec3): number {
  return radToDeg(Math.atan2(point.y, Math.hypot(point.x, point.z)));
}

function angleBetween(a: Vec3, b: Vec3): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const ma = Math.hypot(a.x, a.y, a.z);
  const mb = Math.hypot(b.x, b.y, b.z);
  if (ma === 0 || mb === 0) return 0;
  const cosine = Math.min(1, Math.max(-1, dot / (ma * mb)));
  return radToDeg(Math.acos(cosine));
}

function angleDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
}

export function solveAngleGeometry(spec: ScreenSpec, distanceValue: number | "", unit = "mm") {
  const geometry = solveScreenGeometry(spec);
  const distanceMm = toMm(distanceValue, unit as never) ?? 600;
  return { geometry, distanceMm };
}

export function solveAngleResult(spec: AngleSpec): AngleResult | null {
  const distanceMm = toMm(spec.distance, spec.distanceUnit);
  if (!distanceMm || distanceMm <= 0) return null;
  const geometry = solveScreenGeometryStrict(spec.screen);
  if (!geometry) return null;
  const w = geometry.widthMm;
  const h = geometry.heightMm;
  const localPoints: Omit<AnglePointResult, "world" | "baseline" | "azimuthDeg" | "elevationDeg" | "baselineAzimuthDeg" | "baselineElevationDeg" | "deltaAzimuthDeg" | "deltaElevationDeg">[] = [
    { key: "center", label: "Center", color: pointColors.center, local: { x: 0, y: 0, z: 0 } },
    { key: "left", label: "Left", color: pointColors.left, local: { x: -w / 2, y: 0, z: 0 } },
    { key: "right", label: "Right", color: pointColors.right, local: { x: w / 2, y: 0, z: 0 } },
    { key: "top", label: "Top", color: pointColors.top, local: { x: 0, y: h / 2, z: 0 } },
    { key: "bottom", label: "Bottom", color: pointColors.bottom, local: { x: 0, y: -h / 2, z: 0 } }
  ];

  const points = localPoints.map((point) => {
    const world = translate(rotatePoint(point.local, spec.yaw, spec.pitch, spec.showRoll ? spec.roll : 0), distanceMm);
    const baseline = translate(point.local, distanceMm);
    const azimuthDeg = azimuth(world);
    const elevationDeg = elevation(world);
    const baselineAzimuthDeg = azimuth(baseline);
    const baselineElevationDeg = elevation(baseline);
    return {
      ...point,
      world,
      baseline,
      azimuthDeg,
      elevationDeg,
      baselineAzimuthDeg,
      baselineElevationDeg,
      deltaAzimuthDeg: angleDeltaDeg(baselineAzimuthDeg, azimuthDeg),
      deltaElevationDeg: elevationDeg - baselineElevationDeg
    };
  });

  const byKey = Object.fromEntries(points.map((item) => [item.key, item])) as Record<AnglePointResult["key"], AnglePointResult>;
  const leftToCenter = Math.abs(angleDeltaDeg(byKey.left.azimuthDeg, byKey.center.azimuthDeg));
  const centerToRight = Math.abs(angleDeltaDeg(byKey.center.azimuthDeg, byKey.right.azimuthDeg));
  const bottomToCenter = Math.abs(byKey.center.elevationDeg - byKey.bottom.elevationDeg);
  const centerToTop = Math.abs(byKey.top.elevationDeg - byKey.center.elevationDeg);
  const normal = rotatePoint({ x: 0, y: 0, z: -1 }, spec.yaw, spec.pitch, spec.showRoll ? spec.roll : 0);
  const centerToEye = { x: -byKey.center.world.x, y: -byKey.center.world.y, z: -byKey.center.world.z };

  return {
    widthMm: w,
    heightMm: h,
    distanceMm,
    points,
    totalHorizontalDeg: Math.abs(angleDeltaDeg(byKey.left.azimuthDeg, byKey.right.azimuthDeg)),
    totalVerticalDeg: Math.abs(byKey.top.elevationDeg - byKey.bottom.elevationDeg),
    horizontalAsymmetryDeg: Math.abs(leftToCenter - centerToRight),
    verticalAsymmetryDeg: Math.abs(bottomToCenter - centerToTop),
    normalDeviationDeg: angleBetween(normal, centerToEye),
    sanity: {
      symmetricWhenNeutral:
        Math.abs(spec.yaw) > 0.0001 || Math.abs(spec.pitch) > 0.0001
          ? true
          : Math.abs(leftToCenter - centerToRight) < 0.001 && Math.abs(bottomToCenter - centerToTop) < 0.001,
      yawDominatesHorizontal: Math.abs(spec.yaw) < 0.001 || Math.abs(byKey.center.deltaAzimuthDeg) >= Math.abs(byKey.center.deltaElevationDeg),
      pitchDominatesVertical: Math.abs(spec.pitch) < 0.001 || Math.abs(byKey.center.deltaElevationDeg) >= Math.abs(byKey.center.deltaAzimuthDeg) * 0.2
    }
  };
}
