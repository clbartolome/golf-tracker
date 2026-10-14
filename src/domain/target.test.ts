import { describe, it, expect } from "vitest";
import {
  classifyTarget,
  targetFromCategories,
  horizontalZones,
  verticalZones,
  zoneIndex,
  targetLabel,
} from "./target";
describe("Clasificación de la diana", () => {
  for (const horizontal of horizontalZones)
    for (const vertical of verticalZones)
      it(`${vertical} / ${horizontal}`, () => {
        const target = targetFromCategories(horizontal, vertical);
        expect(classifyTarget(target.point!.x, target.point!.y)).toMatchObject({
          horizontal,
          vertical,
        });
      });
  it("clasifica cada eje independientemente del radio y del otro eje", () => {
    for (const y of [-0.7, -0.4, 0, 0.4, 0.7])
      expect(classifyTarget(0.3, y).horizontal).toBe("Derecha");
    for (const x of [-0.7, -0.4, 0, 0.4, 0.7])
      expect(classifyTarget(x, -0.3).vertical).toBe("Corto");
    expect(classifyTarget(0.5, 0)).toMatchObject({ horizontal: "Derecha", vertical: "Distancia correcta" });
    expect(classifyTarget(0, 0.5)).toMatchObject({ horizontal: "Centro", vertical: "Largo" });
  });
  it("usa límites deterministas inclusivos en la categoría superior", () => {
    for (const [boundary, index] of [
      [-0.6, 1],
      [-0.2, 2],
      [0.2, 3],
      [0.6, 4],
    ]) {
      expect(zoneIndex(boundary)).toBe(index);
      expect(zoneIndex(boundary - 1e-10)).toBe(index - 1);
    }
    expect(zoneIndex(-1)).toBe(0);
    expect(zoneIndex(1)).toBe(4);
  });
  it("limita al círculo y no interpreta la posición como metros", () => {
    const target = classifyTarget(10, 10);
    expect(Math.hypot(target.point!.x, target.point!.y)).toBeCloseTo(1);
    expect(target).toMatchObject({
      horizontal: "Muy derecha",
      vertical: "Muy largo",
    });
    expect(targetLabel(classifyTarget(0, 0))).toBe("Centro");
    expect(() => classifyTarget(NaN, 0)).toThrow();
  });
});
