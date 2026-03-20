'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum';
import { type Address, type Hex } from 'viem';
import {
    checkDistributionStatus,
    processReward,
    checkEligibilityTier,
    verifyAndSignEligibility,
    RewardTier,
    TIER_AMOUNTS,
    type EligibilityResult,
    GASS_CONTRACT_ADDRESS
} from '@/lib/contractUtils';
import {
    getDynamicJwtToken,
    type VerificationResult
} from '@/lib/verificationUtils';
import { useDynamicAuth } from '@/lib/useDynamicAuth';
import { useToggles } from '@/app/components/HeaderToggles';
import './Methods.css'; // Reusing styles for consistency
import { DynamicWidget } from "@/lib/dynamic";
import {
    Zap,
    Check,
    Lock,
    Search,
    Loader2,
    Trophy,
    XCircle,
    Github,
    Circle,
    CheckCircle,
    Globe,
    LogOut
} from 'lucide-react';
import { BaseLogoSimple, DynamicLogo } from './Logos';

export default function ClaimFlow() {
    // --- STATE ---
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
    const { debugMode, simulationMode } = useToggles();

    // Auth State
    const {
        isAuthenticated,
        user,
        primaryWallet,
        githubUsername: authGithubUsername
    } = useDynamicAuth();
    const { handleLogOut } = useDynamicContext();

    // Logic State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [githubUsername, setGithubUsername] = useState<string>('');

    // Eligibility State
    const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult | null>(null);
    const [isEligible, setIsEligible] = useState<boolean>(false);
    const [alreadyReceived, setAlreadyReceived] = useState<boolean>(false);

    // Verification State
    const [verificationProof, setVerificationProof] = useState<string | null>(null);
    const [verificationTimestamp, setVerificationTimestamp] = useState<number | null>(null);
    const [isGeneratingProof, setIsGeneratingProof] = useState(false);

    // Claim State
    const [processingReward, setProcessingReward] = useState(false);
    const [rewardProcessed, setRewardProcessed] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [contractCallInfo, setContractCallInfo] = useState<string | null>(null);

    // --- EFFECTS ---

    // Sync GitHub username
    useEffect(() => {
        const username = authGithubUsername ||
            (user as any)?.verifiedCredentials?.find(
                (credential: any) => credential.format === 'oauth' && credential.oauthProvider === 'github'
            )?.oauthUsername || '';
        setGithubUsername(username);
    }, [authGithubUsername, user]);

    // Auto-advance step 1 -> 2 if connected
    useEffect(() => {
        if (currentStep === 1 && isAuthenticated && primaryWallet && githubUsername) {
            setCurrentStep(2);
        }
    }, [currentStep, isAuthenticated, primaryWallet, githubUsername]);

    // Reset to step 1 if auth drops (e.g. user disconnects via Dynamic modal)
    useEffect(() => {
        if (!isAuthenticated && currentStep > 1) {
            setCurrentStep(1);
            setEligibilityResult(null);
            setIsEligible(false);
            setAlreadyReceived(false);
            setVerificationProof(null);
            setVerificationTimestamp(null);
            setError(null);
            setRewardProcessed(false);
            setTxHash(null);
            setContractCallInfo(null);
        }
    }, [isAuthenticated, currentStep]);

    // --- ACTIONS ---

    // 0. Disconnect / start over
    const handleDisconnect = async () => {
        await handleLogOut();
        setCurrentStep(1);
        setEligibilityResult(null);
        setIsEligible(false);
        setAlreadyReceived(false);
        setVerificationProof(null);
        setVerificationTimestamp(null);
        setError(null);
        setLoading(false);
        setRewardProcessed(false);
        setTxHash(null);
        setContractCallInfo(null);
    };

    // 1. Generate Verification Proof
    const generateProof = async (): Promise<{ proof: string | null, timestamp: number | null }> => {
        if (!primaryWallet || !githubUsername) return { proof: null, timestamp: null };

        setIsGeneratingProof(true);
        setError(null);

        try {
            // Check if we're in a browser environment with storage access
            const hasStorageAccess = typeof window !== 'undefined' &&
                typeof localStorage !== 'undefined' &&
                typeof sessionStorage !== 'undefined';

            if (!hasStorageAccess) {
                console.warn('Storage access is not available. Using simulation mode for verification.');
                const simulatedProof = `simulated_jwt_for_${githubUsername}_${Date.now()}`;
                const timestamp = Math.floor(Date.now() / 1000);
                setVerificationProof(simulatedProof);
                setVerificationTimestamp(timestamp);
                setIsGeneratingProof(false);
                return { proof: simulatedProof, timestamp };
            }

            const jwtResult = await getDynamicJwtToken();

            if (!jwtResult.isVerified || !jwtResult.proof) {
                if (process.env.NODE_ENV === 'development') {
                    // Fallback for dev
                    const fallbackProof = `dev_fallback_token_${githubUsername}_${Date.now()}`;
                    const timestamp = Math.floor(Date.now() / 1000);
                    setVerificationProof(fallbackProof);
                    setVerificationTimestamp(timestamp);
                    return { proof: fallbackProof, timestamp };
                } else {
                    throw new Error(jwtResult.message || 'Failed to get verification proof');
                }
            } else {
                const timestamp = jwtResult.timestamp || Math.floor(Date.now() / 1000);
                setVerificationProof(jwtResult.proof);
                setVerificationTimestamp(timestamp);
                return { proof: jwtResult.proof, timestamp };
            }

        } catch (err: any) {
            console.error("Proof generation error:", err);
            setError(err.message || 'Failed to generate proof');
            return { proof: null, timestamp: null };
        } finally {
            setIsGeneratingProof(false);
        }
    };

    // 2. Check Eligibility
    const checkEligibility = async () => {
        if (!githubUsername) return;

        setLoading(true);
        setError(null);
        setContractCallInfo(null);

        try {
            // --- Network Check (Skip if simulation) ---
            const hasStorageAccess = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
            const effectiveSimulationMode = simulationMode || !hasStorageAccess;

            if (effectiveSimulationMode) {
                // SIMULATION LOGIC
                await new Promise(r => setTimeout(r, 1000));

                // Simulate logic from GithubUserInfo
                let result: EligibilityResult;
                if (githubUsername === 'michael-bey') {
                    // Specific mock for demo user
                    result = {
                        hasReceived: false,
                        eligibleTier: RewardTier.STANDARD, // Simplification for demo
                        qualityScore: 63,
                        lastUpdated: 1747331744,
                        reviewCount: 15
                    };
                } else {
                    result = {
                        hasReceived: false,
                        eligibleTier: RewardTier.STANDARD,
                        qualityScore: 75,
                        lastUpdated: 1755000000,
                        reviewCount: 50
                    };
                }

                setEligibilityResult(result);
                setIsEligible(result.eligibleTier !== RewardTier.NONE && result.eligibleTier !== RewardTier.REJECTED);
                setAlreadyReceived(result.hasReceived);
                setContractCallInfo(`Simulated Check: Eligible for ${result.eligibleTier}`);

                if (result.eligibleTier !== RewardTier.NONE && result.eligibleTier !== RewardTier.REJECTED) {
                    // Advance to next step if eligible
                    // But wait for user to click "Next" or just show the button?
                    // Let's stay on Step 2 and show the result, and offer a "Proceed to Claim" button
                }

            } else {
                // REAL CONTRACT CALL
                const result = await checkEligibilityTier(githubUsername);
                setEligibilityResult(result);
                setIsEligible(result.eligibleTier !== RewardTier.NONE && result.eligibleTier !== RewardTier.REJECTED);
                setAlreadyReceived(result.hasReceived);
                setContractCallInfo(`Contract Check: Eligible for ${result.eligibleTier}`);
            }

        } catch (err: any) {
            setError(err.message || "Failed to check eligibility");
        } finally {
            setLoading(false);
        }
    };

    // 3. Claim Reward
    const handleClaim = async () => {
        if (!githubUsername || !primaryWallet) return;

        const hasStorageAccess = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
        const effectiveSimulationMode = simulationMode || !hasStorageAccess;

        // Require proof if not simulation
        let currentProof = verificationProof;
        let currentTimestamp = verificationTimestamp;

        if (!effectiveSimulationMode) {
            const isStale = !currentProof || !currentTimestamp ||
                (Date.now() / 1000 - currentTimestamp > 3000);

            if (isStale) {
                const result = await generateProof();
                currentProof = result.proof;
                currentTimestamp = result.timestamp;

                if (!currentProof) {
                    setError("Verification proof required. Please try again.");
                    return;
                }
            }
        }

        setProcessingReward(true);
        setError(null);

        try {
            if (effectiveSimulationMode) {
                await new Promise(r => setTimeout(r, 2000));
                setRewardProcessed(true);
                setTxHash(`0x${Math.random().toString(16).substring(2, 42)}`);
                setAlreadyReceived(true);
            } else {
                if (!isEthereumWallet(primaryWallet)) {
                    throw new Error('Primary wallet is not an Ethereum wallet');
                }

                // 1. Verify eligibility and get trusted signature from backend
                const verificationResult = await verifyAndSignEligibility(
                    githubUsername,
                    primaryWallet.address as string,
                    currentProof as string,
                    currentTimestamp!
                );

                if (!verificationResult.success || !verificationResult.signature) {
                    throw new Error(verificationResult.error || "Server verification failed");
                }

                if (!verificationResult.amount) throw new Error('Backend returned no amount');

                const walletClient = await primaryWallet.getWalletClient();
                const result = await processReward(
                    walletClient,
                    primaryWallet.address as Address,
                    verificationResult.amount,
                    githubUsername,
                    verificationResult.signature,
                    currentTimestamp!
                );

                if (result.success) {
                    setRewardProcessed(true);
                    setTxHash(result.txHash || null);
                    setAlreadyReceived(true);
                } else {
                    throw new Error(result.error || "Claim failed");
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to claim reward");
        } finally {
            setProcessingReward(false);
        }
    };

    // --- RENDER HELPERS ---

    return (
        <div className="w-full">

            {/* SPLIT-SCREEN LANDING (Step 1) */}
            {currentStep === 1 && (
                <div className="gass-split-screen animate-fadeIn">
                    {/* Left Panel - Dark gradient hero */}
                    <div className="gass-hero-left">
                        {/* Logo */}
                        <div className="gass-split-logo">
                            <div className="gass-split-logo-icon">
                                <Zap className="w-6 h-6 text-white" fill="currentColor" />
                            </div>
                            <span className="gass-split-logo-text">Github Activity Scoring System</span>
                        </div>

                        {/* Hero Content */}
                        <h1 className="gass-split-headline">
                            Claim Your<br />Token Rewards
                        </h1>
                        <p className="gass-split-subheadline">
                            Connect your GitHub account and claim your exclusive airdrop tokens. Rewards are based on your open source contribution activity.
                        </p>

                        {/* Feature highlights */}
                        <div className="gass-feature-list">
                            <div className="gass-feature-item">
                                <span className="gass-feature-icon"><Check className="w-4 h-4" /></span>
                                <span>Verify GitHub contributions instantly</span>
                            </div>
                            <div className="gass-feature-item">
                                <span className="gass-feature-icon"><Check className="w-4 h-4" /></span>
                                <span>Claim tokens based on activity score</span>
                            </div>
                            <div className="gass-feature-item">
                                <span className="gass-feature-icon"><Check className="w-4 h-4" /></span>
                                <span>Limited time offer for early supporters</span>
                            </div>
                        </div>

                        {/* Dashboard Mockup - NEW */}
                        <div className="gass-dashboard-mockup">
                            <div className="gass-mockup-float-card">
                                +1,240 GASS
                            </div>
                            <div className="gass-mockup-frame">
                                <div className="gass-mockup-header">
                                    <div className="gass-mockup-dot"></div>
                                    <div className="gass-mockup-dot"></div>
                                    <div className="gass-mockup-dot"></div>
                                    <span style={{ fontSize: '0.625rem', opacity: 0.3, marginLeft: 'auto' }}>gass.rewards/dashboard</span>
                                </div>
                                <div className="gass-mockup-stats">
                                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '40px', borderRadius: '4px' }}></div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '40px', borderRadius: '4px' }}></div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '40px', borderRadius: '4px' }}></div>
                                </div>
                                <div className="gass-mockup-chart"></div>
                            </div>
                        </div>

                        {/* Social Strip - NEW */}
                        <div className="gass-social-strip">
                            <span className="gass-social-label">Ecosystem Partners</span>
                            <div className="gass-social-logos flex gap-6 items-center">
                                <div className="flex items-center gap-2">
                                    <Github className="w-6 h-6 text-white" />
                                    <span style={{ color: 'white', fontWeight: 700, fontSize: '1.125rem' }}>GitHub</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <BaseLogoSimple className="w-6 h-6" />
                                    <span style={{ color: 'white', fontWeight: 700, fontSize: '1.125rem' }}>BASE</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DynamicLogo className="w-5 h-5 text-white" />
                                    <span style={{ color: 'white', fontWeight: 700, fontSize: '1.125rem' }}>DYNAMIC</span>
                                </div>
                            </div>
                        </div>

                        {debugMode && (
                            <div className="absolute top-4 right-4 bg-black/80 border border-white/10 p-2 rounded text-[9px] font-mono text-white/50 z-50">
                                <p className="font-bold text-white/70 mb-1">DEBUG</p>
                                <p>Auth: <span className={isAuthenticated ? "text-green-400" : "text-red-400"}>{isAuthenticated ? 'TRUE' : 'FALSE'}</span></p>
                                <p>Wallet: <span className={primaryWallet ? "text-green-400" : "text-red-400"}>{primaryWallet ? 'YES' : 'NO'}</span></p>
                                <p>User: {githubUsername ? 'YES' : 'NO'}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Auth section */}
                    <div className="gass-hero-right">
                        <div className="gass-auth-container">
                            <div className="gass-auth-card">
                                <div className="gass-auth-header">
                                    <h2 className="gass-auth-title">Welcome Back</h2>
                                    <p className="gass-auth-subtitle">Sign in to claim your airdrop tokens</p>
                                </div>

                                {/* Dynamic Widget - Actual working auth */}
                                <div className="gass-oauth-stack">
                                    <DynamicWidget variant="modal" />
                                </div>

                                {/* Manual Advance for Authenticated Users */}
                                {isAuthenticated && (
                                    <div className="gass-auth-success">
                                        <div className="gass-auth-success-badge flex items-center gap-2">
                                            <Check className="w-4 h-4" /> Connected as {githubUsername || 'User'}
                                        </div>
                                        <button
                                            onClick={() => setCurrentStep(2)}
                                            className="gass-connect-wallet-btn"
                                        >
                                            Continue to Verification →
                                        </button>
                                    </div>
                                )}

                                <div className="gass-divider-or">or</div>

                                {/* Info box */}
                                <div className="gass-info-box">
                                    <p className="gass-info-box-title">New to the System?</p>
                                    <p className="gass-info-box-text">
                                        Connect with GitHub to verify your open source contributions and check your token eligibility.
                                    </p>
                                </div>
                            </div>

                            {/* Trust Section - Moved outside card for depth */}
                            <div className="gass-trust-section">
                                <div className="gass-trust-item">
                                    <div className="gass-trust-icon"><Lock className="w-5 h-5" /></div>
                                    <div className="gass-trust-text">
                                        <h4>Read-Only Access</h4>
                                        <p>We only request public contribution data. We never ask for private repository access.</p>
                                    </div>
                                </div>
                                <div className="gass-trust-item">
                                    <div className="gass-trust-icon"><Zap className="w-5 h-5" /></div>
                                    <div className="gass-trust-text">
                                        <h4>Instant Verification</h4>
                                        <p>Our scoring algorithm processes your activity in seconds using the GASS oracle.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SINGLE-COLUMN ONBOARDING WIZARD (Step 2+) */}
            {currentStep > 1 && (
                <div className="gass-onboarding-wizard animate-fadeIn">

                    {/* Step Indicator - Prominent at top */}
                    <div className="gass-wizard-steps">
                        {[
                            { step: 1, label: 'Connect' },
                            { step: 2, label: 'Verify' },
                            { step: 3, label: 'Claim' }
                        ].map(({ step, label }, idx) => {
                            const isActive = step === currentStep;
                            const isCompleted = step < currentStep || (step === 3 && rewardProcessed);
                            const isPending = step > currentStep;

                            return (
                                <div key={step} className="flex items-center">
                                    <div
                                        onClick={() => (isCompleted || (step === 2 && isAuthenticated)) && setCurrentStep(step as 1 | 2 | 3)}
                                        className={`gass-wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''}`}
                                    >
                                        <div className="gass-wizard-step-number flex items-center justify-center">
                                            {isCompleted ? <Check className="w-4 h-4" /> : step}
                                        </div>
                                        <span className="gass-wizard-step-label">{label}</span>
                                    </div>
                                    {idx < 2 && (
                                        <div className={`gass-wizard-connector ${step < currentStep ? 'completed' : ''}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Compact Profile Summary Bar */}
                    <div className="gass-profile-bar">
                        <div className="gass-profile-bar-badges">
                            <div className={`gass-profile-badge ${primaryWallet ? 'connected' : 'pending'}`}>
                                <span className="gass-profile-badge-icon">
                                    {primaryWallet ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                </span>
                                <span className="gass-profile-badge-value">
                                    {primaryWallet ? `${primaryWallet.address.substring(0, 6)}...${primaryWallet.address.slice(-4)}` : 'No Wallet'}
                                </span>
                            </div>
                            {githubUsername ? (
                                <a
                                    href={`https://github.com/${githubUsername}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`gass-profile-badge connected`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <span className="gass-profile-badge-icon"><Github className="w-3 h-3" /></span>
                                    <span className="gass-profile-badge-value">{githubUsername}</span>
                                </a>
                            ) : (
                                <div className="gass-profile-badge pending">
                                    <span className="gass-profile-badge-icon"><Circle className="w-3 h-3" /></span>
                                    <span className="gass-profile-badge-value">GitHub Not Connected</span>
                                </div>
                            )}
                        </div>
                        <button onClick={handleDisconnect} className="gass-disconnect-btn">
                            <LogOut className="w-3 h-3" />
                            Disconnect
                        </button>
                    </div>

                    {/* Step 2: Verify — two-column layout */}
                    {currentStep === 2 && (
                        <div className="gass-flow-columns">
                            {/* Left: context panel */}
                            <div className="gass-flow-left">
                                <div className="gass-flow-left-header">
                                    <div className="gass-flow-left-icon">
                                        <Zap className="w-4 h-4 text-white" fill="currentColor" />
                                    </div>
                                    <h3 className="gass-flow-left-title">How Your Score Works</h3>
                                </div>
                                <p className="gass-flow-left-body">
                                    Your contribution score is calculated from the quality and quantity of your open source activity on GitHub. Higher scores unlock larger GASS reward tiers.
                                </p>
                                <div className="gass-flow-tier-table">
                                    <div className="gass-flow-tier-row">
                                        <span className="gass-tier-label limited">Limited</span>
                                        <span>1 – 39</span>
                                        <span>50 GASS</span>
                                    </div>
                                    <div className="gass-flow-tier-row">
                                        <span className="gass-tier-label standard">Standard</span>
                                        <span>40 – 79</span>
                                        <span>100 GASS</span>
                                    </div>
                                    <div className="gass-flow-tier-row">
                                        <span className="gass-tier-label bonus">Bonus</span>
                                        <span>80 – 100</span>
                                        <span>200 GASS</span>
                                    </div>
                                </div>
                                <div className="gass-flow-left-partners">
                                    <a
                                        href="https://github.com/michael-bey/gass"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 gass-flow-partner-link"
                                    >
                                        <Github className="w-4 h-4" />
                                        <span className="gass-flow-partner-name">michael-bey/gass</span>
                                    </a>
                                    <div className="flex items-center gap-2">
                                        <BaseLogoSimple className="w-4 h-4" />
                                        <span className="gass-flow-partner-name">BASE</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: action panel */}
                            <div className="gass-flow-right">
                                {!eligibilityResult && !loading && (
                                    <div className="gass-action-bar">
                                        <div className="gass-action-bar-content">
                                            <h3 className="gass-action-bar-title">Check Your Eligibility</h3>
                                            <p className="gass-action-bar-description">
                                                Your accounts are connected. Let&apos;s analyze your GitHub contributions to determine your reward tier.
                                            </p>
                                        </div>
                                        <button onClick={checkEligibility} className="gass-wizard-cta">
                                            Check Eligibility
                                        </button>
                                    </div>
                                )}

                                {loading && (
                                    <div className="flex flex-col items-center gap-3 py-8">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-indigo)' }} />
                                        <p className="gass-wizard-card-description">Analyzing your contribution data...</p>
                                    </div>
                                )}

                                {eligibilityResult && (
                                    <>
                                        {/* Scorecard — clean metric grid */}
                                        <div className="gass-scorecard">
                                            <div className="gass-scorecard-metric">
                                                <span className="gass-metric-value">{eligibilityResult.qualityScore ?? 0}</span>
                                                <div className="gass-metric-bar">
                                                    <div className="gass-metric-bar-fill" style={{ width: `${eligibilityResult.qualityScore ?? 0}%` }} />
                                                </div>
                                                <span className="gass-metric-label">Score</span>
                                            </div>
                                            <div className="gass-scorecard-divider" />
                                            <div className="gass-scorecard-metric">
                                                <span className="gass-metric-value">{eligibilityResult.reviewCount ?? 0}</span>
                                                <span className="gass-metric-label">Reviews</span>
                                            </div>
                                            <div className="gass-scorecard-divider" />
                                            <div className="gass-scorecard-metric">
                                                <span className={`gass-tier-label ${eligibilityResult.eligibleTier === RewardTier.BONUS ? 'bonus' : eligibilityResult.eligibleTier === RewardTier.LIMITED ? 'limited' : eligibilityResult.eligibleTier === RewardTier.NONE || eligibilityResult.eligibleTier === RewardTier.REJECTED ? 'none' : 'standard'}`}>
                                                    {eligibilityResult.eligibleTier}
                                                </span>
                                                <span className="gass-metric-label">Your Tier</span>
                                            </div>
                                        </div>

                                        {isEligible ? (
                                            <div className="gass-result-card eligible">
                                                <div className="gass-result-card-title">You&apos;re Eligible!</div>
                                                <p className="text-white/60 text-sm">
                                                    Your contributions qualify for the <strong>{eligibilityResult.eligibleTier}</strong> tier.
                                                </p>
                                                {!alreadyReceived ? (
                                                    <button
                                                        onClick={() => setCurrentStep(3)}
                                                        className="gass-wizard-cta"
                                                    >
                                                        Continue to Claim →
                                                    </button>
                                                ) : (
                                                    <div className="text-sm mt-4 flex items-center gap-2" style={{ color: 'var(--system-green)', opacity: 0.7 }}>
                                                        <Check className="w-4 h-4" /> Reward already claimed for this account.
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="gass-result-card ineligible">
                                                <div className="gass-result-card-title">Not Eligible</div>
                                                <p className="text-white/60 text-sm">
                                                    Your account does not meet the minimum contribution requirements.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Claim — two-column pre-claim / centered success */}
                    {currentStep === 3 && !rewardProcessed && (
                        <div className="gass-flow-columns">
                            {/* Left: reward summary */}
                            <div className="gass-flow-left gass-reward-summary">
                                <div className={`gass-tier-badge ${eligibilityResult?.eligibleTier === RewardTier.BONUS ? 'bonus' : eligibilityResult?.eligibleTier === RewardTier.LIMITED ? 'limited' : 'standard'}`}>
                                    {eligibilityResult?.eligibleTier || 'Standard'}
                                </div>
                                <div className="gass-reward-amount">
                                    <span className="gass-reward-amount-number">
                                        {eligibilityResult?.amount
                                            ? Number(eligibilityResult.amount / BigInt(10 ** 18))
                                            : eligibilityResult?.eligibleTier === RewardTier.LIMITED ? 50
                                            : eligibilityResult?.eligibleTier === RewardTier.BONUS ? 200
                                            : 100}
                                    </span>
                                    <span className="gass-reward-amount-ticker">GASS</span>
                                </div>
                                <div className="gass-reward-meta">
                                    <div className="gass-reward-meta-item">
                                        <Globe className="w-4 h-4" />
                                        <span>Base Sepolia</span>
                                    </div>
                                    <div className="gass-reward-meta-item">
                                        <Check className="w-4 h-4 text-green-400" />
                                        <span>Eligibility verified</span>
                                    </div>
                                </div>
                                <div className="gass-reward-footnote">
                                    Based on a quality score of <strong>{eligibilityResult?.qualityScore ?? 0}</strong>
                                </div>
                            </div>

                            {/* Right: confirm panel */}
                            <div className="gass-flow-right gass-claim-confirm">
                                <h3 className="gass-claim-confirm-title">Claim Your Reward</h3>
                                <p className="gass-claim-confirm-description">
                                    Confirm the transaction to receive your GASS tokens directly to your connected wallet.
                                </p>
                                <div className="gass-claim-wallet-block">
                                    <div className="gass-claim-wallet-label">Receiving wallet</div>
                                    <div className="gass-claim-wallet-address">
                                        {primaryWallet
                                            ? `${primaryWallet.address.substring(0, 10)}...${primaryWallet.address.slice(-8)}`
                                            : '—'}
                                    </div>
                                </div>
                                <button
                                    onClick={handleClaim}
                                    disabled={processingReward}
                                    className="gass-button-claim"
                                    style={{ width: '100%' }}
                                >
                                    {processingReward ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Processing...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <Zap className="w-5 h-5" fill="currentColor" />
                                            Confirm Claim
                                        </span>
                                    )}
                                </button>
                                <p className="gass-claim-footnote">Tokens arrive instantly. One claim per account.</p>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && rewardProcessed && (
                        <div className="gass-success-state">
                            <div className="gass-success-icon">
                                <CheckCircle className="w-9 h-9 text-green-400" />
                            </div>
                            <h3 className="gass-success-title">Tokens Sent!</h3>
                            <p className="gass-success-subtitle">
                                Your GASS tokens have been sent to your wallet on Base Sepolia.
                            </p>
                            {txHash && (
                                <div className="gass-tx-block">
                                    <div className="gass-tx-label">Transaction Hash</div>
                                    <div className="gass-tx-hash">{txHash}</div>
                                    <a
                                        href={`https://sepolia.basescan.org/tx/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="gass-tx-link"
                                    >
                                        <Globe className="w-3 h-3" />
                                        View on BaseScan →
                                    </a>
                                </div>
                            )}
                            <div className="gass-success-actions">
                                <button onClick={() => setCurrentStep(2)} className="gass-button gass-button-secondary">
                                    Start New Claim
                                </button>
                                {txHash && (
                                    <a
                                        href={`https://sepolia.basescan.org/tx/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="gass-button gass-button-outline"
                                    >
                                        <Globe className="w-4 h-4" />
                                        View on BaseScan
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* GLOBAL ERROR TOAST */}
            {error && (
                <div className="gass-alert gass-alert-error mt-6" role="alert">
                    <span className="gass-alert-icon">⚠</span>
                    <span>Error: {error}</span>
                    <button className="gass-error-dismiss" onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* DEBUG INFO */}
            {
                debugMode && contractCallInfo && (
                    <div className="mt-8 p-4 bg-black/40 border border-white/5 rounded-lg text-xs font-mono text-white/30 whitespace-pre-wrap">
                        {contractCallInfo}
                    </div>
                )
            }
        </div >
    );
}
