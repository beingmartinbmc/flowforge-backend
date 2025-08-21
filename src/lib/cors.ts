/**
 * CORS middleware configuration
 */

// Allowed origins configuration - ONLY your production domain
const ALLOWED_ORIGINS = [
  'https://beingmartinbmc.github.io'
];

// No development origins - security first!
const DEV_ORIGINS: string[] = [];

/**
 * Check if origin is allowed
 * @param {string} origin - Request origin
 * @returns {boolean} - Whether origin is allowed
 */
function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;

  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Check development origins
  if (process.env.NODE_ENV === 'development') {
    return DEV_ORIGINS.some((devOrigin) => {
      const pattern = devOrigin.replace('*', '.*');
      return new RegExp(pattern).test(origin);
    });
  }

  return false;
}

/**
 * CORS middleware function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function corsMiddleware(req: any, res: any, next: any) {
  const { origin } = req.headers;
  const isAllowed = isOriginAllowed(origin);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : '');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
}

/**
 * Strict CORS middleware for production
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function strictCorsMiddleware(req: any, res: any, next: any) {
  const { origin } = req.headers;

  // Only allow specific origins in production
  if (process.env.NODE_ENV === 'production') {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return res.status(403).json({
        error: 'CORS policy violation',
        message: 'Origin not allowed'
      });
    }
  }

  corsMiddleware(req, res, next);
}

/**
 * Development CORS middleware (strict - same as production)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function devCorsMiddleware(req: any, res: any, next: any) {
  // Use strict CORS even in development for security
  return strictCorsMiddleware(req, res, next);
}

/**
 * Next.js API handler wrapper with CORS support
 * @param handler - The API handler function
 * @returns Wrapped handler with CORS support
 */
export function withCors(handler: any) {
  return async (req: any, res: any) => {
    const { origin } = req.headers;
    const isAllowed = isOriginAllowed(origin);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : '');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Call the original handler
    return handler(req, res);
  };
}
