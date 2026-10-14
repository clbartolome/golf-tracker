import Dexie from "dexie";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { GolfDatabase } from "./database";
import { createRepository } from "./repository";
import { classifyTarget } from "../domain/target";
import {
  canConfirmHole,
  continuityWarnings,
  holeScore,
  nextOrigin,
  type ShotInput,
} from "../domain/rounds";
let db: GolfDatabase;
let repo: ReturnType<typeof createRepository>;
let courseId: string;
let roundId: string;
let clubId: string;
let putterId: string;
beforeEach(async () => {
  db = new GolfDatabase(`round-test-${crypto.randomUUID()}`);
  repo = createRepository(db);
  await repo.initialize();
  const clubs = (await repo.snapshot()).clubs;
  clubId = clubs[0].id;
  putterId = clubs.find((c) => c.categoria === "Putter")!.id;
  courseId = await repo.saveCourse({
    nombre: "Campo histórico",
    favorito: false,
    pares: Array(18).fill(4),
  });
  roundId = crypto.randomUUID();
  await repo.startRound(roundId, courseId, 9);
});
afterEach(async () => {
  await db.delete();
});
async function state() {
  const data = await repo.snapshot();
  const round = data.rounds.find((r) => r.id === roundId)!;
  const holes = data.playedHoles
    .filter((h) => h.rondaId === roundId)
    .sort((a, b) => a.numero - b.numero);
  const hole = holes.find((h) => h.estado !== "completado") ?? holes.at(-1)!;
  const shots = data.shots
    .filter((s) => s.hoyoId === hole.id)
    .sort((a, b) => a.orden - b.orden);
  return { data, round, holes, hole, shots };
}
function normal(
  overrides: Partial<Extract<ShotInput, { tipo: "normal" }>> = {},
): ShotInput {
  return {
    tipo: "normal",
    origen: "Tee",
    paloId: clubId,
    destino: "Calle",
    penalizacion: 0,
    diana: classifyTarget(0, 0),
    ...overrides,
  };
}
function putt(
  result: Extract<ShotInput, { tipo: "putt" }>["resultado"] = "Embocado",
  penalty: 0 | 1 | 2 = 0,
): ShotInput {
  return {
    tipo: "putt",
    origen: "Green",
    paloId: putterId,
    penalizacion: penalty,
    distancia: "Medio",
    resultado: result,
    direccion: result === "Embocado" ? null : "Centro",
  };
}
async function add(input: ShotInput = normal()) {
  const s = await state();
  const id = crypto.randomUUID();
  await repo.addShot(id, s.hole.id, input, s.round.revision);
  return id;
}
describe("Motor persistente de rondas", () => {
  it("copia nombre, número y pares históricos y conserva campos al migrar de v1", async () => {
    const s = await state();
    expect(s.holes).toHaveLength(9);
    expect(s.holes.map((h) => h.estado)).toEqual([
      "en curso",
      ...Array(8).fill("pendiente"),
    ]);
    await repo.saveCourse({
      id: courseId,
      nombre: "Renombrado",
      favorito: true,
      pares: Array(9).fill(6),
    });
    await repo.deleteCourse(courseId);
    expect((await state()).round.campoNombre).toBe("Campo histórico");
    expect((await state()).holes.map((h) => h.par)).toEqual(Array(9).fill(4));
    const name = `migration-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old
      .version(1)
      .stores({
        courses: "id, nombre",
        holes: "id, campoId, &[campoId+numero]",
        clubs: "id, orden",
        metadata: "key",
      });
    await old
      .table("courses")
      .add({
        id: "old",
        nombre: "Conservado",
        numeroHoyos: 9,
        favorito: true,
        creado: "fecha",
        modificado: "fecha",
      });
    old.close();
    const upgraded = new GolfDatabase(name);
    expect(
      (await createRepository(upgraded).snapshot()).courses[0].nombre,
    ).toBe("Conservado");
    expect(upgraded.verno).toBe(3);
    await upgraded.delete();
  });
  it("migra putts v2 sin inventar su dirección ni cambiar resultados", async () => {
    const name = `legacy-putts-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(2).stores({ shots: "id, hoyoId, &[hoyoId+orden]" });
    await old.table("shots").bulkAdd([
      { id: "miss", hoyoId: "hole", orden: 1, tipo: "putt", distancia: "Largo", resultado: "Corto", destino: "Green" },
      { id: "holed", hoyoId: "hole", orden: 2, tipo: "putt", distancia: "Corto", resultado: "Embocado", destino: "Hoyo" },
    ]);
    old.close();
    const upgraded = new GolfDatabase(name);
    try {
      expect(await upgraded.shots.get("miss")).toMatchObject({ distancia: "Largo", resultado: "Corto", destino: "Green", direccion: null });
      expect(await upgraded.shots.get("holed")).toMatchObject({ resultado: "Embocado", destino: "Hoyo", direccion: null });
    } finally {
      await upgraded.delete();
    }
  });
  it.each(["Corto", "Medio", "Largo"] as const)("conserva distancia inicial %s", async (distancia) => {
    await add({ ...putt("Muy largo"), distancia } as ShotInput);
    db.close();
    await db.open();
    expect((await state()).shots[0]).toMatchObject({ distancia, resultado: "Muy largo", direccion: "Centro" });
  });
  it("admite 18 solo si el campo permite y previene duplicar el inicio", async () => {
    const id = crypto.randomUUID();
    await Promise.all([
      repo.startRound(id, courseId, 18),
      repo.startRound(id, courseId, 18),
    ]);
    expect(
      (await repo.snapshot()).rounds.filter((r) => r.id === id),
    ).toHaveLength(1);
    expect(
      (await repo.snapshot()).playedHoles.filter((h) => h.rondaId === id),
    ).toHaveLength(18);
    await repo.saveCourse({
      id: courseId,
      nombre: "9",
      favorito: false,
      pares: Array(9).fill(4),
    });
    await expect(
      repo.startRound(crypto.randomUUID(), courseId, 18),
    ).rejects.toThrow();
  });
  it.each([0, 1, 2] as const)(
    "un golpe normal con penalización %i cuenta 1 + penalización",
    async (penalty) => {
      await add(normal({ penalizacion: penalty }));
      const s = await state();
      expect(holeScore(s.shots)).toEqual({
        physical: 1,
        penalties: penalty,
        total: 1 + penalty,
      });
      expect(s.shots[0].tipo).toBe("normal");
      expect(nextOrigin(s.shots)).toBe("Calle");
    },
  );
  it("rechaza diana sin selección, puntos incoherentes, origen vacío y palos inactivos", async () => {
    await expect(add(normal({ diana: null }))).rejects.toThrow(/diana/);
    await expect(
      add(
        normal({
          diana: {
            horizontal: "Muy izquierda",
            vertical: "Muy corto",
            point: { x: 0, y: 0 },
          },
        }),
      ),
    ).rejects.toThrow(/no coinciden/);
    await expect(add(normal({ origen: "" as never }))).rejects.toThrow(
      /origen/,
    );
    const club = (await state()).data.clubs[0];
    await repo.toggleClub(club);
    await expect(add()).rejects.toThrow(/activo/);
    expect((await state()).shots).toHaveLength(0);
  });
  it.each(["Calle", "Rough", "Bunker", "Green", "Tee", "Otro"] as const)(
    "propone %s como siguiente origen",
    async (destination) => {
      await add(normal({ destino: destination }));
      expect(nextOrigin((await state()).shots)).toBe(destination);
    },
  );
  it.each(["Agua", "Fuera"] as const)(
    "%s no asigna origen ni penalización automática",
    async (destination) => {
      await add(normal({ destino: destination }));
      const s = await state();
      expect(nextOrigin(s.shots)).toBe("");
      expect(s.shots[0].penalizacion).toBe(0);
      await add(normal({ origen: "Rough", destino: "Green" }));
      expect((await state()).shots).toHaveLength(2);
    },
  );
  it("cuenta golpe al aire sin cambiar origen/destino", async () => {
    await add(normal({ destino: "Tee" }));
    const s = await state();
    expect(nextOrigin(s.shots)).toBe("Tee");
    expect(holeScore(s.shots).total).toBe(1);
  });
  it.each(["Muy corto", "Corto", "Red zone", "Largo", "Muy largo", "Embocado"] as const)(
    "registra putt %s con un único golpe físico y sin diana",
    async (result) => {
      await add(normal({ destino: "Green" }));
      await add(putt(result, 2));
      const s = await state();
      expect(s.shots[1]).not.toHaveProperty("diana");
      expect(s.shots[1].destino).toBe(result === "Embocado" ? "Hoyo" : "Green");
      expect(holeScore(s.shots)).toEqual({
        physical: 2,
        penalties: 2,
        total: 4,
      });
      expect(canConfirmHole(s.shots)).toBe(result === "Embocado");
    },
  );
  it.each(["Izquierda", "Centro", "Derecha"] as const)("persiste dirección %s y red zone tras reabrir la base", async (direccion) => {
    await add(normal({ destino: "Green" }));
    const input = { ...putt("Red zone"), direccion } as ShotInput;
    await add(input);
    db.close();
    await db.open();
    const s = await state();
    expect(s.shots[1]).toMatchObject({ distancia: "Medio", resultado: "Red zone", direccion, destino: "Green" });
    expect(s.hole.estado).toBe("en curso");
    expect(canConfirmHole(s.shots)).toBe(false);
    await expect(repo.confirmHole(s.hole.id, s.round.revision)).rejects.toThrow();
    await add(putt());
    expect(holeScore((await state()).shots).physical).toBe(3);
  });
  it("rechaza putts sin dirección salvo embocado", async () => {
    await expect(add({ ...putt("Red zone"), direccion: null } as ShotInput)).rejects.toThrow(/dirección/);
    await add(putt());
    expect((await state()).shots[0]).toMatchObject({ resultado: "Embocado", direccion: null });
  });
  it("admite putter normal fuera del green y corrección de origen tras putt", async () => {
    await add(normal({ paloId: putterId, destino: "Green" }));
    await add(putt("Largo"));
    await add(normal({ origen: "Rough", destino: "Green" }));
    expect(continuityWarnings((await state()).shots)).toHaveLength(1);
  });
  it("embocar exige confirmación y solo entonces activa el siguiente hoyo", async () => {
    let s = await state();
    await expect(repo.confirmHole(s.hole.id, s.round.revision)).rejects.toThrow(
      /embocado/,
    );
    await add(normal({ destino: "Hoyo" }));
    s = await state();
    expect(s.hole.estado).toBe("en curso");
    await expect(add()).rejects.toThrow(/embocada/);
    await repo.confirmHole(s.hole.id, s.round.revision);
    const next = await state();
    expect(next.hole.numero).toBe(2);
    expect(next.holes[0].estado).toBe("completado");
  });
  it("edita sin duplicar IDs, conserva nombre histórico y avisa continuidad sin alterar posteriores", async () => {
    const first = await add(normal({ destino: "Calle" }));
    await add(normal({ origen: "Calle", destino: "Hoyo" }));
    let s = await state();
    const original = s.shots[0];
    await repo.saveClub({
      id: clubId,
      nombre: "Renombrado",
      categoria: "Driver",
      activo: false,
    });
    await repo.editShot(
      first,
      normal({ destino: "Rough", penalizacion: 1 }),
      s.round.revision,
    );
    s = await state();
    expect(s.shots).toHaveLength(2);
    expect(s.shots[0].id).toBe(original.id);
    expect(s.shots[0].paloNombre).toBe("Driver");
    expect(s.shots[1].origen).toBe("Calle");
    expect(continuityWarnings(s.shots)).toHaveLength(1);
    expect(holeScore(s.shots).total).toBe(3);
  });
  it("elimina, renumera conservando IDs y reabre hoyo si pierde embocado", async () => {
    const first = await add();
    const second = await add(normal({ origen: "Calle", destino: "Green" }));
    const third = await add(putt());
    let s = await state();
    await repo.deleteShot(first, s.round.revision);
    s = await state();
    expect(s.shots.map((shot) => [shot.id, shot.orden])).toEqual([
      [second, 1],
      [third, 2],
    ]);
    await repo.confirmHole(s.hole.id, s.round.revision);
    s = await state();
    await repo.deleteShot(third, s.round.revision);
    s = await state();
    expect(s.holes[0].estado).toBe("en curso");
    expect(s.hole.numero).toBe(1);
    expect(s.round.estado).toBe("en curso");
  });
  it("finaliza explícitamente y una edición que pierde embocado reabre ronda finalizada", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 9; i++) {
      ids.push(await add(normal({ destino: "Hoyo" })));
      const s = await state();
      await repo.confirmHole(s.hole.id, s.round.revision);
    }
    let s = await state();
    expect(s.round.estado).toBe("en curso");
    await repo.finishRound(roundId, s.round.revision);
    s = await state();
    expect(s.round.estado).toBe("finalizada");
    expect(s.round.fin).toBeDefined();
    await repo.editShot(ids[0], normal({ destino: "Calle" }), s.round.revision);
    s = await state();
    expect(s.hole.numero).toBe(1);
    expect(s.round.estado).toBe("en curso");
    expect(s.round.fin).toBeUndefined();
    expect(s.holes.slice(1).every((h) => h.estado === "completado")).toBe(true);
  });
  it("no finaliza con hoyos pendientes y detecta golpes después de embocar", async () => {
    const first = await add();
    await add(normal({ origen: "Calle", destino: "Hoyo" }));
    let s = await state();
    await expect(repo.finishRound(roundId, s.round.revision)).rejects.toThrow(
      /todos/,
    );
    await repo.editShot(first, normal({ destino: "Hoyo" }), s.round.revision);
    s = await state();
    expect(canConfirmHole(s.shots)).toBe(false);
    expect(continuityWarnings(s.shots)[0]).toMatch(/después de embocar/);
    await expect(
      repo.confirmHole(s.hole.id, s.round.revision),
    ).rejects.toThrow();
  });
  it("previene doble registro por el mismo ID y escrituras de pantallas desactualizadas", async () => {
    const s = await state();
    const id = crypto.randomUUID();
    await Promise.all([
      repo.addShot(id, s.hole.id, normal(), s.round.revision),
      repo.addShot(id, s.hole.id, normal(), s.round.revision),
    ]);
    expect((await state()).shots).toHaveLength(1);
    await expect(
      repo.addShot(crypto.randomUUID(), s.hole.id, normal(), s.round.revision),
    ).rejects.toThrow(/otra pantalla/);
  });
  it("deshace solo el último registro de un hoyo no confirmado", async () => {
    const first = await add();
    const last = await add(normal({ origen: "Calle", destino: "Green" }));
    let s = await state();
    await expect(
      repo.deleteShot(first, s.round.revision, true),
    ).rejects.toThrow(/seguro/);
    await repo.deleteShot(last, s.round.revision, true);
    s = await state();
    expect(s.shots.map((shot) => shot.id)).toEqual([first]);
    const terminal = await add(normal({ origen: "Calle", destino: "Hoyo" }));
    s = await state();
    await repo.confirmHole(s.hole.id, s.round.revision);
    s = await state();
    await expect(
      repo.deleteShot(terminal, s.round.revision, true),
    ).rejects.toThrow(/seguro/);
  });
  it("recupera ronda y golpes tras abrir otra conexión", async () => {
    await add(normal({ penalizacion: 2 }));
    const before = await repo.snapshot();
    db.close();
    const reopened = new GolfDatabase(db.name);
    const reloaded = await createRepository(reopened).snapshot();
    expect(reloaded).toEqual(before);
    expect(reloaded.rounds[0].estado).toBe("en curso");
    reopened.close();
  });
  it("revierte golpe y revisión si falla el guardado de estados", async () => {
    const s = await state();
    const spy = vi
      .spyOn(db.playedHoles, "bulkPut")
      .mockRejectedValueOnce(new Error("Sin espacio"));
    await expect(add()).rejects.toThrow("Sin espacio");
    spy.mockRestore();
    expect((await state()).shots).toHaveLength(0);
    expect((await state()).round.revision).toBe(s.round.revision);
  });
});

describe("Eliminación atómica de rondas", () => {
  it.each([false, true])("elimina dependencias, conserva bolsa/campo y otras rondas (finalizada: %s)", async (finished) => {
    await add(normal({ destino: "Green", penalizacion: 2 }));
    await add(putt());
    if (finished) {
      let s = await state();
      await repo.confirmHole(s.hole.id, s.round.revision);
      for (let i = 1; i < 9; i++) {
        await add(normal({ destino: "Hoyo" }));
        s = await state();
        await repo.confirmHole(s.hole.id, s.round.revision);
      }
      await repo.finishRound(roundId, (await state()).round.revision);
    }
    const other = crypto.randomUUID();
    await repo.startRound(other, courseId, 9);
    const before = await repo.snapshot();
    const retained = before.playedHoles.filter(h => h.rondaId === other);
    const revision = before.rounds.find(r => r.id === roundId)!.revision;
    await Promise.all([repo.deleteRound(roundId, revision), repo.deleteRound(roundId, revision)]);
    db.close(); await db.open();
    const after = await repo.snapshot();
    expect(after.rounds.map(r => r.id)).toEqual([other]);
    expect(after.playedHoles).toEqual(retained);
    expect(after.shots).toEqual([]);
    expect(after.courses).toEqual(before.courses);
    expect(after.clubs).toEqual(before.clubs);
  });
  it("revierte todos los borrados si falla IndexedDB y rechaza revisiones antiguas", async () => {
    await add(normal({ destino: "Green" })); await add(putt());
    const before = await repo.snapshot();
    await expect(repo.deleteRound(roundId, 0)).rejects.toThrow(/ha cambiado/);
    const spy = vi.spyOn(db.rounds, "delete").mockRejectedValueOnce(new Error("Fallo de IndexedDB"));
    await expect(repo.deleteRound(roundId, before.rounds[0].revision)).rejects.toThrow("Fallo de IndexedDB");
    spy.mockRestore();
    expect(await repo.snapshot()).toEqual(before);
  });
});
