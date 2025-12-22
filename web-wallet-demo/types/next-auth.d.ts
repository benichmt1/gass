import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            id: string
            githubUsername?: string
            walletAddress?: string
        } & DefaultSession["user"]
        jwt?: string
    }

    interface User {
        githubUsername?: string
        walletAddress?: string
        jwt?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string
        githubUsername?: string
        walletAddress?: string
        jwt?: string
    }
}
