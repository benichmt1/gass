
"use client";

import { DynamicWidget } from "@/lib/dynamic";
import { useState, useEffect } from "react";
import { ChevronDown } from 'lucide-react';
import DynamicMethods from "@/app/components/Methods";
import HeaderToggles from "@/app/components/HeaderToggles";
import ThemeToggle from "@/app/components/ThemeToggle";
import SmartWalletInfo from "@/app/components/SmartWalletInfo";
import ClaimFlow from "@/app/components/ClaimFlow";
import { useDarkMode } from "@/lib/useDarkMode";
import "./page.css";
import "./gass-theme.css";
import ClientOnly from "@/app/components/ClientOnly";
import { useToggles } from "@/app/components/HeaderToggles";

export default function Main() {
  const { isDarkMode } = useDarkMode();
  const { debugMode } = useToggles();

  return (
    <div className="gass-container">
      {/* Top Navigation Bar */}
      <nav className="gass-navbar">
        <div className="gass-navbar-brand">
          <span className="gass-navbar-logo">Github Activity Scoring System</span>
          <span className="gass-navbar-badge">ETHCC 2026</span>
        </div>
        <div className="gass-navbar-controls">
          <ThemeToggle />
          <HeaderToggles />
        </div>
      </nav>

      <div className="gass-card">
        {/* Main Claim Flow - Centered Wizard */}
        <div className="w-full flex justify-center">
          <ClaimFlow />
        </div>

        {/* Debug / Advanced Section - Only visible in debug mode or if needed */}
        {/* We keep SmartWalletInfo for specialized network switching or debug info if needed via toggle */}
        {debugMode && (
          <div className="mt-8 pt-4 border-t border-white/5 opacity-70">
            <details className="group">
              <summary className="flex items-center justify-center gap-2 text-[10px] uppercase font-bold text-white/30 cursor-pointer hover:text-white/60 transition-colors py-2">
                <span>Developer Controls</span>
                <span className="group-open:rotate-180 transition-transform"><ChevronDown className="w-3 h-3" /></span>
              </summary>
              <div className="mt-4 gass-debug-grid animate-fadeIn p-4 bg-black/40 rounded-xl border border-white/5">
                <SmartWalletInfo />
                <DynamicMethods isDarkMode={isDarkMode} />
              </div>
            </details>
          </div>
        )}
      </div>

      <div className="gass-footer">
        <div className="gass-footer-text">Created by Noid • <a href="https://github.com/michael-bey/gass" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', opacity: 0.7 }}>github.com/michael-bey/gass</a></div>
      </div>
    </div>
  );
}
