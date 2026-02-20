import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Heart, LayoutGrid, BarChart3, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fetchMe} from "@/lib/utils";

const features = [
    {
        icon: LayoutGrid,
        title: "Visual Task Board",
        description: "Organize responsibilities with a clear kanban-style interface",
    },
    {
        icon: BarChart3,
        title: "Balance Tracking",
        description: "See how mental load is distributed and track improvements",
    },
    {
        icon: CalendarDays,
        title: "Smart Scheduling",
        description: "Never miss a deadline with integrated calendar and reminders",
    },
];

const HeroSection = () => {
    const [me, setMe] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            const user = await fetchMe();
            if (alive) setMe(user);
        })();
        return () => { alive = false; };
    }, []);
    return (
        <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 gradient-hero overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-sage/10 blur-3xl"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 8, repeat: Infinity }}
                />
                <motion.div
                    className="absolute -bottom-40 -left-20 w-96 h-96 rounded-full bg-terracotta/10 blur-3xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 10, repeat: Infinity, delay: 1 }}
                />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto text-center">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage-light border border-sage/20 mb-8"
                >
                    <Heart className="w-4 h-4 text-sage" />
                    <span className="text-sm font-medium text-sage-dark">
                        Making invisible work visible
                    </span>
                </motion.div>

                {/* Headline */}
                {me?.username ? (
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="font-display text-2xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight"
                    >
                        Welcome back,{" "}
                        <span className="gradient-text">{me.display_name || me.username}</span>
                        <br />
                        Share the mental load
                    </motion.h1>
                ) : (
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight"
                    >
                        Share the{" "}
                        <span className="gradient-text">mental load</span>
                        <br />
                        of your household
                    </motion.h1>
                )}

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
                >
                    Beyond to-do lists — track, visualize, and balance the invisible work of
                    remembering, planning, and following up on everyday responsibilities.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
                >
                    {me?.username ? (
                        <Link to="/dashboard">
                            <Button
                                size="lg"
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 gap-2 group"
                            >
                                My Dashboard
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    ) : (
                        <Link to="/login">
                            <Button
                                size="lg"
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 gap-2 group"
                            >
                                Get Started Free
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    )}
                    <Link to="/how-it-works">
                        <Button size="lg" variant="outline" className="border-border hover:bg-muted">
                            See How It Works
                        </Button>
                    </Link>
                </motion.div>

                {/* Feature Pills */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex flex-wrap items-center justify-center gap-4"
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-widget"
                        >
                            <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center">
                                <feature.icon className="w-5 h-5 text-sage" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-medium text-foreground">{feature.title}</p>
                                <p className="text-xs text-muted-foreground">{feature.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default HeroSection;