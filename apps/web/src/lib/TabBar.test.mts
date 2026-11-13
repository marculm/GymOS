import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import TabBar from "./TabBar.svelte";

describe("TabBar", () => {
  it("renders the three top-level destinations", () => {
    render(TabBar, { pathname: "/gym" });

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/gym",
      "/nutrition",
      "/extractor",
    ]);
  });

  it("marks the active destination from the pathname", () => {
    render(TabBar, { pathname: "/nutrition" });

    expect(screen.getByRole("link", { name: /nutrition/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /^gym$/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps a nested path on its top-level tab", () => {
    render(TabBar, { pathname: "/nutrition/recipes/1" });

    expect(screen.getByRole("link", { name: /nutrition/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
