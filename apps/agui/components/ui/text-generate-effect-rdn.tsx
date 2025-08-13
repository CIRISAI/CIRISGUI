"use client";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
interface TextGenerateEffectRNDProps {
  textContent: string;
  className?: string;
}

export default function TextGenerateEffectRND({
  textContent,
  className,
}: TextGenerateEffectRNDProps) {
  const [iteration, setIteration] = useState(0);
  const letters = "abcdefghijklmnopqrstuvwxyz-.,+*!?@&%/=";
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const encrypt = (iteration: number) => {
    return textContent
      .split("")
      .map((letter, index) => {
        if (index < iteration) {
          return textContent[index];
        }
        return letters[Math.floor(Math.random() * 38)];
      })
      .join("");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let interval: NodeJS.Timeout | null = null;
    interval = setTimeout(() => {
      setIteration((prev) => prev + 5 / 6);
      interval = setInterval(() => {
        setIteration((prev) => prev + 5 / 6);
      }, 25);
    }, 125);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mounted]);

  return (
    <div className={cn("ss-01s ss-03 ss-04", className)}>
      <div className="mt-4">
        <div className=" ">{mounted ? encrypt(iteration) : textContent}</div>
      </div>
    </div>
  );
}
