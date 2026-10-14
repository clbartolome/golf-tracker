import type { GolfDatabase } from "./database";
import {
  canConfirmHole,
  holed,
  validateShot,
  type Round,
  type PlayedHole,
  type Shot,
  type ShotInput,
} from "../domain/rounds";
export function createRoundRepository(db: GolfDatabase) {
  const tables = [db.rounds, db.playedHoles, db.shots, db.clubs];
  async function context(holeId: string, revision: number) {
    const hole = await db.playedHoles.get(holeId);
    if (!hole) throw new Error("El hoyo no existe.");
    const round = await db.rounds.get(hole.rondaId);
    if (!round) throw new Error("La ronda no existe.");
    if (round.revision !== revision)
      throw new Error(
        "La ronda ha cambiado en otra pantalla. Revisa la tarjeta antes de volver a guardar.",
      );
    const shots = await db.shots
      .where("hoyoId")
      .equals(hole.id)
      .sortBy("orden");
    return { hole, round, shots };
  }
  async function reconcile(round: Round) {
    const holes = await db.playedHoles
      .where("rondaId")
      .equals(round.id)
      .sortBy("numero");
    for (const hole of holes) {
      const shots = await db.shots
        .where("hoyoId")
        .equals(hole.id)
        .sortBy("orden");
      hole.estado =
        hole.estado === "completado" && canConfirmHole(shots)
          ? "completado"
          : shots.length
            ? "en curso"
            : "pendiente";
    }
    const first = holes.find((h) => h.estado !== "completado");
    if (first && first.estado === "pendiente") first.estado = "en curso";
    await db.playedHoles.bulkPut(holes);
    const completed = holes.every((h) => h.estado === "completado");
    const updated: Round = { ...round, revision: round.revision + 1 };
    if (!completed) {
      updated.estado = "en curso";
      delete updated.fin;
    }
    await db.rounds.put(updated);
  }
  async function buildShot(
    id: string,
    holeId: string,
    order: number,
    input: ShotInput,
    old?: Shot,
  ): Promise<Shot> {
    validateShot(input);
    const club = await db.clubs.get(input.paloId);
    const unchanged = old?.paloId === input.paloId;
    if (!unchanged && (!club || !club.activo))
      throw new Error("Elige un palo activo de tu bolsa.");
    if (
      input.tipo === "putt" &&
      club?.categoria !== "Putter" &&
      !(unchanged && old?.tipo === "putt")
    )
      throw new Error("Selecciona un palo de categoría Putter para el putt.");
    // Preserve historical name when keeping the original club, even if renamed/deleted.
    const common = {
      id,
      hoyoId: holeId,
      orden: order,
      origen: input.origen,
      paloId: input.paloId,
      paloNombre: unchanged ? old!.paloNombre : club!.nombre,
      penalizacion: input.penalizacion,
    };
    if (input.tipo === "normal")
      return {
        ...common,
        tipo: "normal",
        destino: input.destino,
        diana: input.diana!,
      };
    return {
      ...common,
      tipo: "putt",
      distancia: input.distancia,
      resultado: input.resultado,
      direccion: input.direccion,
      destino: input.resultado === "Embocado" ? "Hoyo" : "Green",
    };
  }
  return {
    async deleteRound(id: string, revision: number) {
      await db.transaction("rw", db.rounds, db.playedHoles, db.shots, async () => {
        const round = await db.rounds.get(id);
        // Repeating a completed deletion is harmless.
        if (!round) return;
        if (round.revision !== revision)
          throw new Error("La ronda ha cambiado. Cancela y revisa sus datos antes de eliminarla.");
        const holeIds = await db.playedHoles.where("rondaId").equals(id).primaryKeys();
        await db.shots.where("hoyoId").anyOf(holeIds).delete();
        await db.playedHoles.where("rondaId").equals(id).delete();
        await db.rounds.delete(id);
      });
    },
    async startRound(id: string, courseId: string, size: 9 | 18) {
      return db.transaction(
        "rw",
        db.rounds,
        db.playedHoles,
        db.courses,
        db.holes,
        async () => {
          if (await db.rounds.get(id)) return id;
          const course = await db.courses.get(courseId);
          if (!course) throw new Error("El campo ya no existe.");
          if (![9, 18].includes(size) || size > course.numeroHoyos)
            throw new Error("El campo no permite ese número de hoyos.");
          const holes = (
            await db.holes.where("campoId").equals(courseId).sortBy("numero")
          ).slice(0, size);
          if (
            holes.length !== size ||
            holes.some(
              (h, i) => h.numero !== i + 1 || ![3, 4, 5, 6].includes(h.par),
            )
          )
            throw new Error("Revisa los pares del campo antes de iniciar.");
          await db.rounds.add({
            id,
            campoId: courseId,
            campoNombre: course.nombre,
            inicio: new Date().toISOString(),
            estado: "en curso",
            numeroHoyos: size,
            revision: 0,
          });
          await db.playedHoles.bulkAdd(
            holes.map(
              (hole, i) =>
                ({
                  id: crypto.randomUUID(),
                  rondaId: id,
                  numero: hole.numero,
                  par: hole.par,
                  estado: i === 0 ? "en curso" : "pendiente",
                }) as PlayedHole,
            ),
          );
          return id;
        },
      );
    },
    async addShot(
      id: string,
      holeId: string,
      input: ShotInput,
      revision: number,
    ) {
      return db.transaction("rw", tables, async () => {
        const existing = await db.shots.get(id);
        if (existing) {
          if (existing.hoyoId !== holeId)
            throw new Error("Identificador de golpe ya utilizado.");
          return existing.id;
        }
        const { hole, round, shots } = await context(holeId, revision);
        const holes = await db.playedHoles
          .where("rondaId")
          .equals(round.id)
          .sortBy("numero");
        if (
          round.estado === "finalizada" ||
          hole.estado === "completado" ||
          holes.find((h) => h.estado !== "completado")?.id !== holeId
        )
          throw new Error(
            "Confirma el hoyo anterior o revisa el resumen antes de registrar.",
          );
        if (holed(shots.at(-1)))
          throw new Error("La bola está embocada. Revisa y confirma el hoyo.");
        await db.shots.add(
          await buildShot(id, holeId, shots.length + 1, input),
        );
        await reconcile(round);
        return id;
      });
    },
    async editShot(id: string, input: ShotInput, revision: number) {
      await db.transaction("rw", tables, async () => {
        const old = await db.shots.get(id);
        if (!old) throw new Error("El golpe ya no existe.");
        const { round } = await context(old.hoyoId, revision);
        await db.shots.put(
          await buildShot(id, old.hoyoId, old.orden, input, old),
        );
        await reconcile(round);
      });
    },
    async deleteShot(id: string, revision: number, undo = false) {
      await db.transaction("rw", tables, async () => {
        const old = await db.shots.get(id);
        if (!old) throw new Error("El golpe ya no existe.");
        const { hole, round, shots } = await context(old.hoyoId, revision);
        const holes = await db.playedHoles
          .where("rondaId")
          .equals(round.id)
          .sortBy("numero");
        if (
          undo &&
          (round.estado !== "en curso" ||
            hole.estado === "completado" ||
            shots.at(-1)?.id !== id ||
            holes.find((h) => h.estado !== "completado")?.id !== hole.id)
        )
          throw new Error(
            "No es seguro deshacer ese registro. Usa la edición de la tarjeta.",
          );
        const remaining = shots
          .filter((s) => s.id !== id)
          .map((shot, i) => ({ ...shot, orden: i + 1 }));
        // Delete and reinsert within one transaction to avoid unique-order collisions.
        await db.shots.where("hoyoId").equals(hole.id).delete();
        if (remaining.length) await db.shots.bulkAdd(remaining);
        await reconcile(round);
      });
    },
    async confirmHole(holeId: string, revision: number) {
      return db.transaction("rw", tables, async () => {
        const { hole, round, shots } = await context(holeId, revision);
        if (hole.estado === "completado") return;
        const holes = await db.playedHoles
          .where("rondaId")
          .equals(round.id)
          .sortBy("numero");
        if (holes.find((h) => h.estado !== "completado")?.id !== holeId)
          throw new Error("Confirma primero los hoyos anteriores.");
        if (!canConfirmHole(shots))
          throw new Error(
            "El último golpe debe estar embocado y no puede haber golpes posteriores a un embocado.",
          );
        await db.playedHoles.update(holeId, { estado: "completado" });
        await reconcile(round);
      });
    },
    async finishRound(id: string, revision: number) {
      await db.transaction("rw", tables, async () => {
        const round = await db.rounds.get(id);
        if (!round) throw new Error("La ronda no existe.");
        if (round.revision !== revision)
          throw new Error("La ronda ha cambiado. Revisa la tarjeta.");
        const holes = await db.playedHoles
          .where("rondaId")
          .equals(id)
          .toArray();
        if (
          holes.length !== round.numeroHoyos ||
          holes.some((h) => h.estado !== "completado")
        )
          throw new Error(
            "Confirma todos los hoyos antes de finalizar la ronda.",
          );
        for (const hole of holes) {
          const shots = await db.shots
            .where("hoyoId")
            .equals(hole.id)
            .sortBy("orden");
          if (!canConfirmHole(shots))
            throw new Error("Hay un hoyo sin embocado válido.");
        }
        if (round.estado === "finalizada") return;
        await db.rounds.put({
          ...round,
          estado: "finalizada",
          fin: new Date().toISOString(),
          revision: round.revision + 1,
        });
      });
    },
  };
}
