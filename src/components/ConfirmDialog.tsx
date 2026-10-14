import { useEffect, useRef, type ReactNode } from "react";
export default function ConfirmDialog({
  title,
  description,
  busy,
  error,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  children,
}: {
  children?: ReactNode;
  confirmLabel?: string;
  title: string;
  description: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {children}
      <div className="actions">
        <button autoFocus className="choice" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
        <button className="button danger" disabled={busy} onClick={onConfirm}>
          {busy ? "Aplicando…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
