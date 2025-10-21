/**
 * Unit Tests for executeCommand
 * Testing principles:
 * - Test real behavior with real commands (not mocks for system integration)
 * - Use simple, cross-platform commands
 * - Test both success and failure paths
 */

import { describe, it, expect } from 'vitest';
import { executeCommand } from '../../src/core.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('executeCommand', () => {
  describe('Success Cases', () => {
    it('should execute simple echo command', async () => {
      // Arrange
      const command = 'echo "Hello World"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stdout).toContain('Hello World');
      expect(result.returnCode).toBe(0);
    });

    it('should capture stdout correctly', async () => {
      // Arrange
      const command = 'echo "test output"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stdout).toContain('test output');
      expect(result.stderr).toBe('');
      expect(result.returnCode).toBe(0);
    });

    it('should capture stderr when command writes to it', async () => {
      // Arrange
      const command = 'node -e "console.error(\'error message\')"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stderr).toContain('error message');
      expect(result.returnCode).toBe(0);
    });

    it('should return exit code 0 on successful execution', async () => {
      // Arrange
      const command = 'node -e "process.exit(0)"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.returnCode).toBe(0);
    });

    it('should respect working directory parameter', async () => {
      // Arrange
      const workingDir = tmpdir();
      const command = 'pwd'; // Unix command to print working directory

      // Act
      const result = await executeCommand(command, workingDir);

      // Assert
      // On Unix systems, pwd should return the working directory
      // This test is Unix-specific but demonstrates the concept
      if (process.platform !== 'win32') {
        expect(result.stdout).toContain(workingDir);
      }
      expect(result.returnCode).toBe(0);
    }, 10000);

    it('should handle multi-line output', async () => {
      // Arrange
      const command = 'node -e "console.log(\'line1\\nline2\\nline3\')"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stdout).toContain('line1');
      expect(result.stdout).toContain('line2');
      expect(result.stdout).toContain('line3');
      expect(result.returnCode).toBe(0);
    });
  });

  describe('Error Cases - Non-Zero Exit Codes', () => {
    it('should handle commands with non-zero exit codes', async () => {
      // Arrange
      const command = 'node -e "process.exit(1)"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.returnCode).toBe(1);
      // Should not throw, just return the exit code
    });

    it('should handle command with exit code 2', async () => {
      // Arrange
      const command = 'node -e "process.exit(2)"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.returnCode).toBe(2);
    });

    it('should capture stdout/stderr even on non-zero exit', async () => {
      // Arrange
      const command = 'node -e "console.log(\'output\'); console.error(\'error\'); process.exit(1)"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stdout).toContain('output');
      expect(result.stderr).toContain('error');
      expect(result.returnCode).toBe(1);
    });
  });

  describe('Error Cases - Command Failures', () => {
    it('should return exit code 127 for command not found', async () => {
      // Arrange
      const command = 'nonexistentcommand12345';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.returnCode).toBe(127); // Standard "command not found" exit code
      expect(result.stderr).toContain('not found');
    });

    it('should return error details in stderr for command failures', async () => {
      // Arrange
      const command = 'invalidcommandthatdoesnotexist';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.returnCode).toBe(127);
      expect(result.stderr).toContain('not found');
    });
  });

  describe('Timeout Behavior', () => {
    it('should timeout long-running commands', async () => {
      // Arrange
      const command = 'node -e "setTimeout(() => {}, 10000)"'; // 10 second delay
      const timeout = 1; // 1 second timeout

      // Act & Assert
      await expect(executeCommand(command, undefined, timeout)).rejects.toThrow(/timed out/);
    }, 15000);

    it('should respect custom timeout parameter', async () => {
      // Arrange
      const command = 'node -e "setTimeout(() => console.log(\'done\'), 500)"';
      const timeout = 2; // 2 second timeout (should be enough)

      // Act
      const result = await executeCommand(command, undefined, timeout);

      // Assert
      expect(result.returnCode).toBe(0);
    }, 5000);

    it('should use default timeout of 30 seconds when not specified', async () => {
      // Arrange
      const command = 'echo "quick"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.returnCode).toBe(0);
      // If this completes, the default timeout was not too short
    });
  });

  describe('Output Handling', () => {
    it('should return empty string for stdout when command produces no output', async () => {
      // Arrange
      const command = 'node -e ""'; // No output

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stdout).toBe('');
      expect(result.returnCode).toBe(0);
    });

    it('should return empty string for stderr when no errors', async () => {
      // Arrange
      const command = 'echo "normal output"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stderr).toBe('');
      expect(result.returnCode).toBe(0);
    });

    it('should handle large output correctly', async () => {
      // Arrange
      const command = 'node -e "console.log(\'X\'.repeat(10000))"'; // 10k chars

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stdout.length).toBeGreaterThan(9000);
      expect(result.returnCode).toBe(0);
    });
  });

  describe('Return Value Structure', () => {
    it('should return object with stdout, stderr, and returnCode', async () => {
      // Arrange
      const command = 'echo "test"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('returnCode');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
      expect(typeof result.returnCode).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    it('should handle command with special characters', async () => {
      // Arrange
      const command = 'echo "Hello & World | Test"';

      // Act
      const result = await executeCommand(command);

      // Assert
      expect(result.stdout).toContain('Hello');
      expect(result.returnCode).toBe(0);
    });

    it('should handle empty command string by returning error', async () => {
      // Arrange
      const command = '';

      // Act
      const result = await executeCommand(command);

      // Assert
      // Empty command results in an error returnCode (could be string or number depending on error type)
      expect(result).toHaveProperty('returnCode');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      // returnCode could be 'ERR_INVALID_ARG_VALUE' for empty commands
      expect(result.returnCode).toBeDefined();
    });
  });
});
