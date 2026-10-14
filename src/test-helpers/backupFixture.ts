import type { createRepository } from "../persistence/repository";
import { targetFromCategories } from "../domain/target";

/** Isolated test records only; never initialize the user's database with these. */
export async function backupFixture(repo: ReturnType<typeof createRepository>) {
  await repo.initialize();
  await repo.saveClub({ nombre: "Wedge personalizado 60°", categoria: "Wedge", activo: false });
  const courseId = await repo.saveCourse({ nombre: "Campo de prueba", favorito: true, pares: Array(9).fill(4) });
  const roundId = await repo.startRound(crypto.randomUUID(), courseId, 9);
  const initial = await repo.snapshot();
  const iron = initial.clubs.find(c => c.nombre === "Hierro 7")!;
  const removed = initial.clubs.find(c => c.categoria === "Driver")!;
  const putter = initial.clubs.find(c => c.categoria === "Putter")!;
  const holes = initial.playedHoles.filter(h => h.rondaId === roundId).sort((a, b) => a.numero - b.numero);
  async function revision() { return (await repo.snapshot()).rounds.find(r => r.id === roundId)!.revision; }
  for (const hole of holes) {
    await repo.addShot(crypto.randomUUID(), hole.id, {
      tipo: "normal", origen: "Tee", paloId: hole.numero === 9 ? removed.id : iron.id,
      destino: "Green", penalizacion: 1, diana: targetFromCategories("Centro", "Distancia correcta"),
    }, await revision());
    await repo.addShot(crypto.randomUUID(), hole.id, {
      tipo: "putt", origen: "Green", paloId: putter.id, penalizacion: 0,
      distancia: "Medio", resultado: "Red zone", direccion: "Izquierda",
    }, await revision());
    await repo.addShot(crypto.randomUUID(), hole.id, {
      tipo: "putt", origen: "Green", paloId: putter.id, penalizacion: 0,
      distancia: "Corto", resultado: "Embocado", direccion: null,
    }, await revision());
    await repo.confirmHole(hole.id, await revision());
  }
  await repo.finishRound(roundId, await revision());
  await repo.saveClub({ ...iron, nombre: "Mi hierro renovado", categoria: "Otro", activo: false });
  await repo.moveClub(iron.id, -1);
  await repo.deleteClub(removed.id);
  return { iron, removed, putter, roundId };
}
