import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageTitle, Choices } from "../components/UI";
import { DataFeedback, WriteFeedback } from "../components/DataFeedback";
import ConfirmDialog from "../components/ConfirmDialog";
import { useGolfData, useWrite } from "../hooks/useGolfData";
import { repository } from "../persistence/repository";
import { resizePars, totalPar, type CourseWithHoles } from "../domain/models";
function CourseEditor({
  course,
  onClose,
}: {
  course?: CourseWithHoles;
  onClose: (saved?: boolean) => void;
}) {
  const [name, setName] = useState(course?.nombre ?? "");
  const [favorite, setFavorite] = useState(course?.favorito ?? false);
  const [pars, setPars] = useState(
    course?.hoyos.map((h) => h.par) ?? Array<number>(9).fill(4),
  );
  const [reducing, setReducing] = useState(false);
  const write = useWrite();
  const errorId = useId();
  return (
    <section className="card form-card">
      <h2>{course ? "Editar campo" : "Crear campo"}</h2>
      <form
        aria-describedby={write.error ? errorId : undefined}
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await write.run(() =>
              repository.saveCourse({
                id: course?.id,
                nombre: name,
                favorito: favorite,
                pares: pars,
              }),
            )
          )
            onClose(true);
        }}
      >
        <fieldset disabled={write.busy}>
          <label htmlFor="course-name">Nombre del campo</label>
          <input
            id="course-name"
            aria-describedby={write.error ? errorId : undefined}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            autoFocus
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
            />
            Campo favorito
          </label>
          <Choices
            label="Número de hoyos"
            options={["9", "18"]}
            value={String(pars.length)}
            onChange={(value) => {
              const size = Number(value) as 9 | 18;
              if (size === 9 && pars.length === 18) setReducing(true);
              else setPars(resizePars(pars, size));
            }}
          />
          <p className="field-help">
            Par 4 inicial para los nuevos hoyos; puedes cambiar cada uno entre 3
            y 6.
          </p>
          <div className="par-editor">
            {pars.map((par, i) => (
              <label key={i} htmlFor={`par-${i}`}>
                Hoyo {i + 1}
                <select
                  id={`par-${i}`}
                  value={par}
                  onChange={(e) =>
                    setPars((current) =>
                      current.map((value, index) =>
                        index === i ? Number(e.target.value) : value,
                      ),
                    )
                  }
                >
                  {[3, 4, 5, 6].map((value) => (
                    <option key={value} value={value}>
                      Par {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="total-par">
            Par total: <strong>{totalPar(pars.map((par) => ({ par })))}</strong>
          </p>
          <div className="actions">
            <button className="button" type="submit">
              Guardar campo
            </button>
            <button type="button" className="choice" onClick={() => onClose()}>
              Cancelar edición
            </button>
          </div>
        </fieldset>
        <WriteFeedback {...write} errorId={errorId} />
      </form>
      {reducing && (
        <ConfirmDialog
          title="Reducir a 9 hoyos"
          description="Se eliminará la configuración de los hoyos 10–18 al guardar. Si cancelas, se conservarán los 18 hoyos y todos los cambios del formulario."
          onCancel={() => setReducing(false)}
          onConfirm={() => {
            setPars(resizePars(pars, 9));
            setReducing(false);
          }}
        />
      )}
    </section>
  );
}
export default function Courses() {
  const data = useGolfData();
  const write = useWrite();
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<CourseWithHoles | "new" | null>(null);
  const [deleting, setDeleting] = useState<CourseWithHoles | null>(null);
  return (
    <>
      <Link className="back" to="/ajustes">
        ← Volver a Ajustes
      </Link>
      <PageTitle eyebrow="TUS RECORRIDOS" title="Mis campos">
        Configura campos y pares. Se guardan únicamente en este navegador.
      </PageTitle>
      <DataFeedback {...data} />
      <WriteFeedback {...write} />
      {saved && (
        <p role="status" className="feedback">
          Cambios guardados en este navegador.
        </p>
      )}
      {editing ? (
        <CourseEditor
          key={editing === "new" ? "new" : editing.id}
          course={editing === "new" ? undefined : editing}
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
            Crear campo
          </button>
          {!data.loading && !data.error && data.courses.length === 0 && (
            <section className="empty card">
              <h2>Aún no tienes campos</h2>
              <p>
                Crea tu primer campo con 9 o 18 hoyos y configura sus pares.
              </p>
            </section>
          )}
          <div className="management-list">
            {data.courses.map((course) => (
              <section className="card" key={course.id}>
                <div className="section-heading">
                  <h2>{course.nombre}</h2>
                  <button
                    className="choice"
                    aria-label={`Favorito: ${course.nombre}`}
                    aria-pressed={course.favorito}
                    disabled={write.busy}
                    onClick={() =>
                      void write.run(() =>
                        repository.favorite(course.id, !course.favorito),
                      )
                    }
                  >
                    {course.favorito ? "★ Favorito" : "☆ Favorito"}
                  </button>
                </div>
                <p>
                  {course.numeroHoyos} hoyos · Par {totalPar(course.hoyos)}
                </p>
                <div className="actions">
                  <button
                    className="choice"
                    disabled={write.busy}
                    onClick={() => {
                      setSaved(false);
                      setEditing(course);
                    }}
                  >
                    Editar {course.nombre}
                  </button>
                  <button
                    className="choice icon-button danger-text"
                    aria-label={`Eliminar ${course.nombre}`}
                    disabled={write.busy}
                    onClick={() => setDeleting(course)}
                  >
                    <Trash2 size={20} aria-hidden="true" />
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar campo"
          description={`Se eliminará «${deleting.nombre}» y la configuración de todos sus hoyos. Esta acción no se puede deshacer.`}
          busy={write.busy}
          error={write.error}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            void write
              .run(
                () => repository.deleteCourse(deleting.id),
                "Campo eliminado.",
              )
              .then((ok) => {
                if (ok) setDeleting(null);
              })
          }
        />
      )}
    </>
  );
}
