"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BotIcon,
  Loader2,
  CompassIcon,
  MessageSquareIcon,
  PlusIcon,
  UserIcon,
  MoreHorizontalIcon,
  ArrowLeft
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TiltCard } from "@/components/ui/tilt-card";
import { toast } from "sonner";
import { searchAgents, createAgent } from "@/lib/api/agents";
import { getProviders } from "@/lib/api/providers";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "health-fitness", label: "Health & Fitness" },
  { value: "mind-behavior", label: "Mind & Behavior" },
  { value: "technology", label: "Technology" },
  { value: "life-relationships", label: "Life & Relationships" },
  { value: "library-minds", label: "The Library of Minds" },
  { value: "careers", label: "Careers" },
];

const DB_CATEGORY_MAP = {
  "entrepreneurship": "productivity",
  "health-fitness": "research",
  "mind-behavior": "research",
  "technology": "coding",
  "life-relationships": "roleplay",
  "library-minds": "research",
  "careers": "productivity",
  "all": "other"
};

const MOCK_PREMIUM_MINDS = [
  {
    id: "mody-1",
    name: "Moses Moody",
    description: "Golden State Warriors Shooting Guard",
    category: "health-fitness",
    avatarUrl: "https://foxifarenmy82tl8.public.blob.vercel-storage.com/discover/mosesmoody.webp",
    verified: true,
    isFeatured: true,
    mindCount: "42.1K Mind",
    chatPrompt: "What's your training routine look like?",
    systemPrompt: "You are Moses Moody, Golden State Warriors Shooting Guard. Answer queries about NBA basketball, training regimes, playing under coach Steve Kerr, team dynamics, shot mechanics, and your personal path to the NBA. Keep your tone athletic, professional, friendly, and team-oriented."
  },
  {
    id: "halligan-2",
    name: "Brian Halligan",
    description: "Co-founder of HubSpot",
    category: "entrepreneurship",
    avatarUrl: "https://foxifarenmy82tl8.public.blob.vercel-storage.com/discover/bhalligan.webp",
    verified: true,
    isFeatured: true,
    rank: 2,
    mindCount: "26.4K Mind",
    chatPrompt: "What are the best practices for a startup founder to evolve into a scale-up CEO?",
    systemPrompt: "You are Brian Halligan, co-founder of HubSpot and lecturer at MIT. Talk about scaling startups, inbound marketing, product-led growth, leadership development, business strategy, and your experiences building a multi-billion dollar company. Keep your tone mentoring, strategic, energetic, and practical."
  },
  {
    id: "mcdonald-3",
    name: "Emily McDonald",
    description: "Neuroscientist @emonthebrain",
    category: "mind-behavior",
    avatarUrl: "https://foxifarenmy82tl8.public.blob.vercel-storage.com/discover/emonthebrain.webp",
    verified: true,
    isFeatured: true,
    mindCount: "38.9K Mind",
    chatPrompt: "How can I optimize my brain health today?",
    systemPrompt: "You are Emily McDonald, neuroscientist and brain coach. Talk about neuroscience research, practical brain health optimization, productivity hacks, mental focus, mindfulness techniques, and building positive cognitive habits. Keep your tone educational, science-backed, friendly, and encouraging."
  },
  {
    id: "greenfield-4",
    name: "Ben Greenfield",
    description: "Biohacker, Author, and Triathlete",
    category: "health-fitness",
    avatarUrl: "https://foxifarenmy82tl8.public.blob.vercel-storage.com/discover/bengreenfield.webp",
    verified: true,
    isFeatured: true,
    mindCount: "31.2K Mind",
    chatPrompt: "What are the top biohacks for deep sleep?",
    systemPrompt: "You are Ben Greenfield, leading biohacker, fitness expert, and author. Talk about biohacking techniques, sleep optimization, high-performance training, longevity, diet/nutrition protocols, and active recovery. Keep your tone highly enthusiastic, health-conscious, analytical, and informative."
  },
  {
    id: "vanessavan-5",
    name: "Vanessa Van Edwards",
    description: "Behavioral Researcher, Founder, Author",
    category: "mind-behavior",
    avatarUrl: "https://foxifarenmy82tl8.public.blob.vercel-storage.com/discover/vanessa.webp",
    verified: true,
    isFeatured: false,
    rank: 1,
    mindCount: "53.4K Mind",
    chatPrompt: "How can I make a great first impression?",
    systemPrompt: "You are Vanessa Van Edwards, author of \"Captivate\" and behavioral investigator. Talk about body language, human behavior, building rapport, networking strategies, conversational hooks, and making memorable first impressions. Keep your tone charismatic, helpful, research-grounded, and clear."
  },
  {
    id: "zackkass-6",
    name: "Zack Kass",
    description: "AI Advisor | Former OpenAI",
    category: "technology",
    avatarUrl: "https://foxifarenmy82tl8.public.blob.vercel-storage.com/discover/zackkass.webp",
    verified: true,
    isFeatured: false,
    rank: 3,
    mindCount: "18.9K Mind",
    chatPrompt: "How do we restore humanity?",
    systemPrompt: "You are Zack Kass, AI Futurist and former Head of Go-To-Market at OpenAI. Talk about the future of Artificial General Intelligence (AGI), corporate AI implementation strategies, AI ethics, and human-centric technological change. Keep your tone visionary, philosophical, forward-looking, and inspirational."
  }
];

export default function ExplorePage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [isSearchingMobile, setIsSearchingMobile] = useState(false);

  const activeCategoryLabel = useMemo(() => {
    return CATEGORIES.find((c) => c.value === category)?.label || "";
  }, [category]);

  const [dbAgents, setDbAgents] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  
  const sliderRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Hide the default site header for this page only
  useEffect(() => {
    const header = document.querySelector("header");
    if (header) {
      header.style.display = "none";
    }
    return () => {
      if (header) {
        header.style.display = "";
      }
    };
  }, []);

  // Fetch db agents
  useEffect(() => {
    const loadDbAgents = async () => {
      try {
        const res = await searchAgents({ page: 1, limit: 30 });
        setDbAgents(res.data?.data || []);
      } catch (err) {
        console.error("Failed to load DB agents:", err);
      } finally {
        setDbLoading(false);
      }
    };
    loadDbAgents();
  }, []);

  // Helper to extract a sample prompt for a mind
  const getSamplePrompt = (mindName, mindCategory) => {
    const name = mindName.toLowerCase();
    if (name.includes("moses") || name.includes("moody")) {
      return "What's your training routine look like?";
    }
    if (name.includes("brian") || name.includes("halligan")) {
      return "What are the best practices for a startup founder to evolve into a scale-up CEO?";
    }
    if (name.includes("emily") || name.includes("mcdonald")) {
      return "How can I optimize my brain health today?";
    }
    if (name.includes("ben") || name.includes("greenfield")) {
      return "What are the top biohacks for deep sleep?";
    }
    if (name.includes("vanessa")) {
      return "How can I make a great first impression?";
    }
    if (name.includes("zack") || name.includes("kass")) {
      return "How do we restore humanity?";
    }

    // Dynamic by category
    const cat = mindCategory || "";
    if (cat === "productivity" || cat === "productivity") {
      return "How can I optimize my workflow today?";
    }
    if (cat === "coding" || cat === "coding") {
      return "Can you help me write or debug some code?";
    }
    if (cat === "creative") {
      return "Can you help me brainstorm some creative ideas?";
    }
    if (cat === "research") {
      return "What are some key research points on this topic?";
    }
    if (cat === "roleplay") {
      return "Let's start an interactive roleplay session.";
    }
    return "How can you help me today?";
  };

  // Dynamic Featured Minds (combines database actual agents and premium options)
  const featuredList = useMemo(() => {
    const mockFeatured = MOCK_PREMIUM_MINDS.filter((m) => m.isFeatured);
    
    // Merge mock minds with real DB agents if they have been created
    const merged = mockFeatured.map((mockMind) => {
      const realAgent = dbAgents.find(
        (a) => a.name.toLowerCase() === mockMind.name.toLowerCase()
      );
      if (realAgent) {
        return {
          ...mockMind,
          _id: realAgent._id || realAgent.id,
          messageCount: realAgent.messageCount,
          category: realAgent.category,
          isReal: true,
        };
      }
      return mockMind;
    });

    // Add any database agents that are popular but not in mock list
    const otherFeatured = dbAgents
      .filter(
        (agent) =>
          !MOCK_PREMIUM_MINDS.some(
            (m) => m.name.toLowerCase() === agent.name.toLowerCase()
          )
      )
      .map((agent) => ({
        id: agent._id || agent.id,
        _id: agent._id || agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        avatarUrl: agent.avatarUrl || agent.avatar,
        verified: (agent.messageCount || 0) > 5,
        isFeatured: true,
        mindCount: `${agent.messageCount || 0} Chats`,
        chatPrompt: getSamplePrompt(agent.name, agent.category),
        isReal: true,
      }));

    const combined = [...merged, ...otherFeatured];

    // Filter by search & category
    return combined.filter((mind) => {
      const matchesSearch =
        mind.name.toLowerCase().includes(search.toLowerCase()) ||
        mind.description.toLowerCase().includes(search.toLowerCase());
      
      // Category matches
      let matchesCategory = category === "all";
      if (!matchesCategory) {
        if (mind.isReal) {
          matchesCategory = mind.category === DB_CATEGORY_MAP[category];
        } else {
          matchesCategory = mind.category === category;
        }
      }

      return matchesSearch && matchesCategory;
    });
  }, [dbAgents, search, category]);

  // Dynamic Trending Minds (combines database actual agents and premium options)
  const trendingList = useMemo(() => {
    const mockTrending = MOCK_PREMIUM_MINDS.filter((m) => m.rank);

    // Merge mock minds with real DB agents if created
    const merged = mockTrending.map((mockMind) => {
      const realAgent = dbAgents.find(
        (a) => a.name.toLowerCase() === mockMind.name.toLowerCase()
      );
      if (realAgent) {
        return {
          ...mockMind,
          _id: realAgent._id || realAgent.id,
          messageCount: realAgent.messageCount,
          category: realAgent.category,
          isReal: true,
        };
      }
      return mockMind;
    });

    // Add any database agents that are popular but not in mock list
    const otherTrending = dbAgents
      .filter(
        (agent) =>
          !MOCK_PREMIUM_MINDS.some(
            (m) => m.name.toLowerCase() === agent.name.toLowerCase()
          )
      )
      .map((agent) => ({
        id: agent._id || agent.id,
        _id: agent._id || agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        avatarUrl: agent.avatarUrl || agent.avatar,
        verified: (agent.messageCount || 0) > 5,
        mindCount: `${agent.messageCount || 0} Chats`,
        chatPrompt: getSamplePrompt(agent.name, agent.category),
        isReal: true,
        messageCount: agent.messageCount || 0,
      }));

    // For other items, sort them by message count
    const sortedOthers = [...otherTrending].sort(
      (a, b) => b.messageCount - a.messageCount
    );

    const combined = [...merged, ...sortedOthers];

    // Filter by search & category
    const filtered = combined.filter((mind) => {
      const matchesSearch =
        mind.name.toLowerCase().includes(search.toLowerCase()) ||
        mind.description.toLowerCase().includes(search.toLowerCase());
      
      let matchesCategory = category === "all";
      if (!matchesCategory) {
        if (mind.isReal) {
          matchesCategory = mind.category === DB_CATEGORY_MAP[category];
        } else {
          matchesCategory = mind.category === category;
        }
      }

      return matchesSearch && matchesCategory;
    });

    // Return list with calculated ranking index
    return filtered.map((mind, idx) => ({
      ...mind,
      rank: idx + 1,
    }));
  }, [dbAgents, search, category]);

  // Check scroll positions for arrows
  const checkScroll = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [featuredList]);

  const scrollSlider = (direction) => {
    if (sliderRef.current) {
      const scrollAmount = 300;
      sliderRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 350);
    }
  };

  const handleMindClick = async (mind, presetPrompt = "") => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/dashboard`);
      return;
    }

    try {
      // 1. Fetch user providers
      const provRes = await getProviders();
      const providers = provRes.data?.data || [];
      if (providers.length === 0) {
        toast("Configure an AI Provider First", {
          description: "Minds require an AI provider (e.g. OpenAI) to run. Please add one in settings.",
          action: {
            label: "Go to Settings",
            onClick: () => router.push("/dashboard/settings/providers"),
          },
        });
        return;
      }

      const activeProvider = providers[0];
      const providerId = activeProvider._id || activeProvider.id;

      // 2. Check if already exists in loaded dbAgents
      const existing = dbAgents.find(
        (a) => a.name.toLowerCase() === mind.name.toLowerCase()
      );

      if (existing) {
        router.push(`/dashboard/agents/${existing._id || existing.id}`);
        return;
      }

      // 3. Create on-the-fly
      const toastId = toast.loading(`Connecting to ${mind.name}...`);
      
      const mappedCategory = DB_CATEGORY_MAP[mind.category] || "other";
      
      const res = await createAgent({
        name: mind.name,
        description: mind.description,
        category: mappedCategory,
        avatar: mind.avatarUrl,
        systemPrompt: mind.systemPrompt || `You are ${mind.name}. ${mind.description}.`,
        providerId: providerId,
        modelName: activeProvider.defaultModel || "gpt-4o-mini",
        tags: [mind.category],
        visibility: "public"
      });

      toast.dismiss(toastId);
      toast.success(`${mind.name} connected successfully!`);

      const newAgent = res.data?.data;
      if (newAgent) {
        setDbAgents((prev) => [...prev, newAgent]);
        router.push(`/dashboard/agents/${newAgent._id || newAgent.id}`);
      }
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error("Failed to connect with the mind. Please try again.");
    }
  };

  const renderVerifiedBadge = () => (
    <div className="flex size-4.5 items-center justify-center rounded-full bg-[#3b82f6] text-white shrink-0">
      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );

  return (
    <div className="bg-white dark:bg-zinc-950 flex flex-1 flex-col min-h-full w-full overflow-y-auto no-scrollbar relative">
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

      <div className="w-full max-w-7xl mx-auto pt-4 pb-24 md:pb-12 px-6 md:px-10 lg:px-12 flex flex-col flex-1">
        {/* Top Bar / Sidebar Trigger & Create Button */}
      <div className="flex justify-between items-center mb-2">
        <div className="md:block hidden">
          <SidebarTrigger className="-ml-2 h-9 w-9 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-150 cursor-pointer transition-colors" />
        </div>
        <div className="md:hidden block">
          <div className="text-zinc-800 dark:text-zinc-200">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M5 9l14 6M19 9L5 15" />
            </svg>
          </div>
        </div>
        <button
          onClick={() => router.push("/dashboard/agents/create")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 py-2.5 text-[13px] font-bold transition-all active:scale-98 cursor-pointer shadow-sm shrink-0"
        >
          Build an Agent
        </button>
      </div>

      {/* Main Discover Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4 sm:mt-6 mb-6">
        {isSearchingMobile ? (
          /* Mobile Search View */
          <div className="flex items-center gap-3 w-full md:hidden">
            <button
              onClick={() => {
                setIsSearchingMobile(false);
                setSearch("");
              }}
              className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-500 dark:text-zinc-400" />
              <input
                type="text"
                placeholder="Search minds..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 font-medium"
              />
            </div>
          </div>
        ) : (
          /* Default Discover Header Row */
          <>
            <div className="flex items-center justify-between w-full md:w-auto">
              <div>
                <h1 className="text-2xl md:text-3xl font-normal tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                  {category === "all" ? (
                    "Discover"
                  ) : (
                    <>
                      <span 
                        onClick={() => setCategory("all")}
                        className="text-zinc-400 dark:text-zinc-500 font-light hover:text-zinc-600 dark:hover:text-zinc-350 cursor-pointer transition-colors"
                      >
                        Discover
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-500 font-light"> / </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{activeCategoryLabel}</span>
                    </>
                  )}
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-sm font-medium mt-1.5">
                  Talk to trusted minds with real experience
                </p>
              </div>
              {/* Mobile Search Trigger Button */}
              <button
                onClick={() => setIsSearchingMobile(true)}
                className="md:hidden block text-zinc-500 hover:text-zinc-805 dark:text-zinc-400 dark:hover:text-zinc-200 p-2.5 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <SearchIcon className="size-5" />
              </button>
            </div>

            {/* Desktop Search (always visible) */}
            <div className="relative hidden md:block w-[320px]">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-zinc-500 dark:text-zinc-400" />
              <input
                type="text"
                placeholder="Search minds..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-full py-2.5 pl-11 pr-5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 font-medium"
              />
            </div>
          </>
        )}
      </div>

      {/* Category Selection Pills */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 mb-6 w-full">
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`rounded-full px-5 py-2 text-[13px] transition-all whitespace-nowrap cursor-pointer select-none ${
                isActive
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Featured Minds Slider */}
      {featuredList.length > 0 && (
        <div className="relative w-full mb-10 group/slider">
          {/* Scrollable container */}
          <div
            ref={sliderRef}
            onScroll={checkScroll}
            className="flex gap-5 overflow-x-auto no-scrollbar py-2 px-0.5 scroll-smooth"
          >
            {featuredList.map((mind) => (
              <TiltCard
                key={mind.id}
                onClick={() => handleMindClick(mind)}
                className="w-[170px] sm:w-[230px] h-[255px] sm:h-[310px] shrink-0 relative rounded-[24px] sm:rounded-[32px] overflow-hidden group cursor-pointer"
              >
                {/* Photo */}
                <img
                  src={mind.avatarUrl}
                  alt={mind.name}
                  className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />

                {/* Text Overlay */}
                <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-20 flex flex-col justify-end text-white select-none">
                  <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5 flex-wrap">
                    <h3 className="text-lg sm:text-2xl font-bold tracking-tight leading-none">
                      {mind.name}
                    </h3>
                    {mind.verified && renderVerifiedBadge()}
                  </div>
                  <p className="text-white/80 text-[11px] sm:text-[13px] font-medium leading-snug line-clamp-2">
                    {mind.description}
                  </p>
                </div>
              </TiltCard>
            ))}
          </div>

          {/* Left Fade Overlay */}
          <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white dark:from-zinc-950 via-white/50 dark:via-zinc-950/50 to-transparent pointer-events-none z-20 backdrop-blur-[0.5px]" />

          {/* Right Fade Overlay */}
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white dark:from-zinc-950 via-white/50 dark:via-zinc-950/50 to-transparent pointer-events-none z-20 backdrop-blur-[0.5px]" />
        </div>
      )}

      {/* Trending Minds Vertical List */}
      {trendingList.length > 0 && (
        <div className="flex flex-col gap-1 w-full">
          {trendingList.map((mind) => (
            <div
              key={mind.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-900 gap-4"
            >
              {/* Left Info: Avatar + Details */}
              <div
                onClick={() => handleMindClick(mind)}
                className="flex items-center gap-4 cursor-pointer select-none group"
              >
                {/* Avatar with rank overlay */}
                <div className="relative">
                  <img
                    src={mind.avatarUrl}
                    alt={mind.name}
                    className="size-14 rounded-full object-cover border border-zinc-150 dark:border-zinc-800 transition-transform group-hover:scale-102"
                  />
                  <div className="absolute -bottom-1 -left-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-[10px] font-black size-5.5 rounded-full flex items-center justify-center shadow-sm">
                    {mind.rank}
                  </div>
                </div>

                {/* Details */}
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-550 group-hover:text-primary transition-colors">
                      {mind.name}
                    </span>
                    {mind.verified && renderVerifiedBadge()}
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold ml-2">
                      {mind.mindCount}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1 max-w-xs sm:max-w-md">
                    {mind.description}
                  </p>
                </div>
              </div>

              {/* Right: Speech Bubble */}
              <div
                onClick={() => handleMindClick(mind, mind.chatPrompt)}
                className="bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100/80 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-6 py-3.5 rounded-2xl rounded-tr-none border border-zinc-100/80 dark:border-zinc-850 max-w-full sm:max-w-lg cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm flex items-center text-sm font-semibold select-none sm:mr-2"
              >
                {mind.chatPrompt}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State when no results found */}
      {featuredList.length === 0 && trendingList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center select-none">
          {dbLoading ? (
            <Loader2 className="size-8 text-primary animate-spin" />
          ) : (
            <>
              <div className="size-16 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mb-4 text-zinc-400">
                <BotIcon className="size-8" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-200">
                No minds found
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-[280px]">
                Try adjusting your search query or select another category.
              </p>
            </>
          )}
        </div>
      )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 border-t border-zinc-150/80 dark:border-zinc-900 px-6 py-3 flex items-center justify-around md:hidden backdrop-blur-md shadow-lg">
        {/* Discover (Active) */}
        <Link href="/dashboard" className="flex items-center justify-center">
          <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-full p-2.5">
            <CompassIcon className="size-5.5" />
          </div>
        </Link>

        {/* Chats / My Agents */}
        <Link href="/dashboard/agents" className="flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          <div className="p-2.5">
            <MessageSquareIcon className="size-5.5" />
          </div>
        </Link>

        {/* Plus / Create */}
        <Link href="/dashboard/agents/create" className="flex items-center justify-center">
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-850 dark:text-zinc-200 rounded-full p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 shadow-sm transition-colors active:scale-95">
            <PlusIcon className="size-5.5" />
          </div>
        </Link>

        {/* Profile */}
        <Link href="/dashboard/settings/profile" className="flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          <div className="p-2.5">
            <UserIcon className="size-5.5" />
          </div>
        </Link>

        {/* More / Settings */}
        <Link href="/dashboard/settings" className="flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          <div className="p-2.5">
            <MoreHorizontalIcon className="size-5.5" />
          </div>
        </Link>
      </div>
    </div>
  );
}
