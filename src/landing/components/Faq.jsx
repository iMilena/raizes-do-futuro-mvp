import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { faqData } from '../data/content';

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (index) => {
    setOpenIndex((current) => (current === index ? -1 : index));
  };

  return (
    <div id="faq" className="faq">
      <div className="faq-content">
        <h2 className="faq-title">Perguntas Frequentes</h2>

        {faqData.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.q} className="faq-item">
              <button
                type="button"
                className="faq-question"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
              >
                {item.q}
                <span className="faq-toggle-icon">{isOpen ? '\u2212' : '+'}</span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { type: 'spring', stiffness: 300, damping: 32 },
                      opacity: { duration: 0.2 },
                    }}
                    className="faq-answer-wrapper"
                  >
                    <div className="faq-answer">{item.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}