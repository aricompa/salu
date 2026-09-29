import { assertSafePublicEnvNames, publicEnv } from "@/lib/env";

// Runs once when the server boots: fail loudly on missing or unsafe env.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertSafePublicEnvNames(process.env);
    publicEnv();
  }
}
