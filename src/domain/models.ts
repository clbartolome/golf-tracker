export const categories = [
  "Driver",
  "Madera",
  "Híbrido",
  "Hierro",
  "Wedge",
  "Putter",
  "Otro",
] as const;
export type Category = (typeof categories)[number];
export interface Course {
  id: string;
  nombre: string;
  favorito: boolean;
  numeroHoyos: 9 | 18;
  creado: string;
  modificado: string;
}
export interface Hole {
  id: string;
  campoId: string;
  numero: number;
  par: number;
}
export interface Club {
  id: string;
  nombre: string;
  categoria: Category;
  activo: boolean;
  orden: number;
  creado: string;
}
export interface CourseWithHoles extends Course {
  hoyos: Hole[];
}
export interface CourseInput {
  id?: string;
  nombre: string;
  favorito: boolean;
  pares: number[];
}
export function totalPar(holes: { par: number }[]) {
  return holes.reduce((sum, hole) => sum + hole.par, 0);
}
export function resizePars(pars: number[], size: 9 | 18) {
  return Array.from({ length: size }, (_, i) => pars[i] ?? 4);
}
export function validateCourse(input: CourseInput) {
  if (!input.nombre.trim() || input.nombre.trim().length > 100)
    throw new Error("Escribe un nombre de campo de entre 1 y 100 caracteres.");
  if (
    ![9, 18].includes(input.pares.length) ||
    input.pares.some((par) => !Number.isInteger(par) || par < 3 || par > 6)
  )
    throw new Error(
      "Cada hoyo debe tener un par entre 3 y 6; el campo debe tener 9 o 18 hoyos.",
    );
}
