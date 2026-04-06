import { Search, Settings, Rocket } from 'lucide-react';
import { howItWorks } from '@/data/mockData';

const iconMap = {
  Search,
  Settings,
  Rocket,
};

export default function HowItWorks() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            How It Works
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Get started in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {howItWorks.map((item, index) => {
            const Icon = iconMap[item.icon] || Search; // ✅ fallback added

            return (
              <div key={item.step} className="relative text-center">
                {/* Line */}
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-px border-t border-dashed border-border" />
                )}

                <div className="relative z-10 flex flex-col items-center">
                  {/* Icon */}
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
                    <Icon className="h-10 w-10" />
                  </div>

                  {/* Step number */}
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold mb-4">
                    {item.step}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>

                  {/* Description */}
                  <p className="text-muted-foreground max-w-xs">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
