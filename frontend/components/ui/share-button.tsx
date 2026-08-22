"use client";

/**
 * Uses the native share sheet where available (mobile browsers); falls back
 * to copying the job's shareable link to the clipboard everywhere else.
 */
import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled the native share sheet — nothing more to do
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing more we can do silently
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleShare}>
      {copied ? <Check className="h-4 w-4 animate-scale-in text-emerald-600 dark:text-emerald-400" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}
