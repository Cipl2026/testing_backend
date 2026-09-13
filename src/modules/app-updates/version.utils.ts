export function parseSemver(version: string): [number, number, number] {
  const cleaned = version.trim().replace(/^v/i, '');
  const parts = cleaned.split('.').map((part) => Number.parseInt(part, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a);
  const [bMajor, bMinor, bPatch] = parseSemver(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

export function isVersionBelow(current: string, minimum: string): boolean {
  return compareSemver(current, minimum) < 0;
}
