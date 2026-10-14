import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Round } from "../domain/rounds";
import { useWrite } from "../hooks/useGolfData";
import { repository } from "../persistence/repository";
import ConfirmDialog from "./ConfirmDialog";

export default function DeleteRoundButton({ round, disabled = false, iconOnly = false }: { round: Round; disabled?: boolean; iconOnly?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!confirm && restoreFocus.current) {
      restoreFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [confirm]);
  const write = useWrite();
  const navigate = useNavigate();
  return (
    <>
      <button
        ref={buttonRef}
        className={iconOnly ? "round-delete" : "choice danger-text round-delete-action"}
        aria-label={iconOnly ? `Eliminar ronda ${round.campoNombre}` : undefined}
        disabled={disabled || write.busy}
        onClick={() => setConfirm(true)}
      >
        {iconOnly ? <Trash2 size={19} aria-hidden="true" /> : "Eliminar ronda"}
      </button>
      {confirm && (
        <ConfirmDialog
          title="Eliminar ronda"
          description={`Campo: ${round.campoNombre}. Fecha de la ronda: ${new Date(round.inicio).toLocaleDateString("es-ES")}. Se eliminarán todos los hoyos, golpes, putts y penalizaciones asociados. La acción no se puede deshacer.`}
          confirmLabel="Eliminar definitivamente"
          busy={write.busy}
          error={write.error}
          onCancel={() => {
            restoreFocus.current = iconOnly;
            setConfirm(false);
          }}
          onConfirm={() => void write.run(
            () => repository.deleteRound(round.id, round.revision),
            "Ronda eliminada definitivamente.",
          ).then((ok) => {
            if (ok) {
              setConfirm(false);
              navigate("/rondas", { replace: true, state: { roundDeleted: true } });
            }
          })}
        />
      )}
    </>
  );
}
