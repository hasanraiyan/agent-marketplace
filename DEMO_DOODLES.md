# Demo Doodles — Image-Gen Storyboard (16:9)

A sequence of hand-drawn whiteboard-doodle images to present instead of scrolling through markdown.
Generate each with an AI image tool, drop them into a slide deck / Excalidraw canvas in order, and
narrate over them. The arc is **problem → pain → reveal → how it works**: start with what Persona
is, show what building an agent into your own app normally costs you, then reveal the SDK as the
thing that makes that pain disappear.

**Consistent style prefix — paste this at the start of every prompt** so all 10 images look like one
deck, not ten random styles:

> Hand-drawn whiteboard doodle illustration, 16:9 widescreen, black felt-tip marker line art on a
> clean white/cream background, playful startup-pitch-deck sketch style, minimal color accents in
> only two colors (marker-blue and marker-orange), simple labeled icons and boxes connected by
> loose hand-drawn arrows, bold hand-lettered text labels, no photorealism, no gradients, no 3D
> render — looks like it was drawn live on a whiteboard during a pitch.

---

## Storyboard order

1. What is Persona
2. What is a Project — add a Provider, create an Agent
3. The problem — everything you'd have to build yourself
4. The pain repeats — every agent, every app
5. The reveal — one SDK replaces all of it
6. How it works — the SDK layer stack
7. Raw SDK: one script, one agent
8. Full-stack integration: adapter + React
9. Streaming chat in motion
10. Closing: same backend, three ways in

---

### 1. What is Persona

**Say while showing it:** *"Persona.ai — a place to build and run AI agents, on a shared backend."*

**Prompt:**

> [style prefix] A big bold hand-lettered title reading "Persona.ai" in the center, underlined with
> a single marker stroke. Below it, a smaller hand-lettered subtitle: "Agent Marketplace + Developer
> Platform". To the left, a simple doodle of a stick-figure person waving. To the right, a friendly
> round-headed robot doodle with a small antenna, waving back. A loose hand-drawn arrow connects
> them with a small speech bubble reading "hi!". Plenty of empty white space, centered composition.

---

### 2. What is a Project — add a Provider, create an Agent

**Say while showing it:** *"Inside Developer Studio, you spin up a Project — your own isolated
workspace. Plug in a model provider, then create an agent. A few clicks, no code yet."*

**Prompt:**

> [style prefix] A large rounded rectangle labeled "Project" at the top, drawn like a folder tab.
> Inside it, three smaller boxes connected left-to-right by arrows: Box 1, a plug icon with a tiny
> lightning bolt, labeled "Add Provider" (small faint text under it: "OpenAI / Anthropic / etc").
> Box 2, a key icon, labeled "Mint Credential". Box 3, a round-headed robot icon, labeled "Create
> Agent". A small hand-lettered note below the row reads "your own workspace — nothing shared with
> anyone else".

---

### 3. The problem — everything you'd have to build yourself

**Say while showing it:** *"Okay, you have an agent. Now you actually want to put it in YOUR app —
a real chat feature, for real users. Suddenly you need a lot more than 'call the model.'"*

**Prompt:**

> [style prefix] A stressed stick-figure developer sitting at a laptop in the center, scratching
> their head, surrounded by a chaotic tangle of hand-drawn boxes connected by messy crisscrossing
> arrows — like an overwhelming whiteboard mind-map. Each box is a small rounded rectangle with a
> hand-lettered label: "chat route", "streaming (SSE)", "save conversation history", "user memory /
> preferences", "file uploads", "auth per user", "retry on error", "rate limits", "tool calling".
> A large hand-drawn thought-bubble above the developer's head contains a big scribbled question
> mark. A banner along the top reads "To ship ONE agent in your app, you need to build ALL of
> this."

---

### 4. The pain repeats — every agent, every app

**Say while showing it:** *"And you'd rebuild this exact mess for every agent, in every app, over
and over."*

**Prompt:**

> [style prefix] Three small identical "messy tangle" boxes in a row (each a miniature, simplified
> version of a chaotic route diagram — a few crossed arrows and tiny illegible boxes), each one
> sitting under its own stick-figure developer looking equally tired, each developer separated by
> a vertical divider line. Above the row, a hand-lettered banner reads "Every agent. Every app.
> Every time." A large hand-drawn arrow loops from the third messy box back to the first one,
> suggesting an endless repeating cycle.

---

### 5. The reveal — one SDK replaces all of it

**Say while showing it:** *"Persona hands you the SDK. It already built all of that — you get it
in one install."*

**Prompt:**

> [style prefix] The same chaotic tangle of small labeled route-boxes from before ("chat route",
> "streaming", "memory", "files", "auth", "retries", "tool calling") shown on the left, but this
> time being swept up by a large hand-drawn broom into a single clean rounded box on the right
> labeled in bold hand-lettering "@personaai/sdk" with a small checkmark next to it. A few
> motion-lines trail behind the broom to suggest the sweeping motion. Above the clean box, a
> hand-lettered banner reads "One SDK. Already built." The stressed stick-figure developer from
> before now stands next to the clean box smiling, arms relaxed.

---

### 6. How it works — the SDK layer stack

**Say while showing it:** *"Pick the depth you need — the credential never leaves the bottom two
boxes."*

**Prompt:**

> [style prefix] Four stacked horizontal boxes drawn like a layered cake, connected top-to-bottom
> with short downward arrows. Top box: a simple browser-window icon, labeled "Your React Frontend —
> @personaai/react". Second box: a laptop/server icon, labeled "Your Backend — @personaai/adapters".
> Third box: a small gear-and-arrow icon, labeled "@personaai/sdk (raw calls)". Bottom box: a small
> cloud icon, labeled "Persona Backend (agent-backend)". On the right side, a bracket spans the
> bottom two boxes with a hand-lettered note: "credential lives here only" next to a small padlock
> icon.

---

### 7. Raw SDK: one script, one agent

**Say while showing it:** *"The simplest possible integration — a script and a few lines."*

**Prompt:**

> [style prefix] A doodle of an open laptop on the left showing a few squiggly lines representing
> code on its screen, labeled above "node sdk-demo.mjs". A loose hand-drawn arrow points from the
> laptop to a small cloud icon in the middle labeled "Persona API". From the cloud, another arrow
> points right to a round-headed robot icon inside a speech bubble that says "Here are some
> internships...". Small dotted lines trailing from the speech bubble suggest streaming text.

---

### 8. Full-stack integration: adapter + React

**Say while showing it:** *"This is what a real product actually ships."*

**Prompt:**

> [style prefix] A wide rounded rectangle labeled "Your Own App" containing two boxes side by side
> connected by a short arrow. Left box: a server-rack icon labeled "Backend — mounts
> @personaai/adapters" with a small padlock icon next to the label "credential stays here". Right
> box: a simple browser-window icon containing three small chat-bubble shapes, labeled "Frontend —
> @personaai/react useChat". An arrow from the left box to the right box is labeled "same-origin
> fetch, no credential". Outside the big rectangle, above it, a small cloud icon labeled "Persona
> Backend" connects down into the left box only.

---

### 9. Streaming chat in motion

**Say while showing it:** *"Token by token, live — and it can call tools mid-answer."*

**Prompt:**

> [style prefix] A simple browser-window doodle in the center showing a chat interface: one chat
> bubble on the right labeled "You: internships?" and, below it, a growing chat bubble on the left
> with a few words written and a trailing row of small dots/dashes suggesting text still streaming
> in. Little lightning-bolt icons flow in a loose arc from a cloud icon above into the streaming
> bubble, each bolt labeled faintly "chunk". A small wrench icon with a mini arrow pops out beside
> the bubble labeled "tool call", showing the agent using a tool mid-answer.

---

### 10. Closing: same backend, three ways in

**Say while showing it:** *"Same agent, same backend — three doors in, pick yours."*

**Prompt:**

  > [style prefix] A single castle/server-tower icon in the center-right labeled "agent-backend".
  > Three winding hand-drawn roads lead into it from the left, each with a small stick-figure walking
  > along it and a label near its start: top road labeled "Raw SDK", middle road labeled "Adapter +
  > Backend", bottom road labeled "React Hooks + UI". All three roads converge at the tower's front
  > gate. A hand-lettered banner across the top reads "Same backend. Three ways in."

---

## Notes on generating these

- Generate all 10 in the **same session/tool** back-to-back so the marker style, line weight, and
  color accents stay consistent — switching tools mid-set is the most common way a doodle deck ends
  up looking mismatched.
- If your image tool doesn't support a literal "16:9" instruction, request `1920x1080` or
  `1280x720` explicitly instead.
- If a generated image drifts into 3D/glossy render territory, add `flat 2D line art, no shading,
  no gradients` to the end of that prompt and regenerate just that one.
- Import the finished PNGs into Excalidraw as images (drag-and-drop), then you can annotate live
  on top of them during the actual demo (circle things, draw a live arrow) without losing the doodle
  look.
- Slides 3→5 are the emotional core of the pitch (problem → repeated pain → relief) — give them the
  most air time when presenting; don't rush past the "messy tangle" image.
