// FeaturedAgents.tsx
import { Link } from 'react-router-dom';
import { Star, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { featuredAgents } from '@/data/mockData';

function AgentCard({ agent }) {
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary">{agent.category}</Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="size-4 fill-yellow-400 text-yellow-400" />
            <span>{agent.rating}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">{agent.name}</CardTitle>
          <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex flex-wrap gap-2">
          {agent.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          <span>{agent.users.toLocaleString()} users</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/assistants/${agent.id}/chat`}>Chat</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="group">
            <Link to={`/agent/${agent.id}`} className="flex items-center gap-1">
              View
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function FeaturedAgents() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Featured Agents</h2>
            <p className="text-muted-foreground">Top-rated agents trusted by thousands of users</p>
          </div>
          <Button variant="outline" asChild className="group">
            <Link to="/browse" className="flex items-center gap-2">
              View All
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        <Carousel opts={{ align: 'start', loop: true }} className="w-full">
          <CarouselContent className="-ml-4">
            {featuredAgents.map((agent) => (
              <CarouselItem key={agent.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <AgentCard agent={agent} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="hidden md:block">
            <CarouselPrevious />
            <CarouselNext />
          </div>
        </Carousel>
      </div>
    </section>
  );
}