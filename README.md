# UQ Study

A Progressive Web App for UQ students — exam-style practice, spaced repetition, grade calculator, and subject information pulled from the official UQ Programs & Courses catalogue.

## Features

- **UQ catalogue search** — Find bachelor programs and courses from [programs-courses.uq.edu.au](https://programs-courses.uq.edu.au)
- **Subject details** — Prerequisites, assessment methods, summaries, and offerings
- **Exam-style practice** — Inspera-inspired UI with timed sessions, flagging, and multiple choice
- **Upload practice exams** — JSON format with support for images, tables, and graphs
- **Spaced repetition** — SM-2 algorithm tracks what to review and when
- **Study insights** — Tells you which topics need the most work
- **Crash courses** — Short revision when you get a question wrong
- **UQ grade calculator** — Weighted assessments, 7-point scale, program GPA
- **Firebase backend** — Email/password auth, Firestore, Storage

## Firebase Project

- **Project ID:** `school-6e6a4`
- **Project Number:** `307899354639`
- **Web App ID:** `1:307899354639:web:96930146b2b578a0345d7a`

## Getting Started

```bash
cd uq-study
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` if you need to reconfigure Firebase (values are already set for this project).

## Upload Exam Format

```json
{
  "title": "2024 Final Exam",
  "questions": [
    {
      "stem": "Which of the following is correct?",
      "options": [
        { "id": "a", "text": "Option A" },
        { "id": "b", "text": "Option B" }
      ],
      "correctAnswer": "a",
      "explanation": "Because...",
      "topic": "Topic name",
      "media": [
        {
          "type": "table",
          "tableData": [["Header 1", "Header 2"], ["A", "B"]]
        }
      ]
    }
  ]
}
```

## Deploy

```bash
npm run build
npx firebase-tools@latest deploy
```

For full Next.js SSR with API routes, consider [Firebase App Hosting](https://firebase.google.com/docs/app-hosting) instead of static `out/` hosting.

## Security

Firestore and Storage rules are configured for authenticated, owner-only access. Review `firestore.rules` before broad distribution.
