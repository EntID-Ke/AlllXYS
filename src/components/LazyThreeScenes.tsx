import { Component, lazy, memo, Suspense, type ErrorInfo, type ReactNode } from "react";
import type { AngleResult } from "../lib/angleMath";
import type { PpdMetrics, ScreenGeometry, ScreenMetrics } from "../lib/screenMath";

const PpdSceneImpl = lazy(() => import("./ThreeScenes").then((module) => ({ default: module.PpdScene })));
const AngleSceneImpl = lazy(() => import("./ThreeScenes").then((module) => ({ default: module.AngleScene })));
const SizeComparisonSceneImpl = lazy(() => import("./ThreeScenes").then((module) => ({ default: module.SizeComparisonScene })));

function SceneFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "scene-loading mini-canvas" : "scene-loading three-canvas"}>
      <span>正在加载 3D 几何场景</span>
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("3D scene failed to render:", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className={this.props.compact ? "scene-loading mini-canvas" : "scene-loading three-canvas"}>
          <span>3D scene unavailable</span>
        </div>
      );
    }

    return this.props.children;
  }
}

function PpdSceneLazyComponent(props: {
  primary: PpdMetrics;
  secondary?: ScreenMetrics | null;
  secondaryDistanceMm?: number | null;
  showGrid?: boolean;
  secondaryMode: "ray" | "physical";
  onSecondaryModeChange: (mode: "ray" | "physical") => void;
  onSecondaryDistanceChange?: (distanceMm: number) => void;
}) {
  return (
    <SceneErrorBoundary>
      <Suspense fallback={<SceneFallback />}>
        <PpdSceneImpl {...props} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

function AngleSceneLazyComponent(props: {
  result: AngleResult;
  yaw: number;
  pitch: number;
  roll: number;
  view?: "main" | "top" | "side";
  showGrid?: boolean;
  zoom?: number;
}) {
  return (
    <SceneErrorBoundary compact={props.view !== undefined && props.view !== "main"}>
      <Suspense fallback={<SceneFallback compact={props.view !== undefined && props.view !== "main"} />}>
        <AngleSceneImpl {...props} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

function SizeComparisonSceneLazyComponent(props: {
  screens: Array<ScreenGeometry & { id: string; name: string; color: string }>;
  mode: "overlay" | "side-by-side";
  align: "center" | "bottom" | "bottom-left" | "bottom-right";
}) {
  return (
    <SceneErrorBoundary>
      <Suspense fallback={<SceneFallback />}>
        <SizeComparisonSceneImpl {...props} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

export const PpdSceneLazy = memo(PpdSceneLazyComponent);
export const AngleSceneLazy = memo(AngleSceneLazyComponent);
export const SizeComparisonSceneLazy = memo(SizeComparisonSceneLazyComponent);
