import Link from "next/link";
import { Cpu } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AgentSkillsCard({ skills }) {
  if (!skills || skills.length === 0) return null;

  return (
    <Card className="border-none ring-1 ring-foreground/10 bg-card">
      <CardHeader>
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Cpu className="size-4 text-primary" />
          Configured Skills
        </CardTitle>
        <CardDescription className="text-xs">
          Specialized capabilities and instructions attached to this agent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((skill) => (
            <Link
              key={skill._id || skill.id}
              href={`/dashboard/skills?id=${skill._id || skill.id}`}
              className="p-3.5 rounded-xl border bg-muted/10 flex flex-col gap-1.5 transition-colors hover:bg-muted/20"
            >
              <span className="text-xs font-bold text-foreground">
                {skill.name}
              </span>
              <span className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {skill.description || "No description provided."}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
