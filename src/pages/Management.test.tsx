import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { database, repository } from "../persistence/repository";
beforeEach(async () => {
  await database.delete();
  await database.open();
  await repository.initialize();
});
function open(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
describe("Gestión real y confirmaciones", () => {
  it("crea campo, edita y cancela reducción sin cambios parciales; confirma reducción y eliminación", async () => {
    const user = userEvent.setup();
    open("/ajustes/campos");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Crear campo" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Crear campo" }));
    await user.type(screen.getByLabelText("Nombre del campo"), "Costa");
    await user.click(screen.getByRole("button", { name: "18" }));
    await user.selectOptions(screen.getByLabelText("Hoyo 1"), "6");
    await user.selectOptions(screen.getByLabelText("Hoyo 18"), "5");
    expect(screen.getByText("Par total:")).toHaveTextContent("75");
    await user.click(screen.getByRole("button", { name: "Guardar campo" }));
    await user.click(
      await screen.findByRole("button", { name: "Editar Costa" }),
    );
    await user.click(screen.getByRole("button", { name: "9" }));
    let dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Hoyo 18")).toHaveValue("5");
    expect(screen.getByRole("button", { name: "18" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "9" }));
    dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(screen.queryByLabelText("Hoyo 18")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar campo" }));
    await user.click(
      await screen.findByRole("button", { name: "Eliminar Costa" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    expect((await repository.snapshot()).courses).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Eliminar Costa" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(await screen.findByText("Aún no tienes campos")).toBeVisible();
    expect((await repository.snapshot()).courses).toHaveLength(0);
  });
  it("crea y edita un palo, confirma eliminación y recupera cambios al remontar", async () => {
    const user = userEvent.setup();
    const view = open("/ajustes/palos");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Crear palo" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Crear palo" }));
    await user.type(screen.getByLabelText("Nombre del palo"), "Mi palo");
    await user.selectOptions(screen.getByLabelText("Categoría"), "Wedge");
    await user.click(screen.getByRole("button", { name: "Guardar palo" }));
    await user.click(
      await screen.findByRole("button", { name: "Editar Mi palo" }),
    );
    await user.clear(screen.getByLabelText("Nombre del palo"));
    await user.type(screen.getByLabelText("Nombre del palo"), "Wedge propio");
    await user.click(screen.getByLabelText("Palo activo"));
    await user.click(screen.getByRole("button", { name: "Guardar palo" }));
    await screen.findByRole("button", { name: "Editar Wedge propio" });
    view.unmount();
    open("/ajustes/palos");
    expect(
      await screen.findByRole("button", { name: "Activo: Wedge propio" }),
    ).toHaveAttribute("aria-pressed", "false");
    await user.click(
      screen.getByRole("button", { name: "Eliminar Wedge propio" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    expect(screen.getByRole("heading", { name: "Wedge propio" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Eliminar Wedge propio" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Wedge propio" }),
      ).not.toBeInTheDocument(),
    );
  });
  it("muestra campos reales favoritos y conteos reales en ajustes", async () => {
    await repository.saveCourse({
      nombre: "Alfa",
      favorito: false,
      pares: Array(9).fill(4),
    });
    await repository.saveCourse({
      nombre: "Favorito",
      favorito: true,
      pares: Array(18).fill(5),
    });
    const view = open("/ronda/nueva");
    const select = await screen.findByLabelText("Campo");
    await waitFor(() => expect(select).toHaveDisplayValue("★ Favorito"));
    await userEvent.click(screen.getByRole("button", { name: "18" }));
    expect(screen.getByText("Hoyo 18")).toBeVisible();
    expect(screen.getByText("18 hoyos · Par total 90")).toBeVisible();
    view.unmount();
    open("/ajustes");
    expect(await screen.findByText("2 campos")).toBeVisible();
    expect(await screen.findByText("11 palos activos")).toBeVisible();
  });
  it("excluye inactivos del selector y admite una bolsa vacía", async () => {
    const driver = (await repository.snapshot()).clubs[0];
    await repository.toggleClub(driver);
    const course = await repository.saveCourse({
      nombre: "Campo",
      favorito: false,
      pares: Array(9).fill(4),
    });
    await repository.startRound(crypto.randomUUID(), course, 9);
    open("/ronda/golpe");
    await waitFor(() =>
      expect(
        screen.getByLabelText("Palo activo de tu bolsa"),
      ).toHaveDisplayValue("Madera 3"),
    );
    expect(
      screen.queryByRole("option", { name: "Driver" }),
    ).not.toBeInTheDocument();
    for (const club of (await repository.snapshot()).clubs)
      await repository.deleteClub(club.id);
    await waitFor(() =>
      expect(screen.getByLabelText("Palo activo de tu bolsa")).toBeDisabled(),
    );
    expect(
      screen.getByRole("option", { name: "No hay palos activos" }),
    ).toBeVisible();
  });
  it("muestra un error de lectura y permite reintentar", async () => {
    const spy = vi
      .spyOn(repository, "initialize")
      .mockRejectedValueOnce(new Error("Lectura no disponible"));
    open("/ajustes/campos");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lectura no disponible",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar lectura" }),
    );
    expect(await screen.findByText("Aún no tienes campos")).toBeVisible();
    spy.mockRestore();
  });
  it("mantiene el formulario y muestra error si falla el guardado", async () => {
    const user = userEvent.setup();
    open("/ajustes/campos");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Crear campo" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Crear campo" }));
    await user.type(screen.getByLabelText("Nombre del campo"), "Pendiente");
    const spy = vi
      .spyOn(repository, "saveCourse")
      .mockRejectedValueOnce(new Error("No hay espacio disponible"));
    await user.click(screen.getByRole("button", { name: "Guardar campo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No hay espacio disponible",
    );
    expect(screen.getByLabelText("Nombre del campo")).toHaveValue("Pendiente");
    await user.click(screen.getByRole("button", { name: "Guardar campo" }));
    expect(
      await screen.findByRole("heading", { name: "Pendiente" }),
    ).toBeVisible();
    spy.mockRestore();
  });
});
