import { useEffect, useRef, useState } from 'react';

interface UseAutoFitTextOptions {
  minFontSize?: number;
  maxFontSize?: number;
  maxLines?: number;
  lineHeight?: number;
}

/**
 * Hook that automatically adjusts font size to fit text within a container
 * without truncation, using ResizeObserver for responsive behavior.
 * 
 * @param options Configuration options
 * @returns A ref to attach to the text element and the current font size
 */
export function useAutoFitText({
  minFontSize = 0.75, // 12px at base 16px
  maxFontSize = 1.125, // 18px at base 16px
  maxLines = 3,
  lineHeight = 1.2,
}: UseAutoFitTextOptions = {}) {
  const textRef = useRef<HTMLElement>(null);
  const [fontSize, setFontSize] = useState<number>(maxFontSize);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    // Find the inner span with line-clamp
    const innerSpan = element.querySelector('span.line-clamp-3') as HTMLElement;
    if (!innerSpan) return;

    const adjustFontSize = () => {
      // Reset to max size to measure
      element.style.fontSize = `${maxFontSize}rem`;
      
      // Force reflow to get accurate measurements
      void element.offsetHeight;
      
      // Get computed styles
      const computedStyle = window.getComputedStyle(element);
      const lineHeightValue = parseFloat(computedStyle.lineHeight);
      const containerWidth = element.clientWidth;
      
      // Calculate max height based on maxLines and lineHeight
      // Account for line-clamp behavior
      const maxHeight = lineHeightValue * maxLines;
      
      // Check if text fits at max size
      const scrollHeight = innerSpan.scrollHeight;
      const clientHeight = innerSpan.clientHeight;
      
      // If text fits without truncation (scrollHeight <= clientHeight means no overflow)
      if (scrollHeight <= maxHeight && innerSpan.scrollWidth <= containerWidth) {
        setFontSize(maxFontSize);
        return;
      }
      
      // Binary search for optimal font size
      let low = minFontSize;
      let high = maxFontSize;
      let bestSize = minFontSize;
      
      // Perform binary search
      const iterations = 20; // Limit iterations for performance
      for (let i = 0; i < iterations && high - low > 0.01; i++) {
        const mid = (low + high) / 2;
        element.style.fontSize = `${mid}rem`;
        
        // Force reflow
        void element.offsetHeight;
        void innerSpan.offsetHeight;
        
        const currentScrollHeight = innerSpan.scrollHeight;
        const currentClientHeight = innerSpan.clientHeight;
        const currentScrollWidth = innerSpan.scrollWidth;
        
        // Check if text fits: scrollHeight should be <= maxHeight and no horizontal overflow
        // Also check that clientHeight matches scrollHeight (no truncation from line-clamp)
        if (currentScrollHeight <= maxHeight && 
            currentScrollWidth <= containerWidth &&
            currentScrollHeight <= currentClientHeight + 1) { // Allow 1px tolerance
          bestSize = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
      
      // Set final size
      element.style.fontSize = `${bestSize}rem`;
      setFontSize(bestSize);
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      adjustFontSize();
    }, 0);

    // Set up ResizeObserver to adjust on container size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        // Debounce rapid resize events
        clearTimeout(timeoutId);
        setTimeout(adjustFontSize, 50);
      });
      
      resizeObserverRef.current.observe(element);
    }

    // Also listen to window resize as fallback
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(adjustFontSize, 100);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [minFontSize, maxFontSize, maxLines, lineHeight]);

  return { textRef, fontSize };
}


