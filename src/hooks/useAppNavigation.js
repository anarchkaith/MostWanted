import { useCallback, useEffect, useState } from 'react';
import { navigateApp, readAppRoute } from '../services/appNavigation.js';

export default function useAppNavigation({ onPopState }) {
  const [path, setPath] = useState(window.location.pathname);
  const navigate = useCallback((nextPath, replace = false) => {
    navigateApp(window, nextPath, replace);
    setPath(nextPath);
  }, []);
  useEffect(() => {
    if (window.location.pathname === '/' && window.location.hash === '#reportar') navigate('/denunciar', true);
  }, [navigate]);
  useEffect(() => {
    const popState = () => {
      setPath(window.location.pathname);
      onPopState();
    };
    window.addEventListener('popstate', popState);
    return () => window.removeEventListener('popstate', popState);
  }, [onPopState]);
  return { path, navigate, ...readAppRoute(path) };
}
