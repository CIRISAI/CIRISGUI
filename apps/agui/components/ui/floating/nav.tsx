import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { cn } from "../../../lib/utils";
import Link from "next/link";
import Image from "next/image";
import { GithubLogoIcon } from "@phosphor-icons/react";
import LogoIcon from "./LogoIcon";

export const FloatingNav = ({
  navItems,
  className,
}: {
  navItems: {
    name: string;
    link: string;
    subtitle?: string;
    icon?: React.JSX.Element;
  }[];
  className?: string;
}) => {
  const { scrollYProgress } = useScroll();

  const [visible, setVisible] = useState(true);

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (typeof current === "number") {
      const direction = current! - scrollYProgress.getPrevious()!;

      if (scrollYProgress.get() < 0.05) {
        setVisible(true);
      } else {
        if (direction < 0) {
          setVisible(true);
        } else {
          setVisible(false);
        }
      }
    }
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{
          opacity: 1,
          y: -100,
        }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{ type: "spring" }}
        className={cn(
          "fixed inset-x-0 top-10 z-[5000] mx-auto flex max-w-fit items-center justify-center rounded-lg border-white/[0.1] bg-white/70 py-4 pr-8 pl-12 backdrop-blur-md md:space-x-16 dark:bg-black/50",
          className,
        )}
      >
        {" "}
        <Link
          href={"/"}
          className={cn(
            "relative flex items-center space-x-1 text-neutral-800 hover:text-neutral-500 dark:text-neutral-50 dark:hover:text-neutral-300",
          )}
        >
          {/* LogoIcon SVG extracted to its own component */}
          <LogoIcon />
        </Link>
        {navItems.map((navItem: any, idx: number) => (
          <Link
            key={`link=${idx}`}
            href={navItem.link}
            className={cn(
              "hover:text-brand-primary flex-column relative mx-4 block items-center space-x-1 text-sm font-normal text-neutral-700 dark:text-neutral-50 dark:hover:text-neutral-300",
            )}
          >
            {/* <span className="block sm:hidden">{navItem.icon}</span> */}
            <p className="text-[0.64rem] font-bold sm:block md:text-sm md:font-normal">
              {navItem.name}
            </p>
            <p className="text-xxs hidden font-bold uppercase sm:block">
              {navItem.subtitle}
            </p>
          </Link>
        ))}
        <Link
          href={"https://github.com/CIRISAI"}
          className={
            "text-brand-primary fill-brand-primary flex items-center space-x-1 rounded-full border-2 px-4 py-1 text-sm hover:fill-black hover:text-black dark:text-neutral-50"
          }
        >
          <GithubLogoIcon fill="current" className="mr-1" size={16} />
          <span className="text-xxs font-bold">Github</span>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
};
