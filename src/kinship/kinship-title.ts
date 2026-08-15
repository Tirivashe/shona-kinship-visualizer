/**
 * Builds the user-facing title without discarding the resolver's distinction
 * between a principal term and its alternatives.
 */
export function formatKinshipTitle(
  principalTitle: string,
  aliases: readonly string[] = [],
): string {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const value of [principalTitle, ...aliases]) {
    for (const part of value.split("/")) {
      const term = part.trim();
      if (!term || seen.has(term)) continue;
      seen.add(term);
      terms.push(term);
    }
  }

  return terms.join(" / ");
}
