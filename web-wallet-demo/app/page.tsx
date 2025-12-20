
"use client";

import { DynamicWidget } from "@/lib/dynamic";
import { useState, useEffect } from "react";
import DynamicMethods from "@/app/components/Methods";
import GithubUserInfo from "@/app/components/GithubUserInfo";
import HeaderToggles from "@/app/components/HeaderToggles";
import ThemeToggle from "@/app/components/ThemeToggle";
import SmartWalletInfo from "@/app/components/SmartWalletInfo";
import ContractInteraction from "@/app/components/ContractInteraction";
import { useDarkMode } from "@/lib/useDarkMode";
import "./page.css";
import "./gass-theme.css";
import Image from "next/image";
import ClientOnly from "@/app/components/ClientOnly";

export default function Main() {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="gass-container">
      {/* Top Navigation Bar */}
      <nav className="gass-navbar">
        <div className="gass-navbar-brand">
          <span className="gass-navbar-logo">GASS</span>
          <span className="gass-navbar-badge">Consensus Toronto 2025</span>
        </div>
        <div className="gass-navbar-controls">
          <ClientOnly>
            <ThemeToggle />
            <HeaderToggles />
          </ClientOnly>
        </div>
      </nav>
      <div className="gass-card">
        <h2>GitHub Activity Scoring System</h2>
        <p>Connect your GitHub account to check your rewards eligibility based on your contribution activity</p>
        <ClientOnly>
          <DynamicWidget />
          <GithubUserInfo isDarkMode={isDarkMode} />
          <SmartWalletInfo />
          <ContractInteraction />
          <DynamicMethods isDarkMode={isDarkMode} />
        </ClientOnly>
      </div>
      <div className="gass-footer">
        <div className="gass-footer-text">Created by MichaelBe • GitHub Activity Scoring System</div>
      </div>
    </div>
  );
}
