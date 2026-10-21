import { User } from '../models/index.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';

const authPayload = (user) => ({ success: true, token: signToken(user), user: user.toJSON() });

export const register = async (req, res) => {
  const { name, email, password, role, preferredLang } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const user = new User({ name, email, role, preferredLang });
  await user.setPassword(password);
  await user.save();
  res.status(201).json(authPayload(user));
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled');
  res.json(authPayload(user));
};

export const me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

export const updateMe = async (req, res) => {
  const { name, preferredLang, currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (name !== undefined) user.name = name;
  if (preferredLang !== undefined) user.preferredLang = preferredLang;
  if (newPassword) {
    if (!currentPassword || !(await user.verifyPassword(currentPassword))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    await user.setPassword(newPassword);
  }
  await user.save();
  res.json({ success: true, user: user.toJSON() });
};
