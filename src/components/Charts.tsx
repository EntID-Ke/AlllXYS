import { memo, useMemo } from "react";
import { Download } from "lucide-react";
import type { PpdMetrics, ScreenMetrics } from "../lib/screenMath";
import { localPpdCurve } from "../lib/screenMath";
import { formatNumber } from "../lib/units";
import { cssVar, downloadPng } from "../lib/export";
import { IconButton } from "./Controls";

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

function chartColors() {
  return {
    bg: cssVar("--panel-2", "#141518"),
    line: cssVar("--line-strong", "#3a3d45"),
    text: cssVar("--text", "#f7f8f8"),
    muted: cssVar("--muted", "#8f96a3"),
    accent: cssVar("--accent", "#5e6ad2"),
    accent2: cssVar("--accent-2", "#26b99a"),
    accent3: cssVar("--accent-3", "#f4b04f")
  };
}

function drawChartShell(context: CanvasRenderingContext2D, width: number, height: number, colors: ReturnType<typeof chartColors>) {
  context.clearRect(0, 0, width, height);
  roundedRect(context, 0.5, 0.5, width - 1, height - 1, 8);
  context.fillStyle = colors.bg;
  context.fill();
  context.strokeStyle = colors.line;
  context.lineWidth = 1;
  context.stroke();
}

function drawHorizontalThreshold(context: CanvasRenderingContext2D, y: number, x1: number, x2: number, label: string, labelX: number, colors: ReturnType<typeof chartColors>) {
  context.save();
  context.strokeStyle = colors.line;
  context.globalAlpha = 0.65;
  context.lineWidth = 1;
  context.setLineDash([5, 6]);
  context.beginPath();
  context.moveTo(x1, y);
  context.lineTo(x2, y);
  context.stroke();
  context.restore();
  context.fillStyle = colors.muted;
  context.font = "12px Microsoft YaHei, Segoe UI, sans-serif";
  context.fillText(label, labelX, y + 4);
}

function PpdCurveChartComponent({ metrics, axis = "x" }: { metrics: PpdMetrics | (ScreenMetrics & { distanceMm: number }); axis?: "x" | "y" }) {
  const curve = useMemo(() => localPpdCurve(metrics, metrics.distanceMm, axis, 90), [axis, metrics]);
  const width = 720;
  const height = 260;
  const padLeft = 52;
  const padRight = 56;
  const padTop = 28;
  const padBottom = 48;
  const maxPpd = Math.max(130, ...curve.map((item) => item.ppd));
  const minPpd = Math.min(20, ...curve.map((item) => item.ppd));
  const x = (ratio: number) => padLeft + ratio * (width - padLeft - padRight);
  const y = (ppd: number) => height - padBottom - ((ppd - minPpd) / (maxPpd - minPpd)) * (height - padTop - padBottom);
  const path = useMemo(() => curve.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.ratio).toFixed(2)} ${y(point.ppd).toFixed(2)}`).join(" "), [curve, maxPpd, minPpd]);
  const samplePoints = useMemo(() => curve.filter((_, index) => index % 22 === 0), [curve]);
  const thresholds = [
    { value: 40, label: "40 及格" },
    { value: 60, label: "60 清晰" },
    { value: 80, label: "80 很高" },
    { value: 120, label: "120 极高" }
  ];
  const exportPng = () => {
    downloadPng(width, height, "ppd-local-curve.png", (context) => {
      const colors = chartColors();
      drawChartShell(context, width, height, colors);
      thresholds.forEach((threshold) => drawHorizontalThreshold(context, y(threshold.value), padLeft, width - padRight, threshold.label, width - padRight + 6, colors));

      context.strokeStyle = colors.line;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(padLeft, height - padBottom);
      context.lineTo(width - padRight, height - padBottom);
      context.moveTo(padLeft, padTop);
      context.lineTo(padLeft, height - padBottom);
      context.stroke();

      context.fillStyle = colors.text;
      context.font = "650 12px Microsoft YaHei, Segoe UI, sans-serif";
      context.fillText("横轴：屏幕位置（左边缘 → 中心 → 右边缘）", width / 2 - 102, height - 12);
      context.save();
      context.translate(18, height / 2 + 64);
      context.rotate(-Math.PI / 2);
      context.fillText("纵轴：局部 PPD（越高越细）", 0, 0);
      context.restore();

      context.strokeStyle = colors.accent;
      context.lineWidth = 3;
      context.lineCap = "round";
      context.beginPath();
      curve.forEach((point, index) => {
        const xx = x(point.ratio);
        const yy = y(point.ppd);
        if (index === 0) context.moveTo(xx, yy);
        else context.lineTo(xx, yy);
      });
      context.stroke();

      context.fillStyle = colors.accent;
      curve.filter((_, index) => index % 22 === 0).forEach((point) => {
        context.beginPath();
        context.arc(x(point.ratio), y(point.ppd), 3.5, 0, Math.PI * 2);
        context.fill();
      });

      context.fillStyle = colors.muted;
      context.font = "12px Microsoft YaHei, Segoe UI, sans-serif";
      context.fillText("-边缘", padLeft, height - 30);
      context.fillText("中心", width / 2 - 12, height - 30);
      context.fillText("+边缘", width - padRight - 28, height - 30);
    });
  };

  return (
    <div className="viz-card">
      <div className="viz-header">
        <div>
          <h3>{axis === "x" ? "水平 Local PPD 曲线" : "垂直 Local PPD 曲线"}</h3>
          <p>中心像素张角最大，边缘局部 PPD 会略升高；用于解释“保守值”的来源</p>
        </div>
        <IconButton title="导出 PNG 数据图" onClick={exportPng}>
          <Download size={17} />
        </IconButton>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Local PPD 曲线">
        <rect x="0" y="0" width={width} height={height} rx="8" />
        {thresholds.map((threshold) => {
          const yy = y(threshold.value);
          return (
            <g key={threshold.value}>
              <line x1={padLeft} y1={yy} x2={width - padRight} y2={yy} className="threshold-line" />
              <text x={width - padRight + 6} y={yy + 4} className="threshold-label">
                {threshold.label}
              </text>
            </g>
          );
        })}
        <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} className="axis-line" />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={height - padBottom} className="axis-line" />
        <text x={width / 2 - 102} y={height - 12} className="axis-label">
          横轴：屏幕位置（左边缘 → 中心 → 右边缘）
        </text>
        <text x="18" y={height / 2 + 64} transform={`rotate(-90 18 ${height / 2 + 64})`} className="axis-label">
          纵轴：局部 PPD（越高越细）
        </text>
        <path d={path} className="curve-line" />
        {samplePoints.map((point) => (
          <circle key={point.ratio} cx={x(point.ratio)} cy={y(point.ppd)} r="3.5">
            <title>
              位置 {formatNumber((point.ratio - 0.5) * 100, 1)}% · PPD {formatNumber(point.ppd, 2)}
            </title>
          </circle>
        ))}
        <text x={padLeft} y={height - 30} className="tick-label">
          -边缘
        </text>
        <text x={width / 2 - 12} y={height - 30} className="tick-label">
          中心
        </text>
        <text x={width - padRight - 28} y={height - 30} className="tick-label">
          +边缘
        </text>
      </svg>
    </div>
  );
}

function PpdDistanceChartComponent({ metrics }: { metrics: PpdMetrics }) {
  const width = 720;
  const height = 260;
  const padLeft = 52;
  const padRight = 58;
  const padTop = 28;
  const padBottom = 48;
  const minDistance = 25;
  const maxDistance = 2000;
  const values = useMemo(
    () =>
      Array.from({ length: 81 }, (_, index) => {
        const distance = minDistance + index * 25;
        return {
          distance,
          avg: metrics.pxW / (2 * Math.atan(metrics.widthMm / (2 * distance)) * (180 / Math.PI)),
          local: 1 / (2 * Math.atan(metrics.pitchXmm / (2 * distance)) * (180 / Math.PI))
        };
      }),
    [metrics.pitchXmm, metrics.pxW, metrics.widthMm]
  );
  const maxPpd = Math.max(130, ...values.map((item) => Math.max(item.avg, item.local)));
  const x = (distance: number) => padLeft + ((distance - minDistance) / (maxDistance - minDistance)) * (width - padLeft - padRight);
  const y = (ppd: number) => height - padBottom - (ppd / maxPpd) * (height - padTop - padBottom);
  const paths = useMemo(
    () => ({
      avg: values.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.distance).toFixed(2)} ${y(point.avg).toFixed(2)}`).join(" "),
      local: values.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.distance).toFixed(2)} ${y(point.local).toFixed(2)}`).join(" ")
    }),
    [maxPpd, values]
  );
  const distanceTicks = [25, 500, 1000, 1500, 2000];
  const thresholds = [
    { value: 40, label: "40 及格" },
    { value: 60, label: "60 清晰" },
    { value: 80, label: "80 很高" },
    { value: 120, label: "120 极高" }
  ];
  const currentDistance = Math.min(maxDistance, Math.max(minDistance, metrics.distanceMm));
  const currentX = Math.min(width - padRight, Math.max(padLeft, x(currentDistance)));
  const currentLabelX = Math.min(width - padRight - 112, Math.max(padLeft + 8, currentX + 8));
  const exportPng = () => {
    downloadPng(width, height, "ppd-distance-curve.png", (context) => {
      const colors = chartColors();
      drawChartShell(context, width, height, colors);
      thresholds.forEach((threshold) => drawHorizontalThreshold(context, y(threshold.value), padLeft, width - padRight, threshold.label, width - padRight + 6, colors));

      context.strokeStyle = colors.line;
      context.lineWidth = 1;
      distanceTicks.forEach((tick) => {
        const xx = x(tick);
        context.beginPath();
        context.moveTo(xx, height - padBottom);
        context.lineTo(xx, height - padBottom + 5);
        context.stroke();
        context.fillStyle = colors.muted;
        context.font = "12px Microsoft YaHei, Segoe UI, sans-serif";
        context.fillText(formatNumber(tick / 10, 0), xx - 14, height - 30);
      });
      context.beginPath();
      context.moveTo(padLeft, height - padBottom);
      context.lineTo(width - padRight, height - padBottom);
      context.moveTo(padLeft, padTop);
      context.lineTo(padLeft, height - padBottom);
      context.stroke();

      const drawCurve = (key: "avg" | "local", color: string) => {
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.lineCap = "round";
        context.beginPath();
        values.forEach((point, index) => {
          const xx = x(point.distance);
          const yy = y(point[key]);
          if (index === 0) context.moveTo(xx, yy);
          else context.lineTo(xx, yy);
        });
        context.stroke();
      };
      drawCurve("avg", colors.accent);
      drawCurve("local", colors.accent2);

      context.save();
      context.strokeStyle = colors.accent3;
      context.lineWidth = 2;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(currentX, padTop);
      context.lineTo(currentX, height - padBottom);
      context.stroke();
      context.restore();

      context.fillStyle = colors.accent3;
      context.font = "650 12px Microsoft YaHei, Segoe UI, sans-serif";
      context.fillText(`当前 ${formatNumber(metrics.distanceMm / 10, 0)} cm`, currentLabelX, padTop + 14);
      context.fillStyle = colors.text;
      context.fillText("横轴：观看距离（cm）", width / 2 - 74, height - 12);
      context.save();
      context.translate(18, height / 2 + 58);
      context.rotate(-Math.PI / 2);
      context.fillText("纵轴：PPD 清晰度（越高越细）", 0, 0);
      context.restore();

      context.fillStyle = colors.accent;
      context.fillRect(padLeft + 4, padTop + 5, 12, 3);
      context.fillStyle = colors.muted;
      context.font = "13px Microsoft YaHei, Segoe UI, sans-serif";
      context.fillText("平均 PPD", padLeft + 22, padTop + 14);
      context.fillStyle = colors.accent2;
      context.fillRect(padLeft + 4, padTop + 22, 12, 3);
      context.fillText("局部 PPD", padLeft + 22, padTop + 31);
    });
  };

  return (
    <div className="viz-card">
      <div className="viz-header">
        <div>
          <h3>PPD 随视距变化</h3>
          <p>视距越远，单像素张角越小，PPD 越高；同时观看角下降</p>
        </div>
        <IconButton title="导出 PNG 曲线" onClick={exportPng}>
          <Download size={17} />
        </IconButton>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <rect x="0" y="0" width={width} height={height} rx="8" />
        {thresholds.map((threshold) => (
          <g key={threshold.value}>
            <line x1={padLeft} y1={y(threshold.value)} x2={width - padRight} y2={y(threshold.value)} className="threshold-line" />
            <text x={width - padRight + 6} y={y(threshold.value) + 4} className="threshold-label">
              {threshold.label}
            </text>
          </g>
        ))}
        {distanceTicks.map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} y1={height - padBottom} x2={x(tick)} y2={height - padBottom + 5} className="axis-line" />
            <text x={x(tick) - 14} y={height - 30} className="tick-label">
              {formatNumber(tick / 10, 0)}
            </text>
          </g>
        ))}
        <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} className="axis-line" />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={height - padBottom} className="axis-line" />
        <path d={paths.avg} className="curve-line avg" />
        <path d={paths.local} className="curve-line local" />
        <line x1={currentX} x2={currentX} y1={padTop} y2={height - padBottom} className="current-line" />
        <text x={currentLabelX} y={padTop + 14} className="current-label">
          当前 {formatNumber(metrics.distanceMm / 10, 0)} cm
        </text>
        <text x={width / 2 - 74} y={height - 12} className="axis-label">
          横轴：观看距离（cm）
        </text>
        <text x="18" y={height / 2 + 58} transform={`rotate(-90 18 ${height / 2 + 58})`} className="axis-label">
          纵轴：PPD 清晰度（越高越细）
        </text>
        <rect x={padLeft + 4} y={padTop + 5} width="12" height="3" fill="currentColor" className="legend-average" />
        <text x={padLeft + 22} y={padTop + 14}>
          平均 PPD
        </text>
        <rect x={padLeft + 4} y={padTop + 22} width="12" height="3" fill="currentColor" className="legend-local" />
        <text x={padLeft + 22} y={padTop + 31} className="local-label">
          局部 PPD
        </text>
      </svg>
    </div>
  );
}

export const PpdCurveChart = memo(PpdCurveChartComponent);
export const PpdDistanceChart = memo(PpdDistanceChartComponent);

