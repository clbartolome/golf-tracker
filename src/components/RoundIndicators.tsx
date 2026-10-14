import { roundIndicators } from "../domain/roundIndicators";
import type { PlayedHole, Round, Shot } from "../domain/rounds";

export default function RoundIndicators({ round, holes, shots }: {
  round: Round;
  holes: PlayedHole[];
  shots: Shot[];
}) {
  const values = roundIndicators(round, holes, shots);
  const suffix = values.partial ? " · Parcial" : "";
  function percentage(value: typeof values.fir) {
    return `${value.percentage === null ? "—" : `${value.percentage.toFixed(0)} %`} · ${value.numerator}/${value.denominator}`;
  }
  const metrics = [
    ["FIR", percentage(values.fir)],
    ["GIR", percentage(values.gir)],
    ["Putts por hoyo", values.averagePutts === null ? "—" : values.averagePutts.toFixed(2)],
    ["Golpes de penalización", String(values.penalties)],
    ["Score total", String(values.totalScore)],
    ["Diferencia frente al par", values.difference === null ? "—" : `${values.difference > 0 ? "+" : ""}${values.difference}`],
  ];
  return (
    <section className="card" aria-label="Indicadores de ronda">
      <h2>Indicadores de ronda{suffix}</h2>
      <dl className="round-indicators">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}{suffix}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>{values.putts} putts en {values.completedHoles} hoyos confirmados.</p>
      <p className="field-help">
        FIR: hoyos par 4 y 5. GIR y media de putts: hoyos confirmados.
        Diferencia frente al par: {values.completedScore} golpes frente a par {values.completedPar} en hoyos confirmados.
        Score total y penalizaciones: todos los golpes registrados.
      </p>
    </section>
  );
}
