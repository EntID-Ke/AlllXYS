import { Copy, ExternalLink, Link2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { AppState, PageId, ViewSpec } from "../types";
import { ScreenEditor } from "../components/ScreenEditor";
import { NumberField, Segmented, SelectField } from "../components/Controls";
import { FormulaList, FormulaPanel } from "../components/FormulaPanel";
import { MetricTable, ResultCard } from "../components/ResultCard";
import { PpdCurveChart, PpdDistanceChart } from "../components/Charts";
import { PpdSceneLazy } from "../components/LazyThreeScenes";
import { ClarityScale } from "../components/ClarityScale";
import { defaultState, shareUrlForState } from "../lib/state";
import { equivalentForSecond, solvePpdMetrics, solveScreenMetrics, validateScreenSpec } from "../lib/screenMath";
import { formatNumber, fromMm, toMm } from "../lib/units";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { useContainedScroll } from "../hooks/useContainedScroll";

interface PageProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setPage: (page: PageId) => void;
}

const comfortOptions: { value: ViewSpec["comfortMode"]; label: string }[] = [
  { value: "general", label: "通用舒适 · 50° HVA" },
  { value: "cinema", label: "影视沉浸 · 40° HVA" },
  { value: "desktop", label: "桌面近距 · 60° HVA" },
  { value: "nhk", label: "NHK · 30° HVA" },
  { value: "thx", label: "THX · 36° HVA" },
  { value: "custom", label: "自定义目标角" }
];
const targetPpdPresets = [40, 60, 80, 120];

function updateView(state: AppState, patch: Partial<AppState["view"]>): AppState {
  return { ...state, view: { ...state.view, ...patch } };
}

function lockSecondaryToPrimary(state: AppState, diagonal: number | "", diagonalUnit = state.secondary.diagonalUnit) {
  return {
    ...state.primary,
    id: state.secondary.id,
    name: state.secondary.name,
    diagonal,
    diagonalUnit,
    mode: "diagonal" as const
  };
}

function formatDistanceOrDash(distanceMm: number | null | undefined, unit: ViewSpec["distanceUnit"], digits = 2) {
  return distanceMm !== null && distanceMm !== undefined ? formatNumber(fromMm(distanceMm, unit), digits) : "—";
}

export function ClarityWorkbench({ state, setState, setPage }: PageProps) {
  const copyResult = useCopyFeedback("复制结果");
  const copyLink = useCopyFeedback("复制分享链接");
  const sideScroll = useContainedScroll<HTMLElement>();
  const secondaryEnabled = state.view.compareEnabled !== false;
  const secondaryMode = state.view.secondaryMode ?? "ray";
  const secondaryDistanceValue = state.view.secondaryDistance === "" ? state.view.distance : state.view.secondaryDistance;
  const secondaryDistanceUnit = state.view.secondaryDistance === "" ? state.view.distanceUnit : state.view.secondaryDistanceUnit;
  const secondaryView: ViewSpec = useMemo(() => ({ ...state.view, distance: secondaryDistanceValue, distanceUnit: secondaryDistanceUnit }), [secondaryDistanceUnit, secondaryDistanceValue, state.view]);
  const secondaryDistanceMm = useMemo(() => toMm(secondaryDistanceValue, secondaryDistanceUnit), [secondaryDistanceUnit, secondaryDistanceValue]);
  const primary = useMemo(() => solvePpdMetrics(state.primary, state.view), [state.primary, state.view]);
  const secondaryMetrics = useMemo(() => (secondaryEnabled ? solveScreenMetrics(state.secondary) : null), [secondaryEnabled, state.secondary]);
  const secondaryPpd = useMemo(() => (secondaryEnabled ? solvePpdMetrics(state.secondary, secondaryView) : null), [secondaryEnabled, secondaryView, state.secondary]);
  const comparison = useMemo(
    () => (secondaryEnabled && primary && secondaryMetrics ? equivalentForSecond(primary, secondaryMetrics, state.view.ppdMode, secondaryDistanceMm ?? primary.distanceMm) : null),
    [primary, secondaryDistanceMm, secondaryEnabled, secondaryMetrics, state.view.ppdMode]
  );
  const warnings = useMemo(
    () => (secondaryEnabled ? [...validateScreenSpec(state.primary, true), ...validateScreenSpec(state.secondary, true)] : validateScreenSpec(state.primary, true)),
    [secondaryEnabled, state.primary, state.secondary]
  );
  const metricName = state.view.ppdMode === "average" ? "Average Horizontal PPD" : "Local Horizontal PPD";
  const activePpd = primary ? (state.view.ppdMode === "average" ? primary.ppdHAvg : primary.ppdHLocalCenter) : null;
  const targetGap = activePpd !== null && Number.isFinite(activePpd) ? activePpd - state.view.targetPpd : null;
  const cvdForMode = primary ? (state.view.ppdMode === "local" ? primary.cvdLocalXmm : primary.cvdAvgHmm) : null;
  const handleSecondaryModeChange = useCallback((nextMode: ViewSpec["secondaryMode"]) => {
    setState((prev) => updateView(prev, { secondaryMode: nextMode }));
  }, [setState]);
  const handleSceneSecondaryDistanceChange = useCallback(
    (distanceMm: number) => {
      setState((prev) =>
        updateView(prev, {
          secondaryDistance: Number(fromMm(distanceMm, prev.view.secondaryDistanceUnit).toFixed(2))
        })
      );
    },
    [setState]
  );

  const summary = primary
    ? `AlllXYS 结果：${state.primary.name}，${formatNumber(fromMm(primary.diagonalMm, "in"), 2)} in，${primary.pxW}×${primary.pxH}，视距 ${formatNumber(fromMm(primary.distanceMm, state.view.distanceUnit), 2)} ${state.view.distanceUnit}PPI ${formatNumber(primary.ppi, 2)}，Average H-PPD ${formatNumber(primary.ppdHAvg, 2)}，Local H-PPD ${formatNumber(primary.ppdHLocalCenter, 2)}，HVA ${formatNumber(primary.hvaDeg, 2)}°，VVA ${formatNumber(primary.vvaDeg, 2)}°`
    : "AlllXYS 暂无可复制结果";

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>perception</h1>
          <p>PPD, PPI, CVD and viewing distance in one live display geometry workbench.</p>
        </div>
        <div className="action-row">
          <button type="button" onClick={() => copyResult.copy(summary)}>
            <Copy size={16} /> {copyResult.label}
          </button>
          <button type="button" onClick={() => setState({ ...defaultState, theme: state.theme })}>
            <RotateCcw size={16} /> 恢复默认
          </button>
          <button
            type="button"
            onClick={() => {
              setState((prev) => ({ ...prev, angle: { ...prev.angle, screen: { ...prev.primary, id: "angle-screen" }, distance: prev.view.distance, distanceUnit: prev.view.distanceUnit } }));
              setPage("angle");
            }}
          >
            <ExternalLink size={16} /> 带到角度页
          </button>
        </div>
      </section>

      {warnings.length ? (
        <div className="warning-strip">
          {warnings.slice(0, 3).map((warning, index) => (
            <span key={`${warning.field}-${index}`}>{warning.message}</span>
          ))}
        </div>
      ) : null}

      <section className="workbench-grid">
        <aside className="panel sticky-panel" ref={sideScroll.ref} onWheel={sideScroll.onWheel}>
          <ScreenEditor spec={state.primary} onChange={(primary) => setState((prev) => ({ ...prev, primary }))} title="主屏规格" />
          <section className="control-group">
            <div className="group-title">
              <h3>观看与阈值</h3>
            </div>
            <NumberField
              label="视距"
              value={state.view.distance}
              min={0.01}
              step={0.1}
              unit={state.view.distanceUnit}
              onChange={(distance) => setState((prev) => updateView(prev, { distance }))}
              onUnitChange={(distanceUnit) => setState((prev) => updateView(prev, { distanceUnit }))}
              units={["cm", "m", "mm", "in", "ft"]}
            />
            <Segmented
              label="等效口径"
              value={state.view.ppdMode}
              onChange={(ppdMode) => setState((prev) => updateView(prev, { ppdMode }))}
              options={[
                { value: "average", label: "Average PPD", title: "像素数除以总观看角" },
                { value: "local", label: "Local PPD", title: "用单像素中心张角计算，偏保守" }
              ]}
            />
            <div className="threshold-row">
              {targetPpdPresets.map((value) => (
                <button key={value} type="button" className={state.view.targetPpd === value ? "active" : ""} onClick={() => setState((prev) => updateView(prev, { targetPpd: value }))}>
                  {value} PPD
                </button>
              ))}
            </div>
            <NumberField label="目标 PPD" value={state.view.targetPpd} min={1} step={1} onChange={(targetPpd) => targetPpd !== "" && setState((prev) => updateView(prev, { targetPpd }))} />
            <SelectField label="参考观看距离模型" value={state.view.comfortMode} onChange={(comfortMode) => setState((prev) => updateView(prev, { comfortMode }))} options={comfortOptions} />
            {state.view.comfortMode === "custom" ? (
              <NumberField label="自定义水平观看角" value={state.view.customComfortAngle} min={1} max={120} step={0.5} suffix="°" onChange={(customComfortAngle) => setState((prev) => updateView(prev, { customComfortAngle }))} />
            ) : null}
          </section>
          {secondaryEnabled ? (
            <>
              <section className="control-group compact compare-control">
                <div className="group-title">
                  <h3>副屏对比</h3>
                  <button type="button" onClick={() => setState((prev) => updateView(prev, { compareEnabled: false }))}>
                    <Trash2 size={16} /> 移除
                  </button>
                </div>
                <p>副屏只在需要等效清晰度或 3D 前后距离参考时启用</p>
                <NumberField
                  label="副屏视距"
                  value={state.view.secondaryDistance}
                  min={0.01}
                  step={0.1}
                  unit={state.view.secondaryDistanceUnit}
                  onChange={(secondaryDistance) => setState((prev) => updateView(prev, { secondaryDistance }))}
                  onUnitChange={(secondaryDistanceUnit) => setState((prev) => updateView(prev, { secondaryDistanceUnit }))}
                  units={["cm", "m", "mm", "in", "ft"]}
                  hint="留空跟随主屏"
                />
              </section>
              {secondaryMode === "ray" ? (
                <section className="control-group compact locked-secondary-editor">
                <div className="group-title">
                  <h3>副屏 / 等效对象</h3>
                </div>
                <p>等效视锥模式下副屏沿用主屏比例与像素结构，只开放对角线作为尺寸目标</p>
                <NumberField
                  label="对角线"
                  value={state.secondary.diagonal}
                  min={0.1}
                  step={0.1}
                  unit={state.secondary.diagonalUnit}
                  units={["in", "cm", "m", "mm"]}
                  onChange={(diagonal) => setState((prev) => ({ ...prev, secondary: lockSecondaryToPrimary(prev, diagonal) }))}
                  onUnitChange={(diagonalUnit) => setState((prev) => ({ ...prev, secondary: lockSecondaryToPrimary(prev, prev.secondary.diagonal, diagonalUnit) }))}
                />
                </section>
              ) : (
                <ScreenEditor spec={state.secondary} onChange={(secondary) => setState((prev) => ({ ...prev, secondary }))} title="副屏" />
              )}
            </>
          ) : (
            <section className="control-group compact compare-control">
              <div className="group-title">
                <h3>副屏对比</h3>
              </div>
              <p>当前只看主屏需要比较另一块屏幕时再添加副屏</p>
              <button type="button" onClick={() => setState((prev) => updateView(prev, { compareEnabled: true }))}>
                <Plus size={16} /> 添加副屏
              </button>
            </section>
          )}
        </aside>

        <section className="content-stack">
          {primary ? (
            <>
              <div className="insight-strip">
                <div>
                  <span>当前判断</span>
                  <strong>{activePpd && targetGap !== null ? (targetGap >= 0 ? `已达到 ${state.view.targetPpd} PPD 阈值` : `距离 ${state.view.targetPpd} PPD 还差 ${formatNumber(Math.abs(targetGap), 2)}`) : "等待有效输入"}</strong>
                </div>
                <div>
                  <span>保守口径</span>
                  <strong>{formatNumber(Math.min(primary.ppdHLocalCenter, primary.ppdVLocalCenter), 2)} PPD</strong>
                </div>
                <div>
                  <span>视场状态</span>
                  <strong>{formatNumber(primary.hvaDeg, 1)}° HVA · {formatNumber(primary.vvaDeg, 1)}° VVA</strong>
                </div>
              </div>

              <div className="result-grid">
                <ResultCard label="PPI" value={formatNumber(primary.ppi, 2)} tone="strong">
                  仅描述屏幕自身像素密度，不包含视距
                </ResultCard>
                <ResultCard label="Average H-PPD" value={formatNumber(primary.ppdHAvg, 2)}>
                  水平像素数 / 水平观看角
                </ResultCard>
                <ResultCard label="Local H-PPD" value={formatNumber(primary.ppdHLocalCenter, 2)} tone="strong">
                  中心单像素水平张角的倒数，当前清晰度标签：{primary.clarityLabel}
                </ResultCard>
                <ResultCard label="CVD" value={formatDistanceOrDash(cvdForMode, state.view.distanceUnit)} unit={cvdForMode ? state.view.distanceUnit : undefined}>
                  达到 {state.view.targetPpd} PPD 的反解距离
                </ResultCard>
                <ResultCard label="参考观看距离" value={formatNumber(fromMm(primary.pvdMm, state.view.distanceUnit), 2)} unit={state.view.distanceUnit} tone="warning">
                  按{formatNumber(primary.pvdAngleDeg, 1)}°水平观看角估算，模型只作偏好参考
                </ResultCard>
                <ResultCard label="HVA / VVA" value={`${formatNumber(primary.hvaDeg, 2)}° / ${formatNumber(primary.vvaDeg, 2)}°`}>
                  当前视距下屏幕的水平/垂直角宽
                </ResultCard>
              </div>

              <ClarityScale local={Math.min(primary.ppdHLocalCenter, primary.ppdVLocalCenter)} average={Math.min(primary.ppdHAvg, primary.ppdVAvg)} target={state.view.targetPpd} />

              <div className="panel">
                <h2>完整指标</h2>
                <MetricTable
                  rows={[
                    { label: "物理宽度", value: `${formatNumber(fromMm(primary.widthMm, "cm"), 2)} cm` },
                    { label: "物理高度", value: `${formatNumber(fromMm(primary.heightMm, "cm"), 2)} cm` },
                    { label: "屏幕面积", value: `${formatNumber(primary.areaMm2 / 100, 2)} cm²` },
                    { label: "像素间距 X / Y", value: `${formatNumber(primary.pitchXmm, 4)} / ${formatNumber(primary.pitchYmm, 4)} mm` },
                    { label: "对角观看角 DVA", value: `${formatNumber(primary.dvaDeg, 2)}°` },
                    { label: "Average V / D PPD", value: `${formatNumber(primary.ppdVAvg, 2)} / ${formatNumber(primary.ppdDAvg, 2)}` },
                    { label: "Local V-PPD", value: formatNumber(primary.ppdVLocalCenter, 2), note: "中心单像素垂直张角倒数" },
                    { label: "CVD Local X / Y", value: `${formatDistanceOrDash(primary.cvdLocalXmm, state.view.distanceUnit)} / ${formatDistanceOrDash(primary.cvdLocalYmm, state.view.distanceUnit)} ${state.view.distanceUnit}` },
                    { label: "CVD Average H / V", value: `${formatDistanceOrDash(primary.cvdAvgHmm, state.view.distanceUnit)} / ${formatDistanceOrDash(primary.cvdAvgVmm, state.view.distanceUnit)} ${state.view.distanceUnit}` }
                  ]}
                />
              </div>

              {secondaryEnabled ? (
                <div className="panel compare-panel">
                  <div className="panel-title-row">
                    <div>
                      <h2>等效感知清晰度比对</h2>
                      <p>当前按 {metricName} 判断，两块屏幕共享同一视距输入</p>
                    </div>
                    <button type="button" onClick={() => copyLink.copy(shareUrlForState("ppd", state), "链接已复制")}>
                      <Link2 size={16} /> {copyLink.label}
                    </button>
                  </div>
                  {comparison && secondaryPpd ? (
                    <>
                      <p className="compare-sentence">
                        {state.primary.name} 在 {formatNumber(fromMm(primary.distanceMm, state.view.distanceUnit), 2)} {state.view.distanceUnit} 下的 {metricName} 为 {formatNumber(comparison.target, 2)}；
                        {state.secondary.name} 在 {formatNumber(fromMm(secondaryDistanceMm ?? primary.distanceMm, secondaryDistanceUnit), 2)} {secondaryDistanceUnit} 下为 {formatNumber(comparison.metricAtSameDistance, 2)}，
                        {comparison.distanceToMatch ? `约需放到 ${formatNumber(fromMm(comparison.distanceToMatch, state.view.distanceUnit), 2)} ${state.view.distanceUnit} 才能匹配` : "当前目标角过大，无法用 Average 模式反解出稳定距离"}
                      </p>
                      <div className="comparison-grid">
                        <ResultCard label="同视距谁更清晰" value={comparison.metricAtSameDistance >= comparison.target ? "副屏更清晰或相当" : "主屏更清晰"} tone={comparison.metricAtSameDistance >= comparison.target ? "ok" : "warning"}>
                          主屏 {formatNumber(comparison.target, 2)}，副屏 {formatNumber(comparison.metricAtSameDistance, 2)}
                        </ResultCard>
                        <ResultCard label="副屏需要放到" value={comparison.distanceToMatch ? formatNumber(fromMm(comparison.distanceToMatch, state.view.distanceUnit), 2) : "—"} unit={comparison.distanceToMatch ? state.view.distanceUnit : undefined}>
                          才能匹配主屏 {formatNumber(comparison.target, 2)} PPD
                        </ResultCard>
                        <ResultCard label="副屏同视距等效尺寸" value={formatNumber(comparison.requiredDiagonalIn, 2)} unit="in">
                          保持副屏分辨率与比例，调到该对角线约等效
                        </ResultCard>
                        <ResultCard label="副屏同视距所需分辨率" value={`${comparison.requiredPxW}×${comparison.requiredPxH}`}>
                          保持物理尺寸与比例，按当前口径达到主屏清晰度
                        </ResultCard>
                      </div>
                    </>
                  ) : (
                    <p className="empty-note">填写副屏分辨率后可进行等效比对</p>
                  )}
                </div>
              ) : null}

              <PpdSceneLazy
                primary={primary}
                secondary={secondaryEnabled ? secondaryMetrics : null}
                secondaryDistanceMm={secondaryDistanceMm ?? primary.distanceMm}
                secondaryMode={secondaryMode}
                onSecondaryModeChange={handleSecondaryModeChange}
                onSecondaryDistanceChange={handleSceneSecondaryDistanceChange}
              />
              <div className="split-grid">
                <PpdDistanceChart metrics={primary} />
                <PpdCurveChart metrics={primary} axis="x" />
              </div>

            </>
          ) : (
            <div className="panel empty-note">请填写正整数分辨率和大于 0 的视距</div>
          )}

          <FormulaPanel defaultOpen>
            <FormulaList
              items={[
                { title: "PPI", body: "PPI 是屏幕自身的像素密度，只由分辨率与物理对角线决定；它不等于人眼感知清晰度", formula: "PPI = sqrt(pxW² + pxH²) / diagonalInch" },
                { title: "Average PPD", body: "Average PPD 把一整条轴上的像素数平均分配到整块屏幕张开的观看角里", formula: "PPD_h_avg = pxW / HVA" },
                { title: "Minimum / Local PPD", body: "默认 Local PPD 用中心单像素张角计算平面屏在中心处单位像素张角最大，因此该值可作为保守清晰度口径", formula: "PPD_h_local = 1 / deg(2 atan(pitchX / (2 distance)))" },
                { title: "CVD", body: "CVD 是给定目标 PPD 后反解的观看距离Local 模式直接由像素间距反解，Average 模式由目标观看角反解", formula: "distance_local = pitch / (2 tan(pi / (360T)))" },
                { title: "参考观看距离", body: "该距离按目标水平观看角反推，属于内容类型和个人偏好的参考值，例如通用舒适 50°、影视沉浸 40°、桌面近距 60°、NHK 30°、THX 36°；不存在唯一正确答案", formula: "distance = width / (2 tan(theta / 2))" },
                { title: "默认假设", body: "默认使用普通平面屏 + 真实视距模型、方形像素、屏幕中心正对眼睛；这里不使用头显 FOV 模式" }
              ]}
            />
          </FormulaPanel>
        </section>
      </section>
    </div>
  );
}

