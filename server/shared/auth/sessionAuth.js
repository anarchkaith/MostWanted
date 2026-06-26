/**
 * Obtiene el usuario autenticado almacenado en sesion, si existe.
 */
export function getSessionUser(req) {
  const user = req?.session?.authUser;
  return user && typeof user === 'object' ? user : null;
}

/**
 * Crea middleware opcional que exige login para cualquier endpoint protegido.
 */
export function createMaybeRequireSessionAuth({ authRequireLogin }) {
  return function maybeRequireSessionAuth(req, res, next) {
    if (!authRequireLogin) {
      return next();
    }

    if (!getSessionUser(req)) {
      return res.status(401).json({
        ok: false,
        error: 'Debes iniciar sesion con Discord para usar este endpoint.',
        code: 'auth_required',
      });
    }

    return next();
  };
}
