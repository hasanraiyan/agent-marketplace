import {
  updateProfileSchema,
  changePasswordSchema,
} from '../src/modules/users/profile.validator.js';

describe('Profile Validator', () => {
  describe('updateProfileSchema', () => {
    test('should validate valid name', () => {
      const result = updateProfileSchema.parse({ name: 'John Doe' });
      expect(result.name).toBe('John Doe');
    });

    test('should validate valid age', () => {
      const result = updateProfileSchema.parse({ age: 30 });
      expect(result.age).toBe(30);
    });

    test('should validate both name and age', () => {
      const result = updateProfileSchema.parse({ name: 'John Doe', age: 30 });
      expect(result.name).toBe('John Doe');
      expect(result.age).toBe(30);
    });

    test('should accept empty object (all optional)', () => {
      const result = updateProfileSchema.parse({});
      expect(result).toEqual({});
    });

    test('should reject name that is too short', () => {
      expect(() => updateProfileSchema.parse({ name: 'J' })).toThrow();
    });

    test('should reject name that is too long', () => {
      expect(() => updateProfileSchema.parse({ name: 'J'.repeat(101) })).toThrow();
    });

    test('should reject negative age', () => {
      expect(() => updateProfileSchema.parse({ age: -1 })).toThrow();
    });

    test('should reject age over 150', () => {
      expect(() => updateProfileSchema.parse({ age: 151 })).toThrow();
    });

    test('should reject non-integer age', () => {
      expect(() => updateProfileSchema.parse({ age: 30.5 })).toThrow();
    });

    test('should accept boundary age values', () => {
      const result1 = updateProfileSchema.parse({ age: 0 });
      expect(result1.age).toBe(0);

      const result2 = updateProfileSchema.parse({ age: 150 });
      expect(result2.age).toBe(150);
    });
  });

  describe('changePasswordSchema', () => {
    test('should validate valid passwords', () => {
      const result = changePasswordSchema.parse({
        currentPassword: 'currentPass123',
        newPassword: 'newPass123',
      });
      expect(result.currentPassword).toBe('currentPass123');
      expect(result.newPassword).toBe('newPass123');
    });

    test('should reject missing currentPassword', () => {
      expect(() => changePasswordSchema.parse({ newPassword: 'newPass123' })).toThrow();
    });

    test('should reject missing newPassword', () => {
      expect(() => changePasswordSchema.parse({ currentPassword: 'currentPass123' })).toThrow();
    });

    test('should reject empty currentPassword', () => {
      expect(() =>
        changePasswordSchema.parse({ currentPassword: '', newPassword: 'newPass123' })
      ).toThrow();
    });

    test('should reject newPassword shorter than 8 characters', () => {
      expect(() =>
        changePasswordSchema.parse({ currentPassword: 'currentPass123', newPassword: 'short' })
      ).toThrow();
    });

    test('should accept newPassword with exactly 8 characters', () => {
      const result = changePasswordSchema.parse({
        currentPassword: 'current',
        newPassword: '12345678',
      });
      expect(result.newPassword).toBe('12345678');
    });
  });
});
