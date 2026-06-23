import type { ReactNode } from "react";

export function FormulaPanel({
  title = "公式与假设",
  defaultOpen = false,
  children
}: {
  title?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="formula-panel" open={defaultOpen}>
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

export function FormulaList({ items }: { items: { title: string; body: ReactNode; formula?: string }[] }) {
  return (
    <div className="formula-list">
      {items.map((item) => (
        <section key={item.title}>
          <h4>{item.title}</h4>
          <p>{item.body}</p>
          {item.formula ? <code>{item.formula}</code> : null}
        </section>
      ))}
    </div>
  );
}
