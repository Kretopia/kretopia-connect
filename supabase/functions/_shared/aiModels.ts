// Centralized Gemini model-string constants for the Lovable AI Gateway.
//
// google/gemini-2.5-flash and google/gemini-2.5-pro are confirmed to retire
// on 2026-10-16. When Google's replacement model is confirmed, updating the
// values below is the ENTIRE fix needed -- every edge function that calls
// the gateway imports these constants instead of hardcoding the model
// string, so there is no other file to touch.
//
// Do not change these values speculatively. Swap them only once the actual
// replacement model has been confirmed by whoever owns the Lovable AI
// Gateway relationship.

export const GEMINI_FLASH = "google/gemini-2.5-flash";
export const GEMINI_FLASH_LITE = "google/gemini-2.5-flash-lite";
export const GEMINI_PRO = "google/gemini-2.5-pro";
export const GEMINI_FLASH_IMAGE = "google/gemini-2.5-flash-image";
export const GEMINI_FLASH_IMAGE_PREVIEW = "google/gemini-2.5-flash-image-preview";

// Gemini 3 -- Kreto's own conversational/agent surfaces (desk-agent,
// desk-agent-watch, thrive-ai-chat, desk-ai, agent-orchestrator) run on
// these instead of the 2.5 constants above. Still "-preview" model ids,
// so treat them the same way as the 2.5 retirement note up top: swap the
// value here (not at each call site) once Google ships the GA successor.
export const GEMINI_3_FLASH = "google/gemini-3-flash-preview";
export const GEMINI_3_1_PRO = "google/gemini-3.1-pro-preview";
export const GEMINI_3_1_FLASH_IMAGE = "google/gemini-3.1-flash-image-preview";
