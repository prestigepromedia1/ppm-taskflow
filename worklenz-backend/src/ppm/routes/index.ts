import authRouter from "./ppm-auth-router";
import internalRouter from "./ppm-internal-router";
import portalRouter from "./ppm-portal-router";

/**
 * PPM route modules — exported individually for separate mounting in app.ts.
 *
 * Route structure:
 * - /ppm/api/auth/*        — Client portal auth (magic link, no login required)
 * - /ppm/api/portal/*      — Client portal endpoints (ppmClientAuth required, no Worklenz login)
 * - /ppm/api/*             — Internal endpoints (Worklenz isLoggedIn required)
 */
export { authRouter as ppmAuthRouter };
export { portalRouter as ppmPortalRouter };
export { internalRouter as ppmInternalRouter };
