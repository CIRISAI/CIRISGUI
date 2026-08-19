'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import { cirisClient } from '../../../../../lib/ciris-sdk';
import { AuthStore } from '../../../../../lib/ciris-sdk/auth-store';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const { setUser, setToken } = useAuth();
  
  // Extract dynamic route parameters
  const agentId = params.agent as string;
  const provider = params.provider as string;

  useEffect(() => {
    const handleCallback = async () => {
      // Configure SDK with agent-specific base URL for managed mode
      // In managed mode: /api/{agent_id}/v1/...
      // In standalone mode: use env variable or origin
      // DEPLOYMENT SHAPE IS NOT A HOSTNAME (CIRISServer#439).
      //
      // This was `hostname === 'agents.ciris.ai' || path.startsWith('/api/')`.
      // The literal classified every OTHER hosted node — scout included — as
      // standalone, so its API base URL was built wrong. A client cannot derive
      // this; the node knows it at boot and now states it on
      // GET /v1/auth/oauth/providers as `managed` / `callback_base`.
      //
      // The path check STAYS and leads, because it is a fact about the URL this
      // page is being served at, needs no round trip, and is what lets us reach
      // the node at all in order to ask it anything. The hostname literal is
      // gone: a node reached at a bare origin is standalone whatever it is
      // called, and one reached under a path prefix is managed whatever it is
      // called.
      const isManagedPath = window.location.pathname.startsWith('/api/');
      const baseURL = isManagedPath
        ? `${window.location.origin}/api/${agentId}`
        : (process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin);

      cirisClient.setConfig({ baseURL });

      // Handle the OAuth token response from API
      const accessToken = searchParams.get('access_token');
      const tokenType = searchParams.get('token_type');
      const role = searchParams.get('role');
      const userId = searchParams.get('user_id');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // REDEEM THE SINGLE-USE CODE (CIRISServer#439).
      //
      // The node no longer echoes a bearer back in the URL — that put a live
      // 24h credential into browser history, the `Referer` of every subsequent
      // request, and every proxy log on the path. It parks the session and
      // hands this page a one-time code instead, which we exchange for the
      // session in a POST response BODY.
      //
      // The legacy query-param branch below is KEPT, not replaced: a node that
      // has not adopted the exchange yet still signs users in, and this page
      // has to work against both while the fleet rolls forward.
      let session: {
        access_token: string;
        token_type: string;
        role: string;
        user_id: string;
        expires_in?: number;
      } | null = null;

      const exchangeCode = searchParams.get('ciris_code');
      if (exchangeCode) {
        try {
          const res = await fetch(`${baseURL}/v1/auth/oauth/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: exchangeCode }),
          });
          if (res.ok) {
            session = await res.json();
          } else {
            // The node refused. It says WHY (`reason_id`), and that reason is
            // the user's — an expired code needs a retry, a refused identity
            // does not. Losing it here is how this whole class of bug started.
            const detail = await res.json().catch(() => null);
            console.error(
              `OAuth exchange refused by ${baseURL}:`,
              detail?.reason_id ?? res.status,
              detail?.error ?? ''
            );
          }
        } catch (e) {
          console.error('OAuth exchange request failed:', e);
        }
      }

      // Set the token in the SDK BEFORE making any API calls
      if (session?.access_token) {
        AuthStore.saveToken({
          access_token: session.access_token,
          token_type: session.token_type || 'Bearer',
          expires_in: session.expires_in ?? 3600,
          user_id: session.user_id,
          role: session.role,
          created_at: Date.now()
        });
      } else if (accessToken && tokenType && role && userId) {
        AuthStore.saveToken({
          access_token: accessToken,
          token_type: tokenType,
          expires_in: 3600, // Default 1 hour
          user_id: userId,
          role: role,
          created_at: Date.now()
        });
      }

      // Check if this is an account linking operation
      const oauthIntention = localStorage.getItem('oauthIntention');
      const isLinking = oauthIntention === 'link';

      // Handle OAuth errors
      if (error) {
        console.error(`OAuth error from ${provider}:`, error, errorDescription);
        const redirectUrl = isLinking
          ? `/account?error=oauth_failed&provider=${provider}&description=${encodeURIComponent(errorDescription || error)}`
          : `/login?error=oauth_failed&provider=${provider}&description=${encodeURIComponent(errorDescription || error)}`;
        router.push(redirectUrl);
        return;
      }

      // ONE set of resolved values from here down, whichever route produced
      // them — the exchange or the legacy query params. Before this the page
      // read the query params directly, so a session obtained by exchange was
      // saved to the AuthStore and then treated as absent three lines later.
      const resolvedToken = session?.access_token ?? accessToken;
      const resolvedTokenType = session?.token_type ?? tokenType;
      const resolvedRole = session?.role ?? role;
      const resolvedUserId = session?.user_id ?? userId;

      if (resolvedToken && resolvedTokenType && resolvedRole && resolvedUserId) {
        if (isLinking) {
          // This is an account linking operation - actually link the account
          try {
            // Get current user to link the OAuth account
            const currentUser = await cirisClient.auth.getMe();

            // Extract OAuth account details from query params
            const accountName = searchParams.get('account_name') || resolvedUserId;
            const email = searchParams.get('email');

            // Call API to link the OAuth account
            await cirisClient.users.linkOAuthAccount(currentUser.user_id, {
              provider: provider,
              external_id: resolvedUserId,
              account_name: accountName,
              metadata: email ? { email } : {}
            });

            console.log(`Account linking successful for ${provider} (${accountName})`);

            // Clean up linking-specific localStorage items
            localStorage.removeItem('oauthIntention');
            localStorage.removeItem('oauthProvider');

            // Redirect back to account page with success message
            const returnUrl = localStorage.getItem('oauthReturnUrl') || '/account';
            localStorage.removeItem('oauthReturnUrl');
            router.push(`${returnUrl}?linked=${provider}&success=true`);
          } catch (linkError) {
            console.error(`Failed to link ${provider} account:`, linkError);
            const returnUrl = localStorage.getItem('oauthReturnUrl') || '/account';
            localStorage.removeItem('oauthReturnUrl');
            router.push(`${returnUrl}?error=link_failed&provider=${provider}&description=${encodeURIComponent(linkError instanceof Error ? linkError.message : 'Unknown error')}`);
          }
        } else {
          // This is a login operation - set authentication state
          const user = {
            user_id: resolvedUserId,
            username: resolvedUserId,
            role: resolvedRole as any,
            api_role: resolvedRole as any,
            wa_role: undefined,
            permissions: [],
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          };

          setToken(resolvedToken);
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
        }
      } else {
        // NO TOKEN, BUT NO ERROR EITHER — these are not the same failure.
        //
        // `error` is null here: the provider did not reject anything. The
        // callback simply arrived without the credential this page needs, which
        // is what a node does when it completes the sign-in and keeps the
        // session rather than echoing it back in the URL. Reporting that as
        // `oauth_failed` tells the user Google turned them away, sends them to
        // re-authenticate, and hides the fact that they are already signed in as
        // far as the node is concerned. Give it its own code so the message can
        // say what actually happened.
        // /account renders `description || error` straight into a toast, so
        // without one it would show the user the literal string "no_session".
        // /login maps the code to its own sentence and needs no description.
        const noSessionDetail = encodeURIComponent(
          "the sign-in completed but this agent returned no session to your browser"
        );
        const redirectUrl = isLinking
          ? `/account?error=no_session&provider=${provider}&agent=${agentId}&description=${noSessionDetail}`
          : `/login?error=no_session&provider=${provider}&agent=${agentId}`;
        router.push(redirectUrl);
      }
    };

    handleCallback();
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