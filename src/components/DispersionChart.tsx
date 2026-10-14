import { useId, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { distribution } from "../domain/statistics";

export type DistributionData = ReturnType<typeof distribution>;
export type DispersionTrail = { label: string; path: string; x: number; y: number; labelY: number };
function percentage(value: number | null) { return value === null ? "—" : `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`; }

/** Shared presentation. The domain supplies all counts and percentages. */
export default function DispersionChart({ title, description, items, trails, scenery, foreground, height, strokeScale = 1 }: {
  title: string;
  description: string;
  items: DistributionData;
  trails: readonly DispersionTrail[];
  scenery: ReactNode;
  foreground: ReactNode;
  height: number;
  strokeScale?: number;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const sample = items[0]?.denominator ?? 0;
  const maximum = Math.max(0, ...items.map(item => item.percentage ?? 0));
  const chosen = items.find(item => item.label === selected);
  return (
    <section className="card dispersion-chart" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="field-help dispersion-sample">Muestra: {sample} golpes.{sample > 0 && sample < 10 ? " Muestra pequeña: interpreta las tendencias con cautela." : ""}</p>
      {!maximum && <p className="field-help">Sin golpes con diana válida en esta selección.</p>}
      <div className={`dispersion-stage${selected ? " has-selection" : ""}`}>
        <svg className="dispersion-visual" viewBox={`0 0 400 ${height}`} role="img" aria-label={title} aria-describedby={`${id}-description`}>
          <title>{title}</title>
          <desc>Estelas de cinco categorías. Verde: mayor frecuencia; dorado: otras categorías con golpes; discontinuas: guías sin golpes. El desglose permite elegir por teclado.</desc>
          <defs><filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter></defs>
          {scenery}
          {trails.map(trail => {
            const item = items.find(value => value.label === trail.label);
            const frequency = item?.percentage ?? 0;
            const hasShots = (item?.numerator ?? 0) > 0 && frequency > 0;
            const predominant = hasShots && frequency === maximum;
            const active = selected === trail.label;
            const width = hasShots ? (2 + frequency * 0.14) * strokeScale : 1;
            const intensity = hasShots ? 0.62 + frequency * 0.0038 : 0.2;
            return <g key={trail.label} aria-hidden="true" data-category={trail.label} data-frequency={item?.percentage ?? "unknown"}
              className={`dispersion-trail ${hasShots ? "has-shots" : "is-guide"}${active ? " is-selected" : ""}${predominant ? " is-predominant" : ""}`}
              onPointerDown={event => { if (event.button === 0 && event.isPrimary !== false) setSelected(trail.label); }}
              onClick={() => setSelected(trail.label)}>
              {hasShots && <path className="dispersion-trail-glow" d={trail.path} strokeWidth={width + 3} opacity={intensity * (predominant ? 0.28 : 0.12)} filter={`url(#${id}-glow)`} />}
              <path className="dispersion-trail-line" d={trail.path} strokeWidth={width} opacity={intensity} />
              <path className="dispersion-trail-hit" d={trail.path} strokeWidth="44" vectorEffect="non-scaling-stroke" />
              <circle className="dispersion-trail-end" cx={trail.x} cy={trail.y} r={active ? 4 : hasShots ? 1.5 : 0} />
            </g>;
          })}
          {foreground}
        </svg>
        {trails.map(trail => {
          const item = items.find(value => value.label === trail.label);
          if (!item?.numerator || !item.percentage) return null;
          return <span aria-hidden="true" key={trail.label}
            className={`dispersion-percentage${item.percentage === maximum ? " is-predominant" : ""}${selected === trail.label ? " is-selected" : ""}${selected && selected !== trail.label ? " is-muted" : ""}`}
            style={{ left: `clamp(26px, ${trail.x / 4}%, calc(100% - 26px))`, top: `${trail.labelY / height * 100}%` }}>{percentage(item.percentage)}</span>;
        })}
      </div>
      <p className="dispersion-description" id={`${id}-description`}>{description}</p>
      <p className="dispersion-selection" role="status">{chosen ? `${chosen.label}: ${percentage(chosen.percentage)} · ${chosen.numerator} golpes (${chosen.numerator}/${chosen.denominator})` : "Toca una estela o abre el desglose para elegir una categoría."}</p>
      <details className="dispersion-details">
        <summary>Desglose por categoría</summary>
        <ul className="dispersion-legend" aria-label={`Categorías: ${title}`}>
          {trails.map(trail => {
            const item = items.find(value => value.label === trail.label);
            const active = selected === trail.label;
            return <li key={trail.label}><button type="button" aria-pressed={active} onClick={() => setSelected(trail.label)}>
              <span className="dispersion-legend-label">{trail.label}<small>{item?.numerator ?? 0} golpes · {item?.numerator ?? 0}/{item?.denominator ?? 0}</small></span>
              <strong>{percentage(item?.percentage ?? null)}</strong>
              {active && <Check size={16} aria-hidden="true" />}
            </button></li>;
          })}
        </ul>
      </details>
    </section>
  );
}
