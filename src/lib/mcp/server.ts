/**
 * MCP Server -- JSON-RPC 2.0 Protocol Handler
 *
 * Handles incoming MCP requests, dispatches to tools/resources/prompts,
 * and returns standardized responses.
 */

import type { JsonRpcRequest, JsonRpcResponse } from "./types";
import { JSON_RPC_ERRORS } from "./types";
import { MCP_TOOLS, executeTool } from "./tools";
import { MCP_RESOURCES, readResource } from "./resources";
import { MCP_PROMPTS, generatePrompt } from "./prompts";

/** Handle an MCP JSON-RPC request */
export async function handleMcpRequest(
  supabase: unknown,
  request: JsonRpcRequest,
  keyRecord?: Record<string, unknown>
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      // -- Initialize --
      case "initialize":
        return success(id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: "ai-market-cap",
            version: "1.0.0",
          },
        });

      // -- Tools --
      case "tools/list":
        return success(id, { tools: MCP_TOOLS });

      case "tools/call": {
        const toolName = (params?.name as string) ?? "";
        const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};
        const result = await executeTool(supabase, toolName, toolArgs, keyRecord);
        return success(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
        });
      }

      // -- Resources --
      case "resources/list":
        return success(id, { resources: MCP_RESOURCES });

      case "resources/read": {
        const uri = (params?.uri as string) ?? "";
        const content = await readResource(supabase, uri);
        return success(id, {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(content) }],
        });
      }

      // -- Prompts --
      case "prompts/list":
        return success(id, { prompts: MCP_PROMPTS });

      case "prompts/get": {
        const promptName = (params?.name as string) ?? "";
        const promptArgs = (params?.arguments as Record<string, unknown>) ?? {};
        const result = await generatePrompt(supabase, promptName, promptArgs);
        return success(id, result);
      }

      // -- Ping --
      case "ping":
        return success(id, {});

      default:
        return error(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return error(id, JSON_RPC_ERRORS.INTERNAL_ERROR, msg);
  }
}

function success(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function error(id: string | number, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
