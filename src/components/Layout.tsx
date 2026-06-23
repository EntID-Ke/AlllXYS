import { useEffect, useRef, useState } from "react";
import type { PageId } from "../types";
import { TendoualiceBackdrop } from "./TendoualiceGradient";

const navItems: { id: PageId; pageName: string; label: string; meta: string }[] = [
  { id: "home", pageName: "home", label: "home", meta: "overview" },
  { id: "ppd", pageName: "work", label: "perception", meta: "perception" },
  { id: "angle", pageName: "services", label: "view", meta: "view" },
  { id: "size", pageName: "vision", label: "scale", meta: "scale" }
];

const menuWords = ["All", "Luminance,", "Length,", "Latitude —", "X-raying", "You,", "Sight."];

function tendoualicePage(page: PageId) {
  if (page === "ppd") return "work";
  if (page === "angle") return "services";
  if (page === "size") return "vision";
  return "home";
}

function FloatingScrollbar() {
  const [metrics, setMetrics] = useState({ visible: false, top: 0, height: 0 });
  const dragRef = useRef<{ startY: number; startScroll: number; maxScroll: number; maxTop: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const documentElement = document.documentElement;
      const scrollHeight = Math.max(documentElement.scrollHeight, document.body.scrollHeight);
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(0, scrollHeight - viewportHeight);
      if (maxScroll <= 1) {
        setMetrics((current) => (current.visible ? { visible: false, top: 0, height: 0 } : current));
        return;
      }
      const inset = 8;
      const trackHeight = Math.max(1, viewportHeight - inset * 2);
      const thumbHeight = Math.max(64, Math.min(trackHeight, (viewportHeight / scrollHeight) * trackHeight));
      const maxTop = Math.max(0, trackHeight - thumbHeight);
      const top = inset + (window.scrollY / maxScroll) * maxTop;
      setMetrics({ visible: true, top, height: thumbHeight });
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    const resizeObserver = new ResizeObserver(requestUpdate);
    update();
    resizeObserver.observe(document.body);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const documentElement = document.documentElement;
    const scrollHeight = Math.max(documentElement.scrollHeight, document.body.scrollHeight);
    const viewportHeight = window.innerHeight;
    const maxScroll = Math.max(0, scrollHeight - viewportHeight);
    const maxTop = Math.max(1, viewportHeight - 16 - metrics.height);
    dragRef.current = { startY: event.clientY, startScroll: window.scrollY, maxScroll, maxTop };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const scrollDelta = ((event.clientY - drag.startY) / drag.maxTop) * drag.maxScroll;
    window.scrollTo({ top: Math.min(drag.maxScroll, Math.max(0, drag.startScroll + scrollDelta)) });
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!metrics.visible) return null;
  return (
    <div
      className="floating-scrollbar"
      style={{ top: `${metrics.top}px`, height: `${metrics.height}px` }}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    />
  );
}

export function Layout({
  page,
  onPageChange,
  onVersionLogClick,
  isTransitioning,
  transitionTarget,
  children
}: {
  page: PageId;
  onPageChange: (page: PageId) => void;
  onVersionLogClick: () => void;
  isTransitioning: boolean;
  transitionTarget: PageId | null;
  children: React.ReactNode;
}) {
  const [menuActive, setMenuActive] = useState(false);
  const [menuOn, setMenuOn] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const activePage = tendoualicePage(page);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const openMenu = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setMenuActive(true);
    setMenuOn(true);
  };

  const closeMenu = () => {
    setMenuActive(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOn(false);
      closeTimerRef.current = null;
    }, 300);
  };

  const toggleMenu = () => {
    if (menuActive) closeMenu();
    else openMenu();
  };

  const changePage = (nextPage: PageId) => {
    closeMenu();
    onPageChange(nextPage);
  };

  const showVersionLog = () => {
    closeMenu();
    onVersionLogClick();
  };

  const transitionItem = transitionTarget ? navItems.find((item) => item.id === transitionTarget) : null;

  return (
    <div className={`app-shell app-shell--${page} ${isTransitioning ? "wait set" : "loaded"}`} data-page={activePage}>
      <TendoualiceBackdrop page={page} />
      <div className={`page-transition ${isTransitioning ? "is-active" : ""}`} aria-hidden="true">
        {transitionItem && transitionItem.id !== "home" ? (
          <div className={`transition-loader transition-loader--${transitionItem.pageName}`}>
            <span className="transition-loader__label">loading</span>
            <span className="transition-loader__title f_tendoualice">{transitionItem.label}</span>
          </div>
        ) : null}
      </div>
      <header id="header" className={menuActive ? "active" : ""}>
        <div id="logo">
          <button type="button" className="logo-link hover_opacity tra_2_l" onClick={() => changePage("home")}>
            <span className="logo-emblem" aria-hidden="true" />
            <span className="logo-word">AlllXYS</span>
          </button>
        </div>

        <div id="home_menu" className="forpc tra_3_l">
          <ul className="f_tendoualice">
            {navItems.slice(1).map((item) => (
              <li key={item.id} data-page={item.pageName}>
                <button type="button" className="hover_opacity tra_2_l" onClick={() => changePage(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div id="btn_menu">
          <button type="button" className="hover_opacity tra_2_l" aria-label={menuActive ? "Close menu" : "Open menu"} onClick={toggleMenu}>
            <span className="line">
              <span className="t tra_7_b" />
              <span className="b tra_7_b" />
            </span>
          </button>
        </div>

        <div id="block_menu" className={menuOn ? "on" : ""}>
          <button type="button" className="close_area tra_2_l" aria-label="Close menu" onClick={closeMenu} />
          <div className="main tra_10_b">
            <div className="tr c_width">
              <div className="td menu-primary">
                <ul className="js-appear_x tra_15_b menu delay_5">
                  {navItems.map((item) => (
                    <li key={item.id} data-page={item.pageName}>
                      <button type="button" className="hover_opacity tra_2_l" onClick={() => changePage(item.id)}>
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="td menu-secondary">
                <ul className="js-appear_x tra_15_b menu delay_6">
                  <li data-page="version">
                    <button type="button" className="menu-version-title hover_opacity tra_2_l" onClick={showVersionLog}>
                      version
                    </button>
                  </li>
                </ul>
                <div className="js-appear_x tra_15_b delay_8">
                  <div className="sns">
                    <ul>
                      <li>
                        <a href="https://github.com/EntID911/PPDScope" target="_blank" rel="noreferrer">
                          GitHub
                        </a>
                      </li>
                      <li>
                        <a href="https://m.bilibili.com/space/482829361" target="_blank" rel="noreferrer">
                          BiliBili
                        </a>
                      </li>
                      <li>
                        <span>ENTITY</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="js-appear_x tra_15_b delay_7 menu-link-block">
                <div className="link">
                  <ul>
                    {menuWords.map((word) => (
                      <li key={word} className="btn_blank sp_small">
                        <span>{word}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <FloatingScrollbar />
    </div>
  );
}
