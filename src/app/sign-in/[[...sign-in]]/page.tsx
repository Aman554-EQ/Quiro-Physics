import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in/[[...sign-in]]">) {
  const { redirect_url } = await searchParams;
  return <AuthPage mode="sign-in" redirectUrl={typeof redirect_url === "string" ? redirect_url : undefined} />;
}
