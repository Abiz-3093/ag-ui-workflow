/**
 * Tiny UUID helper.
 *
 * Why this exists:
 * - Some AG-UI examples use helper exports from SDKs.
 * - Different runtimes/bundlers may not expose those helpers consistently.
 *
 * We prefer the built-in Web Crypto API when available.
 */
export function uuid(): string {
  // Browser + modern Node
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();

  // Fallback: RFC4122-ish (not cryptographically strong)
  const rnd = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${rnd().slice(0, 8)}-${rnd().slice(0, 4)}-${rnd().slice(0, 4)}-${rnd().slice(0, 4)}-${rnd()}`;
}
