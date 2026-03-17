import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ThemeProvider from "./components/ThemeProvider";

export const metadata = {
  title: "CrateMate",
  description: "Your vinyl record companion",
};

export const viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
