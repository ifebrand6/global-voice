import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { gql, useQuery } from '@apollo/client';

const CURRENT_USER_QUERY = gql`
  query CurrentUser {
    currentUser {
      id
      email
      loginAttempts
      isLocked
    }
  }
`;

export default function Dashboard() {
  const router = useRouter();
  const { data, loading, error } = useQuery(CURRENT_USER_QUERY);

  useEffect(() => {
    console.log('Current User State:', { data, loading, error });

    if (!loading && (error || !data?.currentUser)) {
      console.log('Redirecting to login: No user data or error');
      // router.push('/login');
    }
  }, [loading, data, error, router]);

  const handleLogout = async () => {
    await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: 'mutation { logout }' }),
    });
    router.push('/login');
  };

  if (loading) return (
    <div className="text-center mt-5">
      <div className="spinner-border" role="status"></div>
    </div>
  );

  if (error || !data?.currentUser) {
    console.log('Rendering null due to error or no user');
    return null; // Wait for redirect
  }

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">Dashboard</h1>
      <div className="card p-4">
        <h2>Welcome, {data.currentUser.email}!</h2>
        <p>ID: {data.currentUser.id}</p>
        <p>Login Attempts: {data.currentUser.loginAttempts}</p>
        <p>Account Locked: {data.currentUser.isLocked ? 'Yes' : 'No'}</p>
        <button className="btn btn-danger" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
