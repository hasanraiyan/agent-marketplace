import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckIcon, SparklesIcon, ArrowRightIcon, XIcon } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "forever",
    description: "Perfect for exploring AI agents and personal projects.",
    features: [
      { text: "3 active agents", included: true },
      { text: "500 tasks/month", included: true },
      { text: "Community support", included: true },
      { text: "Basic analytics", included: true },
      { text: "Custom workflows", included: false },
      { text: "Team collaboration", included: false },
    ],
    cta: "Get Started Free",
    variant: "outline",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For professionals and teams who need more power.",
    features: [
      { text: "25 active agents", included: true },
      { text: "10,000 tasks/month", included: true },
      { text: "Priority support", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Custom workflows", included: true },
      { text: "Team collaboration", included: true },
    ],
    cta: "Start Pro Trial",
    variant: "default",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "For organizations with advanced security and scale needs.",
    features: [
      { text: "Unlimited agents", included: true },
      { text: "Unlimited tasks", included: true },
      { text: "Dedicated support", included: true },
      { text: "Custom analytics", included: true },
      { text: "SSO & SAML", included: true },
      { text: "Custom SLA", included: true },
    ],
    cta: "Contact Sales",
    variant: "outline",
    highlight: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-20" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 flex flex-col items-center text-center">
          <Badge
            variant="outline"
            className="mb-4 gap-1.5 border-primary/25 bg-primary/5 px-3 py-1 text-primary"
          >
            <SparklesIcon data-icon="inline-start" />
            Pricing
          </Badge>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Simple, Transparent <span className="gradient-text">Pricing</span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Start free, scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="stagger-children mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${
                plan.highlight
                  ? "border-primary/50 shadow-lg shadow-primary/10 hover:shadow-primary/15"
                  : "hover:border-border/60 hover:shadow-primary/5"
              }`}
            >
              {plan.highlight && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}

              <CardHeader className="text-center">
                {plan.highlight && (
                  <Badge className="mx-auto mb-2 bg-primary/15 text-primary">
                    Most Popular
                  </Badge>
                )}
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-3">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="ml-1 text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>
                <CardDescription className="mt-2">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <Separator className="mx-4 bg-border/30" />

              <CardContent className="flex-1 pt-6">
                <ul className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.text}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      {feature.included ? (
                        <div className="flex size-5 items-center justify-center rounded-full bg-primary/15">
                          <CheckIcon className="size-3 text-primary" />
                        </div>
                      ) : (
                        <div className="flex size-5 items-center justify-center rounded-full bg-muted">
                          <XIcon className="size-3 text-muted-foreground/40" />
                        </div>
                      )}
                      <span
                        className={
                          feature.included ? "" : "text-muted-foreground/50"
                        }
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="border-t-0 bg-transparent p-4">
                <Button
                  variant={plan.variant}
                  className={`w-full gap-2 ${plan.highlight ? "glow-primary" : ""}`}
                >
                  {plan.cta}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
