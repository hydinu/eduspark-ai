// Master list of learning platforms for course recommendations
export interface Platform {
  name: string;
  url: string;
  category: string;
  hasCert: boolean;
  free: boolean;
  bestFor: string;
  icon: string;
}

export const PLATFORMS: Platform[] = [
  // Global Learning
  {
    name: "Coursera",
    url: "https://coursera.org",
    category: "Global",
    hasCert: true,
    free: false,
    bestFor: "Structured learning + career courses",
    icon: "🎓",
  },
  {
    name: "edX",
    url: "https://edx.org",
    category: "Global",
    hasCert: true,
    free: false,
    bestFor: "Harvard, MIT deep CS knowledge",
    icon: "🏛️",
  },
  {
    name: "Udemy",
    url: "https://udemy.com",
    category: "Global",
    hasCert: true,
    free: false,
    bestFor: "Practical web dev, AI courses",
    icon: "📚",
  },
  {
    name: "Udacity",
    url: "https://udacity.com",
    category: "Global",
    hasCert: true,
    free: false,
    bestFor: "Job-ready nanodegrees",
    icon: "🚀",
  },

  // Indian Govt / IIT
  {
    name: "NPTEL",
    url: "https://nptel.ac.in",
    category: "Indian Govt",
    hasCert: true,
    free: true,
    bestFor: "IIT professors, exam-based certs",
    icon: "🇮🇳",
  },
  {
    name: "SWAYAM",
    url: "https://swayam.gov.in",
    category: "Indian Govt",
    hasCert: true,
    free: true,
    bestFor: "Govt-certified courses",
    icon: "🏫",
  },
  {
    name: "Spoken Tutorial IIT Bombay",
    url: "https://spoken-tutorial.org",
    category: "Indian Govt",
    hasCert: true,
    free: true,
    bestFor: "Python, Linux basics",
    icon: "🎯",
  },

  // Web Dev & Coding
  {
    name: "freeCodeCamp",
    url: "https://freecodecamp.org",
    category: "Web Dev",
    hasCert: true,
    free: true,
    bestFor: "Full web dev roadmap (FREE)",
    icon: "⚡",
  },
  {
    name: "W3Schools",
    url: "https://w3schools.com",
    category: "Web Dev",
    hasCert: true,
    free: true,
    bestFor: "HTML, CSS, JS basics",
    icon: "📖",
  },
  {
    name: "Codecademy",
    url: "https://codecademy.com",
    category: "Web Dev",
    hasCert: true,
    free: false,
    bestFor: "Learn by doing",
    icon: "💻",
  },
  {
    name: "MDN Web Docs",
    url: "https://developer.mozilla.org",
    category: "Web Dev",
    hasCert: false,
    free: true,
    bestFor: "Real developer reference",
    icon: "📋",
  },

  // Cloud & Industry
  {
    name: "AWS Training",
    url: "https://aws.amazon.com/training",
    category: "Cloud",
    hasCert: true,
    free: false,
    bestFor: "Cloud jobs (global value)",
    icon: "☁️",
  },
  {
    name: "Cisco Networking Academy",
    url: "https://skillsforall.com",
    category: "Cloud",
    hasCert: true,
    free: true,
    bestFor: "Networking (CCNA)",
    icon: "🌐",
  },
  {
    name: "IBM SkillsBuild",
    url: "https://skillsbuild.org",
    category: "Cloud",
    hasCert: true,
    free: true,
    bestFor: "AI + cybersecurity",
    icon: "🔵",
  },
  {
    name: "Microsoft Learn",
    url: "https://learn.microsoft.com",
    category: "Cloud",
    hasCert: true,
    free: true,
    bestFor: "Azure + development",
    icon: "🟦",
  },

  // Free Certificates
  {
    name: "Google Digital Garage",
    url: "https://learndigital.withgoogle.com",
    category: "Free Certs",
    hasCert: true,
    free: true,
    bestFor: "Digital marketing, data",
    icon: "🟢",
  },
  {
    name: "HubSpot Academy",
    url: "https://academy.hubspot.com",
    category: "Free Certs",
    hasCert: true,
    free: true,
    bestFor: "Marketing, sales certs",
    icon: "🟠",
  },
  {
    name: "Great Learning",
    url: "https://greatlearning.in",
    category: "Free Certs",
    hasCert: true,
    free: true,
    bestFor: "Free tech courses",
    icon: "📗",
  },

  // Coding Practice
  {
    name: "LeetCode",
    url: "https://leetcode.com",
    category: "Practice",
    hasCert: false,
    free: true,
    bestFor: "DSA + interview prep",
    icon: "🧩",
  },
  {
    name: "GeeksforGeeks",
    url: "https://geeksforgeeks.org",
    category: "Practice",
    hasCert: true,
    free: true,
    bestFor: "Learning + practice",
    icon: "🟩",
  },
  {
    name: "HackerRank",
    url: "https://hackerrank.com",
    category: "Practice",
    hasCert: true,
    free: true,
    bestFor: "Skill certificates",
    icon: "🟨",
  },
  {
    name: "CodeChef",
    url: "https://codechef.com",
    category: "Practice",
    hasCert: false,
    free: true,
    bestFor: "Competitive coding",
    icon: "👨‍🍳",
  },
  {
    name: "Codeforces",
    url: "https://codeforces.com",
    category: "Practice",
    hasCert: false,
    free: true,
    bestFor: "Advanced competitive coding",
    icon: "⚔️",
  },
  {
    name: "InterviewBit",
    url: "https://interviewbit.com",
    category: "Practice",
    hasCert: false,
    free: true,
    bestFor: "Structured interview prep",
    icon: "💡",
  },

  // Project Building
  {
    name: "Frontend Mentor",
    url: "https://frontendmentor.io",
    category: "Projects",
    hasCert: false,
    free: true,
    bestFor: "Real-world UI projects",
    icon: "🎨",
  },
  {
    name: "CodePen",
    url: "https://codepen.io",
    category: "Projects",
    hasCert: false,
    free: true,
    bestFor: "Experimenting with code",
    icon: "✏️",
  },
  {
    name: "Replit",
    url: "https://replit.com",
    category: "Projects",
    hasCert: false,
    free: true,
    bestFor: "Build & deploy projects",
    icon: "🔧",
  },

  // Theory
  {
    name: "MIT OpenCourseWare",
    url: "https://ocw.mit.edu",
    category: "Theory",
    hasCert: false,
    free: true,
    bestFor: "Deep CS understanding",
    icon: "🏛️",
  },
  {
    name: "Khan Academy",
    url: "https://khanacademy.org",
    category: "Theory",
    hasCert: false,
    free: true,
    bestFor: "Math, science foundations",
    icon: "📐",
  },
];

export const CATEGORIES = [...new Set(PLATFORMS.map((p) => p.category))];
