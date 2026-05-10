"use client";

import { useCallback } from "react";

import {
  trackContributeClicked,
  trackExternalLinkClicked,
  trackPdfDownloadInitiated,
  type ContributeClickedProps,
  type ExternalLinkClickedProps,
} from "@/lib/analytics";

// Tracked anchor wrappers. Each fires a typed event on click before the
// browser handles the navigation. We do NOT preventDefault — the event is
// fire-and-forget; PostHog's image-pixel transport is fast enough that the
// navigation can race ahead without losing the event.

interface BaseAnchorProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: React.ReactNode;
}

export function TrackedExternalLink({
  event,
  onClick,
  ...rest
}: BaseAnchorProps & { event: ExternalLinkClickedProps }) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackExternalLinkClicked(event);
      onClick?.(e);
    },
    [event, onClick],
  );
  return <a {...rest} onClick={handleClick} />;
}

export function TrackedContributeLink({
  cadence,
  source,
  onClick,
  ...rest
}: BaseAnchorProps & ContributeClickedProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackContributeClicked({ cadence, source });
      onClick?.(e);
    },
    [cadence, source, onClick],
  );
  return <a {...rest} onClick={handleClick} />;
}

export function TrackedPdfLink({ year, onClick, ...rest }: BaseAnchorProps & { year: number }) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackPdfDownloadInitiated({ year });
      onClick?.(e);
    },
    [year, onClick],
  );
  return <a {...rest} onClick={handleClick} />;
}
