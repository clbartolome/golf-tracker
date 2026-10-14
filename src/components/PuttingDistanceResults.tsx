import { useId } from "react";
import type { putting } from "../domain/statistics";

type DistanceResults = ReturnType<typeof putting>["byDistance"];
function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} %`;
}

export default function PuttingDistanceResults({ rows }: { rows: DistanceResults }) {
  const id = useId();
  const smallSamples = rows.filter(row => row.holed.denominator > 0 && row.holed.denominator < 10).map(row => row.distance);
  return (
    <section className="card putting-distance-results" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Resultados por distancia inicial</h2>
      <p className="field-help">El anillo muestra la proporción embocada; el green es ilustrativo y no sitúa los putts.</p>
      <div className="putting-green-grid">
        {rows.map(row => {
          const total = row.holed.denominator;
          const value = row.holed.percentage;
          return (
            <article className="putting-green-card" key={row.distance} aria-label={`Resumen ${row.distance}`}>
              <svg className="putting-green" viewBox="0 0 100 100" role="img" aria-label={total ? `Embocados desde ${row.distance}: ${percent(value)} (${row.holed.numerator}/${total})` : `${row.distance}: Sin datos`}>
                <circle className="putting-green-surface" cx="50" cy="50" r="35" />
                <path className="putting-green-contour" d="M 24 56 Q 40 25 74 42 M 26 65 Q 50 79 77 55" />
                <circle className="putting-hole" cx="50" cy="50" r="5" />
                <path className="putting-flagpole" d="M 50 50 V 27" />
                <path className="putting-flag" d="M 50 27 L 63 32 L 50 37 Z" />
                <circle className="putting-ring-track" cx="50" cy="50" r="43" />
                {total > 0 && <circle className="putting-ring-value" cx="50" cy="50" r="43" pathLength="100" strokeDasharray={`${value ?? 0} ${100 - (value ?? 0)}`} transform="rotate(-90 50 50)" />}
              </svg>
              <div>
                <h3>{row.distance}</h3>
                <strong className="putting-green-percentage">{total ? percent(value) : "Sin datos"}</strong>
                <p>{total ? `Embocados · ${row.holed.numerator}/${total}` : "Embocados · —"}</p>
                <small>{total} putts analizados</small>
                <p className="putting-combined">Embocados + Red zone <strong>{total ? percent(row.combined.percentage) : "—"}</strong><small>{row.combined.numerator}/{total} putts</small></p>
              </div>
            </article>
          );
        })}
      </div>
      {smallSamples.length > 0 && <p className="field-help putting-sample-note">Muestra pequeña en {smallSamples.join(", ")}: menos de 10 putts por distancia. Interpreta las tendencias con cautela.</p>}
      <div className="putting-result-bars">
        {rows.map(row => {
          const total = row.holed.denominator;
          const other = total - row.holed.numerator - row.red.numerator;
          // Compute only the requested complementary presentation segment, without rounding.
          const segments = [
            { label: "Embocados", className: "holed", count: row.holed.numerator, percentage: row.holed.percentage },
            { label: "Red zone", className: "red-zone", count: row.red.numerator, percentage: row.red.percentage },
            { label: "Otros resultados", className: "other", count: other, percentage: total ? other / total * 100 : null },
          ];
          return (
            <section className="putting-result-row" key={row.distance} aria-labelledby={`${id}-${row.distance}`}>
              <h3 id={`${id}-${row.distance}`}>{row.distance}<span>{total} putts</span></h3>
              {total ? <>
                <div className="putting-stacked-bar" aria-hidden="true">
                  {segments.map(segment => <span key={segment.className} className={`putting-segment ${segment.className}`} style={{ width: `${segment.percentage ?? 0}%` }} />)}
                </div>
                <dl className="putting-result-legend">
                  {segments.map(segment => <div key={segment.className}>
                    <dt><span className={`putting-result-swatch ${segment.className}`} aria-hidden="true" />{segment.label}</dt>
                    <dd>{percent(segment.percentage)}<small>{segment.count}/{total} putts</small></dd>
                  </div>)}
                </dl>
              </> : <p className="field-help">Sin datos</p>}
            </section>
          );
        })}
      </div>
    </section>
  );
}
