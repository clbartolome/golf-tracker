import { useSearchParams } from "react-router-dom";
import { useGolfData } from "./useGolfData";
export function useRound() {
  const data = useGolfData();
  const [params] = useSearchParams();
  const requested = params.get("r");
  const round = requested
    ? data.rounds.find((r) => r.id === requested)
    : data.rounds.find((r) => r.estado === "en curso");
  const holes = data.playedHoles
    .filter((h) => h.rondaId === round?.id)
    .sort((a, b) => a.numero - b.numero);
  const current = holes.find((h) => h.estado !== "completado");
  const hole = params.get("h")
    ? holes.find((h) => h.id === params.get("h"))
    : (current ?? holes.at(-1));
  const shots = data.shots
    .filter((s) => s.hoyoId === hole?.id)
    .sort((a, b) => a.orden - b.orden);
  return {
    ...data,
    round,
    holes,
    hole,
    current,
    holeShots: shots,
    editId: params.get("edit"),
  };
}
