/**
 * Site-wide facts for the docs. Keep this the single place names/URLs live so
 * rebranding or moving hosts is a one-file change.
 */
export const siteConfig = {
  /** Docs site title used in <title> and the header. */
  name: "ProcBoss Docs",
  /** The product: open-source Bun-native process manager. */
  product: "pboss",
  productVersion: "v1.1.0",
  /** Links out. */
  links: {
    /** Open-source CLI repo. */
    pboss: "https://github.com/Procboss/pboss",
    /** This docs repo (edit links point here). */
    docs: "https://github.com/Procboss/docs",
    /** Product site / cloud console. */
    cloud: "https://procboss.com",
  },
} as const;

/** Content collection path inside the repo — used for "edit this page". */
export const contentBase = "src/content/docs";

/** Sidebar sections in display order. `key` matches frontmatter `section`. */
export const sections = [
  { key: "getting-started", label: "Getting Started" },
  { key: "cli", label: "CLI Reference" },
  { key: "guides", label: "Guides" },
  { key: "cloud", label: "ProcBoss Cloud" },
  { key: "more", label: "More" },
] as const;

export type SectionKey = (typeof sections)[number]["key"];
