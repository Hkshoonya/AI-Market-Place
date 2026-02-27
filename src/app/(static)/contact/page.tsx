import type { Metadata } from "next";
import ContactContent from "./contact-content";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the AI Market Cap team. Report bugs, request features, or ask questions.",
};

export default function ContactPage() {
  return <ContactContent />;
}
