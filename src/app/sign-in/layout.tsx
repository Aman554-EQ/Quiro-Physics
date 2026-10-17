import { AuthProvider } from "@/components/auth/AuthProvider";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
