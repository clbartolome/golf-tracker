import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import ConfirmDialog from "./ConfirmDialog";
import { WriteFeedback } from "./DataFeedback";
import { useWrite } from "../hooks/useGolfData";
import { repository } from "../persistence/repository";
import {
  roundUrl,
  type Round,
  type PlayedHole,
  type Shot,
} from "../domain/rounds";
export default function LiveRoundNav({
  round,
  hole,
  current,
  shots,
}: {
  round: Round;
  hole?: PlayedHole;
  current?: PlayedHole;
  shots: Shot[];
}) {
  const write = useWrite();
  const [undo, setUndo] = useState(false);
  const last = shots.at(-1);
  const safe =
    !!last &&
    hole?.estado !== "completado" &&
    hole?.id === current?.id &&
    round.estado === "en curso";
  return (
    <>
      <Link className="back" to="/">
        <span aria-hidden="true">←</span> Volver al inicio
      </Link>
      <nav className="round-nav" aria-label="Navegación de ronda">
        <NavLink to={roundUrl("golpe", round.id, current?.id)}>Jugar</NavLink>
        <NavLink to={roundUrl("resumen", round.id, hole?.id)}>Hoyo</NavLink>
        <NavLink to={roundUrl("tarjeta", round.id)}>Ver tarjeta</NavLink>
      </nav>
      <div className="round-actions">
        <Link className="choice" to="/">
          Salir guardando
        </Link>
        <button
          className="choice"
          disabled={!safe || write.busy}
          onClick={() => setUndo(true)}
        >
          Deshacer último registro
        </button>
      </div>
      <p className="field-help">
        Los golpes registrados ya están guardados. Salir descarta únicamente el
        formulario sin registrar.
      </p>
      <WriteFeedback {...write} />
      {undo && last && (
        <ConfirmDialog
          title="Deshacer último registro"
          description={`Se eliminará el golpe ${last.orden} de este hoyo. Puedes cancelar.`}
          busy={write.busy}
          error={write.error}
          onCancel={() => setUndo(false)}
          onConfirm={() =>
            void write
              .run(
                () => repository.deleteShot(last.id, round.revision, true),
                "Último registro deshecho.",
              )
              .then((ok) => {
                if (ok) setUndo(false);
              })
          }
        />
      )}
    </>
  );
}
