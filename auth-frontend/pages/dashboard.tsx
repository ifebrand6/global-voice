import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/router";

export default function Dashboard() {
    const [token, setToken] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const storedToken = Cookies.get("token");
        if (!storedToken) {
            router.push("/login");
        } else {
            setToken(storedToken);
        }
    }, [router]);

    const handleLogout = () => {
        Cookies.remove("token");
        router.push("/login");
    };

    if (!token) return <p>Loading...</p>;

    return (
        <div className="container mt-5">
            <h2>Welcome to the Dashboard</h2>
            <button onClick={handleLogout} className="btn btn-danger mt-3">Logout</button>
        </div>
    );
}
