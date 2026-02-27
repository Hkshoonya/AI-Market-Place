import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Listing",
  description: "Edit your marketplace listing.",
};

export default function EditListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
