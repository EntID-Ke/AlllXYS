import { formatNumber } from "../lib/units";

export function ClarityScale({ local, average, target }: { local: number; average: number; target: number }) {
  const clamp = (value: number) => Math.min(100, Math.max(0, (value / 130) * 100));
  const marks = [40, 60, 80, 120];
  return (
    <div className="clarity-scale">
      <div className="scale-head">
        <div>
          <h3>感知清晰度标尺</h3>
          <p>Avg 40 PPD 作为及格线；60 PPD 进入清晰绿区Local 是保守口径，Average 是整屏平均口径</p>
        </div>
        <strong>{formatNumber(local, 2)} PPD</strong>
      </div>
      <div className="scale-track" aria-label="PPD 清晰度标尺">
        <span className="scale-zone low">低于 40</span>
        <span className="scale-zone pass">及格</span>
        <span className="scale-zone clear">清晰</span>
        {marks.map((mark) => (
          <span key={mark} className="scale-mark" style={{ left: `${clamp(mark)}%` }}>
            <i />
            <em>{mark}</em>
          </span>
        ))}
        <span className="scale-pin local" style={{ left: `${clamp(local)}%` }}>
          Local
        </span>
        <span className="scale-pin average" style={{ left: `${clamp(average)}%` }}>
          Avg
        </span>
        <span className="scale-pin target" style={{ left: `${clamp(target)}%` }}>
          目标
        </span>
      </div>
    </div>
  );
}

