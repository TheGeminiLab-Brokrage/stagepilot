function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function maxErrors(len: number): number {
  if (len <= 3)  return 0;
  if (len <= 6)  return 1;
  if (len <= 12) return 2;
  return 3;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function fuzzyMatch(given: string, expected: string): boolean {
  const g = norm(given);
  const e = norm(expected);
  if (g === e) return true;
  return levenshtein(g, e) <= maxErrors(e.length);
}
