import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ThemeProvider from "./components/ThemeProvider";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";

export const metadata = {
  title: "CrateMate",
  description: "Your vinyl record companion",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CrateMate",
  },
};

export const viewport = {
  viewportFit: "cover",
  themeColor: "#0c0b09",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;1,9..144,300;1,9..144,400;1,9..144,700&family=DM+Sans:wght@300;400;500&display=swap"
            rel="stylesheet"
          />
          <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />
        </head>
        <body>
          <ThemeProvider>{children}</ThemeProvider>
          <ServiceWorkerRegistration />
        </body>
      </html>
    </ClerkProvider>
  );
}
