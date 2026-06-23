import { RotateCcw } from "lucide-react";
import { aspectRatios, devicePresets, resolutionPresets, sizePresets } from "../data/presets";
import type { DevicePreset, LengthUnit, ScreenSpec } from "../types";
import { NumberField, Segmented, SelectField } from "./Controls";

interface ScreenEditorProps {
  spec: ScreenSpec;
  onChange: (spec: ScreenSpec) => void;
  title?: string;
  showResolution?: boolean;
  compact?: boolean;
}

function update<T extends keyof ScreenSpec>(spec: ScreenSpec, key: T, value: ScreenSpec[T]): ScreenSpec {
  return { ...spec, [key]: value };
}

function applyDevice(spec: ScreenSpec, preset: DevicePreset): ScreenSpec {
  const custom = preset.id === "tablet-11" ? { customAspectA: 2420, customAspectB: 1668 } : {};
  return {
    ...spec,
    presetId: preset.id,
    name: preset.label,
    mode: "diagonal",
    diagonal: preset.diagonal,
    diagonalUnit: preset.diagonalUnit,
    aspectId: preset.aspectId,
    pxW: preset.pxW ?? spec.pxW,
    pxH: preset.pxH ?? spec.pxH,
    ...custom
  };
}

export function ScreenEditor({ spec, onChange, title, showResolution = true, compact = false }: ScreenEditorProps) {
  const matchedPresetId =
    spec.presetId ||
    devicePresets.find(
      (preset) =>
        spec.mode === "diagonal" &&
        Number(spec.diagonal) === preset.diagonal &&
        spec.diagonalUnit === preset.diagonalUnit &&
        spec.aspectId === preset.aspectId &&
        (preset.pxW === undefined || Number(spec.pxW) === preset.pxW) &&
        (preset.pxH === undefined || Number(spec.pxH) === preset.pxH)
    )?.id ||
    "";
  const matchedResolutionId = spec.resolutionId || resolutionPresets.find((preset) => Number(spec.pxW) === preset.pxW && Number(spec.pxH) === preset.pxH)?.id || "";

  return (
    <section className={`control-group ${compact ? "compact" : ""}`}>
      <div className="group-title">
        <h3>{title ?? spec.name}</h3>
        <button type="button" title="恢复为 27 英寸 4K" onClick={() => onChange({ ...spec, mode: "diagonal", diagonal: 27, diagonalUnit: "in", aspectId: "16-9", pxW: 3840, pxH: 2160 })}>
          <RotateCcw size={16} /> 默认
        </button>
      </div>

      <label className="field">
        <span>设备预设</span>
        <select
          value={matchedPresetId}
          onChange={(event) => {
            const preset = devicePresets.find((item) => item.id === event.target.value);
            if (preset) onChange(applyDevice(spec, preset));
          }}
        >
          <option value="">未选择预设</option>
          {devicePresets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.category} · {item.label}
            </option>
          ))}
        </select>
      </label>

      <Segmented
        label="尺寸输入"
        value={spec.mode}
        onChange={(mode) => onChange(update(spec, "mode", mode))}
        options={[
          { value: "diagonal", label: "对角线" },
          { value: "physical", label: "宽/高反解" }
        ]}
      />

      {spec.mode === "diagonal" ? (
        <div className="inline-grid">
          <NumberField
            label="对角线"
            value={spec.diagonal}
            min={0}
            step={0.1}
            unit={spec.diagonalUnit}
            onChange={(value) => onChange(update(spec, "diagonal", value))}
            onUnitChange={(unit) => onChange(update(spec, "diagonalUnit", unit))}
          />
          <label className="field">
            <span>常用尺寸</span>
            <select value="" onChange={(event) => event.target.value && onChange(update(spec, "diagonal", Number(event.target.value)))}>
              <option value="">快速选择</option>
              {sizePresets.map((item) => (
                <option key={item} value={item}>
                  {item} in
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="inline-grid">
          <NumberField
            label="物理宽度"
            value={spec.width}
            min={0}
            step={0.1}
            unit={spec.widthUnit}
            onChange={(value) => onChange(update(spec, "width", value))}
            onUnitChange={(unit: LengthUnit) => onChange(update(spec, "widthUnit", unit))}
            hint="可留空"
          />
          <NumberField
            label="物理高度"
            value={spec.height}
            min={0}
            step={0.1}
            unit={spec.heightUnit}
            onChange={(value) => onChange(update(spec, "height", value))}
            onUnitChange={(unit: LengthUnit) => onChange(update(spec, "heightUnit", unit))}
            hint="可留空"
          />
        </div>
      )}

      <div className="inline-grid">
        <SelectField
          label="宽高比"
          value={spec.aspectId}
          onChange={(value) => onChange(update(spec, "aspectId", value))}
          options={aspectRatios.map((item) => ({ value: item.id, label: item.label }))}
        />
        {spec.aspectId === "custom" ? (
          <div className="ratio-pair">
            <NumberField label="宽比" value={spec.customAspectA} min={0} step={0.1} onChange={(value) => onChange(update(spec, "customAspectA", value))} />
            <NumberField label="高比" value={spec.customAspectB} min={0} step={0.1} onChange={(value) => onChange(update(spec, "customAspectB", value))} />
          </div>
        ) : null}
      </div>

      {showResolution ? (
        <>
          <label className="field">
            <span>分辨率预设</span>
            <select
              value={matchedResolutionId}
              onChange={(event) => {
                const preset = resolutionPresets.find((item) => item.id === event.target.value);
                if (preset) onChange({ ...spec, resolutionId: preset.id, pxW: preset.pxW, pxH: preset.pxH });
              }}
            >
              <option value="">未选择分辨率</option>
              {resolutionPresets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-grid">
            <NumberField label="水平像素" value={spec.pxW} min={1} step={1} suffix="px" onChange={(value) => onChange(update(spec, "pxW", value))} />
            <NumberField label="垂直像素" value={spec.pxH} min={1} step={1} suffix="px" onChange={(value) => onChange(update(spec, "pxH", value))} />
          </div>
        </>
      ) : null}
    </section>
  );
}
