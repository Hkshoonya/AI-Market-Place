import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants/site";

function readOptionalEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function buildSiteVerificationMetadata(): Metadata["verification"] | undefined {
  const googleVerification = readOptionalEnv(
    "GOOGLE_SITE_VERIFICATION",
    "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"
  );
  const bingVerification = readOptionalEnv(
    "BING_SITE_VERIFICATION",
    "NEXT_PUBLIC_BING_SITE_VERIFICATION"
  );

  if (!googleVerification && !bingVerification) {
    return undefined;
  }

  return {
    google: googleVerification,
    other: bingVerification
      ? {
          "msvalidate.01": bingVerification,
        }
      : undefined,
  };
}

export function buildRootMetadata(): Metadata {
  const verification = buildSiteVerificationMetadata();

  return {
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    metadataBase: new URL(SITE_URL),
    manifest: "/manifest.json",
    icons: {
      icon: [{ url: "/icon", type: "image/png" }],
      apple: [{ url: "/apple-icon", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: SITE_NAME,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: ["/twitter-image"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification,
  };
}
