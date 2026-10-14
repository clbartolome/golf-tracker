import { maxBackupBytes, parseBackup, type Backup } from "../domain/backup";

export async function readBackupFile(file: File) {
  if (file.size > maxBackupBytes) throw new Error("La copia supera el límite de 20 MiB. Selecciona un archivo más pequeño.");
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo. Vuelve a seleccionarlo."));
    reader.onabort = () => reject(new Error("La lectura de la copia se ha cancelado."));
    reader.readAsText(file);
  });
  return parseBackup(text);
}
export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `golf-tracker-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    // Leave time for Safari to start consuming the Blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
