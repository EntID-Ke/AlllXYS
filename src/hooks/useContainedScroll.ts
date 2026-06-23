import { useEffect, useRef } from "react";

export function useContainedScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const grid = element.closest<HTMLElement>(".workbench-grid, .size-layout");
    const content = grid ? Array.from(grid.children).find((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("content-stack")) ?? null : null;
    const updateStickyHeight = () => {
      const leftHeight = Math.ceil(element.scrollHeight);
      const rightHeight = Math.ceil(content?.scrollHeight ?? 0);
      const gap = 24;
      const viewportHeight = window.innerHeight;
      const stickyTopFor = (height: number) => (height <= viewportHeight - gap * 2 ? gap : viewportHeight - height - gap);
      element.style.setProperty("--sticky-panel-height", `${leftHeight}px`);
      if (!grid || !content) return;
      grid.style.setProperty("--left-column-height", `${leftHeight}px`);
      grid.style.setProperty("--right-column-height", `${rightHeight}px`);
      grid.style.setProperty("--left-column-sticky-top", `${stickyTopFor(leftHeight)}px`);
      grid.style.setProperty("--right-column-sticky-top", `${stickyTopFor(rightHeight)}px`);
      grid.dataset.shortSide = leftHeight <= rightHeight ? "left" : "right";
    };
    updateStickyHeight();
    const resizeObserver = new ResizeObserver(updateStickyHeight);
    resizeObserver.observe(element);
    if (content) resizeObserver.observe(content);
    window.addEventListener("resize", updateStickyHeight);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateStickyHeight);
    };
  }, []);

  function onWheel() {}

  return { ref, onWheel };
}
