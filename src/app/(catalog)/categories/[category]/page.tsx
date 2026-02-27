import { redirect } from "next/navigation";
import { CATEGORIES } from "@/lib/constants/categories";
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) return { title: "Category Not Found" };
  return {
    title: `${cat.label} AI Models`,
    description: `Browse and compare the best ${cat.label} AI models. Rankings, benchmarks, and pricing on ${SITE_NAME}.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  // Validate category exists
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) {
    redirect("/models");
  }

  // Redirect to models page with category filter
  redirect(`/models?category=${category}`);
}
