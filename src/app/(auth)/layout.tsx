import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your AI Market Cap account.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
