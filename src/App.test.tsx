import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { database, repository } from "./persistence/repository";
beforeEach(async () => {
  await database.delete();
  await database.open();
  await repository.initialize();
});
function open(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
describe("Rutas de fase 3", () => {
  it.each([
    ["/", "Tu juego."],
    ["/rondas", "Rondas"],
    ["/ronda/nueva", "Nueva ronda"],
    ["/ronda/golpe", "Registrar golpe"],
    ["/ronda/resumen", "Resumen de hoyo"],
    ["/ronda/tarjeta", "Tarjeta de ronda"],
    ["/estadisticas", "Estadísticas"],
    ["/ajustes", "Ajustes"],
    ["/ajustes/campos", "Mis campos"],
    ["/ajustes/palos", "Mi bolsa de palos"],
    ["/desconocida", "Página no encontrada"],
  ])("renderiza directamente %s", (path, title) => {
    open(path);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  });
  it("navega al preparador vacío y vuelve al inicio sin inventar una ronda", async () => {
    const user = userEvent.setup();
    open();
    expect(
      screen.queryByRole("button", { name: "Continuar ronda" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Nueva ronda" }));
    expect(
      await screen.findByRole("link", { name: "Crear mi primer campo" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Iniciar ronda" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("link", { name: "Volver al inicio" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tu juego.",
    );
  });
  it("cambia pestañas por ratón y teclado sin métricas inventadas", async () => {
    const user = userEvent.setup();
    open("/estadisticas");
    await user.click(screen.getByRole("tab", { name: "Putting" }));
    await screen.findByText("Sin rondas finalizadas");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Palos" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Tus palos",
    );
  });
});
