import { startTransition, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { LengthUnit } from "../types";
import { lengthUnits } from "../data/presets";

type SliderStyle = CSSProperties & {
  "--slider-fill": string;
};

interface NumberFieldProps {
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
  unit?: LengthUnit;
  onUnitChange?: (unit: LengthUnit) => void;
  units?: LengthUnit[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  onUnitChange,
  units,
  min,
  max,
  step = 0.01,
  suffix,
  hint
}: NumberFieldProps) {
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <div className="field-row">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            if (event.target.value === "") {
              onChange("");
              return;
            }
            const nextValue = Number(event.target.value);
            if (Number.isFinite(nextValue)) onChange(nextValue);
          }}
        />
        {unit && onUnitChange ? (
          <select value={unit} onChange={(event) => onUnitChange(event.target.value as LengthUnit)} aria-label={`${label}单位`}>
            {(units ?? lengthUnits.map((item) => item.value)).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : null}
        {suffix ? <em>{suffix}</em> : null}
      </div>
    </label>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}

export function SelectField<T extends string>({ label, value, onChange, options, hint }: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; title?: string }[];
  label?: string;
}

export function Segmented<T extends string>({ value, onChange, options, label }: SegmentedProps<T>) {
  return (
    <div className="segmented-wrap" aria-label={label}>
      {label ? <span className="segmented-label">{label}</span> : null}
      <div className="segmented">
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            title={item.title}
            className={value === item.value ? "active" : ""}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface IconButtonProps {
  title: string;
  children: ReactNode;
  onClick: () => void;
  variant?: "ghost" | "solid";
}

export function IconButton({ title, children, onClick, variant = "ghost" }: IconButtonProps) {
  return (
    <button type="button" className={`icon-button ${variant}`} title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  suffix = "°"
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const frameRef = useRef<number | null>(null);
  const pendingValueRef = useRef(value);
  const isInteractingRef = useRef(false);
  const [displayValue, setDisplayValue] = useState(value);
  const numericDisplayValue = Number(displayValue) || 0;
  const percent = ((numericDisplayValue - min) / (max - min)) * 100;
  const sliderStyle: SliderStyle = { "--slider-fill": `${Math.min(100, Math.max(0, percent))}%` };

  useEffect(() => {
    if (isInteractingRef.current && value !== pendingValueRef.current) return;
    setDisplayValue(value);
    pendingValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const commitRangeValue = (nextValue: number) => {
    setDisplayValue(nextValue);
    pendingValueRef.current = nextValue;
    if (!isInteractingRef.current) {
      startTransition(() => onChange(pendingValueRef.current));
      return;
    }
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      startTransition(() => onChange(pendingValueRef.current));
    });
  };

  const finishInteraction = () => {
    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    startTransition(() => {
      onChange(pendingValueRef.current);
      onCommit?.(pendingValueRef.current);
    });
  };

  return (
    <label className="field slider-field">
      <span>{label}</span>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          style={sliderStyle}
          onPointerDown={() => {
            isInteractingRef.current = true;
          }}
          onPointerUp={finishInteraction}
          onPointerCancel={finishInteraction}
          onBlur={finishInteraction}
          onChange={(event) => commitRangeValue(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDisplayValue(next);
            startTransition(() => {
              onChange(next);
              onCommit?.(next);
            });
          }}
        />
        <em>{suffix}</em>
      </div>
    </label>
  );
}
