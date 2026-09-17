import { siteConfig, sections } from "../config";

/**
 * seo.ts — pure builders for the structured-data layer (schema.org JSON-LD).
 *
 * Everything here is data-in/data-out so the SEO surface of every page is
 * pinnable by scripts/test-seo.ts without rendering a browser. DocLayout
 * mounts exactly one <script type="application/ld+json"> per page, carrying
 * a single @graph: WebSite + Organization + (TechArticle | SoftwareApplication)
 * + BreadcrumbList.
 */

export const SITE_URL = siteConfig.url;
export const OG_IMAGE = `${SITE_URL}/og.png`;
export const OG_IMAGE_ALT =
  "ProcBoss Docs — the pboss terminal badge with googly eyes on a mint and paper card.";

/** Node ids inside the per-page @graph (stable so cross-references typecheck). */
export const NODE_IDS = {
  org: `${SITE_URL}/#organization`,
  website: `${SITE_URL}/#website`,
  article: (path: string) => `${SITE_URL}${path}#article`,
  breadcrumb: (path: string) => `${SITE_URL}${path}#breadcrumb`,
  app: `${SITE_URL}/#software`,
} as const;

/** Organization node — the publisher behind every article on the site. */
export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": NODE_IDS.org,
    name: "Procboss",
    url: siteConfig.links.cloud,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.svg` },
    sameAs: [siteConfig.links.pboss],
  };
}

/** WebSite node — the docs site itself (anchor for isPartOf references). */
export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": NODE_IDS.website,
    url: `${SITE_URL}/`,
    name: `${siteConfig.name} — ${siteConfig.product}`,
    inLanguage: "en",
    publisher: { "@id": NODE_IDS.org },
  };
}

/** Human section label for a frontmatter `section` key ("" when unknown). */
export function sectionLabelFor(sectionKey: string): string {
  return sections.find((s) => s.key === sectionKey)?.label ?? "";
}

export interface ArticleInput {
  /** Page path with trailing slash, e.g. "/cli/daemon/" or "/". */
  path: string;
  title: string;
  description: string;
  sectionKey: string;
  /** ISO-8601 — the git-derived lastmod of the source .md file. */
  dateModified: string;
}

/** TechArticle node — one per docs page. */
export function articleNode(input: ArticleInput) {
  const url = `${SITE_URL}${input.path}`;
  const label = sectionLabelFor(input.sectionKey);
  return {
    "@type": "TechArticle",
    "@id": NODE_IDS.article(input.path),
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: { "@id": url },
    image: { "@type": "ImageObject", url: OG_IMAGE },
    inLanguage: "en",
    dateModified: input.dateModified,
    ...(label ? { articleSection: label } : {}),
    author: { "@id": NODE_IDS.org },
    publisher: { "@id": NODE_IDS.org },
    isPartOf: { "@id": NODE_IDS.website },
  };
}

/** SoftwareApplication node — the pboss product, only on the index page. */
export function softwareNode() {
  return {
    "@type": "SoftwareApplication",
    "@id": NODE_IDS.app,
    name: siteConfig.product,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Linux, macOS, Windows",
    softwareVersion: siteConfig.productVersion,
    url: siteConfig.links.cloud,
    description:
      "ProcBoss (pboss) — the open-source, Bun-native universal process manager: run, cluster, monitor, and manage any application, with the optional ProcBoss Cloud layer for fleet visibility.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    sameAs: [siteConfig.links.pboss],
  };
}

/** BreadcrumbList node — Docs home → this page. */
export function breadcrumbNode(path: string, title: string) {
  return {
    "@type": "BreadcrumbList",
    "@id": NODE_IDS.breadcrumb(path),
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Docs", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}${path}` },
    ],
  };
}

/**
 * The full per-page @graph. `withSoftware` adds the SoftwareApplication node
 * (the site index only — it describes the product, not the article).
 */
export function buildGraph(input: ArticleInput, withSoftware = false) {
  const graph: Array<Record<string, unknown>> = [
    websiteNode(),
    organizationNode(),
    articleNode(input),
    breadcrumbNode(input.path, input.title),
  ];
  if (withSoftware) graph.push(softwareNode());
  return { "@context": "https://schema.org", "@graph": graph };
}
