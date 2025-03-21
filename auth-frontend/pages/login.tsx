import { useState } from "react";
import { useMutation, gql } from "@apollo/client";
import { useRouter } from "next/router";
import Cookies from "js-cookie";

const LOGIN = gql`
    mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password)
    }
`;

export default function Login() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [login, { loading, error }] = useMutation(LOGIN);
    const router = useRouter();

    const handleLogin = async () => {
        const { data } = await login({ variables: form });
        Cookies.set("token", data.login, { expires: 1 });
        alert("Logged in!");
        router.push("/dashboard");
    };

    return (
        <div className="container mt-5">
            <h2>Login</h2>
            {error && <p className="text-danger">{error.message}</p>}
            <input type="email" placeholder="Email" className="form-control"
                onChange={e => setForm({ ...form, email: e.target.value })} />
            <input type="password" placeholder="Password" className="form-control"
                onChange={e => setForm({ ...form, password: e.target.value })} />
            <button onClick={handleLogin} className="btn btn-primary mt-3" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
            </button>
        </div>
    );
}
