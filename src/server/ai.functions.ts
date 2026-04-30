import { z } from "zod";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const KG_BASE_URL = "https://outstandingom-knowledge-graph-env.hf.space";

async function callAI(body: Record<string, unknown>) {
  const geminiKey =
    import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyD2r5Yte8rMRdA-AwACq6MQ-yntnF3Ww_I";
  const groqKey =
    import.meta.env.VITE_GROQ_API_KEY || "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";

  if (groqKey) {
    try {
      const groqBody = {
        ...body,
        model: body.tools ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant",
      };
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(groqBody),
      });
      if (res.ok) return res.json();
      console.warn("Groq returned", res.status);
    } catch (e) {
      console.warn("Groq failed:", e);
    }
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
    const res = await fetch(`${KG_BASE_URL}/sentence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: query.slice(0, 50) }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.sentence || null;
    }
  } catch (e) {
    return null;
  }
}

/* ------- Chat tutor ------- */
export async function aiChat(data: { messages: { role: string; content: string }[] }) {
  const lastMsg = data.messages[data.messages.length - 1].content;
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
              difficulty: {
                type: "string",
                enum: ["beginner", "intermediate", "advanced", "expert", "elite"],
                default: "intermediate",
              },
              count: { type: "integer", default: 5 },
            },
            required: ["topic"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "kg_calculate",
          description: "Evaluates a mathematical expression using the Knowledge Graph engine.",
          parameters: {
            type: "object",
            properties: {
              expression: { type: "string", description: "e.g. '5 + 2 * 10'" },
            },
            required: ["expression"],
          },
        },
      },
    ],
  });

  const msg = result?.choices?.[0]?.message;
  if (msg?.tool_calls?.[0]) {
    const toolCall = msg.tool_calls[0];

    if (toolCall.function.name === "generate_quiz") {
      const args = JSON.parse(toolCall.function.arguments);
      const quizResult = await aiGenerateQuiz({
        topic: args.topic,
        difficulty: args.difficulty || "intermediate",
        count: args.count || 5,
      });
      return {
        content: msg.content || "I've prepared a quiz for you!",
        quiz: { ...quizResult, topic: args.topic, difficulty: args.difficulty || "intermediate" },
      };
    }

    if (toolCall.function.name === "kg_calculate") {
      const args = JSON.parse(toolCall.function.arguments);
      try {
        const calcRes = await fetch(`${KG_BASE_URL}/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expression: args.expression }),
        });
        const calcData = await calcRes.json();
        const reply = `According to the Knowledge Graph engine, ${args.expression} = ${calcData.result}`;
        return { content: reply };
      } catch (e) {
        return {
          content:
            "I tried to calculate that using the Knowledge Graph, but encountered an error. Let me try myself...",
        };
      }
    }
  }

  return { content: msg?.content ?? "" };
}

/* ------- Course suggestions ------- */
export async function aiSuggestCourses(data: { topic: string; level: string }) {
  const result = await callAI({
    model: "google/gemini-1.5-flash",
    messages: [
      {
        role: "system",
        content:
          "You are an expert learning-path designer. Suggest high-quality, mostly free learning resources.",
      },
      {
        role: "user",
        content: `Suggest 6 learning resources for "${data.topic}" at ${data.level} level. Mix courses, YouTube tutorials, and hands-on projects.`,
      },
    ],
    tools: [
      {
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
                    type: {
                      type: "string",
                      enum: ["course", "video", "tutorial", "project", "article"],
                    },
                    provider: { type: "string" },
                    description: { type: "string" },
                    estimated_hours: { type: "number" },
                    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                    search_query: { type: "string" },
                  },
                  required: [
                    "title",
                    "type",
                    "provider",
                    "description",
                    "estimated_hours",
                    "difficulty",
                    "search_query",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["resources"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "return_resources" } },
  });
  const args = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const parsed = args ? JSON.parse(args) : { resources: [] };
  return parsed as {
    resources: Array<{
      title: string;
      type: string;
      provider: string;
      description: string;
      estimated_hours: number;
      difficulty: string;
      search_query: string;
    }>;
  };
}

/* ------- Quiz generation ------- */
export async function aiGenerateQuiz(data: { topic: string; difficulty?: string; count?: number }) {
  const difficulty = data.difficulty || "intermediate";
  const count = data.count || 5;
  const kgContext = await queryKnowledgeGraph(data.topic);

  const result = await callAI({
    model: "google/gemini-1.5-flash",
    messages: [
      {
        role: "system",
        content: `You are a universal expert quiz generator.
          ${kgContext ? `\nCONTEXT FROM KNOWLEDGE GRAPH: ${kgContext}\nUse this context to inform your questions.` : ""}
          - APTITUDE: For math/logic, provide step-by-step calculations in the explanation.
          Always ensure 4 distinct options with one unambiguously correct answer.`,
      },
      {
        role: "user",
        content: `Generate ${count} ${difficulty}-difficulty multiple-choice questions about "${data.topic}". Include a short explanation.`,
      },
    ],
    tools: [
      {
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
      },
    ],
    tool_choice: { type: "function", function: { name: "return_quiz" } },
  });
  const args = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const parsed = args ? JSON.parse(args) : { questions: [] };
  return parsed as {
    questions: Array<{
      question: string;
      options: string[];
      correct_index: number;
      explanation: string;
    }>;
  };
}

/* ------- Interview practice ------- */
export async function aiInterviewStart(data: { role_topic: string; resume_context?: string }) {
  const kgContext = await queryKnowledgeGraph(data.role_topic);
  const resumeInfo = data.resume_context
    ? `\nCANDIDATE RESUME: ${data.resume_context}\nUse this resume to ask relevant questions about their projects, skills, and experience.`
    : "";
  const result = await callAI({
    model: "google/gemini-1.5-flash",
    messages: [
      {
        role: "system",
        content: `You are a senior technical interviewer conducting a real interview for the role of ${data.role_topic}.
${kgContext ? `Context: ${kgContext}` : ""}${resumeInfo}

RULES:
- Greet the candidate briefly and naturally (1 sentence).
- Then ask your FIRST interview question immediately.
- If you have the candidate's resume, ask about something specific from it (a project, skill, or experience).
- Keep it conversational and professional, like a real human interviewer.
- Ask ONE clear question at a time. Do NOT ask multiple questions.
- Keep your response under 3 sentences total.`,
      },
      { role: "user", content: "Start the interview." },
    ],
  });
  return { content: result?.choices?.[0]?.message?.content ?? "" };
}

export async function aiInterviewTurn(data: {
  role_topic: string;
  transcript: { role: string; content: string }[];
  resume_context?: string;
}) {
  const resumeInfo = data.resume_context
    ? `\nCANDIDATE RESUME: ${data.resume_context}\nAsk questions about their projects, skills, and experience from this resume.`
    : "";
  const messages = [
    {
      role: "system" as const,
      content: `You are interviewing a candidate for ${data.role_topic}. This is a LIVE VOICE interview.${resumeInfo}

STRICT RULES:
1. Your ENTIRE response must be MAX 2 short sentences.
2. First sentence: brief reaction (e.g. "Good" or "Okay" or "Interesting approach").
3. Second sentence: ONE follow-up question about what they just said.
4. NEVER give explanations, lists, or long answers. You are the INTERVIEWER, not the teacher.
5. ONLY ask questions. Do NOT teach or explain concepts.
6. No markdown, no bullet points, no formatting. Plain speech only.`,
    },
    ...data.transcript.map((t) => ({
      role: (t.role === "interviewer" ? "assistant" : "user") as "assistant" | "user",
      content: t.content,
    })),
  ];
  const result = await callAI({ model: "google/gemini-1.5-flash", messages });
  return { content: result?.choices?.[0]?.message?.content ?? "" };
}

export async function aiInterviewFinish(data: {
  role_topic: string;
  transcript: { role: string; content: string }[];
}) {
  const transcriptText = data.transcript
    .map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`)
    .join("\n\n");
  const result = await callAI({
    model: "google/gemini-1.5-flash",
    messages: [
      { role: "system", content: "You are a senior interviewer giving structured feedback." },
      { role: "user", content: `Evaluate this interview: \n\n${transcriptText}` },
    ],
    tools: [
      {
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
      },
    ],
    tool_choice: { type: "function", function: { name: "return_feedback" } },
  });
  const args = result?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const parsed = args
    ? JSON.parse(args)
    : { score: 0, feedback_markdown: "Unable to generate feedback." };
  return parsed as { score: number; feedback_markdown: string };
}

/* ------- Video study notes ------- */
export async function aiGenerateVideoNotes(data: { video_url: string; video_title: string }) {
  const result = await callAI({
    model: "google/gemini-1.5-flash",
    messages: [
      { role: "system", content: "You are a study notes generator." },
      {
        role: "user",
        content: `Generate comprehensive timestamped study notes for: ${data.video_title}. Return JSON.`,
      },
    ],
  });

  const raw = result?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      video_title: data.video_title,
      notes: [{ timestamp: "0:00", section_title: "AI Study Notes", content: cleaned }],
    };
  }
}

/* ------- Career Analyzer ------- */
export async function aiCareerAnalyze(data: {
  target_role: string;
  target_company?: string;
  current_skills: string[];
}) {
  const result = await callAI({
    model: "google/gemini-1.5-flash",
    messages: [
      {
        role: "system",
        content: `You are a career advisor for tech students. Analyze the gap between current skills and target job requirements. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Student's current skills: ${data.current_skills.join(", ") || "None listed"}
Target role: ${data.target_role}
${data.target_company ? `Target company: ${data.target_company}` : ""}

Return JSON with this exact structure:
{
  "skill_gap": ["skill1", "skill2"],
  "courses": [{"title": "course name", "platform": "Coursera/Udemy/etc", "url": "full url", "why": "reason"}],
  "practice": [{"platform": "LeetCode/GFG/etc", "focus": "what to practice", "url": "url"}],
  "youtube_searches": ["search query 1", "search query 2"],
  "roadmap": ["Step 1: ...", "Step 2: ..."],
  "match_percentage": 65
}`,
      },
    ],
  });
  const raw = result?.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      skill_gap: [],
      courses: [],
      practice: [],
      youtube_searches: [],
      roadmap: [raw],
      match_percentage: 0,
    };
  }
}
