import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import DestinationChoices from "./DestinationChoices";
import type { Destination } from "../domain/rounds";

function Harness() {
  const [value, setValue] = useState<Destination | "">("");
  return <DestinationChoices value={value} onChange={setValue} />;
}
it("permite seleccionar exclusivamente un destino por teclado", async () => {
  render(<Harness />);
  const user = userEvent.setup();
  const tee = screen.getByRole("button", { name: "Tee" });
  const fairway = screen.getByRole("button", { name: "Calle" });
  await user.tab();
  expect(tee).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(tee).toHaveAttribute("aria-pressed", "true");
  await user.tab();
  expect(fairway).toHaveFocus();
  await user.keyboard(" ");
  expect(fairway).toHaveAttribute("aria-pressed", "true");
  expect(tee).toHaveAttribute("aria-pressed", "false");
  expect(fairway.querySelector(".destination-check")).not.toBeNull();
});
