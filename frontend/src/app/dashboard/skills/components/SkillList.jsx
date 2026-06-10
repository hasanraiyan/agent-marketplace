"use client";

import {
  Cpu,
  Globe,
  Lock,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const SkillCard = ({ skill, isOwner, onEdit, onDelete }) => (
  <Card className="group relative flex flex-col overflow-hidden rounded-xl border-none bg-card ring-1 ring-foreground/10 transition-all hover:shadow-lg hover:ring-primary/20 p-5">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Cpu className="size-5" />
        </div>
        <div>
          <h3 className="font-bold text-base truncate max-w-[150px]">
            {skill.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant={skill.isPublic ? "default" : "outline"} className="text-[10px] uppercase px-1.5 py-0">
              {skill.isPublic ? <Globe className="size-2.5 mr-1" /> : <Lock className="size-2.5 mr-1" />}
              {skill.isPublic ? "Public" : "Private"}
            </Badge>
          </div>
        </div>
      </div>

      {isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-md p-1 hover:bg-muted transition-colors">
              <MoreVertical className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(skill)}>
              <Edit className="mr-2 size-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(skill)}>
              <Trash2 className="mr-2 size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>

    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
      {skill.description}
    </p>

    <div className="flex items-center justify-between pt-3 border-t">
      <span className="text-xs text-muted-foreground">
        {skill.updatedAt ? `Updated ${new Date(skill.updatedAt).toLocaleDateString()}` : ""}
      </span>
      {!isOwner && (
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          View <ExternalLink className="ml-1 size-3" />
        </Button>
      )}
    </div>
  </Card>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-48 rounded-xl" />
    ))}
  </div>
);

export function SkillList({
  mySkills,
  publicSkills,
  loading,
  search,
  onEdit,
  onDelete,
  onCreateFirst,
}) {
  const filteredMySkills = mySkills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPublicSkills = publicSkills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Tabs defaultValue="mine" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="mine">My Skills</TabsTrigger>
        <TabsTrigger value="public">Public Marketplace</TabsTrigger>
      </TabsList>

      <TabsContent value="mine" className="mt-0">
        {loading ? (
          <SkeletonGrid />
        ) : filteredMySkills.length === 0 ? (
          <Empty className="py-20 border-2 border-dashed rounded-2xl">
            <EmptyHeader>
              <EmptyTitle>No skills found</EmptyTitle>
              <EmptyDescription>
                {search ? "No skills match your search." : "You haven't created any skills yet."}
              </EmptyDescription>
            </EmptyHeader>
            {!search && (
              <EmptyContent>
                <Button onClick={onCreateFirst}
                  className="h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                >
                  <Plus className="mr-2 size-4" />
                  Create Your First Skill
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMySkills.map((skill) => (
              <SkillCard
                key={skill._id || skill.id}
                skill={skill}
                isOwner={true}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="public" className="mt-0">
        {loading ? (
          <SkeletonGrid />
        ) : filteredPublicSkills.length === 0 ? (
          <Empty className="py-20 border-2 border-dashed rounded-2xl">
            <EmptyHeader>
              <EmptyTitle>No public skills</EmptyTitle>
              <EmptyDescription>
                The marketplace is empty right now.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPublicSkills.map((skill) => (
              <SkillCard
                key={skill._id || skill.id}
                skill={skill}
                isOwner={false}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
