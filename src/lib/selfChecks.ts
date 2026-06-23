import { createScreen } from "../data/presets";
import type { AngleSpec, ViewSpec } from "../types";
import { solveAngleResult } from "./angleMath";
import { distanceForAveragePpd, localPpdAt, localPpdCurve, solvePpdMetrics, solveScreenGeometry, solveScreenGeometryStrict, solveScreenMetrics } from "./screenMath";
import { toMm } from "./units";

export interface SelfCheck {
  label: string;
  pass: boolean;
  detail: string;
}

function close(actual: number, expected: number, tolerance: number) {
  return Math.abs(actual - expected) <= tolerance;
}

export function runSelfChecks(): SelfCheck[] {
  const sampleScreen = createScreen("check", "27 inch 4K", 27, 3840, 2160);
  const sampleView: ViewSpec = {
    distance: 60,
    distanceUnit: "cm",
    secondaryDistance: "",
    secondaryDistanceUnit: "cm",
    targetPpd: 60,
    ppdMode: "average",
    comfortMode: "thx",
    customComfortAngle: 36,
    compareEnabled: true,
    secondaryMode: "ray"
  };
  const ppd = solvePpdMetrics(sampleScreen, sampleView);
  const angleSpec: AngleSpec = {
    screen: createScreen("angle-check", "neutral", 6.7, 2796, 1290),
    distance: 35,
    distanceUnit: "cm",
    yaw: 0,
    pitch: 0,
    roll: 0,
    showRoll: false,
    showGrid: false
  };
  const angle = solveAngleResult(angleSpec);
  const screen169 = createScreen("16-9", "32 16:9", 32, "", "");
  const screen219 = createScreen("21-9", "32 21:9", 32, "", "");
  screen219.aspectId = "21-9";
  const g169 = solveScreenGeometry(screen169);
  const g219 = solveScreenGeometry(screen219);
  const invalidScreen = createScreen("invalid", "invalid", 27, 3840, 2160);
  invalidScreen.diagonal = "";
  const invalidPpd = solvePpdMetrics(invalidScreen, sampleView);
  const sampleMetrics = solveScreenMetrics(sampleScreen);
  const curve = sampleMetrics ? localPpdCurve(sampleMetrics, 600, "x", 3) : [];
  const singleSampleCurve = sampleMetrics ? localPpdCurve(sampleMetrics, 600, "x", 1) : [];
  const farLocalPpd = localPpdAt(0, 0.1, 1e12);

  return [
    {
      label: "27 英寸 4K / 60 cm PPD 样例",
      pass:
        !!ppd &&
        close(ppd.ppi, 163.18, 0.08) &&
        close(ppd.hvaDeg, 52.96, 0.08) &&
        close(ppd.vvaDeg, 31.3, 0.08) &&
        close(ppd.ppdHAvg, 72.51, 0.12) &&
        close(ppd.ppdVAvg, 69, 0.12) &&
        close(ppd.ppdHLocalCenter, 67.28, 0.12),
      detail: ppd ? `PPI ${ppd.ppi.toFixed(2)}, HVA ${ppd.hvaDeg.toFixed(2)}°, H-PPD(avg/local) ${ppd.ppdHAvg.toFixed(2)} / ${ppd.ppdHLocalCenter.toFixed(2)}` : "无结果"
    },
    {
      label: "yaw=0 / pitch=0 对称性",
      pass: !!angle && angle.sanity.symmetricWhenNeutral,
      detail: angle ? `左右不对称 ${angle.horizontalAsymmetryDeg.toFixed(4)}°，上下不对称 ${angle.verticalAsymmetryDeg.toFixed(4)}°` : "无结果"
    },
    {
      label: "同对角线 21:9 更宽更矮",
      pass: g219.widthMm > g169.widthMm && g219.heightMm < g169.heightMm,
      detail: `16:9 ${g169.widthMm.toFixed(1)}×${g169.heightMm.toFixed(1)} mm；21:9 ${g219.widthMm.toFixed(1)}×${g219.heightMm.toFixed(1)} mm`
    },
    {
      label: "Invalid screen size does not produce PPD",
      pass: solveScreenGeometryStrict(invalidScreen) === null && invalidPpd === null,
      detail: invalidPpd ? "invalid screen still produced metrics" : "strict geometry and PPD are null"
    },
    {
      label: "Average CVD rejects impossible target angle",
      pass: distanceForAveragePpd(g169.widthMm, 3840, 1) === null,
      detail: "target angles near 180 degrees return null"
    },
    {
      label: "Local PPD curve samples pixel-center range",
      pass: !!sampleMetrics && curve.length === 3 && curve[0].positionMm > -sampleMetrics.widthMm / 2 && curve[2].positionMm < sampleMetrics.widthMm / 2,
      detail: sampleMetrics && curve.length ? `edge samples ${curve[0].positionMm.toFixed(3)} / ${curve[curve.length - 1].positionMm.toFixed(3)} mm` : "no curve"
    },
    {
      label: "Negative lengths are rejected",
      pass: toMm(-1, "in") === null,
      detail: "negative physical measurements return null"
    },
    {
      label: "Single requested curve sample still returns a usable curve",
      pass: singleSampleCurve.length === 2 && singleSampleCurve.every((point) => Number.isFinite(point.ppd)),
      detail: `samples ${singleSampleCurve.length}`
    },
    {
      label: "Local PPD remains stable at very large distances",
      pass: Number.isFinite(farLocalPpd) && farLocalPpd > 0,
      detail: `PPD ${farLocalPpd.toExponential(3)}`
    }
  ];
}
