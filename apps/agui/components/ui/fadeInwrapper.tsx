"use client";
import { useEffect } from "react";
import { motion, stagger, useAnimate, useInView } from "framer-motion";
interface FadeInwrapperProps {
  delay: number;
  children: React.ReactNode;
}
function FadeInwrapper({ delay, children }: FadeInwrapperProps) {
  const [scope, animate] = useAnimate();
  const isInView = useInView(scope);

  useEffect(() => {
    if (isInView) {
      animate(
        "div",
        {
          opacity: 1,
          top: 0,
          scale: 1,
        },
        {
          type: "spring",
          stiffness: 250,
          damping: 80,
          delay: delay,
        }
      );
    }
  }, [isInView]);
  return (
    <motion.div
      className="transform-origin-top-left  inline-block w-full"
      ref={scope}
    >
      {children}
    </motion.div>
  );
}

export default FadeInwrapper;
