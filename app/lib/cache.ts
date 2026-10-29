export function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}
