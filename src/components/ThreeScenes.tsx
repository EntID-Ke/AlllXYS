import { startTransition, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Download, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AngleResult } from "../lib/angleMath";
import type { PpdMetrics, ScreenGeometry, ScreenMetrics } from "../lib/screenMath";
import { downloadCanvas } from "../lib/export";
import { IconButton } from "./Controls";

type RangeStyle = CSSProperties & {
  "--slider-fill": string;
};

function renderPixelRatio() {
  return Math.min(Math.max(window.devicePixelRatio || 1, 1.25), 1.9);
}

function makeRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(renderPixelRatio());
  return renderer;
}

function isLightTheme() {
  return document.documentElement.dataset.theme === "light";
}

function addLine(parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, color: string, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 30;
  parent.add(line);
  return line;
}

function addMutableLine(parent: THREE.Object3D, color: string, opacity = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 30;
  parent.add(line);
  return line;
}

function updateLinePoints(line: THREE.Line, from: THREE.Vector3, to: THREE.Vector3) {
  const position = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  position.setXYZ(0, from.x, from.y, from.z);
  position.setXYZ(1, to.x, to.y, to.z);
  position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function fitRenderer(renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, orthographicHeight = 1) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setPixelRatio(renderPixelRatio());
  renderer.setSize(width, height, false);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = width / height;
  } else {
    const halfHeight = orthographicHeight / 2;
    const halfWidth = halfHeight * (width / height);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
  }
  camera.updateProjectionMatrix();
}

function formatMeters(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)} m`;
}

function formatInchesFromMeters(widthM: number, heightM: number) {
  const diagonalIn = (Math.hypot(widthM, heightM) * 1000) / 25.4;
  return `${diagonalIn.toFixed(diagonalIn >= 100 ? 0 : 1)} in`;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((item) => {
    const mesh = item as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material as (THREE.Material & { map?: THREE.Texture }) | Array<THREE.Material & { map?: THREE.Texture }> | undefined;
    if (Array.isArray(material)) {
      material.forEach((entry) => {
        entry.map?.dispose?.();
        entry.dispose();
      });
    } else {
      material?.map?.dispose?.();
      material?.dispose?.();
    }
  });
}

function addAdaptiveGroundGrid(scene: THREE.Scene, gridY: number, width: number, depth: number) {
  const cell = 0.1;
  const size = Math.min(12, Math.max(6, Math.ceil(Math.max(width * 5, depth * 3, 4) / cell) * cell));
  const divisions = Math.min(96, Math.round(size / cell));
  const grid = new THREE.GridHelper(size, divisions, isLightTheme() ? "#7f8896" : "#242a33", isLightTheme() ? "#aab1bc" : "#151a22");
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
  materials.forEach((material) => {
    material.transparent = true;
    material.opacity = isLightTheme() ? 0.26 : 0.18;
  });
  grid.position.y = gridY;
  scene.add(grid);
  return {
    update(camera: THREE.Camera) {
      grid.position.x = Math.round(camera.position.x / cell) * cell;
      grid.position.z = Math.round(camera.position.z / cell) * cell;
    },
    object: grid
  };
}

function addLabel(scene: THREE.Object3D, text: string, position: THREE.Vector3, color = "#aab4c2", scale = 0.13) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "600 42px Microsoft YaHei, Segoe UI, sans-serif";
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(text, 18, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(scale * 4, scale, 1);
  sprite.renderOrder = 40;
  scene.add(sprite);
}

function addDistanceRuler(scene: THREE.Object3D, maxZ: number, guideY: number, axisX: number, primaryZ: number, secondaryZ?: number | null) {
  addLine(scene, new THREE.Vector3(axisX, guideY, 0), new THREE.Vector3(axisX, guideY, maxZ), "#9aa8bd", 0.62);
  addLabel(scene, "标尺", new THREE.Vector3(axisX - 0.28, guideY, maxZ * 0.52), "#c7d0df", 0.08);
  const zeroDot = new THREE.Mesh(new THREE.CircleGeometry(0.00875, 32), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false }));
  zeroDot.position.set(axisX, guideY, 0);
  zeroDot.rotation.x = -Math.PI / 2;
  zeroDot.renderOrder = 45;
  scene.add(zeroDot);

  const step = maxZ > 10 ? 5 : maxZ > 1.4 ? 0.5 : 0.25;
  for (let z = step; z <= maxZ + 0.001; z += step) {
    const major = Math.abs((z / step) % 2) < 0.01;
    const half = major ? 0.045 : 0.028;
    addLine(scene, new THREE.Vector3(axisX - half, guideY, z), new THREE.Vector3(axisX + half, guideY, z), "#9aa8bd", major ? 0.62 : 0.38);
    if (major || step === 0.5) {
      addLabel(scene, `${Math.round(z * 100)} cm`, new THREE.Vector3(axisX - 0.25, guideY, z), "#9aa8bd", 0.055);
    }
  }

  addLine(scene, new THREE.Vector3(axisX - 0.11, guideY, primaryZ), new THREE.Vector3(axisX + 0.11, guideY, primaryZ), "#2f80ed", 0.95);
  addLabel(scene, `${Math.round(primaryZ * 100)} cm`, new THREE.Vector3(axisX - 0.25, guideY, primaryZ), "#8ab8ff", 0.065);
  if (secondaryZ !== null && secondaryZ !== undefined) {
    addLine(scene, new THREE.Vector3(axisX - 0.11, guideY, secondaryZ), new THREE.Vector3(axisX + 0.11, guideY, secondaryZ), "#1c9c76", 0.95);
    addLabel(scene, `${Math.round(secondaryZ * 100)} cm`, new THREE.Vector3(axisX - 0.25, guideY, secondaryZ), "#78d7bc", 0.065);
  }
}

function addDistanceMarker(scene: THREE.Object3D, axisX: number, guideY: number, color: string) {
  const group = new THREE.Group();
  addLine(group, new THREE.Vector3(axisX - 0.11, guideY, 0), new THREE.Vector3(axisX + 0.11, guideY, 0), color, 0.95);
  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(axisX - 0.25, guideY, 0);
  group.add(labelAnchor);
  scene.add(group);
  return { group, labelAnchor };
}

function addScreenPlane(scene: THREE.Object3D, width: number, height: number, position: THREE.Vector3, color: string, opacity: number, rotation?: THREE.Euler) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: isLightTheme() ? Math.min(0.72, opacity + 0.24) : opacity, side: THREE.DoubleSide, roughness: 0.82, metalness: 0.08, depthWrite: false })
  );
  plane.renderOrder = 2;
  plane.position.copy(position);
  if (rotation) plane.rotation.copy(rotation);
  scene.add(plane);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.58, depthTest: false, depthWrite: false })
  );
  edges.renderOrder = 18;
  edges.position.copy(position);
  if (rotation) edges.rotation.copy(rotation);
  scene.add(edges);
  return plane;
}

function addPixelGrid(scene: THREE.Scene, width: number, height: number, z: number, color = "#ffffff") {
  const group = new THREE.Group();
  const cols = 12;
  const rows = 7;
  for (let i = 1; i < cols; i += 1) {
    const x = -width / 2 + (width * i) / cols;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -height / 2, z + 0.002), new THREE.Vector3(x, height / 2, z + 0.002)]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.07, depthTest: false, depthWrite: false })));
  }
  for (let i = 1; i < rows; i += 1) {
    const y = -height / 2 + (height * i) / rows;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-width / 2, y, z + 0.002), new THREE.Vector3(width / 2, y, z + 0.002)]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.07, depthTest: false, depthWrite: false })));
  }
  scene.add(group);
}

function useFirstPersonCamera(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  camera: THREE.PerspectiveCamera,
  initialPosition: THREE.Vector3,
  initialTarget: THREE.Vector3,
  moveStep: number,
  onChange: () => void,
  onDistanceChange?: (distance: number) => void,
  referencePoint?: THREE.Vector3,
  onPoseChange?: (camera: THREE.PerspectiveCamera, target: THREE.Vector3) => void
) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const initialForward = initialTarget.clone().sub(initialPosition).normalize();
  let yaw = Math.atan2(initialForward.x, initialForward.z);
  let pitch = Math.asin(THREE.MathUtils.clamp(initialForward.y, -1, 1));
  const forward = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const updateCamera = () => {
    forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
    const lookTarget = camera.position.clone().add(forward);
    camera.lookAt(lookTarget);
    onPoseChange?.(camera, lookTarget);
    onChange();
  };
  camera.position.copy(initialPosition);
  updateCamera();
  const canvas = canvasRef.current;
  if (!canvas) return () => undefined;
  const down = (event: PointerEvent) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
  };
  const blur = () => {
    dragging = false;
  };
  const wheel = (event: WheelEvent) => {
    if (document.activeElement !== canvas) return;
    event.preventDefault();
    const target = referencePoint ?? initialTarget;
    const direction = camera.position.clone().sub(target);
    const distance = Math.max(0.05, direction.length());
    if (distance < 0.0001) return;
    const scale = event.deltaY > 0 ? 1.12 : 0.88;
    const nextDistance = Math.min(80, Math.max(0.05, distance * scale));
    camera.position.copy(target).add(direction.normalize().multiplyScalar(nextDistance));
    onDistanceChange?.(nextDistance);
    updateCamera();
  };
  const move = (event: PointerEvent) => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * 0.0045;
    pitch = Math.min(1.35, Math.max(-1.35, pitch - (event.clientY - lastY) * 0.0045));
    lastX = event.clientX;
    lastY = event.clientY;
    updateCamera();
  };
  const pointerUp = () => {
    dragging = false;
  };
  const keydown = (event: KeyboardEvent) => {
    if (document.activeElement !== canvas) return;
    const walkForward = new THREE.Vector3(forward.x, 0, forward.z);
    if (walkForward.lengthSq() < 0.0001) walkForward.set(0, 0, 1);
    walkForward.normalize();
    const right = new THREE.Vector3().crossVectors(walkForward, worldUp).normalize();
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") camera.position.addScaledVector(right, -moveStep);
    else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") camera.position.addScaledVector(right, moveStep);
    else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") camera.position.addScaledVector(walkForward, moveStep);
    else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") camera.position.addScaledVector(walkForward, -moveStep);
    else if (event.code === "Space") camera.position.y += moveStep;
    else if (event.key === "Shift") camera.position.y -= moveStep;
    else return;
    event.preventDefault();
    updateCamera();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointerleave", pointerUp);
  canvas.addEventListener("blur", blur);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keydown);
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", pointerUp);
    canvas.removeEventListener("pointerleave", pointerUp);
    canvas.removeEventListener("blur", blur);
    canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("keydown", keydown);
  };
}

function useOrbitCamera(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  camera: THREE.PerspectiveCamera,
  initialPosition: THREE.Vector3,
  target: THREE.Vector3,
  minDistance: number,
  maxDistance: number,
  onChange: () => void,
  onDistanceChange?: (distance: number) => void,
  onPoseChange?: (camera: THREE.PerspectiveCamera, target: THREE.Vector3) => void
) {
  const canvas = canvasRef.current;
  if (!canvas) return () => undefined;
  camera.position.copy(initialPosition);
  camera.lookAt(target);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.enableDamping = false;
  controls.rotateSpeed = 0.72;
  controls.panSpeed = 0.95;
  controls.zoomSpeed = 1.38;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  controls.enabled = document.activeElement === canvas;
  controls.addEventListener("change", onChange);
  const activate = () => {
    controls.enabled = true;
    canvas.focus({ preventScroll: true });
  };
  const blur = () => {
    controls.enabled = false;
  };
  const wheel = () => {
    if (document.activeElement !== canvas) controls.enabled = false;
  };
  const change = () => {
    onDistanceChange?.(camera.position.distanceTo(controls.target));
    onPoseChange?.(camera, controls.target);
  };
  controls.addEventListener("change", change);
  canvas.addEventListener("pointerdown", activate);
  canvas.addEventListener("blur", blur);
  canvas.addEventListener("wheel", wheel);
  controls.update();
  onChange();
  onPoseChange?.(camera, controls.target);
  return () => {
    onPoseChange?.(camera, controls.target);
    controls.removeEventListener("change", onChange);
    controls.removeEventListener("change", change);
    canvas.removeEventListener("pointerdown", activate);
    canvas.removeEventListener("blur", blur);
    canvas.removeEventListener("wheel", wheel);
    controls.dispose();
  };
}

export function PpdScene({
  primary,
  secondary,
  secondaryDistanceMm,
  showGrid = true,
  secondaryMode,
  onSecondaryModeChange,
  onSecondaryDistanceChange
}: {
  primary: PpdMetrics;
  secondary?: ScreenMetrics | null;
  secondaryDistanceMm?: number | null;
  showGrid?: boolean;
  secondaryMode: "ray" | "physical";
  onSecondaryModeChange: (mode: "ray" | "physical") => void;
  onSecondaryDistanceChange?: (distanceMm: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cameraMode, setCameraMode] = useState<"orbit" | "first-person">("orbit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rayDistanceM, setRayDistanceM] = useState(() => {
    return Math.min(50, Math.max(0.05, Number(((secondaryDistanceMm ?? primary.distanceMm) / 1000).toFixed(2))));
  });
  const updateRayDistanceRef = useRef<((distanceM: number) => void) | null>(null);
  const applyZoomRef = useRef<((nextZoom: number) => void) | null>(null);
  const onSecondaryDistanceChangeRef = useRef(onSecondaryDistanceChange);
  const pendingSecondaryDistanceMmRef = useRef<number | null>(null);
  const parentCommitTimerRef = useRef<number | null>(null);
  const rayFrameRef = useRef<number | null>(null);
  const pendingRayDistanceMRef = useRef(rayDistanceM);
  const isRaySliderActiveRef = useRef(false);
  const cameraPoseRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    onSecondaryDistanceChangeRef.current = onSecondaryDistanceChange;
  }, [onSecondaryDistanceChange]);

  useEffect(() => {
    return () => {
      if (parentCommitTimerRef.current !== null) window.clearTimeout(parentCommitTimerRef.current);
      if (rayFrameRef.current !== null) window.cancelAnimationFrame(rayFrameRef.current);
    };
  }, []);

  const setRayDistanceOnFrame = (nextDistanceM: number) => {
    pendingRayDistanceMRef.current = nextDistanceM;
    if (rayFrameRef.current !== null) return;
    rayFrameRef.current = window.requestAnimationFrame(() => {
      rayFrameRef.current = null;
      setRayDistanceM(pendingRayDistanceMRef.current);
    });
  };

  useEffect(() => {
    if (!secondaryDistanceMm) return;
    if (isRaySliderActiveRef.current && secondaryMode === "ray") return;
    const nextDistance = Math.min(50, Math.max(0.05, Number((secondaryDistanceMm / 1000).toFixed(2))));
    pendingRayDistanceMRef.current = nextDistance;
    setRayDistanceM(nextDistance);
    updateRayDistanceRef.current?.(nextDistance);
  }, [secondaryDistanceMm, secondaryMode]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [isFullscreen]);

  const physicalDistanceDependency = secondaryMode === "physical" ? secondaryDistanceMm : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.01, 100);
    let ground: ReturnType<typeof addAdaptiveGroundGrid> | null = null;
    let frame = 0;
    const requestRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        ground?.update(camera);
        renderer.render(scene, camera);
      });
    };

    scene.add(new THREE.AmbientLight("#ffffff", 1.4));
    const light = new THREE.DirectionalLight("#ffffff", 1.5);
    light.position.set(1, 1.5, -1);
    scene.add(light);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 16), new THREE.MeshStandardMaterial({ color: "#f2f6ff", emissive: "#40536e", emissiveIntensity: 0.3 }));
    scene.add(eye);
    const primaryW = primary.widthMm / 1000;
    const primaryH = primary.heightMm / 1000;
    const primaryZ = primary.distanceMm / 1000;
    const resolvedSecondaryDistanceM = Math.min(50, Math.max(0.05, Number(((secondaryDistanceMm ?? rayDistanceM * 1000) / 1000).toFixed(2))));
    const hasPhysicalSecondary = Boolean(secondary);
    const hasVisibleSecondary = secondaryMode === "ray" || hasPhysicalSecondary;
    const secondaryW = secondary ? secondary.widthMm / 1000 : 0;
    const secondaryH = secondary ? secondary.heightMm / 1000 : 0;
    const physicalSecondaryZ = secondary ? resolvedSecondaryDistanceM : null;
    const rayMaxZ = 50;
    const initialSecondaryZ = hasVisibleSecondary ? (secondaryMode === "ray" ? resolvedSecondaryDistanceM : physicalSecondaryZ) : null;
    const maxZ = Math.max(primaryZ, initialSecondaryZ ?? 0, secondaryMode === "ray" ? rayMaxZ : 0) + 0.22;
    const maxScreenW = Math.max(primaryW, secondaryMode === "ray" ? (primaryW * (initialSecondaryZ ?? primaryZ)) / primaryZ : secondaryW);
    const sceneDepth = Math.max(primaryZ, initialSecondaryZ ?? 0);
    const targetZ = initialSecondaryZ ? (primaryZ + initialSecondaryZ) / 2 : primaryZ;
    const target = new THREE.Vector3(0, -0.04, targetZ);
    const cameraRadius = Math.max(0.28, Math.min(3.2, 0.42 + Math.sqrt(sceneDepth) * 0.48)) / zoom;
    const baseCameraRadius = Math.max(0.28, Math.min(3.2, 0.42 + Math.sqrt(sceneDepth) * 0.48));
    const initialYaw = -0.58;
    const initialPhi = 1.12;
    let initialPosition = new THREE.Vector3(
      target.x + cameraRadius * Math.sin(initialPhi) * Math.sin(initialYaw),
      target.y + cameraRadius * Math.cos(initialPhi),
      target.z + cameraRadius * Math.sin(initialPhi) * Math.cos(initialYaw)
    );
    const rememberedPose = cameraPoseRef.current;
    if (rememberedPose) {
      initialPosition = rememberedPose.position.clone();
    }
    const cameraTarget = rememberedPose ? rememberedPose.target.clone() : target;
    const rememberPose = (activeCamera: THREE.PerspectiveCamera, activeTarget: THREE.Vector3) => {
      cameraPoseRef.current = {
        position: activeCamera.position.clone(),
        target: activeTarget.clone()
      };
    };
    const applyZoomToCamera = (nextZoom: number) => {
      const zoomTarget = cameraPoseRef.current?.target ?? cameraTarget;
      const direction = camera.position.clone().sub(zoomTarget);
      if (direction.lengthSq() < 0.0001) return;
      const nextDistance = Math.min(80, Math.max(0.05, baseCameraRadius / Math.max(0.08, nextZoom)));
      camera.position.copy(zoomTarget).add(direction.normalize().multiplyScalar(nextDistance));
      rememberPose(camera, zoomTarget);
      requestRender();
    };
    applyZoomRef.current = applyZoomToCamera;
    const cleanupCamera =
      cameraMode === "orbit"
        ? useOrbitCamera(canvasRef, camera, initialPosition, cameraTarget, 0.08, Math.max(80, sceneDepth * 5), requestRender, (distance) => setZoom(Number((baseCameraRadius / Math.max(0.05, distance)).toFixed(2))), rememberPose)
        : useFirstPersonCamera(canvasRef, camera, initialPosition, cameraTarget, Math.max(0.04, Math.min(0.42, cameraRadius * 0.14)), requestRender, (distance) => setZoom(Number((baseCameraRadius / Math.max(0.05, distance)).toFixed(2))), cameraTarget, rememberPose);

    addScreenPlane(scene, primaryW, primaryH, new THREE.Vector3(0, 0, primaryZ), "#2f80ed", 0.28);
    addLabel(scene, "主屏", new THREE.Vector3(-primaryW / 2, primaryH / 2 + 0.055, primaryZ), "#8ab8ff", 0.075);
    if (showGrid) addPixelGrid(scene, primaryW, primaryH, primaryZ, "#ffffff");

    const corners = [
      new THREE.Vector3(-primaryW / 2, primaryH / 2, primaryZ),
      new THREE.Vector3(primaryW / 2, primaryH / 2, primaryZ),
      new THREE.Vector3(primaryW / 2, -primaryH / 2, primaryZ),
      new THREE.Vector3(-primaryW / 2, -primaryH / 2, primaryZ)
    ];
    corners.forEach((corner) => {
      const end = secondaryMode === "ray" ? corner.clone().multiplyScalar(maxZ / primaryZ) : corner;
      addLine(scene, new THREE.Vector3(0, 0, 0), end, "#8ab8ff", secondaryMode === "ray" ? 0.5 : 0.62);
    });
    addLine(scene, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, primaryZ), "#8ab8ff", 0.46);
    addLine(scene, new THREE.Vector3(-primaryW / 2, 0, primaryZ), new THREE.Vector3(primaryW / 2, 0, primaryZ), "#ffffff", 0.14);
    addLine(scene, new THREE.Vector3(0, -primaryH / 2, primaryZ), new THREE.Vector3(0, primaryH / 2, primaryZ), "#ffffff", 0.14);

    const rulerGroup = new THREE.Group();
    scene.add(rulerGroup);
    const secondaryGroup = new THREE.Group();
    scene.add(secondaryGroup);
    const secondaryPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: "#1c9c76", transparent: true, opacity: 0.18, side: THREE.DoubleSide, roughness: 0.82, metalness: 0.06, depthWrite: false })
    );
    const secondaryEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
      new THREE.LineBasicMaterial({ color: "#78d7bc", transparent: true, opacity: 0.95, depthTest: false, depthWrite: false })
    );
    secondaryEdges.renderOrder = 18;
    secondaryGroup.add(secondaryPlane, secondaryEdges);
    const rulerAxisX = -primaryW / 2 - 0.22;
    addDistanceRuler(rulerGroup, maxZ, 0, rulerAxisX, primaryZ, null);
    const secondaryMarker = addDistanceMarker(rulerGroup, rulerAxisX, 0, "#1c9c76");
    let lastSecondaryMarkerCm: number | null = null;

    const updateSecondaryMarker = (secondaryZ: number | null) => {
      if (secondaryZ === null) {
        secondaryMarker.group.visible = false;
        return;
      }
      secondaryMarker.group.visible = true;
      secondaryMarker.group.position.z = secondaryZ;
      if (isRaySliderActiveRef.current) return;
      const markerCm = Math.round(secondaryZ * 100);
      if (markerCm === lastSecondaryMarkerCm) return;
      lastSecondaryMarkerCm = markerCm;
      disposeObject(secondaryMarker.labelAnchor);
      secondaryMarker.labelAnchor.clear();
      addLabel(secondaryMarker.labelAnchor, `${markerCm} cm`, new THREE.Vector3(0, 0, 0), "#78d7bc", 0.065);
    };

    const updateSecondary = (distanceM: number) => {
      if (!hasVisibleSecondary) {
        secondaryGroup.visible = false;
        updateSecondaryMarker(null);
        requestRender();
        return;
      }
      const secondaryZ = secondaryMode === "ray" ? distanceM : physicalSecondaryZ ?? distanceM;
      const scale = secondaryMode === "ray" ? secondaryZ / primaryZ : 1;
      const drawW = secondaryMode === "ray" ? primaryW * scale : secondaryW;
      const drawH = secondaryMode === "ray" ? primaryH * scale : secondaryH;
      secondaryGroup.visible = true;
      secondaryGroup.position.set(0, 0, secondaryZ);
      secondaryPlane.scale.set(drawW, drawH, 1);
      secondaryEdges.scale.set(drawW, drawH, 1);
      updateSecondaryMarker(secondaryZ);
      requestRender();
    };

    const initialGridY = -1.1;
    ground = addAdaptiveGroundGrid(scene, initialGridY, maxScreenW, maxZ);
    updateRayDistanceRef.current = updateSecondary;
    updateSecondary(resolvedSecondaryDistanceM);

    const resizeObserver = new ResizeObserver(() => {
      fitRenderer(renderer, canvas, camera);
      requestRender();
    });
    resizeObserver.observe(canvas);
    fitRenderer(renderer, canvas, camera);
    renderer.setClearColor(0x000000, 0);
    requestRender();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      cleanupCamera?.();
      updateRayDistanceRef.current = null;
      applyZoomRef.current = null;
      renderer.dispose();
      disposeObject(scene);
    };
  }, [primary, secondary, showGrid, cameraMode, secondaryMode, physicalDistanceDependency]);

  const primaryDistanceM = primary.distanceMm / 1000;
  const rayMinM = 0.05;
  const rayMaxM = 50;
  const clampedRayDistanceM = Math.min(rayMaxM, Math.max(rayMinM, rayDistanceM));
  const rayFillPercent = ((clampedRayDistanceM - rayMinM) / (rayMaxM - rayMinM)) * 100;
  const raySliderStyle: RangeStyle = { "--slider-fill": `${Math.min(100, Math.max(0, rayFillPercent))}%` };
  const rayScale = rayDistanceM / primaryDistanceM;
  const equivalentWidthM = (primary.widthMm / 1000) * rayScale;
  const equivalentHeightM = (primary.heightMm / 1000) * rayScale;
  const physicalSecondaryDistanceM = secondaryDistanceMm ? secondaryDistanceMm / 1000 : primaryDistanceM * 1.28;
  const readoutSecondaryDistanceM = secondaryMode === "ray" ? rayDistanceM : physicalSecondaryDistanceM;
  const readoutSecondaryWidthM = secondaryMode === "ray" ? equivalentWidthM : (secondary?.widthMm ?? 0) / 1000;
  const readoutSecondaryHeightM = secondaryMode === "ray" ? equivalentHeightM : (secondary?.heightMm ?? 0) / 1000;
  const showSecondaryReadout = secondaryMode === "ray" || Boolean(secondary);
  const changeSceneZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    applyZoomRef.current?.(nextZoom);
  };
  const commitSecondaryDistance = (distanceMm: number, immediate = false) => {
    pendingSecondaryDistanceMmRef.current = distanceMm;
    if (isRaySliderActiveRef.current && !immediate) return;
    const commit = () => {
      parentCommitTimerRef.current = null;
      const pendingDistanceMm = pendingSecondaryDistanceMmRef.current;
      const callback = onSecondaryDistanceChangeRef.current;
      if (pendingDistanceMm === null || !callback) return;
      startTransition(() => callback(pendingDistanceMm));
    };
    if (immediate) {
      if (parentCommitTimerRef.current !== null) {
        window.clearTimeout(parentCommitTimerRef.current);
        parentCommitTimerRef.current = null;
      }
      commit();
      return;
    }
    if (parentCommitTimerRef.current !== null) return;
    parentCommitTimerRef.current = window.setTimeout(commit, 120);
  };
  const finishRaySliderInteraction = () => {
    if (!isRaySliderActiveRef.current) return;
    isRaySliderActiveRef.current = false;
    if (rayFrameRef.current !== null) {
      window.cancelAnimationFrame(rayFrameRef.current);
      rayFrameRef.current = null;
    }
    setRayDistanceM(pendingRayDistanceMRef.current);
    if (pendingSecondaryDistanceMmRef.current !== null) updateRayDistanceRef.current?.(pendingSecondaryDistanceMmRef.current / 1000);
    commitSecondaryDistance(pendingSecondaryDistanceMmRef.current ?? clampedRayDistanceM * 1000, true);
  };

  return (
    <div className={`viz-card three-card ${isFullscreen ? "fullscreen-scene" : ""}`}>
      <div className="viz-header">
        <div>
          <h3>3D 场景模拟</h3>
          <p>{secondaryMode === "ray" ? "主屏四角视线生成等效屏幕；标尺和读数随距离更新" : "按副屏真实物理尺寸与距离显示"}</p>
        </div>
        <div className="scene-actions">
          <div className="scene-toggle" aria-label="输入模式">
            <button type="button" className={cameraMode === "orbit" ? "active" : ""} onClick={() => setCameraMode("orbit")}>
              环绕
            </button>
            <button type="button" className={cameraMode === "first-person" ? "active" : ""} onClick={() => setCameraMode("first-person")}>
              自由移动
            </button>
          </div>
          <div className="scene-toggle" aria-label="副屏模式">
            <button type="button" className={secondaryMode === "ray" ? "active" : ""} onClick={() => onSecondaryModeChange("ray")}>
              等效视锥
            </button>
            <button type="button" className={secondaryMode === "physical" ? "active" : ""} onClick={() => onSecondaryModeChange("physical")} disabled={!secondary}>
              自由对比
            </button>
          </div>
          <IconButton title="缩小场景" onClick={() => changeSceneZoom(Math.max(0.08, Number((zoom / 1.35).toFixed(2))))}>
            <ZoomOut size={17} />
          </IconButton>
          <span>{Math.round(zoom * 100)}%</span>
          <IconButton title="放大场景" onClick={() => changeSceneZoom(Math.min(20, Number((zoom * 1.35).toFixed(2))))}>
            <ZoomIn size={17} />
          </IconButton>
          <IconButton title={isFullscreen ? "退出全屏" : "全屏场景"} onClick={() => setIsFullscreen((value) => !value)}>
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </IconButton>
          <IconButton title="导出 3D 截图" onClick={() => downloadCanvas(canvasRef.current, "alllxys-3d.png")}>
            <Download size={17} />
          </IconButton>
        </div>
      </div>
      <div className="three-stage">
        <canvas ref={canvasRef} className="three-canvas" tabIndex={0} title={cameraMode === "orbit" ? "拖动环绕，滚轮缩放，右键或双指平移" : "拖动改变朝向；方向键前后左右移动摄像头；空格上升，Shift 下降"} />
        <div className="scene-readout" aria-label="屏幕读数">
          <div>
            <span>主屏</span>
            <strong>{formatMeters(primaryDistanceM)}</strong>
            <small>
              {formatInchesFromMeters(primary.widthMm / 1000, primary.heightMm / 1000)} · {formatMeters(primary.widthMm / 1000)} × {formatMeters(primary.heightMm / 1000)}
            </small>
          </div>
          {showSecondaryReadout ? (
            <div>
              <span>{secondaryMode === "ray" ? "等效副屏" : "副屏"}</span>
              <strong>{formatMeters(readoutSecondaryDistanceM)}</strong>
              <small>
                {formatInchesFromMeters(readoutSecondaryWidthM, readoutSecondaryHeightM)} · {formatMeters(readoutSecondaryWidthM)} × {formatMeters(readoutSecondaryHeightM)}
              </small>
            </div>
          ) : null}
        </div>
        {secondaryMode === "ray" ? (
          <label className="scene-distance-slider">
            <span>副屏距离</span>
            <input
              type="range"
              min={rayMinM}
              max={rayMaxM}
              step={0.01}
              value={clampedRayDistanceM}
              style={raySliderStyle}
              onPointerDown={() => {
                isRaySliderActiveRef.current = true;
              }}
              onPointerUp={finishRaySliderInteraction}
              onPointerCancel={finishRaySliderInteraction}
              onBlur={finishRaySliderInteraction}
              onKeyUp={() => commitSecondaryDistance(clampedRayDistanceM * 1000, true)}
              onChange={(event) => {
                const next = Math.min(rayMaxM, Math.max(rayMinM, Number(event.target.value)));
                setRayDistanceOnFrame(next);
                updateRayDistanceRef.current?.(next);
                commitSecondaryDistance(next * 1000);
              }}
            />
            <strong>{formatMeters(readoutSecondaryDistanceM)}</strong>
          </label>
        ) : null}
      </div>
    </div>
  );
}

function addBox(parent: THREE.Object3D, size: THREE.Vector3, position: THREE.Vector3, color: string, roughness = 0.72) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 }));
  mesh.position.copy(position);
  parent.add(mesh);
  return mesh;
}

function addDeskInfoPanel(scene: THREE.Scene, position: THREE.Vector3) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 260;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = isLightTheme() ? "#ffffff" : "#101217";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = isLightTheme() ? "#c8ced8" : "#313743";
  context.lineWidth = 6;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = isLightTheme() ? "#171a20" : "#f3f6fb";
  context.font = "700 34px Microsoft YaHei, Segoe UI, sans-serif";
  context.fillText("参照物尺寸", 34, 58);
  context.font = "500 28px Microsoft YaHei, Segoe UI, sans-serif";
  context.fillStyle = isLightTheme() ? "#4b5563" : "#aab4c2";
  context.fillText("键盘 43 × 13.5 × 2.2 cm", 34, 112);
  context.fillText("鼠标 11 × 6.5 × 3.5 cm", 34, 160);
  context.fillText("饮料罐 Ø6.6 × 12.2 cm", 34, 208);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.15),
    new THREE.MeshBasicMaterial({ map: texture, transparent: false, side: THREE.DoubleSide })
  );
  panel.rotation.x = -Math.PI / 2;
  panel.position.copy(position);
  scene.add(panel);
}

export function SizeComparisonScene({
  screens,
  mode,
  align
}: {
  screens: Array<ScreenGeometry & { id: string; name: string; color: string }>;
  mode: "overlay" | "side-by-side";
  align: "center" | "bottom" | "bottom-left" | "bottom-right";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraDistanceM, setCameraDistanceM] = useState(0);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [isFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(54, 1, 0.02, 80);
    let ground: ReturnType<typeof addAdaptiveGroundGrid> | null = null;
    let frame = 0;
    const requestRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        ground?.update(camera);
        renderer.render(scene, camera);
      });
    };

    scene.add(new THREE.AmbientLight("#ffffff", 1.15));
    const key = new THREE.DirectionalLight("#ffffff", 1.55);
    key.position.set(-1.4, 2.4, 2.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#9cc9ff", 0.65);
    fill.position.set(2.2, 1.4, -1.6);
    scene.add(fill);

    const active = screens.length ? screens : [];
    const totalWidth = mode === "side-by-side" ? active.reduce((sum, screen) => sum + screen.widthMm / 1000, 0) + Math.max(0, active.length - 1) * 0.18 : Math.max(...active.map((screen) => screen.widthMm / 1000), 1);
    const maxHeight = Math.max(...active.map((screen) => screen.heightMm / 1000), 0.55);
    const tableWidth = Math.max(1.8, totalWidth + 0.7);
    const tableDepth = Math.max(0.62, Math.min(1.1, maxHeight * 0.55 + 0.38));
    const tableHeight = 0.74;
    const table = new THREE.Group();
    scene.add(table);
    addBox(table, new THREE.Vector3(tableWidth, 0.055, tableDepth), new THREE.Vector3(0, tableHeight, 0), "#2b2d33", 0.62);
    const legX = tableWidth / 2 - 0.12;
    const legZ = tableDepth / 2 - 0.1;
    [-legX, legX].forEach((x) => {
      [-legZ, legZ].forEach((z) => addBox(table, new THREE.Vector3(0.045, tableHeight, 0.045), new THREE.Vector3(x, tableHeight / 2, z), "#202329", 0.58));
    });

    const isTvLike = (screen: ScreenGeometry) => {
      const diagonalIn = screen.diagonalMm / 25.4;
      const ratio = screen.widthMm / screen.heightMm;
      return diagonalIn >= 42 && ratio <= 2.05;
    };
    const baseScreen = active[0];
    const baseH = (baseScreen?.heightMm ?? 550) / 1000;
    const baseLift = (baseScreen?.diagonalMm ?? 0) / 25.4 >= 42 ? 0.11 : 0.23;
    const baseBottomY = tableHeight + baseLift;
    const bezelM = 0.035;
    const placeY = (h: number) => {
      if (align === "bottom" || align === "bottom-left" || align === "bottom-right") return baseBottomY + h / 2;
      return tableHeight + baseLift + baseH / 2;
    };
    const addReferenceObjects = (centerX: number, z: number) => {
      const frontZ = tableDepth / 2 - 0.15;
      addBox(scene, new THREE.Vector3(0.43, 0.022, 0.135), new THREE.Vector3(centerX - 0.08, tableHeight + 0.045, frontZ), "#1a1d23", 0.6);
      addBox(scene, new THREE.Vector3(0.065, 0.028, 0.11), new THREE.Vector3(centerX + 0.24, tableHeight + 0.052, frontZ - 0.005), "#1a1d23", 0.58);
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.122, 48), new THREE.MeshStandardMaterial({ color: "#d64137", roughness: 0.35, metalness: 0.42 }));
      can.position.set(centerX + 0.39, tableHeight + 0.096, frontZ - 0.01);
      scene.add(can);
      void z;
    };

    const addScreenModel = (screen: ScreenGeometry & { id: string; name: string; color: string }, centerX: number, centerY: number, z: number, withStand: boolean) => {
      const w = screen.widthMm / 1000;
      const h = screen.heightMm / 1000;
      const isTv = isTvLike(screen);
      const frameGroup = new THREE.Group();
      frameGroup.position.set(centerX, centerY, z);
      scene.add(frameGroup);
      const bezel = addBox(frameGroup, new THREE.Vector3(w + bezelM, h + bezelM, 0.04), new THREE.Vector3(0, 0, -0.018), "#0c0e12", 0.5);
      bezel.renderOrder = 2;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ color: screen.color, emissive: screen.color, emissiveIntensity: isLightTheme() ? 0.02 : 0.08, roughness: 0.55, metalness: 0.04, side: THREE.DoubleSide })
      );
      panel.position.z = 0.006;
      frameGroup.add(panel);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.92), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.035, side: THREE.DoubleSide }));
      glass.position.z = 0.009;
      frameGroup.add(glass);
      if (withStand && !isTv) {
        const standLift = Math.max(0.16, centerY - h / 2 - tableHeight + 0.02);
        addBox(scene, new THREE.Vector3(0.055, standLift, 0.055), new THREE.Vector3(centerX, tableHeight + standLift / 2, z - 0.035), "#14171d", 0.52);
        addBox(scene, new THREE.Vector3(Math.max(0.22, w * 0.34), 0.035, 0.18), new THREE.Vector3(centerX, tableHeight + 0.022, z - 0.015), "#14171d", 0.52);
      }
    };

    let cursorX = -totalWidth / 2;
    active.forEach((screen, index) => {
      const w = screen.widthMm / 1000;
      const h = screen.heightMm / 1000;
      const isTv = isTvLike(screen);
      const centerX =
        mode === "side-by-side"
          ? cursorX + w / 2
          : align === "bottom-left"
            ? -totalWidth / 2 + w / 2
            : align === "bottom-right"
              ? totalWidth / 2 - w / 2
              : 0;
      if (mode === "side-by-side") cursorX += w + 0.18;
      const lift = isTv ? 0.11 : 0.23;
      const centerY = placeY(h);
      const z = mode === "overlay" ? -0.02 - index * 0.006 : -0.02;
      addScreenModel(screen, centerX, centerY, z, mode === "side-by-side" || index === 0);
      if (mode === "side-by-side") addReferenceObjects(centerX, z);
    });
    if (mode === "overlay") addReferenceObjects(0, 0);
    addDeskInfoPanel(scene, new THREE.Vector3(-tableWidth / 2 + 0.34, tableHeight + 0.031, tableDepth / 2 - 0.1));

    const floorY = 0;
    ground = addAdaptiveGroundGrid(scene, floorY, tableWidth, 6);
    const axisTarget = new THREE.Vector3(0, tableHeight, -0.04);
    const target = new THREE.Vector3(0, tableHeight + maxHeight * 0.5, -0.04);
    const initialPosition = new THREE.Vector3(0, 1.18, Math.max(1.4, tableWidth * 0.72));
    const updateCameraDistance = () => {
      setCameraDistanceM(Number(Math.hypot(camera.position.x - axisTarget.x, camera.position.z - axisTarget.z).toFixed(2)));
    };
    const cleanupCamera = useFirstPersonCamera(canvasRef, camera, initialPosition, target, Math.max(0.04, tableWidth * 0.04), () => {
      updateCameraDistance();
      requestRender();
    }, undefined, target);
    updateCameraDistance();

    const resizeObserver = new ResizeObserver(() => {
      fitRenderer(renderer, canvas, camera);
      requestRender();
    });
    resizeObserver.observe(canvas);
    fitRenderer(renderer, canvas, camera);
    renderer.setClearColor(0x000000, 0);
    requestRender();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      cleanupCamera?.();
      renderer.dispose();
      disposeObject(scene);
    };
  }, [screens, mode, align]);

  return (
    <div className={`viz-card three-card room-card ${isFullscreen ? "fullscreen-scene" : ""}`}>
      <div className="viz-header">
        <div>
          <h3>真实 3D 尺寸场景</h3>
          <p>桌面、显示器和电视按左侧尺寸实时建模，第一人称视角可移动观察</p>
        </div>
        <div className="scene-actions">
          <IconButton title={isFullscreen ? "退出全屏" : "全屏场景"} onClick={() => setIsFullscreen((value) => !value)}>
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </IconButton>
        </div>
      </div>
      <div className="three-stage">
        <canvas ref={canvasRef} className="three-canvas room-canvas" tabIndex={0} title="点击后启用 WASD/方向键和滚轮；点到其他地方后控制失效" />
        <div className="scene-readout">
          <div>
            <span>相机到底部中轴</span>
            <strong>{formatMeters(cameraDistanceM)}</strong>
            <small>仅计算 XZ 平面距离</small>
          </div>
        </div>
      </div>
    </div>
  );
}

function eulerFromYawPitchRoll(yaw: number, pitch: number, roll: number) {
  const yawRad = THREE.MathUtils.degToRad(yaw);
  const pitchRad = THREE.MathUtils.degToRad(pitch);
  const rollRad = THREE.MathUtils.degToRad(roll);
  const q = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchRad);
  const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollRad);
  q.multiply(qYaw).multiply(qPitch).multiply(qRoll);
  return new THREE.Euler().setFromQuaternion(q);
}

export function AngleScene({ result, yaw, pitch, roll, view = "main", showGrid = false, zoom = 1 }: { result: AngleResult; yaw: number; pitch: number; roll: number; view?: "main" | "top" | "side"; showGrid?: boolean; zoom?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const updateSceneRef = useRef<((nextResult: AngleResult, nextYaw: number, nextPitch: number, nextRoll: number, nextShowGrid: boolean, nextZoom: number) => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = view === "main" ? new THREE.PerspectiveCamera(48, 1, 0.01, 20) : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    const screenGroup = new THREE.Group();
    const screenPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: "#2f80ed", transparent: true, opacity: isLightTheme() ? 0.48 : 0.24, side: THREE.DoubleSide, roughness: 0.82, metalness: 0.08, depthWrite: false })
    );
    const screenEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
      new THREE.LineBasicMaterial({ color: "#2f80ed", transparent: true, opacity: 0.58, depthTest: false, depthWrite: false })
    );
    screenEdges.renderOrder = 12;
    screenGroup.add(screenPlane, screenEdges);
    dynamicGroup.add(screenGroup);
    const gridGroup = new THREE.Group();
    dynamicGroup.add(gridGroup);
    const rayLines = new Map<AngleResult["points"][number]["key"], THREE.Line>();
    const pointMeshes = new Map<AngleResult["points"][number]["key"], THREE.Mesh>();
    let lastGridKey = "";

    scene.add(new THREE.AmbientLight("#ffffff", 1.4));
    const light = new THREE.DirectionalLight("#ffffff", 1.2);
    light.position.set(-1, 1.2, -1);
    scene.add(light);
    const angleGrid = new THREE.GridHelper(2.4, 12, "#2c333d", "#181d24");
    const angleGridMaterials = Array.isArray(angleGrid.material) ? angleGrid.material : [angleGrid.material];
    angleGridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.18;
    });
    scene.add(angleGrid);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 24, 16), new THREE.MeshStandardMaterial({ color: "#f3f7ff", emissive: "#3d4a62", emissiveIntensity: 0.35 }));
    scene.add(eye);

    let miniViewSize = 1;
    let frame = 0;
    const requestRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
      });
    };
    const updateScene = (nextResult: AngleResult, nextYaw: number, nextPitch: number, nextRoll: number, nextShowGrid: boolean, nextZoom: number) => {
      const centerZ = nextResult.distanceMm / 1000;
      const w = nextResult.widthMm / 1000;
      const h = nextResult.heightMm / 1000;
      miniViewSize = Math.max(0.5, centerZ * 1.35, w * 1.35, h * 1.35) / nextZoom;
      const target = new THREE.Vector3(0, 0, centerZ);
      const sceneCenter = new THREE.Vector3(0, 0, centerZ * 0.5);

      if (view === "top") {
        camera.up.set(0, 0, -1);
        camera.position.set(0, 5, centerZ * 0.5);
        camera.lookAt(sceneCenter);
      } else if (view === "side") {
        camera.up.set(0, 1, 0);
        camera.position.set(-5, 0, centerZ * 0.5);
        camera.lookAt(sceneCenter);
      } else {
        camera.up.set(0, 1, 0);
        camera.position.set(0.55 / nextZoom, 0.42 / nextZoom, -0.8 / nextZoom);
        camera.lookAt(target);
      }

      const rotation = eulerFromYawPitchRoll(nextYaw, nextPitch, nextRoll);
      screenGroup.position.set(0, 0, centerZ);
      screenGroup.rotation.copy(rotation);
      screenPlane.scale.set(w, h, 1);
      screenEdges.scale.set(w, h, 1);
      const gridKey = nextShowGrid ? `${w.toFixed(5)}:${h.toFixed(5)}` : "";
      if (gridKey !== lastGridKey) {
        disposeObject(gridGroup);
        gridGroup.clear();
        lastGridKey = gridKey;
        if (nextShowGrid) {
          for (let x = -1; x <= 1; x += 1) {
            addLine(gridGroup, new THREE.Vector3((x * w) / 4, -h / 2, 0.004), new THREE.Vector3((x * w) / 4, h / 2, 0.004), "#ffffff", 0.1);
          }
          for (let y = -1; y <= 1; y += 1) {
            addLine(gridGroup, new THREE.Vector3(-w / 2, (y * h) / 4, 0.004), new THREE.Vector3(w / 2, (y * h) / 4, 0.004), "#ffffff", 0.1);
          }
        }
      }
      gridGroup.visible = nextShowGrid;
      gridGroup.position.set(0, 0, centerZ);
      gridGroup.rotation.copy(rotation);

      nextResult.points.forEach((point) => {
        const p = new THREE.Vector3(point.world.x / 1000, point.world.y / 1000, point.world.z / 1000);
        let line = rayLines.get(point.key);
        if (!line) {
          line = addMutableLine(dynamicGroup, point.color, point.key === "center" ? 0.9 : 0.65);
          rayLines.set(point.key, line);
        }
        updateLinePoints(line, new THREE.Vector3(0, 0, 0), p);
        let sphere = pointMeshes.get(point.key);
        if (!sphere) {
          sphere = new THREE.Mesh(new THREE.SphereGeometry(point.key === "center" ? 0.012 : 0.01, 18, 12), new THREE.MeshStandardMaterial({ color: point.color, emissive: point.color, emissiveIntensity: 0.15 }));
          dynamicGroup.add(sphere);
          pointMeshes.set(point.key, sphere);
        }
        sphere.position.copy(p);
      });

      fitRenderer(renderer, canvas, camera, miniViewSize);
      requestRender();
    };
    updateSceneRef.current = updateScene;
    updateScene(result, yaw, pitch, roll, showGrid, zoom);

    const resizeObserver = new ResizeObserver(() => {
      fitRenderer(renderer, canvas, camera, miniViewSize);
      requestRender();
    });
    resizeObserver.observe(canvas);
    fitRenderer(renderer, canvas, camera, miniViewSize);
    renderer.setClearColor(0x000000, 0);
    requestRender();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      updateSceneRef.current = null;
      renderer.dispose();
      disposeObject(scene);
    };
  }, [view]);

  useEffect(() => {
    updateSceneRef.current?.(result, yaw, pitch, roll, showGrid, zoom);
  }, [result, yaw, pitch, roll, showGrid, zoom]);

  return <canvas ref={canvasRef} className={view === "main" ? "three-canvas" : "mini-canvas"} />;
}

