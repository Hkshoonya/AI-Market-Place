import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your AI Market Cap account.",
};

interface LoginPageProps {
  searchParams?: Promise<{
    redirect?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <LoginForm
      initialRedirect={resolvedSearchParams.redirect}
      hasAuthError={Boolean(resolvedSearchParams.error)}
    />
  );
}
