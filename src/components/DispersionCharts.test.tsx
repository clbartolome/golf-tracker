import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DirectionDispersion from "./DirectionDispersion";
import DistanceTrajectories from "./DistanceTrajectories";
import type { DistributionData } from "./DispersionChart";
import { horizontalZones, verticalZones } from "../domain/target";

const charts = [
  { Component: DirectionDispersion, title: "Dirección de las salidas", labels: horizontalZones, height: 280 },
  { Component: DistanceTrajectories, title: "Longitud de las salidas", labels: verticalZones, height: 275 },
];
function data(labels: readonly string[], counts: number[]): DistributionData {
  const denominator = counts.reduce((sum, count) => sum + count, 0);
  return labels.map((label, index) => ({ label, numerator: counts[index], denominator, percentage: denominator ? counts[index] / denominator * 100 : null }));
}
describe.each(charts)("$title", ({ Component, title, labels, height }) => {
  it("muestra las cinco categorías con sus cantidades y porcentajes reales", async () => {
    const items = data(labels, [1, 2, 3, 4, 10]);
    render(<Component items={items} />);
    expect(screen.getByText("Muestra: 20 golpes.")).toBeVisible();
    await userEvent.click(screen.getByText("Desglose por categoría"));
    const legend = screen.getByRole("list", { name: `Categorías: ${title}` });
    expect(within(legend).getAllByRole("button")).toHaveLength(5);
    items.forEach(item => {
      const button = within(legend).getByRole("button", { name: new RegExp(item.label) });
      expect(button).toHaveTextContent(`${item.percentage!.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`);
      expect(button).toHaveTextContent(`${item.numerator} golpes · ${item.numerator}/20`);
    });
    const svg = screen.getByRole("img", { name: title });
    expect(svg).toHaveAttribute("viewBox", `0 0 400 ${height}`);
    expect(svg).not.toHaveAttribute("width");
    expect(svg.querySelectorAll(".dispersion-trail")).toHaveLength(5);
    const widths = Array.from(svg.querySelectorAll(".dispersion-trail-line")).map(path => Number(path.getAttribute("stroke-width")));
    expect(widths[0]).toBeLessThan(widths[4]);
    expect(svg.querySelectorAll(".is-predominant")).toHaveLength(1);
  });
  it("distingue 0 %, 100 % y falta de muestra sin inventar porcentajes", async () => {
    const view = render(<Component items={data(labels, [0, 0, 9, 0, 0])} />);
    expect(screen.getByText(/Muestra pequeña/)).toBeVisible();
    await userEvent.click(screen.getByText("Desglose por categoría"));
    expect(screen.getAllByText("0 %")).toHaveLength(4);
    expect(within(screen.getByRole("list")).getByText("100 %")).toBeVisible();
    const svg = screen.getByRole("img", { name: title });
    expect(svg.querySelectorAll(".has-shots")).toHaveLength(1);
    expect(svg.querySelectorAll(".is-guide")).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(labels[0]) }));
    expect(screen.getByRole("status")).toHaveTextContent(`${labels[0]}: 0 % · 0 golpes (0/9)`);
    view.rerender(<Component items={data(labels, [0, 0, 0, 0, 0])} />);
    expect(screen.getByText("Sin golpes con diana válida en esta selección.")).toBeVisible();
    expect(screen.queryByText("0 %")).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(5);
    expect(svg.querySelectorAll(".has-shots")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(`${labels[0]}: — · 0 golpes (0/0)`);
  });
  it("selecciona con el dedo, ratón y teclado, y refleja nuevos datos", async () => {
    const view = render(<Component items={data(labels, [2, 2, 2, 2, 2])} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Desglose por categoría"));
    const svg = screen.getByRole("img", { name: title });
    const hit = svg.querySelectorAll(".dispersion-trail-hit")[1];
    fireEvent.pointerDown(hit, { pointerId: 1, pointerType: "touch", button: 0, isPrimary: true });
    expect(screen.getByRole("status")).toHaveTextContent(`${labels[1]}: 20 % · 2 golpes (2/10)`);
    fireEvent.click(svg.querySelectorAll(".dispersion-trail-hit")[4]);
    expect(screen.getByRole("status")).toHaveTextContent(labels[4]);
    await user.tab();
    const first = screen.getByRole("button", { name: new RegExp(labels[0]) });
    expect(first).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-pressed", "true");
    await user.tab(); await user.keyboard(" ");
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(labels[1]);
    view.rerender(<Component items={data(labels, [0, 7, 0, 0, 0])} />);
    expect(screen.getByRole("status")).toHaveTextContent(`${labels[1]}: 100 % · 7 golpes (7/7)`);
    expect(svg.querySelector(`[data-category="${labels[1]}"]`)).toHaveClass("is-selected", "is-predominant");
  });
});
it("ordena los cinco alcances ilustrativos de menor a mayor", () => {
  render(<DistanceTrajectories items={data(verticalZones, [1, 1, 1, 1, 1])} />);
  const svg = screen.getByRole("img");
  const ends = Array.from(svg.querySelectorAll(".dispersion-trail-end")).map(end => Number(end.getAttribute("cx")));
  expect(ends).toEqual([90, 140, 275, 325, 372]);
});

describe.each(charts)("Distribuciones y énfasis de $title", ({ Component, labels }) => {
  it.each([
    { counts: [0, 1, 6, 1, 0], active: 3, winners: [2] },
    { counts: [0, 0, 8, 0, 0], active: 1, winners: [2] },
    { counts: [0, 0, 0, 0, 8], active: 1, winners: [4] },
    { counts: [1, 1, 1, 1, 1], active: 5, winners: [0, 1, 2, 3, 4] },
    { counts: [0, 0, 0, 0, 0], active: 0, winners: [] },
  ])("destaca la frecuencia real de $counts", ({ counts, active, winners }) => {
    render(<Component items={data(labels, counts)} />);
    const svg = screen.getByRole("img");
    expect(svg.querySelectorAll(".has-shots")).toHaveLength(active);
    expect(svg.querySelectorAll(".is-guide")).toHaveLength(5 - active);
    expect(Array.from(svg.querySelectorAll(".is-predominant")).map(node => node.getAttribute("data-category"))).toEqual(winners.map(i => labels[i]));
    expect(svg.querySelectorAll(".dispersion-trail-glow")).toHaveLength(active);
    expect(svg.querySelectorAll(".dispersion-trail-hit")).toHaveLength(5);
    svg.querySelectorAll(".dispersion-trail-hit").forEach(path => {
      expect(path).toHaveAttribute("stroke-width", "44");
      expect(path).toHaveAttribute("vector-effect", "non-scaling-stroke");
    });
    svg.querySelectorAll(".dispersion-trail-line").forEach(path => expect(path.getAttribute("d")).toContain(" C "));
    expect(screen.getByText("Desglose por categoría").closest("details")).not.toHaveAttribute("open");
  });
  it("coloca 75 % y 12,5 % junto a las trayectorias, sin etiquetas de 0 %", () => {
    const view = render(<Component items={data(labels, [0, 1, 6, 1, 0])} />);
    const percentages = view.container.querySelectorAll(".dispersion-percentage");
    expect(Array.from(percentages).map(node => node.textContent)).toEqual(["12,5 %", "75 %", "12,5 %"]);
    expect(view.container.querySelector(".dispersion-percentage.is-predominant")).toHaveTextContent("75 %");
  });
});
