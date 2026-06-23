import type { AspectRatio, DevicePreset, LengthUnit, ResolutionPreset, ScreenSpec, SizeScreenSpec } from "../types";

export const aspectRatios: AspectRatio[] = [
  { id: "1-1", label: "1:1", a: 1, b: 1 },
  { id: "4-3", label: "4:3", a: 4, b: 3 },
  { id: "3-2", label: "3:2", a: 3, b: 2 },
  { id: "16-10", label: "16:10", a: 16, b: 10 },
  { id: "16-9", label: "16:9", a: 16, b: 9 },
  { id: "18-9", label: "18:9", a: 18, b: 9 },
  { id: "19-5-9", label: "19.5:9", a: 19.5, b: 9 },
  { id: "21-9", label: "21:9", a: 21, b: 9 },
  { id: "32-9", label: "32:9", a: 32, b: 9 },
  { id: "custom", label: "自定义", a: 16, b: 9 }
];

export const resolutionPresets: ResolutionPreset[] = [
  { id: "720p", label: "720p · 1280×720", pxW: 1280, pxH: 720 },
  { id: "1080p", label: "1080p · 1920×1080", pxW: 1920, pxH: 1080 },
  { id: "1440p", label: "1440p · 2560×1440", pxW: 2560, pxH: 1440 },
  { id: "4k", label: "4K UHD · 3840×2160", pxW: 3840, pxH: 2160 },
  { id: "5k", label: "5K · 5120×2880", pxW: 5120, pxH: 2880 },
  { id: "8k", label: "8K UHD · 7680×4320", pxW: 7680, pxH: 4320 },
  { id: "iphone-15-pro", label: "手机 · 2556×1179", pxW: 2556, pxH: 1179 },
  { id: "iphone-pro-max", label: "大屏手机 · 2796×1290", pxW: 2796, pxH: 1290 },
  { id: "ipad-pro-11", label: "平板 11 · 2420×1668", pxW: 2420, pxH: 1668 },
  { id: "ipad-pro-13", label: "平板 13 · 2752×2064", pxW: 2752, pxH: 2064 },
  { id: "ultrawide", label: "超宽 · 3440×1440", pxW: 3440, pxH: 1440 },
  { id: "dqhd", label: "32:9 · 5120×1440", pxW: 5120, pxH: 1440 }
];

export const sizePresets = [6.1, 6.7, 11, 12.9, 13.3, 14, 15.6, 24, 27, 32, 34, 42, 48, 55, 65, 75, 85];

export const devicePresets: DevicePreset[] = [
  { id: "phone-61", label: "手机 6.1\" 19.5:9", category: "手机", diagonal: 6.1, diagonalUnit: "in", aspectId: "19-5-9", pxW: 2556, pxH: 1179 },
  { id: "phone-67", label: "手机 6.7\" 19.5:9", category: "手机", diagonal: 6.7, diagonalUnit: "in", aspectId: "19-5-9", pxW: 2796, pxH: 1290 },
  { id: "tablet-11", label: "平板 11\" 4.3:3", category: "平板", diagonal: 11, diagonalUnit: "in", aspectId: "custom", pxW: 2420, pxH: 1668 },
  { id: "tablet-129", label: "平板 12.9\" 4:3", category: "平板", diagonal: 12.9, diagonalUnit: "in", aspectId: "4-3", pxW: 2732, pxH: 2048 },
  { id: "laptop-14", label: "笔记本 14\" 16:10", category: "笔记本", diagonal: 14, diagonalUnit: "in", aspectId: "16-10", pxW: 3024, pxH: 1964 },
  { id: "monitor-27-4k", label: "显示器 27\" 4K", category: "显示器", diagonal: 27, diagonalUnit: "in", aspectId: "16-9", pxW: 3840, pxH: 2160 },
  { id: "monitor-32-4k", label: "显示器 32\" 4K", category: "显示器", diagonal: 32, diagonalUnit: "in", aspectId: "16-9", pxW: 3840, pxH: 2160 },
  { id: "ultrawide-34", label: "超宽 34\" 21:9", category: "超宽屏", diagonal: 34, diagonalUnit: "in", aspectId: "21-9", pxW: 3440, pxH: 1440 },
  { id: "superwide-49", label: "超宽 49\" 32:9", category: "超宽屏", diagonal: 49, diagonalUnit: "in", aspectId: "32-9", pxW: 5120, pxH: 1440 },
  { id: "tv-55", label: "TV 55\" 16:9", category: "TV", diagonal: 55, diagonalUnit: "in", aspectId: "16-9", pxW: 3840, pxH: 2160 },
  { id: "tv-65", label: "TV 65\" 16:9", category: "TV", diagonal: 65, diagonalUnit: "in", aspectId: "16-9", pxW: 3840, pxH: 2160 }
];

export const lengthUnits: { value: LengthUnit; label: string }[] = [
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "m", label: "m" },
  { value: "in", label: "in" },
  { value: "ft", label: "ft" }
];

export const colors = ["#2f80ed", "#1c9c76", "#f2994a", "#9b51e0"];

export function createScreen(id: string, name: string, diagonal = 27, pxW: number | "" = 3840, pxH: number | "" = 2160): ScreenSpec {
  return {
    id,
    name,
    presetId: "",
    resolutionId: "",
    mode: "diagonal",
    diagonal,
    diagonalUnit: "in",
    width: "",
    widthUnit: "cm",
    height: "",
    heightUnit: "cm",
    aspectId: "16-9",
    customAspectA: 16,
    customAspectB: 9,
    pxW,
    pxH
  };
}

export function createSizeScreen(index: number, diagonal: number, aspectId = "16-9"): SizeScreenSpec {
  const labels = ["主屏", "副屏", "参考 A", "参考 B"];
  return {
    ...createScreen(`size-${index}`, labels[index] ?? `屏幕 ${index + 1}`, diagonal, index < 2 ? 3840 : "", index < 2 ? 2160 : ""),
    aspectId,
    color: colors[index % colors.length],
    enabled: index < 2
  };
}
