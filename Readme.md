# Authentication Assignment

## Overview

This project implements a basic **authentication system** using **GraphQL** for communication and **JWT (JSON Web Token)** for securing API requests. It allows users to register, log in, view their profile, and log out, with sessions managed using cookies.

The application also supports handling of failed login attempts and account locking after multiple failed attempts.

## Features

- **User Registration**: Allows users to create an account with an email and password.
- **Login & Authentication**: Users can log in using their credentials, and an authentication token (JWT) is returned for secure access.
- **Session Management**: The server manages user sessions using HTTP-only cookies.
- **Account Locking**: If a user fails to log in after 5 attempts, their account is locked.
- **GraphQL API**: Communication is handled via GraphQL queries and mutations.
- **Logout**: The user can log out, which invalidates the authentication token.

## Technologies Used

- **Backend**: Node.js, GraphQL, Express (for server), JWT (JSON Web Token) for authentication.
- **Database**: MongoDB for storing user credentials and session information.
- **Password Hashing**: bcryptjs for hashing and comparing passwords securely.
- **Environment Variables**: dotenv for managing environment variables like the JWT secret and database URI.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/auth-assignment.git

2. Install Dependencies
Navigate to the project directory and install the required dependencies:

3. Set Up Environment Variables
Create a .env file in the root of the project and add the following variables:
JWT_SECRET=your-secret-key
MONGO_URI=mongodb://localhost:27017/authdb
PORT=5000


