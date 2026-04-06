export const featuredAgents = [
  {
    id: 1,
    name: 'CodeReviewer Pro',
    description:
      'AI-powered code review agent that analyzes pull requests, suggests improvements, and catches bugs before they reach production.',
    category: 'Development',
    author: 'DevTools Team',
    rating: 4.9,
    users: 12400,
    tags: ['code-review', 'quality', 'automation'],
    image: null,
  },
  {
    id: 2,
    name: 'ContentCraft',
    description:
      'Generate blog posts, social media content, and marketing copy optimized for your brand voice and target audience.',
    category: 'Content Creation',
    author: 'MarketingAI',
    rating: 4.7,
    users: 8900,
    tags: ['writing', 'marketing', 'social-media'],
    image: null,
  },
  {
    id: 3,
    name: 'DataInsight',
    description:
      'Analyze datasets, generate visualizations, and extract actionable insights from your business data automatically.',
    category: 'Data Analysis',
    author: 'Analytics Lab',
    rating: 4.8,
    users: 6700,
    tags: ['analytics', 'visualization', 'insights'],
    image: null,
  },
  {
    id: 4,
    name: 'SupportBot',
    description:
      'Intelligent customer support agent that handles tickets, answers FAQs, and escalates complex issues to human agents.',
    category: 'Customer Support',
    author: 'SupportAI Inc',
    rating: 4.6,
    users: 15200,
    tags: ['support', 'chatbot', 'helpdesk'],
    image: null,
  },
  {
    id: 5,
    name: 'ResearchMate',
    description:
      'Academic research assistant that summarizes papers, finds relevant literature, and helps with literature reviews.',
    category: 'Research',
    author: 'AcademicAI',
    rating: 4.8,
    users: 5300,
    tags: ['research', 'academic', 'literature'],
    image: null,
  },
  {
    id: 6,
    name: 'Workflow Automator',
    description:
      'Connect your tools and automate repetitive tasks across platforms with intelligent workflow orchestration.',
    category: 'Automation',
    author: 'AutoFlow',
    rating: 4.5,
    users: 9800,
    tags: ['automation', 'workflow', 'integration'],
    image: null,
  },
];

export const categories = [
  {
    id: 1,
    name: 'Customer Support',
    description: 'Agents for handling customer inquiries and tickets',
    icon: 'Headphones',
    count: 142,
  },
  {
    id: 2,
    name: 'Data Analysis',
    description: 'Agents for processing and visualizing data',
    icon: 'BarChart3',
    count: 98,
  },
  {
    id: 3,
    name: 'Content Creation',
    description: 'Agents for writing, design, and media generation',
    icon: 'PenTool',
    count: 215,
  },
  {
    id: 4,
    name: 'Development',
    description: 'Agents for coding, testing, and deployment',
    icon: 'Code2',
    count: 176,
  },
  {
    id: 5,
    name: 'Research',
    description: 'Agents for academic and market research',
    icon: 'Search',
    count: 87,
  },
  {
    id: 6,
    name: 'Automation',
    description: 'Agents for workflow and task automation',
    icon: 'Zap',
    count: 134,
  },
];

export const stats = [
  { label: 'AI Agents', value: '850+', suffix: '' },
  { label: 'Active Users', value: '58K', suffix: '' },
  { label: 'Deployments', value: '120K', suffix: '' },
  { label: 'Categories', value: '24', suffix: '' },
];

export const howItWorks = [
  {
    step: 1,
    title: 'Browse Agents',
    description:
      'Explore our marketplace of pre-built AI agents and templates. Filter by category, rating, or use case to find the perfect fit.',
    icon: 'Search',
  },
  {
    step: 2,
    title: 'Customize',
    description:
      'Configure your chosen agent to match your needs. Adjust prompts, connect data sources, and set up integrations with your existing tools.',
    icon: 'Settings',
  },
  {
    step: 3,
    title: 'Deploy',
    description:
      'Launch your agent to production with a single click. Monitor performance, gather feedback, and iterate with ease.',
    icon: 'Rocket',
  },
];

export const testimonials = [
  {
    id: 1,
    name: 'Sarah Chen',
    role: 'CTO, TechStart',
    quote:
      'We deployed a customer support agent in under an hour. Response times dropped by 60% and our team can focus on complex issues.',
    avatar: null,
  },
  {
    id: 2,
    name: 'Marcus Johnson',
    role: 'Lead Developer, DataFlow',
    quote:
      "The code review agent caught critical bugs that our team missed. It's like having an extra senior developer on every PR.",
    avatar: null,
  },
  {
    id: 3,
    name: 'Elena Rodriguez',
    role: 'Marketing Director, GrowthLab',
    quote:
      'ContentCraft transformed our content pipeline. We went from 2 blog posts a month to 12, all maintaining our brand voice.',
    avatar: null,
  },
];

export const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Browse Agents', href: '/browse' },
  { label: 'Create Agent', href: '/create' },
  { label: 'Docs', href: '/docs' },
  { label: 'Pricing', href: '/pricing' },
];

export const footerLinks = {
  product: [
    { label: 'Browse Agents', href: '/browse' },
    { label: 'Create Agent', href: '/create' },
    { label: 'Templates', href: '/templates' },
    { label: 'Pricing', href: '/pricing' },
  ],
  resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'Tutorials', href: '/tutorials' },
    { label: 'Blog', href: '/blog' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
};
