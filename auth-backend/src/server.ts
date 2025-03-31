import { ApolloServer } from 'apollo-server';
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/authdb';
const PORT = process.env.PORT || 5000;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in .env');
}

// MongoDB connection
let db: any;

async function connectDB() {
    const client = await MongoClient.connect(MONGO_URI);
    db = client.db();
    console.log('Connected to MongoDB');
}

// GraphQL Schema (typeDefs)
const typeDefs = `
    type User {
        id: ID!
        email: String!
        loginAttempts: Int
        isLocked: Boolean
    }
    type Query {
        currentUser: User
    }
    type Mutation {
        register(email: String!, password: String!): User
        login(email: String!, password: String!): User
        logout: Boolean
    }
`;

// Helper function to generate JWT
function generateToken(user: { _id: ObjectId; email: string }): string {
    return jwt.sign(
        { id: user._id.toString(), email: user.email },
        JWT_SECRET,
        { expiresIn: '1d' }
    );
}

// Resolvers
const resolvers = {
    Query: {
        currentUser: async (_parent: any, _args: any, { req }: { req: any }) => {
            console.log('context.req:', req);
            const token = req.headers.cookie
                ? Object.fromEntries(req.headers.cookie.split(';').map((c: string) => c.trim().split('=')))['auth-token']
                : null;
            console.log('Extracted token:', token);
            if (!token) {
                console.log('No token found, returning null');
                return null;
            }
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
                const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });
                console.log('User found:', user);
                if (!user || user.isLocked) {
                    console.log('User not found or locked, returning null');
                    return null;
                }
                return {
                    id: user._id.toString(),
                    email: user.email,
                    loginAttempts: user.loginAttempts,
                    isLocked: user.isLocked,
                };
            } catch (err) {
                console.log('Token verification failed:', err);
                return null;
            }
        },
    },
    Mutation: {
        register: async (_parent: any, { email, password }: { email: string; password: string }, { res }: { res: any }) => {
            const existingUser = await db.collection('users').findOne({ email });
            if (existingUser) throw new Error('User already exists');

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = {
                email,
                password: hashedPassword,
                loginAttempts: 0,
                isLocked: false,
            };

            const result = await db.collection('users').insertOne(user);
            const token = generateToken({ _id: result.insertedId, email });

            res.setHeader('Set-Cookie', `auth-token=${token}; HttpOnly; Path=/; Max-Age=3600; SameSite=Strict`);
            return { id: result.insertedId.toString(), email, loginAttempts: 0, isLocked: false };
        },
        login: async (_parent: any, { email, password }: { email: string; password: string }, { res }: { res: any }) => {
            const user = await db.collection('users').findOne({ email });
            if (!user) throw new Error('Invalid credentials');
            if (user.isLocked) throw new Error('Account is locked due to too many failed attempts');

            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                const newAttempts = user.loginAttempts + 1;
                const isLocked = newAttempts >= 5;
                await db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { loginAttempts: newAttempts, isLocked } }
                );
                throw new Error(`Invalid password. Attempt ${newAttempts}/5`);
            }

            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { loginAttempts: 0, isLocked: false } }
            );

            const token = generateToken({ _id: user._id, email });
            res.setHeader('Set-Cookie', `auth-token=${token}; HttpOnly; Path=/; Max-Age=360000; SameSite=Strict`);
            return { id: user._id.toString(), email, loginAttempts: 0, isLocked: false };
        },
        logout: async (_parent: any, _args: any, { res }: { res: any }) => {
            res.setHeader('Set-Cookie', `auth-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`);
            return true;
        },
    },
};

// Create Apollo Server instance
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req, res }) => ({ req, res }), // Pass req and res to resolvers
    cors: {
        origin: 'http://localhost:3000', // Your Next.js frontend
        credentials: true, // Allow cookies to be sent
    },
});

// Start the server
async function startServer() {
    await connectDB();
    server.listen({ port: PORT }).then(({ url }) => {
        console.log(`Server running at ${url}`);
    });
}

startServer().catch(err => console.error('Server failed to start:', err));
