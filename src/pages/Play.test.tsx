import { beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { database, repository } from "../persistence/repository";
import { roundUrl } from "../domain/rounds";
import { classifyTarget } from "../domain/target";
beforeEach(async () => {
  await database.delete();
  await database.open();
  await repository.initialize();
  await repository.saveCourse({
    nombre: "Pinar",
    favorito: false,
    pares: Array(9).fill(4),
  });
});
function open(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
async function start() {
  const data = await repository.snapshot();
  const id = crypto.randomUUID();
  await repository.startRound(id, data.courses[0].id, 9);
  return id;
}
async function clickChoice(label: string, name: string) {
  const field = screen.getByText(label).closest("fieldset")!;
  await userEvent.click(within(field).getByRole("button", { name }));
}
describe("Flujo real de juego", () => {
  it("inicia, selecciona explícitamente, registra normal, putt, confirma y recupera el siguiente hoyo", async () => {
    const user = userEvent.setup();
    open("/ronda/nueva");
    await user.click(
      await screen.findByRole("button", { name: "Iniciar ronda" }),
    );
    await screen.findByRole("heading", { name: "Golpe 1" });
    const register = screen.getByRole("button", { name: "Registrar golpe" });
    expect(register).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sin selección");
    await user.click(
      screen.getByRole("button", { name: "Recentrar en Centro" }),
    );
    await clickChoice("Destino", "Green");
    await user.click(screen.getByRole("button", { name: "Registrar golpe" }));
    await screen.findByRole("heading", { name: "Golpe 2" });
    expect(
      screen.getByText("Modo putting · Un putt cuenta como un golpe físico"),
    ).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "Diana circular interactiva" }),
    ).not.toBeInTheDocument();
    await clickChoice("Distancia inicial", "Medio");
    await clickChoice("Resultado del putt", "Red zone");
    await clickChoice("Dirección final", "Izquierda");
    await user.click(screen.getByRole("button", { name: "Registrar golpe" }));
    await screen.findByRole("heading", { name: "Golpe 3" });
    expect((await repository.snapshot()).playedHoles.find((h) => h.numero === 1)?.estado).toBe("en curso");
    expect((await repository.snapshot()).shots.find((s) => s.tipo === "putt")).toMatchObject({ resultado: "Red zone", direccion: "Izquierda" });
    await clickChoice("Distancia inicial", "Corto");
    await clickChoice("Resultado del putt", "Embocado");
    expect(screen.queryByText("Dirección final")).not.toBeInTheDocument();
    await clickChoice("Penalización manual", "+1");
    await user.click(screen.getByRole("button", { name: "Registrar golpe" }));
    await screen.findByRole("heading", { level: 1, name: "Resumen de hoyo" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar hoyo" }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByText(/3 golpes ejecutados \+ 1 penalizaciones/),
    ).toBeVisible();
    const before = await repository.snapshot();
    expect(before.playedHoles.find((h) => h.numero === 1)?.estado).toBe(
      "en curso",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar hoyo" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    expect(
      (await repository.snapshot()).playedHoles.find((h) => h.numero === 1)
        ?.estado,
    ).toBe("en curso");
    await user.click(screen.getByRole("button", { name: "Confirmar hoyo" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await screen.findByRole("heading", { name: "Golpe 1" });
    expect(
      (await repository.snapshot()).playedHoles.find((h) => h.numero === 1)
        ?.estado,
    ).toBe("completado");
    await user.click(screen.getByRole("link", { name: "Salir guardando" }));
    await waitFor(() =>
      expect(
        screen.getAllByRole("link", { name: "Continuar ronda" }).length,
      ).toBeGreaterThan(0),
    );
    await user.click(
      screen.getAllByRole("link", { name: "Continuar ronda" })[0],
    );
    expect(
      await screen.findByRole("heading", { name: "Golpe 1" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Sin selección");
  });
  it("muestra indicadores parciales y los recalcula al editar y eliminar", async () => {
    const id = await start();
    let data = await repository.snapshot();
    const hole = data.playedHoles.find((h) => h.numero === 1)!;
    const club = data.clubs[0].id;
    const putter = data.clubs.find((c) => c.categoria === "Putter")!.id;
    const first = crypto.randomUUID();
    const normal = { tipo: "normal", origen: "Tee", paloId: club, penalizacion: 0, destino: "Calle", diana: classifyTarget(0, 0) } as const;
    await repository.addShot(first, hole.id, normal, data.rounds[0].revision);
    data = await repository.snapshot();
    await repository.addShot(crypto.randomUUID(), hole.id, { ...normal, origen: "Calle", destino: "Green" }, data.rounds[0].revision);
    data = await repository.snapshot();
    const last = crypto.randomUUID();
    await repository.addShot(last, hole.id, { tipo: "putt", origen: "Green", paloId: putter, penalizacion: 0, distancia: "Corto", direccion: null, resultado: "Embocado" }, data.rounds[0].revision);
    data = await repository.snapshot();
    await repository.confirmHole(hole.id, data.rounds[0].revision);
    open(roundUrl("tarjeta", id));
    const section = await screen.findByRole("region", { name: "Indicadores de ronda" });
    function metric(label: string) {
      return within(section).getByText(`${label} · Parcial`).closest("div")!;
    }
    expect(metric("FIR")).toHaveTextContent("100 % · 1/1");
    expect(metric("GIR")).toHaveTextContent("100 % · 1/1");
    expect(metric("Putts por hoyo")).toHaveTextContent("1.00");
    expect(metric("Diferencia frente al par")).toHaveTextContent("-1");
    data = await repository.snapshot();
    await repository.editShot(first, { ...normal, destino: "Rough", penalizacion: 2 }, data.rounds[0].revision);
    await waitFor(() => expect(metric("FIR")).toHaveTextContent("0 % · 0/1"));
    expect(metric("GIR")).toHaveTextContent("0 % · 0/1");
    expect(metric("Golpes de penalización")).toHaveTextContent("2");
    expect(metric("Score total")).toHaveTextContent("5");
    data = await repository.snapshot();
    await repository.deleteShot(last, data.rounds[0].revision);
    await waitFor(() => expect(metric("GIR")).toHaveTextContent("— · 0/0"));
    expect(metric("Putts por hoyo")).toHaveTextContent("—");
    expect(metric("Diferencia frente al par")).toHaveTextContent("—");
  });
  it("agua exige origen manual y permite cambiar desde putting a normal", async () => {
    const id = await start();
    const data = await repository.snapshot();
    const round = data.rounds[0];
    const hole = data.playedHoles.find((h) => h.numero === 1)!;
    await repository.addShot(
      crypto.randomUUID(),
      hole.id,
      {
        tipo: "normal",
        origen: "Tee",
        paloId: data.clubs[0].id,
        penalizacion: 0,
        destino: "Agua",
        diana: classifyTarget(0, 0),
      },
      round.revision,
    );
    open(roundUrl("golpe", id));
    await screen.findByRole("heading", { name: "Golpe 2" });
    expect(
      screen.getByText(/Selecciona manualmente el siguiente origen/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Registrar golpe" }),
    ).toBeDisabled();
    await clickChoice("Origen", "Green");
    expect(screen.getByText("Tipo de golpe")).toBeVisible();
    await clickChoice("Tipo de golpe", "Normal");
    expect(
      screen.getByRole("img", { name: "Diana circular interactiva" }),
    ).toBeVisible();
  });
  it("previene doble pulsación mientras guarda y conserva formulario ante error", async () => {
    const id = await start();
    const user = userEvent.setup();
    open(roundUrl("golpe", id));
    await screen.findByRole("heading", { name: "Golpe 1" });
    await user.click(
      screen.getByRole("button", { name: "Recentrar en Centro" }),
    );
    await clickChoice("Destino", "Calle");
    const original = repository.addShot;
    let release: () => void = () => {};
    const spy = vi
      .spyOn(repository, "addShot")
      .mockImplementationOnce(async (...args) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return original(...args);
      });
    await user.dblClick(
      screen.getByRole("button", { name: "Registrar golpe" }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await screen.findByRole("heading", { name: "Golpe 2" });
    expect((await repository.snapshot()).shots).toHaveLength(1);
    spy.mockRejectedValueOnce(new Error("Guardado no disponible"));
    await user.click(
      screen.getByRole("button", { name: "Recentrar en Centro" }),
    );
    await clickChoice("Destino", "Green");
    await user.click(screen.getByRole("button", { name: "Registrar golpe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Guardado no disponible",
    );
    expect(
      screen.getByRole("button", { name: "Recentrar en Centro" }),
    ).toBeVisible();
    expect((await repository.snapshot()).shots).toHaveLength(1);
    spy.mockRestore();
  });
  it("salir durante un guardado no devuelve al usuario a la pantalla de juego", async () => {
    const id = await start();
    const user = userEvent.setup();
    open(roundUrl("golpe", id));
    await screen.findByRole("heading", { name: "Golpe 1" });
    await user.click(
      screen.getByRole("button", { name: "Recentrar en Centro" }),
    );
    await clickChoice("Destino", "Hoyo");
    const original = repository.addShot;
    let release: () => void = () => {};
    const spy = vi
      .spyOn(repository, "addShot")
      .mockImplementationOnce(async (...args) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return original(...args);
      });
    await user.click(screen.getByRole("button", { name: "Registrar golpe" }));
    await user.click(screen.getByRole("link", { name: "Salir guardando" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tu juego.",
    );
    release();
    await waitFor(async () =>
      expect((await repository.snapshot()).shots).toHaveLength(1),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tu juego.",
    );
    spy.mockRestore();
  });
  it("recarga una ruta de ronda y permite editar y eliminar un golpe guardado con confirmación", async () => {
    const id = await start();
    let data = await repository.snapshot();
    const hole = data.playedHoles.find((h) => h.numero === 1)!;
    const shot = crypto.randomUUID();
    await repository.addShot(
      shot,
      hole.id,
      {
        tipo: "normal",
        origen: "Tee",
        paloId: data.clubs[0].id,
        diana: classifyTarget(0, 0),
        destino: "Calle",
        penalizacion: 0,
      },
      data.rounds[0].revision,
    );
    const view = open(roundUrl("resumen", id, hole.id));
    await screen.findByRole("link", { name: "Editar golpe 1" });
    view.unmount();
    open(roundUrl("resumen", id, hole.id));
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("link", { name: "Editar golpe 1" }),
    );
    await screen.findByRole("heading", { level: 1, name: "Editar golpe" });
    await clickChoice("Penalización manual", "+2");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("heading", { level: 1, name: "Resumen de hoyo" });
    data = await repository.snapshot();
    expect(data.shots[0].id).toBe(shot);
    expect(data.shots[0].penalizacion).toBe(2);
    await user.click(
      await screen.findByRole("button", { name: "Eliminar golpe 1" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    expect((await repository.snapshot()).shots).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Eliminar golpe 1" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(
      await screen.findByText("Todavía no has registrado golpes en este hoyo."),
    ).toBeVisible();
    expect((await repository.snapshot()).shots).toHaveLength(0);
  });
});

describe("Eliminar ronda desde la interfaz", () => {
  it.each(["history", "detail"])("confirma, cancela y elimina desde %s sin dejar una ruta activa inválida", async (entry) => {
    const id = await start();
    const before = await repository.snapshot();
    const view = open(entry === "history" ? "/rondas" : roundUrl("tarjeta", id));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Eliminar ronda(?: Pinar)?$/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Pinar");
    expect(dialog).toHaveTextContent(new Date(before.rounds[0].inicio).toLocaleDateString("es-ES"));
    expect(dialog).toHaveTextContent("hoyos, golpes, putts y penalizaciones");
    expect(dialog).toHaveTextContent("no se puede deshacer");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(await repository.snapshot()).toEqual(before);
    await user.click(screen.getByRole("button", { name: /^Eliminar ronda(?: Pinar)?$/ }));
    await user.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));
    await screen.findByText("Ronda eliminada definitivamente.");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Rondas");
    await screen.findByText("Todavía no hay rondas");
    view.unmount(); open("/");
    await screen.findByText("El primer tee te espera");
    expect(screen.queryByRole("link", { name: "Continuar ronda" })).not.toBeInTheDocument();
  });
  it("bloquea pulsaciones repetidas y permite reintentar tras un error", async () => {
    await start(); open("/rondas"); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Eliminar ronda(?: Pinar)?$/ }));
    let reject: (error: Error) => void = () => {};
    const spy = vi.spyOn(repository, "deleteRound").mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await user.dblClick(screen.getByRole("button", { name: "Eliminar definitivamente" }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    reject(new Error("No se pudo eliminar la ronda. Vuelve a intentarlo."));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo eliminar la ronda");
    expect((await repository.snapshot()).rounds).toHaveLength(1);
    spy.mockRestore();
    await user.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));
    await screen.findByText("Ronda eliminada definitivamente.");
  });
});

describe("Diana y destinos de golpes normales", () => {
  it.each(["Tee", "Calle", "Rough", "Bunker", "Green", "Agua", "Fuera", "Hoyo", "Otro"] as const)("selecciona y persiste %s sin registrar automáticamente", async (destination) => {
    const id = await start(); open(roundUrl("golpe", id));
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Golpe 1" });
    expect(screen.getByRole("button", { name: "Registrar golpe" })).toBeDisabled();
    expect(screen.getByText("Ajuste preciso").closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Recentrar en Centro" }));
    const field = screen.getByText("Destino").closest("fieldset")!;
    const choices = within(field).getAllByRole("button");
    expect(choices).toHaveLength(9);
    await user.click(within(field).getByRole("button", { name: "Calle" }));
    const selected = within(field).getByRole("button", { name: destination });
    await user.click(selected);
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(choices.filter(button => button.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    expect(selected.querySelector("svg")).not.toBeNull();
    expect((await repository.snapshot()).shots).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Registrar golpe" }));
    if (destination === "Hoyo") {
      await screen.findByRole("heading", { level: 1, name: "Resumen de hoyo" });
      expect(await screen.findByRole("button", { name: "Confirmar hoyo" })).toBeEnabled();
      expect((await repository.snapshot()).playedHoles.find(h => h.numero === 1)!.estado).toBe("en curso");
    } else {
      await screen.findByRole("heading", { name: "Golpe 2" });
      if (destination === "Agua" || destination === "Fuera") {
        expect(screen.getByText(/Selecciona manualmente el siguiente origen/)).toBeVisible();
        expect(screen.getByRole("button", { name: "Registrar golpe" })).toBeDisabled();
      }
    }
    expect((await repository.snapshot()).shots[0]).toMatchObject({ destino: destination, diana: { horizontal: "Centro", vertical: "Distancia correcta" }, penalizacion: 0 });
  });
  it("persiste la selección táctil y recupera ambos ejes y el destino al editar", async () => {
    const id = await start();
    const view = open(roundUrl("golpe", id));
    await screen.findByRole("heading", { name: "Golpe 1" });
    const svg = screen.getByRole("img", { name: "Diana circular interactiva" });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 240, height: 240, right: 240, bottom: 240, x: 0, y: 0, toJSON: () => {} });
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 90 });
    fireEvent.pointerMove(svg, { pointerId: 1, pointerType: "touch", clientX: 170, clientY: 70 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 170, clientY: 70 });
    expect(screen.getByRole("status")).toHaveTextContent("Largo · Derecha");
    await clickChoice("Destino", "Calle");
    await userEvent.click(screen.getByRole("button", { name: "Registrar golpe" }));
    await screen.findByRole("heading", { name: "Golpe 2" });
    const shot = (await repository.snapshot()).shots[0];
    expect(shot).toMatchObject({ diana: { horizontal: "Derecha", vertical: "Largo" } });
    if (shot.tipo !== "normal") throw new Error("Se esperaba golpe normal");
    expect(shot.diana.point!.x).toBeCloseTo(0.5);
    expect(shot.diana.point!.y).toBeCloseTo(0.5);
    view.unmount();
    open(roundUrl("golpe", id, shot.hoyoId, shot.id));
    await screen.findByRole("heading", { level: 1, name: "Editar golpe" });
    expect(screen.getByRole("status")).toHaveTextContent("Largo · Derecha");
    const field = screen.getByText("Destino").closest("fieldset")!;
    expect(within(field).getByRole("button", { name: "Calle" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByText("Ajuste preciso"));
    expect(screen.getByLabelText("Dirección")).toHaveValue("Derecha");
    expect(screen.getByLabelText("Longitud")).toHaveValue("Largo");
    await userEvent.click(screen.getByRole("button", { name: "Recentrar en Centro" }));
    await clickChoice("Destino", "Rough");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("heading", { level: 1, name: "Resumen de hoyo" });
    expect((await repository.snapshot()).shots[0]).toMatchObject({ id: shot.id, destino: "Rough", diana: { horizontal: "Centro", vertical: "Distancia correcta" } });
  });
});
