import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const PAGE_SIZE = 700;
export const TOKEN_ESTIMATE_RATIO = 0.25;
export const MAX_DIRECT_TOKENS = 5000;
export const MAX_CHARS_PER_PAGE = 30000;
const ONE_GIGABYTE = 1024 * 1024 * 1024;
const MILLISECONDS_PER_SECOND = 1000;

export interface StoredOutput {
  command: string;
  full_output: string;
  return_code: number;
  estimated_tokens: number;
  total_lines: number;
  total_pages: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  returnCode: number;
}

export interface PaginationResult {
  content: string;
  currentPage: number;
  totalPages: number;
}

interface ExecError extends Error {
  code?: number;
  stdout?: string;
  stderr?: string;
  killed?: boolean;
  signal?: string;
}

export function estimateTokens(text: string): number {
  return Math.floor(text.length * TOKEN_ESTIMATE_RATIO);
}

function calculateTotalPages(lineCount: number): number {
  return Math.ceil(lineCount / PAGE_SIZE);
}

function calculatePageBoundaries(
  page: number,
  totalLines: number,
): [number, number] {
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalLines);
  return [startIndex, endIndex];
}

function isPageOutOfBounds(startIndex: number, totalLines: number): boolean {
  return startIndex >= totalLines;
}

function applyCharacterLimit(lines: string[]): string[] {
  const includedLines: string[] = [];
  let characterCount = 0;

  for (const line of lines) {
    const lineLength = line.length + 1;

    if (
      shouldStopAddingLines(characterCount, lineLength, includedLines.length)
    ) {
      break;
    }

    includedLines.push(line);
    characterCount += lineLength;
  }

  return includedLines;
}

function shouldStopAddingLines(
  currentCharCount: number,
  lineLength: number,
  linesIncluded: number,
): boolean {
  const wouldExceedLimit = currentCharCount + lineLength > MAX_CHARS_PER_PAGE;
  const hasAtLeastOneLine = linesIncluded > 0;
  return wouldExceedLimit && hasAtLeastOneLine;
}

function estimateTotalPagesFromCharacters(
  textLength: number,
  baseTotalPages: number,
): number {
  const estimatedPages = Math.floor(textLength / MAX_CHARS_PER_PAGE) + 1;
  return Math.max(baseTotalPages, estimatedPages);
}

function hitCharacterLimit(includedLines: string[]): boolean {
  const totalChars = includedLines.reduce(
    (sum, line) => sum + line.length + 1,
    0,
  );
  return totalChars >= MAX_CHARS_PER_PAGE;
}

export function paginateText(text: string, page = 1): PaginationResult {
  const lines = text.split("\n");
  const totalPages = calculateTotalPages(lines.length);
  const [startIndex, endIndex] = calculatePageBoundaries(page, lines.length);

  if (isPageOutOfBounds(startIndex, lines.length)) {
    return { content: "", currentPage: 0, totalPages };
  }

  const pageLines = lines.slice(startIndex, endIndex);
  const limitedLines = applyCharacterLimit(pageLines);
  const pageContent = limitedLines.join("\n");

  if (hitCharacterLimit(limitedLines)) {
    const adjustedTotalPages = estimateTotalPagesFromCharacters(
      text.length,
      totalPages,
    );
    return {
      content: pageContent,
      currentPage: page,
      totalPages: adjustedTotalPages,
    };
  }

  return { content: pageContent, currentPage: page, totalPages };
}

function buildExecutionOptions(
  workingDir: string | undefined,
  timeout: number,
) {
  return {
    cwd: workingDir,
    timeout: timeout * MILLISECONDS_PER_SECOND,
    maxBuffer: ONE_GIGABYTE,
    encoding: "utf8" as const,
  };
}

function wasCommandKilledByTimeout(error: ExecError): boolean {
  return error.killed === true && error.signal === "SIGTERM";
}

function hasExitCode(error: ExecError): boolean {
  return error.code !== undefined;
}

function createSuccessResult(stdout: string, stderr: string): CommandResult {
  return {
    stdout: stdout || "",
    stderr: stderr || "",
    returnCode: 0,
  };
}

function createErrorResult(error: ExecError): CommandResult {
  return {
    stdout: error.stdout || "",
    stderr: error.stderr || "",
    returnCode: error.code || 1,
  };
}

export async function executeCommand(
  command: string,
  workingDir?: string,
  timeout = 30,
): Promise<CommandResult> {
  try {
    const options = buildExecutionOptions(workingDir, timeout);
    const { stdout, stderr } = await execAsync(command, options);
    return createSuccessResult(stdout, stderr);
  } catch (error) {
    const execError = error as ExecError;
    if (wasCommandKilledByTimeout(execError)) {
      throw new Error(`Command timed out after ${timeout} seconds`);
    }

    if (hasExitCode(execError)) {
      return createErrorResult(execError);
    }

    throw new Error(
      `Failed to execute command: ${execError.message || String(error)}`,
    );
  }
}
