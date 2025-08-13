'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';

function GoogleOAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser, setToken } = useAuth();

  useEffect(() => {
    // Handle the OAuth token response from API
    const accessToken = searchParams.get('access_token');
    const tokenType = searchParams.get('token_type');
    const role = searchParams.get('role');
    const userId = searchParams.get('user_id');

    if (accessToken && tokenType && role && userId) {
      // Set the authentication state
      const user = {
        user_id: userId,
        username: userId,
        role: role as any, // Role comes as string from query params
        api_role: role as any,
        wa_role: undefined,
        permissions: [],
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      };

      setToken(accessToken);
      setUser(user);

      // Store agent info
      localStorage.setItem('selectedAgentId', 'datum');
      localStorage.setItem('selectedAgentName', 'Datum');

      // Redirect to dashboard
      router.push('/dashboard');
    } else {
      // If no token, redirect to login with error
      router.push('/login?error=oauth_failed');
    }
  }, [searchParams, router, setUser, setToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-gray-900">Completing authentication...</h2>
      </div>
    </div>
  );
}

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Loading...</h2>
        </div>
      </div>
    }>
      <GoogleOAuthCallbackContent />
    </Suspense>
  );
}
