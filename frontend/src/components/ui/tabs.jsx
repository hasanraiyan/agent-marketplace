"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({ className, orientation = "horizontal", ...props }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none data-[variant=pill]:h-auto data-[variant=pill]:flex-wrap data-[variant=pill]:rounded-full data-[variant=pill]:p-0",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        // Rounded, individually-filled pill tabs (active = solid brand
        // color, inactive = muted chips) — e.g. a Discover-style filter
        // bar, not a boxed segmented control.
        pill: "gap-2 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({ className, variant = "default", ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        "group-data-[variant=pill]/tabs-list:h-9 group-data-[variant=pill]/tabs-list:flex-none group-data-[variant=pill]/tabs-list:cursor-pointer group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:border-0 group-data-[variant=pill]/tabs-list:bg-slate-100/70 group-data-[variant=pill]/tabs-list:px-4 group-data-[variant=pill]/tabs-list:py-0 group-data-[variant=pill]/tabs-list:font-semibold group-data-[variant=pill]/tabs-list:text-slate-650 group-data-[variant=pill]/tabs-list:transition-all group-data-[variant=pill]/tabs-list:duration-200 group-data-[variant=pill]/tabs-list:after:hidden group-data-[variant=pill]/tabs-list:hover:bg-slate-200/70 group-data-[variant=pill]/tabs-list:hover:text-slate-950 group-data-[variant=pill]/tabs-list:data-active:!bg-[#1E60FF] group-data-[variant=pill]/tabs-list:data-active:!text-white group-data-[variant=pill]/tabs-list:data-active:shadow-md group-data-[variant=pill]/tabs-list:data-active:shadow-[#1E60FF]/15 group-data-[variant=pill]/tabs-list:data-active:hover:!bg-[#154ed0] group-data-[variant=pill]/tabs-list:disabled:cursor-not-allowed dark:group-data-[variant=pill]/tabs-list:bg-slate-800/30 dark:group-data-[variant=pill]/tabs-list:text-slate-400 dark:group-data-[variant=pill]/tabs-list:hover:bg-slate-800/60 dark:group-data-[variant=pill]/tabs-list:hover:text-slate-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
