import { describe, expect, it } from "vitest";
import { tableUrl } from "./table-url";

describe("tableUrl", () => {
  it("joins the site URL and token without doubling slashes", () => {
    expect(tableUrl("http://localhost:3000", "abc123")).toBe("http://localhost:3000/t/abc123");
    expect(tableUrl("https://salu.app/", "abc123")).toBe("https://salu.app/t/abc123");
  });
});
