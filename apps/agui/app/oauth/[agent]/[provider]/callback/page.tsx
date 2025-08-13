'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const { setUser, setToken } = useAuth();
  
  // Extract dynamic route parameters
  const agentId = params.agent as string;
  const provider = params.provider as string;

  useEffect(() => {
    // Handle the OAuth token response from API
    const accessToken = searchParams.get('access_token');
    const tokenType = searchParams.get('token_type');
    const role = searchParams.get('role');
    const userId = searchParams.get('user_id');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error(`OAuth error from ${provider}:`, error, errorDescription);
      router.push(`/login?error=oauth_failed&provider=${provider}&description=${encodeURIComponent(errorDescription || error)}`);
      return;
    }

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

      // Store agent info with proper formatting
      const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
      localStorage.setItem('selectedAgentId', agentId);
      localStorage.setItem('selectedAgentName', agentName);
      localStorage.setItem('authProvider', provider);

      // Redirect to dashboard or originally requested page
      const returnUrl = localStorage.getItem('authReturnUrl') || '/';
      localStorage.removeItem('authReturnUrl');
      router.push(returnUrl);
    } else {
      // If no token, redirect to login with error
      router.push(`/login?error=oauth_failed&provider=${provider}&agent=${agentId}`);
    }
  }, [searchParams, router, setUser, setToken, agentId, provider]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center space-y-4">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Completing {provider} authentication...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connecting to {agentId} agent
        </p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</h2>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}