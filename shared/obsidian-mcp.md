# Obsidian MCP plugin: observed behaviour (2026-10-31, on the Xeneon Edge in iCUE)

Measured with a throwaway test widget on the device. `shared/mcp.js` and the Obsidian widget rely on these facts. Plugin: Semantic Notes Vault MCP v0.11.42.

## (a) Does MCP work from iCUE?

Yes. `initialize` returned 200 and the `mcp-session-id` response header was readable from JS; `notifications/initialized` returned 202; all `tools/call` requests returned 200. No CORS or private-network blocking with the manifest permissions for `localhost:3001` and `127.0.0.1:3001`.

## (b) `view` `{ action: "file", path, raw: true }`

Tool text (`result.content[0].text`) parses to:

```json
{ "result": { "path": "Spike Test.md", "content": "REPLACED\nline B\nline C", "tags": [], "frontmatter": {} }, "context": { ... } }
```

The note body is `.result.content` (a single string; split on `\r?\n`).

## (c) `edit` `at_line` line numbering

**1-based.** `lineNumber: 1, mode: "replace"` replaced the first line. (The test note already existed from an earlier run, so `create` reported "File already exists"; the result is conclusive either way, as 0-based would have replaced `line B`.) Dataview task `line` is 0-based, so use `lineNumber: idx + 1`.

The `edit` tool returns markdown text ("# ✓ Edited: file … Edit successful."), not JSON, even without `raw: false`. Treat a non-error result as success.

## (d) `dataview` `LIST FROM "Entities/People"` with `raw: true`

```json
{ "result": { "success": true, "result": { "type": "list", "values": [ { "path": "Entities/People/<Team>/<Name>.md", "embed": false, "type": "file" } ] } } }
```

Use the basename of `values[].path` (without `.md`). Subfolders are included.

## Errors

`vault` `create` on an existing file returned HTTP 200 with a JSON body `{ "error": { "code": "UNKNOWN_ERROR", "message": "File already exists." }, ... }` inside the tool text, not a JSON-RPC error or `isError`. The client should treat a parsed tool result with a top-level `error` object as a tool error.
