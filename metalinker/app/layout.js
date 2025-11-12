import "./globals.css";
import ClientLayout from "./client-layout";

export const metadata = {
  title: "Web3 Messenger",
  description: "Decentralized messaging app",
};

// This is the correct, simple RootLayout.
// It is a Server Component.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}