import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";
import { PRIVATE } from "@/proxy";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/sign-in", "/sign-up"],
      disallow: ["/api/", ...PRIVATE],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
