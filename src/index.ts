#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import {
  estimateTokens,
  paginateText,
  executeCommand,
  StoredOutput,
  PaginationResult,
  MAX_DIRECT_TOKENS,
} from "./core.js";

interface RunCommandArgs {
  command: string;
  working_directory?: string;
  timeout?: number;
}

interface ReadPageArgs {
  output_id: string;
  page?: number;
}

interface PaginatedResponse {
  status: string;
  output_id: string;
  message: string;
  instruction: string;
  command: string;
  return_code: number;
  total_pages: number;
  total_lines: number;
  estimated_tokens: number;
}

interface CompleteResponse {
  status: string;
  output: string;
  estimated_tokens: number;
  command: string;
  return_code: number;
}

interface PageResponse {
  output_id: string;
  command: string;
  page: number;
  total_pages: number;
  pages_read: number[];
  all_pages_read: boolean;
  content: string;
  has_next: boolean;
  has_previous: boolean;
  cleanup_note?: string;
}

const outputStorage = new Map<string, StoredOutput>();
const pagesRead = new Map<string, Set<number>>();

// MCP Server Setup
const server = new Server(
  {
    name: "paginate-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "run_paginated_cmd",
        description:
          "Execute a shell command and capture its output. Returns full output if under 10,000 tokens, otherwise stores it and returns an ID for pagination.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The shell command to execute",
            },
            working_directory: {
              type: "string",
              description: "Optional working directory for command execution",
            },
            timeout: {
              type: "number",
              description: "Optional timeout in seconds (default: 30)",
            },
          },
          required: ["command"],
        },
      },
      {
        name: "read_output_page",
        description:
          "Retrieve a specific page of stored command output using the output ID",
        inputSchema: {
          type: "object",
          properties: {
            output_id: {
              type: "string",
              description: "The ID of the stored output",
            },
            page: {
              type: "integer",
              description: "Page number to retrieve (1-indexed)",
              minimum: 1,
            },
          },
          required: ["output_id", "page"],
        },
      },
    ],
  };
});

function formatCommandOutput(stdout: string, stderr: string, returnCode: number): string {
  return `=== STDOUT ===\n${stdout}\n\n=== STDERR ===\n${stderr}\n\n=== Return Code: ${returnCode} ===`;
}

function shouldPaginate(estimatedTokens: number): boolean {
  return estimatedTokens > MAX_DIRECT_TOKENS;
}

function createCompleteResponse(
  fullOutput: string,
  estimatedTokens: number,
  command: string,
  returnCode: number
): CompleteResponse {
  return {
    status: "complete",
    output: fullOutput,
    estimated_tokens: estimatedTokens,
    command: command,
    return_code: returnCode,
  };
}

function storeOutputForPagination(
  outputId: string,
  command: string,
  fullOutput: string,
  returnCode: number,
  estimatedTokens: number,
  totalPages: number
): void {
  const totalLines = fullOutput.split("\n").length;

  outputStorage.set(outputId, {
    command,
    full_output: fullOutput,
    return_code: returnCode,
    estimated_tokens: estimatedTokens,
    total_lines: totalLines,
    total_pages: totalPages,
  });

  pagesRead.set(outputId, new Set<number>());
}

function createPaginatedResponse(
  outputId: string,
  command: string,
  returnCode: number,
  totalPages: number,
  totalLines: number,
  estimatedTokens: number
): PaginatedResponse {
  return {
    status: "paginated",
    output_id: outputId,
    message: `Output too large (${estimatedTokens} estimated tokens). Use 'read_output_page' tool to retrieve all ${totalPages} pages sequentially.`,
    instruction: `IMPORTANT: You must paginate through ALL ${totalPages} pages using read_output_page(output_id='${outputId}', page=N) where N goes from 1 to ${totalPages}.`,
    command,
    return_code: returnCode,
    total_pages: totalPages,
    total_lines: totalLines,
    estimated_tokens: estimatedTokens,
  };
}

function createJsonResponse(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

async function handleRunCommand(args: RunCommandArgs) {
  const { command, working_directory, timeout = 30 } = args;

  if (!command) {
    throw new Error("Command is required");
  }

  const { stdout, stderr, returnCode } = await executeCommand(
    command,
    working_directory,
    timeout
  );

  const fullOutput = formatCommandOutput(stdout, stderr, returnCode);
  const estimatedTokens = estimateTokens(fullOutput);

  if (!shouldPaginate(estimatedTokens)) {
    const response = createCompleteResponse(fullOutput, estimatedTokens, command, returnCode);
    return createJsonResponse(response);
  }

  const outputId = randomUUID();
  const { totalPages } = paginateText(fullOutput, 1);
  const totalLines = fullOutput.split("\n").length;

  storeOutputForPagination(outputId, command, fullOutput, returnCode, estimatedTokens, totalPages);

  const response = createPaginatedResponse(
    outputId,
    command,
    returnCode,
    totalPages,
    totalLines,
    estimatedTokens
  );

  return createJsonResponse(response);
}

function validateOutputExists(outputId: string): StoredOutput {
  const storedData = outputStorage.get(outputId);

  if (!storedData) {
    throw new Error(
      `Output ID '${outputId}' not found. It may have expired or been invalid.`
    );
  }

  return storedData;
}

function validatePageExists(pageContent: string, page: number, totalPages: number): void {
  if (!pageContent && page > 1) {
    throw new Error(`Page ${page} does not exist. Total pages: ${totalPages}`);
  }
}

function trackPageAsRead(outputId: string, page: number): void {
  pagesRead.get(outputId)!.add(page);
}

function haveAllPagesBeenRead(outputId: string, totalPages: number): boolean {
  return pagesRead.get(outputId)!.size === totalPages;
}

function getSortedPagesRead(outputId: string): number[] {
  return Array.from(pagesRead.get(outputId)!).sort((a, b) => a - b);
}

function cleanupStoredOutput(outputId: string): void {
  outputStorage.delete(outputId);
  pagesRead.delete(outputId);
}

function buildPageResponse(
  outputId: string,
  storedData: StoredOutput,
  pageContent: string,
  currentPage: number,
  allPagesRead: boolean
): PageResponse {
  const response: PageResponse = {
    output_id: outputId,
    command: storedData.command,
    page: currentPage,
    total_pages: storedData.total_pages,
    pages_read: getSortedPagesRead(outputId),
    all_pages_read: allPagesRead,
    content: pageContent,
    has_next: currentPage < storedData.total_pages,
    has_previous: currentPage > 1,
  };

  if (allPagesRead) {
    response.cleanup_note = "All pages read. Output has been removed from memory.";
  }

  return response;
}

async function handleReadPage(args: ReadPageArgs) {
  const { output_id: outputId, page = 1 } = args;

  if (!outputId) {
    throw new Error("output_id is required");
  }

  const storedData = validateOutputExists(outputId);
  const { content: pageContent, currentPage } = paginateText(storedData.full_output, page);

  validatePageExists(pageContent, page, storedData.total_pages);
  trackPageAsRead(outputId, page);

  const allPagesRead = haveAllPagesBeenRead(outputId, storedData.total_pages);
  const response = buildPageResponse(outputId, storedData, pageContent, currentPage, allPagesRead);

  if (allPagesRead) {
    cleanupStoredOutput(outputId);
  }

  return createJsonResponse(response);
}

function isRunCommandArgs(args: unknown): args is RunCommandArgs {
  return typeof args === 'object' && args !== null && 'command' in args;
}

function isReadPageArgs(args: unknown): args is ReadPageArgs {
  return typeof args === 'object' && args !== null && 'output_id' in args;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "run_paginated_cmd":
      if (!isRunCommandArgs(args)) {
        throw new Error("Invalid arguments for run_paginated_cmd");
      }
      return handleRunCommand(args);
    case "read_output_page":
      if (!isReadPageArgs(args)) {
        throw new Error("Invalid arguments for read_output_page");
      }
      return handleReadPage(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Main Entry Point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
