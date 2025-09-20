import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext"; // Import ThemeProvider
import { Toaster } from "react-hot-toast";
import "./globals.css";

// Metadata for search engine optimization (SEO) and browser tab information
export const metadata = {
  title: "Lexi सिंपलीफाई | AI Legal Document Analysis",
  description: "Upload any legal document (PDF or image) and get a simple, clear explanation in plain English or your local language. Understand contracts, agreements, and notices instantly.",
  keywords: ["legal tech", "document analysis", "AI lawyer", "simplify legal documents", "contract summary", "hackathon"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider> {/* Manages Light/Dark Mode */}
          <AuthProvider> {/* Manages User Login State */}
            {children}
            {/* Component for showing pop-up notifications (e.g., "Signed in successfully!") */}
            <Toaster position="bottom-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}