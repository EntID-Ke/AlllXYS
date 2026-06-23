import { createElement, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { PageId } from "../types";

type TendoualiceGradientElement = HTMLElement & {
  setAttribute(name: string, value: string): void;
};

interface GradientConfig {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  colorsize: number;
  colorspacing: number;
  colorrotation: number;
  colorspread: number;
  coloroffset: string;
  displacement: number;
  seed: number;
  position: string;
  zoom: number;
  spacing: number;
  noretina: string;
}

const fieldConfigs: Record<PageId, GradientConfig> = {
  home: {
    color1: "#80f6ff",
    color2: "#3b488c",
    color3: "#884ef4",
    color4: "#d73c3c",
    colorsize: 0.8,
    colorspacing: 0.33,
    colorrotation: 1.24840734641021,
    colorspread: 10,
    coloroffset: "-0.973876953125,-0.755390625",
    displacement: 2.56,
    seed: 3915,
    position: "-1.8283292510943407,1.3235562192065857",
    zoom: 0.75,
    spacing: 4.24,
    noretina: "true"
  },
  ppd: {
    color1: "#f8f8ec",
    color2: "#066699",
    color3: "#3c769a",
    color4: "#0f4266",
    colorsize: 2.18,
    colorspacing: 0.37,
    colorrotation: 0.368407346410207,
    colorspread: 1.15,
    coloroffset: "-0.22426757812499998,1",
    displacement: 3.97,
    seed: 0.43,
    position: "-161.201441254716,-15.25218097766221",
    zoom: 0.701439658706154,
    spacing: 4.24,
    noretina: "true"
  },
  angle: {
    color1: "#000000",
    color2: "#94a2a8",
    color3: "#dbdbdb",
    color4: "#262626",
    colorsize: 1.42,
    colorspacing: 0.76,
    colorrotation: -0.891592653589793,
    colorspread: 3.1,
    coloroffset: "0.2901367187499999,1",
    displacement: 5,
    seed: 2149,
    position: "-118.62501803050195,59.61237369381399",
    zoom: 0.512940626531553,
    spacing: 4.24,
    noretina: "true"
  },
  size: {
    color1: "#4b538b",
    color2: "#4a4f61",
    color3: "#f7a21b",
    color4: "#e45635",
    colorsize: 1.26,
    colorspacing: 0.37,
    colorrotation: -2.28159265358979,
    colorspread: 4.2,
    coloroffset: "-0.52,0.78",
    displacement: 2.41,
    seed: -0.49,
    position: "-16.2,9.4",
    zoom: 0.5729023778708708,
    spacing: 4.24,
    noretina: "true"
  }
};

const circleConfig: GradientConfig = {
  ...fieldConfigs.home,
  colorsize: 0.69,
  zoom: 1.2,
  seed: 3914.972069975553
};

function toElementAttributes(config: GradientConfig) {
  return {
    color1: config.color1,
    color2: config.color2,
    color3: config.color3,
    color4: config.color4,
    colorsize: String(config.colorsize),
    colorspacing: String(config.colorspacing),
    colorrotation: String(config.colorrotation),
    colorspread: String(config.colorspread),
    coloroffset: config.coloroffset,
    displacement: String(config.displacement),
    seed: String(config.seed),
    position: config.position,
    zoom: String(config.zoom),
    spacing: String(config.spacing),
    noretina: config.noretina
  };
}

function TendoualiceGradient({
  className = "",
  config,
  gradientRef
}: {
  className?: string;
  config: GradientConfig;
  gradientRef?: RefObject<TendoualiceGradientElement | null>;
}) {
  return createElement("tendoualice-gradient", {
    ref: gradientRef,
    className,
    ...toElementAttributes(config)
  });
}

export function TendoualiceBackdrop({ page }: { page: PageId }) {
  const fieldRef = useRef<TendoualiceGradientElement | null>(null);

  useEffect(() => {
    const config = fieldConfigs[page];
    const motionScale = page === "home" ? 1 : page === "size" ? 0.18 : 0.32;
    let displacementOffset = 0;
    let displacementIncreasing = false;
    let seedOffset = 0;
    let seedIncreasing = true;
    let frame = 0;

    const tick = () => {
      displacementOffset = displacementIncreasing ? displacementOffset + 1 / 700 : displacementOffset - 1 / 700;
      if (displacementOffset >= 1) displacementIncreasing = false;
      if (displacementOffset <= -1) displacementIncreasing = true;

      seedOffset = seedIncreasing ? seedOffset + 1 / 800 : seedOffset - 1 / 800;
      if (seedOffset >= 1) seedIncreasing = false;
      if (seedOffset <= -1) seedIncreasing = true;

      fieldRef.current?.setAttribute("displacement", String(config.displacement + displacementOffset * motionScale));
      fieldRef.current?.setAttribute("seed", String(config.seed + seedOffset * motionScale));
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [page]);

  useEffect(() => {
    const root = document.documentElement;
    const updateParallax = () => {
      const offset = page === "home" && window.scrollY < window.innerHeight * 1.2 ? window.scrollY / 1.5 : 0;
      root.style.setProperty("--tendoualice-circle-parallax", `${offset}px`);
    };

    updateParallax();
    window.addEventListener("scroll", updateParallax, { passive: true });
    window.addEventListener("resize", updateParallax);
    return () => {
      window.removeEventListener("scroll", updateParallax);
      window.removeEventListener("resize", updateParallax);
      root.style.removeProperty("--tendoualice-circle-parallax");
    };
  }, [page]);

  return (
    <div className={`tendoualice-backdrop tendoualice-backdrop--${page}`} aria-hidden="true">
      <div id="gradient" className="tendoualice-gradient-field">
        <TendoualiceGradient config={fieldConfigs[page]} gradientRef={fieldRef} />
      </div>
      <div className="tendoualice-gradient-circle js-img_parallax">
        <TendoualiceGradient className="tendoualice-gradient-circle__inner" config={circleConfig} />
      </div>
    </div>
  );
}
