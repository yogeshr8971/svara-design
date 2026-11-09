import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Edit3,
  Check,
  X,
  LayoutGrid,
  List,
  Eye,
  Store,
  Truck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import ProductImageUploader from '../components/product/ProductImageUploader';
import { formatPrice, calculateDiscount } from '../utils/formatPrice';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Product modal (Add / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Quick Stock Modal
  const [stockModal, setStockModal] = useState({ isOpen: false, product: null, stock: 0, variants: [] });
  const [updatingStock, setUpdatingStock] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    compareAtPrice: '',
    shippingFee: 99,
    category: '',
    description: '',
    stock: 20,
    sizes: 'XS, S, M, L, XL',
    colors: '',
    material: '',
    brand: 'SVARA',
    badges: [],
  });
  const [productImages, setProductImages] = useState([]);

  // Fee modal
  const [feeModal, setFeeModal] = useState({ isOpen: false, product: null, fee: '' });

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const [prodsResult, catsResult, sellersResult] = await Promise.allSettled([
        adminService.getAdminProducts({ limit: 150 }),
        adminService.getCategories(),
        adminService.getSellers({ limit: 100 }),
      ]);
      if (prodsResult.status === 'fulfilled') {
        setProducts(prodsResult.value?.products || []);
      }
      if (catsResult.status === 'fulfilled') {
        setCategories(catsResult.value?.categories || []);
      }
      if (sellersResult.status === 'fulfilled') {
        setSellers(sellersResult.value?.sellers || []);
      }
      if (prodsResult.status === 'rejected') {
        toast.error(prodsResult.reason?.readableMessage || 'Failed to load products from database.');
      }
    } catch (err) {
      toast.error(err?.readableMessage || 'Failed to load catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const openNewProductModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      compareAtPrice: '',
      shippingFee: 99,
      category: categories[0]?._id || '',
      description: '',
      stock: 20,
      sizes: 'XS, S, M, L, XL',
      colors: '',
      material: '',
      brand: 'SVARA',
      badges: [],
    });
    setProductImages([]);
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name || '',
      price: prod.price || '',
      compareAtPrice: prod.compareAtPrice || '',
      shippingFee: prod.shippingFee ?? 99,
      category: prod.category?._id || prod.category || '',
      description: prod.description || '',
      stock: prod.stock ?? 20,
      sizes: (prod.sizes || []).join(', '),
      colors: (prod.colors || []).map((c) => c.name).join(', '),
      material: prod.material || '',
      brand: prod.brand || 'SVARA',
      badges: prod.badges || [],
    });
    setProductImages(prod.images || []);
    setModalOpen(true);
  };

  const openStockModal = (prod) => {
    setStockModal({
      isOpen: true,
      product: prod,
      stock: prod.stock ?? 0,
      variants: Array.isArray(prod.variants) && prod.variants.length > 0
        ? prod.variants.map((v) => ({ ...v }))
        : (prod.sizes || []).map((sz) => ({ size: sz, stock: Math.floor((prod.stock || 0) / (prod.sizes.length || 1)) })),
    });
  };

  const handleQuickStockUpdate = async (e) => {
    e.preventDefault();
    if (!stockModal.product) return;
    try {
      setUpdatingStock(true);
      await adminService.updateAdminProductStock(
        stockModal.product._id,
        Number(stockModal.stock) || 0,
        stockModal.variants
      );
      toast.success(`Inventory updated for ${stockModal.product.name}`);
      setStockModal({ isOpen: false, product: null, stock: 0, variants: [] });
      fetchCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setUpdatingStock(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Product title is required.');
    if (!formData.price || Number(formData.price) <= 0) return toast.error('A valid positive selling price is required.');

    try {
      setSavingProduct(true);
      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('price', formData.price);
      if (formData.compareAtPrice) data.append('compareAtPrice', formData.compareAtPrice);
      data.append('shippingFee', formData.shippingFee ?? 99);
      data.append('category', formData.category || categories[0]?._id);
      data.append('description', formData.description || '');
      data.append('stock', formData.stock || 0);
      data.append('material', formData.material || '');
      data.append('brand', formData.brand || 'SVARA');

      if (formData.sizes) {
        data.append('sizes', JSON.stringify(formData.sizes.split(',').map((s) => s.trim()).filter(Boolean)));
      }
      if (formData.colors) {
        data.append('colors', JSON.stringify(formData.colors.split(',').map((c) => ({ name: c.trim() })).filter(Boolean)));
      }
      if (formData.badges.length) {
        data.append('badges', JSON.stringify(formData.badges));
      }

      // Append image files or existing images
      const existingImages = [];
      for (const img of productImages) {
        if (img.file) {
          data.append('images', img.file);
        } else if (img.url) {
          existingImages.push(img);
        }
      }
      if (existingImages.length > 0) {
        data.append('existingImages', JSON.stringify(existingImages));
      }

      if (editingProduct) {
        await adminService.updateProduct(editingProduct._id, data);
        toast.success('Product updated successfully.');
      } else {
        await adminService.createProduct(data);
        toast.success('Product created and published.');
      }

      setModalOpen(false);
      fetchCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (prodId) => {
    if (!window.confirm('Delete this product permanently from the catalogue?')) return;
    try {
      await adminService.deleteProduct(prodId);
      setProducts((prev) => prev.filter((p) => p._id !== prodId));
      toast.success('Product removed.');
    } catch {
      toast.error('Failed to delete product.');
    }
  };

  const handleUpdateShippingFee = async () => {
    const { product, fee } = feeModal;
    const parsedFee = Number(fee);
    if (isNaN(parsedFee) || parsedFee < 0) return toast.error('Enter a valid non-negative fee.');

    try {
      await adminService.assignShippingFee(product._id, parsedFee);
      setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, shippingFee: parsedFee } : p)));
      setFeeModal({ isOpen: false, product: null, fee: '' });
      toast.success(`Shipping fee updated to ₹${parsedFee}.`);
    } catch (err) {
      toast.error('Failed to update shipping fee.');
    }
  };

  const handleDownloadPhoto = async (prodId, idx = 0) => {
    try {
      const res = await adminService.downloadOriginalPhoto(prodId, idx);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
        toast.success('Downloading original photograph.');
      }
    } catch {
      toast.error('Failed to download original photo.');
    }
  };

  // Filtered catalogue
  const filteredProducts = products.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchBrand = p.brand?.toLowerCase().includes(q);
      if (!matchName && !matchBrand) return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (categoryFilter && p.category?._id !== categoryFilter && p.category !== categoryFilter) return false;
    if (sellerFilter && p.sellerId?._id !== sellerFilter && p.sellerId !== sellerFilter) return false;
    if (stockFilter === 'inStock' && (p.stock || 0) < 5) return false;
    if (stockFilter === 'lowStock' && ((p.stock || 0) <= 0 || (p.stock || 0) >= 5)) return false;
    if (stockFilter === 'outOfStock' && (p.stock || 0) > 0) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">Catalog Management</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Seller-wise product directory, original photo downloads, shipping fee controls, and publishing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white p-1 rounded-xl border border-ivory-300 flex items-center">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-charcoal-700 text-white' : 'text-charcoal-500 hover:text-charcoal-800'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'table' ? 'bg-charcoal-700 text-white' : 'text-charcoal-500 hover:text-charcoal-800'
              }`}
              title="Table View"
            >
              <List size={15} />
            </button>
          </div>

          <Button variant="primary" size="sm" onClick={openNewProductModal}>
            <Plus size={14} />
            <span>Add Atelier Style</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
        <div className="relative">
          <input
            type="text"
            placeholder="Search design by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-8 text-xs py-2"
          />
          <Search size={14} className="absolute left-2.5 top-3 text-charcoal-400" />
        </div>

        <select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="input-field text-xs py-2"
        >
          <option value="">All Sellers (SVARA + Partners)</option>
          {sellers.map((s) => (
            <option key={s._id} value={s._id}>
              {s.businessName || s.name} ({s.email})
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field text-xs py-2"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field text-xs py-2"
        >
          <option value="">All Publication Statuses</option>
          <option value="approved">Approved & Published</option>
          <option value="pending">Pending Admin Review</option>
          <option value="rejected">Rejected</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="input-field text-xs py-2 font-medium"
        >
          <option value="">All Stock Levels</option>
          <option value="inStock">In Stock (≥5 units)</option>
          <option value="lowStock">Low Stock (&lt;5 units)</option>
          <option value="outOfStock">Out of Stock (0 units)</option>
        </select>
      </div>

      {/* Catalogue Content */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <Package size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No Products Found</h3>
          <p className="text-xs text-charcoal-400">Try adjusting your catalogue filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW WITH DISCOUNT BADGES & ORIGINAL PHOTO DOWNLOAD (§6, §8) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => {
            const seller = p.sellerId;
            const isSellerProd = p.ownerType === 'seller' && seller;
            const ownerLabel = isSellerProd ? seller.businessName || seller.name || 'Seller' : 'SVARA Direct';
            const firstImg = p.images?.[0]?.url || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500';

            // Discount calculation (§8)
            const discountPct = calculateDiscount(p.compareAtPrice, p.price);
            const hasDiscount = discountPct > 0;

            const statusColors = {
              approved: 'bg-emerald-600 text-white',
              pending: 'bg-amber-500 text-white',
              rejected: 'bg-rose-600 text-white',
              inactive: 'bg-charcoal-500 text-white',
            };

            return (
              <div
                key={p._id}
                className="glass-card overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all group"
              >
                <div className="relative aspect-[4/5] bg-ivory-200 overflow-hidden">
                  <img
                    src={firstImg}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[p.status] || 'bg-charcoal-700 text-white'}`}>
                      {p.status || 'approved'}
                    </span>
                    {hasDiscount && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                        ↓ {discountPct}% OFF
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadPhoto(p._id, 0)}
                      className="p-1.5 rounded-lg bg-charcoal-900/80 hover:bg-charcoal-900 text-white text-[10px] font-semibold flex items-center gap-1 shadow-xs transition-colors"
                      title="Download authorized original photograph (§6)"
                    >
                      <Download size={13} />
                      <span>Original</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-charcoal-500">
                      <span className="font-semibold text-charcoal-800">{ownerLabel}</span>
                      <span className="px-2 py-0.5 rounded bg-ivory-200">{p.category?.name || 'Style'}</span>
                    </div>

                    <h3 className="font-display text-base font-bold text-charcoal-900 line-clamp-1">{p.name}</h3>

                    {/* Discount Pricing Display (§8) */}
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-base font-bold text-charcoal-900">{formatPrice(p.price)}</span>
                      {hasDiscount && (
                        <span className="text-xs text-charcoal-400 line-through">
                          {formatPrice(p.compareAtPrice)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-charcoal-500 pt-1 border-t border-ivory-200">
                      <button
                        type="button"
                        onClick={() => openStockModal(p)}
                        className="font-semibold flex items-center gap-1 hover:underline text-left"
                        title="Click to edit inventory"
                      >
                        {p.stock <= 0 ? (
                          <span className="text-rose-600 font-bold">Out of Stock (0)</span>
                        ) : p.stock < 5 ? (
                          <span className="text-amber-600 font-bold">Low Stock ({p.stock})</span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Stock: {p.stock} units</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeeModal({ isOpen: true, product: p, fee: p.shippingFee ?? 99 })}
                        className="text-burgundy-600 hover:text-burgundy-800 font-semibold flex items-center gap-1"
                        title="Click to assign or modify shipping fee"
                      >
                        <Truck size={12} />
                        <span>Shipping: {p.shippingFee !== null && p.shippingFee !== undefined ? `₹${p.shippingFee}` : 'Unassigned'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-ivory-200">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => openEditModal(p)}
                      className="flex-1 justify-center"
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDeleteProduct(p._id)}
                      className="text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5">Owner / Seller</th>
                  <th className="p-3.5">Price & Discount</th>
                  <th className="p-3.5">Assigned Shipping Fee</th>
                  <th className="p-3.5">Stock</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {filteredProducts.map((p) => {
                  const discountPct = calculateDiscount(p.compareAtPrice, p.price);
                  const firstImg = p.images?.[0]?.url;

                  return (
                    <tr key={p._id} className="hover:bg-ivory-50/80 transition-colors">
                      <td className="p-3.5 flex items-center gap-3">
                        {firstImg && (
                          <img src={firstImg} alt={p.name} className="w-10 h-12 object-cover rounded-lg border border-ivory-300" />
                        )}
                        <div>
                          <p className="font-bold text-charcoal-900">{p.name}</p>
                          <p className="text-[10px] text-charcoal-400">{p.category?.name || 'Category'}</p>
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-charcoal-700">
                        {p.ownerType === 'seller' ? p.sellerId?.businessName || p.sellerId?.name || 'Seller' : 'SVARA Direct'}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-charcoal-900">{formatPrice(p.price)}</span>
                        {discountPct > 0 && (
                          <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            ↓{discountPct}%
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => setFeeModal({ isOpen: true, product: p, fee: p.shippingFee ?? 99 })}
                          className="font-bold text-burgundy-600 hover:text-burgundy-800 underline underline-offset-2"
                        >
                          {p.shippingFee !== null && p.shippingFee !== undefined ? `₹${p.shippingFee}` : 'Unassigned'}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => openStockModal(p)}
                          className="hover:underline font-medium text-left"
                          title="Click to edit inventory"
                        >
                          {p.stock <= 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Out of Stock
                            </span>
                          ) : p.stock < 5 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Low: {p.stock} units
                            </span>
                          ) : (
                            <span className="text-charcoal-800 font-semibold">{p.stock} units</span>
                          )}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-ivory-200 text-charcoal-700">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="xs" onClick={() => handleDownloadPhoto(p._id, 0)} title="Download original photo">
                            <Download size={13} />
                          </Button>
                          <Button variant="ghost" size="xs" onClick={() => openEditModal(p)} title="Edit style">
                            <Edit3 size={13} />
                          </Button>
                          <Button variant="ghost" size="xs" onClick={() => handleDeleteProduct(p._id)} className="text-rose-600">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Product with Box-Style Uploader (§6) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit Atelier Product' : 'Create New Atelier Design'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-6 text-xs">
          {/* Visual Box-Style Image Uploader */}
          <ProductImageUploader
            images={productImages}
            onChange={setProductImages}
            maxImages={4}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Design Title"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Silk Zari Embroidered Saree"
              required
            />
            <Input
              label="Brand / Atelier Label"
              value={formData.brand}
              onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
              placeholder="SVARA"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Selling Price (₹)"
              type="number"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="1500"
              required
            />
            <Input
              label="Original Price (Compare At ₹)"
              type="number"
              min="0"
              value={formData.compareAtPrice}
              onChange={(e) => setFormData((prev) => ({ ...prev, compareAtPrice: e.target.value }))}
              placeholder="2000"
            />
            <Input
              label="Assigned Shipping Fee (₹) (§7)"
              type="number"
              min="0"
              value={formData.shippingFee}
              onChange={(e) => setFormData((prev) => ({ ...prev, shippingFee: e.target.value }))}
              placeholder="99 (0 for Free)"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                className="input-field py-2 text-xs"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input
              label="Stock Available (Total Units) *"
              type="number"
              min="0"
              required
              value={formData.stock}
              onChange={(e) => setFormData((prev) => ({ ...prev, stock: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
              Description & Fabric Details
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="input-field text-xs"
              placeholder="Detailed craftsmanship notes, weave specifications, and styling ideas..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-ivory-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={savingProduct}>
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Quick Stock Update */}
      <Modal
        isOpen={stockModal.isOpen}
        onClose={() => setStockModal({ isOpen: false, product: null, stock: 0, variants: [] })}
        title={`Update Stock: ${stockModal.product?.name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickStockUpdate} className="space-y-4 text-xs">
          <p className="text-charcoal-500">
            Directly update inventory stock. Changes synchronize immediately across storefront, curate look, cart, and checkout.
          </p>

          <Input
            label="Total Stock (units) *"
            type="number"
            min="0"
            required
            value={stockModal.stock}
            onChange={(e) => setStockModal((prev) => ({ ...prev, stock: Number(e.target.value) }))}
          />

          {stockModal.variants && stockModal.variants.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-ivory-200">
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700">
                Size Variant Stock Breakdown
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stockModal.variants.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-ivory-50 p-2 rounded-xl">
                    <span className="font-bold text-charcoal-800 uppercase">{v.size}</span>
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => {
                        const newStock = Number(e.target.value) || 0;
                        const newVariants = [...stockModal.variants];
                        newVariants[idx] = { ...newVariants[idx], stock: newStock };
                        const sumStock = newVariants.reduce((sum, item) => sum + (item.stock || 0), 0);
                        setStockModal((prev) => ({ ...prev, variants: newVariants, stock: sumStock }));
                      }}
                      className="w-24 px-2 py-1 text-xs rounded-lg border border-ivory-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStockModal({ isOpen: false, product: null, stock: 0, variants: [] })}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updatingStock}>
              Save Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Update Shipping Fee (§7) */}
      <Modal
        isOpen={feeModal.isOpen}
        onClose={() => setFeeModal({ isOpen: false, product: null, fee: '' })}
        title={`Assign Shipping Fee — ${feeModal.product?.name}`}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-charcoal-500">
            Only platform administrators can assign or modify shipping fees. Products without assigned fees cannot be published or checked out.
          </p>

          <Input
            label="Shipping Fee (₹)"
            type="number"
            min="0"
            value={feeModal.fee}
            onChange={(e) => setFeeModal((prev) => ({ ...prev, fee: e.target.value }))}
            placeholder="e.g. 99 (0 for Free Shipping)"
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeeModal({ isOpen: false, product: null, fee: '' })}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleUpdateShippingFee}>
              Update Fee
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
