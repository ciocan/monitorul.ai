"use client";

import { useEffect, useState } from "react";

import { CopyButton } from "@/components/copy-button";

// Renders the MCP server endpoint URL based on the actual app origin in the
// browser, so local dev shows http://localhost:3000/mcp/server, preview
// deployments show their preview URL, and production shows monitorul.ai.
// Falls back to the SSR-rendered string (NEXT_PUBLIC_SITE_URL) until the
// effect runs after hydration.

interface UrlProps {
  fallback: string;
}

export function McpEndpointUrl({ fallback }: UrlProps) {
  const [url, setUrl] = useState(fallback);
  useEffect(() => {
    setUrl(`${window.location.origin}/mcp/server`);
  }, []);
  return <>{url}</>;
}

interface CopyProps {
  fallback: string;
  className?: string;
}

export function McpEndpointCopyButton({ fallback, className }: CopyProps) {
  const [url, setUrl] = useState(fallback);
  useEffect(() => {
    setUrl(`${window.location.origin}/mcp/server`);
  }, []);
  return (
    <CopyButton
      value={url}
      ariaLabel={`Copiază URL-ul endpointului: ${url}`}
      className={className}
    />
  );
}
