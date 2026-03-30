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

export default function ContactPage() {
  return <ContactContent />;
}
