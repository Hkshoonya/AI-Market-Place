import type { Metadata } from "next";
import ContactContent from "./contact-content";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the AI Market Cap team. Report bugs, request features, or ask questions.",
  openGraph: {
    title: "Contact Us",
    description: "Get in touch with the AI Market Cap team. Report bugs, request features, or ask questions.",
    url: `${SITE_URL}/contact`,
  },
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
};

export default async function ContactPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <ContactContent
    key={`${params?.category ?? ""}:${params?.subject ?? ""}`}
    initialCategory={typeof params?.category === "string" ? params.category : undefined}
    initialSubject={typeof params?.subject === "string" ? params.subject.slice(0, 500) : undefined}
  />;
}
