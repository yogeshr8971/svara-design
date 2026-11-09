import React, { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, Package, DollarSign, Store,
  Plus, Trash2, Edit3, CheckCircle, Clock, XCircle,
  Calendar, ArrowUpRight
} from 'lucide-react';
import SellerSidebar from '../components/seller/SellerSidebar';
import StatCard from '../components/ui/StatCard';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ProductImageUploader from '../components/product/ProductImageUploader';
import { formatPrice } from '../utils/formatPrice';
import { formatDate } from '../utils/formatDate';
import * as sellerService from '../services/sellerService';
import * as categoryService from '../services/categoryService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SellerDashboardPage() {
  const { user, updateUser } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filter for dashboard
  const [dateFilter, setDateFilter] = useState('all');

  // Product Filters & Modals
  const [stockFilter, setStockFilter] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [quickStockModal, setQuickStockModal] = useState({ isOpen: false, product: null, stock: 0, variants: [] });
  const [updatingStock, setUpdatingStock] = useState(false);

  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);

  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
    stock: 20,
    sizes: 'XS, S, M, L, XL',
    colors: '',
    material: '',
    brand: user?.businessName || 'My Atelier',
    badges: [],
    imageUrl1: '',
    imageUrl2: '',
    imageUrl3: '',
    imageUrl4: '',
    tryOnImageUrl: '',
  });

  const [prodImages, setProdImages] = useState([]);
  const [tryOnImage, setTryOnImage] = useState(null);
  const [deleteImageIds, setDeleteImageIds] = useState([]);

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    businessName: user?.businessName || '',
    businessAddress: user?.businessAddress || '',
    gstNumber: user?.gstNumber || '',
    sellerDescription: user?.sellerDescription || '',
    phone: user?.phone || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchSellerData = async () => {
    try {
      setLoading(true);
      const [dashResult, prodsResult, ordResult, salesResult, catsResult] = await Promise.allSettled([
        sellerService.getSellerDashboard(),
        sellerService.getSellerProducts({ limit: 50 }),
        sellerService.getSellerOrders({ limit: 50 }),
        sellerService.getSellerSales({ limit: 50 }),
        categoryService.getCategories(),
      ]);
      if (dashResult.status === 'fulfilled') {
        setStats(dashResult.value?.stats || null);
        setRecentSales(dashResult.value?.recentSales || []);
      }
      if (prodsResult.status === 'fulfilled') {
        setProducts(prodsResult.value?.products || []);
      }
      if (ordResult.status === 'fulfilled') {
        setOrders(ordResult.value?.orders || []);
      }
      if (salesResult.status === 'fulfilled') {
        setSales(salesResult.value?.sales || []);
      }
      if (catsResult.status === 'fulfilled') {
        setCategories(catsResult.value?.categories || []);
      }
    } catch (err) {
      console.error('Error fetching seller data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerData();
  }, []);

  const openNewProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      price: '',
      category: categories[0]?._id || '',
      description: '',
      stock: 20,
      sizes: 'XS, S, M, L, XL',
      colors: '',
      material: '',
      brand: user?.businessName || '',
      badges: [],
      imageUrl1: '',
      imageUrl2: '',
      imageUrl3: '',
      imageUrl4: '',
      tryOnImageUrl: '',
    });
    setProdImages([]);
    setTryOnImage(null);
    setDeleteImageIds([]);
    setProductModal(true);
  };

  const openEditProductModal = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      price: prod.price || '',
      category: prod.category?._id || prod.category || '',
      description: prod.description || '',
      stock: prod.stock ?? 20,
      sizes: (prod.sizes || []).join(', '),
      colors: (prod.colors || []).map(c => c.name).join(', '),
      material: prod.material || '',
      brand: prod.brand || '',
      badges: prod.badges || [],
      imageUrl1: '',
      imageUrl2: '',
      imageUrl3: '',
      imageUrl4: '',
      tryOnImageUrl: '',
    });
    setProdImages([]);
    setTryOnImage(null);
    setDeleteImageIds([]);
    setProductModal(true);
  };

  const openQuickStockModal = (prod) => {
    setQuickStockModal({
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
    if (!quickStockModal.product) return;
    try {
      setUpdatingStock(true);
      await sellerService.updateSellerProductStock(
        quickStockModal.product._id,
        Number(quickStockModal.stock) || 0,
        quickStockModal.variants
      );
      toast.success(`Inventory updated for ${quickStockModal.product.name}`);
      setQuickStockModal({ isOpen: false, product: null, stock: 0, variants: [] });
      fetchSellerData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setUpdatingStock(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (productForm.stock === undefined || productForm.stock === null || Number(productForm.stock) < 0) {
      return toast.error('Initial stock quantity is required (minimum 0).');
    }

    try {
      setSavingProduct(true);

      const formData = new FormData();
      formData.append('name', productForm.name);
      formData.append('price', productForm.price);
      formData.append('category', productForm.category || categories[0]?._id);
      formData.append('description', productForm.description);
      formData.append('stock', productForm.stock);
      formData.append('material', productForm.material);
      formData.append('brand', productForm.brand);

      if (productForm.sizes) {
        formData.append('sizes', JSON.stringify(productForm.sizes.split(',').map(s => s.trim()).filter(Boolean)));
      }
      if (productForm.colors) {
        formData.append('colors', JSON.stringify(productForm.colors.split(',').map(c => ({ name: c.trim() })).filter(Boolean)));
      }
      if (productForm.badges.length) {
        formData.append('badges', JSON.stringify(productForm.badges));
      }

      // Collect URL images (up to 4)
      const urlList = [
        productForm.imageUrl1,
        productForm.imageUrl2,
        productForm.imageUrl3,
        productForm.imageUrl4,
      ].map(u => u.trim()).filter(Boolean);

      if (urlList.length > 0) {
        if (editingProduct) {
          formData.append('newImageUrls', JSON.stringify(urlList));
        } else {
          formData.append('imageUrls', JSON.stringify(urlList));
        }
      }

      // Append new image files from ProductImageUploader (items with .file property)
      for (const img of prodImages) {
        if (img.file) {
          formData.append('images', img.file);
        }
      }

      // Try-on image file or URL
      if (tryOnImage) {
        formData.append('tryOnImage', tryOnImage);
      }
      if (productForm.tryOnImageUrl) {
        formData.append('tryOnImageUrl', productForm.tryOnImageUrl);
      }

      // Deleted image public IDs
      if (deleteImageIds.length > 0) {
        formData.append('deleteImageIds', JSON.stringify(deleteImageIds));
      }

      if (editingProduct) {
        const res = await sellerService.updateSellerProduct(editingProduct._id, formData);
        setProducts(prev => prev.map(p => p._id === editingProduct._id ? res.product : p));
        toast.success('Product updated successfully!');
      } else {
        const res = await sellerService.createSellerProduct(formData);
        setProducts([res.product, ...products]);
        toast.success('Product submitted for review! It will appear publicly once approved by SVARA Admin.');
      }

      setProductModal(false);
      fetchSellerData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (prodId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await sellerService.deleteSellerProduct(prodId);
      setProducts(prev => prev.filter(p => p._id !== prodId));
      toast.success('Product deleted.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await sellerService.updateSellerProfile(profileForm);
      updateUser(res.user);
      toast.success('Store profile updated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleBadge = (badge) => {
    setProductForm(prev => {
      const exists = prev.badges.includes(badge);
      return {
        ...prev,
        badges: exists ? prev.badges.filter(b => b !== badge) : [...prev.badges, badge],
      };
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-burgundy-500">Seller Studio</span>
          <h1 className="section-heading text-3xl font-bold">{user?.businessName || 'Atelier'} Studio</h1>
          <p className="text-xs text-charcoal-400 mt-1">Manage designs, track sales, and monitor net revenue</p>
        </div>
        <Button variant="primary" size="sm" onClick={openNewProductModal}>
          <Plus size={14} />
          <span>+ Add Design</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <SellerSidebar activeSection={activeSection} onSelectSection={setActiveSection} />
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3 space-y-8">
          {loading ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* SECTION 1: DASHBOARD OVERVIEW */}
              {activeSection === 'dashboard' && (
                <div className="space-y-8">
                  {/* Real Stats Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard
                      title="Gross Sales"
                      value={formatPrice(stats?.totalSales || 0)}
                      icon={TrendingUp}
                    />
                    <StatCard
                      title="SVARA Commission"
                      value={formatPrice(stats?.totalCommission || 0)}
                      icon={DollarSign}
                    />
                    <StatCard
                      title="Net Seller Revenue"
                      value={formatPrice(stats?.sellerRevenue || 0)}
                      icon={CheckCircle}
                    />
                    <StatCard
                      title="Products Sold"
                      value={stats?.productsSold || 0}
                      icon={ShoppingBag}
                    />
                    <StatCard
                      title="Active Catalog Styles"
                      value={stats?.activeProducts || 0}
                      icon={Package}
                    />
                    <StatCard
                      title="Pending Approvals"
                      value={stats?.pendingProducts || 0}
                      icon={Clock}
                    />
                  </div>

                  {/* Recent Sales Activity */}
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-bold text-charcoal-700">Recent Customer Purchases</h3>
                    <div className="glass rounded-3xl overflow-hidden border border-white/60">
                      {recentSales.length === 0 ? (
                        <div className="p-8 text-center text-xs text-charcoal-400">
                          No customer orders placed yet for your catalog.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-charcoal-600">
                            <thead className="bg-white/40 uppercase tracking-wider text-[10px] text-charcoal-400 border-b border-ivory-300/40">
                              <tr>
                                <th className="p-4">Order #</th>
                                <th className="p-4">Product</th>
                                <th className="p-4">Qty</th>
                                <th className="p-4">Gross</th>
                                <th className="p-4">Commission</th>
                                <th className="p-4">Your Revenue</th>
                                <th className="p-4">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ivory-200/40">
                              {recentSales.map((sale, i) => (
                                <tr key={i} className="hover:bg-white/30">
                                  <td className="p-4 font-mono font-bold text-charcoal-700">{sale.orderNumber}</td>
                                  <td className="p-4 font-semibold">{sale.productName}</td>
                                  <td className="p-4">{sale.quantity}</td>
                                  <td className="p-4 font-bold text-charcoal-700">{formatPrice(sale.subtotal)}</td>
                                  <td className="p-4 text-burgundy-600 font-medium">-{formatPrice(sale.commission)}</td>
                                  <td className="p-4 font-bold text-emerald-600">{formatPrice(sale.netRevenue)}</td>
                                  <td className="p-4 text-charcoal-400">{formatDate(sale.date)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: MY PRODUCTS */}
              {activeSection === 'products' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl font-bold text-charcoal-700">Catalog Inventory</h3>
                      <p className="text-xs text-charcoal-400">Manage designs, stock inventory, image galleries, and pricing</p>
                    </div>
                    <Button variant="primary" size="sm" onClick={openNewProductModal}>
                      <Plus size={14} />
                      <span>Add Product</span>
                    </Button>
                  </div>

                  {/* Product Inventory Filters */}
                  <div className="glass p-3 rounded-2xl border border-white/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <input
                      type="text"
                      placeholder="Search design by title..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="input-field text-xs py-2 w-full"
                    />
                    <select
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value)}
                      className="input-field text-xs py-2 w-full font-medium"
                    >
                      <option value="">All Stock Levels</option>
                      <option value="inStock">In Stock (≥5 units)</option>
                      <option value="lowStock">Low Stock (&lt;5 units)</option>
                      <option value="outOfStock">Out of Stock (0 units)</option>
                    </select>
                  </div>

                  <div className="glass rounded-3xl overflow-hidden border border-white/60">
                    {(() => {
                      const filtered = products.filter((p) => {
                        if (searchProduct && !p.name?.toLowerCase().includes(searchProduct.toLowerCase())) return false;
                        if (stockFilter === 'inStock' && (p.stock || 0) < 5) return false;
                        if (stockFilter === 'lowStock' && ((p.stock || 0) <= 0 || (p.stock || 0) >= 5)) return false;
                        if (stockFilter === 'outOfStock' && (p.stock || 0) > 0) return false;
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-12 text-center space-y-3">
                            <Package size={32} className="mx-auto text-charcoal-300" />
                            <p className="text-xs text-charcoal-500 font-medium">No designs match your filters.</p>
                            <Button variant="outline" size="sm" onClick={() => { setSearchProduct(''); setStockFilter(''); }}>
                              Clear Filters
                            </Button>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-charcoal-600">
                            <thead className="bg-white/40 uppercase tracking-wider text-[10px] text-charcoal-400 border-b border-ivory-300/40">
                              <tr>
                                <th className="p-4">Design</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Price</th>
                                <th className="p-4">Stock</th>
                                <th className="p-4">Images</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ivory-200/40">
                              {filtered.map((p) => (
                                <tr key={p._id} className="hover:bg-white/30">
                                  <td className="p-4 flex items-center gap-3">
                                    <img
                                      src={p.images?.[0]?.url || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=200'}
                                      alt=""
                                      className="w-10 h-12 object-cover rounded-lg bg-ivory-200 flex-shrink-0"
                                    />
                                    <div>
                                      <span className="font-semibold text-charcoal-700 block">{p.name}</span>
                                      {p.badges?.length > 0 && (
                                        <div className="flex gap-1 mt-0.5">
                                          {p.badges.map(b => (
                                            <span key={b} className="text-[9px] px-1.5 py-0.2 rounded bg-champagne-100 text-champagne-700 font-bold uppercase">
                                              {b}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4">{p.category?.name || 'Standard'}</td>
                                  <td className="p-4 font-bold text-charcoal-700">{formatPrice(p.price)}</td>
                                  <td className="p-4">
                                    <button
                                      type="button"
                                      onClick={() => openQuickStockModal(p)}
                                      className="hover:underline font-medium text-left"
                                      title="Click to update inventory"
                                    >
                                      {p.stock <= 0 ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                          Out of Stock (0)
                                        </span>
                                      ) : p.stock < 5 ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                          Low Stock ({p.stock})
                                        </span>
                                      ) : (
                                        <span className="text-charcoal-700">{p.stock} units</span>
                                      )}
                                    </button>
                                  </td>
                                  <td className="p-4 font-mono font-bold text-charcoal-500">{p.images?.length || 0}/4</td>
                                  <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      p.status === 'approved'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : p.status === 'pending'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {p.status || 'approved'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right space-x-2">
                                    <button
                                      onClick={() => openQuickStockModal(p)}
                                      className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 text-[11px] font-semibold"
                                      title="Update Stock"
                                    >
                                      Stock
                                    </button>
                                    <button
                                      onClick={() => openEditProductModal(p)}
                                      className="p-1.5 rounded-lg text-charcoal-500 hover:bg-white/80"
                                      title="Edit Product"
                                    >
                                      <Edit3 size={15} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(p._id)}
                                      className="p-1.5 rounded-lg text-burgundy-500 hover:bg-rose-50"
                                      title="Delete Product"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* SECTION 3: CUSTOMER ORDERS */}
              {activeSection === 'orders' && (
                <div className="space-y-6">
                  <h3 className="font-display text-xl font-bold text-charcoal-700">Customer Orders</h3>
                  <div className="glass rounded-3xl overflow-hidden border border-white/60">
                    {orders.length === 0 ? (
                      <div className="p-12 text-center text-xs text-charcoal-400">
                        No orders have been placed for your store yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-charcoal-600">
                          <thead className="bg-white/40 uppercase tracking-wider text-[10px] text-charcoal-400 border-b border-ivory-300/40">
                            <tr>
                              <th className="p-4">Order #</th>
                              <th className="p-4">Items</th>
                              <th className="p-4">Order Total</th>
                              <th className="p-4">Commission</th>
                              <th className="p-4">Your Revenue</th>
                              <th className="p-4">Payment</th>
                              <th className="p-4">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ivory-200/40">
                            {orders.map((o) => (
                              <tr key={o._id} className="hover:bg-white/30">
                                <td className="p-4 font-mono font-bold text-charcoal-700">{o.orderNumber}</td>
                                <td className="p-4">
                                  <div className="space-y-1">
                                    {o.items.map((item, idx) => (
                                      <div key={idx} className="text-[11px]">
                                        <span className="font-semibold">{item.name}</span> × {item.quantity}
                                        <span className="ml-2 text-charcoal-400">{item.fulfillmentStatus || o.orderStatus}</span>
                                        {item.trackingNumber && <span className="ml-2 text-charcoal-400">{item.courier}: {item.trackingNumber}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-4 font-bold text-charcoal-700">{formatPrice(o.sellerSubtotal)}</td>
                                <td className="p-4 text-burgundy-600 font-medium">-{formatPrice(o.sellerCommissionTotal)}</td>
                                <td className="p-4 font-bold text-emerald-600">{formatPrice(o.sellerRevenueTotal)}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    o.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {o.paymentStatus}
                                  </span>
                                </td>
                                <td className="p-4 text-charcoal-400">{formatDate(o.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 4: SALES & REVENUE (ITEMIZED) */}
              {activeSection === 'sales' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-display text-xl font-bold text-charcoal-700">Itemized Sales & Commission Ledger</h3>
                    <p className="text-xs text-charcoal-400">Historical snapshots of actual sales, deducted commissions, and net earnings</p>
                  </div>

                  <div className="glass rounded-3xl overflow-hidden border border-white/60">
                    {sales.length === 0 ? (
                      <div className="p-12 text-center text-xs text-charcoal-400">
                        No sales transactions recorded yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-charcoal-600">
                          <thead className="bg-white/40 uppercase tracking-wider text-[10px] text-charcoal-400 border-b border-ivory-300/40">
                            <tr>
                              <th className="p-4">Product</th>
                              <th className="p-4">Qty</th>
                              <th className="p-4">Gross Sale</th>
                              <th className="p-4">Commission %</th>
                              <th className="p-4">SVARA Deduction</th>
                              <th className="p-4">Net Seller Revenue</th>
                              <th className="p-4">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ivory-200/40">
                            {sales.map((sale, i) => (
                              <tr key={i} className="hover:bg-white/30">
                                <td className="p-4 font-semibold text-charcoal-700">{sale.productName}</td>
                                <td className="p-4">{sale.quantity}</td>
                                <td className="p-4 font-bold text-charcoal-700">{formatPrice(sale.grossSale)}</td>
                                <td className="p-4 font-mono">{sale.commissionRate}%</td>
                                <td className="p-4 text-burgundy-600 font-medium">-{formatPrice(sale.commissionAmount)}</td>
                                <td className="p-4 font-bold text-emerald-600">{formatPrice(sale.netRevenue)}</td>
                                <td className="p-4 text-charcoal-400">{formatDate(sale.date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 5: STORE PROFILE */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <h3 className="font-display text-xl font-bold text-charcoal-700">Store Profile & Business Details</h3>
                  <div className="glass rounded-3xl p-6 sm:p-8 border border-white/60">
                    <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
                      <Input
                        label="Store / Atelier Name"
                        value={profileForm.businessName}
                        onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })}
                        required
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Contact Phone"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        />
                        <Input
                          label="GST / Business Number"
                          value={profileForm.gstNumber}
                          onChange={(e) => setProfileForm({ ...profileForm, gstNumber: e.target.value })}
                        />
                      </div>

                      <Input
                        label="Registered Business Address"
                        value={profileForm.businessAddress}
                        onChange={(e) => setProfileForm({ ...profileForm, businessAddress: e.target.value })}
                      />

                      <div>
                        <label className="text-xs uppercase font-medium text-charcoal-400 mb-1 block">Atelier Bio / Description</label>
                        <textarea
                          rows={4}
                          className="input-field py-2 text-xs w-full"
                          value={profileForm.sellerDescription}
                          onChange={(e) => setProfileForm({ ...profileForm, sellerDescription: e.target.value })}
                          placeholder="Describe your design heritage and craftsmanship..."
                        />
                      </div>

                      <Button type="submit" variant="primary" loading={savingProfile}>
                        Save Store Settings
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Product Create/Edit Modal with Max 4 Images & Badges */}
      <Modal
        isOpen={productModal}
        onClose={() => setProductModal(false)}
        title={editingProduct ? 'Edit Atelier Design' : 'Add New Atelier Design'}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          <Input
            label="Product Name"
            value={productForm.name}
            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (INR) *"
              type="number"
              min="0"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              required
            />
            <Input
              label="Stock Quantity *"
              type="number"
              min="0"
              value={productForm.stock}
              onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase font-medium text-charcoal-400 mb-1 block">Category *</label>
            <select
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              className="input-field py-2 text-xs w-full"
              required
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Sizes (Comma separated)"
              placeholder="XS, S, M, L, XL or 28, 30"
              value={productForm.sizes}
              onChange={(e) => setProductForm({ ...productForm, sizes: e.target.value })}
            />
            <Input
              label="Colors (Comma separated)"
              placeholder="Ivory, Emerald, Gold"
              value={productForm.colors}
              onChange={(e) => setProductForm({ ...productForm, colors: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Material"
              placeholder="Mulberry Silk, Italian Leather"
              value={productForm.material}
              onChange={(e) => setProductForm({ ...productForm, material: e.target.value })}
            />
            <Input
              label="Brand / Designer"
              value={productForm.brand}
              onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs uppercase font-medium text-charcoal-400 mb-1 block">Description</label>
            <textarea
              rows={3}
              className="input-field py-2 text-xs w-full"
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              placeholder="Detailed product story, drape, and care..."
            />
          </div>

          {/* Badges Selection */}
          <div>
            <label className="text-xs uppercase font-medium text-charcoal-400 mb-1.5 block">Product Badges</label>
            <div className="flex flex-wrap gap-2">
              {['SALE', 'TRENDING', 'NEW', 'FEATURED'].map((badge) => {
                const isSelected = productForm.badges.includes(badge);
                return (
                  <button
                    key={badge}
                    type="button"
                    onClick={() => toggleBadge(badge)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-champagne-600 text-white shadow-sm'
                        : 'bg-ivory-200/80 text-charcoal-500 hover:bg-ivory-300'
                    }`}
                  >
                    {badge}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Existing Images when Editing */}
          {editingProduct && editingProduct.images?.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs uppercase font-medium text-charcoal-400 block">Current Images ({editingProduct.images.length}/4)</label>
              <div className="flex gap-2 flex-wrap">
                {editingProduct.images.map((img, idx) => {
                  const isMarkedDelete = deleteImageIds.includes(img.public_id);
                  return (
                    <div key={idx} className="relative group w-16 h-20 rounded-lg overflow-hidden border border-ivory-300">
                      <img src={img.url} alt="" className={`w-full h-full object-cover ${isMarkedDelete ? 'opacity-30' : ''}`} />
                      {img.public_id && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteImageIds(prev =>
                              isMarkedDelete ? prev.filter(id => id !== img.public_id) : [...prev, img.public_id]
                            );
                          }}
                          className={`absolute top-1 right-1 p-1 rounded-full text-[10px] ${
                            isMarkedDelete ? 'bg-emerald-600 text-white' : 'bg-burgundy-600 text-white'
                          }`}
                        >
                          {isMarkedDelete ? 'Keep' : '×'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Images — Visual Box Uploader */}
          <div className="space-y-3 pt-2 border-t border-ivory-300/40">
            <label className="text-xs uppercase font-bold text-charcoal-600 block">
              Product Images (Up to 4)
            </label>
            <ProductImageUploader
              images={prodImages}
              onChange={setProdImages}
              maxImages={4}
            />
          </div>

          {/* Clean Garment Try-On Image */}
          <div className="space-y-2 pt-2 border-t border-ivory-300/40">
            <label className="text-xs uppercase font-medium text-charcoal-400 block">
              Virtual Try-On Garment Image (Clean cutout for AI Try-On)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setTryOnImage(e.target.files[0])}
              className="text-xs w-full mb-1"
            />
            <Input
              placeholder="Or Try-On Garment Image URL"
              value={productForm.tryOnImageUrl}
              onChange={(e) => setProductForm({ ...productForm, tryOnImageUrl: e.target.value })}
            />
          </div>

          <Button type="submit" variant="primary" loading={savingProduct} className="w-full justify-center mt-4">
            {editingProduct ? 'Save Design Changes' : 'Submit Design to SVARA'}
          </Button>
        </form>
      </Modal>

      {/* Quick Stock Update Modal */}
      <Modal
        isOpen={quickStockModal.isOpen}
        onClose={() => setQuickStockModal({ isOpen: false, product: null, stock: 0, variants: [] })}
        title={`Update Stock: ${quickStockModal.product?.name}`}
      >
        <form onSubmit={handleQuickStockUpdate} className="space-y-4 text-xs">
          <p className="text-charcoal-500">
            Directly update your available inventory. Under 5 units shows a low-stock alert to customers; 0 units prevents ordering.
          </p>

          <Input
            label="Total Available Stock (Units) *"
            type="number"
            min="0"
            required
            value={quickStockModal.stock}
            onChange={(e) => setQuickStockModal((prev) => ({ ...prev, stock: Number(e.target.value) }))}
          />

          {quickStockModal.variants && quickStockModal.variants.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-ivory-200">
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700">
                Size Variant Breakdown
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {quickStockModal.variants.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-ivory-50 p-2 rounded-xl">
                    <span className="font-bold text-charcoal-800 uppercase">{v.size}</span>
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => {
                        const newStock = Number(e.target.value) || 0;
                        const newVariants = [...quickStockModal.variants];
                        newVariants[idx] = { ...newVariants[idx], stock: newStock };
                        const sumStock = newVariants.reduce((sum, item) => sum + (item.stock || 0), 0);
                        setQuickStockModal((prev) => ({ ...prev, variants: newVariants, stock: sumStock }));
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
              onClick={() => setQuickStockModal({ isOpen: false, product: null, stock: 0, variants: [] })}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updatingStock}>
              Save Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
