import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fraction, type putting } from "../domain/statistics";
import PuttingDistanceResults from "./PuttingDistanceResults";

function rows(samples: [number, number, number][]): ReturnType<typeof putting>["byDistance"] {
  return ["Corto", "Medio", "Largo"].map((distance, index) => {
    const [total, holed, red] = samples[index];
    return { distance, holed: fraction(holed, total), red: fraction(red, total), combined: fraction(holed + red, total) };
  });
}
describe("Resultados visuales de putting por distancia", () => {
  it("distingue 0 %, 100 % y Sin datos, sin confundir red zone con embocado", () => {
    render(<PuttingDistanceResults rows={rows([[4, 0, 2], [12, 12, 0], [0, 0, 0]])} />);
    const short = screen.getByRole("article", { name: "Resumen Corto" });
    const medium = screen.getByRole("article", { name: "Resumen Medio" });
    const long = screen.getByRole("article", { name: "Resumen Largo" });
    expect(within(short).getByText("0.0 %")).toBeVisible();
    expect(short).toHaveTextContent("Embocados · 0/4");
    expect(short).toHaveTextContent("Embocados + Red zone 50.0 %");
    expect(short).toHaveTextContent("4 putts analizados");
    expect(short.querySelector(".putting-ring-value")).toHaveAttribute("stroke-dasharray", "0 100");
    expect(medium.querySelector(".putting-ring-value")).toHaveAttribute("stroke-dasharray", "100 0");
    expect(long).toHaveTextContent("Sin datos");
    expect(long).not.toHaveTextContent("0.0 %");
    expect(long.querySelector(".putting-ring-value")).toBeNull();
    expect(within(screen.getByRole("region", { name: /^Largo / })).getByText("Sin datos")).toBeVisible();
    const shortBar = screen.getByRole("region", { name: /^Corto / });
    expect(shortBar).toHaveTextContent("Embocados0.0 %0/4 putts");
    expect(shortBar).toHaveTextContent("Red zone50.0 %2/4 putts");
    expect(shortBar).toHaveTextContent("Otros resultados50.0 %2/4 putts");
    expect(shortBar.querySelector(".holed")).toHaveStyle({ width: "0%" });
    expect(shortBar.querySelector(".red-zone")).toHaveStyle({ width: "50%" });
    expect(shortBar.querySelector(".other")).toHaveStyle({ width: "50%" });
    expect(screen.getAllByText(/Muestra pequeña/)).toHaveLength(1);
    expect(screen.getByText(/Muestra pequeña/)).toHaveTextContent("Corto");
    expect(screen.getByText(/Muestra pequeña/)).not.toHaveTextContent("Medio");
  });
  it("mantiene la precisión completa de los segmentos y redondea solo etiquetas", () => {
    render(<PuttingDistanceResults rows={rows([[3, 1, 1], [10, 0, 10], [20, 5, 5]])} />);
    const shortBar = screen.getByRole("region", { name: /^Corto / });
    const segments = Array.from(shortBar.querySelectorAll<HTMLElement>(".putting-segment"));
    expect(segments).toHaveLength(3);
    segments.forEach(segment => expect(parseFloat(segment.style.width)).toBeCloseTo(100 / 3, 12));
    expect(segments.reduce((sum, segment) => sum + parseFloat(segment.style.width), 0)).toBeCloseTo(100, 12);
    expect(within(shortBar).getAllByText("33.3 %")).toHaveLength(3);
    const medium = screen.getByRole("article", { name: "Resumen Medio" });
    expect(medium).toHaveTextContent("Embocados · 0/10");
    expect(medium).toHaveTextContent("Embocados + Red zone 100.0 %");
    expect(screen.getAllByText(/Muestra pequeña/)).toHaveLength(1);
  });
  it("actualiza datos reactivos y utiliza SVG escalables sin controles decorativos", () => {
    const view = render(<PuttingDistanceResults rows={rows([[0, 0, 0], [0, 0, 0], [0, 0, 0]])} />);
    expect(screen.queryByText(/Muestra pequeña/)).not.toBeInTheDocument();
    expect(view.container.querySelectorAll(".putting-stacked-bar")).toHaveLength(0);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    screen.getAllByRole("img").forEach(svg => {
      expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
      expect(svg).not.toHaveAttribute("width");
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.rerender(<PuttingDistanceResults rows={rows([[10, 2, 3], [10, 1, 4], [10, 0, 5]])} />);
    expect(screen.getByRole("article", { name: "Resumen Corto" })).toHaveTextContent("Embocados + Red zone 50.0 %");
    expect(screen.queryByText("Sin datos")).not.toBeInTheDocument();
    expect(screen.queryByText(/Muestra pequeña/)).not.toBeInTheDocument();
    expect(view.container.querySelectorAll(".putting-stacked-bar")).toHaveLength(3);
  });
});
