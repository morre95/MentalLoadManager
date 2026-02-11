import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, LayoutGrid, BarChart3, CalendarDays, Target, Users, Shield, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const features = [
    {
        icon: LayoutGrid,
        title: "Kanban Task Board",
        description: "Organize household responsibilities with drag-and-drop columns. See what's to do, in progress, and done at a glance.",
        color: "bg-sage-light text-sage",
    },
    {
        icon: BarChart3,
        title: "Mental Load Analytics",
        description: "Visualize how tasks are distributed. Track balance over time with charts that reveal the invisible work.",
        color: "bg-terracotta-light text-terracotta",
    },
    {
        icon: CalendarDays,
        title: "Smart Calendar",
        description: "Monthly and weekly views with Google Calendar integration. Never miss a deadline or appointment.",
        color: "bg-sky-light text-sky",
    },
    {
        icon: Target,
        title: "Interactive Goal Tracking",
        description: "10+ animated visual templates — filling jars, growing plants, launching rockets. Make progress tangible and fun.",
        color: "bg-lavender-light text-lavender",
    },
    {
        icon: Users,
        title: "Household Collaboration",
        description: "Invite family members, assign tasks fairly, and see everyone's contribution in real time.",
        color: "bg-sage-light text-sage",
    },
    {
        icon: Shield,
        title: "Achievement System",
        description: "Earn badges for consistency, fairness, and completing challenges. Gamify household harmony.",
        color: "bg-terracotta-light text-terracotta",
    },
    {
        icon: Sparkles,
        title: "Customizable Dashboard",
        description: "Drag-and-drop widgets to build your perfect command center. Rearrange anything, anytime.",
        color: "bg-sky-light text-sky",
    },
    {
        icon: Zap,
        title: "Custom Categories",
        description: "Create your own task categories to match how your household works. Full flexibility.",
        color: "bg-lavender-light text-lavender",
    },
];

const Features = () => {
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
                            Everything you need to{" "}
                            <span className="gradient-text">balance your household</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-lg text-muted-foreground max-w-2xl mx-auto"
                        >
                            Powerful tools wrapped in a calming, intuitive interface designed to reduce stress, not add to it.
                        </motion.p>
                    </div>
                </section>

                <section className="py-20 px-4">
                    <div className="container mx-auto max-w-6xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {features.map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05 }}
                                    className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
                                >
                                    <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                                        <feature.icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-display text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                                    <p className="text-muted-foreground">{feature.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-20 px-4 bg-muted/30">
                    <div className="container mx-auto max-w-2xl text-center">
                        <h2 className="font-display text-3xl font-bold text-foreground mb-4">Ready to get started?</h2>
                        <p className="text-muted-foreground mb-8">Join households that have found their balance.</p>
                        <Link to="/login">
                            <Button size="lg" className="gap-2">
                                Get Started Free <ArrowRight className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default Features;
