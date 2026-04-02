import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your AI Market Cap account.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
