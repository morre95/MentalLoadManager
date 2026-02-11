import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const plans = [
    {
        name: "Free",
        price: "$0",
        period: "forever",
        description: "Perfect for getting started",
        features: [
            "Up to 2 household members",
            "Basic task management",
            "Monthly calendar view",
            "3 goal trackers",
            "Basic analytics",
        ],
        cta: "Get Started",
        popular: false,
    },
    {
        name: "Pro",
        price: "$9",
        period: "/month",
        description: "For households that want more",
        features: [
            "Up to 4 household members",
            "Unlimited tasks & categories",
            "Weekly + monthly calendar",
            "All 10+ goal templates",
            "Advanced analytics & insights",
            "Google Calendar sync",
            "Achievement system",
            "Priority support",
        ],
        cta: "Start Free Trial",
        popular: true,
    },
    {
        name: "Family",
        price: "$15",
        period: "/month",
        description: "For extended families & teams",
        features: [
            "Unlimited household members",
            "Everything in Pro",
            "Multiple households",
            "Custom roles & permissions",
            "Data export & backups",
            "API access",
            "Dedicated support",
            "Early access to features",
        ],
        cta: "Start Free Trial",
        popular: false,
    },
];

const Pricing = () => {
    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main>
                <section className="py-20 px-4 gradient-hero">
                    <div className="container mx-auto max-w-4xl text-center">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6"
                        >
                            Simple, transparent pricing
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-lg text-muted-foreground"
                        >
                            Start free, upgrade when you need more
                        </motion.p>
                    </div>
                </section>

                <section className="py-20 px-4 -mt-8">
                    <div className="container mx-auto max-w-5xl">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {plans.map((plan, index) => (
                                <motion.div
                                    key={plan.name}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card className={`h-full relative ${plan.popular ? "border-primary shadow-lg scale-105" : "border-border"}`}>
                                        {plan.popular && (
                                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                                                Most Popular
                                            </Badge>
                                        )}
                                        <CardHeader className="text-center pb-2">
                                            <CardTitle className="font-display text-xl">{plan.name}</CardTitle>
                                            <div className="mt-4">
                                                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                                                <span className="text-muted-foreground">{plan.period}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <ul className="space-y-3">
                                                {plan.features.map((feature) => (
                                                    <li key={feature} className="flex items-start gap-3">
                                                        <Check className="h-4 w-4 text-sage mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-foreground">{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <Link to="/login">
                                                <Button
                                                    className="w-full mt-4"
                                                    variant={plan.popular ? "default" : "outline"}
                                                >
                                                    {plan.cta} <ArrowRight className="w-4 h-4 ml-2" />
                                                </Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default Pricing;
