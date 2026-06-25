"use client";

import * as React from "react";
import type { NavItem } from "@/components/dashboard/shell";

const MORE_BUTTON_WIDTH = 80;
const PINNED_HREFS = new Set(["/dashboard", "/admin"]);

export const ACCOUNT_NAV_HREFS = new Set([
  "/dashboard/billing",
  "/dashboard/settings",
]);

/** Merge primary + secondary, dedupe by href, drop account-only routes. */
export function mergeNavForResponsive(
  primary: NavItem[],
  secondary: NavItem[],
): NavItem[] {
  const seen = new Set<string>();
  const merged: NavItem[] = [];
  for (const item of [...primary, ...secondary]) {
    if (ACCOUNT_NAV_HREFS.has(item.href)) continue;
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    merged.push(item);
  }
  return merged;
}

function isNavItemActive(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    (href !== "/dashboard" && href !== "/admin" && pathname.startsWith(href))
  );
}

function splitNavByWidth(
  items: NavItem[],
  widths: number[],
  availableWidth: number,
  pathname: string,
): { visible: NavItem[]; overflow: NavItem[] } {
  if (items.length === 0) {
    return { visible: [], overflow: [] };
  }

  const activeIndex = items.findIndex((item) =>
    isNavItemActive(pathname, item.href),
  );

  let visibleCount = items.length;
  while (visibleCount > 1) {
    const overflowCount = items.length - visibleCount;
    const tabsWidth = widths
      .slice(0, visibleCount)
      .reduce((sum, w) => sum + w, 0);
    const total = tabsWidth + (overflowCount > 0 ? MORE_BUTTON_WIDTH : 0);
    if (total <= availableWidth) break;
    visibleCount -= 1;
  }

  let visible = items.slice(0, visibleCount);
  let overflow = items.slice(visibleCount);

  if (
    activeIndex >= 0 &&
    activeIndex >= visibleCount &&
    visible.length > 0
  ) {
    const activeItem = items[activeIndex]!;
    const replaceAt = Math.max(visible.length - 1, 1);
    const displaced = visible[replaceAt];
    visible = [...visible];
    visible[replaceAt] = activeItem;
    overflow = items.filter(
      (item) => !visible.some((v) => v.href === item.href),
    );
    if (displaced && !overflow.some((o) => o.href === displaced.href)) {
      overflow = [displaced, ...overflow.filter((o) => o.href !== activeItem.href)];
    }
    overflow.sort(
      (a, b) => items.findIndex((i) => i.href === a.href) - items.findIndex((i) => i.href === b.href),
    );
  }

  const pinned = items.filter((item) => PINNED_HREFS.has(item.href));
  for (const pin of pinned) {
    if (!visible.some((v) => v.href === pin.href)) {
      if (visible.length > 0) {
        const tail = visible[visible.length - 1];
        visible = [pin, ...visible.slice(0, -1)];
        if (tail && !overflow.some((o) => o.href === tail.href)) {
          overflow = [tail, ...overflow];
        }
      } else {
        visible = [pin];
      }
    }
  }

  return { visible, overflow };
}

/**
 * Responsive nav split — pins Overview, promotes active route, overflows tail into More.
 */
export function useResponsiveNav(
  allItems: NavItem[],
  pathname: string,
  containerRef: React.RefObject<HTMLElement | null>,
  measureRefs: React.MutableRefObject<(HTMLElement | null)[]>,
): { visibleNav: NavItem[]; overflowNav: NavItem[] } {
  const [split, setSplit] = React.useState({
    visible: allItems,
    overflow: [] as NavItem[],
  });

  const recompute = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || allItems.length === 0) {
      setSplit({ visible: allItems, overflow: [] });
      return;
    }

    const widths = allItems.map(
      (_, i) => measureRefs.current[i]?.offsetWidth ?? 0,
    );
    const hasMeasurements = widths.some((w) => w > 0);
    if (!hasMeasurements) return;

    setSplit(
      splitNavByWidth(allItems, widths, container.clientWidth, pathname),
    );
  }, [allItems, containerRef, measureRefs, pathname]);

  React.useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute, containerRef]);

  return { visibleNav: split.visible, overflowNav: split.overflow };
}
