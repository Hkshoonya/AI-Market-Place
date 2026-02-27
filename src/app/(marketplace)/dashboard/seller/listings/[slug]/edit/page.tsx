import type { Metadata } from "next";
import EditListingContent from "./edit-listing-content";

export const metadata: Metadata = {
  title: "Edit Listing",
  description: "Edit your marketplace listing on AI Market Cap.",
};

export default function EditListingPage(props: {
  params: Promise<{ slug: string }>;
}) {
  return <EditListingContent params={props.params} />;
}
