import { liveQuery } from "dexie";
import { GolfDatabase } from "./database";
import {
  categories,
  validateCourse,
  type Club,
  type CourseInput,
  type Category,
} from "../domain/models";
import { createBackupRepository } from "./backupRepository";
import { createRoundRepository } from "./roundRepository";
const initialClubs: [string, Category][] = [
  ["Driver", "Driver"],
  ["Madera 3", "Madera"],
  ["Híbrido 4", "Híbrido"],
  ...[5, 6, 7, 8, 9].map(
    (n) => [`Hierro ${n}`, "Hierro"] as [string, Category],
  ),
  ["PW", "Wedge"],
  ["SW", "Wedge"],
  ["Putter", "Putter"],
];
export function createRepository(db: GolfDatabase) {
  return {
    ...createRoundRepository(db),
    ...createBackupRepository(db),
    async initialize() {
      await db.transaction("rw", db.clubs, db.metadata, async () => {
        if (await db.metadata.get("initial-bag-v1")) return;
        // Preserve any existing personalized bag if importing an earlier schema later.
        if ((await db.clubs.count()) === 0)
          await db.clubs.bulkAdd(
            initialClubs.map(([nombre, categoria], orden) => ({
              id: crypto.randomUUID(),
              nombre,
              categoria,
              activo: true,
              orden,
              creado: new Date().toISOString(),
            })),
          );
        await db.metadata.put({ key: "initial-bag-v1", value: true });
      });
    },
    async snapshot() {
      return db.transaction(
        "r",
        [db.courses, db.holes, db.clubs, db.rounds, db.playedHoles, db.shots],
        async () => {
          const courses = await db.courses.toArray();
          const holes = await db.holes.toArray();
          return {
            courses: courses
              .sort(
                (a, b) =>
                  Number(b.favorito) - Number(a.favorito) ||
                  a.nombre.localeCompare(b.nombre, "es") ||
                  a.id.localeCompare(b.id),
              )
              .map((course) => ({
                ...course,
                hoyos: holes
                  .filter((hole) => hole.campoId === course.id)
                  .sort((a, b) => a.numero - b.numero),
              })),
            clubs: await db.clubs.orderBy("orden").toArray(),
            rounds: await db.rounds.orderBy("inicio").reverse().toArray(),
            playedHoles: await db.playedHoles.toArray(),
            shots: await db.shots.toArray(),
          };
        },
      );
    },
    async saveCourse(input: CourseInput) {
      validateCourse(input);
      return db.transaction("rw", db.courses, db.holes, async () => {
        const old = input.id ? await db.courses.get(input.id) : undefined;
        if (input.id && !old)
          throw new Error("El campo ya no existe. Vuelve a la lista.");
        const id = old?.id ?? crypto.randomUUID();
        const now = new Date().toISOString();
        const oldHoles = await db.holes.where("campoId").equals(id).toArray();
        await db.courses.put({
          id,
          nombre: input.nombre.trim(),
          favorito: input.favorito,
          numeroHoyos: input.pares.length as 9 | 18,
          creado: old?.creado ?? now,
          modificado: now,
        });
        await db.holes.where("campoId").equals(id).delete();
        await db.holes.bulkAdd(
          input.pares.map((par, i) => ({
            id:
              oldHoles.find((h) => h.numero === i + 1)?.id ??
              crypto.randomUUID(),
            campoId: id,
            numero: i + 1,
            par,
          })),
        );
        return id;
      });
    },
    async favorite(id: string, favorito: boolean) {
      await db.transaction("rw", db.courses, async () => {
        if (
          !(await db.courses.update(id, {
            favorito,
            modificado: new Date().toISOString(),
          }))
        )
          throw new Error("El campo ya no existe.");
      });
    },
    async deleteCourse(id: string) {
      await db.transaction("rw", db.courses, db.holes, async () => {
        await db.holes.where("campoId").equals(id).delete();
        await db.courses.delete(id);
      });
    },
    async saveClub(input: {
      id?: string;
      nombre: string;
      categoria: Category;
      activo: boolean;
    }) {
      if (!input.nombre.trim() || input.nombre.trim().length > 60)
        throw new Error(
          "Escribe un nombre de palo de entre 1 y 60 caracteres.",
        );
      if (!categories.includes(input.categoria))
        throw new Error("Selecciona una categoría válida.");
      await db.transaction("rw", db.clubs, async () => {
        const old = input.id ? await db.clubs.get(input.id) : undefined;
        if (input.id && !old) throw new Error("El palo ya no existe.");
        const last = await db.clubs.orderBy("orden").last();
        await db.clubs.put({
          id: old?.id ?? crypto.randomUUID(),
          nombre: input.nombre.trim(),
          categoria: input.categoria,
          activo: input.activo,
          orden: old?.orden ?? (last?.orden ?? -1) + 1,
          creado: old?.creado ?? new Date().toISOString(),
        });
      });
    },
    async toggleClub(club: Club) {
      if (!(await db.clubs.update(club.id, { activo: !club.activo })))
        throw new Error("El palo ya no existe.");
    },
    async moveClub(id: string, direction: -1 | 1) {
      await db.transaction("rw", db.clubs, async () => {
        const clubs = await db.clubs.orderBy("orden").toArray();
        const i = clubs.findIndex((c) => c.id === id);
        if (i < 0) throw new Error("El palo ya no existe.");
        const other = clubs[i + direction];
        if (!other) return;
        await db.clubs.update(id, { orden: other.orden });
        await db.clubs.update(other.id, { orden: clubs[i].orden });
      });
    },
    async deleteClub(id: string) {
      await db.clubs.delete(id);
    },
  };
}
export const database = new GolfDatabase();
export const repository = createRepository(database);
export function watchData(
  next: (data: Awaited<ReturnType<typeof repository.snapshot>>) => void,
  error: (error: unknown) => void,
) {
  let cancelled = false;
  let unsubscribe = () => {};
  repository
    .initialize()
    .then(() => {
      if (!cancelled) {
        const subscription = liveQuery(() => repository.snapshot()).subscribe({
          next,
          error,
        });
        unsubscribe = () => subscription.unsubscribe();
      }
    })
    .catch((err) => {
      if (!cancelled) error(err);
    });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}
export function dataError(error: unknown) {
  return error instanceof Error && !("inner" in error)
    ? error.message
    : "No se pudo acceder al almacenamiento local. Comprueba el espacio y los permisos del navegador y vuelve a intentarlo.";
}
