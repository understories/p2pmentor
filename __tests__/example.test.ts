import { describe, it, expect } from 'vitest';

/**
 * Example test file demonstrating Vitest usage
 *
 * This file serves as a reference for writing unit tests in the project.
 * Tests should be placed alongside the code they test or in __tests__ directories.
 */

describe('Example Test Suite', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const str = 'hello';
    expect(str.toUpperCase()).toBe('HELLO');
  });

  it('should work with arrays', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr).toContain(2);
  });

  it('should work with objects', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(42);
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('resolved');
    const result = await promise;
    expect(result).toBe('resolved');
  });

  it('should verify boolean logic', () => {
    expect(true).toBe(true);
    expect(false).toBe(false);
    expect(!!'truthy').toBe(true);
  });
});
