import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { database, repository } from "../persistence/repository";
import { backupFixture } from "../test-helpers/backupFixture";

beforeEach(async () => {
  await database.delete();
  await database.open();
  await repository.initialize();
  localStorage.clear();
});
function open(path: string) { return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); }
function file(value: unknown) { return new File([JSON.stringify(value)], "backup.json", { type: "application/json" }); }

describe("Restauración y actualización de pantallas", () => {
  it("valida sin escribir, permite cancelar y restaura todo solo tras confirmar", async () => {
    await backupFixture(repository);
    const original = await repository.snapshot();
    const backup = await repository.exportBackup();
    await repository.saveClub({ nombre: "Palo posterior", categoria: "Otro", activo: true });
    const modified = await repository.snapshot();
    open("/ajustes/datos");
    const input = await screen.findByLabelText("Restaurar copia de seguridad");
    await waitFor(() => expect(input).toBeEnabled());
    await userEvent.upload(input, file(backup));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Restaurar copia de seguridad");
    expect(await repository.snapshot()).toEqual(modified);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(await repository.snapshot()).toEqual(modified);
    await userEvent.upload(input, file(backup));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Restaurar todo" }));
    await screen.findByText("Copia restaurada. Todos los datos se han sustituido.");
    expect(await repository.snapshot()).toEqual(original);
    await userEvent.click(screen.getByRole("link", { name: "Ajustes" }));
    await userEvent.click(await screen.findByRole("link", { name: /Mi bolsa de palos/ }));
    expect(await screen.findByRole("heading", { name: "Mi hierro renovado" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Activo: Mi hierro renovado" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("heading", { name: "Palo posterior" })).not.toBeInTheDocument();
  });

  it("asocia el error de copia inválida al selector y conserva los datos", async () => {
    const before = await repository.snapshot();
    open("/ajustes/datos");
    const input = await screen.findByLabelText("Restaurar copia de seguridad");
    await waitFor(() => expect(input).toBeEnabled());
    await userEvent.upload(input, file({ format: "unknown" }));
    await screen.findByRole("alert");
    expect(input).toHaveAccessibleDescription(/Copia de seguridad no válida/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await repository.snapshot()).toEqual(before);
  });

  it("actualiza el detalle de palo abierto cuando otra pantalla restaura la copia", async () => {
    const { iron, roundId } = await backupFixture(repository);
    const backup = await repository.exportBackup();
    await repository.deleteRound(roundId, (await repository.snapshot()).rounds[0].revision);
    open(`/estadisticas?seccion=Palos&palo=${iron.id}`);
    await screen.findByText("Sin rondas finalizadas");
    expect(screen.getByText("Índice de Precisión: —")).toBeVisible();
    await repository.restoreBackup(backup);
    await screen.findByText("1 rondas · 9 hoyos analizados");
    expect(screen.getByText("Índice de Precisión: 100.0")).toBeVisible();
    expect(screen.getByText("Penalizaciones asociadas: 8 golpes")).toBeVisible();
    expect(screen.getByText(/Nombre actual: Mi hierro renovado/)).toBeVisible();
  });

  it("asocia errores del editor de palo al formulario sin perder su contenido", async () => {
    open("/ajustes/palos");
    const create = screen.getByRole("button", { name: "Crear palo" });
    await waitFor(() => expect(create).toBeEnabled());
    await userEvent.click(create);
    await userEvent.type(screen.getByLabelText("Nombre del palo"), "Palo pendiente");
    const spy = vi.spyOn(repository, "saveClub").mockRejectedValueOnce(new Error("No hay espacio"));
    try {
      await userEvent.click(screen.getByRole("button", { name: "Guardar palo" }));
      await screen.findByRole("alert");
      expect(screen.getByLabelText("Nombre del palo").closest("form")).toHaveAccessibleDescription("No hay espacio");
      expect(screen.getByLabelText("Nombre del palo")).toHaveValue("Palo pendiente");
    } finally { spy.mockRestore(); }
  });
});
