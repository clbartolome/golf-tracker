export function DataFeedback({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return (
    <>
      {loading && <p role="status">Cargando datos locales…</p>}
      {error && (
        <div role="alert" className="error-box">
          <p>{error}</p>
          <button className="choice" onClick={retry}>
            Reintentar lectura
          </button>
        </div>
      )}
    </>
  );
}
export function WriteFeedback({
  errorId,
  busy,
  error,
  message,
}: {
  errorId?: string;
  busy: boolean;
  error: string;
  message: string;
}) {
  return (
    <>
      {busy && <p role="status">Guardando…</p>}
      {error && (
        <p id={errorId} role="alert" className="error-box">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="feedback">
          {message}
        </p>
      )}
    </>
  );
}
