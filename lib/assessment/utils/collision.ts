import type { CollisionDetection } from '@dnd-kit/core';

// Picks the droppable whose rect contains the cursor.
// When multiple droppables overlap at the cursor point, picks the one whose
// center is closest to the cursor — so the pin directly under the cursor always wins.
export const cursorCollision: CollisionDetection = ({
  droppableContainers,
  droppableRects,
  pointerCoordinates,
}) => {
  if (!pointerCoordinates) return [];

  let best: (typeof droppableContainers)[0] | null = null;
  let bestDist = Infinity;

  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const { left, top, width, height } = rect;
    if (
      pointerCoordinates.x >= left &&
      pointerCoordinates.x <= left + width &&
      pointerCoordinates.y >= top &&
      pointerCoordinates.y <= top + height
    ) {
      const dist = Math.hypot(
        pointerCoordinates.x - (left + width / 2),
        pointerCoordinates.y - (top + height / 2),
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = container;
      }
    }
  }

  if (!best) return [];
  return [{ id: best.id, data: { droppableContainer: best, value: bestDist } }];
};
