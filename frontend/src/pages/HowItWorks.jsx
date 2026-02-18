import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    ListTodo,
    BarChart3,
    Users,
    Target,
    CheckCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const steps = [
    {
        icon: ListTodo,
        number: "01",
        title: "Add your tasks",
        description:
            "List out everything your household needs — from groceries to doctor appointments to remembering birthdays. Assign tasks to family members and set priorities.",
    },
    {
        icon: BarChart3,
        number: "02",
        title: "See the balance",
        description:
            "Our analytics dashboard reveals who's carrying the mental load. View task distribution, category breakdowns, and workload trends over time.",
    },
    {
        icon: Users,
        number: "03",
        title: "Share the load",
        description:
            "Use the insights to have productive conversations. Reassign tasks, set up routines, and work together toward a balanced household.",
    },
    {
        icon: Target,
        number: "04",
        title: "Track your progress",
        description:
            "Set personal and household goals with fun animated trackers. Celebrate wins together and build lasting habits.",
    },
];

const HowItWorks = () => {
    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <main>
                {/* Hero */}
                <section className="py-20 px-4 gradient-hero">
                    <div className="container mx-auto max-w-4xl text-center">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6"
                        >
                            How it works
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-lg text-muted-foreground max-w-2xl mx-auto"
                        >
                            Four simple steps to a more balanced household
                        </motion.p>
                    </div>
                </section>

                {/* Steps */}
                <section className="py-20 px-4">
                    <div className="container mx-auto max-w-3xl">
                        <div className="space-y-12">
                            {steps.map((step, index) => {
                                const Icon = step.icon;

                                return (
                                    <motion.div
                                        key={step.number}
                                        initial={{
                                            opacity: 0,
                                            x: index % 2 === 0 ? -30 : 30,
                                        }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.1 }}
                                        className="flex gap-6 items-start"
                                    >
                                        <div className="flex-shrink-0">
                                            <div className="w-14 h-14 rounded-2xl bg-sage-light flex items-center justify-center">
                                                <Icon className="w-7 h-7 text-sage" />
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-sm font-bold text-primary">
                                                {step.number}
                                            </span>
                                            <h3 className="font-display text-2xl font-semibold text-foreground mb-2">
                                                {step.title}
                                            </h3>
                                            <p className="text-muted-foreground">
                                                {step.description}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-20 px-4 bg-muted/30">
                    <div className="container mx-auto max-w-2xl text-center">
                        <CheckCircle className="w-12 h-12 text-sage mx-auto mb-4" />

                        <h2 className="font-display text-3xl font-bold text-foreground mb-4">
                            Ready to find balance?
                        </h2>

                        <p className="text-muted-foreground mb-8">
                            It takes less than a minute to get started.
                        </p>

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

export default HowItWorks;
