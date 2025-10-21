# Paginate-Cmd MCP Server

A Model Context Protocol (MCP) server that executes shell commands with intelligent output pagination. Automatically handles large command outputs that would exceed Claude's context window by implementing page-based retrieval.

## Features

- Execute shell commands with full stdout/stderr capture
- Automatic pagination for outputs exceeding 10,000 tokens
- Page-based retrieval for large outputs (700 lines or 30KB per page)
- No external dependencies beyond the MCP SDK
- TypeScript implementation with full type safety

## Installation

### From npm (Recommended)

```bash
npm install -g paginate-mcp
```

Or use with npx (no installation required):

```bash
npx paginate-mcp
```

### From Source

```bash
git clone https://github.com/andrelip/paginate-mcp.git
cd paginate-mcp
npm install
npm run build
```

## Usage

### With npx (Easiest)

Use directly with npx without installing:

```json
{
  "mcpServers": {
    "paginate-mcp": {
      "command": "npx",
      "args": ["-y", "paginate-mcp"]
    }
  }
}
```

### With Global Installation

If you installed globally via `npm install -g paginate-mcp`:

```json
{
  "mcpServers": {
    "paginate-mcp": {
      "command": "paginate-mcp"
    }
  }
}
```

### With Claude Desktop (Local Build)

Add to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "paginate-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/paginate-mcp/dist/index.js"]
    }
  }
}
```

### As a Standalone Server

```bash
npm start
```

## Tools

### run_paginated_cmd

Execute a shell command and capture its output.

**Parameters:**

- `command` (required): The shell command to execute
- `working_directory` (optional): Working directory for command execution
- `timeout` (optional): Timeout in seconds (default: 30)

**Returns:**

- If output < 10,000 tokens: Complete output immediately
- If output > 10,000 tokens: Paginated response with `output_id` for retrieval

**Example (small output):**

```json
{
  "status": "complete",
  "output": "=== STDOUT ===\nHello World\n\n=== STDERR ===\n\n=== Return Code: 0 ===",
  "estimated_tokens": 25,
  "command": "echo 'Hello World'",
  "return_code": 0
}
```

**Example (large output):**

```json
{
  "status": "paginated",
  "output_id": "uuid-here",
  "message": "Output too large (25000 estimated tokens). Use 'read_output_page' tool to retrieve all 5 pages sequentially.",
  "instruction": "IMPORTANT: You must paginate through ALL 5 pages...",
  "command": "cat large_file.txt",
  "return_code": 0,
  "total_pages": 5,
  "total_lines": 3421,
  "estimated_tokens": 25000
}
```

### read_output_page

Retrieve a specific page of stored command output.

**Parameters:**

- `output_id` (required): The ID from the paginated response
- `page` (required): Page number to retrieve (1-indexed)

**Returns:**

```json
{
  "output_id": "uuid-here",
  "command": "cat large_file.txt",
  "page": 2,
  "total_pages": 5,
  "pages_read": [1, 2],
  "all_pages_read": false,
  "content": "page content here...",
  "has_next": true,
  "has_previous": true
}
```

## Token Estimation

The server estimates tokens as `text.length * 0.25`. This is a conservative estimate to ensure outputs fit within Claude's context window.

## Pagination Behavior

- **Page Size**: 700 lines per page
- **Character Limit**: 30,000 characters per page (hard limit)
- **Automatic Cleanup**: Output storage is automatically cleaned up when all pages have been read

## Dependencies

### Production

- `@modelcontextprotocol/sdk` - MCP protocol implementation

### Development

- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions

### Built-in Modules (No Installation Required)

- `child_process` - Command execution
- `crypto` - UUID generation
- `util` - Promise utilities

## Architecture

The server maintains two in-memory data structures:

- `outputStorage`: Stores full command outputs for pagination
- `pagesRead`: Tracks which pages have been retrieved

Storage is automatically cleaned up when all pages of an output have been read.

## Publishing to npm

### First-time Setup

1. **Create an npm account** at https://www.npmjs.com/signup if you don't have one

2. **Login to npm** from your terminal:

   ```bash
   npm login
   ```

3. **Update package.json** with your details:
   - Set `author` field to your name/email
   - Update `repository.url` to your GitHub repository
   - Update `homepage` and `bugs.url` URLs

### Publishing

1. **Ensure everything builds**:

   ```bash
   npm run build
   ```

2. **Test the package locally**:

   ```bash
   npm pack
   # This creates a .tgz file you can test with: npm install -g ./paginate-mcp-1.0.0.tgz
   ```

3. **Publish to npm**:
   ```bash
   npm publish
   ```

### Publishing Updates

1. **Update version** (use semantic versioning):

   ```bash
   npm version patch  # 1.0.0 -> 1.0.1 (bug fixes)
   npm version minor  # 1.0.0 -> 1.1.0 (new features)
   npm version major  # 1.0.0 -> 2.0.0 (breaking changes)
   ```

2. **Publish**:

   ```bash
   npm publish
   ```

3. **Push git tags**:
   ```bash
   git push --follow-tags
   ```

### Using npx After Publishing

Once published, users can run your MCP server without installation:

```bash
npx paginate-mcp
```

Or in their Claude Desktop config:

```json
{
  "mcpServers": {
    "paginate-mcp": {
      "command": "npx",
      "args": ["-y", "paginate-mcp"]
    }
  }
}
```

The `-y` flag auto-confirms npx prompts for a smoother experience.

## License

MIT
