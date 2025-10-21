// Test Data Fixtures
// Tests are specifications

// Small output (< 100 chars)
export const SMALL_OUTPUT = "Hello World";

// Medium output (1000-5000 chars)
export const MEDIUM_OUTPUT = "Line 1\n".repeat(200); // ~1400 chars

// Large output that triggers pagination (> 10000 tokens = > 40000 chars)
export const LARGE_OUTPUT = "A".repeat(50000);

// Multi-page output with exact boundaries (700 lines per page)
export const generateExactPageOutput = (pages: number): string => {
  const lines = pages * 700;
  return Array.from({ length: lines }, (_, i) => `Line ${i + 1}`).join("\n");
};

// Very long single line (tests character limit)
export const VERY_LONG_LINE = "X".repeat(35000);

// Output with mixed content
export const MIXED_OUTPUT = {
  stdout: "Standard output content",
  stderr: "Error message",
  returnCode: 0,
};

// Multi-line output for pagination tests
export const createMultiLineOutput = (
  lineCount: number,
  lineContent = "Test line",
): string => {
  return Array.from(
    { length: lineCount },
    (_, i) => `${lineContent} ${i + 1}`,
  ).join("\n");
};

// Formatted command output (matches MCP server format)
export const formatCommandOutput = (
  stdout: string,
  stderr: string,
  returnCode: number,
): string => {
  return `=== STDOUT ===\n${stdout}\n\n=== STDERR ===\n${stderr}\n\n=== Return Code: ${returnCode} ===`;
};

// Constants from source (for testing against actual values)
export const TEST_CONSTANTS = {
  PAGE_SIZE: 700,
  TOKEN_ESTIMATE_RATIO: 0.25,
  MAX_DIRECT_TOKENS: 10000,
  MAX_CHARS_PER_PAGE: 30000,
};
