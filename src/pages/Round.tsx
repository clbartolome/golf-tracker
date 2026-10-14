import DeleteRoundButton from "../components/DeleteRoundButton";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Choices, PageTitle } from "../components/UI";
import { DataFeedback, WriteFeedback } from "../components/DataFeedback";
import ConfirmDialog from "../components/ConfirmDialog";
import LiveRoundNav from "../components/LiveRoundNav";
import RoundIndicators from "../components/RoundIndicators";
import ShotForm from "../components/ShotForm";
import { useGolfData, useWrite } from "../hooks/useGolfData";
import { useRound } from "../hooks/useRound";
import { repository } from "../persistence/repository";
import { totalPar } from "../domain/models";
import {
  canConfirmHole,
  continuityWarnings,
  holeScore,
  holed,
  roundUrl,
  type Shot,
} from "../domain/rounds";
import { targetLabel } from "../domain/target";
export function NewRound() {
  const data = useGolfData();
  const write = useWrite();
  const navigate = useNavigate();
  const id = useRef(crypto.randomUUID());
  const [selected, setSelected] = useState("");
  const [size, setSize] = useState<9 | 18>(9);
  const course = data.courses.find((c) => c.id === selected) ?? data.courses[0];
  const count = course?.numeroHoyos === 9 ? 9 : size;
  const holes = course?.hoyos.slice(0, count) ?? [];
  return (
    <>
      <Link className="back" to="/">
        <span aria-hidden="true">←</span> Volver al inicio
      </Link>
      <PageTitle eyebrow="PREPARA TU SALIDA" title="Nueva ronda">
        Elige tu campo y revisa los pares. Se copiarán a la ronda para conservar
        su historia.
      </PageTitle>
      <DataFeedback {...data} />
      <WriteFeedback {...write} />
      {!data.loading && !data.error && (
        <section className="card form-card">
          {course ? (
            <>
              <fieldset disabled={write.busy}>
                <label htmlFor="course">Campo</label>
                <select
                  id="course"
                  value={course.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.favorito ? "★ " : ""}
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <Choices
                  label="Hoyos previstos"
                  options={course.numeroHoyos === 18 ? ["9", "18"] : ["9"]}
                  value={String(count)}
                  onChange={(value) => setSize(Number(value) as 9 | 18)}
                />
                <p>
                  {count} hoyos · Par total {totalPar(holes)}
                </p>
                <h2>Pares configurados</h2>
                <div className="pars">
                  {holes.map((h) => (
                    <div key={h.id}>
                      <span>Hoyo {h.numero}</span>
                      <strong>{h.par}</strong>
                      <small>PAR</small>
                    </div>
                  ))}
                </div>
                <button
                  className="button full"
                  onClick={() =>
                    void write
                      .run(
                        () =>
                          repository.startRound(id.current, course.id, count),
                        "Ronda iniciada.",
                      )
                      .then((ok) => {
                        if (ok) navigate(roundUrl("golpe", id.current));
                      })
                  }
                >
                  Iniciar ronda
                </button>
              </fieldset>
              <Link className="text-link" to="/ajustes/campos">
                Gestionar mis campos
              </Link>
            </>
          ) : (
            <>
              <h2>Necesitas un campo</h2>
              <p>Crea un campo para iniciar tu primera ronda.</p>
              <Link className="button" to="/ajustes/campos">
                Crear mi primer campo
              </Link>
              <button className="button full" disabled>
                Iniciar ronda
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
}
function NoRound({
  loading,
  error,
  retry,
  title,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
  title: string;
}) {
  return (
    <>
      <Link className="back" to="/">
        <span aria-hidden="true">←</span> Volver al inicio
      </Link>
      <PageTitle eyebrow="TU RECORRIDO" title={title} />
      <DataFeedback loading={loading} error={error} retry={retry} />
      {!loading && !error && (
        <section className="empty card">
          <h2>No hay una ronda disponible</h2>
          <p>Inicia una ronda o selecciona una guardada del historial.</p>
          <Link className="button" to="/ronda/nueva">
            Nueva ronda
          </Link>
          <Link className="text-link" to="/rondas">
            Ver rondas
          </Link>
        </section>
      )}
    </>
  );
}
export function Shot() {
  const data = useRound();
  const navigate = useNavigate();
  if (data.loading || data.error || !data.round || !data.hole)
    return <NoRound {...data} title="Registrar golpe" />;
  const { round, hole, current, holeShots: shots } = data;
  const editing = data.editId
    ? shots.find((s) => s.id === data.editId)
    : undefined;
  const locked =
    !editing &&
    (round.estado === "finalizada" ||
      hole.estado === "completado" ||
      holed(shots.at(-1)) ||
      current?.id !== hole.id);
  return (
    <>
      <LiveRoundNav round={round} hole={hole} current={current} shots={shots} />
      <PageTitle
        eyebrow={round.campoNombre}
        title={editing ? "Editar golpe" : "Registrar golpe"}
      />
      <div className="hole-header">
        <div>
          <span>HOYO</span>
          <strong>{hole.numero}</strong>
        </div>
        <div>
          <span>PAR HISTÓRICO</span>
          <strong>{hole.par}</strong>
        </div>
        <div>
          <span>RESULTADO ACTUAL</span>
          <strong>{holeScore(shots).total}</strong>
        </div>
      </div>
      {data.editId && !editing ? (
        <p role="alert" className="error-box">
          El golpe solicitado no existe en este hoyo.{" "}
          <Link to={roundUrl("resumen", round.id, hole.id)}>
            Volver al resumen
          </Link>
        </p>
      ) : locked ? (
        <section className="card">
          <h2>
            {holed(shots.at(-1))
              ? "Bola embocada: revisa y confirma"
              : "Consulta la tarjeta para continuar"}
          </h2>
          <Link className="button" to={roundUrl("resumen", round.id, hole.id)}>
            Ver resumen de hoyo
          </Link>
        </section>
      ) : (
        <ShotForm
          key={`${hole.id}:${editing?.id ?? shots.length}`}
          round={round}
          hole={hole}
          shots={shots}
          clubs={data.clubs}
          editing={editing}
          onSaved={(embocado) => {
            if (editing || embocado)
              navigate(roundUrl("resumen", round.id, hole.id));
            else
              navigate(roundUrl("golpe", round.id, hole.id), { replace: true });
          }}
        />
      )}
    </>
  );
}
function ShotDetails({ shot }: { shot: Shot }) {
  return (
    <>
      <strong>{shot.paloNombre}</strong>
      <p>
        {shot.origen} → {shot.destino}
      </p>
      <small>
        {shot.tipo === "normal"
          ? targetLabel(shot.diana)
          : `${shot.distancia} · ${shot.resultado}${shot.direccion ? ` · ${shot.direccion}` : ""}`}{" "}
        · Penalización {shot.penalizacion ? `+${shot.penalizacion}` : "0"}
      </small>
    </>
  );
}
export function HoleSummary() {
  const data = useRound();
  const write = useWrite();
  const navigate = useNavigate();
  const [remove, setRemove] = useState<Shot | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (data.loading || data.error || !data.round || !data.hole)
    return <NoRound {...data} title="Resumen de hoyo" />;
  const { round, hole, current, holeShots: shots } = data;
  const score = holeScore(shots);
  const warnings = continuityWarnings(shots);
  const eligible =
    canConfirmHole(shots) &&
    hole.estado !== "completado" &&
    current?.id === hole.id;
  return (
    <>
      <LiveRoundNav round={round} hole={hole} current={current} shots={shots} />
      <PageTitle
        eyebrow={`${round.campoNombre} · HOYO ${hole.numero}`}
        title="Resumen de hoyo"
      />
      <WriteFeedback {...write} />
      <section className="score-card">
        <span>
          PAR {hole.par} · {hole.estado.toUpperCase()}
        </span>
        <strong>
          {shots.length ? score.total : "—"} <small>golpes totales</small>
        </strong>
        <span className="score-badge">
          {!shots.length
            ? "Sin golpes todavía"
            : score.total === hole.par
              ? "Al par · E"
              : `${score.total > hole.par ? "+" : ""}${score.total - hole.par} frente al par`}
        </span>
        <p>
          {score.physical} golpes ejecutados + {score.penalties} penalizaciones
          {hole.estado !== "completado" ? " · Resultado provisional" : ""}
        </p>
      </section>
      {warnings.length > 0 && (
        <aside className="demo-note" role="status">
          <strong>Revisa la continuidad</strong>
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
          <span>No se han cambiado los golpes posteriores.</span>
        </aside>
      )}
      <section className="card form-card">
        <h2>Secuencia de golpes</h2>
        {!shots.length ? (
          <p>Todavía no has registrado golpes en este hoyo.</p>
        ) : (
          <ol className="shot-list">
            {shots.map((shot) => (
              <li key={shot.id}>
                <span className="shot-number">{shot.orden}</span>
                <div>
                  <ShotDetails shot={shot} />
                  <div className="actions">
                    <Link
                      className="choice"
                      to={roundUrl("golpe", round.id, hole.id, shot.id)}
                    >
                      Editar golpe {shot.orden}
                    </Link>
                    <button
                      className="choice danger-text"
                      disabled={write.busy}
                      onClick={() => setRemove(shot)}
                    >
                      Eliminar golpe {shot.orden}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {hole.estado === "completado" ? (
          <>
            <p>Hoyo confirmado. Puedes corregir sus registros históricos.</p>
            <Link
              className="button"
              to={
                current
                  ? roundUrl("golpe", round.id, current.id)
                  : roundUrl("tarjeta", round.id)
              }
            >
              {current ? "Continuar ronda" : "Ver tarjeta y finalizar"}
            </Link>
          </>
        ) : (
          <>
            <button
              className="button full"
              disabled={!eligible || write.busy}
              onClick={() => setConfirm(true)}
            >
              Confirmar hoyo
            </button>
            {!canConfirmHole(shots) && (
              <p className="field-help">
                Para confirmar, el último golpe debe estar embocado. Corrige
                cualquier golpe posterior a un embocado.
              </p>
            )}
            <Link
              className="text-link"
              to={roundUrl("golpe", round.id, hole.id)}
            >
              Volver al registro
            </Link>
          </>
        )}
      </section>
      {remove && (
        <ConfirmDialog
          title="Eliminar golpe"
          description={`Se eliminará el golpe ${remove.orden}, se renumerará la secuencia y se recalculará el resultado. Si se pierde el embocado, se reabrirán el hoyo y la ronda.`}
          busy={write.busy}
          error={write.error}
          onCancel={() => setRemove(null)}
          onConfirm={() =>
            void write
              .run(
                () => repository.deleteShot(remove.id, round.revision),
                "Golpe eliminado.",
              )
              .then((ok) => {
                if (ok) setRemove(null);
              })
          }
        />
      )}
      {confirm && (
        <ConfirmDialog
          title="Confirmar hoyo"
          description={`Confirma el resultado del hoyo ${hole.numero}: ${score.total} golpes frente a par ${hole.par}.${warnings.length ? " Hay avisos de continuidad; revísalos antes de confirmar." : ""}`}
          busy={write.busy}
          error={write.error}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            void write
              .run(
                () => repository.confirmHole(hole.id, round.revision),
                "Hoyo confirmado.",
              )
              .then((ok) => {
                if (ok) {
                  setConfirm(false);
                  const next = data.holes.find(
                    (h) => h.id !== hole.id && h.estado !== "completado",
                  );
                  navigate(
                    next
                      ? roundUrl("golpe", round.id, next.id)
                      : roundUrl("tarjeta", round.id),
                  );
                }
              })
          }
        />
      )}
    </>
  );
}
export function RoundCard() {
  const data = useRound();
  const write = useWrite();
  const [finish, setFinish] = useState(false);
  if (data.loading || data.error || !data.round)
    return <NoRound {...data} title="Tarjeta de ronda" />;
  const { round, holes, current, hole, holeShots } = data;
  const scores = holes.map((h) => ({
    hole: h,
    shots: data.shots
      .filter((s) => s.hoyoId === h.id)
      .sort((a, b) => a.orden - b.orden),
  }));
  const confirmed = scores.filter((s) => s.hole.estado === "completado");
  const total = holeScore(scores.flatMap((s) => s.shots));
  const playedPar = totalPar(confirmed.map((s) => s.hole));
  const confirmedTotal = confirmed.reduce(
    (sum, s) => sum + holeScore(s.shots).total,
    0,
  );
  const all =
    holes.length === round.numeroHoyos && confirmed.length === holes.length;
  return (
    <>
      <LiveRoundNav
        round={round}
        hole={hole}
        current={current}
        shots={holeShots}
      />
      <PageTitle eyebrow={round.campoNombre} title="Tarjeta de ronda">
        {round.estado === "finalizada" ? "Ronda finalizada" : "Ronda en curso"}{" "}
        · {new Date(round.inicio).toLocaleDateString("es-ES")} ·{" "}
        {round.numeroHoyos} hoyos previstos
      </PageTitle>
      <WriteFeedback {...write} />
      <section className="card">
        <h2>
          {confirmed.length} de {holes.length} hoyos confirmados
        </h2>
        <p>
          {total.physical} golpes ejecutados + {total.penalties} penalizaciones
          = {total.total} golpes registrados
        </p>
        <p>
          Hoyos confirmados: {confirmedTotal} golpes frente a par {playedPar}
          {confirmed.length
            ? ` (${confirmedTotal - playedPar > 0 ? "+" : ""}${confirmedTotal - playedPar})`
            : ""}
          .
        </p>
        {round.fin && (
          <p>Finalización: {new Date(round.fin).toLocaleString("es-ES")}</p>
        )}
      </section>
      <DeleteRoundButton round={round} disabled={write.busy} />
      <RoundIndicators round={round} holes={holes} shots={data.shots} />
      <div className="management-list">
        {scores.map(({ hole: h, shots }) => (
          <Link
            className="card hole-row"
            key={h.id}
            to={roundUrl("resumen", round.id, h.id)}
          >
            <strong>Hoyo {h.numero}</strong>
            <span>
              Par {h.par} · {h.estado}
            </span>
            <strong>{shots.length ? holeScore(shots).total : "—"}</strong>
            <small>
              {continuityWarnings(shots).length
                ? "Revisar continuidad"
                : "Ver y corregir golpes"}
            </small>
          </Link>
        ))}
      </div>
      {round.estado === "en curso" && (
        <>
          <button
            className="button full"
            disabled={!all || write.busy}
            onClick={() => setFinish(true)}
          >
            Finalizar ronda
          </button>
          {!all && (
            <p className="field-help">
              Debes embocar y confirmar cada hoyo antes de finalizar.
            </p>
          )}
        </>
      )}
      {finish && (
        <ConfirmDialog
          title="Finalizar ronda"
          description={`Has confirmado ${confirmed.length} hoyos, con ${total.total} golpes. Podrás consultar y corregir la ronda desde el historial.`}
          busy={write.busy}
          error={write.error}
          onCancel={() => setFinish(false)}
          onConfirm={() =>
            void write
              .run(
                () => repository.finishRound(round.id, round.revision),
                "Ronda finalizada.",
              )
              .then((ok) => {
                if (ok) setFinish(false);
              })
          }
        />
      )}
    </>
  );
}
