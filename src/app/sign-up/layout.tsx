import { AuthProvider } from "@/components/auth/AuthProvider";

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
