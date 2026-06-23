import { useEffect, useRef, useState } from "react";
import type { PageId } from "./types";
import { Layout } from "./components/Layout";
import { AngleCalculator } from "./pages/AngleCalculator";
import { ClarityWorkbench } from "./pages/ClarityWorkbench";
import { Home } from "./pages/Home";
import { SizeComparator } from "./pages/SizeComparator";
import { getInitialPage, getInitialState, writeUrl } from "./lib/state";

export function App() {
  const [page, setPage] = useState<PageId>(() => getInitialPage());
  const [state, setState] = useState(() => getInitialState());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<PageId | null>(null);
  const [loaderState, setLoaderState] = useState<"show" | "hide" | "done">("show");
  const [homeScrollTarget, setHomeScrollTarget] = useState<string | null>(null);
  const transitionTimers = useRef<number[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    const timer = window.setTimeout(() => writeUrl(page, state), 250);
    return () => window.clearTimeout(timer);
  }, [page, state]);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setLoaderState("hide"), 1150);
    const doneTimer = window.setTimeout(() => setLoaderState("done"), 1720);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  useEffect(() => {
    return () => {
      transitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (page !== "home" || isTransitioning || !homeScrollTarget) return;
    const timer = window.setTimeout(() => {
      document.getElementById(homeScrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHomeScrollTarget(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [homeScrollTarget, isTransitioning, page]);

  const goToPage = (nextPage: PageId) => {
    if (nextPage === page) return;
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimers.current = [];
    setTransitionTarget(nextPage);
    setIsTransitioning(true);
    transitionTimers.current.push(window.setTimeout(() => setPage(nextPage), 300));
    transitionTimers.current.push(window.setTimeout(() => window.scrollTo(0, 0), 320));
    transitionTimers.current.push(window.setTimeout(() => setIsTransitioning(false), 760));
    transitionTimers.current.push(window.setTimeout(() => setTransitionTarget(null), 920));
  };

  const goToVersionLog = () => {
    setHomeScrollTarget("version-log");
    if (page !== "home") goToPage("home");
  };

  return (
    <Layout page={page} onPageChange={goToPage} onVersionLogClick={goToVersionLog} isTransitioning={isTransitioning} transitionTarget={transitionTarget}>
      {loaderState !== "done" ? (
        <div id="load" className={`site-loader ${loaderState === "hide" ? "is-leaving" : ""}`} aria-hidden="true">
          <div className="site-loader__inner">
            <p className="site-loader__brand">
              {"AlllXYS".split("").map((letter, index) => (
                <span key={`${letter}-${index}`} style={{ animationDelay: `${index * 45}ms` }}>
                  {letter}
                </span>
              ))}
            </p>
            <span className="site-loader__line" />
          </div>
        </div>
      ) : null}
      <div key={page} className={`route-stage route-stage--${page}`}>
        {page === "home" ? <Home onPageChange={goToPage} /> : null}
        {page === "ppd" ? <ClarityWorkbench state={state} setState={setState} setPage={goToPage} /> : null}
        {page === "angle" ? <AngleCalculator state={state} setState={setState} setPage={goToPage} /> : null}
        {page === "size" ? <SizeComparator state={state} setState={setState} setPage={goToPage} /> : null}
      </div>
    </Layout>
  );
}
