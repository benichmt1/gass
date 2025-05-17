# Setting Up GitHub Authentication for Dynamic

This guide will walk you through the process of setting up GitHub OAuth for your Dynamic application.

## Step 1: Create a GitHub OAuth Application

1. Go to the [GitHub Developer Settings](https://github.com/settings/developers) page and sign in to your account.
   - If you're on your profile page, click "Developer Settings" at the bottom of the left-hand menu.

2. Click on the "OAuth Apps" menu and then "Register a new application".

3. Fill in the application details:
   - **Application name**: Choose a name for your application (e.g., "Dynamic GitHub Demo")
   - **Homepage URL**: Enter your application's homepage URL (e.g., `http://localhost:3000` for local development)
   - **Application description**: Optional description of your application
   - **Authorization callback URL**: This is the most important field. You'll need to get this from Dynamic.

## Step 2: Get the Callback URL from Dynamic

1. Sign in to your [Dynamic Dashboard](https://app.dynamic.xyz/dashboard)
2. Navigate to "Log In & User Profile" in the left sidebar
3. Click on "Social Sign Up"
4. Find the GitHub section and click to expand it
5. Copy the "Redirect URL" provided by Dynamic

## Step 3: Complete GitHub OAuth App Registration

1. Paste the Dynamic Redirect URL into the "Authorization callback URL" field in GitHub
2. Click "Register application"
3. GitHub will create an OAuth app and redirect you to the details page
4. Click "Generate a new client secret" button
5. Copy both the "Client ID" and "Client secret"

## Step 4: Configure Dynamic with GitHub Credentials

1. Go back to the Dynamic Dashboard
2. In the GitHub section of Social Sign Up, paste your GitHub Client ID and Client Secret
3. Click "Confirm" to save the settings

## Step 5: Update Your Application Environment Variables

1. In your application's `.env.local` file, add your Dynamic environment ID:

```
NEXT_PUBLIC_DYNAMIC_ENV_ID="your-dynamic-environment-id"
```

2. Get your Dynamic environment ID from the [API Keys page](https://app.dynamic.xyz/dashboard/developer/api) in the Dynamic Dashboard

## Step 6: Run Your Application

1. Start your application with:

```bash
npm run dev
```

2. Navigate to `http://localhost:3000` in your browser
3. You should now be able to log in with GitHub and get a crypto wallet

## Troubleshooting

- If GitHub authentication isn't working, double-check that the callback URL in GitHub matches exactly with the one provided by Dynamic
- Make sure your Dynamic environment ID is correctly set in your `.env.local` file
- Check that GitHub is enabled in your Dynamic provider configuration
- For local development, make sure your GitHub OAuth app's homepage URL is set to `http://localhost:3000`
