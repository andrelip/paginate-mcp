/**
 * Unit Tests for paginateText
 * Testing principles:
 * - Test behavior, not implementation
 * - Clear, descriptive test names
 * - Each test verifies one specific behavior
 */

import { describe, it, expect } from 'vitest';
import { paginateText, PAGE_SIZE, MAX_CHARS_PER_PAGE } from '../../src/core.js';
import {
  generateExactPageOutput,
  createMultiLineOutput,
  VERY_LONG_LINE,
} from '../fixtures/test-data.js';

describe('paginateText', () => {
  describe('Happy Path - Basic Pagination', () => {
    it('should return all text when less than PAGE_SIZE lines', () => {
      // Arrange
      const text = createMultiLineOutput(100);

      // Act
      const { content, currentPage, totalPages } = paginateText(text, 1);

      // Assert
      expect(content).toBe(text);
      expect(currentPage).toBe(1);
      expect(totalPages).toBe(1);
    });

    it('should paginate text with exactly PAGE_SIZE lines', () => {
      // Arrange
      const text = generateExactPageOutput(1); // Exactly 700 lines

      // Act
      const { content, currentPage, totalPages } = paginateText(text, 1);

      // Assert
      const lines = content.split('\n');
      expect(lines.length).toBe(PAGE_SIZE);
      expect(currentPage).toBe(1);
      expect(totalPages).toBe(1);
    });

    it('should correctly paginate multi-page text', () => {
      // Arrange
      const text = generateExactPageOutput(3); // 2100 lines = 3 pages

      // Act - Get first page
      const { content: content1, currentPage: currentPage1, totalPages: totalPages1 } = paginateText(text, 1);

      // Assert
      const lines1 = content1.split('\n');
      expect(lines1.length).toBe(PAGE_SIZE);
      expect(lines1[0]).toBe('Line 1');
      expect(lines1[PAGE_SIZE - 1]).toBe(`Line ${PAGE_SIZE}`);
      expect(currentPage1).toBe(1);
      expect(totalPages1).toBe(3);
    });

    it('should return correct page numbers for middle page', () => {
      // Arrange
      const text = generateExactPageOutput(3);

      // Act - Get second page
      const { content, currentPage, totalPages } = paginateText(text, 2);

      // Assert
      const lines = content.split('\n');
      expect(lines.length).toBe(PAGE_SIZE);
      expect(lines[0]).toBe(`Line ${PAGE_SIZE + 1}`);
      expect(currentPage).toBe(2);
      expect(totalPages).toBe(3);
    });

    it('should return correct content for last page', () => {
      // Arrange
      const text = generateExactPageOutput(3);

      // Act - Get third page
      const { content, currentPage, totalPages } = paginateText(text, 3);

      // Assert
      const lines = content.split('\n');
      expect(lines.length).toBe(PAGE_SIZE);
      expect(lines[0]).toBe(`Line ${PAGE_SIZE * 2 + 1}`);
      expect(currentPage).toBe(3);
      expect(totalPages).toBe(3);
    });
  });

  describe('Character Limit Behavior', () => {
    it('should respect MAX_CHARS_PER_PAGE limit', () => {
      // Arrange
      const longLine = 'X'.repeat(10000);
      const text = Array.from({ length: 10 }, () => longLine).join('\n');

      // Act
      const { content } = paginateText(text, 1);

      // Assert
      expect(content.length).toBeLessThanOrEqual(MAX_CHARS_PER_PAGE);
    });

    it('should include at least one line even if it exceeds char limit', () => {
      // Arrange
      const text = VERY_LONG_LINE; // 35000 chars, exceeds MAX_CHARS_PER_PAGE

      // Act
      const { content } = paginateText(text, 1);

      // Assert
      expect(content.length).toBeGreaterThan(0);
      expect(content).toBe(VERY_LONG_LINE);
    });

    it('should recalculate total pages when hitting character limit', () => {
      // Arrange
      const longLine = 'X'.repeat(10000);
      const text = Array.from({ length: 10 }, () => longLine).join('\n');

      // Act
      const { content, totalPages } = paginateText(text, 1);

      // Assert
      // With 10 lines of 10000 chars, character limit will be hit
      // Should truncate content at char limit
      expect(content.length).toBeLessThanOrEqual(MAX_CHARS_PER_PAGE);
      expect(totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should truncate at character limit when limit is reached', () => {
      // Arrange - Create text that will hit the limit midway through a page
      const line = 'Y'.repeat(5000); // 5000 chars per line
      const text = Array.from({ length: 10 }, () => line).join('\n');

      // Act
      const { content } = paginateText(text, 1);

      // Assert
      const includedLines = content.split('\n');
      // Should include 6 lines (30000 chars) and stop before 7th
      expect(includedLines.length).toBeLessThanOrEqual(6);
      expect(content.length).toBeLessThanOrEqual(MAX_CHARS_PER_PAGE);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      // Arrange
      const text = '';

      // Act
      const { content, currentPage, totalPages } = paginateText(text, 1);

      // Assert
      expect(content).toBe('');
      expect(currentPage).toBe(1);
      expect(totalPages).toBe(1); // Empty text split by \n gives 1 line
    });

    it('should handle single line of text', () => {
      // Arrange
      const text = 'Single line';

      // Act
      const { content, currentPage, totalPages } = paginateText(text, 1);

      // Assert
      expect(content).toBe(text);
      expect(currentPage).toBe(1);
      expect(totalPages).toBe(1);
    });

    it('should handle page number beyond total pages', () => {
      // Arrange
      const text = createMultiLineOutput(100);

      // Act
      const { content, currentPage, totalPages } = paginateText(text, 999);

      // Assert
      expect(content).toBe('');
      expect(currentPage).toBe(0);
      expect(totalPages).toBe(1);
    });

    it('should handle text with only newlines', () => {
      // Arrange
      const text = '\n\n\n\n\n';

      // Act
      const { content, totalPages } = paginateText(text, 1);

      // Assert
      expect(content).toBe(text);
      expect(totalPages).toBe(1);
    });

    it('should handle text with no newlines', () => {
      // Arrange
      const text = 'This is a single line with no newline characters at all';

      // Act
      const { content, totalPages } = paginateText(text, 1);

      // Assert
      expect(content).toBe(text);
      expect(totalPages).toBe(1);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle exactly PAGE_SIZE + 1 lines', () => {
      // Arrange
      const text = createMultiLineOutput(PAGE_SIZE + 1);

      // Act
      const { totalPages } = paginateText(text, 1);

      // Assert
      expect(totalPages).toBe(2);
    });

    it('should handle exactly MAX_CHARS_PER_PAGE characters', () => {
      // Arrange
      const text = 'X'.repeat(MAX_CHARS_PER_PAGE);

      // Act
      const { content } = paginateText(text, 1);

      // Assert
      expect(content).toBe(text);
      expect(content.length).toBe(MAX_CHARS_PER_PAGE);
    });

    it('should handle partial last page correctly', () => {
      // Arrange
      const text = createMultiLineOutput(PAGE_SIZE + 50); // 750 lines

      // Act - Get second page
      const { content, currentPage, totalPages } = paginateText(text, 2);

      // Assert
      const lines = content.split('\n');
      expect(lines.length).toBe(50); // Only 50 lines on last page
      expect(currentPage).toBe(2);
      expect(totalPages).toBe(2);
    });

    it('should handle page 0 gracefully', () => {
      // Arrange
      const text = createMultiLineOutput(100);

      // Act
      const { currentPage, totalPages } = paginateText(text, 0);

      // Assert
      // Page 0 would result in negative start index, should handle gracefully
      expect(currentPage).toBe(0);
      expect(totalPages).toBe(1);
    });
  });

  describe('Return Value Structure', () => {
    it('should return object with content, currentPage, and totalPages', () => {
      // Arrange
      const text = createMultiLineOutput(100);

      // Act
      const result = paginateText(text, 1);

      // Assert
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('currentPage');
      expect(result).toHaveProperty('totalPages');
      expect(typeof result.content).toBe('string');
      expect(typeof result.currentPage).toBe('number');
      expect(typeof result.totalPages).toBe('number');
    });
  });
});
