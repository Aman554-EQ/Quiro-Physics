import "katex/dist/katex.min.css"; // maths styles + fonts: only the app needs them (keeps the landing page light)

import { AuthProvider } from "@/components/auth/AuthProvider";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/AppShell";
import { getViewer } from "@/server/auth/viewer";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Motion, toasts and Clerk are app-only, which keeps the landing page's JavaScript small.
  const viewer = await getViewer();
  return (
    <AuthProvider>
      <Providers>
        <AppShell viewer={viewer}>{children}</AppShell>
      </Providers>
    </AuthProvider>
  );
}
