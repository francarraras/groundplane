// Insertion-stable layout keys (#17).
//
// Node positions and palette slots are derived from a node's id — never its
// index in an array — so adding or removing one node never moves or recolours
// its neighbours. Spatial memory survives graph rebuilds, which is the
// precondition for pinning and for trusting the map as territory.
//
// FNV-1a (32-bit): tiny, fast, dependency-free, and identical across builds.

export function hash32(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Stable fraction in [0, 1) for an id — used for a radial angle.
export function unitFraction(value) {
  return hash32(value) / 0x100000000;
}

// Stable palette slot for an id, independent of array position.
export function paletteIndex(value, length) {
  const size = Math.max(1, Math.trunc(length) || 1);
  return hash32(value) % size;
}
