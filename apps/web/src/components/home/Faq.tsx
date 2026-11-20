'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

const QA = [
  ['How long does ghee keep?', 'Nine months sealed, at room temperature, away from sunlight. Once opened, use a dry spoon and it stays good for months more. The expiry date and batch code are printed on every jar.'],
  ['Does UHT milk need a fridge?', 'Not until you open it. The carton is sterile and sealed, so it keeps for six months on a shelf. After opening, refrigerate and finish within two days.'],
  ['Where do you ship, and how much does it cost?', 'Anywhere in India except army post offices. Pune pincodes get delivery in 1–2 days and free shipping above ₹499; the rest of Maharashtra in 2–4 days; most of India in 3–6 days. You see the exact fee and date at checkout.'],
  ['Can I cancel an order?', 'Yes, from your account until we pack it. The full amount goes back to your original payment method automatically.'],
  ['How fresh will my products be?', 'We never ship stock with less than a week of shelf life left, and we always send the oldest safe batch first, so stock never sits until it expires.'],
  ['Which payment methods do you take?', 'UPI, debit and credit cards, net banking and wallets through Cashfree. Cash on delivery is not available yet.'],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-rule rounded-4 border border-rule bg-paper">
      {QA.map(([q, a], i) => (
        <li key={q}>
          <h3>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lg">
              {q}
              <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-paper-2 text-xl" aria-hidden>
                +
              </motion.span>
            </button>
          </h3>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                <p className="max-w-3xl px-5 pb-5 text-base text-ink-2">{a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </li>
      ))}
    </ul>
  );
}
