import NextAuth from "next-auth";
import Github from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import queryDatabase from '../../../lib/database';

export default NextAuth({
    providers: [
        AzureADProvider(
            {clientId: process.env.AZURE_AD_CLIENT_ID, clientSecret: process.env.AZURE_AD_CLIENT_SECRET, tenantId: process.env.AZURE_AD_TENANT_ID}
        ),
        Github({}),
        CredentialsProvider(
            { // The name to display on the sign in form (e.g. 'Sign in with...')
                name: "Credentials",
                async authorize(credentials, req) {

                    try {
                        const userFound = await queryDatabase(`select * from Users where email='${
                            credentials.email
                        }' and user_password='${
                            credentials.password
                        }';`)

                        if (userFound.length != 0) {
                            console.log("User OK");
                            return userFound[0];
                        } else {
                            console.log("User NOK");
                            throw new Error("Invalid account");
                        }

                    } catch (err) {
                        throw new Error("Invalid account");
                    }
                }
            }
        ),
    ],
    pages: {
        signIn: "/signin",
        error: "/signin"
    },
    secret: "Sy21b2!G*&JY!GYGaknlngkdsbsi!NUI#GVUYT!^&Vy",
    callbacks: {
        async signIn(
            {
                user,
                account,
                profile,
                email,
                credentials
            }
        ) {
            return true;
        },
        async redirect(
            {url, baseUrl}
        ) {
            return url;
        },
        async session(
            {session, token, user}
        ) {

            const sqlQuery = `select * from Users where email='${
                session.user.email
            }';`
            const userFound = await queryDatabase(sqlQuery)      
                
            if (userFound.length != 0) {
                session.user = userFound[0] 
                return session;
            } else {
                throw new Error("Something went wrong");
            }
        },
        async jwt(
            {
                token,
                user,
                account,
                profile,
                isNewUser
            }
        ) {
            return token;
        }
    }
});
