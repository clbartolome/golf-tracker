import Dexie, { type Table } from "dexie";
import type { Course, Hole, Club } from "../domain/models";
import type { Round, PlayedHole, Shot } from "../domain/rounds";
export class GolfDatabase extends Dexie {
  courses!: Table<Course, string>;
  holes!: Table<Hole, string>;
  clubs!: Table<Club, string>;
  metadata!: Table<{ key: string; value: boolean }, string>;
  rounds!: Table<Round, string>;
  playedHoles!: Table<PlayedHole, string>;
  shots!: Table<Shot, string>;
  constructor(name = "golf-tracker") {
    super(name);
    this.version(1).stores({
      courses: "id, nombre",
      holes: "id, campoId, &[campoId+numero]",
      clubs: "id, orden",
      metadata: "key",
    });
    this.version(2).stores({
      rounds: "id, inicio, estado",
      playedHoles: "id, rondaId, &[rondaId+numero]",
      shots: "id, hoyoId, &[hoyoId+orden]",
    });
    this.version(3).stores({
      shots: "id, hoyoId, &[hoyoId+orden]",
    }).upgrade((transaction) => transaction.table("shots").toCollection().modify((shot) => {
      // Legacy putts did not record direction; preserve unknown rather than invent data.
      if (shot.tipo === "putt" && shot.direccion === undefined) shot.direccion = null;
    }));
  }
}
