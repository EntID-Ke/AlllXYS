import { Copy, ExternalLink, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppState, PageId } from "../types";
import { IconButton, NumberField, Segmented, SliderField } from "../components/Controls";
import { FormulaList, FormulaPanel } from "../components/FormulaPanel";
import { MetricTable, ResultCard } from "../components/ResultCard";
import { ScreenEditor } from "../components/ScreenEditor";
import { AngleSceneLazy } from "../components/LazyThreeScenes";
import { solveAngleResult } from "../lib/angleMath";
import { formatNumber, fromMm } from "../lib/units";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { useContainedScroll } from "../hooks/useContainedScroll";

interface PageProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setPage: (page: PageId) => void;
}

function updateAngle(state: AppState, patch: Partial<AppState["angle"]>): AppState {
  return { ...state, angle: { ...state.angle, ...patch } };
}

const posturePresets = [
  { label: "正视", yaw: 0, pitch: 0, roll: 0 },
  { label: "右手轻转", yaw: 18, pitch: -4, roll: 0 },
  { label: "低头看手机", yaw: 0, pitch: -18, roll: 0 },
  { label: "斜持阅读", yaw: -12, pitch: -10, roll: 5 }
];

export function AngleCalculator({ state, setState, setPage }: PageProps) {
  const copyResult = useCopyFeedback("复制结果");
  const sideScroll = useContainedScroll<HTMLElement>();
  const [sceneZoom, setSceneZoom] = useState(1);
  const [draftAngle, setDraftAngle] = useState(state.angle);
  useEffect(() => {
    setDraftAngle(state.angle);
  }, [state.angle]);
  const result = useMemo(() => solveAngleResult(draftAngle), [draftAngle]);
  const pointsByKey = useMemo(() => (result ? Object.fromEntries(result.points.map((point) => [point.key, point])) : null), [result]);
  const left = pointsByKey?.left;
  const right = pointsByKey?.right;
  const top = pointsByKey?.top;
  const bottom = pointsByKey?.bottom;
  const horizontalNearSide = draftAngle.yaw > 0 ? "右侧更近" : draftAngle.yaw < 0 ? "左侧更近" : "左右等距";
  const verticalNearSide = draftAngle.pitch > 0 ? "下沿更近" : draftAngle.pitch < 0 ? "上沿更近" : "上下等距";

  const summary =
    result
      ? `AlllXYS 可视角度：yaw ${draftAngle.yaw}°，pitch ${draftAngle.pitch}°，水平可见角宽 ${formatNumber(result.totalHorizontalDeg, 2)}°，垂直可见角高 ${formatNumber(result.totalVerticalDeg, 2)}°，左右不对称 ${formatNumber(result.horizontalAsymmetryDeg, 2)}°`
      : "AlllXYS 可视角度暂无结果";
  const previewAngle = (patch: Partial<AppState["angle"]>) => setDraftAngle((prev) => ({ ...prev, ...patch }));
  const commitAngle = (patch: Partial<AppState["angle"]>) => setState((prev) => updateAngle(prev, patch));

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>view</h1>
          <p>Yaw, pitch, roll and five-point sampling for reading visible angle changes at the screen edges.</p>
        </div>
        <div className="action-row">
          <button type="button" onClick={() => copyResult.copy(summary)}>
            <Copy size={16} /> {copyResult.label}
          </button>
          <button type="button" onClick={() => setState((prev) => updateAngle(prev, { yaw: 0, pitch: 0, roll: 0 }))}>
            <RotateCcw size={16} /> 正视状态
          </button>
          <button
            type="button"
            onClick={() => {
              setState((prev) => ({ ...prev, size: { ...prev.size, screens: prev.size.screens.map((screen, index) => (index === 0 ? { ...screen, ...prev.angle.screen, id: screen.id, color: screen.color, enabled: true } : screen)) } }));
              setPage("size");
            }}
          >
            <ExternalLink size={16} /> 带到尺寸页
          </button>
        </div>
      </section>

      <section className="workbench-grid">
        <aside className="panel sticky-panel" ref={sideScroll.ref} onWheel={sideScroll.onWheel}>
          <ScreenEditor
            spec={draftAngle.screen}
            onChange={(screen) => {
              previewAngle({ screen });
              commitAngle({ screen });
            }}
            title="屏幕/手机规格"
            showResolution={false}
          />
          <section className="control-group">
            <div className="group-title">
              <h3>姿态与视距</h3>
            </div>
            <NumberField
              label="眼睛到屏幕中心距离"
              value={draftAngle.distance}
              min={0.01}
              step={0.1}
              unit={draftAngle.distanceUnit}
              units={["cm", "m", "mm", "in", "ft"]}
              onChange={(distance) => {
                previewAngle({ distance });
                commitAngle({ distance });
              }}
              onUnitChange={(distanceUnit) => {
                previewAngle({ distanceUnit });
                commitAngle({ distanceUnit });
              }}
            />
            <SliderField label="Yaw 水平偏转（右边靠近为正）" value={draftAngle.yaw} min={-70} max={70} onChange={(yaw) => previewAngle({ yaw })} onCommit={(yaw) => commitAngle({ yaw })} />
            <SliderField label="Pitch 俯仰（上边远离为正）" value={draftAngle.pitch} min={-70} max={70} onChange={(pitch) => previewAngle({ pitch })} onCommit={(pitch) => commitAngle({ pitch })} />
            <label className="check-row">
              <input
                type="checkbox"
                checked={draftAngle.showRoll}
                onChange={(event) => {
                  previewAngle({ showRoll: event.target.checked });
                  commitAngle({ showRoll: event.target.checked });
                }}
              />
              显示 roll 高级项
            </label>
            {draftAngle.showRoll ? <SliderField label="Roll 平面内旋转" value={draftAngle.roll} min={-90} max={90} onChange={(roll) => previewAngle({ roll })} onCommit={(roll) => commitAngle({ roll })} /> : null}
            <label className="check-row">
              <input
                type="checkbox"
                checked={draftAngle.showGrid}
                onChange={(event) => {
                  previewAngle({ showGrid: event.target.checked });
                  commitAngle({ showGrid: event.target.checked });
                }}
              />
              高级模式：显示 3×3 网格
            </label>
            <div className="preset-grid">
              {posturePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    previewAngle(preset);
                    commitAngle(preset);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="content-stack">
          {result && left && right && top && bottom ? (
            <>
              <div className="insight-strip">
                <div>
                  <span>姿态摘要</span>
                  <strong>Yaw {formatNumber(draftAngle.yaw, 1)}° · Pitch {formatNumber(draftAngle.pitch, 1)}°</strong>
                </div>
                <div>
                  <span>边缘不对称</span>
                  <strong>左右 {formatNumber(result.horizontalAsymmetryDeg, 2)}° · 上下 {formatNumber(result.verticalAsymmetryDeg, 2)}°</strong>
                </div>
                <div>
                  <span>正视偏离</span>
                  <strong>{formatNumber(result.normalDeviationDeg, 2)}°</strong>
                </div>
              </div>

              <div className="result-grid">
                <ResultCard label="离眼睛更近的一侧" value={`${horizontalNearSide} / ${verticalNearSide}`} tone="strong">
                  中心距离固定时，重点看边缘张角如何变大或变小
                </ResultCard>
                <ResultCard label="屏幕水平占眼前" value={formatNumber(result.totalHorizontalDeg, 2)} unit="°">
                  右边中点角度减去左边中点角度
                </ResultCard>
                <ResultCard label="屏幕垂直占眼前" value={formatNumber(result.totalVerticalDeg, 2)} unit="°">
                  上边中点角度减去下边中点角度
                </ResultCard>
                <ResultCard label="左右看起来差多少" value={formatNumber(result.horizontalAsymmetryDeg, 3)} unit="°" tone={result.horizontalAsymmetryDeg > 1 ? "warning" : "ok"}>
                  数值越大，说明一侧更贴近眼睛，左右边缘不再对称
                </ResultCard>
                <ResultCard label="上下看起来差多少" value={formatNumber(result.verticalAsymmetryDeg, 3)} unit="°" tone={result.verticalAsymmetryDeg > 1 ? "warning" : "ok"}>
                  数值越大，说明上沿或下沿离眼睛更近
                </ResultCard>
                <ResultCard label="偏离正对程度" value={formatNumber(result.normalDeviationDeg, 2)} unit="°">
                  0° 表示屏幕完全正对眼睛，越大表示越斜
                </ResultCard>
              </div>

              <div className="panel angle-explain-panel">
                <h2>边缘角度读法</h2>
                <p className="subtle">
                  眼睛看向各个采样点时的方向，偏转后，靠近眼睛的一侧会占更大的角度，所以左右/上下会不对称
                </p>
                <p className="subtle">
                  左右差异不会随 yaw 单调增大；屏幕绕中心继续转向侧面时，近侧更近但整块屏幕的水平投影也在变窄；接近 90° 时左右边缘几乎压成一条线
                </p>
                <MetricTable
                  rows={[
                    { label: "左边中点", value: `向左 ${formatNumber(Math.abs(left.azimuthDeg), 2)}°`, note: `相对正视变化 ${formatNumber(left.deltaAzimuthDeg, 2)}°` },
                    { label: "右边中点", value: `向右 ${formatNumber(Math.abs(right.azimuthDeg), 2)}°`, note: `相对正视变化 ${formatNumber(right.deltaAzimuthDeg, 2)}°` },
                    { label: "上边中点", value: `${top.elevationDeg >= 0 ? "向上" : "向下"} ${formatNumber(Math.abs(top.elevationDeg), 2)}°`, note: `相对正视变化 ${formatNumber(top.deltaElevationDeg, 2)}°` },
                    { label: "下边中点", value: `${bottom.elevationDeg >= 0 ? "向上" : "向下"} ${formatNumber(Math.abs(bottom.elevationDeg), 2)}°`, note: `相对正视变化 ${formatNumber(bottom.deltaElevationDeg, 2)}°` },
                    { label: "总水平覆盖", value: `${formatNumber(result.totalHorizontalDeg, 2)}°`, note: "右边中点 - 左边中点" },
                    { label: "总垂直覆盖", value: `${formatNumber(result.totalVerticalDeg, 2)}°`, note: "上边中点 - 下边中点" }
                  ]}
                />
              </div>

              <div className="angle-viz-grid">
                <div className="viz-card three-card main-angle">
                  <div className="viz-header">
                    <div>
                      <h3>主 3D 场景</h3>
                      <p>采样点颜色与射线一一对应，滑杆变化会实时更新几何关系</p>
                    </div>
                    <div className="scene-actions">
                      <IconButton title="缩小场景" onClick={() => setSceneZoom((value) => Math.max(0.2, Number((value / 1.25).toFixed(2))))}>
                        <ZoomOut size={17} />
                      </IconButton>
                      <span>{Math.round(sceneZoom * 100)}%</span>
                      <IconButton title="放大场景" onClick={() => setSceneZoom((value) => Math.min(8, Number((value * 1.25).toFixed(2))))}>
                        <ZoomIn size={17} />
                      </IconButton>
                    </div>
                  </div>
                  <AngleSceneLazy result={result} yaw={draftAngle.yaw} pitch={draftAngle.pitch} roll={draftAngle.showRoll ? draftAngle.roll : 0} showGrid={draftAngle.showGrid} zoom={sceneZoom} />
                </div>
                <div className="mini-scenes">
                  <div className="viz-card mini">
                    <h3>顶视图 · yaw</h3>
                    <AngleSceneLazy result={result} yaw={draftAngle.yaw} pitch={draftAngle.pitch} roll={draftAngle.showRoll ? draftAngle.roll : 0} view="top" showGrid={draftAngle.showGrid} zoom={sceneZoom} />
                  </div>
                  <div className="viz-card mini">
                    <h3>侧视图 · pitch</h3>
                    <AngleSceneLazy result={result} yaw={draftAngle.yaw} pitch={draftAngle.pitch} roll={draftAngle.showRoll ? draftAngle.roll : 0} view="side" showGrid={draftAngle.showGrid} zoom={sceneZoom} />
                  </div>
                </div>
              </div>

            </>
          ) : (
            <div className="panel empty-note">请填写大于 0 的视距与屏幕尺寸</div>
          )}

          <FormulaPanel defaultOpen>
            <FormulaList
              items={[
                { title: "坐标系", body: "眼睛位于 O=(0,0,0)，屏幕中心初始位于 C=(0,0,d)屏幕局部 x 向右、y 向上、z 为屏幕法线方向" },
                { title: "采样点", body: "固定计算 Center、Left、Right、Top、Bottom 五点；高级模式只增加网格可视化，不改变核心输出" },
                { title: "旋转", body: "局部点先应用 roll，再应用 pitch，再应用 yaw，随后平移到屏幕中心", formula: "P_world = R_yaw R_pitch R_roll P_local + C" },
                { title: "方位与仰角", body: "每个世界点都转换成相对于眼睛的水平角和垂直角，并与正视基准状态相减得到 delta", formula: "azimuth = atan2(x,z); elevation = atan2(y,sqrt(x²+z²))" }
              ]}
            />
          </FormulaPanel>
        </section>
      </section>
    </div>
  );
}


