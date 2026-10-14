import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageTitle } from "../components/UI";
import { DataFeedback, WriteFeedback } from "../components/DataFeedback";
import ConfirmDialog from "../components/ConfirmDialog";
import { useGolfData, useWrite } from "../hooks/useGolfData";
import { repository } from "../persistence/repository";
import { downloadBackup, readBackupFile } from "../persistence/backupFile";
import type { Backup } from "../domain/backup";

export default function Backups() {
  const data = useGolfData();
  const write = useWrite();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const unavailable = write.busy || data.loading || !!data.error;
  function exportData() {
    return write.run(async () => downloadBackup(await repository.exportBackup()), "Copia preparada para descargar. Comprueba que el archivo se ha guardado en tu dispositivo.");
  }
  return <>
    <Link className="back" to="/ajustes">← Volver a Ajustes</Link>
    <PageTitle eyebrow="TUS DATOS" title="Datos y copias de seguridad">
      Tus datos se guardan en este navegador. La copia se procesa en tu dispositivo y no se envía a ningún servidor.
    </PageTitle>
    <DataFeedback {...data} />
    {!pending && <WriteFeedback {...write} errorId="backup-error" />}
    <section className="card backup-actions">
      <h2>Una copia completa</h2>
      <p>Guarda todos tus campos, palos, rondas y golpes en un único archivo JSON. La preferencia de filtro de estadísticas pertenece a este navegador y no se incluye.</p>
      <button className="button full" disabled={unavailable || !!pending} onClick={() => void exportData()}>
        <Download size={20} aria-hidden="true" /> Exportar todos mis datos
      </button>
      <label htmlFor="backup-file">Restaurar copia de seguridad</label>
      <input ref={input} id="backup-file" type="file" accept=".json,application/json" aria-describedby={`backup-help${write.error && !pending ? " backup-error" : ""}`} disabled={unavailable || !!pending} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void write.run(async () => setPending(await readBackupFile(file)), "Copia validada. Revisa el resumen antes de restaurar.");
      }} />
      <p id="backup-help" className="field-help">Archivo JSON de hasta 20 MiB. La selección y validación no cambian tus datos.</p>
      <p className="demo-note">Restaurar sustituye todos los datos actuales. No combina registros y no se puede deshacer desde la aplicación.</p>
    </section>
    {pending && <ConfirmDialog
      title="Restaurar copia de seguridad"
      description="Se sustituirán todos los campos, palos, rondas, hoyos, golpes, putts y penalizaciones actuales. Esta acción no se puede deshacer. Puedes exportar una copia de tus datos actuales antes de continuar."
      confirmLabel="Restaurar todo"
      busy={write.busy}
      error={write.error}
      onCancel={() => { setPending(null); input.current?.focus(); }}
      onConfirm={() => void write.run(() => repository.restoreBackup(pending), "Copia restaurada. Todos los datos se han sustituido.").then(ok => {
        if (ok) navigate("/", { replace: true, state: { backupRestored: true } });
      })}
    >
      <dl className="backup-summary">
        <div><dt>Fecha de la copia</dt><dd>{new Date(pending.exportedAt).toLocaleString("es-ES")}</dd></div>
        <div><dt>Campos</dt><dd>{pending.data.courses.length}</dd></div>
        <div><dt>Palos</dt><dd>{pending.data.clubs.length}</dd></div>
        <div><dt>Rondas</dt><dd>{pending.data.rounds.length}</dd></div>
        <div><dt>Golpes</dt><dd>{pending.data.shots.length}</dd></div>
      </dl>
      <button className="choice full" disabled={write.busy} onClick={() => void exportData()}><Download size={18} aria-hidden="true" /> Guardar copia de mis datos actuales</button>
      {write.message && <p role="status" className="feedback">{write.message}</p>}
    </ConfirmDialog>}
  </>;
}
