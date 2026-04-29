import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const KG_BASE_URL = "https://outstandingom-knowledge-graph-env.hf.space";

async function callAI(body: Record<string, unknown>) {
  const lovableKey = import.meta.env.VITE_LOVABLE_API_KEY || "";
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyD2r5Yte8rMRdA-AwACq6MQ-yntnF3Ww_I";
  const groqKey = import.meta.env.VITE_GROQ_API_KEY || "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";

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
    } catch (e) {
      console.warn("Groq failed:", e);
    }
  }

  if (lovableKey) {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
  }

  if (geminiKey) {
    const geminiBody = { ...body, model: "gemini-1.5-flash" };
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${geminiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
    if (res.ok) return res.json();
  }

  throw new Error("AI provider failed or not configured.");
}

/* ------- Knowledge Graph RAG Helper ------- */
async function queryKnowledgeGraph(query: string) {
  try {
    // Attempt to get a description from the KG
    const res = await fetch(`${KG_BASE_URL}/sentence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: query.slice(0, 50) }),
      timeout: 5000,
    } as any);
    if (res.ok) {
      const data = await res.json();
      return data.sentence || null;
    }
  } catch (e) {
    return null;
  }
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
    const lastMsg = data.messages[data.messages.length - 1].content;
    
    // 1. RAG Step: Query Knowledge Graph for the last message
    const kgContext = await queryKnowledgeGraph(lastMsg);

    const sys = {
      role: "system" as const,
      content: `You are EduMate, an AI tutor.
      ${kgContext ? `\nCONTEXT FROM KNOWLEDGE GRAPH: ${kgContext}\nUse this context if relevant to provide more accurate answers.` : ""}
      
      You have tools to:
      1. 'generate_quiz': Use this if the user wants to practice or be tested.
      2. 'kg_calculate': Use this for ANY mathematical expression (e.g. "5+2"). It uses the Knowledge Graph reasoning engine.
      
      Always provide clear, encouraging explanations.`,
    };

    const result = await callAI({
      model: "google/gemini-1.5-flash",
      messages: [sys, ...data.messages],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_quiz",
            description: "Generates a multiple-choice quiz.",
            parameters: {
              type: "object",
              properties: {
                topic: { type: "string" },
                difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced", "expert", "elite"], default: "intermediate" },
                count: { type: "integer", default: 5 }
              },
              required: ["topic"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "kg_calculate",
            description: "Evaluates a mathematical expression using the Knowledge Graph engine.",
            parameters: {
              type: "object",
              properties: {
                expression: { type: "string", description: "e.g. '5 + 2 * 10'" }
              },
              required: ["expression"]
            }
          }
        }
      ]
    });

    const msg = result?.choices?.[0]?.message;
    if (msg?.tool_calls?.[0]) {
      const toolCall = msg.tool_calls[0];
      
      // Handle Quiz Tool
      if (toolCall.function.name === "generate_quiz") {
        const args = JSON.parse(toolCall.function.arguments);
        const quizResult = await aiGenerateQuiz({ data: args });
        return { 
          content: msg.content || "I've prepared a quiz for you!",
          quiz: { ...quizResult, topic: args.topic, difficulty: args.difficulty || "intermediate" } 
        };
      }

      // Handle KG Calculate Tool
      if (toolCall.function.name === "kg_calculate") {
        const args = JSON.parse(toolCall.function.arguments);
        try {
          const calcRes = await fetch(`${KG_BASE_URL}/calculate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expression: args.expression })
          });
          const calcData = await calcRes.json();
          const reply = `According to the Knowledge Graph engine, ${args.expression} = ${calcData.result}`;
          return { content: reply };
        } catch (e) {
          return { content: "I tried to calculate that using the Knowledge Graph, but encountered an error. Let me try myself..." };
        }
      }
    }

    return { content: msg?.content ?? "" };
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
    // RAG for Quiz: Get context to make better questions
    const kgContext = await queryKnowledgeGraph(data.topic);

    const result = await callAI({
      model: "google/gemini-1.5-flash",
      messages: [
        { 
          role: "system", 
          content: `You are a universal expert quiz generator.
          ${kgContext ? `\nCONTEXT FROM KNOWLEDGE GRAPH: ${kgContext}\nUse this context to inform your questions.` : ""}
          - APTITUDE: For math/logic, provide step-by-step calculations in the explanation.
          Always ensure 4 distinct options with one unambiguously correct answer.`
        },
        { role: "user", content: `Generate ${data.count} ${data.difficulty}-difficulty multiple-choice questions about "${data.topic}". Include a short explanation.` },
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
    const kgContext = await queryKnowledgeGraph(data.role_topic);
    const result = await callAI({
      model: "google/gemini-1.5-flash",
      messages: [
        { role: "system", content: `You are a mock interviewer for ${data.role_topic}. ${kgContext ? `Context: ${kgContext}` : ""} Ask one focused question.` },
        { role: "user", content: "Start the interview." },
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
      { role: "system" as const, content: `You are a friendly mock interviewer for ${data.role_topic}.` },
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
    const result = await callAI({
      model: "google/gemini-1.5-flash",
      messages: [
        { role: "system", content: "You are a study notes generator." },
        { role: "user", content: `Generate comprehensive timestamped study notes for: ${data.video_title}. Return JSON.` },
      ],
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
        { role: "user", content: `Evaluate this interview: \n\n${transcriptText}` },
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
