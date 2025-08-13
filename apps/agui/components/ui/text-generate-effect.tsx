"use client";
import { useEffect } from "react";
import { motion, stagger, useAnimate, useInView } from "framer-motion";
import { cn } from "../../lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
}: {
  words: string;
  className?: string;
}) => {
  const [scope, animate] = useAnimate();
  const isInView = useInView(scope);
  let wordsArray = words.split(" ");

  useEffect(() => {
    if (isInView) {
      animate(
        "span",
        {
          opacity: 1,
        },
        {
          duration: 0.2,
          delay: stagger(0.1),
        }
      );
    }
  }, [scope.current]);

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => {
          return (
            <motion.span
              key={word + idx}
              className=" top-0 min-w-[1em]  opacity-0"
            >
              {word}
              {"  "}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn("ss-01s ss-03 ss-04", className)}>
      <div className="mt-4">
        <div className=" ">{renderWords()}</div>
      </div>
    </div>
  );
};
