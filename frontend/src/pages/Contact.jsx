import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Loader2 } from "lucide-react";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { GET_API_BASE_URL } from "@/components/ui/base_url";
import { isUserLoggedIn } from "@/lib/utils";
import { getToken} from "@/lib/auth";

const API_BASE_URL = GET_API_BASE_URL();

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSending) return;

    setIsSending(true);
    setSuccess(false);
    setError(null);

    try {
      const token = getToken();

      const headers = {
        "Content-Type": "application/json",
      };

      if (isUserLoggedIn() && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/contact/send/message`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ name, email, message }),
        }
      );

      let data = null;
      try {
        data = await response.json();
      } catch {
        // ignore if no JSON
      }

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "Something went wrong."
        );
      }

      // Success
      setSuccess(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err.message || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* HERO */}
        <section className="py-20 px-4 gradient-hero">
          <div className="container mx-auto max-w-4xl text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6"
            >
              Get in touch
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground"
            >
              We'd love to hear from you. Questions, feedback, or partnership
              ideas — all welcome.
            </motion.p>
          </div>
        </section>

        {/* FORM SECTION */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* FORM */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                  Send us a message
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      disabled={isSending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={isSending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help?"
                      rows={5}
                      required
                      disabled={isSending}
                    />
                  </div>

                  <Button type="submit" className="gap-2" disabled={isSending}>
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>

                  {/* SUCCESS MESSAGE */}
                  {success && (
                    <p className="text-green-600 font-medium pt-3">
                      ✅ Thank you! Your message has been sent.
                    </p>
                  )}

                  {/* ERROR MESSAGE */}
                  {error && (
                    <p className="text-red-600 font-medium pt-3">
                      ❌ {error}
                    </p>
                  )}
                </form>
              </motion.div>

              {/* OTHER CONTACT INFO */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                  Other ways to reach us
                </h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
                    <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center">
                      <Mail className="w-5 h-5 text-sage" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Email</h3>
                      <p className="text-sm text-muted-foreground">
                        hello@mentalloadmanager.com
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
