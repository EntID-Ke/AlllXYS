export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function downloadCanvas(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return;
  try {
    downloadDataUrl(canvas.toDataURL("image/png"), filename);
  } catch (error) {
    console.warn("Failed to export canvas:", error);
  }
}

export function downloadPng(width: number, height: number, filename: string, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(scale, scale);
  draw(context);
  downloadCanvas(canvas, filename.endsWith(".png") ? filename : filename.replace(/\.[^.]+$/, ".png"));
}

export function cssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export async function copyText(text: string) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    area.remove();
  }
}
