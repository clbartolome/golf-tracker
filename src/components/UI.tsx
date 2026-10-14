import { Link } from "react-router-dom";
import { ArrowUpRight, Flag } from "lucide-react";
import type { ReactNode } from "react";
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="subtitle">{children}</p>}
    </header>
  );
}
export function EmptyState({
  title,
  children,
  action = false,
}: {
  title: string;
  children: ReactNode;
  action?: boolean;
}) {
  return (
    <section className="empty card">
      <span className="empty-icon">
        <Flag aria-hidden="true" size={30} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action && (
        <Link className="button" to="/ronda/nueva">
          Nueva ronda <ArrowUpRight size={19} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
export function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="choices">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={value === option}
            className={value === option ? "choice selected" : "choice"}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
