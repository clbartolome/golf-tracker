import DispersionChart, { type DistributionData, type DispersionTrail } from "./DispersionChart";

const trails: readonly DispersionTrail[] = [
  { label: "Muy corto", path: "M 24 200 C 45 159 66 159 90 200", x: 90, y: 200, labelY: 222 },
  { label: "Corto", path: "M 24 200 C 61 129 103 129 140 200", x: 140, y: 200, labelY: 239 },
  { label: "Distancia correcta", path: "M 24 200 C 115 37 188 57 275 200", x: 275, y: 200, labelY: 222 },
  { label: "Largo", path: "M 24 200 C 130 29 221 47 325 200", x: 325, y: 200, labelY: 239 },
  { label: "Muy largo", path: "M 24 200 C 143 23 250 39 372 200", x: 372, y: 200, labelY: 222 },
];
export default function DistanceTrajectories({ items, title = "Longitud de las salidas" }: { items: DistributionData; title?: string }) {
  return <DispersionChart title={title} items={items} trails={trails} height={275} strokeScale={0.65}
    description="Alcances visuales ordenados por categoría. Las curvas son ilustrativas: no representan altura, velocidad, metros ni balística real."
    scenery={<g aria-hidden="true" className="dispersion-scenery"><path className="dispersion-ground" d="M 15 201 H 384" /><text className="dispersion-distance-label" x="16" y="267">Muy corto</text><text className="dispersion-distance-label" x="242" y="267" textAnchor="middle">Distancia correcta</text><text className="dispersion-distance-label" x="384" y="267" textAnchor="end">Muy largo</text></g>}
    foreground={<g aria-hidden="true"><circle className="dispersion-ball" cx="24" cy="200" r="8" /></g>} />;
}
