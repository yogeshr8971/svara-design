import React from 'react';
import { Check } from 'lucide-react';

/**
 * The progress bar at the top of Curate Look: one tab per stage, plus a final "Full Look" tab.
 * A stage unlocks once every stage before it has a chosen product.
 */
export default function StageTabs({ stages, chosen, currentIndex, canOpen, onSelect, lookComplete }) {
  const fullLookIndex = stages.length;

  return (
    <nav className="glass rounded-3xl p-3 sm:p-5 overflow-x-auto" aria-label="Curate Look progress">
      <div className="flex min-w-max gap-2">
        {stages.map((stage, index) => {
          const isCurrent = index === currentIndex;
          const isChosen = Boolean(chosen[stage.slug]);

          return (
            <button
              key={stage._id || stage.slug}
              type="button"
              disabled={!canOpen(index)}
              onClick={() => onSelect(index)}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition disabled:opacity-45 ${
                isCurrent
                  ? 'bg-charcoal-700 text-white'
                  : isChosen
                    ? 'bg-champagne-100 text-champagne-700'
                    : 'text-charcoal-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${
                  isChosen ? 'bg-champagne-600 text-white' : 'bg-ivory-300 text-charcoal-600'
                }`}
              >
                {isChosen ? <Check size={12} /> : index + 1}
              </span>
              {stage.displayName || stage.name}
            </button>
          );
        })}

        <button
          type="button"
          disabled={!lookComplete}
          onClick={() => onSelect(fullLookIndex)}
          className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition disabled:opacity-45 ${
            currentIndex === fullLookIndex ? 'bg-charcoal-700 text-white' : 'text-charcoal-400'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-ivory-300 text-charcoal-600 grid place-items-center text-[10px]">
            {fullLookIndex + 1}
          </span>
          Full Look
        </button>
      </div>
    </nav>
  );
}
