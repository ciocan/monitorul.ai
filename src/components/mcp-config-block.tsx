"use client";

import { useEffect, useState } from "react";

// Client variant of the JSON config snippet shown on /mcp. Renders the live
// app origin into the embedded URL so the snippet a user copies is wired to
// the host they're on (local, preview, or prod).

interface Props {
  path: string;
  alt?: string;
  // Top-level key in the config object — Claude Desktop uses `mcpServers`,
  // Codex uses `mcp_servers`. Everything else under it is identical.
  serverKey: "mcpServers" | "mcp_servers";
  fallback: string;
}

export function McpConfigBlock({ path, alt, serverKey, fallback }: Props) {
  const [url, setUrl] = useState(fallback);
  useEffect(() => {
    setUrl(`${window.location.origin}/mcp/server`);
  }, []);

  const json = {
    [serverKey]: {
      "monitorul-ai": {
        command: "npx",
        args: ["-y", "mcp-remote", url],
      },
    },
  };

  return (
    <div className="mt-4 overflow-hidden rounded border border-border bg-paper-96">
      <div className="border-b border-border px-4 py-2 font-mono text-xs text-ink-45">
        {path}
        {alt ? <span className="block text-ink-45">{alt}</span> : null}
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-sm leading-relaxed text-ink-16">
        {JSON.stringify(json, null, 2)}
      </pre>
    </div>
  );
}
