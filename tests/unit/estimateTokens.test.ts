/**
 * Unit Tests for estimateTokens
 * Testing principles:
 * - One concept per test
 * - Descriptive test names
 * - Arrange-Act-Assert pattern
 */

import { describe, it, expect } from 'vitest';
import { estimateTokens, TOKEN_ESTIMATE_RATIO } from '../../src/core.js';
import { SMALL_OUTPUT, MEDIUM_OUTPUT, LARGE_OUTPUT } from '../fixtures/test-data.js';

describe('estimateTokens', () => {
  describe('Happy Path', () => {
    it('should estimate tokens for empty string as zero', () => {
      // Arrange
      const text = '';

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(0);
    });

    it('should estimate tokens for single character', () => {
      // Arrange
      const text = 'a';

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(Math.floor(1 * TOKEN_ESTIMATE_RATIO));
    });

    it('should estimate tokens for 1000 characters as approximately 250 tokens', () => {
      // Arrange
      const text = 'a'.repeat(1000);

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(250); // 1000 * 0.25 = 250
    });

    it('should estimate tokens for small output', () => {
      // Arrange
      const text = SMALL_OUTPUT;

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(Math.floor(text.length * TOKEN_ESTIMATE_RATIO));
    });

    it('should estimate tokens for medium output', () => {
      // Arrange
      const text = MEDIUM_OUTPUT;

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(Math.floor(text.length * TOKEN_ESTIMATE_RATIO));
    });

    it('should estimate tokens for large output', () => {
      // Arrange
      const text = LARGE_OUTPUT;

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(Math.floor(text.length * TOKEN_ESTIMATE_RATIO));
    });
  });

  describe('Edge Cases', () => {
    it('should floor the result for decimal calculations', () => {
      // Arrange
      const text = 'abc'; // 3 chars * 0.25 = 0.75

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(0); // Math.floor(0.75) = 0
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should handle text with newlines', () => {
      // Arrange
      const text = 'line1\nline2\nline3';

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(Math.floor(text.length * TOKEN_ESTIMATE_RATIO));
    });

    it('should handle text with special characters', () => {
      // Arrange
      const text = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(Math.floor(text.length * TOKEN_ESTIMATE_RATIO));
    });

    it('should handle unicode characters', () => {
      // Arrange
      const text = 'Hello 世界 🌍';

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(Math.floor(text.length * TOKEN_ESTIMATE_RATIO));
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle exactly 10000 characters', () => {
      // Arrange
      const text = 'a'.repeat(10000);

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(2500); // 10000 * 0.25 = 2500
    });

    it('should handle exactly 40000 characters (10000 tokens threshold)', () => {
      // Arrange
      const text = 'a'.repeat(40000);

      // Act
      const result = estimateTokens(text);

      // Assert
      expect(result).toBe(10000); // 40000 * 0.25 = 10000
    });
  });
});
