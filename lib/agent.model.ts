import OpenAI from "openai";

import { AgentError, type ChatMessage, type Model, type ToolSchema } from "@/lib/agent.types";
import { llmEnv } from "@/lib/env";

/**
 * OpenAI-compatible adapter. Verified against the installed `openai` 6.49.0
 * types: `chat.completions.create({ model, messages, tools, tool_choice,
 * temperature })`, tools are `{ type: "function", function: { name,
 * description, parameters } }`, assistant tool calls are `{ id, type:
 * "function", function: { name, arguments } }` and tool results are
 * `{ role: "tool", tool_call_id, content }`.
 */
export function createOpenAIModel(): Model {
  const env = llmEnv();
  const client = new OpenAI({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    timeout: 60_000,
    // Groq's free tier meters tokens per minute (8K for gpt-oss-120b) and can
    // answer 429 mid-run. The SDK waits for the Retry-After header (checked in
    // node_modules/openai/client.js line 582) and retries, which keeps a long
    // tool loop alive.
    maxRetries: 6,
  });

  return {
    async complete(messages: ChatMessage[], tools: ToolSchema[]) {
      try {
        const completion = await client.chat.completions.create({
          model: env.LLM_MODEL,
          messages: messages.map(toSdkMessage),
          tools: tools.map(toSdkTool),
          tool_choice: "auto",
          temperature: 0.2,
          ...providerExtras(env.LLM_BASE_URL),
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

        const message = completion.choices[0]?.message;
        if (!message) throw new AgentError("MODEL_ERROR", "The model returned no choices.");

        return {
          content: message.content ?? null,
          toolCalls: (message.tool_calls ?? [])
            .filter(
              (
                call,
              ): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
                call.type === "function",
            )
            .map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
            })),
        };
      } catch (error) {
        if (error instanceof AgentError) throw error;
        const message = error instanceof Error ? error.message : "unknown error";
        throw new AgentError("MODEL_ERROR", `LLM request failed: ${message.slice(0, 300)}`);
      }
    },
  };
}

/** Vendor-only body fields, applied by base URL. */
function providerExtras(baseURL: string): Record<string, unknown> {
  // DeepSeek turns thinking mode on by default (effort high). With `tools` in
  // the request, every later turn must echo back the earlier `reasoning_content`
  // or the API answers 400 (api-docs.deepseek.com/guides/thinking_mode). This
  // adapter does not keep reasoning content, so thinking is switched off: tool
  // calls still work, and replies get faster and more predictable.
  if (baseURL.includes("deepseek")) return { thinking: { type: "disabled" } };
  return {};
}

function toSdkTool(tool: ToolSchema): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function toSdkMessage(
  message: ChatMessage,
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  switch (message.role) {
    case "system":
    case "user":
      return { role: message.role, content: message.content };
    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls && message.toolCalls.length > 0
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : {}),
      };
    case "tool":
      return {
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content,
      };
  }
}
