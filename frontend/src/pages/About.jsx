import { motion } from "framer-motion";
import { Heart, Users, Target, Lightbulb } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const values = [
    {
        icon: Heart,
        title: "Empathy First",
        description: "We believe recognizing invisible work is the first step to sharing it. Our tools make the unseen seen.",
    },
    {
        icon: Users,
        title: "Built for Collaboration",
        description: "Households run on teamwork. Every feature is designed to foster fairness and shared responsibility.",
    },
    {
        icon: Target,
        title: "Progress, Not Perfection",
        description: "Small, consistent improvements matter more than impossible standards. Our goal trackers celebrate every step.",
    },
    {
        icon: Lightbulb,
        title: "Calm by Design",
        description: "We chose calming colors, gentle animations, and clean layouts on purpose. Reducing stress, not adding to it.",
    },
];

const About = () => {
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
                            Making invisible work <span className="gradient-text">visible</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-lg text-muted-foreground max-w-2xl mx-auto"
                        >
                            Mental Load Manager was born from a simple observation: the person who remembers, plans, and follows up on household tasks often carries an invisible burden. We're here to change that.
                        </motion.p>
                    </div>
                </section>

                <section className="py-20 px-4">
                    <div className="container mx-auto max-w-4xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="font-display text-3xl font-bold text-foreground mb-4">Our Values</h2>
                            <p className="text-muted-foreground">What drives every decision we make</p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {values.map((value, index) => (
                                <motion.div
                                    key={value.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-6 rounded-xl border border-border bg-card"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-sage-light flex items-center justify-center mb-4">
                                        <value.icon className="w-6 h-6 text-sage" />
                                    </div>
                                    <h3 className="font-display text-xl font-semibold text-foreground mb-2">{value.title}</h3>
                                    <p className="text-muted-foreground">{value.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-20 px-4 bg-muted/30">
                    <div className="container mx-auto max-w-3xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center"
                        >
                            <h2 className="font-display text-3xl font-bold text-foreground mb-6">Our Story</h2>
                            <div className="text-muted-foreground space-y-4 text-left">
                                <p>
                                    It started with a conversation about who remembers to buy more toothpaste. That seemingly trivial question opened up a bigger discussion about all the things one partner "just handles" — scheduling appointments, remembering birthdays, tracking when the car needs service.
                                </p>
                                <p>
                                    We realized there was no tool that captured the full picture of household responsibility. Todo apps track tasks, but they don't track the mental work of planning, remembering, and coordinating. Calendar apps track events, but they don't show who's carrying the load of making sure everything gets done.
                                </p>
                                <p>
                                    Mental Load Manager brings it all together — tasks, analytics, goals, and collaboration — in a calming interface designed to foster balance, not blame.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default About;
