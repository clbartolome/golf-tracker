import {
  horizontalZones,
  verticalZones,
  classifyTarget,
  type TargetSelection,
} from "./target";
export const origins = [
  "Tee",
  "Calle",
  "Rough",
  "Bunker",
  "Green",
  "Otro",
] as const;
// Tee and Otro also allow a shot without the ball moving, including an air shot.
export const destinations = [
  "Tee",
  "Calle",
  "Rough",
  "Bunker",
  "Green",
  "Agua",
  "Fuera",
  "Hoyo",
  "Otro",
] as const;
export type Origin = (typeof origins)[number];
export type Destination = (typeof destinations)[number];
export const puttDirections = ["Izquierda", "Centro", "Derecha"] as const;
export const puttResults = ["Muy corto", "Corto", "Red zone", "Largo", "Muy largo", "Embocado"] as const;
export type PuttDirection = (typeof puttDirections)[number];
export type PuttResult = (typeof puttResults)[number];
export type Penalty = 0 | 1 | 2;
export interface Round {
  id: string;
  campoId: string;
  campoNombre: string;
  inicio: string;
  fin?: string;
  estado: "en curso" | "finalizada";
  numeroHoyos: 9 | 18;
  revision: number;
}
export interface PlayedHole {
  id: string;
  rondaId: string;
  numero: number;
  par: number;
  estado: "pendiente" | "en curso" | "completado";
}
interface ShotCommon {
  id: string;
  hoyoId: string;
  orden: number;
  origen: Origin;
  paloId: string;
  paloNombre: string;
  penalizacion: Penalty;
}
export type Shot = ShotCommon &
  (
    | { tipo: "normal"; destino: Destination; diana: TargetSelection }
    | {
        tipo: "putt";
        destino: "Green" | "Hoyo";
        distancia: "Corto" | "Medio" | "Largo";
        resultado: PuttResult;
        direccion: PuttDirection | null;
      }
  );
export type ShotInput = {
  origen: Origin;
  paloId: string;
  penalizacion: Penalty;
} & (
  | { tipo: "normal"; destino: Destination; diana: TargetSelection | null }
  | {
      tipo: "putt";
      distancia: "Corto" | "Medio" | "Largo";
      resultado: PuttResult;
        direccion: PuttDirection | null;
    }
);
export function shotDestination(shot: Shot): Destination {
  return shot.destino;
}
export function holed(shot: Shot | undefined) {
  return shot?.destino === "Hoyo";
}
export function nextOrigin(shots: Shot[]): Origin | "" {
  const last = shots.at(-1);
  if (!last) return "Tee";
  const destination = shotDestination(last);
  return origins.includes(destination as Origin) ? (destination as Origin) : "";
}
export function holeScore(shots: Shot[]) {
  const penalties = shots.reduce((sum, shot) => sum + shot.penalizacion, 0);
  return { physical: shots.length, penalties, total: shots.length + penalties };
}
export function continuityWarnings(shots: Shot[]) {
  const warnings: string[] = [];
  shots.forEach((shot, i) => {
    if (i === 0) return;
    const previous = shots[i - 1];
    if (holed(previous))
      warnings.push(`Golpe ${shot.orden}: hay un golpe después de embocar.`);
    else {
      const expected = nextOrigin([previous]);
      if (expected && expected !== shot.origen)
        warnings.push(
          `Golpe ${shot.orden}: origen ${shot.origen}, destino anterior ${expected}. Revisa la continuidad.`,
        );
    }
  });
  return warnings;
}
export function canConfirmHole(shots: Shot[]) {
  return holed(shots.at(-1)) && !shots.slice(0, -1).some(holed);
}
export function validateShot(input: ShotInput) {
  if (!origins.includes(input.origen))
    throw new Error("Selecciona el origen del golpe.");
  if (![0, 1, 2].includes(input.penalizacion))
    throw new Error("La penalización debe ser 0, 1 o 2.");
  if (!input.paloId) throw new Error("Selecciona un palo de tu bolsa.");
  if (input.tipo === "normal") {
    if (!destinations.includes(input.destino))
      throw new Error("Selecciona un destino válido.");
    const target = input.diana;
    if (
      !target ||
      !horizontalZones.includes(target.horizontal) ||
      !verticalZones.includes(target.vertical)
    )
      throw new Error("Selecciona explícitamente la diana antes de guardar.");
    if (target.point) {
      const classified = classifyTarget(target.point.x, target.point.y);
      if (
        Math.hypot(target.point.x, target.point.y) > 1.0000001 ||
        classified.horizontal !== target.horizontal ||
        classified.vertical !== target.vertical
      )
        throw new Error("La posición y categorías de la diana no coinciden.");
    }
  } else if (input.tipo === "putt") {
    if (input.origen !== "Green")
      throw new Error("Un putt debe realizarse desde Green.");
    if (
      !["Corto", "Medio", "Largo"].includes(input.distancia) ||
      !puttResults.includes(input.resultado)
    )
      throw new Error("Selecciona distancia y resultado del putt.");
    if (!puttDirections.includes(input.direccion as PuttDirection) && !(input.resultado === "Embocado" && input.direccion === null))
      throw new Error("Selecciona la dirección final del putt.");
  } else throw new Error("Tipo de golpe inválido.");
}
export function roundUrl(
  page: "golpe" | "resumen" | "tarjeta",
  roundId: string,
  holeId?: string,
  editId?: string,
) {
  const params = new URLSearchParams({ r: roundId });
  if (holeId) params.set("h", holeId);
  if (editId) params.set("edit", editId);
  return `/ronda/${page}?${params}`;
}
