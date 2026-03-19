# GASS - Github Activity Scoring System

A proof of concept designed to improve the airdrop claim experience by connecting GitHub contributions to token distribution. GASS provides a fair, transparent, and verifiable system for rewarding developers based on their actual contributions.

## Problem Statement

Traditional airdrops lack transparency, are vulnerable to Sybil attacks, and don't reward actual contributions. GASS solves these issues by connecting GitHub activity metrics to token distribution through a three-part system.

## System Components

GASS connects three key components to create a fair and transparent token distribution system:

1. **GitHub Action with OpenRouter**: Analyzes code reviews and pushes metrics to the O2 Oracle for tracking developers' projects and contributions.
   - [GitHub Action Workflow](/.github/workflows/push_quality_score.yml) and [Scripts](/.github/scripts/)
   - Deployed at `0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2` on Base Sepolia
   - Tracks quality scores, activity timestamps, and contribution volume
   - Automatically runs on pull request events (open, sync, reopen)

2. **Smart Contract with Forte Rules Engine**: Applies token allocation policies based on the metrics from the O2 Oracle.
   - [Smart Contracts](/src/) and [Deployment Scripts](/script/)
   - [Distribution Policy](/o2_oracle_policy.json)
   - Deployed at `0xF35C0460Df0678c21FE813971C5087B5fd03366A` on Base Sepolia
   - Uses policy rules to determine appropriate token distribution tiers

3. **Web App with Dynamic Authentication**: Verifies that users claiming rewards are the authorized GitHub users, with built-in wallet functionality.
   - [Web Wallet Demo](/web-wallet-demo/)
   - Provides seamless GitHub verification and wallet integration
   - Ensures only legitimate GitHub users can claim their tokens

### System Architecture

```mermaid
flowchart TD
    %% GitHub User
    User((GitHub User))

    %% Web App with Dynamic
    subgraph WebApp["Web App with Dynamic"]
        DynamicAuth["GitHub Authentication"]
        WalletIntegration["Embedded Wallet"]
    end

    %% GitHub Action
    subgraph GitHubAction["GitHub Action"]
        OpenRouter["OpenRouter Review Analysis"]
        MetricsCollection["Developer Metrics Collection"]
    end

    %% GASS Contract
    subgraph GASS["Smart Contract"]
        GASSContract["GASS Token Distribution<br/>0xF35C0460Df0678c21FE813971C5087B5fd03366A"]
    end

    %% Forte Rules Engine
    subgraph FRE["Forte Rules Engine"]
        Policy["Distribution Policy"]
        Rule1["Quality Score Rule"]
        Rule2["Activity Recency Rule"]
        Rule3["Contribution Volume Rule"]
    end

    %% O2 Oracle
    subgraph Oracle["O2 Oracle"]
        O2Contract["GitHub Activity Data<br/>0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2"]
    end

    %% Connections and Flow
    User -->|"1\. Authenticate with GitHub"| WebApp
    GitHubAction -->|"2\. Analyze contributions"| User
    GitHubAction -->|"3\. Store metrics"| Oracle
    WebApp -->|"4\. Verify GitHub identity"| User
    WebApp -->|"5\. Initiate claim"| GASS
    GASS -->|"6\. Check policy"| FRE
    FRE -->|"7\. Get metrics"| Oracle
    FRE -->|"8\. Apply rules"| GASS
    GASS -->|"9\. Distribute tokens"| User

    %% Internal connections
    Policy --- Rule1
    Policy --- Rule2
    Policy --- Rule3
    DynamicAuth --- WalletIntegration
    OpenRouter --- MetricsCollection
```

## How It Works

1. **GitHub Activity Analysis**: The GitHub Action uses OpenRouter to analyze code reviews and contributions, then pushes metrics to the O2 Oracle:
   - Triggered automatically on pull requests
   - Uses claude-opus-4.5 via OpenRouter API to perform code quality analysis
   - Calculates a quality score (0-100) based on code review
   - Tracks metrics like last activity timestamp and contribution count
   - Stores all data in the O2 Oracle for on-chain access

2. **Token Distribution Rules**: The Forte Rules Engine applies the following distribution tiers based on developer metrics:
   - **Rejected**: Quality score ≤ 50 (transaction reverts)
   - **Limited**: Quality score > 50, but activity not recent (half tokens)
   - **Bonus**: Quality score > 50, recent activity, high contribution volume (double tokens)
   - **Standard**: Quality score > 50, recent activity, normal contribution volume (standard amount)

3. **Verified Claims**: The web app uses Dynamic to verify GitHub identity and provide wallet functionality:
   - Users authenticate with GitHub through Dynamic
   - The app verifies the user is the legitimate GitHub account owner
   - Users can check their rewards eligibility with visual indicators for each tier
   - The interface displays detailed contract call information including quality score, last contribution date, and review count
   - Users can claim tokens directly through the integrated wallet with a single click

## Key Benefits

1. **Meritocratic Distribution**: Tokens are allocated based on actual contributions
2. **Sybil Resistance**: Distribution requires verified GitHub accounts and real activity
3. **Transparent Rules**: All distribution criteria are publicly visible on-chain
4. **Flexible Policies**: Distribution rules can be updated without changing contract code
5. **Seamless Experience**: Integrated verification and wallet functionality

## Technical Implementation

### GitHub Action

You can easily integrate GASS into your own repository using the official GitHub Action.

**Usage:**

Create a workflow file (e.g., `.github/workflows/gass.yml`):

```yaml
name: GASS Analysis
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: GASS Code Quality Score
        uses: michael-bey/gass@main
        with:
          o2_email: ${{ secrets.O2_EMAIL }}
          o2_password: ${{ secrets.O2_PASSWORD }}
          o2_app_id: ${{ secrets.O2_APP_ID }}
          o2_prop_list_id: ${{ secrets.O2_PROP_LIST_ID }}
          openrouter_api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

The action will:
1. Automatically fetch the PR diff.
2. Send it to OpenRouter (claude-opus-4.5) for analysis.
3. Calculate a quality score.
4. Update the developer's metrics in the O2 Oracle.

### Smart Contract

The GASS contract is deployed at `0xF35C0460Df0678c21FE813971C5087B5fd03366A` on Base Sepolia with Policy ID `6`. It uses the Forte Rules Engine to apply distribution rules based on O2 Oracle data.

### O2 Oracle

The O2 Oracle at `0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2` stores developer metrics:
- Quality scores (code quality assessment)
- Last updated timestamps (recency of activity)
- Review counts (contribution volume)

### Web App with Dynamic

The web app uses Dynamic for GitHub authentication and wallet functionality:
- Verifies GitHub identity through OAuth
- Provides embedded wallet functionality
- Connects to Base Sepolia network
- Interacts with the GASS contract for token claims
- Features a clean UI with dark/light mode toggle
- Shows visual indicators for reward tier eligibility
- Displays detailed contract call information

## GitHub Verification

We've implemented two approaches for GitHub verification:

1. **JWT-Based Verification** (Recommended): Uses Dynamic's JWT verification system
   - User authenticates with GitHub through Dynamic
   - Backend verifies JWT token with Dynamic's API
   - Contract accepts verification from trusted backend

2. **Signature-Based Verification**: Uses on-chain signature verification
   - User signs a message containing GitHub username and wallet address
   - Contract verifies the signature matches the claiming wallet

## Sample Data

The O2 Oracle contains the following developer metrics:

| GitHub Username | Quality Score | Last Updated | Review Count | Expected Distribution Tier |
|-----------------|--------------|--------------|-------------|---------------------------|
| michael-bey       | 63           | 1747331744   | 25          | Limited (50% allocation) |

## Use Cases

This proof of concept can be extended for:
- Token airdrops based on community contributions
- Retroactive funding for open source developers
- DAO governance token distribution
- Community rewards programs
- Contributor reputation systems

## Web App Interface

The GASS web application provides a clean, intuitive interface for users to connect their GitHub accounts and check their rewards eligibility. The UI features a modern design with both dark and light mode options, debug and simulation mode toggles, and clear visual indicators for verification status.

![GASS Web App Interface - Main Screen](images/gass-main-screen.png)

After connecting, users can see their eligibility for different reward tiers based on their GitHub activity metrics. Each tier displays a green checkmark for eligible tiers or a red X for ineligible tiers, along with the specific criteria for each tier. The interface also shows detailed contract call information including quality score, last contribution date, and review count.

![GASS Web App Interface - Rewards Screen](images/gass-rewards-screen.png)

### Demo Video

Watch a demonstration of the GASS application in action. The video shows the complete user journey from connecting a wallet and authenticating with GitHub to checking rewards eligibility and claiming tokens. It demonstrates how the system verifies GitHub identity, retrieves metrics from the O2 Oracle, applies the distribution policy rules, and processes the reward claim:

https://github.com/michael-bey/gass/raw/main/images/gass-demo-video.mp4

## Production Deployment

The GASS system is deployed on Base Sepolia testnet:
- **Smart Contract**: `0xF35C0460Df0678c21FE813971C5087B5fd03366A`
- **GASS Token**: `0x777E1Ad0Cfb52abbF5A5F70dB4382CC166d8DFf7`
- **O2 Oracle**: `0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2`
- **Forte Rules Engine**: `0x6189A916E3f190Bf3cE6247b7A0dE862d1De8387`
- **Block Explorer**: [View on BaseScan](https://sepolia.basescan.org/address/0xF35C0460Df0678c21FE813971C5087B5fd03366A)
