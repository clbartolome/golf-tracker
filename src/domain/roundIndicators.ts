import { holeScore, type PlayedHole, type Round, type Shot } from "./rounds";

function ratio(numerator: number, denominator: number) {
  return {
    numerator,
    denominator,
    percentage: denominator ? (numerator / denominator) * 100 : null,
  };
}

/** Derived values only: never persist percentages or averages. */
export function roundIndicators(round: Round, holes: PlayedHole[], shots: Shot[]) {
  const roundHoles = holes.filter((hole) => hole.rondaId === round.id);
  const ids = new Set(roundHoles.map((hole) => hole.id));
  const roundShots = shots.filter((shot) => ids.has(shot.hoyoId));
  const completed = roundHoles.filter((hole) => hole.estado === "completado");
  let fairways = 0;
  let eligibleFairways = 0;
  let greens = 0;
  let putts = 0;
  let completedScore = 0;
  let completedPar = 0;
  for (const hole of completed) {
    const sequence = roundShots
      .filter((shot) => shot.hoyoId === hole.id)
      .sort((a, b) => a.orden - b.orden);
    if (hole.par === 4 || hole.par === 5) {
      eligibleFairways++;
      const teeShot = sequence.find((shot) => shot.origen === "Tee");
      if (teeShot?.destino === "Calle") fairways++;
    }
    let score = 0;
    for (const shot of sequence) {
      score += 1 + shot.penalizacion;
      if (shot.destino === "Green" || shot.destino === "Hoyo") {
        if (score <= hole.par - 2) greens++;
        break; // Only the first arrival matters, including a direct hole-out.
      }
    }
    putts += sequence.filter((shot) => shot.origen === "Green" && shot.tipo === "putt").length;
    completedScore += holeScore(sequence).total;
    completedPar += hole.par;
  }
  const score = holeScore(roundShots);
  return {
    partial: round.estado !== "finalizada" || completed.length !== round.numeroHoyos,
    completedHoles: completed.length,
    fir: ratio(fairways, eligibleFairways),
    gir: ratio(greens, completed.length),
    putts,
    averagePutts: completed.length ? putts / completed.length : null,
    penalties: score.penalties,
    totalScore: score.total,
    completedScore,
    completedPar,
    difference: completed.length ? completedScore - completedPar : null,
  };
}
