# Syllabora — Universal Multimodal AI Syllabus Parser & Exam Synthesizer

> Transform messy university syllabus xeroxes, textbook indices, or raw curriculum outlines into structured, high-scoring handwritten exam master notes and oral viva defenses.

[![Live Demo](https://img.shields.io/badge/Live-syllabora.vercel.app-amber.svg)](https://syllabora.vercel.app)
[![Model](https://img.shields.io/badge/Gemini-2.5--Flash-blue.svg)](https://ai.google.dev/)
[![Hosting](https://img.shields.io/badge/Vercel-Serverless-black.svg)](https://vercel.com/)

---

## ⚡ Features

- **Multimodal Syllabus OCR:** Upload photos or xerox copies of any curriculum sheet. Syllabora extracts the course name, all units, topics, and prescribed reference literature.
- **Tri-Cognitive View:**
  - 🔴 **Full Exam Sheet:** 2-mark definitions, ASCII flowcharts/architectures, 8/16-mark mechanisms, formulas, trade-offs, and examiner grading pitfalls.
  - 🟢 **Friendly:** Real-world analogies and intuitive, jargon-free explanations.
  - 🟡 **Viva Voce:** Oral defense questions and edge-case trap answers.
- **Continuous Ruled Notebook Aesthetic:** Realistic handwritten look with margin headers, lined paper canvas, and print-ready PDF export.
- **Zero-Config Secure Proxy:** Serverless architecture proxies requests to Google Gemini without exposing credentials to the client.
- **Client-Side Compression:** Canvas-based image downscaling prevents payload bottlenecks and avoids 504 timeouts.
- **Export Options:** One-click continuous ruled sheet print-to-PDF formatting and formatted Markdown (`.md`) export compatible with Notion, Obsidian, and GitHub.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, Tailwind CSS
- **Typography:** Caveat, Kalam, Inter (Google Fonts)
- **AI Engine:** Google Gemini API (`gemini-2.5-flash`)
- **Backend Proxy:** Vercel Serverless Functions (Node.js ESM)

---

## 🚀 Local Development

1. Clone the repository:

   ```bash
   git clone [https://github.com/Rishi-web-bot/syllabora.git](https://github.com/Rishi-web-bot/syllabora.git)
   cd syllabora

   export GEMINI_API_KEY="your-gemini-api-key"
   vercel dev
   ```
