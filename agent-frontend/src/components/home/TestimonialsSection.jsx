import { Quote } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { testimonials } from '@/data/mockData';

export default function TestimonialsSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">What Our Users Say</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Trusted by developers, teams, and businesses worldwide
          </p>
        </div>

        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className="w-full max-w-4xl mx-auto"
        >
          <CarouselContent>
            {testimonials.map((t) => (
              <CarouselItem key={t.id}>
                <Card className="border-none shadow-md">
                  <CardContent className="pt-8 pb-8 px-8">
                    <Quote className="h-8 w-8 text-primary/30 mb-4" />
                    <blockquote className="text-lg md:text-xl text-foreground mb-6 leading-relaxed">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-sm text-muted-foreground">{t.role}</div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </section>
  );
}
