import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { database, repository } from "../persistence/repository";
import { classifyTarget } from "../domain/target";
import { roundUrl } from "../domain/rounds";

beforeEach(async () => {
  await database.delete();
  await database.open();
  await repository.initialize();
  await repository.saveCourse({ nombre: "Pinar", favorito: false, pares: Array(9).fill(4) });
});
async function seed(finished = false) {
  const data = await repository.snapshot();
  const id = crypto.randomUUID();
  await repository.startRound(id, data.courses[0].id, 9);
  if (finished) {
    const holes = (await repository.snapshot()).playedHoles.filter(h => h.rondaId === id).sort((a, b) => a.numero - b.numero);
    for (const hole of holes) {
      let round = (await repository.snapshot()).rounds.find(r => r.id === id)!;
      await repository.addShot(crypto.randomUUID(), hole.id, {
        tipo: "normal", origen: "Tee", paloId: data.clubs[0].id,
        destino: "Hoyo", diana: classifyTarget(0, 0), penalizacion: 0,
      }, round.revision);
      round = (await repository.snapshot()).rounds.find(r => r.id === id)!;
      await repository.confirmHole(hole.id, round.revision);
    }
    await repository.finishRound(id, (await repository.snapshot()).rounds.find(r => r.id === id)!.revision);
  }
  return id;
}
function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}
async function card(finished = false) {
  const link = await screen.findByRole("link", { name: finished ? /^Abrir ronda Pinar/ : /^Continuar ronda Pinar/ });
  return { link, section: link.closest("section")! };
}

describe.each(["/", "/rondas"])("Tarjetas pulsables en %s", (path) => {
  it.each([false, true])("abre la ronda correcta (finalizada: %s)", async (finished) => {
    const id = await seed(finished);
    open(path);
    const { link, section } = await card(finished);
    expect(link).toHaveAttribute("href", roundUrl(finished ? "tarjeta" : "golpe", id));
    expect(link.querySelector("button, a")).toBeNull();
    expect(within(section).queryByRole("link", { name: "Ver tarjeta" })).not.toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Eliminar ronda Pinar" })).not.toHaveTextContent("Eliminar ronda");
    await userEvent.click(within(link).getByRole("heading", { name: "Pinar" }));
    expect(await screen.findByRole("heading", { level: 1, name: finished ? "Tarjeta de ronda" : "Registrar golpe" })).toBeVisible();
  });
  it("papelera independiente, cancelación y eliminación actualizan la lista", async () => {
    await seed();
    const before = await repository.snapshot();
    open(path);
    const user = userEvent.setup();
    const { section } = await card();
    await user.click(within(section).getByRole("button", { name: "Eliminar ronda Pinar" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(path === "/" ? "Tu juego." : "Rondas");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(await repository.snapshot()).toEqual(before);
    await user.click(within(section).getByRole("button", { name: "Eliminar ronda Pinar" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar definitivamente" }));
    await screen.findByText("Ronda eliminada definitivamente.");
    await screen.findByText("Todavía no hay rondas");
    expect(screen.queryByRole("link", { name: /^Continuar ronda Pinar/ })).not.toBeInTheDocument();
  });
  it("permite abrir y eliminar por teclado y devuelve el foco al cancelar", async () => {
    await seed(); open(path);
    const user = userEvent.setup();
    const { link, section } = await card();
    const trash = within(section).getByRole("button", { name: "Eliminar ronda Pinar" });
    link.focus();
    await user.tab();
    expect(trash).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(trash).toHaveFocus();
    await user.tab({ shift: true });
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    await screen.findByRole("heading", { level: 1, name: "Registrar golpe" });
  });
});

it("la tarjeta destacada de ronda activa también separa el enlace y la papelera", async () => {
  const id = await seed(); open("/");
  const link = await screen.findByRole("link", { name: "Continuar ronda" });
  expect(link).toHaveAttribute("href", roundUrl("golpe", id));
  const section = link.closest("section")!;
  expect(link.querySelector("button, a")).toBeNull();
  await userEvent.click(within(section).getByRole("button", { name: "Eliminar ronda Pinar" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu juego.");
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  await userEvent.click(link);
  await screen.findByRole("heading", { level: 1, name: "Registrar golpe" });
});
