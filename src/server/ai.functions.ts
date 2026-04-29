import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callAI(body: Record<string, unknown>) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // 1. Try Groq first (Fastest & high limits)
  if (groqKey) {
    try {
      const groqBody = { 
        ...body, 
        model: body.tools ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant" 
      };
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(groqBody),
      });
      if (res.ok) return res.json();
      console.warn("Groq failed, trying fallback...", res.status);
    } catch (e) {
      console.warn("Groq fetch error:", e);
    }
  }

  // 2. Try Lovable Gateway
  if (lovableKey) {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (res.status === 429) {
       // If gateway is rate limited, we continue to direct Gemini
       console.warn("Gateway rate limited, trying direct Gemini...");
    }
  }

  // 3. Try Direct Gemini
  if (geminiKey) {
    const geminiBody = { ...body, model: "gemini-1.5-flash" };
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${geminiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
    if (res.ok) return res.json();
    if (res.status === 429) throw new Error("All AI providers are currently rate limited. Please try again in 60 seconds.");
    const t = await res.text();
    throw new Error(`AI Provider Error: ${t.slice(0, 200)}`);
  }

  throw new Error("AI not configured. Add GEMINI_API_KEY or GROQ_API_KEY to your .env file.");
}

/* ------- Chat tutor ------- */
const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(8000),
  })).min(1).max(50),
});

export const aiChat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => chatSchema.parse(d))
  .handler(async ({ data }) => {
    const sys = {
      role: "system" as const,
      content: `You are EduMate, a friendly, encouraging AI tutor for students. 
      You can explain concepts, suggest learning paths, and recommend resources.
      IMPORTANT: You have a tool to GENERATE REAL QUIZZES. If the user asks to be quizzed, tested, or wants to practice a topic, use the 'generate_quiz' tool. 
      After the tool returns the quiz data, confirm to the user that you've prepared the quiz for them.
      Use markdown formatting with headings, lists and code blocks where useful.`,
    };
    const result = await callAI({
      model: "google/gemini-1.5-flash",
      messages: [sys, ...data.messages],
      tools: [{
        type: "function",
        function: {
          name: "generate_quiz",
          description: "Generates a structured multiple-choice quiz on a specific topic.",
          parameters: {
            type: "object",
            properties: {
              topic: { type: "string", description: "The subject of the quiz" },
              difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced", "expert", "elite"], default: "intermediate" },
              count: { type: "integer", minimum: 3, maximum: 10, default: 5 }
            },
            required: ["topic"]
          }
        }
      }]
    });

    const msg = result?.choices?.[0]?.message;
    if (msg?.tool_calls?.[0]) {
      const toolCall = msg.tool_calls[0];
      if (toolCall.function.name === "generate_quiz") {
        const args = JSON.parse(toolCall.function.arguments);
        const quizResult = await aiGenerateQuiz({ data: args });
        return { 
          content: msg.content || "I've prepared a quiz for you! Check it out below.",
          quiz: { ...quizResult, topic: args.topic, difficulty: args.difficulty || "medium" } 
        };
      }
    }

    const content = msg?.content ?? "";
    return { content };
  });

/* ------- Course suggestions ------- */
const suggestSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

export const aiSuggestCourses = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => suggestSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callAI({
      model: "google/gemini-1.5-flash",
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
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert", "elite"]).default("intermediate"),
  count: z.number().int().min(3).max(15).default(5),
});

export const aiGenerateQuiz = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => quizSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callAI({
      model: "google/gemini-1.5-flash",
      messages: [
        { 
          role: "system", 
          content: `You generate accurate, educational multiple-choice quizzes.
          SPECIAL HANDLING FOR APTITUDE/NUMERICAL TOPICS:
          - If the topic relates to Aptitude, Math, or Numerical Reasoning, generate quantitative problems.
          - Ensure options are realistic and include common distractor answers.
          - The 'explanation' field MUST include the step-by-step calculation or logical derivation of the answer.`
        },
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
  .inputValidator((d: unknown) => interviewStartSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await callAI({
      model: "google/gemini-1.5-flash",
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
  .inputValidator((d: unknown) => interviewTurnSchema.parse(d))
  .handler(async ({ data }) => {
    const messages = [
      { role: "system" as const, content: `You are a friendly mock interviewer for ${data.role_topic}. Give brief, encouraging feedback on the candidate's last answer (1-2 sentences) then ask the next question. Keep it conversational.` },
      ...data.transcript.map((t) => ({
        role: (t.role === "interviewer" ? "assistant" : "user") as "assistant" | "user",
        content: t.content,
      })),
    ];
    const result = await callAI({ model: "google/gemini-1.5-flash", messages });
    return { content: result?.choices?.[0]?.message?.content ?? "" };
  });

const interviewFinishSchema = z.object({
  role_topic: z.string().min(2).max(200),
  transcript: z.array(z.object({
    role: z.enum(["interviewer", "candidate"]),
    content: z.string().min(1).max(4000),
  })).min(2).max(40),
});

/* ------- Video study notes ------- */
const notesSchema = z.object({
  video_url: z.string().url().max(500),
  video_title: z.string().trim().min(1).max(300),
});

export const aiGenerateVideoNotes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => notesSchema.parse(d))
  .handler(async ({ data }) => {
    const prompt = `You are an expert study notes generator. Based on the YouTube video titled "${data.video_title}" (${data.video_url}), create comprehensive timestamped study notes.
Generate realistic, educational timestamped study notes as if you had watched this video. Create 5-7 sections with meaningful timestamps.

Return ONLY valid JSON in this exact format:
{
  "video_title": "${data.video_title.replace(/"/g, '\\"')}",
  "notes": [
    {
      "timestamp": "0:00",
      "section_title": "Introduction",
      "content": "• Key point 1\\n• Key point 2"
    }
  ]
}`;

    const result = await callAI({
      model: "google/gemini-1.5-flash",
      messages: [
        { role: "system", content: "You are a study notes generator. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const raw = result?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return {
        video_title: data.video_title,
        notes: [{ timestamp: "0:00", section_title: "AI Study Notes", content: cleaned }],
      };
    }
  });

export const aiInterviewFinish = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => interviewFinishSchema.parse(d))
  .handler(async ({ data }) => {
    const transcriptText = data.transcript.map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`).join("\n\n");
    const result = await callAI({
      model: "google/gemini-1.5-flash",
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
