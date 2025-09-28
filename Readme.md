# Teacher De-escalation Micro-Sim (Situation 3)

A tiny, single-file web app that lets you practice a classroom de-escalation scenario and see the consequences of different teacher responses in seconds. Designed for hackathon demos: no installs, runs in any modern browser, and looks great full-screen on a headset (“VR-ish”) or laptop.

---

## 📸 What it is

- **Scenario:** Elementary school field trip; student didn’t see an exhibit, peers tease, emotions rise.
- **Your choices:**  
  1) **Yell** at the frustrated student  
  2) **Separate** the student from the class (private, supportive talk)  
  3) **Ignore** the situation
- **Immediate outcomes:** The log updates, the **NPC’s state** (emoji + chip) changes, and a status tag summarizes the result (De-escalation / Escalation / Avoidance).

Everything is **hard-coded for reliability** during judging. No network calls. One HTML file with minimal CSS + vanilla JS.

---

## 🧪 Why it matters

Teachers rarely get low-risk reps to practice de-escalation. This micro-sim gives a quick, repeatable loop to compare **bad vs good** responses and rehearse the language that calms things down.

---

## 🚀 Quick start

1. **Clone or download** the repo (or just the single `index.html` if that’s how you’re packaging it).
2. **Open `index.html`** by double-clicking it (Chrome/Edge/Firefox/Safari).
3. **Press `F11`** (Windows) or **`Ctrl⌘F`** (macOS on Chrome) to go **full-screen** for a “VR-ish” feel.
4. Click one of the three options on the right. Use **Restart** to try another path.

> Tip: On a headset (Quest Browser), simply open the page and toggle full-screen. The UI is tuned for readability at distance.

---

## 🧩 How it works (short)

- **State:** Two small JS objects power the app:
  - `initialTranscript`: the pre-scripted opening dialogue (students A/B/C).
  - `outcomes`: the three branches (teacher line, aftermath lines, status tags, and NPC emotion).
- **Renderer:** Each line is appended to the left-panel **log**. The **NPC card** (emoji + “Agitated/Calmer/Distressed” chip) updates to reflect the outcome.
- **Reset:** `Restart` clears the log and replays the opening transcript.

No frameworks, build steps, or external dependencies.

---

## 🗂 Repo layout

```
.
├── index.html        # Single-file app (HTML + CSS + JS)
└── README.md         # You are here
```

---

## 🎮 Using it in a demo (7-minute flow)

1. **Hook (why):** “When one student melts down, the whole class derails. Practice beats theory.”
2. **Bad path:** Choose **Yell** → watch **Escalation** status + NPC turns “Upset.”
3. **Good path:** Restart → choose **Separate** → **De-escalation** + calmer NPC.
4. **Takeaway:** “This is a bite-size sim teachers can run on any device, between periods, no install.”

(Optional) Keep a short screen-capture video handy as a fallback if Wi-Fi or hardware acts up.

---

## 🛠 Customize the scenario

Open `index.html` and scroll to the script section:

```js
const initialTranscript = [
  { who: "Student A (frustrated)", text: "It's not fair! ..." },
  { who: "Student B (teasing)",     text: "Maybe you were too slow! ..." },
  // ...
];

const outcomes = {
  yell: {
    teacher: "Ok, that's enough! ...",
    aftermath: [
      { who: "Student A (reacts)", text: "That's not fair! ..." },
      { who: "Narration", text: "After being yelled at, ..." }
    ],
    tags: [{ cls: "bad", text: "Escalation" }, { cls: "", text: "Emotional safety ↓" }],
    status: { text: "Outcome: Escalation ...", kind: "bad" },
    npc: { emoji: "😠", feelClass: "bad", feelText: "Upset", line: "\"Please stop yelling…\"", aside: "Heart rate ↑, fight/flight" }
  },
  // separate, ignore ...
};
```

- Add/edit lines to **change dialogue**.
- Update `npc` to change **emoji** and the **state chip** text.
- Status tags use classes `ok`, `warn`, `bad` for color.

---

## 🧱 Design choices

- **Single file** → dead simple to run anywhere.
- **Deterministic** → no loading spinners, no API keys, no surprises.
- **Readable at distance** → larger base font, high contrast, gentle motion only.

---

## 🧯 Demo reliability checklist

- Test once on the headset/laptop in **full-screen**.  
- Keep a **local copy** (no CDNs) to avoid captive portals/Wi-Fi issues.  
- Have a **45-second MP4** of a complete run as a last-resort fallback.

---

## 🧭 Roadmap (post-hackathon ideas)

These are **not** required for judging, but easy follow-ups:

- **Keyboard shortcuts:** `1/2/3` to choose, `R` restart, `F` full-screen.
- **Reflection card:** one-liner explaining why a choice helped/hurt.
- **Agitation heatbar:** tiny meter that rises/falls per choice.
- **Author mode:** inline JSON editor + Apply to live-reload the script.
- **Local analytics:** count paths and time-to-calm; export as CSV.
- **Service worker:** offline cache of this single file.

---

## 📄 License

MIT — do whatever helps teachers and students. Attribution appreciated.
