import { motion } from "framer-motion";
import { Heart, Github, Twitter } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">M</span>
            </div>
            <div>
              <span className="font-display font-semibold text-foreground">Mental Load Manager</span>
              <p className="text-xs text-muted-foreground">Making invisible work visible</p>
            </div>
          </Link>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>

          <div className="flex items-center gap-3">
            <a href="#" className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Github className="w-4 h-4 text-muted-foreground" />
            </a>
            <a href="#" className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Twitter className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Made with</span>
          <Heart className="w-4 h-4 text-terracotta fill-terracotta" />
          <span>for balanced households</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
