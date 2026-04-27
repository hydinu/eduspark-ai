import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(body: Record<string, unknown>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
    const t = await res.text();
    throw new Error(`AI gateway error (${res.status}): ${t.slice(0, 200)}`);
  }
  return res.json();
}

/* ------- Chat tutor ------- */
const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(8000),
  })).min(1).max(50),
});

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => chatSchema.parse(d))
  .handler(async ({ data }) => {
    const sys = {
      role: "system" as const,
      content: `You are EduMate, a friendly, encouraging AI tutor for students. Explain concepts clearly with examples, suggest learning paths, and recommend free resources (YouTube channels, free courses, articles). Use markdown formatting with headings, lists and code blocks where useful. Keep answers focused and digestible.`,
    };
    const result = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [sys, ...data.messages],
    });
    const content = result?.choices?.[0]?.message?.content ?? "";
    return { content };
  });

/* ------- Course suggestions ------- */
const suggestSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

export const aiSuggestCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => suggestSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are an expert learning-path designer. Suggest high-quality, mostly free learning resources." },
        { role: "user", content: `Suggest 6 learning resources for "${data.topic}" at ${data.level} level. Mix courses, YouTube tutorials, and hands-on projects.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_resources",
          description: "Return a list of learning resources",
          parameters: {
            type: "object",
            properties: {
              resources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    type: { type: "string", enum: ["course", "video", "tutorial", "project", "article"] },
                    provider: { type: "string", description: "e.g. YouTube, freeCodeCamp, Coursera, MIT OCW" },
                    description: { type: "string" },
                    estimated_hours: { type: "number" },
                    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                    search_query: { type: "string", description: "Best search query to find this resource" },
                  },
                  required: ["title", "type", "provider", "description", "estimated_hours", "difficulty", "search_query"],
                  additionalProperties: false,
                },
              },
            },
            required: ["resources"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_resources" } },
    });
    const args = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { resources: [] };
    return parsed as { resources: Array<{ title: string; type: string; provider: string; description: string; estimated_hours: number; difficulty: string; search_query: string }> };
  });

/* ------- Quiz generation ------- */
const quizSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  count: z.number().int().min(3).max(15).default(5),
});

export const aiGenerateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => quizSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You generate accurate, educational multiple-choice quizzes." },
        { role: "user", content: `Generate ${data.count} ${data.difficulty}-difficulty multiple-choice questions about "${data.topic}". Each must have 4 options with exactly one correct. Include a short explanation.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_quiz",
          description: "Return quiz questions",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                    correct_index: { type: "integer", minimum: 0, maximum: 3 },
                    explanation: { type: "string" },
                  },
                  required: ["question", "options", "correct_index", "explanation"],
                  additionalProperties: false,
                },
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_quiz" } },
    });
    const args = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { questions: [] };
    return parsed as { questions: Array<{ question: string; options: string[]; correct_index: number; explanation: string }> };
  });

/* ------- Interview practice ------- */
const interviewStartSchema = z.object({
  role_topic: z.string().trim().min(2).max(200),
});

export const aiInterviewStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => interviewStartSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `You are a friendly mock interviewer for ${data.role_topic}. Ask one focused question at a time. Be encouraging.` },
        { role: "user", content: "Start the interview with a brief greeting and your first question." },
      ],
    });
    return { content: result?.choices?.[0]?.message?.content ?? "" };
  });

const interviewTurnSchema = z.object({
  role_topic: z.string().min(2).max(200),
  transcript: z.array(z.object({
    role: z.enum(["interviewer", "candidate"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(40),
});

export const aiInterviewTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => interviewTurnSchema.parse(d))
  .handler(async ({ data }) => {
    const messages = [
      { role: "system" as const, content: `You are a friendly mock interviewer for ${data.role_topic}. Give brief, encouraging feedback on the candidate's last answer (1-2 sentences) then ask the next question. Keep it conversational.` },
      ...data.transcript.map((t) => ({
        role: (t.role === "interviewer" ? "assistant" : "user") as "assistant" | "user",
        content: t.content,
      })),
    ];
    const result = await callGateway({ model: "google/gemini-3-flash-preview", messages });
    return { content: result?.choices?.[0]?.message?.content ?? "" };
  });

const interviewFinishSchema = z.object({
  role_topic: z.string().min(2).max(200),
  transcript: z.array(z.object({
    role: z.enum(["interviewer", "candidate"]),
    content: z.string().min(1).max(4000),
  })).min(2).max(40),
});

export const aiInterviewFinish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => interviewFinishSchema.parse(d))
  .handler(async ({ data }) => {
    const transcriptText = data.transcript.map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`).join("\n\n");
    const result = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a senior interviewer giving structured feedback." },
        { role: "user", content: `Evaluate this mock ${data.role_topic} interview. Give: (1) overall score 0-100, (2) 2-3 strengths, (3) 2-3 areas to improve, (4) one piece of actionable advice. Format with markdown.\n\n${transcriptText}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_feedback",
          parameters: {
            type: "object",
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              feedback_markdown: { type: "string" },
            },
            required: ["score", "feedback_markdown"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_feedback" } },
    });
    const args = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { score: 0, feedback_markdown: "Unable to generate feedback." };
    return parsed as { score: number; feedback_markdown: string };
  });
