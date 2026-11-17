import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  lockScroll?: boolean;
}

/**
 * Portal component renders children directly into document.body,
 * ensuring modals, overlays, and drawers break out of layout stacking contexts
 * (such as scrollable main, sidebar, navbar) and cover the full viewport.
 */
export const Portal: React.FC<PortalProps> = ({ children, lockScroll = true }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (lockScroll) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [lockScroll]);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
};

export default Portal;
