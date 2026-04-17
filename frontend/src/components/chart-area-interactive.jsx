"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const description = "An interactive area chart";

const chartData = [
  { date: "2026-03-08", standard: 409, premium: 320 },
  { date: "2026-03-09", standard: 59, premium: 110 },
  { date: "2026-03-10", standard: 261, premium: 190 },
  { date: "2026-03-11", standard: 327, premium: 350 },
  { date: "2026-03-12", standard: 292, premium: 210 },
  { date: "2026-03-13", standard: 342, premium: 380 },
  { date: "2026-03-14", standard: 137, premium: 220 },
  { date: "2026-03-15", standard: 120, premium: 170 },
  { date: "2026-03-16", standard: 138, premium: 190 },
  { date: "2026-03-17", standard: 446, premium: 360 },
  { date: "2026-03-18", standard: 364, premium: 410 },
  { date: "2026-03-19", standard: 243, premium: 180 },
  { date: "2026-03-20", standard: 89, premium: 150 },
  { date: "2026-03-21", standard: 137, premium: 200 },
  { date: "2026-03-22", standard: 224, premium: 170 },
  { date: "2026-03-23", standard: 138, premium: 230 },
  { date: "2026-03-24", standard: 387, premium: 290 },
  { date: "2026-03-25", standard: 215, premium: 250 },
  { date: "2026-03-26", standard: 75, premium: 130 },
  { date: "2026-03-27", standard: 383, premium: 420 },
  { date: "2026-03-28", standard: 122, premium: 180 },
  { date: "2026-03-29", standard: 315, premium: 240 },
  { date: "2026-03-30", standard: 454, premium: 380 },
  { date: "2026-05-01", standard: 165, premium: 220 },
  { date: "2026-05-02", standard: 293, premium: 310 },
  { date: "2026-05-03", standard: 247, premium: 190 },
  { date: "2026-05-04", standard: 385, premium: 420 },
  { date: "2026-05-05", standard: 481, premium: 390 },
  { date: "2026-05-06", standard: 498, premium: 520 },
  { date: "2026-05-07", standard: 388, premium: 300 },
  { date: "2026-05-08", standard: 149, premium: 210 },
  { date: "2026-05-09", standard: 227, premium: 180 },
  { date: "2026-05-10", standard: 293, premium: 330 },
  { date: "2026-05-11", standard: 335, premium: 270 },
  { date: "2026-05-12", standard: 197, premium: 240 },
  { date: "2026-05-13", standard: 197, premium: 160 },
  { date: "2026-05-14", standard: 448, premium: 490 },
  { date: "2026-05-15", standard: 473, premium: 380 },
  { date: "2026-05-16", standard: 338, premium: 400 },
  { date: "2026-05-17", standard: 499, premium: 420 },
  { date: "2026-05-18", standard: 315, premium: 350 },
  { date: "2026-05-19", standard: 235, premium: 180 },
  { date: "2026-05-20", standard: 177, premium: 230 },
  { date: "2026-05-21", standard: 82, premium: 140 },
  { date: "2026-05-22", standard: 81, premium: 120 },
  { date: "2026-05-23", standard: 252, premium: 290 },
  { date: "2026-05-24", standard: 294, premium: 220 },
  { date: "2026-05-25", standard: 201, premium: 250 },
  { date: "2026-05-26", standard: 213, premium: 170 },
  { date: "2026-05-27", standard: 420, premium: 460 },
  { date: "2026-05-28", standard: 233, premium: 190 },
  { date: "2026-05-29", standard: 78, premium: 130 },
  { date: "2026-05-30", standard: 340, premium: 280 },
  { date: "2026-05-31", standard: 178, premium: 230 },
  { date: "2026-06-01", standard: 178, premium: 200 },
  { date: "2026-06-02", standard: 470, premium: 410 },
  { date: "2026-06-03", standard: 103, premium: 160 },
  { date: "2026-06-04", standard: 439, premium: 380 },
  { date: "2026-06-05", standard: 88, premium: 140 },
  { date: "2026-06-06", standard: 294, premium: 250 },
  { date: "2026-06-07", standard: 323, premium: 370 },
  { date: "2026-06-08", standard: 385, premium: 320 },
  { date: "2026-06-09", standard: 438, premium: 480 },
  { date: "2026-06-10", standard: 155, premium: 200 },
  { date: "2026-06-11", standard: 92, premium: 150 },
  { date: "2026-06-12", standard: 492, premium: 420 },
  { date: "2026-06-13", standard: 81, premium: 130 },
  { date: "2026-06-14", standard: 426, premium: 380 },
  { date: "2026-06-15", standard: 307, premium: 350 },
  { date: "2026-06-16", standard: 371, premium: 310 },
  { date: "2026-06-17", standard: 475, premium: 520 },
  { date: "2026-06-18", standard: 107, premium: 170 },
  { date: "2026-06-19", standard: 341, premium: 290 },
  { date: "2026-06-20", standard: 408, premium: 450 },
  { date: "2026-06-21", standard: 169, premium: 210 },
  { date: "2026-06-22", standard: 317, premium: 270 },
  { date: "2026-06-23", standard: 480, premium: 530 },
  { date: "2026-06-24", standard: 132, premium: 180 },
  { date: "2026-06-25", standard: 141, premium: 190 },
  { date: "2026-06-26", standard: 434, premium: 380 },
  { date: "2026-06-27", standard: 448, premium: 490 },
  { date: "2026-06-28", standard: 149, premium: 200 },
  { date: "2026-06-29", standard: 103, premium: 160 },
  { date: "2026-06-30", standard: 446, premium: 400 },
];

const chartConfig = {
  inferences: {
    label: "Inferences",
  },

  standard: {
    label: "Standard Inference",
    color: "var(--primary)",
  },

  premium: {
    label: "Premium Inference",
    color: "var(--primary)",
  },
};

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    const referenceDate = new Date("2026-06-30");
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return date >= startDate;
  });

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Inference Activity (Global)</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total for the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillStandard" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-standard)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-standard)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillPremium" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-premium)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-premium)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="premium"
              type="natural"
              fill="url(#fillPremium)"
              stroke="var(--color-premium)"
              stackId="a"
            />
            <Area
              dataKey="standard"
              type="natural"
              fill="url(#fillStandard)"
              stroke="var(--color-standard)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
