import { graphql, buildSchema } from 'graphql';
import { MongoClient, ObjectId } from 'mongodb';
import * as http from 'http';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

// Validate environment variables
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

// GraphQL Schema
const schema = buildSchema(`
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
`);

interface User {
    _id: ObjectId;
    email: string;
    password: string;
    loginAttempts: number;
    isLocked: boolean;
}

function generateToken(user: { _id: ObjectId; email: string }): string {
    return jwt.sign(
        { id: user._id.toString(), email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function parseCookies(req: http.IncomingMessage): { [key: string]: string } {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        acc[name] = value;
        return acc;
    }, {} as { [key: string]: string });
}

function setCORSHeaders(res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

const root = {
    currentUser: async (_: any, __: any, context: { req: http.IncomingMessage }) => {
        console.log("inddd >>", context.req); // Should now log the request object
        const cookies = parseCookies(context.req);
        const token = cookies['auth-token'];
        console.log('Cookies received:', cookies);
        if (!token) {
            console.log('No token, returning null');
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
            console.log('Returning user:', user);
            return { id: user._id.toString(), email: user.email, loginAttempts: user.loginAttempts, isLocked: user.isLocked };
        } catch (err) {
            console.log('Token verification failed:', err);
            return null;
        }
    },

    register: async ({ email, password }: { email: string; password: string }, context: { res: http.ServerResponse }) => {
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

        context.res.setHeader('Set-Cookie', `auth-token=${token}; HttpOnly; Path=/; Max-Age=3600; SameSite=Strict`);
        return { id: result.insertedId.toString(), email, loginAttempts: 0, isLocked: false };
    },

    login: async ({ email, password }: { email: string; password: string }, context: { res: http.ServerResponse }) => {
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
            throw new Error(`Invalid password. Attempt ${newAttempts}/5.`);
        }

        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { loginAttempts: 0, isLocked: false } }
        );

        const token = generateToken({ _id: user._id, email });
        context.res.setHeader('Set-Cookie', `auth-token=${token}; HttpOnly; Path=/; Max-Age=360000; SameSite=Strict`);
        return { id: user._id.toString(), email, loginAttempts: 0, isLocked: false };
    },

    logout: (_: any, __: any, context: { res: http.ServerResponse }) => {
        context.res.setHeader('Set-Cookie', `auth-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`);
        return true;
    },
};

// HTTP Server with proper context passing
async function startServer() {
    await connectDB();

    const server = http.createServer(async (req, res) => {
        console.log(`Request received: ${req.method} ${req.url}`);
        setCORSHeaders(res);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method === 'POST' && req.url === '/graphql') {
            let body = '';
            req.on('data', chunk => (body += chunk.toString()));
            req.on('end', async () => {
                try {
                    const { query, variables } = JSON.parse(body);
                    const response = await graphql({
                        schema,
                        source: query,
                        rootValue: root,
                        contextValue: { req, res }, // Pass req and res to context
                        variableValues: variables,
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(response));
                } catch (err: any) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ errors: [{ message: err.message }] }));
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(err => console.error('Server failed to start:', err));
