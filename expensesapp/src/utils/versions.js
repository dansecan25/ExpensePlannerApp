const versionParts = version =>
  String(version)
    .trim()
    .replace(/^v/i, "")
    .split(/[+-]/)[0]
    .split(".")
    .slice(0, 3)
    .map(part => Number.parseInt(part, 10) || 0);

/**
 * Compares release versions such as "1.0.1" or "v1.2.0". Positive when `left` is newer,
 * negative when older, 0 when equal. Missing parts count as 0, so "1.0" equals "1.0.0".
 */
export const compareVersions = (left, right) => {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};
