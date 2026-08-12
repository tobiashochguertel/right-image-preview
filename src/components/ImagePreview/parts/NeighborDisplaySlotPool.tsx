import type { UseNeighborDisplayPreloadResult } from '../useNeighborDisplayPreload';

export interface NeighborDisplaySlotPoolProps {
  entries: UseNeighborDisplayPreloadResult['slotRenderEntries'];
  onSlotImgLoad: UseNeighborDisplayPreloadResult['onSlotImgLoad'];
}

/**
 * Offscreen full-size imgs kept decoded for display-ready neighbor preload (approach C).
 * Visually hidden; still in the document so decode/compositor can retain bitmaps.
 */
export function NeighborDisplaySlotPool({
  entries,
  onSlotImgLoad,
}: NeighborDisplaySlotPoolProps) {
  if (entries.length === 0) return null;

  return (
    <div
      aria-hidden
      data-rip-display-slots=""
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      {entries.map(({ index, src }) => (
        <img
          key={`${index}:${src}`}
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          onLoad={(e) => onSlotImgLoad(index, e.currentTarget)}
          style={{ display: 'block', maxWidth: 'none' }}
        />
      ))}
    </div>
  );
}
