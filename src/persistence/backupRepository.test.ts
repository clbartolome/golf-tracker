import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveQuery } from "dexie";
import { GolfDatabase } from "./database";
import { createRepository } from "./repository";
import { parseBackup } from "../domain/backup";
import { statistics } from "../domain/statistics";
import { backupFixture } from "../test-helpers/backupFixture";

let db: GolfDatabase;
let repo: ReturnType<typeof createRepository>;
beforeEach(() => {
  db = new GolfDatabase(`backup-test-${crypto.randomUUID()}`);
  repo = createRepository(db);
});
afterEach(async () => { vi.restoreAllMocks(); await db.delete(); });
async function exported() { return parseBackup(JSON.stringify(await repo.exportBackup())); }

describe("Copias completas de bolsa y referencias históricas", () => {
  it("exporta varios palos con todos los atributos persistidos, incluidos personalizados e inactivos", async () => {
    await backupFixture(repo);
    const backup = await exported();
    expect(backup.data.clubs).toHaveLength(11);
    expect(backup.data.clubs).toEqual(await db.clubs.toArray());
    expect(backup.data.clubs.find(c => c.nombre === "Wedge personalizado 60°")).toMatchObject({ categoria: "Wedge", activo: false });
    expect(Object.keys(backup.data.clubs[0]).sort()).toEqual(["activo", "categoria", "creado", "id", "nombre", "orden"]);
  });

  it("conserva exactamente bolsa, IDs, fechas, categorías, estado y orden tras ida y vuelta", async () => {
    const { iron, roundId } = await backupFixture(repo);
    const original = await repo.snapshot();
    const backup = await exported();
    await repo.saveClub({ ...iron, nombre: "Cambio posterior", activo: true });
    await repo.moveClub(iron.id, 1);
    await repo.saveClub({ nombre: "Palo posterior", categoria: "Otro", activo: true });
    await repo.deleteRound(roundId, original.rounds[0].revision);
    expect(await repo.snapshot()).not.toEqual(original);
    await repo.restoreBackup(backup);
    expect(await repo.snapshot()).toEqual(original);
    expect((await exported()).data).toEqual(backup.data);
    db.close();
    await db.open();
    await repo.initialize();
    expect(await repo.snapshot()).toEqual(original);
  });

  it("mantiene referencias por ID y nombres históricos al renombrar, desactivar o eliminar", async () => {
    const { iron, removed } = await backupFixture(repo);
    const backup = await exported();
    expect(backup.historicalReferences.clubIds).toEqual([removed.id]);
    await repo.restoreBackup(backup);
    const data = await repo.snapshot();
    expect(data.clubs.find(c => c.id === iron.id)).toMatchObject({ nombre: "Mi hierro renovado", activo: false });
    const ironShots = data.shots.filter(s => s.paloId === iron.id);
    expect(ironShots).toHaveLength(8);
    expect(ironShots.every(s => s.paloNombre === "Hierro 7")).toBe(true);
    expect(data.shots.find(s => s.paloId === removed.id)?.paloNombre).toBe("Driver");
    expect(new Set(data.shots.map(s => s.paloId))).toEqual(new Set([iron.id, removed.id, data.clubs.find(c => c.categoria === "Putter")!.id]));
  });

  it("recupera las estadísticas por palo desde los registros originales", async () => {
    const { iron, roundId } = await backupFixture(repo);
    const before = statistics(await repo.snapshot(), "all");
    const backup = await exported();
    await repo.deleteRound(roundId, (await repo.snapshot()).rounds[0].revision);
    expect(statistics(await repo.snapshot(), "all").rounds).toHaveLength(0);
    await repo.restoreBackup(backup);
    const after = statistics(await repo.snapshot(), "all");
    expect(after).toEqual(before);
    expect(after.clubs.find(c => c.id === iron.id)).toMatchObject({ count: 8, index: 100, penalties: 8, inactive: true });
    expect(after.putting.total).toBe(18);
  });

  it("repetir la restauración no duplica registros ni vuelve a sembrar la bolsa", async () => {
    await backupFixture(repo);
    const backup = await exported();
    await repo.restoreBackup(backup);
    await repo.restoreBackup(backup);
    await repo.initialize();
    expect((await exported()).data).toEqual(backup.data);
    expect(await db.clubs.count()).toBe(11);
    expect(await db.shots.count()).toBe(27);
  });

  it.each(["duplicate", "category", "order", "holeReference", "historicalReference"])("rechaza copia inválida (%s) sin tocar los datos existentes", async problem => {
    await backupFixture(repo);
    const backup = await exported();
    const before = await exported();
    if (problem === "duplicate") backup.data.clubs.push({ ...backup.data.clubs[0] });
    if (problem === "category") Object.assign(backup.data.clubs[0], { categoria: "Inventada" });
    if (problem === "order") backup.data.clubs[0].orden = -1;
    if (problem === "holeReference") backup.data.shots[0].hoyoId = "missing-hole";
    if (problem === "historicalReference") backup.data.shots[0].paloId = "missing-club";
    await expect(repo.restoreBackup(backup)).rejects.toThrow("Copia de seguridad no válida");
    expect((await exported()).data).toEqual(before.data);
  });

  it("revierte todas las tablas si falla una escritura después de vaciarlas", async () => {
    await backupFixture(repo);
    const backup = await exported();
    await repo.saveClub({ nombre: "Datos actuales", categoria: "Otro", activo: true });
    const before = await exported();
    vi.spyOn(db.table("shots"), "bulkAdd").mockRejectedValueOnce(new Error("Sin espacio"));
    await expect(repo.restoreBackup(backup)).rejects.toThrow("Sin espacio");
    expect((await exported()).data).toEqual(before.data);
  });

  it.each([0, 31, 127])("rechaza caracteres de control (%i) en nombres sin modificar la bolsa", async code => {
    await repo.initialize();
    const backup = await exported();
    const original = await repo.snapshot();
    backup.data.clubs[0].nombre = `Palo${String.fromCharCode(code)}inválido`;
    await expect(repo.restoreBackup(backup)).rejects.toThrow("caracteres de control");
    expect(await repo.snapshot()).toEqual(original);
  });

  it("publica un snapshot reactivo coherente con bolsa y estadísticas restauradas", async () => {
    await backupFixture(repo);
    const backup = await exported();
    await db.shots.clear();
    await db.clubs.clear();
    const snapshots: Awaited<ReturnType<typeof repo.snapshot>>[] = [];
    const subscription = liveQuery(() => repo.snapshot()).subscribe(data => snapshots.push(data));
    try {
      await vi.waitFor(() => expect(snapshots).toHaveLength(1));
      await repo.restoreBackup(backup);
      await vi.waitFor(() => expect(snapshots.at(-1)?.shots).toHaveLength(27));
      expect(snapshots.slice(1).every(data => data.shots.length === 27 && data.clubs.length === 11)).toBe(true);
      expect(statistics(snapshots.at(-1)!, "all").putting.total).toBe(18);
    } finally { subscription.unsubscribe(); }
  });

  it("restaura una bolsa vacía sin regenerar palos", async () => {
    await repo.initialize();
    await db.clubs.clear();
    const backup = await exported();
    await repo.saveClub({ nombre: "Posterior", categoria: "Otro", activo: true });
    await repo.restoreBackup(backup);
    await repo.initialize();
    expect((await repo.snapshot()).clubs).toEqual([]);
  });
});
