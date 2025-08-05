
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { createUser, loginUser, getUserById } from '../handlers/auth';
import { eq } from 'drizzle-orm';

const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  role: 'guest'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with hashed password', async () => {
    const result = await createUser(testUserInput);

    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.role).toEqual('guest');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123'); // Should be hashed
  });

  it('should save user to database', async () => {
    const result = await createUser(testUserInput);

    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].role).toEqual('guest');
    expect(users[0].password_hash).not.toEqual('password123');
  });

  it('should default role to guest when not provided', async () => {
    const inputWithoutRole = {
      ...testUserInput,
      role: undefined
    };

    const result = await createUser(inputWithoutRole);

    expect(result.role).toEqual('guest');
  });

  it('should reject duplicate email addresses', async () => {
    await createUser(testUserInput);

    expect(async () => {
      await createUser(testUserInput);
    }).toThrow(/already exists/i);
  });

  it('should handle admin role correctly', async () => {
    const adminInput: CreateUserInput = {
      ...testUserInput,
      email: 'admin@example.com',
      role: 'admin'
    };

    const result = await createUser(adminInput);

    expect(result.role).toEqual('admin');
  });
});

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should authenticate user with correct credentials', async () => {
    // Create user first
    const createdUser = await createUser(testUserInput);

    const result = await loginUser(testLoginInput);

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.id).toEqual(createdUser.id);
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.first_name).toEqual('John');
    expect(typeof result.token).toEqual('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should reject login with wrong password', async () => {
    await createUser(testUserInput);

    const wrongPasswordInput: LoginInput = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    expect(async () => {
      await loginUser(wrongPasswordInput);
    }).toThrow(/invalid email or password/i);
  });

  it('should reject login with non-existent email', async () => {
    const nonExistentInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    expect(async () => {
      await loginUser(nonExistentInput);
    }).toThrow(/invalid email or password/i);
  });

  it('should return valid JWT token format', async () => {
    await createUser(testUserInput);

    const result = await loginUser(testLoginInput);

    // Token should be base64 encoded JSON
    expect(() => {
      const decoded = Buffer.from(result.token, 'base64').toString();
      JSON.parse(decoded);
    }).not.toThrow();

    // Verify token contains expected fields
    const decoded = JSON.parse(Buffer.from(result.token, 'base64').toString());
    expect(decoded.userId).toBeDefined();
    expect(decoded.email).toEqual('test@example.com');
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });
});

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when found', async () => {
    const createdUser = await createUser(testUserInput);

    const result = await getUserById(createdUser.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.email).toEqual('test@example.com');
    expect(result!.first_name).toEqual('John');
    expect(result!.last_name).toEqual('Doe');
  });

  it('should return null when user not found', async () => {
    const result = await getUserById(999);

    expect(result).toBeNull();
  });

  it('should return user with all fields populated', async () => {
    const createdUser = await createUser(testUserInput);

    const result = await getUserById(createdUser.id);

    expect(result).toBeDefined();
    expect(result!.email).toEqual('test@example.com');
    expect(result!.password_hash).toBeDefined();
    expect(result!.first_name).toEqual('John');
    expect(result!.last_name).toEqual('Doe');
    expect(result!.phone).toEqual('+1234567890');
    expect(result!.role).toEqual('guest');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });
});
