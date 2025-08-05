
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

// Simple password hashing using Bun's built-in crypto
const hashPassword = async (password: string): Promise<string> => {
  return await Bun.password.hash(password);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await Bun.password.verify(password, hash);
};

// Simple JWT creation (in production, use a proper JWT library)
const createJWT = (userId: number, email: string): string => {
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  
  // In production, use proper JWT signing with a secret key
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Check if user with email already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .limit(1)
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash the password
    const passwordHash = await hashPassword(input.password);

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone,
        role: input.role || 'guest'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};

export const loginUser = async (input: LoginInput): Promise<{ user: User; token: string }> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .limit(1)
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const passwordValid = await verifyPassword(input.password, user.password_hash);
    if (!passwordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = createJWT(user.id, user.email);

    return {
      user,
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

export const getUserById = async (id: number): Promise<User | null> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Get user by ID failed:', error);
    throw error;
  }
};
