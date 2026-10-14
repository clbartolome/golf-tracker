import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageTitle } from "../components/UI";
import { DataFeedback, WriteFeedback } from "../components/DataFeedback";
import ConfirmDialog from "../components/ConfirmDialog";
import { useGolfData, useWrite } from "../hooks/useGolfData";
import { repository } from "../persistence/repository";
import { categories, type Category, type Club } from "../domain/models";
function ClubEditor({
  club,
  onClose,
}: {
  club?: Club;
  onClose: (saved?: boolean) => void;
}) {
  const [name, setName] = useState(club?.nombre ?? "");
  const [category, setCategory] = useState<Category>(club?.categoria ?? "Otro");
  const [active, setActive] = useState(club?.activo ?? true);
  const write = useWrite();
  const errorId = useId();
  return (
    <section className="card form-card">
      <h2>{club ? "Editar palo" : "Crear palo"}</h2>
      <form
        aria-describedby={write.error ? errorId : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await write.run(() =>
              repository.saveClub({
                id: club?.id,
                nombre: name,
                categoria: category,
                activo: active,
              }),
            )
          )
            onClose(true);
        }}
      >
        <fieldset disabled={write.busy}>
          <label htmlFor="club-name">Nombre del palo</label>
          <input
            id="club-name"
            aria-describedby={write.error ? errorId : undefined}
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <label htmlFor="club-category">Categoría</label>
          <select
            id="club-category"
            aria-describedby={write.error ? errorId : undefined}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Palo activo
          </label>
          <div className="actions">
            <button className="button" type="submit">
              Guardar palo
            </button>
            <button type="button" className="choice" onClick={() => onClose()}>
              Cancelar edición
            </button>
          </div>
        </fieldset>
        <WriteFeedback {...write} errorId={errorId} />
      </form>
    </section>
  );
}
export default function Clubs() {
  const data = useGolfData();
  const write = useWrite();
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<Club | "new" | null>(null);
  const [deleting, setDeleting] = useState<Club | null>(null);
  return (
    <>
      <Link className="back" to="/ajustes">
        ← Volver a Ajustes
      </Link>
      <PageTitle eyebrow="A TU MEDIDA" title="Mi bolsa de palos">
        La primera vez proponemos una bolsa de 11 palos. Puedes personalizarla
        por completo.
      </PageTitle>
      <DataFeedback {...data} />
      <WriteFeedback {...write} />
      {saved && (
        <p role="status" className="feedback">
          Cambios guardados en este navegador.
        </p>
      )}
      {editing ? (
        <ClubEditor
          key={editing === "new" ? "new" : editing.id}
          club={editing === "new" ? undefined : editing}
          onClose={(saved) => {
            setSaved(!!saved);
            setEditing(null);
          }}
        />
      ) : (
        <>
          <button
            className="button"
            disabled={data.loading || !!data.error || write.busy}
            onClick={() => {
              setSaved(false);
              setEditing("new");
            }}
          >
            Crear palo
          </button>
          <p className="field-help">
            {data.clubs.filter((c) => c.activo).length} palos activos. Usa subir
            y bajar para cambiar el orden.
          </p>
          {!data.loading && !data.error && data.clubs.length === 0 && (
            <section className="empty card">
              <h2>Tu bolsa está vacía</h2>
              <p>
                Añade los palos que prefieras. No volveremos a crear la bolsa
                inicial.
              </p>
            </section>
          )}
          <ol className="management-list club-list">
            {data.clubs.map((club, index) => (
              <li className="card" key={club.id}>
                <h2>{club.nombre}</h2>
                <p>
                  {club.categoria} · {club.activo ? "Activo" : "Inactivo"}
                </p>
                <div className="actions">
                  <button
                    className="choice"
                    aria-label={`Activo: ${club.nombre}`}
                    aria-pressed={club.activo}
                    disabled={write.busy}
                    onClick={() =>
                      void write.run(() => repository.toggleClub(club))
                    }
                  >
                    {club.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    className="choice"
                    disabled={write.busy || index === 0}
                    aria-label={`Subir ${club.nombre}`}
                    onClick={() =>
                      void write.run(() => repository.moveClub(club.id, -1))
                    }
                  >
                    ↑ Subir
                  </button>
                  <button
                    className="choice"
                    disabled={write.busy || index === data.clubs.length - 1}
                    aria-label={`Bajar ${club.nombre}`}
                    onClick={() =>
                      void write.run(() => repository.moveClub(club.id, 1))
                    }
                  >
                    ↓ Bajar
                  </button>
                  <button
                    className="choice"
                    disabled={write.busy}
                    onClick={() => {
                      setSaved(false);
                      setEditing(club);
                    }}
                  >
                    Editar {club.nombre}
                  </button>
                  <button
                    className="choice icon-button danger-text"
                    aria-label={`Eliminar ${club.nombre}`}
                    disabled={write.busy}
                    onClick={() => setDeleting(club)}
                  >
                    <Trash2 size={20} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar palo"
          description={`Se eliminará «${deleting.nombre}». Esta acción no se puede deshacer.`}
          busy={write.busy}
          error={write.error}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            void write
              .run(() => repository.deleteClub(deleting.id), "Palo eliminado.")
              .then((ok) => {
                if (ok) setDeleting(null);
              })
          }
        />
      )}
    </>
  );
}
