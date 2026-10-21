import { useCallback, useEffect, useState } from 'react';
import { buildApiUrl } from '../services/apiConfig.js';
import { fetchSession, logoutSession } from '../services/sessionService.js';
import { RETURN_PATH_STORAGE_KEY } from '../services/appNavigation.js';

const EMPTY_CAPABILITIES = { manageCases: false };

export default function useSession({ isAuthCallback }) {
  const [user, setUser] = useState(null);
  const [capabilities, setCapabilities] = useState(EMPTY_CAPABILITIES);
  const [sessionError, setSessionError] = useState('');
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const expireSession = useCallback(() => {
    setUser(null);
    setCapabilities(EMPTY_CAPABILITIES);
    localStorage.removeItem('discord_user');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsAuthChecked(false);
    fetchSession({ signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        if (data.authenticated && data.user?.id) {
          setUser(data.user);
          setCapabilities(data.capabilities || EMPTY_CAPABILITIES);
          localStorage.setItem('discord_user', JSON.stringify(data.user));
        } else {
          expireSession();
        }
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('[auth] No se pudo consultar la sesión.', error);
        expireSession();
        setSessionError('No se pudo comprobar la sesión. Comprueba la conexión e inténtalo de nuevo.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        if (isAuthCallback) {
          const returnPath = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY) || '/';
          sessionStorage.removeItem(RETURN_PATH_STORAGE_KEY);
          window.location.href = returnPath;
        } else {
          setIsAuthChecked(true);
        }
      });
    return () => controller.abort();
  }, [isAuthCallback, expireSession]);

  const login = useCallback(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== '/') sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, currentPath);
    window.location.href = buildApiUrl('/auth/discord');
  }, []);
  const logout = useCallback(async () => {
    setSessionError('');
    try {
      await logoutSession();
      expireSession();
      return true;
    } catch (error) {
      console.error('[auth] No se pudo cerrar la sesión.', error);
      setSessionError('No se pudo cerrar la sesión. Comprueba la conexión e inténtalo de nuevo.');
      return false;
    }
  }, [expireSession]);
  return { user, capabilities, sessionError, isAuthChecked, login, logout, expireSession };
}
