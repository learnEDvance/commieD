export function bulletTrailVector(vx, vy, length = 10) {
  const speed = Math.hypot(vx, vy) || 1;
  return {
    x: (vx / speed) * length,
    y: (vy / speed) * length,
  };
}
