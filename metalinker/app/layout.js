import { Providers } from "./providers"; // Import our new component
import "./globals.css";

export const metadata = {
  title: "Web3 Messenger",
  description: "Decentralized messaging app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Wrap the children in the Providers component */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}