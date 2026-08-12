// First-run guided tours (issue #284, v2 revision). Each tour is keyed by
// the same section name the backend tracks in User.onboardingSeen (see
// agent-backend/src/modules/users/profile.validator.js ONBOARDING_SECTIONS
// — keep these two lists in sync). The first step of each tour omits
// `selector` for a centered welcome card; NextStep renders that gracefully
// (see nextstepjs's NextStepReact.js: `if (!step.selector) return;`).

export const ONBOARDING_SECTIONS = {
  dashboard: "dashboardTour",
  studio: "studioTour",
  developer: "developerTour",
  developerProject: "developerProjectTour",
};

export const onboardingTours = [
  {
    tour: ONBOARDING_SECTIONS.dashboard,
    steps: [
      {
        icon: "👋",
        title: "Welcome to Persona.ai",
        content: "A quick look at where everything lives.",
      },
      {
        icon: "🧭",
        title: "Explore",
        content: "Find agents to talk to.",
        selector: "#onboarding-dashboard-explore",
        side: "right",
      },
      {
        icon: "🤖",
        title: "My Agents",
        content: "Open the agents you've created or saved.",
        selector: "#onboarding-dashboard-my-agents",
        side: "right",
        selectorRetryAttempts: 3,
      },
      {
        icon: "💬",
        title: "Your conversations",
        content:
          "Every chat you start is saved here — pick one back up any time.",
        selector: "#onboarding-dashboard-threads",
        side: "right",
      },
      {
        icon: "🔌",
        title: "Connect a provider",
        content:
          "Add an LLM API key here — an agent can't respond without one.",
        selector: "#onboarding-dashboard-settings",
        side: "right",
      },
    ],
  },
  {
    tour: ONBOARDING_SECTIONS.studio,
    steps: [
      {
        icon: "👋",
        title: "Welcome to Agent Studio",
        content: "Build, configure, and publish your own agents from here.",
      },
      {
        icon: "📊",
        title: "Overview",
        content: "See every agent you've built at a glance.",
        selector: "#onboarding-studio-overview",
        side: "right",
      },
      {
        icon: "🤖",
        title: "Agents",
        content: "Manage each agent's configuration here.",
        selector: "#onboarding-studio-agents",
        side: "right",
      },
      {
        icon: "🔑",
        title: "Providers",
        content:
          "Connect an LLM — OpenAI, Anthropic, Gemini, DeepSeek, or a custom endpoint. Your agents need this to run.",
        selector: "#onboarding-studio-providers",
        side: "right",
        selectorRetryAttempts: 3,
      },
      {
        icon: "🧩",
        title: "Skills, Knowledge, Connectors & Memory",
        content:
          "Give an agent reusable skills, documents to search, external tools, and long-term memory.",
        selector: "#onboarding-studio-resources",
        side: "right",
      },
      {
        icon: "✨",
        title: "Create your first agent",
        content: "Start here when you're ready.",
        selector: "#onboarding-studio-new-agent",
        side: "right",
      },
    ],
  },
  {
    tour: ONBOARDING_SECTIONS.developer,
    steps: [
      {
        icon: "👋",
        title: "Welcome to Developer Studio",
        content:
          "Manage Projects, members, and credentials for programmatic access to Persona's agent infrastructure.",
      },
      {
        icon: "📁",
        title: "Projects",
        content:
          "Every Project you're a member of, each with its own providers, agents, and credentials.",
        selector: "#onboarding-developer-projects",
        side: "right",
      },
      {
        icon: "✨",
        title: "Create a Project",
        content: "Start a new one here.",
        selector: "#onboarding-developer-new-project",
        side: "right",
      },
      {
        icon: "↩️",
        title: "Back to Persona",
        content: "Jump back to the consumer app any time.",
        selector: "#onboarding-developer-back-to-persona",
        side: "right",
      },
    ],
  },
  {
    tour: ONBOARDING_SECTIONS.developerProject,
    steps: [
      {
        icon: "👋",
        title: "Welcome to your Project",
        content:
          "This page manages one Project's members, credentials, agents, and resources.",
      },
      {
        icon: "📑",
        title: "Everything lives in these tabs",
        content:
          "Members, credentials, agents, skills, stores, knowledge, connectors, providers, and audit logs — all scoped to this Project.",
        selector: "#onboarding-developer-project-tabs",
        side: "bottom",
        // This page fetches the Project before rendering its tabs/cards —
        // unlike sidebar nav items (present at layout mount), these
        // selectors may not exist yet when the tour starts.
        selectorRetryAttempts: 6,
        selectorRetryDelay: 300,
      },
      {
        icon: "📋",
        title: "Project details",
        content: "Rename this Project or update its description here.",
        selector: "#onboarding-developer-project-details",
        side: "right",
        selectorRetryAttempts: 6,
        selectorRetryDelay: 300,
      },
      {
        icon: "⚠️",
        title: "Lifecycle",
        content:
          "Suspend, reactivate, or delete this Project. Deleting stops its credentials from authenticating immediately.",
        selector: "#onboarding-developer-project-lifecycle",
        side: "right",
        selectorRetryAttempts: 6,
        selectorRetryDelay: 300,
      },
    ],
  },
];
