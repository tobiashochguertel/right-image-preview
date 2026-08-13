import { DISPLAY_LAYER_KEEPALIVE_OPACITY } from '../imagePreviewTuning';
import type { UseNeighborDisplayPreloadResult } from '../useNeighborDisplayPreload';

export interface NeighborDisplaySlotPoolProps {
  entries: UseNeighborDisplayPreloadResult['slotRenderEntries'];
  onSlotImgLoad: UseNeighborDisplayPreloadResult['onSlotImgLoad'];
}

/**
 * Fallback offscreen pool (legacy). Prefer {@link DisplayStageLayers} stage retention.
 * Uses 1×1 clip + keep-alive opacity so WebViews do not discard decoded bitmaps.
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
        opacity: DISPLAY_LAYER_KEEPALIVE_OPACITY,
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
