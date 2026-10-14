import { Ban, Check, CircleDot, Droplets, Ellipsis, Flag, FlagTriangleRight, Route, Sprout, Waves, type LucideIcon } from "lucide-react";
import { destinations, type Destination } from "../domain/rounds";

const icons: Record<Destination, LucideIcon> = {
  Tee: FlagTriangleRight,
  Calle: Route,
  Rough: Sprout,
  Bunker: Waves,
  Green: Flag,
  Agua: Droplets,
  Fuera: Ban,
  Hoyo: CircleDot,
  Otro: Ellipsis,
};

export default function DestinationChoices({ value, onChange }: {
  value: Destination | "";
  onChange: (value: Destination) => void;
}) {
  return (
    <fieldset className="shot-destinations">
      <legend>Destino</legend>
      <div className="destination-grid">
        {destinations.map((destination) => {
          const Icon = icons[destination];
          const selected = value === destination;
          return (
            <button
              type="button"
              key={destination}
              className="destination-card"
              aria-pressed={selected}
              onClick={() => onChange(destination)}
            >
              <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
              <span>{destination}</span>
              {selected && <Check className="destination-check" size={16} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
