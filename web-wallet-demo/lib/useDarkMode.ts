"use client";

import { useState, useEffect } from "react";

// Get initial dark mode preference from localStorage or system preference
const getInitialDarkMode = (): boolean => {
  if (typeof window !== "undefined") {
    // Check if user has a saved preference
    const savedPreference = localStorage.getItem("darkMode");
    if (savedPreference !== null) {
      return JSON.parse(savedPreference);
    }
    // Fall back to system preference
    return window.matchMedia?.("(prefers-color-scheme:dark)")?.matches ?? false;
  }
  return false;
};

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);

  // Update localStorage when dark mode changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("darkMode", JSON.stringify(isDarkMode));

      // Force re-render by updating a class on the body
      if (isDarkMode) {
        document.documentElement.classList.add('dark-theme');
        document.documentElement.classList.remove('light-theme');
      } else {
        document.documentElement.classList.add('light-theme');
        document.documentElement.classList.remove('dark-theme');
      }
    }
  }, [isDarkMode]);

  // Listen for system preference changes
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    // Only update if user hasn't set a preference
    const handleChange = () => {
      if (localStorage.getItem("darkMode") === null) {
        setIsDarkMode(darkModeMediaQuery.matches);
      }
    };

    darkModeMediaQuery.addEventListener("change", handleChange);
    return () => darkModeMediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return { isDarkMode, toggleDarkMode };
}
