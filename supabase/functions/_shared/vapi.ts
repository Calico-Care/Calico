/**
 * Shared VAPI API Client
 * Purpose: Centralize VAPI API calls with error handling and type safety.
 */
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { withTenant } from "@/db.ts";

const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_API_URL = Deno.env.get("VAPI_API_URL") || "https://api.vapi.ai";

if (!VAPI_API_KEY) {
  throw new Error("Missing VAPI_API_KEY");
}

/**
 * Type definitions for VAPI API requests/responses
 */
export const VAPIAssistantLLMSchema = z.object({
  provider: z.string(),
  model: z.string(),
});
export type VAPIAssistantLLM = z.infer<typeof VAPIAssistantLLMSchema>;

export const VAPIAssistantVoiceSchema = z.object({
  provider: z.string(),
  voiceId: z.string(),
  model: z.string().optional(),
});
export type VAPIAssistantVoice = z.infer<typeof VAPIAssistantVoiceSchema>;

export const VAPIAssistantTranscriberSchema = z.object({
  provider: z.string(),
  model: z.string(),
});
export type VAPIAssistantTranscriber = z.infer<
  typeof VAPIAssistantTranscriberSchema
>;

export const VAPIAssistantSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    llm: VAPIAssistantLLMSchema,
    voice: VAPIAssistantVoiceSchema,
    transcriber: VAPIAssistantTranscriberSchema,
    toolIds: z.array(z.string()).optional(),
    firstMessage: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough(); // Allow extra fields
export type VAPIAssistant = z.infer<typeof VAPIAssistantSchema>;

export const VAPICreateAssistantRequestSchema = z.object({
  name: z.string(),
  llm: VAPIAssistantLLMSchema,
  voice: VAPIAssistantVoiceSchema,
  transcriber: VAPIAssistantTranscriberSchema,
  toolIds: z.array(z.string()).optional(),
  firstMessage: z.string().optional(),
});
export type VAPICreateAssistantRequest = z.infer<
  typeof VAPICreateAssistantRequestSchema
>;

export const VAPICreateAssistantResponseSchema = VAPIAssistantSchema;
export type VAPICreateAssistantResponse = z.infer<
  typeof VAPICreateAssistantResponseSchema
>;

export const VAPIUpdateAssistantRequestSchema = z
  .object({
    name: z.string().optional(),
    llm: VAPIAssistantLLMSchema.optional(),
    voice: VAPIAssistantVoiceSchema.optional(),
    transcriber: VAPIAssistantTranscriberSchema.optional(),
    toolIds: z.array(z.string()).optional(),
    firstMessage: z.string().optional(),
  })
  .passthrough(); // Allow extra fields
export type VAPIUpdateAssistantRequest = z.infer<
  typeof VAPIUpdateAssistantRequestSchema
>;

export const VAPIDeleteAssistantResponseSchema = z.object({
  message: z.string(),
});
export type VAPIDeleteAssistantResponse = z.infer<
  typeof VAPIDeleteAssistantResponseSchema
>;

/**
 * VAPI API error response
 */
export interface VAPIError {
  error?: string;
  message?: string;
  statusCode?: number;
}

/**
 * Fetch wrapper for VAPI API calls with error handling
 */
export async function vapiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  schema: z.ZodType<T>,
  timeoutMs = 10_000
): Promise<T> {
  const {
    signal: externalSignal,
    headers: optionHeaders,
    ...restOptions
  } = options;
  const baseUrl = VAPI_API_URL.replace(/\/$/, ""); // Remove trailing slash
  const authHeader = `Bearer ${VAPI_API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException("VAPI request timed out", "TimeoutError")
    );
  }, timeoutMs);

  let externalAbortHandler: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalAbortHandler = () => {
        controller.abort(
          externalSignal.reason ??
            new DOMException("Request aborted", "AbortError")
        );
      };
      externalSignal.addEventListener("abort", externalAbortHandler, {
        once: true,
      });
    }
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        ...optionHeaders,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error: VAPIError;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = {
          error: "unknown",
          message: errorText || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }
      throw new Error(
        `VAPI API error: ${error.error || error.message || "Unknown error"} (${
          error.statusCode || response.status
        })`
      );
    }

    const payload = await response.json();

    try {
      return schema.parse(payload);
    } catch (err) {
      const errorDetails = err instanceof Error ? err.message : String(err);
      const zodError = err as {
        issues?: Array<{ path: string[]; message: string }>;
      };
      const issues =
        zodError.issues
          ?.map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ") || errorDetails;
      console.error("VAPI response validation failed", err);
      throw new Error(`Invalid VAPI API response shape: ${issues}`);
    }
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener("abort", externalAbortHandler);
    }
  }
}

/**
 * VAPI API helpers
 */
export const vapi = {
  /**
   * Create a new VAPI assistant
   */
  async createAssistant(
    config: VAPICreateAssistantRequest
  ): Promise<VAPICreateAssistantResponse> {
    return vapiFetch(
      "/assistant",
      {
        method: "POST",
        body: JSON.stringify(config),
      },
      VAPICreateAssistantResponseSchema
    );
  },

  /**
   * Get an assistant by ID
   */
  async getAssistant(assistantId: string): Promise<VAPIAssistant> {
    return vapiFetch(
      `/assistant/${assistantId}`,
      {
        method: "GET",
      },
      VAPIAssistantSchema
    );
  },

  /**
   * Update an assistant
   * Note: When updating the model object, you must include the entire model object (not just toolIds)
   */
  async updateAssistant(
    assistantId: string,
    updates: VAPIUpdateAssistantRequest
  ): Promise<VAPIAssistant> {
    return vapiFetch(
      `/assistant/${assistantId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
      VAPIAssistantSchema
    );
  },

  /**
   * Delete an assistant
   */
  async deleteAssistant(
    assistantId: string
  ): Promise<VAPIDeleteAssistantResponse> {
    return vapiFetch(
      `/assistant/${assistantId}`,
      {
        method: "DELETE",
      },
      VAPIDeleteAssistantResponseSchema
    );
  },
};

/**
 * Create VAPI assistant for a patient if one doesn't exist
 * This handles the full workflow: check DB, create assistant, update DB
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param email - Patient email (for assistant naming)
 */
export async function createVAPIAssistantForPatient(
  orgId: string,
  userId: string,
  email: string
): Promise<void> {
  await withTenant(orgId, async (conn) => {
    const patientResult = await conn.queryObject<{
      vapi_assistant_id: string | null;
      legal_name: string | null;
    }>(
      // Lock the patient row so concurrent requests can't both create assistants
      "SELECT vapi_assistant_id, legal_name FROM patients WHERE org_id = $1 AND user_id = $2 FOR UPDATE",
      [orgId, userId]
    );

    if (patientResult.rows.length === 0) {
      console.warn(
        `Patient row not found for org ${orgId}, user ${userId} - skipping VAPI assistant creation`
      );
      return;
    }

    const patient = patientResult.rows[0];

    if (patient.vapi_assistant_id) {
      return;
    }

    const assistantName = patient.legal_name
      ? `${patient.legal_name} ${email}`
      : email;
    const assistant = await vapi.createAssistant({
      name: assistantName,
      llm: {
        provider: "openai",
        model: "gpt-4o-mini",
      },
      voice: {
        provider: "deepgram",
        voiceId: "asteria",
        model: "aura-2",
      },
      transcriber: {
        provider: "cartesia",
        model: "ink-whisper",
      },
      toolIds: [], // Empty for now
    });

    await conn.queryObject(
      "UPDATE patients SET vapi_assistant_id = $1 WHERE org_id = $2 AND user_id = $3",
      [assistant.id, orgId, userId]
    );

    console.log(
      `Created VAPI assistant ${assistant.id} for patient ${userId} in org ${orgId}`
    );
  });
}
