import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ShotTarget from "./ShotTarget";
import type { TargetSelection } from "../domain/target";
function Harness() {
  const [value, setValue] = useState<TargetSelection | null>(null);
  return <ShotTarget value={value} onChange={setValue} />;
}
function target() {
  const svg = screen.getByRole("img", { name: "Diana circular interactiva" });
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 220,
    height: 220,
    right: 220,
    bottom: 220,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  Object.assign(svg, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
  });
  return svg;
}
describe("Diana circular interactiva", () => {
  it("muestra tres zonas de color diferenciadas con leyenda", () => {
    render(<Harness />);
    const svg = screen.getByRole("img");
    expect(svg.querySelector('[aria-label="Zona central"]')).toHaveAttribute("fill", "#258654");
    expect(svg.querySelector('[aria-label="Desviación media"]')).toHaveAttribute("fill", "#E7B65C");
    expect(svg.querySelector('[aria-label="Desviación grande"]')).toHaveAttribute("fill", "#C97862");
    expect(screen.getByText(/Anillos de referencia visual/)).toBeVisible();
  });
  it("no asigna Centro inicialmente y permite seleccionar explícitamente con controles accesibles", async () => {
    render(<Harness />);
    expect(screen.getByRole("status")).toHaveTextContent("Sin selección");
    const precise = screen.getByText("Ajuste preciso");
    expect(precise.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(precise);
    expect(precise.closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText("Dirección")).toHaveValue("");
    await userEvent.selectOptions(
      screen.getByLabelText("Dirección"),
      "Muy derecha",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Sin selección");
    await userEvent.selectOptions(
      screen.getByLabelText("Longitud"),
      "Muy corto",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Muy corto · Muy derecha",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Recentrar en Centro" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/^Centro$/);
  });
  it("selecciona por toque y arrastra con captura de puntero, limitando el punto", () => {
    render(<Harness />);
    const svg = target();
    expect(svg.style.touchAction).toBe("none");
    fireEvent.pointerDown(svg, {
      pointerId: 1,
      button: 0,
      clientX: 150,
      clientY: 70,
      isPrimary: true,
      pointerType: "touch",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Largo · Derecha");
    expect(svg.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(svg, {
      pointerId: 1,
      clientX: 400,
      clientY: 400,
      pointerType: "touch",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Muy corto · Muy derecha",
    );
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 110, clientY: 110 });
    expect(screen.getByRole("status")).toHaveTextContent(/^Centro$/);
    expect(svg.releasePointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 20, clientY: 20 });
    expect(screen.getByRole("status")).toHaveTextContent(/^Centro$/);
  });
  it("ignora otros punteros y cancela correctamente el arrastre", () => {
    render(<Harness />);
    const svg = target();
    fireEvent.pointerDown(svg, {
      pointerId: 3,
      button: 0,
      isPrimary: true,
      clientX: 110,
      clientY: 110,
    });
    fireEvent.pointerMove(svg, { pointerId: 8, clientX: 20, clientY: 20 });
    expect(screen.getByRole("status")).toHaveTextContent(/^Centro$/);
    fireEvent.pointerCancel(svg, { pointerId: 3 });
    fireEvent.pointerMove(svg, { pointerId: 3, clientX: 20, clientY: 20 });
    expect(screen.getByRole("status")).toHaveTextContent(/^Centro$/);
  });
});

it("el panel nativo es enfocable y sus selectores permiten el ajuste por teclado", async () => {
  render(<Harness />);
  const user = userEvent.setup();
  const summary = screen.getByText("Ajuste preciso");
  summary.focus();
  expect(summary).toHaveFocus();
  // jsdom does not implement the native summary keyboard activation.
  await user.click(summary);
  expect(summary.closest("details")).toHaveAttribute("open");
  await user.tab();
  expect(screen.getByLabelText("Dirección")).toHaveFocus();
  await user.selectOptions(screen.getByLabelText("Dirección"), "Izquierda");
  expect(screen.getByRole("status")).toHaveTextContent("Sin selección");
  await user.tab();
  expect(screen.getByLabelText("Longitud")).toHaveFocus();
  await user.selectOptions(screen.getByLabelText("Longitud"), "Muy largo");
  expect(screen.getByRole("status")).toHaveTextContent("Muy largo · Izquierda");
  summary.focus();
  await user.click(summary);
  expect(summary.closest("details")).not.toHaveAttribute("open");
  expect(screen.getByRole("status")).toHaveTextContent("Muy largo · Izquierda");
});
