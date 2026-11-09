import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import ProductCard from '../components/product/ProductCard';
import ProductFilters from '../components/product/ProductFilters';
import ProductSkeleton from '../components/product/ProductSkeleton';
import StageTabs from '../components/curate/StageTabs';
import FullLookSummary from '../components/curate/FullLookSummary';
import * as curateCategoryService from '../services/curateCategoryService';
import { useCart } from '../hooks/useCart';

/**
 * Curate Look - build one outfit by choosing a product at each stage.
 *
 * A "stage" is a Category (Dress, Handbag, Footwear...). The products shown at a stage
 * are exactly the Shop All products of that category, so the two pages always agree.
 * The server does that filtering: GET /api/curate-categories/:slug/products.
 */

const STORAGE_KEY = 'svara_curate_look';
const DEFAULT_FILTERS = { size: '', sort: 'newest', maxPrice: 10000 };

// A look is saved in the browser as { selections: { [stageSlug]: product } }.
const EMPTY_LOOK = { selections: {} };

const loadSavedLook = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || EMPTY_LOOK;
  } catch {
    return EMPTY_LOOK;
  }
};

// The variant we sell by default: first one in stock, otherwise the first active one.
const defaultVariant = (product) => (
  product?.variants?.find((v) => v.isActive !== false && v.stock > 0)
  || product?.variants?.find((v) => v.isActive !== false)
  || null
);

const unitPrice = (product) => Number(defaultVariant(product)?.price ?? product.price ?? 0);

export default function CategoryShoppingPage() {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [stages, setStages] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [stageIndex, setStageIndex] = useState(0);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [look, setLook] = useState(loadSavedLook);
  const [adding, setAdding] = useState(false);

  const chosen = look.selections;
  const activeStage = stages[stageIndex];
  const onFullLookStep = stages.length > 0 && stageIndex >= stages.length;

  // The pieces picked so far, in stage order.
  const pieces = useMemo(
    () => stages
      .map((stage, index) => ({ stage, stageIndex: index, product: chosen[stage.slug] }))
      .filter((piece) => piece.product)
      .map((piece) => ({ ...piece, price: unitPrice(piece.product) })),
    [stages, chosen],
  );
  const lookComplete = stages.length > 0 && pieces.length === stages.length;
  const total = pieces.reduce((sum, piece) => sum + piece.price, 0);

  // A stage can be opened once every stage before it has a product.
  const canOpenStage = (index) => stages.slice(0, index).every((stage) => chosen[stage.slug]);

  // Remember the look between visits.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(look));
  }, [look]);

  // 1) Load the stages, then jump to the first one that has no product yet.
  useEffect(() => {
    curateCategoryService.getCurateCategories()
      .then((res) => {
        const list = res.categories || res.curateCategories || [];
        const firstEmpty = list.findIndex((stage) => !chosen[stage.slug]);
        setStages(list);
        setStageIndex(firstEmpty === -1 ? list.length : firstEmpty);
      })
      .catch(() => toast.error('Unable to load Curate Look stages.'))
      .finally(() => setStagesLoading(false));
    // Only on first load - `chosen` is read once to resume where the shopper left off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Load this stage's products whenever the stage or a filter changes.
  useEffect(() => {
    if (!activeStage) return undefined;

    let ignore = false; // drops the answer if the shopper already moved to another stage
    setProductsLoading(true);

    curateCategoryService
      .getStageProducts(activeStage.slug, {
        limit: 24,
        size: filters.size || undefined,
        sort: filters.sort,
        maxPrice: filters.maxPrice,
      })
      .then((res) => { if (!ignore) setProducts(res.products || []); })
      .catch(() => { if (!ignore) toast.error(`Unable to load ${activeStage.displayName || activeStage.name}.`); })
      .finally(() => { if (!ignore) setProductsLoading(false); });

    return () => { ignore = true; };
  }, [activeStage?.slug, filters]);

  // ---- actions ----------------------------------------------------------

  const goToStage = (index) => {
    if (index <= stageIndex || canOpenStage(index)) {
      setStageIndex(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const choosePiece = (product) => {
    setLook((prev) => ({ selections: { ...prev.selections, [activeStage.slug]: product } }));
    setStageIndex(stageIndex + 1);
  };

  const removePiece = (index) => {
    const slug = stages[index].slug;
    setLook((prev) => {
      const { [slug]: _removed, ...rest } = prev.selections;
      return { selections: rest };
    });
    setStageIndex(index);
  };

  const clearLook = () => {
    setLook(EMPTY_LOOK);
    localStorage.removeItem(STORAGE_KEY);
    setStageIndex(0);
  };

  const addLookToBag = async () => {
    if (!lookComplete) {
      toast.error('Complete every stage before adding your look to the bag.');
      return;
    }
    setAdding(true);
    try {
      for (const { product } of pieces) {
        const variant = defaultVariant(product);
        const added = await addToCart(
          product._id,
          variant?.size || product.sizes?.[0] || 'Standard',
          variant?.color || product.colors?.[0]?.name || 'Default',
          1,
        );
        if (!added) throw new Error('Could not add every selected product.');
      }
      clearLook();
      toast.success('Every piece of your full look was added to your bag.');
      navigate('/cart');
    } catch (error) {
      toast.error(error.message || 'We could not add your complete look.');
    } finally {
      setAdding(false);
    }
  };

  // ---- screens ----------------------------------------------------------

  if (stagesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="section-heading">Curate Your Look</h1>
        <p className="mt-3 text-sm text-charcoal-400">
          There are no active Curate Look stages yet. An administrator can configure them from the category manager.
        </p>
      </div>
    );
  }

  if (onFullLookStep) {
    return (
      <FullLookSummary
        pieces={pieces}
        total={total}
        onChange={goToStage}
        onRemove={removePiece}
        onClear={clearLook}
        onAdd={addLookToBag}
        adding={adding}
      />
    );
  }

  const selected = chosen[activeStage.slug];
  const isLastStage = stageIndex === stages.length - 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-champagne-100 text-champagne-700 text-xs font-semibold tracking-widest uppercase">
          <Sparkles size={13} /> Curate Your Look
        </span>
        <h1 className="section-heading text-3xl font-bold">Build a complete ensemble</h1>
        <p className="text-xs text-charcoal-400 max-w-xl mx-auto">
          Choose one piece at each stage. Each stage shows the same products you will find in Shop All for that category.
        </p>
      </header>

      <StageTabs
        stages={stages}
        chosen={chosen}
        currentIndex={stageIndex}
        canOpen={canOpenStage}
        onSelect={goToStage}
        lookComplete={lookComplete}
      />

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-champagne-600 font-bold">
              Stage {stageIndex + 1} of {stages.length}
            </p>
            <h2 className="font-display text-2xl font-bold text-charcoal-700">
              {activeStage.displayName || activeStage.name}
            </h2>
            {activeStage.description && (
              <p className="text-xs text-charcoal-400 mt-1">{activeStage.description}</p>
            )}
          </div>
          {selected && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check size={14} /> Selected — choose another to replace it
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          <aside className="md:col-span-1">
            <ProductFilters
              showCategories={false}
              selectedSize={filters.size}
              onSelectSize={(size) => setFilters((f) => ({ ...f, size }))}
              selectedSort={filters.sort}
              onSelectSort={(sort) => setFilters((f) => ({ ...f, sort }))}
              priceRange={filters.maxPrice}
              onPriceChange={(maxPrice) => setFilters((f) => ({ ...f, maxPrice }))}
              onClearFilters={() => setFilters(DEFAULT_FILTERS)}
            />
          </aside>

          <div className="md:col-span-3">
            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {Array.from({ length: 6 }, (_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center text-sm text-charcoal-400">
                No products are available for this stage right now.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {products.map((product) => (
                  <StageProductCard
                    key={product._id}
                    product={product}
                    isSelected={selected?._id === product._id}
                    onSelect={() => choosePiece(product)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="flex justify-between border-t border-ivory-300/50 pt-6">
        <Button variant="outline" size="sm" disabled={stageIndex === 0} onClick={() => goToStage(stageIndex - 1)}>
          <ChevronLeft size={15} /> Previous
        </Button>
        <Button variant="primary" size="sm" disabled={!selected} onClick={() => goToStage(stageIndex + 1)}>
          {isLastStage ? 'View Full Look' : 'Continue'} <ChevronRight size={15} />
        </Button>
      </footer>
    </div>
  );
}

/** The Shop All product card, with a "select for this stage" button added underneath. */
function StageProductCard({ product, isSelected, onSelect }) {
  const outOfStock = product.stock <= 0;

  const selectButton = (
    <button
      type="button"
      onClick={onSelect}
      disabled={outOfStock}
      className={`mt-2 w-full rounded-xl py-2 text-xs font-bold transition-colors disabled:bg-charcoal-300 disabled:cursor-not-allowed ${
        isSelected
          ? 'bg-champagne-600 text-white hover:bg-champagne-700'
          : 'bg-charcoal-700 text-white hover:bg-charcoal-800'
      }`}
    >
      {outOfStock ? 'Out of stock' : isSelected ? 'Selected in Look' : 'Select for this stage'}
    </button>
  );

  return (
    <div className={`rounded-2xl ${isSelected ? 'ring-2 ring-champagne-500' : ''}`}>
      <ProductCard product={product} footer={selectButton} />
    </div>
  );
}
