/** DI token for the LLM client (mocked in tests — no unit test calls a real API). */
export const LLM_CLIENT = Symbol('LLM_CLIENT');

/**
 * Minimal completion surface: send a system + user prompt, get back the raw
 * text the model produced (expected to be a JSON object string).
 */
export interface LlmClient {
  completeJson(system: string, user: string): Promise<string>;
}
