import DeleteRoundButton from "../components/DeleteRoundButton";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronRight,
  ChartNoAxesCombined,
  History,
  Plus,
  Flag,
} from "lucide-react";
import { EmptyState, PageTitle } from "../components/UI";
import { useGolfData } from "../hooks/useGolfData";
import { DataFeedback } from "../components/DataFeedback";
import { holeScore, roundUrl } from "../domain/rounds";
function RoundList({
  data,
  limit,
}: {
  data: ReturnType<typeof useGolfData>;
  limit?: number;
}) {
  return (
    <div className="management-list">
      {data.rounds.slice(0, limit).map((round) => {
        const holes = data.playedHoles.filter((h) => h.rondaId === round.id);
        const ids = new Set(holes.map((h) => h.id));
        const score = holeScore(data.shots.filter((s) => ids.has(s.hoyoId)));
        return (
          <section className="card round-preview" key={round.id}>
            <Link
              className="round-preview-link"
              to={roundUrl(round.estado === "en curso" ? "golpe" : "tarjeta", round.id)}
              aria-label={`${round.estado === "en curso" ? "Continuar" : "Abrir"} ronda ${round.campoNombre} · ${new Date(round.inicio).toLocaleDateString("es-ES")}`}
            >
              <div>
                <h2>{round.campoNombre}</h2>
                <p>
                  {new Date(round.inicio).toLocaleDateString("es-ES")} ·{" "}
                  {round.estado} ·{" "}
                  {holes.filter((h) => h.estado === "completado").length}/
                  {round.numeroHoyos} hoyos confirmados
                </p>
                <p>{score.total} golpes registrados</p>
              </div>
              <ChevronRight className="round-chevron" size={22} aria-hidden="true" />
            </Link>
            <DeleteRoundButton round={round} iconOnly />
          </section>
        );
      })}
    </div>
  );
}
export function Home() {
  const data = useGolfData();
  const location = useLocation();
  const active = data.rounds.find((r) => r.estado === "en curso");
  return (
    <>
      {location.state?.backupRestored && <p role="status" className="feedback">Copia restaurada. Todos los datos se han sustituido.</p>}
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Cada golpe cuenta</p>
          <h1>
            Tu juego.
            <br />
            Tu momento.
          </h1>
          <p>Sal al campo. Conoce tu juego.</p>
          <Link className="button" to="/ronda/nueva">
            <Plus size={20} aria-hidden="true" /> Nueva ronda
          </Link>
        </div>
        <div className="course-art" aria-hidden="true">
          <div className="fairway" />
          <div className="green" />
          <Flag className="course-flag" size={56} />
          <div className="ball" />
        </div>
      </section>
      {active && (
        <section className="continue card round-preview">
          <Link className="round-preview-link" to={roundUrl("golpe", active.id)} aria-label="Continuar ronda">
            <div>
              <h2>Tu ronda en curso</h2>
              <p>{active.campoNombre}</p>
            </div>
            <ChevronRight className="round-chevron" size={22} aria-hidden="true" />
          </Link>
          <DeleteRoundButton round={active} iconOnly />
        </section>
      )}
      <div className="shortcut-grid">
        <Link className="card shortcut" to="/rondas">
          <History aria-hidden="true" />
          <div>
            <h2>Mis rondas</h2>
            <p>Tu recorrido, en un lugar</p>
          </div>
          <ArrowUpRight aria-hidden="true" />
        </Link>
        <Link className="card shortcut" to="/estadisticas">
          <ChartNoAxesCombined aria-hidden="true" />
          <div>
            <h2>Estadísticas</h2>
            <p>Conoce tu juego</p>
          </div>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      <div className="section-heading">
        <h2>Últimas rondas</h2>
        <Link to="/rondas">Ver todas</Link>
      </div>
      <DataFeedback {...data} />
      {!data.loading &&
        !data.error &&
        (data.rounds.length ? (
          <RoundList data={data} limit={3} />
        ) : (
          <EmptyState title="El primer tee te espera">
            Todavía no hay rondas. Prepara tu campo y empieza a registrar tu
            juego.
          </EmptyState>
        ))}
    </>
  );
}
export function Rounds() {
  const data = useGolfData();
  const location = useLocation();
  return (
    <>
      {location.state?.roundDeleted && <p role="status" className="feedback">Ronda eliminada definitivamente.</p>}
      <PageTitle eyebrow="TU RECORRIDO" title="Rondas">
        Historial y rondas en curso guardadas en este navegador.
      </PageTitle>
      <Link className="button" to="/ronda/nueva">
        Nueva ronda
      </Link>
      <DataFeedback {...data} />
      {!data.loading &&
        !data.error &&
        (data.rounds.length ? (
          <RoundList data={data} />
        ) : (
          <EmptyState title="Todavía no hay rondas" action>
            Crea un campo y empieza tu primera ronda. Podrás recuperarla desde
            aquí.
          </EmptyState>
        ))}
    </>
  );
}
export function Settings() {
  const data = useGolfData();
  return (
    <>
      <PageTitle eyebrow="A TU MEDIDA" title="Ajustes">
        Todo lo que necesitas para preparar tu juego.
      </PageTitle>
      <DataFeedback {...data} />
      <div className="settings-list">
        <Link className="card setting setting-link" to="/ajustes/campos">
          <h2>Mis campos</h2>
          <p>Creación manual, favoritos y pares por hoyo.</p>
          <strong>
            {data.loading || data.error ? "—" : data.courses.length} campos
          </strong>
        </Link>
        <Link className="card setting setting-link" to="/ajustes/palos">
          <h2>Mi bolsa de palos</h2>
          <p>Nombres, categorías, disponibilidad y orden.</p>
          <strong>
            {data.loading || data.error
              ? "—"
              : data.clubs.filter((c) => c.activo).length}{" "}
            palos activos
          </strong>
        </Link>
        <Link className="card setting setting-link" to="/ajustes/datos">
          <h2>Datos y copias de seguridad</h2>
          <p>Exporta todos tus datos o restaura una copia JSON completa.</p>
          <strong>Gestionar copias</strong>
        </Link>
      </div>
      <p className="footnote">Tu juego guardado en este navegador</p>
    </>
  );
}
