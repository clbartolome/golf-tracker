import { describe, expect, it } from "vitest";
import { roundIndicators } from "./roundIndicators";
import { classifyTarget } from "./target";
import type { PlayedHole, Round, Shot } from "./rounds";
const round: Round = { id: "r", campoId: "c", campoNombre: "Campo", inicio: "2026-10-14", estado: "en curso", numeroHoyos: 9, revision: 0 };
function hole(par = 4, overrides: Partial<PlayedHole> = {}): PlayedHole {
  return { id: "h", rondaId: "r", numero: 1, par, estado: "completado", ...overrides };
}
function shot(orden: number, overrides: Partial<Shot> = {}): Shot {
  return { id: `s${orden}`, hoyoId: "h", orden, origen: "Tee", paloId: "club", paloNombre: "Palo", tipo: "normal", destino: "Calle", diana: classifyTarget(0, 0), penalizacion: 0, ...overrides } as Shot;
}
function putt(orden: number, overrides: Partial<Shot> = {}): Shot {
  return { id: `p${orden}`, hoyoId: "h", orden, origen: "Green", paloId: "putter", paloNombre: "Putter", tipo: "putt", destino: "Green", distancia: "Corto", direccion: "Centro", resultado: "Red zone", penalizacion: 0, ...overrides } as Shot;
}
function indicators(holes: PlayedHole[], shots: Shot[]) {
  return roundIndicators(round, holes, shots);
}
describe("Indicadores derivados de ronda", () => {
  it.each([4, 5])("FIR en par %s usa el primer golpe desde tee, ordenado", (par) => {
    const result = indicators([hole(par)], [shot(2, { destino: "Rough" }), shot(1)]);
    expect(result.fir).toEqual({ numerator: 1, denominator: 1, percentage: 100 });
  });
  it("FIR no se consigue con una segunda salida a calle", () => {
    expect(indicators([hole()], [shot(1, { destino: "Fuera" }), shot(2)]).fir.numerator).toBe(0);
  });
  it.each(["Tee", "Rough", "Bunker", "Green", "Agua", "Fuera", "Hoyo", "Otro"] as const)("FIR falla cuando termina en %s", (destino) => {
    expect(indicators([hole()], [shot(1, { destino })]).fir).toEqual({ numerator: 0, denominator: 1, percentage: 0 });
  });
  it("excluye par 3 y hoyos sin completar del denominador FIR", () => {
    expect(indicators([hole(3), hole(4, { id: "open", estado: "en curso" })], [shot(1), shot(1, { hoyoId: "open" })]).fir)
      .toEqual({ numerator: 0, denominator: 0, percentage: null });
  });
  it.each([[3, 1], [4, 2], [5, 3]])("GIR en par %s permite %s golpes", (par, limit) => {
    const shots = Array.from({ length: limit }, (_, i) => shot(i + 1, { destino: i + 1 === limit ? "Green" : "Calle" }));
    expect(indicators([hole(par)], shots).gir.percentage).toBe(100);
    expect(indicators([hole(par)], [shot(1, { destino: "Rough" }), ...shots.map((s) => ({ ...s, orden: s.orden + 1 }))]).gir.percentage).toBe(0);
  });
  it("GIR incluye penalizaciones anteriores y del golpe que llega a green", () => {
    expect(indicators([hole(5)], [shot(1, { penalizacion: 1 }), shot(2, { destino: "Green" })]).gir.numerator).toBe(1);
    expect(indicators([hole(5)], [shot(1, { penalizacion: 1 }), shot(2, { destino: "Green", penalizacion: 1 })]).gir.numerator).toBe(0);
  });
  it("GIR permite embocar directamente en el margen", () => {
    expect(indicators([hole(3)], [shot(1, { destino: "Hoyo" })]).gir.numerator).toBe(1);
    expect(indicators([hole(3)], [shot(1, { destino: "Hoyo", penalizacion: 1 })]).gir.numerator).toBe(0);
  });
  it("GIR usa la primera llegada y no penalizaciones posteriores", () => {
    expect(indicators([hole()], [shot(1, { destino: "Green" }), shot(2, { origen: "Green", destino: "Rough", penalizacion: 2 }), shot(3, { destino: "Green" })]).gir.numerator).toBe(1);
    expect(indicators([hole()], [shot(1), shot(2), shot(3, { destino: "Green" }), shot(4, { destino: "Hoyo" })]).gir.numerator).toBe(0);
  });
  it("sin green ni embocado GIR falla; hoyos abiertos no cuentan", () => {
    expect(indicators([hole(), hole(4, { id: "open", estado: "en curso" })], [shot(1), shot(1, { hoyoId: "open", destino: "Green" })]).gir)
      .toEqual({ numerator: 0, denominator: 1, percentage: 0 });
  });
  it("putts son solo modo putting desde green, sin penalizaciones como putts", () => {
    const values = indicators([hole(), hole(3, { id: "h2" })], [
      shot(1, { paloId: "putter", paloNombre: "Putter" }),
      shot(2, { origen: "Green", destino: "Green" }),
      putt(3, { penalizacion: 2 }), putt(4, { destino: "Hoyo", resultado: "Embocado" }),
      putt(1, { hoyoId: "h2", destino: "Hoyo", resultado: "Embocado" }),
      putt(5, { origen: "Calle" }),
    ]);
    expect(values.putts).toBe(3);
    expect(values.averagePutts).toBe(1.5);
  });
  it("red zone no incorpora un hoyo abierto a la media", () => {
    const values = indicators([hole(4, { estado: "en curso" })], [putt(1)]);
    expect(values.completedHoles).toBe(0);
    expect(values.putts).toBe(0);
    expect(values.averagePutts).toBeNull();
    expect(values.gir.percentage).toBeNull();
    expect(values.difference).toBeNull();
  });
  it("penalizaciones y score suman todos los golpes de la ronda, incluidos abiertos", () => {
    const values = indicators([hole(), hole(3, { id: "open", estado: "en curso" })], [
      shot(1, { penalizacion: 2 }), putt(2, { penalizacion: 1 }),
      shot(1, { hoyoId: "open", penalizacion: 2 }), shot(1, { hoyoId: "other", penalizacion: 2 }),
    ]);
    expect(values.penalties).toBe(5);
    expect(values.totalScore).toBe(8);
    expect(values.completedScore).toBe(5);
    expect(values.completedPar).toBe(4);
    expect(values.difference).toBe(1);
  });
  it("recalcula desde datos editados o eliminados sin modificar fuentes", () => {
    const holes = [hole()];
    const shots = [shot(1), shot(2, { destino: "Green" }), putt(3, { destino: "Hoyo", resultado: "Embocado" })];
    const original = structuredClone(shots);
    expect(indicators(holes, shots).fir.numerator).toBe(1);
    expect(indicators(holes, shots.map((s) => s.orden === 1 ? { ...s, destino: "Rough", penalizacion: 2 } as Shot : s)).gir.numerator).toBe(0);
    expect(indicators(holes, shots.filter((s) => s.tipo !== "putt")).putts).toBe(0);
    expect(indicators([hole(4, { estado: "en curso" })], shots.slice(0, -1)).gir.denominator).toBe(0);
    expect(shots).toEqual(original);
  });
  it("no mezcla hoyos ni golpes de otras rondas", () => {
    const values = indicators([hole(), hole(5, { id: "other-hole", rondaId: "other-round" })], [
      shot(1), shot(2, { destino: "Green" }), putt(3),
      shot(1, { hoyoId: "other-hole", penalizacion: 2 }), putt(2, { hoyoId: "other-hole" }),
    ]);
    expect(values.fir.denominator).toBe(1);
    expect(values.gir.denominator).toBe(1);
    expect(values.putts).toBe(1);
    expect(values.penalties).toBe(0);
    expect(values.totalScore).toBe(3);
  });
  it("etiqueta parcial incluso con todos los hoyos confirmados hasta finalizar", () => {
    const holes = Array.from({ length: 9 }, (_, i) => hole(4, { id: `h${i}`, numero: i + 1 }));
    expect(roundIndicators(round, holes, []).partial).toBe(true);
    expect(roundIndicators({ ...round, estado: "finalizada" }, holes, []).partial).toBe(false);
  });
});
