import { graphql, buildSchema } from 'graphql';
import { MongoClient, ObjectId } from 'mongodb';
import * as http from 'http';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

// Validate environment variables
const JWT_SECRET = process.env.JWT_SECRET as string; // Type assertion since we validate it
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
        token: String
        loginAttempts: Int
        isLocked: Boolean
    }

    type Query {
        currentUser(token: String!): User
    }

    type Mutation {
        register(email: String!, password: String!): User
        login(email: String!, password: String!): User
        logout(token: String!): Boolean
    }
`);

// User interface
interface User {
    _id: ObjectId;
    email: string;
    password: string;
    loginAttempts: number;
    isLocked: boolean;
}

// Helper function to generate JWT
function generateToken(user: { _id: ObjectId; email: string }): string {
    return jwt.sign(
        { id: user._id.toString(), email: user.email }, // Payload
        JWT_SECRET,                                     // Secret
        { expiresIn: '1h' }                             // Options
    );
}

// Resolvers
const root = {
    currentUser: async ({ token }: { token: string }) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
            const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.id) });
            if (!user || user.isLocked) return null;
            return { id: user._id, email: user.email, token, loginAttempts: user.loginAttempts, isLocked: user.isLocked };
        } catch (err) {
            return null;
        }
    },

    register: async ({ email, password }: { email: string; password: string }) => {
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
        return { id: result.insertedId, email, token, loginAttempts: 0, isLocked: false };
    },

    login: async ({ email, password }: { email: string; password: string }) => {
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
        return { id: user._id, email, token, loginAttempts: 0, isLocked: false };
    },

    logout: ({ token }: { token: string }) => {
        return true;
    },
};

// HTTP Server
async function startServer() {
    await connectDB();

    const server = http.createServer(async (req, res) => {
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
                        contextValue: { db },
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
