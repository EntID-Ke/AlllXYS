import { memo } from "react";
import type { ReactNode } from "react";

function ResultCardComponent({
  label,
  value,
  unit,
  tone = "default",
  children
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "default" | "strong" | "warning" | "ok";
  children?: ReactNode;
}) {
  return (
    <article className={`result-card ${tone}`}>
      <span>{label}</span>
      <strong>
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
      {children ? <p>{children}</p> : null}
    </article>
  );
}

function MetricTableComponent({ rows }: { rows: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <div className="metric-table">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          {row.note ? <small>{row.note}</small> : null}
        </div>
      ))}
    </div>
  );
}

export const ResultCard = memo(ResultCardComponent);
export const MetricTable = memo(MetricTableComponent);
