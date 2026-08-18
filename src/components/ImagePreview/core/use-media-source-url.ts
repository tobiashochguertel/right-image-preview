import { useEffect, useState } from 'react';

import { createMediaSourceUrlLease, type MediaSource } from './media-source';

/** Produces a DOM-safe URL and owns object-URL cleanup for Blob/bytes inputs. */
export function useMediaSourceUrl(source: MediaSource): string {
  const [leased, setLeased] = useState<{ source: MediaSource; href: string } | null>(null);
  useEffect(() => {
    if (source.type === 'url') return undefined;
    const lease = createMediaSourceUrlLease(source);
    // Resource acquisition belongs to this effect; the guarded render value below never
    // exposes the previous source while React commits the new lease.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeased({ source, href: lease.href });
    return () => lease.dispose();
  }, [source]);
  if (source.type === 'url') return source.href;
  return leased?.source === source ? leased.href : '';
}
