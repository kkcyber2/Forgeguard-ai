import { createHash } from "crypto";

export function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
