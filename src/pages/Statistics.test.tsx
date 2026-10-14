import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { database, repository } from "../persistence/repository";
import { targetFromCategories } from "../domain/target";

beforeEach(async () => {
  await database.delete(); await database.open(); await repository.initialize(); localStorage.clear();
  await repository.saveCourse({nombre:"Campo de prueba",favorito:false,pares:Array(9).fill(4)});
});
function open(path = "/estadisticas") { return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); }
async function finished(extreme = false, distance: "Corto" | "Medio" | "Largo" = "Corto") {
  let data = await repository.snapshot();
  const roundId = crypto.randomUUID();
  await repository.startRound(roundId,data.courses[0].id,9);
  data = await repository.snapshot();
  const driver = data.clubs.find(c=>c.categoria==="Driver")!;
  const putter = data.clubs.find(c=>c.categoria==="Putter")!;
  const holes = data.playedHoles.filter(h=>h.rondaId===roundId).sort((a,b)=>a.numero-b.numero);
  const first = crypto.randomUUID();
  let last = "";
  for (const h of holes) {
    data = await repository.snapshot();
    await repository.addShot(h.numero===1 ? first : crypto.randomUUID(),h.id,{tipo:"normal",origen:"Tee",paloId:driver.id,penalizacion:0,destino:"Green",diana:targetFromCategories(extreme ? "Muy izquierda" : "Centro",extreme ? "Muy corto" : "Distancia correcta")},data.rounds.find(r=>r.id===roundId)!.revision);
    data = await repository.snapshot();
    last = crypto.randomUUID();
    await repository.addShot(last,h.id,{tipo:"putt",origen:"Green",paloId:putter.id,penalizacion:0,distancia:distance,resultado:"Embocado",direccion:null},data.rounds.find(r=>r.id===roundId)!.revision);
    data = await repository.snapshot();
    await repository.confirmHole(h.id,data.rounds.find(r=>r.id===roundId)!.revision);
  }
  data = await repository.snapshot(); await repository.finishRound(roundId,data.rounds.find(r=>r.id===roundId)!.revision);
  return {roundId,driver,first,last};
}
describe("Módulo de estadísticas", () => {
  it("no analiza rondas en curso y recuerda el filtro incluso sin datos", async () => {
    const data = await repository.snapshot(); await repository.startRound(crypto.randomUUID(),data.courses[0].id,9);
    const view = open(); await screen.findByText("Sin rondas finalizadas");
    await userEvent.selectOptions(screen.getByLabelText("Rondas analizadas"),"5");
    expect(localStorage.getItem("golf-tracker-statistics-filter")).toBe("5");
    view.unmount(); open(); expect(screen.getByLabelText("Rondas analizadas")).toHaveValue("5");
  });
  it("aplica el filtro a secciones, detalle histórico y putting", async () => {
    await finished(); const latest = await finished(true);
    await repository.saveClub({id:latest.driver.id,nombre:"Driver renombrado",categoria:"Driver",activo:false});
    const view = open(); await screen.findByText("2 rondas · 18 hoyos analizados");
    await userEvent.selectOptions(screen.getByLabelText("Rondas analizadas"),"1");
    expect(screen.getByText("1 rondas · 9 hoyos analizados")).toBeVisible();
    await userEvent.click(screen.getByRole("tab",{name:"Salidas"}));
    expect(screen.getByText("Salidas analizadas").closest("div")).toHaveTextContent("9");
    await userEvent.click(screen.getByRole("tab",{name:"Putting"}));
    expect(screen.getByText("Total de putts").closest("div")).toHaveTextContent("9");
    await userEvent.click(screen.getByRole("tab",{name:"Palos"}));
    const driver = screen.getByRole("link",{name:/Driver.*Ver detalle/});
    expect(driver).toHaveTextContent("Índice de Precisión: 20.0");
    await userEvent.click(driver);
    expect(screen.getByText("Índice de Precisión: 20.0")).toBeVisible();
    expect(screen.getByText(/Nombre actual: Driver renombrado/)).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText("Rondas analizadas"),"all");
    expect(screen.getByText("Índice de Precisión: 60.0")).toBeVisible();
    expect(screen.getByRole("table")).toHaveAccessibleName("Distribución por ambos ejes");
    const oldView = view; oldView.unmount();
    open(`/estadisticas?seccion=Palos&palo=${latest.driver.id}`);
    expect(await screen.findByText("Índice de Precisión: 60.0")).toBeVisible();
    await userEvent.click(screen.getByRole("link",{name:"← Volver a palos"}));
    await userEvent.click(screen.getByRole("link",{name:/Putter.*Ver detalle/}));
    expect(screen.queryByText(/Índice de Precisión:/)).not.toBeInTheDocument();
    expect(screen.getByText("Total de putts").closest("div")).toHaveTextContent("18");
    expect(within(screen.getByRole("tabpanel")).getByText("Putting")).toBeVisible();
  });
  it("actualiza datos al editar una ronda finalizada y la excluye al reabrirla", async () => {
    const result = await finished(); open("/estadisticas?seccion=Palos");
    await screen.findByText("1 rondas · 9 hoyos analizados");
    await userEvent.click(screen.getByRole("link",{name:/Driver.*Ver detalle/}));
    let data = await repository.snapshot();
    await repository.editShot(result.first,{tipo:"normal",origen:"Tee",paloId:result.driver.id,penalizacion:2,destino:"Agua",diana:targetFromCategories("Muy izquierda","Muy corto")},data.rounds.find(r=>r.id===result.roundId)!.revision);
    await waitFor(()=>expect(screen.getByText("Índice de Precisión: 91.1")).toBeVisible());
    expect(screen.getByText("Penalizaciones asociadas: 2 golpes")).toBeVisible();
    data = await repository.snapshot();
    await repository.deleteShot(result.last,data.rounds.find(r=>r.id===result.roundId)!.revision);
    await screen.findByText("Sin rondas finalizadas");
    expect(screen.getByText("Índice de Precisión: —")).toBeVisible();
  });
});

it("recalcula las estadísticas cuando se elimina una ronda", async () => {
  const result = await finished(); open();
  await screen.findByText("1 rondas · 9 hoyos analizados");
  const data = await repository.snapshot();
  await repository.deleteRound(result.roundId, data.rounds[0].revision);
  await screen.findByText("Sin rondas finalizadas");
  expect(screen.queryByText("1 rondas · 9 hoyos analizados")).not.toBeInTheDocument();
});

it("actualiza abanico y vuelos con el filtro global y conserva destinos", async () => {
  await finished(); await finished(true); open("/estadisticas?seccion=Salidas");
  await screen.findByText("2 rondas · 18 hoyos analizados");
  const direction = screen.getByRole("region", { name: "Dirección de las salidas" });
  const distance = screen.getByRole("region", { name: "Longitud de las salidas" });
  await userEvent.click(within(direction).getByText("Desglose por categoría"));
  await userEvent.click(within(distance).getByText("Desglose por categoría"));
  expect(within(direction).getByRole("button", { name: /Muy izquierda/ })).toHaveTextContent("50 %");
  expect(within(distance).getByRole("button", { name: /Muy corto/ })).toHaveTextContent("9 golpes · 9/18");
  expect(screen.getByRole("heading", { name: "Destinos de salida" })).toBeVisible();
  expect(direction.querySelector(".stats-track")).toBeNull();
  expect(distance.querySelector(".stats-track")).toBeNull();
  await userEvent.click(within(direction).getByRole("button", { name: /Muy izquierda/ }));
  await userEvent.selectOptions(screen.getByLabelText("Rondas analizadas"), "1");
  expect(within(direction).getByRole("status")).toHaveTextContent("Muy izquierda: 100 % · 9 golpes (9/9)");
  expect(within(distance).getByRole("button", { name: /Muy corto/ })).toHaveTextContent("100 %");
  expect(within(direction).getByText(/Muestra pequeña/)).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Rondas analizadas"), "all");
  expect(within(direction).getByRole("status")).toHaveTextContent("50 % · 9 golpes (9/18)");
});

it("actualiza los greens y las barras con el filtro global sin cambiar el detalle del putter", async () => {
  await finished(false, "Corto"); await finished(false, "Medio");
  open("/estadisticas?seccion=Putting");
  await screen.findByText("2 rondas · 18 hoyos analizados");
  const results = screen.getByRole("region", { name: "Resultados por distancia inicial" });
  const short = within(results).getByRole("article", { name: "Resumen Corto" });
  const medium = within(results).getByRole("article", { name: "Resumen Medio" });
  expect(short).toHaveTextContent("9 putts analizados");
  expect(medium).toHaveTextContent("Embocados · 9/9");
  expect(screen.getByRole("heading", { name: "Dirección de los fallos" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Resultado de distancia" })).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Rondas analizadas"), "1");
  expect(short).toHaveTextContent("Sin datos");
  expect(medium).toHaveTextContent("100.0 %");
  expect(within(results).getByRole("region", { name: /^Corto / }).querySelector(".putting-stacked-bar")).toBeNull();
  await userEvent.selectOptions(screen.getByLabelText("Rondas analizadas"), "all");
  expect(short).toHaveTextContent("Embocados · 9/9");
  await userEvent.click(screen.getByRole("tab", { name: "Palos" }));
  await userEvent.click(screen.getByRole("link", { name: /Putter.*Ver detalle/ }));
  expect(screen.queryByRole("article", { name: "Resumen Corto" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Embocados o red zone")).toHaveLength(3);
});

it("comparte geometría entre Tee y Palos y cambia datos al seleccionar otro palo", async () => {
  await finished(); open("/estadisticas?seccion=Salidas");
  await screen.findByText("1 rondas · 9 hoyos analizados");
  function geometry(title: string) {
    const region = screen.getByRole("region", { name: title });
    return Array.from(region.querySelectorAll(".dispersion-trail-line")).map(path => path.getAttribute("d"));
  }
  const teeDirection = geometry("Dirección de las salidas");
  const teeDistance = geometry("Longitud de las salidas");
  await userEvent.click(screen.getByRole("tab", { name: "Palos" }));
  await userEvent.click(screen.getByRole("link", { name: /Driver.*Ver detalle/ }));
  expect(geometry("Dirección del palo")).toEqual(teeDirection);
  expect(geometry("Longitud del palo")).toEqual(teeDistance);
  const direction = screen.getByRole("region", { name: "Dirección del palo" });
  expect(direction.querySelector(".stats-track")).toBeNull();
  expect(direction.querySelector(".is-predominant")).toHaveAttribute("data-category", "Centro");
  await userEvent.click(within(direction).getByText("Desglose por categoría"));
  await userEvent.click(within(direction).getByRole("button", { name: /Centro/ }));
  expect(within(direction).getByRole("status")).toHaveTextContent("100 % · 9 golpes (9/9)");
  await userEvent.click(screen.getByRole("link", { name: "← Volver a palos" }));
  await userEvent.click(screen.getByRole("link", { name: /Hierro 5.*Ver detalle/ }));
  const empty = screen.getByRole("region", { name: "Dirección del palo" });
  expect(empty.querySelectorAll(".has-shots")).toHaveLength(0);
  expect(within(empty).getByText("Sin golpes con diana válida en esta selección.")).toBeVisible();
  expect(within(empty).getByRole("status")).not.toHaveTextContent("Centro:");
  expect(screen.getByText("Índice de Precisión: —")).toBeVisible();
});
