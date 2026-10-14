export const horizontalZones = [
  "Muy izquierda",
  "Izquierda",
  "Centro",
  "Derecha",
  "Muy derecha",
] as const;
export const verticalZones = [
  "Muy corto",
  "Corto",
  "Distancia correcta",
  "Largo",
  "Muy largo",
] as const;
export type Horizontal = (typeof horizontalZones)[number];
export type Vertical = (typeof verticalZones)[number];
export interface TargetSelection {
  horizontal: Horizontal;
  vertical: Vertical;
  point?: { x: number; y: number };
}
// Positive y means long. Intervals [-1,-.6),[-.6,-.2),[-.2,.2),[.2,.6),[.6,1].
export function zoneIndex(value: number) {
  if (!Number.isFinite(value)) throw new Error("Posición de diana inválida.");
  return value < -0.6
    ? 0
    : value < -0.2
      ? 1
      : value < 0.2
        ? 2
        : value < 0.6
          ? 3
          : 4;
}
export function clampPoint(x: number, y: number) {
  if (![x, y].every(Number.isFinite))
    throw new Error("Posición de diana inválida.");
  const radius = Math.hypot(x, y);
  return radius > 1 ? { x: x / radius, y: y / radius } : { x, y };
}
export function classifyTarget(x: number, y: number): TargetSelection {
  const point = clampPoint(x, y);
  return {
    horizontal: horizontalZones[zoneIndex(point.x)],
    vertical: verticalZones[zoneIndex(point.y)],
    point,
  };
}
export function targetFromCategories(
  horizontal: Horizontal,
  vertical: Vertical,
): TargetSelection {
  const positions = [-0.7, -0.4, 0, 0.4, 0.7];
  return {
    horizontal,
    vertical,
    point: clampPoint(
      positions[horizontalZones.indexOf(horizontal)],
      positions[verticalZones.indexOf(vertical)],
    ),
  };
}
export function targetLabel(target: TargetSelection) {
  return target.horizontal === "Centro" &&
    target.vertical === "Distancia correcta"
    ? "Centro"
    : `${target.vertical} · ${target.horizontal}`;
}
