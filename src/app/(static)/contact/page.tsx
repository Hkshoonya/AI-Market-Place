"use client";

import { useState } from "react";
import {
  Bug,
  HelpCircle,
  Lightbulb,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORIES = [
  { value: "general", label: "General Inquiry", icon: HelpCircle },
  { value: "bug", label: "Report a Bug", icon: Bug },
  { value: "feature", label: "Feature Request", icon: Lightbulb },
  { value: "listing", label: "Marketplace / Listing", icon: MessageSquare },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate sending — in production this would call an API route
    // that stores in Supabase or sends via email service
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gain/10">
            <Send className="h-8 w-8 text-gain" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Message Sent!</h1>
          <p className="mt-3 text-muted-foreground max-w-md">
            Thank you for reaching out. We&apos;ll get back to you within 24-48
            hours.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setSent(false);
              setName("");
              setEmail("");
              setSubject("");
              setMessage("");
              setCategory("general");
            }}
          >
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center mb-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neon/10">
          <Mail className="h-8 w-8 text-neon" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">Contact Us</h1>
        <p className="mt-3 text-muted-foreground">
          Have a question, found a bug, or want to suggest a feature? We&apos;d
          love to hear from you.
        </p>
      </div>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Send us a message</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category selector */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      category === cat.value
                        ? "border-neon/50 bg-neon/10 text-neon"
                        : "border-border/50 hover:border-border hover:bg-secondary/50"
                    }`}
                  >
                    <cat.icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="mt-1 bg-secondary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1 bg-secondary"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your message"
                required
                className="mt-1 bg-secondary"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us more..."
                required
                rows={5}
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-2 bg-neon text-background font-semibold hover:bg-neon/90"
            >
              <Send className="h-4 w-4" />
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          You can also reach us at{" "}
          <span className="text-neon font-medium">support@aimarketcap.com</span>
        </p>
      </div>
    </div>
  );
}
