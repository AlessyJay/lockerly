import React from "react";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: {
    default: "Lockerly",
    template: "%s | Lockerly",
  },
  description:
    "Lockerly - A website that allows users to store and manage their files in a secure and organized manner. It provides a range of features, including file upload and download, version control, collaboration tools, and access control. Lockerly aims to simplify the process of storing and sharing files, making it easy to access and manage files from anywhere.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.className} antialiased`}>{children}</body>
    </html>
  );
}
