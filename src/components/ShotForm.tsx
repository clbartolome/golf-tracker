import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Choices } from "./UI";
import { WriteFeedback } from "./DataFeedback";
import ShotTarget from "./ShotTarget";
import DestinationChoices from "./DestinationChoices";
import { useWrite } from "../hooks/useGolfData";
import { repository } from "../persistence/repository";
import {
  puttDirections,
  puttResults,
  type PuttDirection,
  type PuttResult,
  origins,
  nextOrigin,
  type Origin,
  type Destination,
  type Shot,
  type Round,
  type PlayedHole,
  type ShotInput,
  type Penalty,
} from "../domain/rounds";
import type { TargetSelection } from "../domain/target";
import type { Club } from "../domain/models";
export default function ShotForm({
  round,
  hole,
  shots,
  clubs,
  editing,
  onSaved,
}: {
  round: Round;
  hole: PlayedHole;
  shots: Shot[];
  clubs: Club[];
  editing?: Shot;
  onSaved: (holed: boolean) => void;
}) {
  const initial = editing?.origen ?? nextOrigin(shots);
  const [origin, setOrigin] = useState<Origin | "">(initial);
  const [type, setType] = useState<"normal" | "putt">(
    editing?.tipo ?? (initial === "Green" ? "putt" : "normal"),
  );
  const [clubId, setClubId] = useState(editing?.paloId ?? "");
  const [target, setTarget] = useState<TargetSelection | null>(
    editing?.tipo === "normal" ? editing.diana : null,
  );
  const [destination, setDestination] = useState<Destination | "">(
    editing?.destino ?? "",
  );
  const [penalty, setPenalty] = useState<Penalty>(editing?.penalizacion ?? 0);
  const [distance, setDistance] = useState<"Corto" | "Medio" | "Largo" | "">(
    editing?.tipo === "putt" ? editing.distancia : "",
  );
  const [result, setResult] = useState<PuttResult | "">(
    editing?.tipo === "putt" ? editing.resultado : "",
  );
  const [direction, setDirection] = useState<PuttDirection | "">(
    editing?.tipo === "putt" ? editing.direccion ?? "" : "",
  );
  const write = useWrite();
  const errorId = useId();
  const requestId = useRef(crypto.randomUUID());
  const revision = useRef(round.revision);
  const active = clubs.filter(
    (c) => c.activo && (type !== "putt" || c.categoria === "Putter"),
  );
  const preserve =
    editing &&
    editing.tipo === type &&
    !active.some((c) => c.id === editing.paloId);
  const available = preserve
    ? [
        { id: editing.paloId, nombre: `${editing.paloNombre} · Histórico` },
        ...active,
      ]
    : active;
  const selected =
    available.find((c) => c.id === clubId)?.id ?? available[0]?.id ?? "";
  return (
    <section className="card form-card">
      <h2>
        {editing
          ? `Editar golpe ${editing.orden}`
          : `Golpe ${shots.length + 1}`}
      </h2>
      {!initial && !editing && (
        <p className="demo-note">
          El golpe anterior terminó en Agua o Fuera. Selecciona manualmente el
          siguiente origen; no se aplica penalización automática.
        </p>
      )}
      <form
        aria-describedby={write.error ? errorId : undefined}
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await write.run(
            async () => {
              if (!origin) throw new Error("Selecciona manualmente el origen.");
              let input: ShotInput;
              if (type === "putt") {
                if (!distance || !result)
                  throw new Error(
                    "Selecciona distancia inicial y resultado del putt.",
                  );
                if (!direction && result !== "Embocado")
                  throw new Error("Selecciona la dirección final del putt.");
                input = {
                  tipo: "putt",
                  origen: origin,
                  paloId: selected,
                  penalizacion: penalty,
                  distancia: distance,
                  resultado: result,
                  direccion: result === "Embocado" ? null : direction as PuttDirection,
                };
              } else {
                if (!destination) throw new Error("Selecciona el destino.");
                input = {
                  tipo: "normal",
                  origen: origin,
                  paloId: selected,
                  penalizacion: penalty,
                  destino: destination,
                  diana: target,
                };
              }
              if (editing)
                await repository.editShot(editing.id, input, revision.current);
              else
                await repository.addShot(
                  requestId.current,
                  hole.id,
                  input,
                  revision.current,
                );
            },
            editing ? "Golpe actualizado." : "Golpe registrado.",
          );
          if (ok)
            onSaved(
              type === "putt" ? result === "Embocado" : destination === "Hoyo",
            );
        }}
      >
        <fieldset disabled={write.busy} aria-describedby={write.error ? errorId : undefined}>
          <Choices
            label="Origen"
            options={[...origins]}
            value={origin}
            onChange={(value) => {
              setOrigin(value as Origin);
              setType(value === "Green" ? "putt" : "normal");
            }}
          />
          {origin === "Green" && (
            <Choices
              label="Tipo de golpe"
              options={["Putt", "Normal"]}
              value={type === "putt" ? "Putt" : "Normal"}
              onChange={(value) =>
                setType(value === "Putt" ? "putt" : "normal")
              }
            />
          )}
          <label htmlFor="play-club">Palo activo de tu bolsa</label>
          <select
            id="play-club"
            aria-describedby={write.error ? errorId : undefined}
            value={selected}
            disabled={!available.length}
            onChange={(event) => setClubId(event.target.value)}
          >
            {available.length ? (
              available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))
            ) : (
              <option value="">
                {type === "putt"
                  ? "No hay putters activos"
                  : "No hay palos activos"}
              </option>
            )}
          </select>
          <Link className="text-link" to="/ajustes/palos">
            Gestionar mi bolsa de palos
          </Link>
          {type === "normal" ? (
            <>
              <ShotTarget
                value={target}
                onChange={setTarget}
                disabled={write.busy}
              />
              <DestinationChoices
                value={destination}
                onChange={setDestination}
              />
              <p className="field-help">
                Si la bola no se ha movido, elige el mismo destino que el
                origen. El golpe cuenta igualmente.
              </p>
            </>
          ) : (
            <>
              <p className="putt-label">
                Modo putting · Un putt cuenta como un golpe físico
              </p>
              <Choices
                label="Distancia inicial"
                options={["Corto", "Medio", "Largo"]}
                value={distance}
                onChange={(value) => setDistance(value as typeof distance)}
              />
              <Choices
                label="Resultado del putt"
                options={[...puttResults]}
                value={result}
                onChange={(value) => setResult(value as typeof result)}
              />
              {result !== "Embocado" && (
                <Choices
                  label="Dirección final"
                  options={[...puttDirections]}
                  value={direction}
                  onChange={(value) => setDirection(value as PuttDirection)}
                />
              )}
              <p className="field-help">
                Red zone: bola muy cerca del hoyo sin embocar (radio visual aproximado de 50 cm, sin medir). No completa el hoyo; el siguiente putt cuenta como otro golpe. Los fallos proponen Green; puedes corregir el siguiente origen.
              </p>
            </>
          )}
          <Choices
            label="Penalización manual"
            options={["0", "+1", "+2"]}
            value={penalty ? `+${penalty}` : "0"}
            onChange={(value) => setPenalty(Number(value) as Penalty)}
          />
          <button
            type="submit"
            className="button full"
            disabled={!selected || !origin || (type === "normal" && !target)}
          >
            {editing ? "Guardar cambios" : "Registrar golpe"}
          </button>
          {type === "normal" && !target && (
            <p className="field-help">
              Debes seleccionar explícitamente la diana antes de registrar.
            </p>
          )}
        </fieldset>
        <WriteFeedback {...write} errorId={errorId} />
      </form>
    </section>
  );
}
