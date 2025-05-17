# Security Information

This document provides information about how to securely set up and use this repository after removing sensitive information.

## Setting Up Environment Variables

### GitHub Actions

The GitHub workflow uses the following secrets that should be set in your GitHub repository settings:

1. `O2_EMAIL` - Your O2 Oracle email
2. `O2_PASSWORD` - Your O2 Oracle password
3. `O2_APP_ID` - Your O2 Oracle application ID
4. `O2_PROP_LIST_ID` - Your O2 Oracle property list ID
5. `OPENROUTER_API_KEY` - Your OpenRouter API key

To set these secrets:
1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret" and add each of the secrets listed above

### Web Wallet Demo

For the web wallet demo, create a `.env.local` file in the `web-wallet-demo` directory with the following variables:

```
# Dynamic SDK Environment ID
NEXT_PUBLIC_DYNAMIC_ENV_ID=your_dynamic_env_id_here

# Dynamic API Key for backend verification
DYNAMIC_API_KEY=your_dynamic_api_key_here

# NextAuth configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_key_for_jwt_encryption

# GASS Contract Information
NEXT_PUBLIC_GASS_CONTRACT_ADDRESS=0x171A95CE45025f0AE0e56eC67Bf7084117e335d8
NEXT_PUBLIC_O2_ORACLE_ADDRESS=0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Base Sepolia Chain ID
NEXT_PUBLIC_BASE_SEPOLIA_CHAIN_ID=84532
```

### Local Testing Scripts

For local testing of O2 Oracle scripts, create a `.env` file in the `.github` directory with:

```
# O2 Oracle API credentials
O2_EMAIL=your_o2_email_here
O2_PASSWORD=your_o2_password_here
O2_APP_ID=your_o2_app_id_here
O2_PROP_LIST_ID=your_o2_prop_list_id_here

# OpenRouter API key for code review
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## Security Best Practices

1. **Never commit sensitive information**: Always use environment variables or GitHub secrets for sensitive information.
2. **Use .gitignore**: Make sure `.env`, `.env.local`, and other files containing secrets are in your `.gitignore` file.
3. **Rotate secrets regularly**: Periodically rotate your API keys and passwords.
4. **Limit access**: Only give access to your repository to trusted collaborators.
5. **Review GitHub Actions**: Be careful about which GitHub Actions you use, as they may have access to your secrets.

## What Was Removed

The following sensitive information was removed from the repository history:

1. O2 Oracle credentials (email, password, app ID)
2. Dynamic API key
3. Dynamic environment ID
4. NextAuth secret

If you believe any of these credentials may have been compromised, please rotate them immediately.
