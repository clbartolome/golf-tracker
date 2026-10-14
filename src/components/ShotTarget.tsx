import { useRef, useState, useId, useEffect, type PointerEvent } from "react";
import {
  classifyTarget,
  horizontalZones,
  verticalZones,
  targetLabel,
  targetFromCategories,
  type Horizontal,
  type Vertical,
  type TargetSelection,
} from "../domain/target";
export default function ShotTarget({
  value,
  onChange,
  disabled = false,
}: {
  value: TargetSelection | null;
  onChange: (value: TargetSelection) => void;
  disabled?: boolean;
}) {
  const pointer = useRef<number | null>(null);
  const id = useId();
  const [horizontal, setHorizontal] = useState<Horizontal | "">(
    value?.horizontal ?? "",
  );
  const [vertical, setVertical] = useState<Vertical | "">(
    value?.vertical ?? "",
  );
  useEffect(() => {
    if (value === null) {
      setHorizontal("");
      setVertical("");
    }
  }, [value]);
  function select(target: TargetSelection) {
    setHorizontal(target.horizontal);
    setVertical(target.vertical);
    onChange(target);
  }
  function update(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width && rect.height)
      select(
        classifyTarget(
          ((event.clientX - rect.left) / rect.width) * 2.4 - 1.2,
          1.2 - ((event.clientY - rect.top) / rect.height) * 2.4,
        ),
      );
  }
  function release(event: PointerEvent<SVGSVGElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const point =
    value?.point ??
    (value
      ? targetFromCategories(value.horizontal, value.vertical).point
      : undefined);
  return (
    <fieldset disabled={disabled} className="shot-target">
      <legend>Diana del golpe · 25 categorías</legend>
      <p className="field-help" id={`${id}-help`}>
        Posición relativa al objetivo previsto. Toca o arrastra; también puedes
        abrir «Ajuste preciso» para usar el teclado. Anillos de referencia visual, sin distancias físicas. Verde: centro; amarillo: desviación media; terracota: grande. Cada eje se clasifica independientemente.
      </p>
      <div className="target-axis-label">↑ Muy largo</div>
      <svg
        className="circular-target"
        viewBox="0 0 240 240"
        role="img"
        aria-label="Diana circular interactiva"
        aria-describedby={`${id}-help`}
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (
            disabled ||
            event.isPrimary === false ||
            event.button !== 0 ||
            pointer.current !== null
          )
            return;
          event.preventDefault();
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          update(event);
        }}
        onPointerMove={(event) => {
          if (!disabled && pointer.current === event.pointerId) {
            event.preventDefault();
            update(event);
          }
        }}
        onPointerUp={(event) => {
          if (!disabled && pointer.current === event.pointerId) update(event);
          release(event);
        }}
        onPointerCancel={release}
        onLostPointerCapture={() => {
          pointer.current = null;
        }}
      >
        <g transform="translate(120 120)">
          <circle r="100" fill="#C97862" stroke="#123c2d" strokeWidth="1.4" aria-label="Desviación grande" />
          <circle r="60" fill="#E7B65C" stroke="#123c2d" strokeWidth="1.4" aria-label="Desviación media" />
          <circle r="20" fill="#258654" stroke="#123c2d" strokeWidth="1.4" aria-label="Zona central" />
          <path
            d="M -100 0 H 100 M 0 -100 V 100"
            stroke="#123c2d"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text textAnchor="middle" y="4" fill="white" fontSize="12">
            Centro
          </text>
          {point && (
            <g transform={`translate(${point.x * 100} ${-point.y * 100})`}>
              <circle r="12" fill="#123c2d" stroke="white" strokeWidth="3" />
              <circle r="2" fill="#123c2d" />
            </g>
          )}
        </g>
      </svg>
      <div className="target-axis-label target-horizontal">
        <span>← Muy izquierda</span>
        <span>Muy derecha →</span>
      </div>
      <div className="target-axis-label">↓ Muy corto</div>
      <p role="status" className="target-result">
        {value
          ? targetLabel(value)
          : "Sin selección: elige la diana para guardar."}
      </p>
      <button
        type="button"
        className="choice"
        onClick={() => select(classifyTarget(0, 0))}
      >
        Recentrar en Centro
      </button>
      <details className="target-precision">
        <summary>Ajuste preciso</summary>
        <div className="target-selectors">
          <label htmlFor={`${id}-horizontal`}>
            Dirección
            <select
              id={`${id}-horizontal`}
              value={value?.horizontal ?? horizontal}
              onChange={(event) => {
                const h = event.target.value as Horizontal;
                setHorizontal(h);
                const v = value?.vertical ?? vertical;
                if (h && v) select(targetFromCategories(h, v));
              }}
            >
              <option value="" disabled>
                Selecciona dirección
              </option>
              {horizontalZones.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-vertical`}>
            Longitud
            <select
              id={`${id}-vertical`}
              value={value?.vertical ?? vertical}
              onChange={(event) => {
                const v = event.target.value as Vertical;
                setVertical(v);
                const h = value?.horizontal ?? horizontal;
                if (h && v) select(targetFromCategories(h, v));
              }}
            >
              <option value="" disabled>
                Selecciona longitud
              </option>
              {verticalZones.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </fieldset>
  );
}
