export const userClones = [
  {
    id: '1',
    name: 'Me (General Assistant)',
    tagline: 'A helpful clone of myself for everyday tasks.',
    description:
      'Helps with brainstorming, writing, and technical questions using your tone and preferences.',
    category: 'Personal',
    visibility: 'Private',
    status: 'draft',
    rating: 4.9,
    chats: '1.2k',
    tags: ['general', 'productivity', 'personal'],
  },
  {
    id: '2',
    name: 'Me (Startup Advisor)',
    tagline: 'Helps founders think through product, growth, and strategy.',
    description:
      'Specialized in early-stage startups, fundraising, and go-to-market. Great for structured strategy sessions.',
    category: 'Business',
    visibility: 'Unlisted',
    status: 'published',
    rating: 4.8,
    chats: '860',
    tags: ['startups', 'strategy', 'growth'],
  },
];

export function getUserCloneById(id) {
  return userClones.find((clone) => clone.id === id) || null;
}
