import type { Club } from "./models";
import { destinations, puttDirections, puttResults, type Round, type PlayedHole, type Shot } from "./rounds";
import { horizontalZones, verticalZones } from "./target";
import { roundIndicators } from "./roundIndicators";
export const roundFilters = ["all", "1", "5", "10", "20"] as const;
export type RoundFilter = typeof roundFilters[number];
export type StatisticalData = { rounds: Round[]; playedHoles: PlayedHole[]; shots: Shot[]; clubs: Club[] };
export function selectRounds(rounds: Round[], filter: RoundFilter) {
  const selected = rounds.filter(r => r.estado === "finalizada" && r.fin && Number.isFinite(Date.parse(r.fin)))
    .sort((a, b) => Date.parse(b.fin!) - Date.parse(a.fin!) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return filter === "all" ? selected : selected.slice(0, Number(filter));
}
export function aggregate(data: StatisticalData, filter: RoundFilter) {
  const rounds = selectRounds(data.rounds, filter);
  const ids = new Set(rounds.map(r => r.id));
  const holes = data.playedHoles.filter(h => ids.has(h.rondaId) && h.estado === "completado");
  const holeIds = new Set(holes.map(h => h.id));
  return { rounds, holes, shots: data.shots.filter(s => holeIds.has(s.hoyoId)) };
}
export function fraction(numerator: number, denominator: number) {
  return { numerator, denominator, percentage: denominator ? numerator / denominator * 100 : null };
}
export function distribution(labels: readonly string[], values: string[]) {
  const valid = values.filter(v => labels.includes(v));
  return labels.map(label => ({ label, ...fraction(valid.filter(v => v === label).length, valid.length) }));
}
export function normalShots(shots: Shot[]) { return shots.filter((s): s is Extract<Shot, {tipo: "normal"}> => s.tipo === "normal"); }
export function statisticalPutts(shots: Shot[]) { return shots.filter((s): s is Extract<Shot, {tipo: "putt"}> => s.tipo === "putt" && s.origen === "Green"); }
export function validTarget(shot: Extract<Shot, {tipo: "normal"}>) {
  return !!shot.diana && horizontalZones.includes(shot.diana.horizontal) && verticalZones.includes(shot.diana.vertical);
}
export function precision(shots: Shot[]) {
  const normals = normalShots(shots);
  const valid = normals.filter(validTarget);
  const scores = [20, 60, 100, 60, 20];
  const index = valid.length ? valid.reduce((sum, s) => sum + (scores[horizontalZones.indexOf(s.diana.horizontal)] + scores[verticalZones.indexOf(s.diana.vertical)]) / 2, 0) / valid.length : null;
  return { index, valid: valid.length, excluded: normals.length - valid.length, total: normals.length };
}
export function dispersion(shots: Shot[]) {
  const valid = normalShots(shots).filter(validTarget);
  return {
    horizontal: distribution(horizontalZones, valid.map(s => s.diana.horizontal)),
    vertical: distribution(verticalZones, valid.map(s => s.diana.vertical)),
    cells: [...verticalZones].reverse().flatMap(vertical => horizontalZones.map(horizontal => ({ horizontal, vertical, ...fraction(valid.filter(s => s.diana.horizontal === horizontal && s.diana.vertical === vertical).length, valid.length) }))),
    ...precision(shots),
  };
}
export function destinationDistribution(shots: Shot[]) {
  return distribution(destinations, normalShots(shots).map(s => s.destino)).map(item => ({ ...item, label: item.label === "Hoyo" ? "Embocado" : item.label }));
}
export function penalties(shots: Shot[]) { return shots.reduce((sum, s) => sum + s.penalizacion, 0); }
export function normalizeResults(holes: PlayedHole[], shots: Shot[]) {
  const score = shots.length + penalties(shots);
  const par = holes.reduce((sum, h) => sum + h.par, 0);
  return { score, par, score18: holes.length ? score / holes.length * 18 : null, overPar18: holes.length ? (score - par) / holes.length * 18 : null, penalties18: holes.length ? penalties(shots) / holes.length * 18 : null };
}
export function regulation(rounds: Round[], holes: PlayedHole[], shots: Shot[]) {
  const indicators = rounds.map(r => roundIndicators(r, holes, shots));
  return {
    fir: fraction(indicators.reduce((n, r) => n + r.fir.numerator, 0), indicators.reduce((n, r) => n + r.fir.denominator, 0)),
    gir: fraction(indicators.reduce((n, r) => n + r.gir.numerator, 0), indicators.reduce((n, r) => n + r.gir.denominator, 0)),
  };
}
export function putting(holes: PlayedHole[], shots: Shot[]) {
  const putts = statisticalPutts(shots);
  const counts = holes.map(h => putts.filter(s => s.hoyoId === h.id).length);
  const knownDirections = putts.filter(s => s.resultado !== "Embocado" && puttDirections.includes(s.direccion!));
  return {
    total: putts.length, holes: holes.length, average: holes.length ? putts.length / holes.length : null,
    holeDistribution: distribution(["0", "1", "2", "3 o más"], counts.map(n => n >= 3 ? "3 o más" : String(n))),
    byDistance: ["Corto", "Medio", "Largo"].map(distance => {
      const sample = putts.filter(s => s.distancia === distance);
      const holed = sample.filter(s => s.resultado === "Embocado").length;
      const red = sample.filter(s => s.resultado === "Red zone").length;
      return { distance, holed: fraction(holed, sample.length), red: fraction(red, sample.length), combined: fraction(holed + red, sample.length) };
    }),
    directions: distribution(puttDirections, knownDirections.map(s => s.direccion!)),
    unknownDirections: putts.filter(s => s.resultado !== "Embocado").length - knownDirections.length,
    results: distribution(puttResults, putts.map(s => s.resultado)),
  };
}
export function teeStatistics(rounds: Round[], holes: PlayedHole[], shots: Shot[]) {
  const tees = holes.flatMap(h => {
    const first = shots.filter(s => s.hoyoId === h.id).sort((a,b) => a.orden - b.orden).find(s => s.origen === "Tee");
    return first ? [first] : [];
  });
  return { ...dispersion(tees), total: tees.length, destinations: destinationDistribution(tees), fir: regulation(rounds, holes, shots).fir };
}
export function clubStatistics(data: StatisticalData, filter: RoundFilter) {
  const selected = aggregate(data, filter);
  // Historical identity is the stable club ID, never its mutable display name.
  const ids = new Set([...data.clubs.map(c => c.id), ...selected.shots.map(s => s.paloId)]);
  return [...ids].map(id => {
    const club = data.clubs.find(c => c.id === id);
    const shots = selected.shots.filter(s => s.paloId === id);
    const historicalNames = [...new Set(shots.map(s => s.paloNombre))];
    const latest = shots.slice().sort((a,b) => {
      const aHole = selected.holes.find(h => h.id === a.hoyoId);
      const bHole = selected.holes.find(h => h.id === b.hoyoId);
      return selected.rounds.findIndex(r => r.id === aHole?.rondaId) - selected.rounds.findIndex(r => r.id === bHole?.rondaId) || b.orden - a.orden;
    })[0];
    const putter = club?.categoria === "Putter" || statisticalPutts(shots).length > 0;
    const evolution = [...selected.rounds].reverse().map(round => {
      const holeIds = new Set(selected.holes.filter(h => h.rondaId === round.id).map(h => h.id));
      return { round, ...precision(shots.filter(s => holeIds.has(s.hoyoId))) };
    }).filter(point => point.index !== null);
    return { id, name: latest?.paloNombre ?? club?.nombre ?? "Palo histórico", currentName: club?.nombre, historicalNames, inactive: !club?.activo, putter, shots, count: shots.length, ...dispersion(shots), destinations: destinationDistribution(shots), penalties: penalties(shots), putting: putting(shots.length ? selected.holes : [], shots), evolution };
  }).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
}
export function statistics(data: StatisticalData, filter: RoundFilter) {
  const selected = aggregate(data, filter);
  return { ...selected, ...regulation(selected.rounds, selected.holes, selected.shots), ...normalizeResults(selected.holes, selected.shots), putting: putting(selected.holes, selected.shots), tee: teeStatistics(selected.rounds, selected.holes, selected.shots), destinations: destinationDistribution(selected.shots), clubs: clubStatistics(data, filter), evolution: [...selected.rounds].reverse().map(round => {
    const holes = selected.holes.filter(h => h.rondaId === round.id);
    const ids = new Set(holes.map(h => h.id));
    return { round, holes: holes.length, ...normalizeResults(holes, selected.shots.filter(s => ids.has(s.hoyoId))) };
  }) };
}
