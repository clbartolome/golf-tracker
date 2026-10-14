import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Flag,
  House,
  History,
  ChartNoAxesCombined,
  Settings,
} from "lucide-react";
import { Home, Rounds, Settings as SettingsPage } from "./pages/Overview";
import { NewRound, Shot, HoleSummary, RoundCard } from "./pages/Round";
import Statistics from "./pages/Statistics";
import Courses from "./pages/Courses";
import Clubs from "./pages/Clubs";
import Backups from "./pages/Backups";
const navigation = [
  { to: "/", label: "Inicio", icon: House },
  { to: "/rondas", label: "Rondas", icon: History },
  { to: "/estadisticas", label: "Estadísticas", icon: ChartNoAxesCombined },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus();
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <Link to="/" className="brand">
          <span>
            <Flag size={23} aria-hidden="true" />
          </span>
          Golf Tracker
        </Link>
      </header>
      <nav className="main-nav" aria-label="Navegación principal">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink to={to} end={to === "/"} key={to}>
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rondas" element={<Rounds />} />
          <Route path="/ronda/nueva" element={<NewRound />} />
          <Route path="/ronda/golpe" element={<Shot />} />
          <Route path="/ronda/resumen" element={<HoleSummary />} />
          <Route path="/ronda/tarjeta" element={<RoundCard />} />
          <Route path="/estadisticas" element={<Statistics />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="/ajustes/campos" element={<Courses />} />
          <Route path="/ajustes/palos" element={<Clubs />} />
          <Route path="/ajustes/datos" element={<Backups />} />
          <Route
            path="*"
            element={
              <>
                <h1>Página no encontrada</h1>
                <Link className="button" to="/">
                  Volver al inicio
                </Link>
              </>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        GOLF TRACKER <span>Hecho para disfrutar del recorrido.</span>
      </footer>
    </>
  );
}
