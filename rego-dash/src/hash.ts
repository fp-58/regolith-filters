import { crypto } from "@std/crypto/crypto";
import { encodeHex } from "@std/encoding/hex";
import { HASH_ALGORITHM } from "./constants.ts";

export async function hashFile(path: string): Promise<string> {
  const { readable } = await Deno.open(path);
  const hashBytes = await crypto.subtle.digest(HASH_ALGORITHM, readable);
  return encodeHex(hashBytes);
}
