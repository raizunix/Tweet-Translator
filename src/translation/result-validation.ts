export function normalizeComparableText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/⟦\s*TT\s*(\d+)\s*⟧/giu, "⟦TT$1⟧")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function hasIntactProtectedMarkers(source: string, translated: string): boolean {
  const markers = [...source.matchAll(/⟦\s*TT\s*(\d+)\s*⟧/giu)].map((match) => match[1]);
  if (!markers.length) return true;
  const translatedMarkers = [...translated.matchAll(/⟦\s*TT\s*(\d+)\s*⟧/giu)].map(
    (match) => match[1]
  );
  return (
    markers.length === translatedMarkers.length &&
    markers.every(
      (marker) => translatedMarkers.filter((candidate) => candidate === marker).length === 1
    )
  );
}
