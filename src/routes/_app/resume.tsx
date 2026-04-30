import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/AppShell";
import { FileText, Plus, Trash2, Save, Download, Loader2, Eye, PenLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/_app/resume")({ component: ResumePage });

type EduEntry = { degree: string; institution: string; year: string; score: string };
type ProjectEntry = { title: string; tech_stack: string; bullets: string[]; live_url: string };
type ExpEntry = { title: string; company: string; duration: string; bullets: string[] };
type SkillCat = { category: string; items: string[] };

const EMPTY_EDU: EduEntry = { degree: "", institution: "", year: "", score: "" };
const EMPTY_PROJECT: ProjectEntry = { title: "", tech_stack: "", bullets: [""], live_url: "" };
const EMPTY_EXP: ExpEntry = { title: "", company: "", duration: "", bullets: [""] };

function ResumePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const resumeRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [objective, setObjective] = useState("");
  const [education, setEducation] = useState<EduEntry[]>([{ ...EMPTY_EDU }]);
  const [skills, setSkills] = useState<SkillCat[]>([
    { category: "Languages", items: [] },
    { category: "Frameworks", items: [] },
    { category: "Tools", items: [] },
  ]);
  const [skillInput, setSkillInput] = useState<Record<number, string>>({});
  const [projects, setProjects] = useState<ProjectEntry[]>([{ ...EMPTY_PROJECT }]);
  const [experience, setExperience] = useState<ExpEntry[]>([]);
  const [extras, setExtras] = useState<string[]>([""]);
  const [languages, setLanguages] = useState("");
  const [targetRoles, setTargetRoles] = useState("");

  // Load saved resume
  const { isLoading } = useQuery({
    queryKey: ["resume", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_resumes")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) {
        setName(data.full_name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setLocation(data.location || "");
        setLinkedin(data.linkedin || "");
        setGithub(data.github || "");
        setObjective(data.career_objective || "");
        setTargetRoles(data.target_roles || "");
        if (Array.isArray(data.education) && data.education.length)
          setEducation(data.education as EduEntry[]);
        if (data.skills && typeof data.skills === "object") {
          const cats = Object.entries(data.skills as Record<string, string[]>).map(
            ([category, items]) => ({ category, items }),
          );
          if (cats.length) setSkills(cats);
        }
        if (Array.isArray(data.projects) && data.projects.length)
          setProjects(data.projects as ProjectEntry[]);
        if (Array.isArray(data.experience) && data.experience.length)
          setExperience(data.experience as ExpEntry[]);
        if (Array.isArray(data.extracurriculars) && data.extracurriculars.length)
          setExtras(data.extracurriculars as string[]);
        if (Array.isArray(data.languages) && data.languages.length)
          setLanguages((data.languages as string[]).join(", "));
      }
      return data;
    },
  });

  const saveResume = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save");
      const skillsObj: Record<string, string[]> = {};
      skills.forEach((s) => {
        if (s.items.length) skillsObj[s.category] = s.items;
      });
      const payload = {
        user_id: user.id,
        full_name: name,
        email,
        phone,
        location,
        linkedin,
        github,
        career_objective: objective,
        education,
        skills: skillsObj,
        projects: projects.filter((p) => p.title),
        experience: experience.filter((e) => e.title),
        extracurriculars: extras.filter(Boolean),
        languages: languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        target_roles: targetRoles,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("user_resumes")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resume saved!");
      qc.invalidateQueries({ queryKey: ["resume"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function downloadPDF() {
    if (!resumeRef.current) return;
    setTab("preview");
    await new Promise((r) => setTimeout(r, 500));
    try {
      const canvas = await html2canvas(resumeRef.current, { scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `${name || "Resume"}_ATS_Resume.pdf`;
      // Use image download as fallback (PDF needs jspdf)
      link.href = canvas.toDataURL("image/png");
      link.download = `${name || "Resume"}_Resume.png`;
      link.click();
      toast.success("Resume downloaded!");
    } catch {
      toast.error("Download failed. Try browser print (Ctrl+P).");
    }
  }

  // Helper to update array items
  const updateArr = <T,>(arr: T[], i: number, patch: Partial<T>) =>
    arr.map((x, j) => (j === i ? { ...x, ...patch } : x));

  if (isLoading)
    return (
      <div className="p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );

  return (
    <div className="p-3 sm:p-4 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        icon={FileText}
        title="Resume Builder"
        description="Build your ATS-optimized resume. It also powers smarter interviews."
      />

      {/* Tab toggle + actions */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex bg-secondary rounded-lg p-1">
          <button
            onClick={() => setTab("edit")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition",
              tab === "edit" ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            <PenLine className="h-3.5 w-3.5 inline mr-1.5" />
            Edit
          </button>
          <button
            onClick={() => setTab("preview")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition",
              tab === "preview" ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            <Eye className="h-3.5 w-3.5 inline mr-1.5" />
            Preview
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveResume.mutate()}
            disabled={saveResume.isPending}
          >
            {saveResume.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}{" "}
            Save
          </Button>
          <Button size="sm" onClick={downloadPDF}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        </div>
      </div>

      {tab === "edit" ? (
        <div className="space-y-5">
          {/* Personal Info */}
          <Card className="p-5">
            <h3 className="font-bold mb-3 text-primary">Personal Information</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Input
                placeholder="LinkedIn URL"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
              <Input
                placeholder="GitHub URL"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
              />
            </div>
          </Card>

          {/* Career Objective */}
          <Card className="p-5">
            <h3 className="font-bold mb-3 text-primary">Career Objective</h3>
            <Textarea
              placeholder="Write your career objective..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
            />
          </Card>

          {/* Education */}
          <Card className="p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-primary">Education</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEducation([...education, { ...EMPTY_EDU }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {education.map((edu, i) => (
              <div
                key={i}
                className="grid sm:grid-cols-2 gap-2 mb-3 p-3 bg-secondary/30 rounded-lg relative"
              >
                <Input
                  placeholder="Degree (e.g. B.Tech CS)"
                  value={edu.degree}
                  onChange={(e) =>
                    setEducation(updateArr(education, i, { degree: e.target.value }))
                  }
                />
                <Input
                  placeholder="Institution"
                  value={edu.institution}
                  onChange={(e) =>
                    setEducation(updateArr(education, i, { institution: e.target.value }))
                  }
                />
                <Input
                  placeholder="Year (e.g. 2021-2025)"
                  value={edu.year}
                  onChange={(e) => setEducation(updateArr(education, i, { year: e.target.value }))}
                />
                <Input
                  placeholder="Score (CGPA/Percentage)"
                  value={edu.score}
                  onChange={(e) => setEducation(updateArr(education, i, { score: e.target.value }))}
                />
                {education.length > 1 && (
                  <button
                    onClick={() => setEducation(education.filter((_, j) => j !== i))}
                    className="absolute top-2 right-2 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </Card>

          {/* Skills */}
          <Card className="p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-primary">Technical Skills</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSkills([...skills, { category: "", items: [] }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Category
              </Button>
            </div>
            {skills.map((cat, ci) => (
              <div key={ci} className="mb-3 p-3 bg-secondary/30 rounded-lg relative">
                <Input
                  placeholder="Category (e.g. Languages, Frameworks)"
                  value={cat.category}
                  onChange={(e) => setSkills(updateArr(skills, ci, { category: e.target.value }))}
                  className="mb-2"
                />
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {cat.items.map((item, si) => (
                    <span
                      key={si}
                      className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                    >
                      {item}
                      <button
                        onClick={() =>
                          setSkills(
                            updateArr(skills, ci, { items: cat.items.filter((_, j) => j !== si) }),
                          )
                        }
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add skill and press Enter"
                    value={skillInput[ci] || ""}
                    onChange={(e) => setSkillInput({ ...skillInput, [ci]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && skillInput[ci]?.trim()) {
                        setSkills(
                          updateArr(skills, ci, { items: [...cat.items, skillInput[ci].trim()] }),
                        );
                        setSkillInput({ ...skillInput, [ci]: "" });
                      }
                    }}
                  />
                </div>
                {skills.length > 1 && (
                  <button
                    onClick={() => setSkills(skills.filter((_, j) => j !== ci))}
                    className="absolute top-2 right-2 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </Card>

          {/* Projects */}
          <Card className="p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-primary">Projects</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setProjects([...projects, { ...EMPTY_PROJECT }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {projects.map((p, pi) => (
              <div key={pi} className="mb-4 p-3 bg-secondary/30 rounded-lg relative">
                <div className="grid sm:grid-cols-2 gap-2 mb-2">
                  <Input
                    placeholder="Project Title"
                    value={p.title}
                    onChange={(e) =>
                      setProjects(updateArr(projects, pi, { title: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Tech Stack (e.g. React, Node.js)"
                    value={p.tech_stack}
                    onChange={(e) =>
                      setProjects(updateArr(projects, pi, { tech_stack: e.target.value }))
                    }
                  />
                </div>
                <Input
                  placeholder="Live URL (optional)"
                  value={p.live_url}
                  onChange={(e) =>
                    setProjects(updateArr(projects, pi, { live_url: e.target.value }))
                  }
                  className="mb-2"
                />
                {p.bullets.map((b, bi) => (
                  <div key={bi} className="flex gap-1.5 mb-1.5">
                    <span className="text-xs text-muted-foreground mt-2.5">•</span>
                    <Input
                      placeholder="Describe what you built..."
                      value={b}
                      onChange={(e) => {
                        const nb = [...p.bullets];
                        nb[bi] = e.target.value;
                        setProjects(updateArr(projects, pi, { bullets: nb }));
                      }}
                      className="flex-1"
                    />
                    {p.bullets.length > 1 && (
                      <button
                        onClick={() =>
                          setProjects(
                            updateArr(projects, pi, {
                              bullets: p.bullets.filter((_, j) => j !== bi),
                            }),
                          )
                        }
                        className="text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setProjects(updateArr(projects, pi, { bullets: [...p.bullets, ""] }))
                  }
                  className="text-xs mt-1"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Bullet
                </Button>
                {projects.length > 1 && (
                  <button
                    onClick={() => setProjects(projects.filter((_, j) => j !== pi))}
                    className="absolute top-2 right-2 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </Card>

          {/* Experience */}
          <Card className="p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-primary">Experience</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExperience([...experience, { ...EMPTY_EXP }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {experience.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No experience added yet. Click "Add" to add one.
              </p>
            )}
            {experience.map((exp, ei) => (
              <div key={ei} className="mb-4 p-3 bg-secondary/30 rounded-lg relative">
                <div className="grid sm:grid-cols-3 gap-2 mb-2">
                  <Input
                    placeholder="Job Title"
                    value={exp.title}
                    onChange={(e) =>
                      setExperience(updateArr(experience, ei, { title: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Company"
                    value={exp.company}
                    onChange={(e) =>
                      setExperience(updateArr(experience, ei, { company: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Duration"
                    value={exp.duration}
                    onChange={(e) =>
                      setExperience(updateArr(experience, ei, { duration: e.target.value }))
                    }
                  />
                </div>
                {exp.bullets.map((b, bi) => (
                  <div key={bi} className="flex gap-1.5 mb-1.5">
                    <span className="text-xs text-muted-foreground mt-2.5">•</span>
                    <Input
                      placeholder="Describe responsibility..."
                      value={b}
                      onChange={(e) => {
                        const nb = [...exp.bullets];
                        nb[bi] = e.target.value;
                        setExperience(updateArr(experience, ei, { bullets: nb }));
                      }}
                      className="flex-1"
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setExperience(updateArr(experience, ei, { bullets: [...exp.bullets, ""] }))
                  }
                  className="text-xs mt-1"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Bullet
                </Button>
                <button
                  onClick={() => setExperience(experience.filter((_, j) => j !== ei))}
                  className="absolute top-2 right-2 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </Card>

          {/* Extras & Languages */}
          <Card className="p-5">
            <h3 className="font-bold mb-3 text-primary">Additional</h3>
            <Input
              placeholder="Languages (e.g. English, Hindi)"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="mb-3"
            />
            <Input
              placeholder="Target Roles (e.g. Full-Stack Developer)"
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
              className="mb-3"
            />
            <label className="text-sm font-medium block mb-2">Extracurricular Activities</label>
            {extras.map((ex, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <Input
                  placeholder="Activity..."
                  value={ex}
                  onChange={(e) => {
                    const n = [...extras];
                    n[i] = e.target.value;
                    setExtras(n);
                  }}
                />
                {extras.length > 1 && (
                  <button
                    onClick={() => setExtras(extras.filter((_, j) => j !== i))}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExtras([...extras, ""])}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </Card>

          <Button
            onClick={() => saveResume.mutate()}
            disabled={saveResume.isPending}
            className="w-full h-12 shadow-glow"
          >
            {saveResume.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}{" "}
            Save Resume
          </Button>
        </div>
      ) : (
        /* ====== PREVIEW ====== */
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div
            ref={resumeRef}
            className="p-8 text-gray-900"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", lineHeight: 1.45 }}
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{name || "Your Name"}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 border-b-2 border-gray-200 pb-3 mb-5">
              {email && <span>✉️ {email}</span>}
              {phone && <span>📞 {phone}</span>}
              {location && <span>📍 {location}</span>}
              {linkedin && <span>🔗 {linkedin}</span>}
              {github && <span>🐙 {github}</span>}
            </div>

            {objective && (
              <ResumeSection title="CAREER OBJECTIVE">
                <p className="text-sm text-gray-800">{objective}</p>
              </ResumeSection>
            )}

            {education.some((e) => e.degree) && (
              <ResumeSection title="EDUCATION">
                {education
                  .filter((e) => e.degree)
                  .map((e, i) => (
                    <div key={i} className="mb-2">
                      <div className="flex justify-between">
                        <span className="font-bold">
                          {e.institution} ({e.year})
                        </span>
                        {e.score && <span className="text-sm">{e.score}</span>}
                      </div>
                      <div className="text-sm">{e.degree}</div>
                    </div>
                  ))}
              </ResumeSection>
            )}

            {skills.some((s) => s.items.length > 0) && (
              <ResumeSection title="TECHNICAL SKILLS">
                {skills
                  .filter((s) => s.items.length)
                  .map((s, i) => (
                    <div key={i} className="mb-2">
                      <strong className="text-sm text-blue-900 inline-block min-w-[130px]">
                        {s.category}:
                      </strong>
                      <span className="inline-flex flex-wrap gap-1.5">
                        {s.items.map((item, j) => (
                          <span
                            key={j}
                            className="bg-indigo-50 text-indigo-900 text-xs px-2.5 py-0.5 rounded-full"
                          >
                            {item}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
              </ResumeSection>
            )}

            {projects.some((p) => p.title) && (
              <ResumeSection title="PROJECTS">
                {projects
                  .filter((p) => p.title)
                  .map((p, i) => (
                    <div key={i} className="mb-4">
                      <div className="font-bold text-blue-900">{p.title}</div>
                      {p.tech_stack && (
                        <span className="inline-block text-xs font-medium text-blue-700 bg-gray-100 px-2.5 py-0.5 rounded-full mt-1 mb-1.5">
                          {p.tech_stack}
                        </span>
                      )}
                      <ul className="list-disc pl-5 text-sm space-y-0.5">
                        {p.bullets.filter(Boolean).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                      {p.live_url && (
                        <div className="text-xs mt-1">
                          🔗{" "}
                          <a href={p.live_url} className="text-blue-600">
                            {p.live_url}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
              </ResumeSection>
            )}

            {experience.some((e) => e.title) && (
              <ResumeSection title="EXPERIENCE">
                {experience
                  .filter((e) => e.title)
                  .map((e, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between">
                        <span className="font-bold text-blue-900">
                          {e.title} | {e.company}
                        </span>
                        <span className="text-sm text-gray-500">{e.duration}</span>
                      </div>
                      <ul className="list-disc pl-5 text-sm space-y-0.5">
                        {e.bullets.filter(Boolean).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </ResumeSection>
            )}

            {extras.some(Boolean) && (
              <ResumeSection title="EXTRACURRICULAR ACTIVITIES">
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  {extras.filter(Boolean).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </ResumeSection>
            )}

            {languages && (
              <ResumeSection title="LANGUAGES">
                <div className="flex gap-2 mt-1">
                  {languages.split(",").map((l, i) => (
                    <span
                      key={i}
                      className="bg-indigo-50 text-indigo-900 text-xs px-2.5 py-0.5 rounded-full"
                    >
                      {l.trim()}
                    </span>
                  ))}
                </div>
              </ResumeSection>
            )}

            {targetRoles && (
              <div className="mt-4 bg-green-50 border-l-4 border-green-600 p-2 rounded-r text-sm text-green-800 text-center font-medium">
                🚀 Open to: {targetRoles}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold uppercase tracking-wider text-blue-900 border-l-4 border-blue-600 pl-3 mb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}
