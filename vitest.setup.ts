import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest runs without globals, so Testing Library can't register its own cleanup.
afterEach(() => cleanup());

// next/font only works inside the Next compiler; in tests each font the app loads is a no-op.
vi.mock("next/font/google", () => {
  const font = () => ({ className: "", variable: "", style: {} });
  return { Montserrat: font, Ms_Madi: font };
});
