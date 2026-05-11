"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type HashTarget = "marker" | "span";

interface Connector {
  color: string;
  path: string;
}

export interface MarkerLinkCoordinatorProps {
  children: ReactNode;
  className?: string;
}

const LARGE_SCREEN_QUERY = "(min-width: 1024px)";
const SCROLL_IDLE_MS = 140;

function markerIdFromHash(hash: string): { id: string; target: HashTarget } | null {
  if (!hash.startsWith("#")) return null;
  const raw = decodeURIComponent(hash.slice(1));
  if (raw.startsWith("marker-")) return { id: raw.slice("marker-".length), target: "marker" };
  if (raw.startsWith("span-")) return { id: raw.slice("span-".length), target: "span" };
  return null;
}

function markerIdFromHref(href: string): { id: string; target: HashTarget } | null {
  const hashIndex = href.indexOf("#");
  return markerIdFromHash(hashIndex >= 0 ? href.slice(hashIndex) : href);
}

function markerIds(el: HTMLElement): string[] {
  return (el.dataset.markerIds ?? "").split(" ").filter(Boolean);
}

function idsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function markerSpanFromTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-marker-span][data-marker-ids]");
}

function markerIdsFromTarget(target: EventTarget | null): string[] {
  if (!(target instanceof Element)) return [];
  const chip = target.closest<HTMLElement>("[data-marker-chip][data-marker-id]");
  if (chip?.dataset.markerId) return [chip.dataset.markerId];
  const card = target.closest<HTMLElement>("[data-marker-card][data-marker-id]");
  if (card?.dataset.markerId) return [card.dataset.markerId];
  const span = markerSpanFromTarget(target);
  return span ? markerIds(span) : [];
}

function findSpanForMarker(root: HTMLElement, id: string): HTMLElement | null {
  for (const span of root.querySelectorAll<HTMLElement>("[data-marker-span]")) {
    if (markerIds(span).includes(id)) return span;
  }
  return null;
}

function isMarkerPresent(root: HTMLElement, id: string): boolean {
  return Boolean(
    document.getElementById(`marker-${id}`) ||
    document.getElementById(`span-${id}`) ||
    findSpanForMarker(root, id),
  );
}

function frameworkForMarker(root: HTMLElement, id: string): string | undefined {
  for (const el of root.querySelectorAll<HTMLElement>("[data-marker-id]")) {
    if (el.dataset.markerId === id && el.dataset.markerFramework) {
      return el.dataset.markerFramework;
    }
  }
  return undefined;
}

function clearMarkerState(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>(
    "[data-marker-active], [data-marker-preview], [aria-current]",
  )) {
    delete el.dataset.markerActive;
    delete el.dataset.markerPreview;
    el.removeAttribute("aria-current");
  }
}

function applyMarkerDomState(
  root: HTMLElement,
  ids: string[],
  state: "active" | "preview",
  currentId?: string | null,
) {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const framework = ids.length === 1 ? frameworkForMarker(root, ids[0]) : undefined;
  const attr = state === "active" ? "markerActive" : "markerPreview";

  for (const span of root.querySelectorAll<HTMLElement>("[data-marker-span]")) {
    if (markerIds(span).some((id) => idSet.has(id))) {
      if (framework) span.dataset.markerFramework = framework;
      span.dataset[attr] = "true";
    }
  }

  for (const el of root.querySelectorAll<HTMLElement>("[data-marker-id]")) {
    const id = el.dataset.markerId;
    if (!id || !idSet.has(id)) continue;
    el.dataset[attr] = "true";
    if (state === "active" && currentId === id) el.setAttribute("aria-current", "true");
  }
}

function setMarkerDomState(
  root: HTMLElement,
  activeIds: string[],
  previewIds: string[],
  currentId: string | null,
) {
  clearMarkerState(root);
  applyMarkerDomState(root, activeIds, "active", currentId);
  applyMarkerDomState(root, previewIds, "preview");
}

function scrollCardIntoView(root: HTMLElement, id: string) {
  const card = document.getElementById(`marker-${id}`);
  if (!card) return;

  const isLarge = window.matchMedia(LARGE_SCREEN_QUERY).matches;
  const rail = root.querySelector<HTMLElement>("[data-marker-rail]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  if (isLarge && rail && rail.scrollHeight > rail.clientHeight) {
    const railRect = rail.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    rail.scrollTo({
      top: rail.scrollTop + cardRect.top - railRect.top - 16,
      behavior,
    });
    return;
  }

  card.scrollIntoView({ block: "nearest", inline: "nearest", behavior });
}

function scrollSpanIntoView(root: HTMLElement, id: string) {
  const anchor = document.getElementById(`span-${id}`);
  const span = findSpanForMarker(root, id);
  const target = span ?? anchor;
  if (!target) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: reducedMotion ? "auto" : "smooth",
  });
}

function visibleWithin(rect: DOMRect, clip?: DOMRect): boolean {
  const top = Math.max(rect.top, clip?.top ?? 0, 0);
  const right = Math.min(rect.right, clip?.right ?? window.innerWidth, window.innerWidth);
  const bottom = Math.min(rect.bottom, clip?.bottom ?? window.innerHeight, window.innerHeight);
  const left = Math.max(rect.left, clip?.left ?? 0, 0);
  return right > left && bottom > top;
}

function connectorColorFor(framework: string | undefined): string {
  return framework === "dqi" ? "var(--azure-3)" : "var(--alert-civic)";
}

function buildConnector(root: HTMLElement, id: string | null): Connector | null {
  if (!id || !window.matchMedia(LARGE_SCREEN_QUERY).matches) return null;

  const card = document.getElementById(`marker-${id}`);
  const rail = root.querySelector<HTMLElement>("[data-marker-rail]");
  const span = findSpanForMarker(root, id);
  const chip = document.getElementById(`span-${id}`);
  if (!card || !span) return null;

  const railRect = rail?.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  if (!visibleWithin(cardRect, railRect)) return null;

  const chipRect = chip?.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const sourceRect = chipRect && visibleWithin(chipRect) ? chipRect : spanRect;
  if (!visibleWithin(sourceRect)) return null;

  const rootRect = root.getBoundingClientRect();
  const sx = sourceRect.right - rootRect.left + 6;
  const sy = sourceRect.top + sourceRect.height / 2 - rootRect.top;
  const tx = cardRect.left - rootRect.left - 8;
  const ty = cardRect.top + Math.min(36, cardRect.height / 2) - rootRect.top;
  const curve = Math.max(48, Math.abs(tx - sx) * 0.42);
  return {
    color: connectorColorFor(card.dataset.markerFramework),
    path: `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`,
  };
}

function withoutHash() {
  return `${window.location.pathname}${window.location.search}`;
}

export function MarkerLinkCoordinator({ children, className }: MarkerLinkCoordinatorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const scrollIdleRef = useRef<number | null>(null);
  const effectiveIdRef = useRef<string | null>(null);
  const connectorRef = useRef<Connector | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeGroupIds, setActiveGroupIdsState] = useState<string[]>([]);
  const [previewIds, setPreviewIdsState] = useState<string[]>([]);
  const [connector, setConnector] = useState<Connector | null>(null);

  const setActiveGroupIds = useCallback((ids: string[]) => {
    setActiveGroupIdsState((current) => (idsEqual(current, ids) ? current : ids));
  }, []);

  const setPreviewIds = useCallback((ids: string[]) => {
    setPreviewIdsState((current) => (idsEqual(current, ids) ? current : ids));
  }, []);

  const setConnectorState = useCallback((next: Connector | null) => {
    connectorRef.current = next;
    setConnector(next);
  }, []);

  const scheduleConnector = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const root = rootRef.current;
      setConnectorState(root ? buildConnector(root, effectiveIdRef.current) : null);
    });
  }, [setConnectorState]);

  const hideConnectorDuringScroll = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (connectorRef.current) setConnectorState(null);
    if (scrollIdleRef.current !== null) window.clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = window.setTimeout(() => {
      scrollIdleRef.current = null;
      scheduleConnector();
    }, SCROLL_IDLE_MS);
  }, [scheduleConnector, setConnectorState]);

  const activate = useCallback(
    (id: string, target: HashTarget) => {
      const root = rootRef.current;
      if (!root || !isMarkerPresent(root, id)) return;
      setPreviewIds([]);
      setActiveGroupIds([]);
      setSelectedId(id);
      const nextHash = `#${target}-${id}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }
      if (target === "marker") scrollCardIntoView(root, id);
      else scrollSpanIntoView(root, id);
      scheduleConnector();
    },
    [scheduleConnector, setActiveGroupIds, setPreviewIds],
  );

  const activateGroup = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      if (ids.length === 1) {
        activate(ids[0], "marker");
        return;
      }
      setPreviewIds([]);
      setSelectedId(null);
      setActiveGroupIds(ids);
      setConnectorState(null);
      if (markerIdFromHash(window.location.hash)) {
        window.history.replaceState(null, "", withoutHash());
      }
    },
    [activate, setActiveGroupIds, setConnectorState, setPreviewIds],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const parsed = markerIdFromHash(window.location.hash);
    if (!parsed) return;
    if (!isMarkerPresent(root, parsed.id)) {
      window.history.replaceState(null, "", withoutHash());
      return;
    }
    setSelectedId(parsed.id);
    setActiveGroupIds([]);
    if (parsed.target === "marker") scrollCardIntoView(root, parsed.id);
    else scrollSpanIntoView(root, parsed.id);
  }, [setActiveGroupIds]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    effectiveIdRef.current = selectedId;
    if (selectedId && !isMarkerPresent(root, selectedId)) {
      setSelectedId(null);
      if (markerIdFromHash(window.location.hash)?.id === selectedId) {
        window.history.replaceState(null, "", withoutHash());
      }
      return;
    }
    const activeIds = selectedId ? [selectedId] : activeGroupIds;
    setMarkerDomState(root, activeIds, previewIds, selectedId);
    scheduleConnector();
  }, [activeGroupIds, previewIds, selectedId, scheduleConnector]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const ids = markerIdsFromTarget(event.target);
      if (ids.length > 0) setPreviewIds(ids);
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const nextIds = markerIdsFromTarget(event.relatedTarget);
      if (nextIds.length === 0) setPreviewIds([]);
    };
    const onFocusIn = (event: FocusEvent) => {
      const ids = markerIdsFromTarget(event.target);
      if (ids.length > 0) setPreviewIds(ids);
    };
    const onFocusOut = () => {
      requestAnimationFrame(() => {
        setPreviewIds(markerIdsFromTarget(document.activeElement));
      });
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>(
        'a[href*="#marker-"], a[href*="#span-"]',
      );
      if (anchor && root.contains(anchor)) {
        const parsed = markerIdFromHref(anchor.getAttribute("href") ?? "");
        if (!parsed) return;
        event.preventDefault();
        activate(parsed.id, parsed.target);
        return;
      }

      const span = markerSpanFromTarget(event.target);
      if (span && root.contains(span)) {
        event.preventDefault();
        activateGroup(markerIds(span));
        return;
      }

      const card = event.target.closest<HTMLElement>("[data-marker-card][data-marker-id]");
      if (!card || !root.contains(card) || !card.dataset.markerId) return;
      event.preventDefault();
      activate(card.dataset.markerId, "span");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setActiveGroupIds([]);
        setPreviewIds([]);
        setConnectorState(null);
        clearMarkerState(root);
        if (markerIdFromHash(window.location.hash)) {
          window.history.replaceState(null, "", withoutHash());
        }
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("a")) return;
      const span = markerSpanFromTarget(event.target);
      if (span && root.contains(span)) {
        event.preventDefault();
        activateGroup(markerIds(span));
        return;
      }
      const card = event.target.closest<HTMLElement>("[data-marker-card][data-marker-id]");
      if (card && root.contains(card) && card.dataset.markerId) {
        event.preventDefault();
        activate(card.dataset.markerId, "span");
      }
    };
    const onHashChange = () => {
      const parsed = markerIdFromHash(window.location.hash);
      if (!parsed) {
        setSelectedId(null);
        setActiveGroupIds([]);
        return;
      }
      if (!isMarkerPresent(root, parsed.id)) {
        setSelectedId(null);
        setActiveGroupIds([]);
        window.history.replaceState(null, "", withoutHash());
        return;
      }
      setSelectedId(parsed.id);
      setActiveGroupIds([]);
      if (parsed.target === "marker") scrollCardIntoView(root, parsed.id);
      else scrollSpanIntoView(root, parsed.id);
      scheduleConnector();
    };

    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("scroll", hideConnectorDuringScroll, true);
    window.addEventListener("resize", scheduleConnector);
    const observer = new ResizeObserver(scheduleConnector);
    observer.observe(root);

    return () => {
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("scroll", hideConnectorDuringScroll, true);
      window.removeEventListener("resize", scheduleConnector);
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (scrollIdleRef.current !== null) window.clearTimeout(scrollIdleRef.current);
    };
  }, [
    activate,
    activateGroup,
    hideConnectorDuringScroll,
    scheduleConnector,
    setActiveGroupIds,
    setConnectorState,
    setPreviewIds,
  ]);

  return (
    <div ref={rootRef} className={cn("relative", className)} data-marker-link-root="">
      {children}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 hidden overflow-visible lg:block"
      >
        {connector ? (
          <path
            d={connector.path}
            fill="none"
            stroke={connector.color}
            strokeLinecap="round"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}
