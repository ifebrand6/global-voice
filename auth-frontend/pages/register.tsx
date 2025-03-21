import { useState } from "react";
import { useMutation, gql } from "@apollo/client";
import { useRouter } from "next/router";

const REGISTER = gql`
    mutation Register($username: String!, $email: String!, $password: String!) {
        register(username: $username, email: $email, password: $password) {
            username
        }
    }
`;

export default function Register() {
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [register, { loading, error }] = useMutation(REGISTER);
    const router = useRouter();

    const handleRegister = async () => {
        await register({ variables: form });
        alert("Registered successfully!");
        router.push("/login");
    };

    return (
        <div className="container mt-5">
            <h2>Register</h2>
            {error && <p className="text-danger">{error.message}</p>}
            <input type="text" placeholder="Username" className="form-control"
                onChange={e => setForm({ ...form, username: e.target.value })} />
            <input type="email" placeholder="Email" className="form-control"
                onChange={e => setForm({ ...form, email: e.target.value })} />
            <input type="password" placeholder="Password" className="form-control"
                onChange={e => setForm({ ...form, password: e.target.value })} />
            <button onClick={handleRegister} className="btn btn-primary mt-3" disabled={loading}>
                {loading ? "Registering..." : "Register"}
            </button>
        </div>
    );
}
