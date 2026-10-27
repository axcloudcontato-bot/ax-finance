import type { Metadata } from "next";

export const SITE_NAME = "Openfix";
export const SITE_URL = "https://openfix.axcloud.com.br";
export const SITE_DESCRIPTION =
  "Controle financeiro pessoal e empresarial com contas a pagar e receber, fluxo de caixa, importação OFX e CSV e conciliação bancária.";
export const SITE_SOCIAL_IMAGE = {
  url: "/brand/openfix-social.jpg",
  width: 1200,
  height: 630,
  alt: "Openfix — gestão financeira pessoal e empresarial",
};

export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const fullTitle = `${title} | ${SITE_NAME}`;

  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: "website",
      images: [SITE_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [SITE_SOCIAL_IMAGE],
    },
  };
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
