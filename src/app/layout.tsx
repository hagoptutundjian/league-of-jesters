import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "League Of Jesters",
  description: "Fantasy Football Salary Cap League Manager",
  openGraph: {
    title: "League Of Jesters",
    description: "Fantasy Football Salary Cap League Manager",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "League Of Jesters - Jester Hat Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "League Of Jesters",
    description: "Fantasy Football Salary Cap League Manager",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
