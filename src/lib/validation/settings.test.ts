import { describe, expect, it } from "vitest";
import { isValidTimeZone, orderSettingsSchema, restaurantProfileSchema } from "./settings";

describe("orderSettingsSchema", () => {
  it("accepts the database ranges", () => {
    expect(orderSettingsSchema.parse({ editWindowMins: "0", additionCutoffMins: "240" })).toEqual({
      editWindowMins: 0,
      additionCutoffMins: 240,
    });
  });

  it.each([
    ["31", "20"],
    ["-1", "20"],
    ["5", "241"],
    ["", "20"],
    ["2.5", "20"],
    ["5", "abc"],
  ])("rejects edit window %j with cutoff %j", (editWindowMins, additionCutoffMins) => {
    expect(orderSettingsSchema.safeParse({ editWindowMins, additionCutoffMins }).success).toBe(
      false,
    );
  });
});

describe("restaurantProfileSchema", () => {
  it("accepts a real time zone", () => {
    expect(
      restaurantProfileSchema.parse({ name: "Casa Grande", timezone: "America/Chicago" }).timezone,
    ).toBe("America/Chicago");
  });

  it.each(["Mars/Olympus", "", "America/New York"])("rejects time zone %j", (timezone) => {
    expect(restaurantProfileSchema.safeParse({ name: "Casa", timezone }).success).toBe(false);
  });

  it("recognises zones and rejects junk", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("x".repeat(65))).toBe(false);
  });
});
