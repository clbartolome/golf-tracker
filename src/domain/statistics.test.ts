import { describe, expect, it } from "vitest";
import { aggregate, clubStatistics, destinationDistribution, dispersion, normalizeResults, penalties, precision, putting, regulation, selectRounds, statistics, teeStatistics, type StatisticalData, type RoundFilter } from "./statistics";
import type { PlayedHole, Round, Shot } from "./rounds";
import { targetFromCategories, horizontalZones, verticalZones } from "./target";
const round: Round = { id: "r", campoId: "c", campoNombre: "Campo", inicio: "2026-01-01", fin: "2026-01-02", estado: "finalizada", numeroHoyos: 9, revision: 1 };
function hole(id = "h", par = 4, rondaId = "r"): PlayedHole { return { id, rondaId, numero: 1, par, estado: "completado" }; }
function shot(id: string, orden = 1, changes: Partial<Shot> = {}): Shot { return { id, hoyoId: "h", orden, origen: "Tee", paloId: "driver", paloNombre: "Driver antiguo", penalizacion: 0, tipo: "normal", destino: "Calle", diana: targetFromCategories("Centro", "Distancia correcta"), ...changes } as Shot; }
function putt(id: string, resultado: "Corto" | "Red zone" | "Embocado" = "Embocado", changes: Partial<Shot> = {}): Shot { return { id, hoyoId: "h", orden: 3, origen: "Green", paloId: "putter", paloNombre: "Putter histórico", penalizacion: 0, tipo: "putt", destino: resultado === "Embocado" ? "Hoyo" : "Green", distancia: "Medio", resultado, direccion: resultado === "Embocado" ? null : "Izquierda", ...changes } as Shot; }
function data(shots: Shot[] = [shot("1"), shot("2", 2, { destino: "Green" }), putt("3")]): StatisticalData { return { rounds: [round], playedHoles: [hole()], shots, clubs: [] }; }
describe("Estadísticas personales", () => {
  it.each(["1", "5", "10", "20"] as RoundFilter[])("selecciona últimas %s por fin con desempate estable sin mutar", filter => {
    const rounds = Array.from({length: 25}, (_, i) => ({ ...round, id: String(i).padStart(2, "0"), fin: `2026-02-${String(i + 1).padStart(2, "0")}` }));
    const snapshot = structuredClone(rounds);
    const result = selectRounds(rounds, filter);
    expect(result).toHaveLength(Number(filter));
    expect(result[0].id).toBe("24"); expect(rounds).toEqual(snapshot);
    expect(selectRounds([{ ...round, id: "z" }, {...round, id: "a"}], "1")[0].id).toBe("a");
  });
  it("excluye rondas incompletas o sin finalización válida y usa las disponibles", () => {
    const rounds: Round[] = [round, {...round, id: "open", estado: "en curso"}, {...round, id: "no-fin", fin: undefined}, {...round, id: "bad", fin: "invalid"}];
    expect(selectRounds(rounds, "20")).toEqual([round]); expect(selectRounds(rounds, "all")).toEqual([round]);
  });
  it("agrega únicamente hoyos completados y golpes de rondas seleccionadas", () => {
    const source = data(); source.rounds.push({...round, id: "open", estado: "en curso"});
    source.playedHoles.push(hole("other", 4, "open"), { ...hole("pending"), estado: "en curso" });
    source.shots.push(shot("other", 1, {hoyoId: "other"}), shot("pending", 1, {hoyoId: "pending"}));
    expect(aggregate(source, "all").shots).toHaveLength(3);
  });
  it("reutiliza FIR y GIR con penalizaciones, par 3 y embocado directo", () => {
    const holes = [hole(), hole("p3", 3), hole("p5", 5)];
    const shots = [shot("1"), shot("2", 2, {destino: "Green", penalizacion: 1}), shot("3", 1, {hoyoId: "p3", destino: "Hoyo"}), shot("4", 1, {hoyoId: "p5", destino: "Rough"}), shot("5", 2, {hoyoId: "p5", destino: "Green"})];
    const result = regulation([round], holes, shots);
    expect(result.fir).toEqual({numerator: 1, denominator: 2, percentage: 50});
    expect(result.gir.numerator).toBe(2); expect(result.gir.denominator).toBe(3);
  });
  it("normaliza rondas 9 y 18 desde media por hoyo, no promedio de rondas", () => {
    const holes = Array.from({length: 27}, (_, i) => hole(`h${i}`, 4, i < 9 ? "r" : "r18"));
    const shots = holes.flatMap((h, i) => Array.from({length: i < 9 ? 4 : 5}, (_, n) => shot(`${i}-${n}`, n + 1, {hoyoId: h.id})));
    const result = normalizeResults(holes, shots);
    expect(result.score18).toBe(84); expect(result.overPar18).toBe(12);
    expect(normalizeResults(holes.slice(0,9), shots.filter(s => holes.slice(0,9).some(h => h.id === s.hoyoId))).score18).toBe(72);
    expect(normalizeResults(holes.slice(9), shots.filter(s => holes.slice(9).some(h => h.id === s.hoyoId))).score18).toBe(90);
  });
  it("cuenta putting, red zone, direcciones conocidas y hoyos con cero o 3+", () => {
    const holes = [hole(), hole("zero"), hole("three")];
    const shots = [putt("red", "Red zone", {penalizacion: 2}), putt("holed"), putt("unknown", "Corto", {direccion: null}), putt("outside", "Corto", {origen: "Calle"}), shot("putter-normal", 1, {paloId: "putter"}), ...[1,2,3].map(n => putt(`three-${n}`, "Embocado", {hoyoId: "three", distancia: "Largo"}))];
    const values = putting(holes, shots);
    expect(values.total).toBe(6); expect(values.average).toBe(2);
    expect(values.holeDistribution.map(d => d.numerator)).toEqual([1,0,0,2]);
    expect(values.byDistance[1].holed.numerator).toBe(1);
    expect(values.byDistance[1].red.numerator).toBe(1);
    expect(values.byDistance[1].combined).toEqual({ numerator: 2, denominator: 3, percentage: 2/3*100 });
    expect(values.directions[0].denominator).toBe(1); expect(values.unknownDirections).toBe(1);
    expect(values.results.find(r => r.label === "Red zone")?.numerator).toBe(1);
  });
  it("puntuación por eje 100/60/20 en las 25 combinaciones", () => {
    const scores = [20,60,100,60,20];
    horizontalZones.forEach((h, i) => verticalZones.forEach((v, j) => {
      expect(precision([shot("a", 1, {diana: targetFromCategories(h,v)})]).index).toBe((scores[i]+scores[j])/2);
    }));
  });
  it("excluye dianas incompletas sin ponderar destino ni penalización", () => {
    const shots = [shot("a"), shot("b", 2, {diana: targetFromCategories("Muy derecha","Corto"), destino: "Agua", penalizacion: 2}), shot("c", 3, {diana: undefined} as unknown as Partial<Shot>), shot("d", 4, {diana: {horizontal: "Centro"}} as unknown as Partial<Shot>)];
    expect(precision(shots)).toEqual({index: 70, valid: 2, excluded: 2, total: 4});
    const result = dispersion(shots);
    expect(result.cells).toHaveLength(25); expect(result.cells.reduce((sum, c) => sum + c.numerator, 0)).toBe(2);
    expect(result.horizontal.map(d => d.numerator)).toEqual([0,0,1,0,1]);
    expect(result.vertical.map(d => d.numerator)).toEqual([0,1,1,0,0]);
  });
  it("destinos incluyen embocado, tee y otro sin ocultar golpes", () => {
    const result = destinationDistribution([shot("a",1,{destino:"Hoyo"}), shot("b",2,{destino:"Otro"}), shot("c",3,{destino:"Tee"}), putt("p")]);
    expect(result.find(d => d.label === "Embocado")?.numerator).toBe(1);
    expect(result[0].denominator).toBe(3); expect(result.reduce((n,d) => n+d.numerator,0)).toBe(3);
  });
  it("salidas consideran primer tee por hoyo, incluso tras golpe al aire", () => {
    const result = teeStatistics([round], [hole()], [shot("b",2), shot("a",1,{destino:"Tee"}), shot("c",3,{origen:"Calle"})]);
    expect(result.total).toBe(1); expect(result.fir.numerator).toBe(0); expect(result.destinations[0].numerator).toBe(1);
  });
  it("conserva palos históricos, renombrados, inactivos y sin golpes", () => {
    const source = data(); source.clubs = [{id:"driver", nombre:"Driver nuevo",categoria:"Driver",activo:false,orden:0,creado:"fecha"}, {id:"unused",nombre:"Hierro",categoria:"Hierro",activo:true,orden:1,creado:"fecha"}];
    const clubs = clubStatistics(source,"all");
    expect(clubs.find(c => c.id === "driver")).toMatchObject({name:"Driver antiguo",currentName:"Driver nuevo",inactive:true,index:100});
    expect(clubs.find(c => c.id === "putter")).toMatchObject({putter:true,name:"Putter histórico"});
    expect(clubs.find(c => c.id === "unused")).toMatchObject({count:0,index:null});
  });
  it("filtro global afecta también detalle y evolución por palo", () => {
    const source = data(); source.rounds.push({...round,id:"new",fin:"2026-02-01"}); source.playedHoles.push(hole("new",4,"new")); source.shots.push(shot("new",1,{hoyoId:"new",diana:targetFromCategories("Muy izquierda","Muy corto")}));
    expect(statistics(source,"1").clubs.find(c=>c.id==="driver")?.index).toBe(20);
    expect(statistics(source,"all").clubs.find(c=>c.id==="driver")?.evolution).toHaveLength(2);
  });
  it("penalizaciones son golpes y se normalizan por hoyos", () => {
    const source = data([shot("1",1,{penalizacion:2}),shot("2",2,{penalizacion:1})]);
    expect(penalties(source.shots)).toBe(3); expect(statistics(source,"all").penalties18).toBe(54);
  });
  it("recalcula al editar o reabrir una ronda", () => {
    const source = data(); expect(statistics(source,"all").clubs[0].index).toBe(100);
    const changed = {...source,shots:source.shots.map(s=>s.id==="1" ? shot("1",1,{diana:targetFromCategories("Muy izquierda","Muy corto")}) : s)};
    expect(statistics(changed,"all").clubs[0].index).toBe(60);
    expect(statistics({...source,rounds:[{...round,estado:"en curso",fin:undefined}]},"all").holes).toHaveLength(0);
  });
  it("no divide por cero, diferencia ausencia de cero real", () => {
    const empty = statistics({rounds:[],playedHoles:[],shots:[],clubs:[]},"all");
    expect(empty.score18).toBeNull(); expect(empty.fir.percentage).toBeNull(); expect(empty.putting.average).toBeNull(); expect(empty.penalties18).toBeNull();
    expect(statistics(data(),"all").penalties18).toBe(0);
    expect(precision([]).index).toBeNull(); expect(JSON.stringify(empty)).not.toContain("NaN");
  });
});
