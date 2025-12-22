
import React from 'react';
import { Github } from 'lucide-react';

export const GithubLogo = ({ className }: { className?: string }) => (
    <Github className={className} />
);

export const BaseLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#0052FF" />
        <path d="M50 25 A 25 25 0 0 1 50 75 A 25 25 0 0 1 50 25" fill="none" stroke="white" strokeWidth="8" />
    </svg>
);
// Base logo approximation: Blue circle. Added a white arc for "Bridge" feel implicitly or just keep it simple.
// Actually, pure Base logo is often just the blue circle. I'll revert to simple circle if this looks bad, but let's try a simple blue circle with a small white detail.
// Simplified Base: Blue circle.
export const BaseLogoSimple = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#0052FF" />
    </svg>
);


export const DynamicLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4H10C14.4183 4 18 7.58172 18 12C18 16.4183 14.4183 20 10 20H4V4Z" fill="currentColor" fillOpacity="0.8" />
        <path d="M10 8H8V16H10C12.2091 16 14 14.2091 14 12C14 9.79086 12.2091 8 10 8Z" fill="black" fillOpacity="0.2" />
    </svg>
);
// Dynamic approximation: A simple "D" shape.
