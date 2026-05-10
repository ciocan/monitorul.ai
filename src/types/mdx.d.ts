// MDX module declaration so `import Content from "./content.mdx"` typechecks.
// Required because Next.js + @next/mdx compiles .mdx files into React
// components but TypeScript doesn't know about the loader. See
// https://mdxjs.com/packages/typescript/.
declare module "*.mdx" {
  import type { MDXContent } from "mdx/types";

  const MDXComponent: MDXContent;
  export default MDXComponent;
}
