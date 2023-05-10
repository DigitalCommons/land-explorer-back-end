import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

/**
 * Takes plain string password and return encrypted password
 * @param options
 * @returns 
 */
export const hashPassword = (password: string) => {
  return bcrypt.hashSync(password, 10);
}

/**
 * Generate random 96 character hex string (48 bytes) for password reset token
 */
export const generateRandomToken = async () => {
  const bytes = await promisify(randomBytes)(48);
  const token = bytes.toString('hex');
  return token;
}
