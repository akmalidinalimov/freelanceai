/**
 * Central brand identity. The Gigora rebrand (docs/rebrand-gigora.md) flips these via
 * env at build time — code should reference BRAND, never hardcode the name.
 *
 * NEXT_PUBLIC_* so client components may import it too (inlined at build).
 * No `server-only`: safe constants, needed by emails, metadata, and UI alike.
 */
// `||` (not `??`): an unset CI build-var arrives as an empty string, which `??`
// would NOT replace — blanking the brand. `||` falls back on empty too.
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "Gigora";
export const BRAND_DOMAIN = process.env.NEXT_PUBLIC_BRAND_DOMAIN || "gigora.ai";
export const BRAND_ORIGIN = `https://${BRAND_DOMAIN}`;
