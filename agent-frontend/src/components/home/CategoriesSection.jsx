// CategoriesSection.tsx
import { Link } from 'react-router-dom';
import { Headphones, BarChart3, PenTool, Code2, Search, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { categories } from '@/data/mockData';

const iconMap = { Headphones, BarChart3, PenTool, Code2, Search, Zap };

export default function CategoriesSection() {
  return (
    <section className="bg-muted/30 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Browse by Category</h2>
          <p className="max-w-xl text-muted-foreground">Find the perfect agent for your specific use case</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = iconMap[cat.icon] || Search;
            return (
              <Card
                key={cat.id}
                className="group cursor-pointer border-transparent bg-background transition-all hover:-translate-y-1 hover:border-border hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-lg">{cat.name}</CardTitle>
                      <CardDescription>{cat.count} agents</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                  <Button variant="ghost" size="sm" className="h-auto w-fit p-0 text-primary" asChild>
                    <Link to={`/browse?category=${cat.name.toLowerCase()}`} className="flex items-center gap-1">
                      Explore
                      <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}