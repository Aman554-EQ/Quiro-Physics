import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up/[[...sign-up]]">) {
  const { redirect_url } = await searchParams;
  return <AuthPage mode="sign-up" redirectUrl={typeof redirect_url === "string" ? redirect_url : undefined} />;
}
