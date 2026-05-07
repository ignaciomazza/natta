"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

type FaqItem = {
  answer: string;
  question: string;
};

type FaqListProps = {
  items: FaqItem[];
};

export function FaqList({ items }: FaqListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-[var(--line)]" data-reveal="right">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const contentId = `faq-answer-${index}`;

        return (
          <div className="faq-item py-5 md:py-6" key={item.question}>
            <button
              aria-controls={contentId}
              aria-expanded={isOpen}
              className="motion-button flex w-full cursor-pointer items-center justify-between gap-5 text-left text-lg font-medium leading-7 text-[var(--chocolate-deep)] md:text-xl"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              type="button"
            >
              {item.question}
              <ArrowRight
                className={`h-5 w-5 shrink-0 transition ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
            </button>
            <div
              className={`faq-answer-panel ${isOpen ? "is-open" : ""}`}
              id={contentId}
            >
              <div className="faq-answer-inner">
                <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--chocolate)]/76">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
