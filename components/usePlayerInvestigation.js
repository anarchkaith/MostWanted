import { useEffect, useRef, useState } from 'react';
import { investigatePlayerBackground } from './backgroundInvestigation';
import { isBlockedReportedUsername } from './blockedUsernames';

export default function usePlayerInvestigation({ request, initialInvestigation = null, onChange, onLoadingChange }) {
  const [investigation, setInvestigation] = useState(initialInvestigation);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const callbacks = useRef({ onChange, onLoadingChange });
  useEffect(() => { callbacks.current = { onChange, onLoadingChange }; }, [onChange, onLoadingChange]);

  useEffect(() => {
    if (!request) return undefined;
    const username = String(request.username || '').trim();
    if ((!username && !request.rid) || isBlockedReportedUsername(username)) return undefined;
    let active = true;
    setIsLoading(true);
    setError(null);
    callbacks.current.onLoadingChange?.(true);
    investigatePlayerBackground(username, request.rid || '')
      .then(result => {
        if (!active) return;
        setInvestigation(result);
        callbacks.current.onChange?.(result);
      })
      .catch(cause => {
        if (!active) return;
        setInvestigation(null);
        setError(cause.message);
        callbacks.current.onChange?.(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
        callbacks.current.onLoadingChange?.(false);
      });
    return () => { active = false; };
  }, [request]);

  useEffect(() => () => callbacks.current.onLoadingChange?.(false), []);
  return { investigation, isLoading, error };
}
