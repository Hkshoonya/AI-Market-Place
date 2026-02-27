import type { Metadata } from "next";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your AI Market Cap account to track AI models and access the marketplace.",
};

export default function SignupPage() {
  return <SignupForm />;
}
