import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';

// Dynamic environment ID from .env
const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
const DYNAMIC_API_KEY = process.env.DYNAMIC_API_KEY;

/**
 * Verify a JWT token with Dynamic's API
 * @param token The JWT token to verify
 * @returns The user data if verification is successful
 */
async function verifyDynamicJwt(token: string) {
  try {
    const response = await axios.get('https://app.dynamic.xyz/api/v0/verify-jwt', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-dynamic-env-id': DYNAMIC_ENV_ID,
        'x-api-key': DYNAMIC_API_KEY
      }
    });

    if (response.status === 200) {
      return response.data;
    }
    
    throw new Error('Failed to verify JWT token');
  } catch (error) {
    console.error('Error verifying JWT with Dynamic:', error);
    throw error;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'dynamic',
      name: 'Dynamic',
      credentials: {
        jwt: { label: 'JWT Token', type: 'text' }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.jwt) {
            return null;
          }

          // Verify the JWT token with Dynamic
          const userData = await verifyDynamicJwt(credentials.jwt);
          
          // Find GitHub credential
          const githubCredential = userData.verifiedCredentials?.find(
            (cred: any) => cred.format === 'oauth' && cred.oauthProvider === 'github'
          );

          if (!githubCredential) {
            throw new Error('No GitHub credential found');
          }

          // Find wallet credential
          const walletCredential = userData.verifiedCredentials?.find(
            (cred: any) => cred.address
          );

          // Return user data
          return {
            id: userData.id,
            name: githubCredential.oauthUsername || userData.alias || userData.email,
            email: userData.email,
            image: githubCredential.oauthAccountPhotos?.[0] || null,
            githubUsername: githubCredential.oauthUsername,
            walletAddress: walletCredential?.address || null,
            jwt: credentials.jwt
          };
        } catch (error) {
          console.error('Error in authorize:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Add user data to the token
      if (user) {
        token.id = user.id;
        token.githubUsername = user.githubUsername;
        token.walletAddress = user.walletAddress;
        token.jwt = user.jwt;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data to the session
      if (token) {
        session.user.id = token.id as string;
        session.user.githubUsername = token.githubUsername as string;
        session.user.walletAddress = token.walletAddress as string;
        session.jwt = token.jwt as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/',
    error: '/'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key'
};

export default NextAuth(authOptions);
