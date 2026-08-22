import type { Metadata } from "next";

import { AuthProvider } from "@/features/auth/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Candidate Sourcing System",
  description: "Careers and candidate application portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
