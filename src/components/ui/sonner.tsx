"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      style={
        {
          "--normal-bg": "hsl(var(--background))",
          "--normal-text": "hsl(var(--foreground))",
          "--normal-border": "hsl(var(--border))",
          "--success-bg": "hsl(var(--background))",
          "--success-text": "hsl(var(--foreground))",
          "--success-border": "hsl(var(--border))",
          "--error-bg": "hsl(var(--background))",
          "--error-text": "hsl(var(--foreground))",
          "--error-border": "hsl(var(--border))",
          "--warning-bg": "hsl(var(--background))",
          "--warning-text": "hsl(var(--foreground))",
          "--warning-border": "hsl(var(--border))",
          "--info-bg": "hsl(var(--background))",
          "--info-text": "hsl(var(--foreground))",
          "--info-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
