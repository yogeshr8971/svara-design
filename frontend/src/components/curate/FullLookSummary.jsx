import React from 'react';
import { Link } from 'react-router-dom';
import { Edit3, ShoppingBag } from 'lucide-react';
import Button from '../ui/Button';
import { formatPrice } from '../../utils/formatPrice';

/**
 * The last step: every chosen piece listed together with the total.
 * Each piece stays an individual product when it is added to the bag.
 *
 * `pieces` looks like: [{ stage, stageIndex, product, price }]
 */
export default function FullLookSummary({ pieces, total, onChange, onRemove, onClear, onAdd, adding }) {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      <header className="text-center">
        <span className="text-xs uppercase font-bold tracking-[.2em] text-champagne-600">Final stage</span>
        <h1 className="section-heading text-3xl mt-2">Your Full Look</h1>
        <p className="text-xs text-charcoal-400 mt-2">Every piece remains an individual product when added to your bag.</p>
      </header>

      <section className="space-y-3">
        {pieces.map(({ stage, stageIndex, product, price }) => (
          <article key={stage.slug} className="glass rounded-2xl p-3 flex items-center gap-3">
            <div className="w-14 h-[72px] rounded-xl overflow-hidden bg-ivory-200 shrink-0">
              <img
                src={product.images?.[0]?.url || product.tryOnImage?.url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase text-champagne-700 font-bold truncate">
                {stage.displayName || stage.name}
              </p>
              <Link
                to={`/product/${product.slug || product._id}`}
                className="text-sm font-semibold text-charcoal-700 truncate hover:text-burgundy-700 transition-colors block"
              >
                {product.name}
              </Link>
              <p className="text-xs font-bold text-charcoal-600">{formatPrice(price)}</p>
            </div>

            <div className="flex flex-col gap-1 items-end">
              <button
                type="button"
                onClick={() => onChange(stageIndex)}
                className="text-[11px] font-bold text-champagne-700 flex items-center gap-1"
              >
                <Edit3 size={11} /> Change
              </button>
              <button
                type="button"
                onClick={() => onRemove(stageIndex)}
                className="text-[11px] font-bold text-rose-600"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>

      <footer className="glass rounded-3xl p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-bold text-charcoal-400 hover:text-rose-600"
        >
          Clear Full Look
        </button>

        <div>
          <p className="text-xs uppercase tracking-wider text-charcoal-400 font-bold">Full Look Total</p>
          <p className="font-display text-2xl font-bold text-charcoal-700">{formatPrice(total)}</p>
        </div>

        <Button variant="primary" size="lg" loading={adding} onClick={onAdd}>
          <ShoppingBag size={18} /> Add Full Look to Bag
        </Button>
      </footer>
    </main>
  );
}
