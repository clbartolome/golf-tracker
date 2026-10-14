import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { GolfDatabase } from "./database";
import { createRepository } from "./repository";
import { resizePars, totalPar } from "../domain/models";
let db: GolfDatabase;
let repo: ReturnType<typeof createRepository>;
beforeEach(() => {
  db = new GolfDatabase(`test-${crypto.randomUUID()}`);
  repo = createRepository(db);
});
afterEach(async () => {
  await db.delete();
});
const input = (size = 9) => ({
  nombre: "Mi campo",
  favorito: false,
  pares: Array<number>(size).fill(4),
});
describe("Campos y hoyos persistentes", () => {
  it.each([9, 18])(
    "crea %i hoyos válidos con IDs únicos y total correcto",
    async (size) => {
      const id = await repo.saveCourse(input(size));
      const { courses } = await repo.snapshot();
      expect(courses[0].id).toBe(id);
      expect(courses[0].hoyos).toHaveLength(size);
      expect(new Set(courses[0].hoyos.map((h) => h.id)).size).toBe(size);
      expect(totalPar(courses[0].hoyos)).toBe(size * 4);
    },
  );
  it("guarda nombre, pares, favorito y conserva IDs al editar", async () => {
    const id = await repo.saveCourse(input());
    const old = (await repo.snapshot()).courses[0];
    await repo.saveCourse({
      id,
      nombre: "  Campo nuevo  ",
      favorito: true,
      pares: [3, 4, 5, 6, 4, 4, 4, 4, 4],
    });
    const updated = (await repo.snapshot()).courses[0];
    expect(updated.nombre).toBe("Campo nuevo");
    expect(updated.favorito).toBe(true);
    expect(updated.hoyos.map((h) => h.par)).toEqual([
      3, 4, 5, 6, 4, 4, 4, 4, 4,
    ]);
    expect(updated.hoyos.map((h) => h.id)).toEqual(old.hoyos.map((h) => h.id));
    expect(updated.creado).toBe(old.creado);
    expect(totalPar(updated.hoyos)).toBe(38);
  });
  it("ordena favoritos primero y permite desmarcarlos", async () => {
    await repo.saveCourse({ ...input(), nombre: "Alfa" });
    const id = await repo.saveCourse({ ...input(), nombre: "Zeta" });
    await repo.favorite(id, true);
    expect((await repo.snapshot()).courses[0].nombre).toBe("Zeta");
    await repo.favorite(id, false);
    expect((await repo.snapshot()).courses[0].nombre).toBe("Alfa");
  });
  it("amplía conservando 9 hoyos, añade par 4 y reduce atómicamente", async () => {
    const id = await repo.saveCourse({
      ...input(),
      pares: [3, 5, 6, 4, 4, 4, 4, 4, 4],
    });
    const original = (await repo.snapshot()).courses[0];
    await repo.saveCourse({
      id,
      nombre: original.nombre,
      favorito: false,
      pares: resizePars(
        original.hoyos.map((h) => h.par),
        18,
      ),
    });
    const expanded = (await repo.snapshot()).courses[0];
    expect(expanded.hoyos.slice(0, 9)).toEqual(original.hoyos);
    expect(expanded.hoyos.slice(9).map((h) => h.par)).toEqual(Array(9).fill(4));
    await repo.saveCourse({
      id,
      nombre: original.nombre,
      favorito: false,
      pares: resizePars(
        expanded.hoyos.map((h) => h.par),
        9,
      ),
    });
    expect((await repo.snapshot()).courses[0].hoyos).toEqual(original.hoyos);
  });
  it("rechaza datos inválidos sin cambios parciales", async () => {
    const id = await repo.saveCourse(input());
    const before = await repo.snapshot();
    await expect(
      repo.saveCourse({
        ...input(),
        id,
        nombre: "Cambio",
        pares: Array(9).fill(2),
      }),
    ).rejects.toThrow();
    expect(await repo.snapshot()).toEqual(before);
    await expect(
      repo.saveCourse({ ...input(), nombre: "  " }),
    ).rejects.toThrow();
    await expect(repo.saveCourse(input(10))).rejects.toThrow();
  });
  it("el índice único impide dos números de hoyo en el mismo campo y revierte la transacción", async () => {
    const id = await repo.saveCourse(input());
    await expect(
      db.transaction("rw", db.holes, async () => {
        await db.holes.add({
          id: crypto.randomUUID(),
          campoId: id,
          numero: 10,
          par: 4,
        });
        await db.holes.add({
          id: crypto.randomUUID(),
          campoId: id,
          numero: 1,
          par: 4,
        });
      }),
    ).rejects.toThrow();
    expect((await repo.snapshot()).courses[0].hoyos).toHaveLength(9);
  });
  it("revierte nombre y hoyos si falla la escritura dentro del guardado", async () => {
    const id = await repo.saveCourse(input());
    const before = await repo.snapshot();
    const spy = vi
      .spyOn(db.holes, "bulkAdd")
      .mockRejectedValueOnce(new Error("Sin espacio"));
    await expect(
      repo.saveCourse({ ...input(18), id, nombre: "Cambio pendiente" }),
    ).rejects.toThrow("Sin espacio");
    spy.mockRestore();
    expect(await repo.snapshot()).toEqual(before);
  });
  it("elimina campo y sus hoyos relacionados", async () => {
    const id = await repo.saveCourse(input());
    await repo.deleteCourse(id);
    expect((await repo.snapshot()).courses).toHaveLength(0);
    expect(await db.holes.count()).toBe(0);
  });
  it("recupera nombre y pares tras cerrar y abrir otra conexión", async () => {
    await repo.saveCourse({
      ...input(),
      nombre: "Persistente",
      pares: [6, 5, 3, 4, 4, 4, 4, 4, 4],
    });
    const before = await repo.snapshot();
    db.close();
    const reopened = new GolfDatabase(db.name);
    expect(await createRepository(reopened).snapshot()).toEqual(before);
    reopened.close();
  });
});
describe("Bolsa persistente", () => {
  it("inicializa una sola vez incluso en llamadas concurrentes y tras vaciar la bolsa", async () => {
    await Promise.all([repo.initialize(), repo.initialize()]);
    expect((await repo.snapshot()).clubs).toHaveLength(11);
    await repo.initialize();
    expect((await repo.snapshot()).clubs).toHaveLength(11);
    for (const club of (await repo.snapshot()).clubs)
      await repo.deleteClub(club.id);
    await repo.initialize();
    expect((await repo.snapshot()).clubs).toHaveLength(0);
  });
  it("crea, edita, desactiva y activa conservando ID y fecha", async () => {
    await repo.saveClub({
      nombre: "Mi wedge",
      categoria: "Wedge",
      activo: true,
    });
    const club = (await repo.snapshot()).clubs[0];
    await repo.saveClub({
      id: club.id,
      nombre: "Wedge 60",
      categoria: "Otro",
      activo: false,
    });
    let changed = (await repo.snapshot()).clubs[0];
    expect(changed).toMatchObject({
      id: club.id,
      creado: club.creado,
      nombre: "Wedge 60",
      categoria: "Otro",
      activo: false,
    });
    await repo.toggleClub(changed);
    changed = (await repo.snapshot()).clubs[0];
    expect(changed.activo).toBe(true);
  });
  it("reordena arriba y abajo, mantiene orden único al eliminar y crear", async () => {
    await repo.initialize();
    const original = (await repo.snapshot()).clubs;
    await repo.moveClub(original[1].id, -1);
    expect((await repo.snapshot()).clubs[0].id).toBe(original[1].id);
    await repo.moveClub(original[1].id, 1);
    expect((await repo.snapshot()).clubs.map((c) => c.id)).toEqual(
      original.map((c) => c.id),
    );
    await repo.deleteClub(original[3].id);
    await repo.saveClub({ nombre: "Nuevo", categoria: "Otro", activo: true });
    const clubs = (await repo.snapshot()).clubs;
    expect(new Set(clubs.map((c) => c.orden)).size).toBe(clubs.length);
  });
  it("recupera una bolsa personalizada en otra conexión sin duplicar ni reactivar", async () => {
    await repo.initialize();
    const first = (await repo.snapshot()).clubs[0];
    await repo.saveClub({ ...first, nombre: "Mi driver", activo: false });
    const before = await repo.snapshot();
    db.close();
    const reopened = new GolfDatabase(db.name);
    const other = createRepository(reopened);
    await other.initialize();
    expect(await other.snapshot()).toEqual(before);
    reopened.close();
  });
  it("rechaza un nombre vacío", async () => {
    await expect(
      repo.saveClub({ nombre: " ", categoria: "Otro", activo: true }),
    ).rejects.toThrow();
    expect((await repo.snapshot()).clubs).toHaveLength(0);
  });
});
