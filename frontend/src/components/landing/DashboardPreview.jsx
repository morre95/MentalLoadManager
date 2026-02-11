import { motion } from "framer-motion";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import { Sparkles, Move } from "lucide-react";

const DashboardPreview = () => {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta-light border border-terracotta/20 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-terracotta" />
            <span className="text-xs font-medium text-terracotta">Interactive Preview</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Your customizable dashboard
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Arrange widgets however you like. Drag and drop to create your perfect view of household responsibilities.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Move className="w-4 h-4" />
            <span>Try dragging the widgets below</span>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative"
        >
          {/* Decorative gradient border */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-sage/20 via-transparent to-terracotta/20 opacity-60" />
          <div className="relative bg-background rounded-xl p-4 md:p-6 border border-border">
            <DashboardGrid />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardPreview;