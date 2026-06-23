import { useEffect, useRef, useState } from "react";
import { Calculator, Eye, Ruler } from "lucide-react";
import type { PageId } from "../types";

const tools: Array<{
  id: PageId;
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  icon: typeof Eye;
}> = [
  {
    id: "ppd",
    eyebrow: "01 / PERCEPTION",
    title: "PERCEPTION",
    body: "在同一个显示几何模型中联动 PPI、PPD、观看距离、CVD 和参考距离。",
    meta: "clarity / distance / equivalence",
    icon: Eye
  },
  {
    id: "angle",
    eyebrow: "02 / VIEW",
    title: "VIEW",
    body: "读取偏航、俯仰、滚转与五点采样如何改变边缘可见性和角度不对称。",
    meta: "yaw / pitch / edge asymmetry",
    icon: Calculator
  },
  {
    id: "size",
    eyebrow: "03 / SCALE",
    title: "SCALE",
    body: "按真实物理尺度比较对角线、面积、宽度、高度与等效尺寸关系。",
    meta: "diagonal / area / real scale",
    icon: Ruler
  }
];

const versions = [
  {
    id: "v1",
    status: "current",
    body:
      "显示几何实时计算，PPI 与像素间距，平均/局部 PPD，HVA/VVA/DVA，CVD/PVD，双屏等效，3D模拟实体对比，偏航/俯仰/滚转角度采样，比例尺寸对比 ，分享链接与PNG图片导出"
  },
  {
    id: "v2",
    status: "next",
    body: "移动端 UI/UX 适配，系统缩放与有效工作区指标，曲面屏空间占估算，曲率中心计算，SVG导出，优化流畅度与性能"
  },
  {
    id: "v3",
    status: "planned",
    body:
      "头显设备适配、带宽与接口兼容性检查计算器、屏占比计算、屏幕可用性检测和像素密度扩展计算"
  },
  {
    id: "v4",
    status: "planned",
    body: "在线视频源亮度与色度分析"
  },
  {
    id: "v5",
    status: "planned",
    body: "双模插值算法破坏性模拟、多屏组合模拟计算，以及理想桌面长宽与面积估值计算"
  }
];

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<"down" | "up">("down");

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const nextY = window.scrollY;
      const nextDirection = nextY >= lastY ? "down" : "up";
      lastY = nextY;
      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const inRevealBand = rect.top < viewportHeight * 0.82 && rect.bottom > viewportHeight * 0.08;

      setDirection(nextDirection);
      if (nextDirection === "down" && inRevealBand) {
        setVisible(true);
      } else if (nextDirection === "up" && rect.top > viewportHeight * 0.48) {
        setVisible(false);
      } else if (!inRevealBand && rect.top > viewportHeight) {
        setVisible(false);
      }
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return {
    ref,
    revealClassName: `scroll-reveal ${visible ? "is-visible" : "is-hidden"}`,
    direction
  };
}

export function Home({ onPageChange }: { onPageChange: (page: PageId) => void }) {
  const toolsReveal = useScrollReveal<HTMLElement>();
  const versionReveal = useScrollReveal<HTMLElement>();

  return (
    <div className="home-page">
      <section className="home-fv" aria-labelledby="home-title">
        <p className="home-kicker f_tendoualice">clarity, measured</p>
        <h1 id="home-title">SCREEN GEOMETRY, PERCEPTION AND DISPLAY SPACE.</h1>
        <p className="home-copy">AlllXYS turns display specs into usable visual decisions across clarity, viewing angle and physical scale.</p>
        <span className="home-symbol" aria-hidden="true" />
      </section>

      <section ref={toolsReveal.ref} className={`home-service ${toolsReveal.revealClassName}`} data-scroll-direction={toolsReveal.direction} aria-label="AlllXYS tools">
        <div className="section-title no-border">
          <h2>TOOLS</h2>
        </div>
        <div className="home-service-grid">
          <p className="home-service-lead">FOR DESKTOP, TV, MOBILE AND ANY DISPLAY YOU NEED TO EXPLAIN.</p>
          <div className="home-tool-list">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button key={tool.id} type="button" className="home-tool-row" onClick={() => onPageChange(tool.id)}>
                  <span className="home-tool-index">{tool.eyebrow}</span>
                  <span className="home-tool-main">
                    <span className="home-tool-title">
                      <Icon size={20} />
                      {tool.title}
                    </span>
                    <span className="home-tool-body">{tool.body}</span>
                  </span>
                  <span className="home-tool-meta">{tool.meta}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="version-log" ref={versionReveal.ref} className={`home-version ${versionReveal.revealClassName}`} data-scroll-direction={versionReveal.direction} aria-label="AlllXYS version log">
        <div className="section-title">
          <h2>VERSION</h2>
        </div>
        <div className="home-version-grid">
          <p className="home-version-lead">A compact roadmap for what AlllXYS is now and where the display model grows next.</p>
          <div className="version-list">
            {versions.map((version) => (
              <article key={version.id} className="version-row">
                <span className="version-id">{version.id}</span>
                <span className="version-status">{version.status}</span>
                <p>{version.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
