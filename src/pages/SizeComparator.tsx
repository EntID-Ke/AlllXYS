import { Copy, ExternalLink, Plus, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import type { AppState, PageId, SizeScreenSpec } from "../types";
import { lengthUnits } from "../data/presets";
import { IconButton, Segmented, SelectField } from "../components/Controls";
import { FormulaList, FormulaPanel } from "../components/FormulaPanel";
import { MetricTable, ResultCard } from "../components/ResultCard";
import { ScreenComparisonSvg } from "../components/ScreenComparisonSvg";
import { ScreenEditor } from "../components/ScreenEditor";
import { SizeComparisonSceneLazy } from "../components/LazyThreeScenes";
import { solveScreenGeometry, solveScreenGeometryStrict, solveScreenMetrics, viewingAngleDeg } from "../lib/screenMath";
import { defaultState } from "../lib/state";
import { formatNumber, fromMm } from "../lib/units";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { useContainedScroll } from "../hooks/useContainedScroll";

interface PageProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setPage: (page: PageId) => void;
}

function updateSize(state: AppState, patch: Partial<AppState["size"]>): AppState {
  return { ...state, size: { ...state.size, ...patch } };
}

function updateScreen(screens: SizeScreenSpec[], index: number, patch: Partial<SizeScreenSpec>): SizeScreenSpec[] {
  return screens.map((screen, current) => (current === index ? { ...screen, ...patch } : screen));
}

function sanitizeAlignForMode(visualMode: AppState["size"]["visualMode"], sceneMode: AppState["size"]["sceneMode"], align: AppState["size"]["align"]) {
  if (sceneMode === "room" && align === "center") return "bottom";
  return visualMode === "side-by-side" && align !== "center" && align !== "bottom" ? "bottom" : align;
}

function cycleEqualMode(mode: AppState["size"]["equivalentMode"]) {
  return mode === "same-width" ? "same-height" : "same-width";
}

function equivalentScreens(screens: SizeScreenSpec[], mode: AppState["size"]["equivalentMode"]): SizeScreenSpec[] {
  if (mode === "free") return screens;
  const first = screens.find((screen) => screen.enabled);
  if (!first) return screens;
  const base = solveScreenGeometryStrict(first);
  if (!base) return screens;
  return screens.map((screen) => {
    if (!screen.enabled) return screen;
    if (mode === "same-diagonal") return { ...screen, mode: "diagonal", diagonal: fromMm(base.diagonalMm, first.diagonalUnit), diagonalUnit: first.diagonalUnit };
    if (mode === "same-width") return { ...screen, mode: "physical", width: fromMm(base.widthMm, "cm"), widthUnit: "cm", height: "" };
    return { ...screen, mode: "physical", height: fromMm(base.heightMm, "cm"), heightUnit: "cm", width: "" };
  });
}

function tvDistanceRows(widthMm: number) {
  const presets = [
    { label: "SMPTE 30°", angle: 30 },
    { label: "THX 36°", angle: 36 },
    { label: "4K 沉浸 45°", angle: 45 }
  ];
  return presets.map((preset) => ({
    label: preset.label,
    distanceMm: widthMm / (2 * Math.tan((preset.angle * Math.PI) / 360))
  }));
}

export function SizeComparator({ state, setState, setPage }: PageProps) {
  const copyResult = useCopyFeedback("复制结果");
  const sideScroll = useContainedScroll<HTMLElement>();
  const visualScreens = useMemo(() => equivalentScreens(state.size.screens, state.size.equivalentMode), [state.size.equivalentMode, state.size.screens]);
  const active = useMemo(() => visualScreens.filter((screen) => screen.enabled), [visualScreens]);
  const activeRows = useMemo(
    () =>
      active.map((screen) => ({
        screen,
        geometry: solveScreenGeometryStrict(screen),
        metrics: solveScreenMetrics(screen)
      })),
    [active]
  );
  const activeGeometry = useMemo(
    () =>
      activeRows
        .map(({ screen, geometry }) => (geometry ? { ...geometry, id: screen.id, name: screen.name, color: screen.color } : null))
        .filter((screen): screen is NonNullable<typeof screen> => Boolean(screen)),
    [activeRows]
  );
  const base = activeRows[0]?.geometry ?? null;
  const second = activeRows[1]?.geometry ?? null;
  const areaDelta = base && second ? ((second.areaMm2 - base.areaMm2) / base.areaMm2) * 100 : null;
  const widthDelta = base && second ? second.widthMm - base.widthMm : null;
  const heightDelta = base && second ? second.heightMm - base.heightMm : null;
  const nextCornerAlign: AppState["size"]["align"] = state.size.align === "bottom-left" ? "bottom-right" : "bottom-left";
  const baseSummary = activeRows
    .map(({ screen, geometry }) => {
      if (!geometry) return `${screen.name}: 尺寸无效`;
      return `${screen.name}: ${formatNumber(fromMm(geometry.diagonalMm, "in"), 2)} in, ${formatNumber(fromMm(geometry.widthMm, state.size.displayUnit), 2)}×${formatNumber(fromMm(geometry.heightMm, state.size.displayUnit), 2)} ${state.size.displayUnit}`;
    })
    .join("\n");
  const diffSummary =
    areaDelta !== null && widthDelta !== null && heightDelta !== null
      ? `\n副屏面积差异: ${areaDelta >= 0 ? "+" : ""}${formatNumber(areaDelta, 2)}%\n宽高差异: ${widthDelta >= 0 ? "+" : ""}${formatNumber(fromMm(widthDelta, state.size.displayUnit), 2)} / ${heightDelta >= 0 ? "+" : ""}${formatNumber(fromMm(heightDelta, state.size.displayUnit), 2)} ${state.size.displayUnit}`
      : "";
  const summary = `${baseSummary}${diffSummary}`;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>scale</h1>
          <p>True-scale comparison for diagonals, area, width, height and equivalent screen relationships.</p>
        </div>
        <div className="action-row">
          <button type="button" onClick={() => copyResult.copy(summary || "AlllXYS 尺寸比对暂无结果")}>
            <Copy size={16} /> {copyResult.label}
          </button>
          <button type="button" onClick={() => setState((prev) => ({ ...prev, size: defaultState.size }))}>
            <RotateCcw size={16} /> 恢复默认
          </button>
        </div>
      </section>

      <section className="size-layout">
        <aside className="panel sticky-panel size-controls" ref={sideScroll.ref} onWheel={sideScroll.onWheel}>
          <section className="control-group">
            <div className="group-title">
              <h3>比对模式</h3>
            </div>
            <Segmented
              label="渲染"
              value={state.size.visualMode}
              onChange={(visualMode) => setState((prev) => updateSize(prev, { visualMode, align: sanitizeAlignForMode(visualMode, prev.size.sceneMode, prev.size.align) }))}
              options={[
                { value: "overlay", label: "覆盖叠加" },
                { value: "side-by-side", label: "并排比对" }
              ]}
            />
            <Segmented
              label="场景"
              value={state.size.sceneMode}
              onChange={(sceneMode) => setState((prev) => updateSize(prev, { sceneMode, align: sanitizeAlignForMode(prev.size.visualMode, sceneMode, prev.size.align) }))}
              options={[
                { value: "flat", label: "2D" },
                { value: "room", label: "3D" }
              ]}
            />
            <Segmented
              label="对齐"
              value={state.size.align}
              onChange={(align) => setState((prev) => updateSize(prev, { align }))}
              options={[
                ...(state.size.sceneMode === "room" ? [] : [{ value: "center" as const, label: "居中" }]),
                { value: "bottom" as const, label: "底边" },
                ...(state.size.visualMode === "side-by-side"
                  ? []
                  : [
                      { value: nextCornerAlign, label: state.size.align === "bottom-left" ? "右下" : "左下" }
                    ])
              ]}
            />
            <Segmented
              label="等效"
              value={state.size.equivalentMode}
              onChange={(equivalentMode) => setState((prev) => updateSize(prev, { equivalentMode }))}
              options={[
                { value: "free", label: "自由尺寸" },
                { value: cycleEqualMode(state.size.equivalentMode), label: state.size.equivalentMode === "same-width" ? "同高" : "同宽" },
                { value: "same-diagonal", label: "同对角线" }
              ]}
            />
            <SelectField
              label="显示单位"
              value={state.size.displayUnit}
              onChange={(displayUnit) => setState((prev) => updateSize(prev, { displayUnit }))}
              options={lengthUnits.map((item) => ({ value: item.value, label: item.label }))}
            />
            <label className="check-row">
              <input type="checkbox" checked={state.size.tvMode} onChange={(event) => setState((prev) => updateSize(prev, { tvMode: event.target.checked }))} />
              TV 观看距离模式
            </label>
          </section>

          {state.size.screens.map((screen, index) => (
            <section className="screen-card" key={screen.id}>
              <div className="screen-card-head">
                <label className="check-row">
                  <input type="checkbox" checked={screen.enabled} onChange={(event) => setState((prev) => updateSize(prev, { screens: updateScreen(prev.size.screens, index, { enabled: event.target.checked }) }))} />
                  启用
                </label>
                <input
                  className="name-input"
                  value={screen.name}
                  onChange={(event) => setState((prev) => updateSize(prev, { screens: updateScreen(prev.size.screens, index, { name: event.target.value }) }))}
                />
                <input
                  type="color"
                  value={screen.color}
                  title="颜色"
                  onChange={(event) => setState((prev) => updateSize(prev, { screens: updateScreen(prev.size.screens, index, { color: event.target.value }) }))}
                />
              </div>
              <ScreenEditor
                spec={screen}
                compact
                title={`屏幕 ${index + 1}`}
                onChange={(next) => setState((prev) => updateSize(prev, { screens: updateScreen(prev.size.screens, index, next as SizeScreenSpec) }))}
              />
              <div className="mini-action-row">
                <IconButton
                  title="把这块屏幕带到 PPD 工作台"
                  onClick={() => {
                    setState((prev) => ({ ...prev, primary: { ...screen, id: "primary" } }));
                    setPage("ppd");
                  }}
                >
                  <ExternalLink size={16} />
                </IconButton>
                <IconButton
                  title="把这块屏幕带到可视角度页"
                  onClick={() => {
                    setState((prev) => ({ ...prev, angle: { ...prev.angle, screen: { ...screen, id: "angle-screen" } } }));
                    setPage("angle");
                  }}
                >
                  <Plus size={16} />
                </IconButton>
              </div>
            </section>
          ))}
        </aside>

        <section className="content-stack">
          <div className="insight-strip">
            <div>
              <span>当前模式</span>
              <strong>{state.size.visualMode === "overlay" ? "覆盖叠加" : "并排比对"} · {active.length} 块屏幕</strong>
            </div>
            <div>
              <span>副屏面积差异</span>
              <strong>{areaDelta === null ? "等待第二块屏幕" : `${areaDelta >= 0 ? "+" : ""}${formatNumber(areaDelta, 2)}%`}</strong>
            </div>
            <div>
              <span>宽高差异</span>
              <strong>
                {widthDelta === null || heightDelta === null
                  ? "—"
                  : `${widthDelta >= 0 ? "+" : ""}${formatNumber(fromMm(widthDelta, state.size.displayUnit), 1)} / ${heightDelta >= 0 ? "+" : ""}${formatNumber(fromMm(heightDelta, state.size.displayUnit), 1)} ${state.size.displayUnit}`}
              </strong>
            </div>
          </div>

          {state.size.sceneMode === "room" ? (
            <SizeComparisonSceneLazy screens={activeGeometry} mode={state.size.visualMode} align={state.size.align} />
          ) : (
            <ScreenComparisonSvg screens={visualScreens} mode={state.size.visualMode} align={state.size.align} displayUnit={state.size.displayUnit} />
          )}

          <div className="panel">
            <h2>尺寸与差异</h2>
            <div className="screen-result-grid">
              {activeRows.map(({ screen, geometry, metrics }) => {
                if (!geometry) {
                  return (
                    <article className="screen-result-card" key={screen.id} style={{ borderColor: screen.color }}>
                      <h3>{screen.name}</h3>
                      <p className="empty-note">请填写有效的大于 0 的屏幕尺寸</p>
                    </article>
                  );
                }
                const widthDiff = base ? geometry.widthMm - base.widthMm : 0;
                const heightDiff = base ? geometry.heightMm - base.heightMm : 0;
                const areaDiff = base ? ((geometry.areaMm2 - base.areaMm2) / base.areaMm2) * 100 : 0;
                return (
                  <article className="screen-result-card" key={screen.id} style={{ borderColor: screen.color }}>
                    <h3>{screen.name}</h3>
                    <MetricTable
                      rows={[
                        { label: "对角线", value: `${formatNumber(fromMm(geometry.diagonalMm, "in"), 2)} in` },
                        { label: "宽 × 高", value: `${formatNumber(fromMm(geometry.widthMm, state.size.displayUnit), 2)} × ${formatNumber(fromMm(geometry.heightMm, state.size.displayUnit), 2)} ${state.size.displayUnit}` },
                        { label: "面积", value: `${formatNumber(geometry.areaMm2 / 100, 2)} cm²` },
                        { label: "宽高比", value: geometry.aspect.label },
                        { label: "宽度差异", value: `${formatNumber(fromMm(widthDiff, state.size.displayUnit), 2)} ${state.size.displayUnit}` },
                        { label: "高度差异", value: `${formatNumber(fromMm(heightDiff, state.size.displayUnit), 2)} ${state.size.displayUnit}` },
                        { label: "面积差异", value: `${formatNumber(areaDiff, 2)}%` },
                        { label: "PPI", value: metrics ? formatNumber(metrics.ppi, 2) : "—", note: metrics ? `${metrics.pxW}×${metrics.pxH}` : "填写分辨率后显示" }
                      ]}
                    />
                  </article>
                );
              })}
            </div>
          </div>

          {state.size.tvMode && base ? (
            <div className="panel">
              <h2>TV 观看距离模式</h2>
              <p className="subtle">这些建议基于水平观看角标准，属于偏好/标准模型，不是唯一正确答案</p>
              <div className="comparison-grid">
                {tvDistanceRows(base.widthMm).map((row) => (
                  <ResultCard key={row.label} label={row.label} value={formatNumber(fromMm(row.distanceMm, state.size.displayUnit), 2)} unit={state.size.displayUnit}>
                    当前主屏 HVA 约 {formatNumber(viewingAngleDeg(base.widthMm, row.distanceMm), 1)}°
                  </ResultCard>
                ))}
              </div>
            </div>
          ) : null}

          <FormulaPanel defaultOpen>
            <FormulaList
              items={[
                { title: "对角线 + 宽高比", body: "给定对角线和宽高比 a:b 时，宽高来自同一个直角三角形，不提前四舍五入", formula: "width = diag * a / sqrt(a²+b²); height = diag * b / sqrt(a²+b²)" },
                { title: "宽/高反解", body: "给定宽度和比例时反解高度；给定高度和比例时反解宽度；同时给宽高时直接使用真实物理尺寸" },
                { title: "同宽/同高/同对角线", body: "等效模式只改变可视化与结果中的比较条件，便于理解同样对角线下 21:9 为什么更宽更矮，或同宽下不同屏幕高度差异" },
                { title: "PPI", body: "如果输入分辨率，会顺带显示 PPI；可一键带到 PPD 工作台继续纳入视距计算", formula: "PPI = sqrt(pxW²+pxH²) / diagonalInch" }
              ]}
            />
          </FormulaPanel>
        </section>
      </section>
    </div>
  );
}

