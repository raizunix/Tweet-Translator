export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function calculatePosition(
  source: Box,
  overlay: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 10
) {
  const right = source.left + source.width + gap;
  const left = source.left - overlay.width - gap;
  const x = right + overlay.width <= viewport.width ? right : Math.max(gap, left);
  const y = Math.min(
    Math.max(gap, source.top),
    Math.max(gap, viewport.height - overlay.height - gap)
  );
  return { left: x, top: y };
}
