import "./globals.css";
import "react-datepicker/dist/react-datepicker.css";
import type { Metadata } from "next";
import { ToastHub } from "../components/ToastHub";

export const metadata: Metadata = {
  title: "World Cup Champion Prediction",
  description: "Pick your champion and join the shared jackpot prediction event",
  icons: {
    icon: "/favicon.ico?v=20260706",
    shortcut: "/favicon.ico?v=20260706",
    apple: "/favicon.ico?v=20260706",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastHub />
        {children}
      </body>
    </html>
  );
}
