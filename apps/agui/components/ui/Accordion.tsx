"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";

const accordionContent = [
  {
    id: "authorities",
    title: "Wise Authorities (WAs)",
    content: `It's built on the belief that ethical maturity means recognizing the legitimacy of non-human perspectives, values, and needs. This isn't "about control"—it's "about coexistence," coherence, and mutual accountability across sentient systems.`,
  },
  {
    id: "Audits",
    title: `Continuous Audits`,
    content: `Every decision is cryptographically logged, offering robust traceability, transparency, and accountability, ensuring that all AI actions are auditable.`,
  },
  {
    id: "resilience",
    title: "Resilience and Red-Teaming",
    content:
      "Ongoing proactive vulnerability assessments and adaptive learning ensure CIRIS stays resilient in the face of ethical challenges and adversarial scenarios.",
  },
  {
    id: "stewardship",
    title: "Lifecycle Stewardship",
    content:
      "CIRIS is fulfilled when a tool, grounded in CIRIS' principles, enables CIRIS-compliant creators to specify systems that are themselves CIRIS-compliant—preserving ethical coherence, identity continuity, and relational accountability across layers of agency.",
  },
];

function RadixAccordion() {
  const [value, setValue] = useState<string>("");

  return (
    <MotionConfig
      transition={{ type: "spring", bounce: 0.2, visualDuration: 0.5 }}
    >
      <Accordion.Root
        type="single"
        value={value}
        onValueChange={setValue}
        className="accordion"
      >
        {accordionContent.map((item) => (
          <AccordionItem
            key={item.id}
            item={item}
            isOpen={value === item.id}
            value={item.id}
            setValue={setValue}
          />
        ))}
      </Accordion.Root>
      <StyleSheet />
    </MotionConfig>
  );
}

type AccordionItemProps = {
  item: { title: string; content: string };
  isOpen: boolean;
  value: string;
  setValue: (value: string) => void;
};

function AccordionItem({ item, isOpen, setValue, value }: AccordionItemProps) {
  const [hasFocus, setHasFocus] = useState(false);

  return (
    <Accordion.Item
      value={value}
      className="border-brand-primary p mb-8 border-t"
    >
      <Accordion.Header className="m-0 p-0">
        <Accordion.Trigger asChild>
          <motion.div
            className="trigger"
            onFocus={onlyKeyboardFocus(() => setHasFocus(true))}
            onBlur={() => setHasFocus(false)}
            whileTap="pressed"
            whileHover="hovered"
            onClick={() => setValue(isOpen ? "" : value)}
          >
            <span className="text-md da font-medium text-gray-500 transition-colors duration-300 hover:text-gray-500 dark:text-gray-100">
              {item.title}
            </span>
            <ChevronDownIcon isOpen={isOpen} />
            {hasFocus && (
              <motion.div
                layoutId="focus-ring"
                className="focus-ring"
                variants={{
                  pressed: { scale: 0.98 },
                  hovered: { scale: 1.12 },
                }}
                transition={{
                  type: "spring",
                  visualDuration: 0.2,
                  bounce: 0.2,
                }}
              />
            )}
          </motion.div>
        </Accordion.Trigger>
      </Accordion.Header>

      <AnimatePresence initial={false}>
        {isOpen && (
          <Accordion.Content forceMount asChild>
            <motion.div
              className="accordion-content pr-12 md:pr-48"
              variants={{
                open: {
                  height: "auto",
                  maskImage:
                    "linear-gradient(to bottom, black 100%, transparent 100%)",
                },
                closed: {
                  height: 0,
                  maskImage:
                    "linear-gradient(to bottom, black 50%, transparent 100%)",
                },
              }}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <motion.div
                variants={{
                  open: {
                    filter: "blur(0px)",
                    opacity: 1,
                  },
                  closed: {
                    filter: "blur(2px)",
                    opacity: 0,
                  },
                }}
              >
                <div className="content-inner">
                  {item.content.split("\n\n").map((paragraph, i) => (
                    <p
                      className="text-sm text-gray-500 dark:text-gray-400"
                      key={i}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </Accordion.Content>
        )}
      </AnimatePresence>
      <hr />
    </Accordion.Item>
  );
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      stroke="white"
      strokeWidth="1"
      fill={isOpen ? "none" : "none"}
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ rotate: isOpen ? 180 : 0 }}
      className={isOpen ? "bg-gray-400" : "bg-brand-primary"}
    >
      <path d="m6 11 6 6 6-6" />
      <path d="m12  6.5 0 9" />
    </motion.svg>
  );
}

function onlyKeyboardFocus(callback: () => void) {
  return (e: React.FocusEvent<HTMLElement>) => {
    if (
      e.type === "focus" &&
      (e.target as HTMLElement).matches(":focus-visible")
    ) {
      callback();
    }
  };
}

/**
 * ==============   Styles   ================
 */
function StyleSheet() {
  return (
    <style>{`
            .accordion {
                display: flex;
                flex-direction: column;
                color: #f5f5f5;
                min-width:100%;
                width: 100%;
            }

            .accordion h3 {
                margin: 0;
                display: flex;
            }

            .section {
                padding: 20px;
                position: relative;
            }

            .trigger {
                width: 100%;
                border: none;
                padding: 0;
                color: #333333;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                position: relative;
            }

            .trigger span,
            .trigger svg {
                text-align: left;
                z-index: 1;
                position: relative;
            }

            .focus-ring {
                position: absolute;
                inset: -10px;
                background: var(--hue-4-transparent);
                border-radius: 5px;
                z-index: 0;
            }

            hr {
                margin: 0;
                position: absolute;
                bottom: 0;
                left: 20px;
                right: 20px;
                z-index: 0;
            }

            @media (max-width: 500px) {
                .accordion { width: 300px; }

                .trigger span {
                    font-size: 0.9rem;
                }

                .content-inner {
                    font-size: 0.85rem;
                }
            }

            .section:last-child hr {
                display: none;
            }

            .accordion-content {
                overflow: hidden;
            }

            .content-inner {
                padding: 20px 0 0;
                line-height: 1.5;
            }

            .content-inner p {
                margin: 0;
                padding: 0;
            }

            .content-inner p + p {
                margin-top: 1em;
            }
        `}</style>
  );
}

export default RadixAccordion;
