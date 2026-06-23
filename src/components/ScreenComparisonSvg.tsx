import { memo, useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { LengthUnit, SizeScreenSpec } from "../types";
import { solveScreenGeometryStrict, solveScreenMetrics } from "../lib/screenMath";
import { formatNumber, fromMm } from "../lib/units";
import { cssVar, downloadPng } from "../lib/export";
import { IconButton } from "./Controls";

interface ScreenComparisonSvgProps {
  screens: SizeScreenSpec[];
  mode: "overlay" | "side-by-side";
  align: "center" | "bottom" | "bottom-left" | "bottom-right";
  displayUnit: LengthUnit;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function ScreenComparisonSvgComponent({ screens, mode, align, displayUnit }: ScreenComparisonSvgProps) {
  const [hover, setHover] = useState<string | null>(null);
  const items = useMemo(
    () =>
      screens
        .filter((screen) => screen.enabled)
        .map((screen) => {
          const geometry = solveScreenGeometryStrict(screen);
          return geometry
            ? {
                screen,
                geometry,
                metrics: solveScreenMetrics(screen)
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [screens]
  );
  const maxW = Math.max(...items.map((item) => item.geometry.widthMm), 1);
  const maxH = Math.max(...items.map((item) => item.geometry.heightMm), 1);
  const viewW = 1040;
  const viewH = 560;
  const padX = 48;
  const topPad = 66;
  const bottomPad = 82;
  const contentH = viewH - topPad - bottomPad;
  const contentW = viewW - padX * 2;
  const sideGap = 46;
  const scale =
    mode === "side-by-side"
      ? Math.min(contentW / (items.reduce((sum, item) => sum + item.geometry.widthMm, 0) + sideGap * Math.max(0, items.length - 1)), contentH / maxH)
      : Math.min(contentW / maxW, contentH / maxH);
  const layouts = useMemo(() => {
    let cursorX = padX;
    return items.map((item) => {
      const w = item.geometry.widthMm * scale;
      const h = item.geometry.heightMm * scale;
      let x = (viewW - w) / 2;
      let y = topPad + (contentH - h) / 2;
      if (mode === "side-by-side") {
        x = cursorX;
        cursorX += w + sideGap;
      }
      if (align === "bottom") y = viewH - bottomPad - h;
      if (align === "bottom-left") {
        x = padX;
        y = viewH - bottomPad - h;
      }
      if (align === "bottom-right") {
        x = viewW - padX - w;
        y = viewH - bottomPad - h;
      }
      const labelY = Math.max(22, y - 10);
      const noteY = Math.min(viewH - 28, y + h + 28);
      const textX = Math.min(Math.max(padX + 10, x + 10), viewW - padX - 190);
      return { item, w, h, x, y, labelY, noteY, textX };
    });
  }, [align, items, mode, scale]);
  const exportPng = () => {
    downloadPng(viewW, viewH, "screen-size-comparison.png", (context) => {
      const panel = cssVar("--panel-2", "#141518");
      const line = cssVar("--line", "#25272d");
      const muted = cssVar("--muted", "#8f96a3");
      context.clearRect(0, 0, viewW, viewH);
      roundedRect(context, 0.5, 0.5, viewW - 1, viewH - 1, 8);
      context.fillStyle = panel;
      context.fill();
      context.strokeStyle = line;
      context.lineWidth = 1;
      context.stroke();

      context.font = "13px Microsoft YaHei, Segoe UI, sans-serif";
      items.forEach((item, index) => {
        const legendX = padX + index * 138;
        context.globalAlpha = 0.85;
        context.fillStyle = item.screen.color;
        roundedRect(context, legendX, 28, 14, 8, 2);
        context.fill();
        context.globalAlpha = 1;
        context.fillStyle = muted;
        context.fillText(item.screen.name, legendX + 20, 36);
      });

      layouts.forEach(({ item, w, h, x, y, labelY, noteY, textX }) => {
        context.globalAlpha = mode === "overlay" ? 0.14 : 0.18;
        context.fillStyle = item.screen.color;
        roundedRect(context, x, y, w, h, 3);
        context.fill();
        context.globalAlpha = 1;
        context.strokeStyle = item.screen.color;
        context.lineWidth = 2;
        context.stroke();
        context.globalAlpha = 0.7;
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(x, y + h);
        context.lineTo(x + w, y + h);
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = item.screen.color;
        context.font = "13px Microsoft YaHei, Segoe UI, sans-serif";
        context.fillText(item.screen.name, textX, labelY);
        context.fillStyle = muted;
        context.font = "12px Microsoft YaHei, Segoe UI, sans-serif";
        const note = `${formatNumber(fromMm(item.geometry.widthMm, displayUnit), 1)}×${formatNumber(fromMm(item.geometry.heightMm, displayUnit), 1)} ${displayUnit}${item.metrics ? ` · ${formatNumber(item.metrics.ppi, 1)} PPI` : ""}`;
        context.fillText(note, textX, noteY);
      });
    });
  };

  return (
    <div className="viz-card large">
      <div className="viz-header">
        <div>
          <h3>真实比例屏幕比对</h3>
          <p>支持轮廓叠加、并排比对和多种对齐方式，面积与宽高差异会按真实比例呈现</p>
        </div>
        <IconButton title="导出 PNG 比对图" onClick={exportPng}>
          <Download size={17} />
        </IconButton>
      </div>
      <div className="compare-svg-frame">
        <svg viewBox={`0 0 ${viewW} ${viewH}`} className="compare-svg" preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width={viewW} height={viewH} rx="8" />
          <g className="compare-legend">
            {items.map((item, index) => (
              <g key={item.screen.id} transform={`translate(${padX + index * 138}, 28)`}>
                <rect width="14" height="8" rx="2" fill={item.screen.color} opacity="0.85" />
                <text x="20" y="8">
                  {item.screen.name}
                </text>
              </g>
            ))}
          </g>
          {layouts.map(({ item, w, h, x, y, labelY, noteY, textX }) => {
            const active = hover === item.screen.id;
            return (
              <g
                key={item.screen.id}
                onMouseEnter={() => setHover(item.screen.id)}
                onMouseLeave={() => setHover(null)}
                className={active ? "screen-shape active" : "screen-shape"}
              >
                <rect x={x} y={y} width={w} height={h} rx="3" fill={item.screen.color} fillOpacity={mode === "overlay" ? 0.14 : 0.18} stroke={item.screen.color} strokeWidth={active ? 3 : 2} />
                <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={item.screen.color} strokeWidth="4" opacity="0.7" />
                <text x={textX} y={labelY} fill={item.screen.color}>
                  {item.screen.name}
                </text>
                <text x={textX} y={noteY} className="shape-note">
                  {formatNumber(fromMm(item.geometry.widthMm, displayUnit), 1)}×{formatNumber(fromMm(item.geometry.heightMm, displayUnit), 1)} {displayUnit}
                  {item.metrics ? ` · ${formatNumber(item.metrics.ppi, 1)} PPI` : ""}
                </text>
                <title>
                  {item.screen.name}：{formatNumber(fromMm(item.geometry.diagonalMm, "in"), 2)} in，面积 {formatNumber(fromMm(Math.sqrt(item.geometry.areaMm2), displayUnit) ** 2, 1)} {displayUnit}²
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export const ScreenComparisonSvg = memo(ScreenComparisonSvgComponent);

