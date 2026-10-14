import PuttingDistanceResults from "../components/PuttingDistanceResults";
import DirectionDispersion from "../components/DirectionDispersion";
import DistanceTrajectories from "../components/DistanceTrajectories";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, PageTitle } from "../components/UI";
import { DataFeedback } from "../components/DataFeedback";
import { useGolfData } from "../hooks/useGolfData";
import { roundFilters, statistics, type RoundFilter, type fraction, type distribution, type putting, type dispersion } from "../domain/statistics";
import { horizontalZones, verticalZones } from "../domain/target";
import { roundUrl } from "../domain/rounds";
const tabs = ["General", "Salidas", "Putting", "Palos"];
const filterLabels = ["Todas las rondas", "Última ronda", "Últimas 5 rondas", "Últimas 10 rondas", "Últimas 20 rondas"];
const preferenceKey = "golf-tracker-statistics-filter";
function initialFilter(): RoundFilter {
  try { const value = localStorage.getItem(preferenceKey); return roundFilters.includes(value as RoundFilter) ? value as RoundFilter : "all"; } catch { return "all"; }
}
function number(value: number | null, digits = 2) { return value === null ? "—" : value.toFixed(digits); }
function rate(value: ReturnType<typeof fraction>) { return `${value.percentage === null ? "—" : `${value.percentage.toFixed(1)} %`} (${value.numerator}/${value.denominator})`; }
function Sample({ count, label = "golpes" }: { count: number; label?: string }) {
  return <p className="field-help">Muestra: {count} {label}.{count > 0 && count < 10 ? " Muestra pequeña: interpreta las tendencias con cautela." : ""}</p>;
}
function Bars({ title, items }: { title: string; items: ReturnType<typeof distribution> }) {
  return <section className="card stats-chart"><h2>{title}</h2><Sample count={items[0]?.denominator ?? 0} /><ul className="stats-bars">{items.map(item => <li key={item.label}><div><span>{item.label}</span><strong>{rate(item)}</strong></div><div className="stats-track" aria-hidden="true"><span style={{width: `${item.percentage ?? 0}%`}} /></div></li>)}</ul></section>;
}
function Metrics({ items }: { items: [string, string][] }) {
  return <dl className="round-indicators stats-metrics">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
function Putting({ values, visualDistance = false }: { values: ReturnType<typeof putting>; visualDistance?: boolean }) {
  return <>
    <section className="card"><h2>Putting</h2><Metrics items={[["Total de putts", String(values.total)], ["Putts por hoyo", number(values.average)]]} /><Sample count={values.total} label={`putts en ${values.holes} hoyos`} /><p className="field-help">Solo modo putting desde Green. Red zone significa cerca del hoyo, sin embocar. Las penalizaciones no son putts.</p></section>
    <Bars title="Putts por hoyo: distribución" items={values.holeDistribution} />
    {visualDistance ? <PuttingDistanceResults rows={values.byDistance} /> : <section className="card"><h2>Resultados por distancia inicial</h2>{values.byDistance.map(row => <div className="stats-distance" key={row.distance}><h3>{row.distance}</h3><Sample count={row.holed.denominator} label="putts" /><dl><dt>Embocados</dt><dd>{rate(row.holed)}</dd><dt>Red zone</dt><dd>{rate(row.red)}</dd><dt>Embocados o red zone</dt><dd>{rate(row.combined)}</dd></dl></div>)}</section>}
    <Bars title="Dirección de los fallos" items={values.directions} /><p className="field-help">Se excluyen los embocados. {values.unknownDirections} fallos sin dirección registrada excluidos.</p>
    <Bars title="Resultado de distancia" items={values.results} />
  </>;
}
function Scatter({ values }: { values: ReturnType<typeof dispersion> }) {
  return <section className="card"><h2>Dispersión 5×5</h2><Sample count={values.valid} /><p className="field-help">Categorías relativas, sin metros. Filas de muy largo a muy corto; columnas de muy izquierda a muy derecha. Cada celda muestra golpes y porcentaje.</p><div className="stats-table-wrap"><table className="stats-scatter"><caption>Distribución por ambos ejes</caption><thead><tr><th scope="col">Longitud / Dirección</th>{horizontalZones.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{[...verticalZones].reverse().map(v => <tr key={v}><th scope="row">{v}</th>{values.cells.filter(c => c.vertical === v).map(c => <td key={c.horizontal} className={c.numerator ? "has-shots" : ""}>{c.denominator ? <>{c.numerator}<small>{number(c.percentage, 0)} %</small></> : "—"}</td>)}</tr>)}</tbody></table></div></section>;
}
function Index({ value }: { value: number | null }) {
  return <><strong>Índice de Precisión: {number(value, 1)}</strong>{value !== null && <meter min="0" max="100" value={value} aria-label="Índice de Precisión" />}</>;
}
export default function Statistics() {
  const data = useGolfData();
  const [filter, setFilter] = useState<RoundFilter>(initialFilter);
  const [preferenceError, setPreferenceError] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = tabs.includes(params.get("seccion") ?? "") ? params.get("seccion")! : "General";
  const values = statistics(data, filter);
  const clubId = params.get("palo");
  const club = values.clubs.find(c => c.id === clubId);
  function changeTab(value: string) { setParams({ seccion: value }); }
  return <>
    <PageTitle eyebrow="CONOCE TU JUEGO" title="Estadísticas">Tu rendimiento en rondas finalizadas, a partir de tus registros reales.</PageTitle>
    <section className="card stats-filter"><label htmlFor="statistics-filter">Rondas analizadas</label><select id="statistics-filter" value={filter} onChange={event => {
      const next = event.target.value as RoundFilter; setFilter(next);
      try { localStorage.setItem(preferenceKey, next); setPreferenceError(false); } catch { setPreferenceError(true); }
    }}>{roundFilters.map((value, index) => <option key={value} value={value}>{filterLabels[index]}</option>)}</select>{preferenceError && <p role="status">La selección se aplica, pero no se pudo recordar en este navegador.</p>}<p>{values.rounds.length} rondas · {values.holes.length} hoyos analizados</p></section>
    <div className="tabs" role="tablist" aria-label="Tipos de estadísticas">{tabs.map((item, index) => <button key={item} role="tab" id={`tab-${item}`} aria-controls="stats-panel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => changeTab(item)} onKeyDown={event => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault(); changeTab(tabs[next]); document.getElementById(`tab-${tabs[next]}`)?.focus();
    }}>{item}</button>)}</div>
    <DataFeedback {...data} />
    {!data.loading && !data.error && <div role="tabpanel" id="stats-panel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
      {!values.rounds.length && <EmptyState title="Sin rondas finalizadas">Finaliza una ronda para analizar tu rendimiento. Las rondas en curso no se incluyen.</EmptyState>}
      {values.rounds.length > 0 && <>
        {tab === "General" && <>
          <section className="card"><h2>Resumen personal</h2><Metrics items={[["Rondas", String(values.rounds.length)], ["Hoyos", String(values.holes.length)], ["FIR", rate(values.fir)], ["GIR", rate(values.gir)], ["Putts por hoyo", number(values.putting.average)], ["Penalizaciones equivalentes a 18 hoyos", number(values.penalties18)], ["Score equivalente a 18 hoyos", number(values.score18)], ["Sobre par equivalente a 18 hoyos", number(values.overPar18)]]} /><Sample count={values.holes.length} label="hoyos" /><p className="field-help">Los equivalentes se calculan como media por hoyo × 18. No son scores reales ni hándicap oficial.</p></section>
          <section className="card"><h2>Evolución de resultados por ronda</h2><p className="field-help">De la más antigua a la más reciente. Cada barra representa el score equivalente a 18 hoyos; se muestra también el score real.</p><ol className="stats-evolution">{values.evolution.map(row => <li key={row.round.id}><Link to={roundUrl("tarjeta", row.round.id)}>{new Date(row.round.fin!).toLocaleDateString("es-ES")} · {row.round.campoNombre}</Link><span>{row.score} golpes reales · {row.holes} hoyos</span><strong>{number(row.score18)} equiv. 18 · {number(row.overPar18)} sobre par equiv.</strong><div className="stats-track" aria-hidden="true"><span style={{width: `${row.score18 === null ? 0 : row.score18 / Math.max(1, ...values.evolution.map(r => r.score18 ?? 0)) * 100}%`}} /></div></li>)}</ol></section>
          <Bars title="Destinos de golpes normales" items={values.destinations} />
        </>}
        {tab === "Salidas" && <>
          <section className="card"><h2>Salidas desde Tee</h2><Metrics items={[["Salidas analizadas", String(values.tee.total)], ["FIR · par 4 y 5", rate(values.tee.fir)]]} /><Sample count={values.tee.total} label="salidas" /><p className="field-help">Primer golpe desde Tee por hoyo. Diana relativa, sin distancias métricas. {values.tee.excluded} salidas normales con diana incompleta excluidas de la dispersión.</p></section>
          <DirectionDispersion items={values.tee.horizontal} /><DistanceTrajectories items={values.tee.vertical} /><Bars title="Destinos de salida" items={values.tee.destinations} />
        </>}
        {tab === "Putting" && <Putting values={values.putting} visualDistance />}
      </>}
      {tab === "Palos" && <>
        {clubId ? <>
          <Link className="back" to="/estadisticas?seccion=Palos">← Volver a palos</Link>
          {!club ? <EmptyState title="Palo sin datos en esta selección">Vuelve al listado para seleccionar otro palo.</EmptyState> : <>
            <section className="card"><h2>{club.name}</h2><p>{club.count} golpes · {club.total} normales · {club.putting.total} putts</p><p className="field-help">{club.inactive ? "Palo histórico o inactivo. " : ""}Nombres históricos: {club.historicalNames.join(", ") || "Sin registros"}.{club.currentName && club.currentName !== club.name ? ` Nombre actual: ${club.currentName}.` : ""}</p><Sample count={club.count} /><p>Penalizaciones asociadas: {club.count ? club.penalties : "—"} golpes</p></section>
            {club.putter && <Putting values={club.putting} />}
            {(!club.putter || club.total > 0) && <>
              <section className="card"><Index value={club.index} /><p>{club.valid} golpes válidos · {club.excluded} excluidos por diana incompleta</p><p className="field-help">Índice relativo a tus categorías de diana; no mide la calidad universal del palo.</p></section>
              <DirectionDispersion key={`direction-${club.id}`} title="Dirección del palo" items={club.horizontal} /><DistanceTrajectories key={`distance-${club.id}`} title="Longitud del palo" items={club.vertical} /><Scatter values={club} /><Bars title="Destinos del palo" items={club.destinations} />
              <section className="card"><h2>Evolución del Índice de Precisión</h2>{club.evolution.length < 2 ? <p>— · Se necesitan al menos dos rondas con diana válida.</p> : <ol className="stats-evolution">{club.evolution.map(row => <li key={row.round.id}><span>{new Date(row.round.fin!).toLocaleDateString("es-ES")} · {row.round.campoNombre}</span><Index value={row.index} /><span>{row.valid} golpes válidos · {row.excluded} excluidos</span></li>)}</ol>}</section>
            </>}
          </>}
        </> : <>
          <section className="card"><h2>Tus palos</h2><p className="field-help">Índice por eje: centro/correcto 100, desviación media 60, grande 20. Promedio de ambos ejes por golpe y después de los golpes válidos. No pondera destino ni penalización y no mide la calidad universal del palo.</p></section>
          <div className="management-list">{values.clubs.map(c => <Link className="card stats-club" key={c.id} to={`/estadisticas?seccion=Palos&palo=${encodeURIComponent(c.id)}`}><h2>{c.name}</h2><p>{c.total} golpes normales analizados{c.inactive ? " · Histórico/inactivo" : ""}</p>{c.putter ? <strong>{c.putting.total} putts · {number(c.putting.average)} por hoyo analizado</strong> : <Index value={c.index} />}<p className="field-help">{c.excluded} normales excluidos por diana incompleta.{c.count > 0 && c.count < 10 ? " Muestra pequeña." : ""}</p><span className="text-link">Ver detalle</span></Link>)}</div>
        </>}
      </>}
    </div>}
  </>;
}
