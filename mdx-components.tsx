import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="mb-4 font-mono text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 border-b border-border pb-1.5 font-mono text-base font-semibold text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 font-mono text-sm font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }) => <p className="my-3 leading-6 text-foreground">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-3 ml-5 list-disc space-y-1 text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 ml-5 list-decimal space-y-1 text-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-6">{children}</li>,
  code: ({ children }) => (
    <code className="bg-surface-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto border border-border bg-surface-muted p-3 font-mono text-[12px] leading-5">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border border-border bg-accent-weak px-4 py-2 text-sm text-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto border border-border">
      <table className="w-full text-left text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-muted">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 align-top text-foreground">{children}</td>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
