import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import React from "react";

import fav from "../public/fav2.ico"

import { Providers } from "./providers";

import Footer from "@/components/Footer";
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";



export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: fav.src,
  },

  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.mainsite,
    siteName: siteConfig.name,
    images: [
      {
        url: `${siteConfig.mainsite}/og.png`,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
    locale: "en-IN",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

// TODO: investigate re-rendering in the footer component-- i think it should not re-render.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <body
        className={clsx(
          "min-h-screen  font-sans antialiased",
          fontSans.variable
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "light" }}>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 ">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
