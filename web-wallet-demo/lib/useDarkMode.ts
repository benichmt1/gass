"use client";

import { useState, useEffect } from "react";

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Initialize from storage or system pref on client mount
  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== "undefined") {
      const savedPreference = localStorage.getItem("darkMode");
      if (savedPreference !== null) {
        setIsDarkMode(JSON.parse(savedPreference));
      } else {
        setIsDarkMode(window.matchMedia?.("(prefers-color-scheme:dark)")?.matches ?? false);
      }
    }
  }, []);

  // Update localStorage and body class when dark mode changes
  useEffect(() => {
    if (!hasMounted) return;
    
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
  }, [isDarkMode, hasMounted]);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    
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
