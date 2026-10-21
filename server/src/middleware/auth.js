import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const readToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const resolveUser = async (token) => {
  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');
  return user;
};

/** Requires a valid JWT. Attaches req.user. */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();
  try {
    req.user = await resolveUser(token);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Invalid or expired token');
  }
  next();
});

/** Attaches req.user when a valid token is present, otherwise continues as guest. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (token) {
    try { req.user = await resolveUser(token); } catch { /* guest */ }
  }
  next();
});

/** Role-based access control: authorize('admin') */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};
