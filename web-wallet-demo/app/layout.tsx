"use client";

import "./globals.css";
import { Space_Grotesk } from "next/font/google";
import Providers from "@/lib/providers";
import { SessionProvider } from "@/lib/SessionProvider";


const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700']
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>GitHub Activity Scoring System</title>
        <meta name="description" content="GASS - GitHub Activity Scoring System by MichaelBe" />
        {/* Enhanced script to set initial theme with robust storage handling */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Safe storage implementation for the initial script
                const safeGet = function(key, defaultValue) {
                  try {
                    // Try localStorage first
                    if (typeof localStorage !== 'undefined') {
                      try {
                        const value = localStorage.getItem(key);
                        return value !== null ? value : defaultValue;
                      } catch (e) {
                        // localStorage failed, try sessionStorage
                        if (typeof sessionStorage !== 'undefined') {
                          try {
                            const value = sessionStorage.getItem(key);
                            return value !== null ? value : defaultValue;
                          } catch (e2) {
                            // Both failed, return default
                            return defaultValue;
                          }
                        }
                        return defaultValue;
                      }
                    }
                    return defaultValue;
                  } catch (e) {
                    return defaultValue;
                  }
                };

                try {
                  // Determine if dark mode should be used
                  let isDarkMode = false;

                  // Try to get from storage with fallbacks
                  const darkModeSetting = safeGet('darkMode', null);

                  if (darkModeSetting !== null) {
                    // Use stored preference if available
                    isDarkMode = darkModeSetting === 'true';
                  } else {
                    // Fall back to system preference
                    try {
                      isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    } catch (e) {
                      // If even matchMedia fails, default to light mode
                      isDarkMode = false;
                    }
                  }

                  // Apply the theme class
                  document.documentElement.classList.add(isDarkMode ? 'dark-theme' : 'light-theme');
                  document.documentElement.classList.remove(isDarkMode ? 'light-theme' : 'dark-theme');

                  // Set a global flag for storage availability
                  window.hasStorageAccess = false;
                  try {
                    if (typeof localStorage !== 'undefined') {
                      localStorage.setItem('_test_storage_', '1');
                      localStorage.removeItem('_test_storage_');
                      window.hasStorageAccess = true;
                    }
                  } catch (e) {
                    // Storage not available, already set to false
                  }

                  // Set a global helper for safe storage access
                  window.safeStorageGet = safeGet;
                } catch (e) {
                  console.error('Error setting initial theme:', e);
                  // Set default theme as fallback
                  document.documentElement.classList.add('light-theme');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={spaceGrotesk.className}>
        <SessionProvider>
          <Providers>{children}</Providers>
        </SessionProvider>
      </body>
    </html>
  );
}