import {
  Rocket,
  Code,
  Palette,
  Search,
  Drama,
  Sparkles,
  Lock,
  Eye,
  Globe,
} from "lucide-react";

export const CATEGORIES = [
  { value: "productivity", label: "Productivity", icon: Rocket },
  { value: "coding", label: "Coding", icon: Code },
  { value: "creative", label: "Creative", icon: Palette },
  { value: "research", label: "Research", icon: Search },
  { value: "roleplay", label: "Roleplay", icon: Drama },
  { value: "other", label: "Other", icon: Sparkles },
];

export const VISIBILITY_OPTIONS = [
  {
    value: "private",
    label: "Private",
    description: "Only you can see and use this agent",
    icon: Lock,
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the link can use it",
    icon: Eye,
  },
  {
    value: "public",
    label: "Public",
    description: "Visible on the Explore dashboard",
    icon: Globe,
  },
];
