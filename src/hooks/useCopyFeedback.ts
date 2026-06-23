import { useRef, useState } from "react";
import { copyText } from "../lib/export";

export function useCopyFeedback(defaultLabel = "复制结果") {
  const [label, setLabel] = useState(defaultLabel);
  const timer = useRef<number | null>(null);

  async function copy(value: string, successLabel = "已复制") {
    try {
      await copyText(value);
      setLabel(successLabel);
    } catch {
      setLabel("复制失败");
    } finally {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLabel(defaultLabel), 1600);
    }
  }

  return { copy, label };
}
