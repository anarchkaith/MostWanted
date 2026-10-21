export const RETURN_PATH_STORAGE_KEY = 'mostwanted_return_path';

export function readAppRoute(path) {
  const expediente = /^\/expediente\/(\d+)$/.exec(path);
  const report = /^\/reporte\/(\d+)$/.exec(path);
  return {
    isAuthCallback: path === '/auth-callback',
    isValidPath: path === '/' || path === '/denunciar' || path === '/perfil'
      || /^\/(usuario\/.+|expediente\/\d+|reporte\/\d+|jugador\/[^/]+)$/.test(path),
    expedienteId: expediente ? Number(expediente[1]) : null,
    reportId: report ? Number(report[1]) : null,
  };
}

export function navigateApp(browser, nextPath, replace = false) {
  const previousPath = browser.location.pathname;
  browser.history[replace ? 'replaceState' : 'pushState']({}, '', `${nextPath}${browser.location.search}`);
  if (nextPath === '/denunciar' || previousPath === '/denunciar') browser.scrollTo(0, 0);
}

export function handleInternalLink(event, navigate, path) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(path);
}
