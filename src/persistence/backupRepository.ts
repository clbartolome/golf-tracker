import { createBackup, parseBackup, validateBackup, maxBackupBytes, type BackupData } from "../domain/backup";
import type { GolfDatabase } from "./database";

const tableNames = ["courses", "holes", "clubs", "metadata", "rounds", "playedHoles", "shots"] as const;
const restoring = new Set<string>();
export function createBackupRepository(db: GolfDatabase) {
  function tables() {
    if (db.tables.length !== tableNames.length || db.tables.some(table => !tableNames.includes(table.name as typeof tableNames[number])))
      throw new Error("El esquema de datos requiere una versión de copia de seguridad más reciente.");
    return tableNames.map(name => db.table(name));
  }
  return {
    async exportBackup() {
      const data = await db.transaction("r", tables(), async () => {
        const entries = await Promise.all(tableNames.map(async name => [name, await db.table(name).toArray()]));
        return Object.fromEntries(entries) as BackupData;
      });
      const backup = createBackup(data);
      if (new Blob([JSON.stringify(backup)]).size > maxBackupBytes)
        throw new Error("Los datos superan el límite de copia de seguridad de 20 MiB.");
      return backup;
    },
    async restoreBackup(input: unknown) {
      // Detach the validated payload before starting any destructive transaction.
      const backup = parseBackup(JSON.stringify(validateBackup(input)));
      if (restoring.has(db.name)) throw new Error("Ya hay una restauración en curso. Espera a que termine.");
      restoring.add(db.name);
      const restore = async () => {
        await db.transaction("rw", tables(), async () => {
          for (const name of tableNames) await db.table(name).clear();
          for (const name of tableNames) await db.table(name).bulkAdd(backup.data[name]);
          // An entirely empty, never-initialized export must stay empty after mounting the app.
          if (!backup.data.metadata.length) await db.metadata.add({ key: "initial-bag-v1", value: true });
        });
      };
      try {
        if (typeof navigator !== "undefined" && navigator.locks) {
          await navigator.locks.request(`golf-tracker-restore:${db.name}`, { ifAvailable: true }, async lock => {
            if (!lock) throw new Error("Hay una restauración abierta en otra pestaña. Espera a que termine.");
            await restore();
          });
        } else await restore(); // IndexedDB serializes overlapping transactions in older browsers.
      } finally { restoring.delete(db.name); }
    },
  };
}
