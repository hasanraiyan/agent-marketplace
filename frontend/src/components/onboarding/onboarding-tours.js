// First-run guided tours (issue #284). Each tour is keyed by the same
// section name the backend tracks in User.onboardingSeen (see
// agent-backend/src/modules/users/profile.validator.js ONBOARDING_SECTIONS
// — keep these two lists in sync). The first step of each tour omits
// `selector` for a centered welcome card; NextStep renders that gracefully
// (see nextstepjs's NextStepReact.js: `if (!step.selector) return;`).

export const ONBOARDING_SECTIONS = {
  dashboard: "dashboardTour",
  studio: "studioTour",
  developer: "developerTour",
};

export const onboardingTours = [
  {
    tour: ONBOARDING_SECTIONS.dashboard,
    steps: [
      {
        icon: "👋",
        title: "Welcome to Persona.ai",
        content:
          "This is where you discover and talk to agents. Let's take a quick look around.",
      },
      {
        icon: "🧭",
        title: "Explore",
        content: "Browse and start conversations with available agents.",
        selector: "#onboarding-dashboard-explore",
        side: "right",
      },
      {
        icon: "🤖",
        title: "My Agents",
        content: "Agents you've created or saved show up here.",
        selector: "#onboarding-dashboard-my-agents",
        side: "right",
        selectorRetryAttempts: 3,
      },
      {
        icon: "🔌",
        title: "Connect a provider",
        content:
          "Before an agent can respond, it needs an LLM provider connected — head to Settings to add your API key.",
        selector: "#onboarding-dashboard-settings",
        side: "right",
      },
      {
        icon: "✨",
        title: "Ready to build one?",
        content:
          "Agent Studio is where you create and configure your own agents.",
        selector: "#onboarding-dashboard-studio-cta",
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
        content:
          "This is the creator workspace — build, configure, and publish your own agents.",
      },
      {
        icon: "📊",
        title: "Overview",
        content: "See all of your agents at a glance.",
        selector: "#onboarding-studio-overview",
        side: "right",
      },
      {
        icon: "🤖",
        title: "Agents",
        content: "Manage every agent you've built here.",
        selector: "#onboarding-studio-agents",
        side: "right",
      },
      {
        icon: "🔑",
        title: "Providers",
        content:
          "Connect an LLM provider — OpenAI, Anthropic, Gemini, DeepSeek, or a custom endpoint — before your agents can run.",
        selector: "#onboarding-studio-providers",
        side: "right",
        selectorRetryAttempts: 3,
      },
      {
        icon: "🧩",
        title: "Skills, Knowledge, Connectors & Memory",
        content:
          "These are the building blocks an agent can use — reusable skills, documents to search, external tool connectors, and long-term memory.",
        selector: "#onboarding-studio-resources",
        side: "right",
      },
      {
        icon: "✨",
        title: "Create your first agent",
        content: "When you're ready, start here.",
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
          "This is the Project workspace — manage Projects, members, credentials, and the resources your integrations use via the API/SDK.",
      },
      {
        icon: "📁",
        title: "Projects",
        content:
          "Every Project you're a member of lives here — its own providers, agents, and credentials, scoped separately from your personal Studio work.",
        selector: "#onboarding-developer-projects",
        side: "right",
      },
      {
        icon: "✨",
        title: "Create a Project",
        content: "Start a new Project here when you're ready.",
        selector: "#onboarding-developer-new-project",
        side: "right",
      },
    ],
  },
];
