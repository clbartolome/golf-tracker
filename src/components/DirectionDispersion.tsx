import DispersionChart, { type DistributionData, type DispersionTrail } from "./DispersionChart";

const trails: readonly DispersionTrail[] = [
  { label: "Muy izquierda", path: "M 200 244 C 150 177 84 132 40 76", x: 40, y: 76, labelY: 58 },
  { label: "Izquierda", path: "M 200 244 C 179 181 140 105 112 54", x: 112, y: 54, labelY: 35 },
  { label: "Centro", path: "M 200 244 C 201 177 199 102 200 36", x: 200, y: 36, labelY: 17 },
  { label: "Derecha", path: "M 200 244 C 221 181 260 105 288 54", x: 288, y: 54, labelY: 35 },
  { label: "Muy derecha", path: "M 200 244 C 250 177 316 132 360 76", x: 360, y: 76, labelY: 58 },
];
export default function DirectionDispersion({ items, title = "Dirección de las salidas" }: { items: DistributionData; title?: string }) {
  return <DispersionChart title={title} items={items} trails={trails} height={280}
    description="Abanico relativo al objetivo previsto. El grosor y brillo indican frecuencia; las guías discontinuas no representan golpes. Sin metros ni GPS."
    scenery={<g aria-hidden="true" className="dispersion-scenery">
      <path className="dispersion-fairway-outer" d="M 200 244 L 24 62 Q 200 8 376 62 Z" />
      <path className="dispersion-fairway-middle" d="M 200 244 L 92 44 Q 200 22 308 44 Z" />
      <path className="dispersion-fairway-inner" d="M 200 244 L 176 35 Q 200 30 224 35 Z" />
      <path className="dispersion-reference" d="M 200 244 C 200 176 200 103 200 36" />
      <text x="20" y="270">Izquierda</text><text x="380" y="270" textAnchor="end">Derecha</text>
    </g>}
    foreground={<g aria-hidden="true"><circle className="dispersion-ball" cx="200" cy="244" r="10" /></g>} />;
}
