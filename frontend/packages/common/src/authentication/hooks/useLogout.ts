import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppRoute } from '@openmsupply-client/config';
import { RouteBuilder } from '../../utils/navigation';
import { useLocalStorage } from '../../localStorage';
import { useAuthApi } from '../api/hooks';
import { clearAuthState } from '../AuthContext';

// Build-time flag — true only when running yarn start-demo
declare const DEMO_MODE: boolean;
const isDemoMode = typeof DEMO_MODE !== 'undefined' && DEMO_MODE;

/**
 * Logs the user out:
 *   1. Calls the server `logout` query — revokes the session and clears the HttpOnly cookie.
 *      Errors are swallowed (already-expired session / network problem shouldn't block local
 *      cleanup; the goal is "ensure no live session").
 *   2. Clears the locally cached auth state and any auth-error indicator.
 *   3. Navigates to /login.
 */
export const useLogout = () => {
  const api = useAuthApi();
  const navigate = useNavigate();
  const [, , removeAuthError] = useLocalStorage('/error/auth');

  return useCallback(async () => {
    // In demo mode there's no server session to revoke — skip the API call.
    if (!isDemoMode) await api.get.logout();
    clearAuthState();
    removeAuthError();
    navigate(RouteBuilder.create(AppRoute.Login).build());
  }, [api, navigate, removeAuthError]);
};

