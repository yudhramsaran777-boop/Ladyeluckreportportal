import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lady E Luck Portal",
  description: "Internal staff portal for Lady E Luck",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-app-gradient min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
