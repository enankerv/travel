export const BOARD_WORLD_W = 4000
export const BOARD_WORLD_H = 3000

export type BoardCamera = { x: number; y: number; scale: number }

export function screenToBoardNorm(
  viewport: HTMLElement,
  camera: BoardCamera,
  clientX: number,
  clientY: number,
): { wx: number; wy: number } | null {
  const r = viewport.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0 || camera.scale <= 0) return null
  const sx = clientX - r.left
  const sy = clientY - r.top
  const worldX = (sx - camera.x) / camera.scale
  const worldY = (sy - camera.y) / camera.scale
  return {
    wx: worldX / BOARD_WORLD_W,
    wy: worldY / BOARD_WORLD_H,
  }
}
