# Scroll to Top Button Implementation Plan

## Overview

Implement a floating "Scroll to Top" button component that appears when the user scrolls down the anomaly feed. The button should follow the existing neo-brutalist design language used by the SearchButton component, positioned to avoid overlap with the bottom navigation and other floating elements.

## Current State Analysis

### Layout Structure (`app/page.tsx`)
- **Scroll Container**: Line 132 - `<div className="h-full overflow-y-auto p-4 scrollbar-hide pt-24 pb-20">` - This is the scrollable element, NOT window scroll
- **Bottom Nav**: Lines 178-195 - Fixed at `bottom-0`, height `h-12` (48px), z-index `z-50`
- **SearchButton**: Floating at `bottom-16 right-4 z-60` - positioned 64px from bottom, right side
- **SlotReel/AnomalyCards**: Rendered inside the scroll container at lines 142-146

### Existing Button Patterns (`components/search-button.tsx`)
The SearchButton uses a neo-brutalist style that we should follow:
```css
bg-zinc-950/95 backdrop-blur-xl border-2 border-zinc-600 
shadow-[4px_4px_0px_0px_#27272a]
hover:shadow-[6px_6px_0px_0px_#27272a] hover:-translate-y-1
```

### CSS Variables (`app/globals.css`)
- Primary accent: `--primary: #00FF94` (neon green)
- Border color: `--border: #27272a`
- Background: `--background: #050505`

### Key Discovery
The scroll container is a div with `overflow-y-auto`, NOT the window. The scroll listener must target this specific element, which will require either:
1. A ref passed from the parent, or
2. Using `document.querySelector` to find the scrollable container

## Desired End State

A `<ScrollToTopButton />` component that:
1. Appears with a fade/slide animation when scroll position > 400px
2. Smoothly scrolls back to top when clicked
3. Is positioned left of center (to avoid SearchButton on right), above the bottom nav
4. Follows neo-brutalist dark mode styling with subtle neon accent
5. Works on both desktop and mobile (touch-friendly tap target)
6. Has no React hydration warnings (proper client-side only rendering)

### Verification
- Scroll down feed > 400px → button fades in
- Click button → smooth scroll to top, button fades out
- Button never overlaps bottom nav or SearchButton
- No console errors or hydration warnings
- Works on mobile viewport (320px+)

## What We're NOT Doing

- No additional tooltip or text label beyond icon/minimal text
- No complex animation library beyond CSS transitions
- No server-side rendering of scroll state
- No global scroll position state in Zustand
- No modification to existing SearchButton positioning

## Implementation Approach

Create a standalone, self-contained component that:
1. Uses `useEffect` with scroll listener to track visibility
2. Uses CSS transitions for smooth fade/slide animation
3. Accepts optional `scrollContainerRef` prop or finds container via DOM query
4. Is rendered alongside SearchButton in `app/page.tsx`

## Phase 1: Create ScrollToTopButton Component

### Overview
Create the reusable component with scroll detection and animation.

### Changes Required:

#### 1. New Component File

**File**: `components/scroll-to-top-button.tsx`

```tsx
"use client";

import { useState, useEffect, useCallback, RefObject } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  /** Ref to the scrollable container. If not provided, looks for .scroll-container class */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** Scroll threshold in pixels before button appears (default: 400) */
  threshold?: number;
  /** Additional CSS classes */
  className?: string;
}

export function ScrollToTopButton({
  scrollContainerRef,
  threshold = 400,
  className,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);

  // Find scroll container on mount
  useEffect(() => {
    if (scrollContainerRef?.current) {
      setScrollContainer(scrollContainerRef.current);
    } else {
      // Fallback: find by class
      const container = document.querySelector('.scroll-container') as HTMLElement;
      setScrollContainer(container);
    }
  }, [scrollContainerRef]);

  // Handle scroll visibility
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsVisible(scrollContainer.scrollTop > threshold);
    };

    // Check initial state
    handleScroll();

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [scrollContainer, threshold]);

  const scrollToTop = useCallback(() => {
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
  }, [scrollContainer]);

  return (
    <div
      className={cn(
        "fixed bottom-16 left-4 z-60",
        "transition-all duration-300 ease-out",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none",
        className
      )}
    >
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={cn(
          "flex items-center justify-center w-10 h-10",
          // Neo-brutalist dark base
          "bg-zinc-950/95 backdrop-blur-xl rounded-xl",
          // Thin neon accent border
          "border border-primary/40",
          // Chunky shadow
          "shadow-[3px_3px_0px_0px_rgba(0,255,148,0.15)]",
          // Hover states - lift and intensify
          "hover:shadow-[4px_4px_0px_0px_rgba(0,255,148,0.25)]",
          "hover:-translate-y-0.5 hover:border-primary/60",
          // Active state - press down
          "active:shadow-[2px_2px_0px_0px_rgba(0,255,148,0.2)]",
          "active:translate-y-0",
          // Text/icon color
          "text-zinc-400 hover:text-primary/90",
          // Smooth transitions
          "transition-all duration-200"
        )}
      >
        <ChevronUp size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Component file created at correct path
- [ ] No import errors when referenced

---

## Phase 2: Integrate into Main Layout

### Overview
Wire the ScrollToTopButton into `app/page.tsx` and add the scroll container class.

### Changes Required:

#### 1. Update Main Page

**File**: `app/page.tsx`

**Change 1**: Add scroll-container class to the scrollable div (line 132)

```tsx
// Before:
<div className="h-full overflow-y-auto p-4 scrollbar-hide pt-24 pb-20">

// After:
<div className="h-full overflow-y-auto p-4 scrollbar-hide pt-24 pb-20 scroll-container">
```

**Change 2**: Import and render ScrollToTopButton (after SearchButton, ~line 198)

```tsx
// Add import at top:
import { ScrollToTopButton } from "@/components/scroll-to-top-button";

// Add component alongside SearchButton (inside the return, before closing </main>):
{currentPage === 1 && <ScrollToTopButton />}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Linting passes: `npm run lint`
- [ ] App builds successfully: `npm run build`

#### Manual Verification:
- [ ] Button appears when scrolling down > 400px on Live Feed page
- [ ] Button disappears when switching to Preferences or Top Whales tabs
- [ ] Clicking button smoothly scrolls to top
- [ ] Button fades out after scroll completes
- [ ] No overlap with bottom nav or SearchButton
- [ ] No React hydration warnings in console

---

## Phase 3: Mobile & Polish

### Overview
Ensure mobile safe area compliance and final visual polish.

### Changes Required:

#### 1. Add safe-area support to component

**File**: `components/scroll-to-top-button.tsx`

Update the outer div positioning to respect mobile safe areas:

```tsx
// Update the fixed positioning line:
"fixed bottom-16 left-4 z-60",
// Add safe-area support:
"pb-[env(safe-area-inset-bottom)]",
```

Alternatively, use a calc-based approach if safe-area doesn't work well:

```tsx
"fixed left-4 z-60",
"bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]",
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Test on mobile viewport (use Chrome DevTools device mode)
- [ ] Button has comfortable tap target (min 44x44px touch area)
- [ ] Button doesn't get cut off on iPhone X+ (notch/home indicator area)
- [ ] Animation is smooth on mobile (60fps)

---

## Testing Strategy

### Unit Tests:
Not required for this simple presentational component.

### Integration Tests:
Not required - manual verification sufficient.

### Manual Testing Steps:

1. **Visibility Threshold Test**
   - Load app, verify button is NOT visible
   - Scroll down slowly, verify button appears around 400px mark
   - Scroll back up, verify button disappears near top

2. **Scroll-to-Top Function Test**
   - Scroll down significantly (past 1000px)
   - Click button
   - Verify smooth scroll animation
   - Verify button fades out as scroll reaches top

3. **Tab Switching Test**
   - On Live Feed, scroll down until button appears
   - Switch to Preferences tab
   - Verify button is NOT visible
   - Switch back to Live Feed
   - Verify scroll position is reset (per existing behavior)

4. **Mobile Test**
   - Open Chrome DevTools, switch to iPhone 12 viewport
   - Repeat visibility and scroll tests
   - Verify button is tappable and doesn't overlap bottom nav

5. **Hydration Test**
   - Hard refresh the page
   - Check browser console for React hydration warnings
   - Should be none (component is client-only with proper guards)

## Performance Considerations

- Scroll listener uses `{ passive: true }` for better scroll performance
- CSS transitions instead of JS animation for GPU acceleration
- `pointer-events-none` when hidden to prevent accidental clicks
- Component only renders scroll logic when on Live Feed page

## References

- Existing pattern: `components/search-button.tsx:73-85` - floating button positioning
- Scroll container: `app/page.tsx:132` - overflow-y-auto div
- Bottom nav: `app/page.tsx:178-195` - fixed h-12 at bottom
- CSS variables: `app/globals.css:3-12` - color definitions

