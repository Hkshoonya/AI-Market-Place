import type { Metadata } from "next";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your AI Market Cap account to track AI models and access the marketplace.",
};

interface SignupPageProps {
  searchParams?: Promise<{
    redirect?: string;
  }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return <SignupForm initialRedirect={resolvedSearchParams.redirect} />;
}
