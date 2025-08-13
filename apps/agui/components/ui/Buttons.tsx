"use client";
import React from "react";
import { cn } from "../../lib/utils";
import { ArrowElbowDownRightIcon } from "@phosphor-icons/react";
interface Button2Props {
  text?: string;
  className?: string;
  href?: string;
  variant: "primary" | "secondary";
}
const Button2PropsDefault = {
  variant: "primary",
};

CButton.defaultProps = Button2PropsDefault;
function CButton({ text, variant, href, className }: Button2Props) {
  const buttonClasses = cn(
    "group/cbutton border px-4 py-3 pr-6 hover:pr-4 inline-block transition-all duration-150",
    {
      "text-brand-primary hover:bg-brand-primary hover:text-white border-brand-primary":
        variant === "primary",
      "text-white bg-brand-primary hover:text-brand-primary border-brand-primary hover:bg-gray-100 hover:border-gray-100":
        variant === "secondary",
    },
    className
  );

  return (
    <a className={buttonClasses} href={href}>
      <span className="flex justify-between items-center text-sm font-brand-regular">
        <ArrowElbowDownRightIcon
          className="group-hover/cbutton:mr-3 mr-1 transition-all duration-150"
          size={16}
        />
        {text}
      </span>
    </a>
  );
}
export default CButton;
