import { Link } from 'react-router-dom';
import {
  Headphones,
  BarChart3,
  PenTool,
  Code2,
  Search,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { categories } from '@/data/mockData';

const iconMap = {
  Headphones,
  BarChart3,
  PenTool,
  Code2,
  Search,
  Zap,
};

export default function CategoriesSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Browse by Category
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Find the perfect agent for your specific use case
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const Icon = iconMap[cat.icon];
            return (
              <Card
                key={cat.id}
                className="group cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{cat.name}</CardTitle>
                      <CardDescription>{cat.count} agents</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {cat.description}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto text-primary"
                    asChild
                  >
                    <Link to={`/browse?category=${cat.name.toLowerCase()}`}>
                      Explore
                      <ArrowRight className="ml-1 h-3 w-3" />
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
