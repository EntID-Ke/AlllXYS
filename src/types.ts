export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft";
export type PageId = "home" | "ppd" | "angle" | "size";
export type ThemeMode = "light" | "dark";

export interface AspectRatio {
  id: string;
  label: string;
  a: number;
  b: number;
}

export interface ResolutionPreset {
  id: string;
  label: string;
  pxW: number;
  pxH: number;
}

export interface DevicePreset {
  id: string;
  label: string;
  category: "手机" | "平板" | "笔记本" | "显示器" | "TV" | "超宽屏" | "自定义";
  diagonal: number;
  diagonalUnit: LengthUnit;
  aspectId: string;
  pxW?: number;
  pxH?: number;
}

export interface ScreenSpec {
  id: string;
  name: string;
  presetId?: string;
  resolutionId?: string;
  mode: "diagonal" | "physical";
  diagonal: number | "";
  diagonalUnit: LengthUnit;
  width: number | "";
  widthUnit: LengthUnit;
  height: number | "";
  heightUnit: LengthUnit;
  aspectId: string;
  customAspectA: number | "";
  customAspectB: number | "";
  pxW: number | "";
  pxH: number | "";
}

export interface ViewSpec {
  distance: number | "";
  distanceUnit: LengthUnit;
  secondaryDistance: number | "";
  secondaryDistanceUnit: LengthUnit;
  targetPpd: number;
  ppdMode: "average" | "local";
  comfortMode: "desktop" | "general" | "nhk" | "thx" | "cinema" | "custom";
  customComfortAngle: number | "";
  compareEnabled: boolean;
  secondaryMode: "ray" | "physical";
}

export interface AngleSpec {
  screen: ScreenSpec;
  distance: number | "";
  distanceUnit: LengthUnit;
  yaw: number;
  pitch: number;
  roll: number;
  showRoll: boolean;
  showGrid: boolean;
}

export interface SizeScreenSpec extends ScreenSpec {
  color: string;
  enabled: boolean;
}

export interface SizeSpec {
  screens: SizeScreenSpec[];
  visualMode: "overlay" | "side-by-side";
  sceneMode: "flat" | "room";
  align: "center" | "bottom" | "bottom-left" | "bottom-right";
  displayUnit: LengthUnit;
  equivalentMode: "free" | "same-width" | "same-height" | "same-diagonal";
  tvMode: boolean;
}

export interface AppState {
  theme: ThemeMode;
  primary: ScreenSpec;
  secondary: ScreenSpec;
  view: ViewSpec;
  angle: AngleSpec;
  size: SizeSpec;
}
