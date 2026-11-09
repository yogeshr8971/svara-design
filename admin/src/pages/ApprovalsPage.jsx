import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Download,
  Store,
  RefreshCw,
  ZoomIn,
  Truck,
  Filter,
  DollarSign,
  Layers,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { formatPrice } from '../utils/formatPrice';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function ApprovalsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shippingFees, setShippingFees] = useState({}); // { [productId]: number }
  const [rejectModal, setRejectModal] = useState({ isOpen: false, product: null, reason: '' });
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Filters
  const [sellerFilter, setSellerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);

  const fetchPendingProducts = async () => {
    try {
      setLoading(true);
      const [prodsRes, catsRes] = await Promise.all([
        adminService.getAdminProducts({ status: 'pending', limit: 100 }),
        adminService.getCategories(),
      ]);
      const list = prodsRes.products || [];
      setProducts(list);
      setCategories(catsRes.categories || []);

      // Pre-fill existing shipping fees or platform default (99)
      const initialFees = {};
      list.forEach((p) => {
        initialFees[p._id] = p.shippingFee !== null && p.shippingFee !== undefined ? p.shippingFee : 99;
      });
      setShippingFees(initialFees);
    } catch (err) {
      toast.error('Failed to load pending products queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingProducts();
  }, []);

  const handleShippingFeeChange = (prodId, value) => {
    setShippingFees((prev) => ({
      ...prev,
      [prodId]: value,
    }));
  };

  const handleApprove = async (prod) => {
    const fee = Number(shippingFees[prod._id]);
    if (isNaN(fee) || fee < 0) {
      return toast.error('Please assign a valid shipping fee (≥ 0) for this product.');
    }

    try {
      await adminService.approveProduct(prod._id, fee);
      setProducts((prev) => prev.filter((p) => p._id !== prod._id));
      toast.success(`"${prod.name}" approved with ₹${fee} shipping fee.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed.');
    }
  };

  const handleRejectConfirm = async () => {
    const { product, reason } = rejectModal;
    if (!reason.trim()) return toast.error('A correction reason is required when rejecting.');

    try {
      await adminService.rejectProduct(product._id, reason.trim());
      setProducts((prev) => prev.filter((p) => p._id !== product._id));
      setRejectModal({ isOpen: false, product: null, reason: '' });
      toast.success(`"${product.name}" rejected and seller notified.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed.');
    }
  };

  const handleDownloadPhoto = async (prodId, photoIndex = 0) => {
    try {
      const res = await adminService.downloadOriginalPhoto(prodId, photoIndex);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
        toast.success('Original photo download initiated.');
      }
    } catch {
      toast.error('Could not download original photo.');
    }
  };

  const handleBatchApprove = async () => {
    const approvals = products.map((p) => ({
      id: p._id,
      shippingFee: Number(shippingFees[p._id]) || 0,
    }));

    if (approvals.length === 0) return toast.error('No pending products to approve.');

    try {
      setBatchProcessing(true);
      const res = await adminService.batchApproveProducts(approvals);
      const successful = res.results?.filter((r) => r.success) || [];
      const failed = res.results?.filter((r) => !r.success) || [];

      if (successful.length > 0) {
        toast.success(`Batch approved ${successful.length} product(s).`);
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} product(s) could not be approved.`);
      }

      fetchPendingProducts();
    } catch (err) {
      toast.error('Batch approval encountered an error.');
    } finally {
      setBatchProcessing(false);
    }
  };

  // Filtered queue
  const filteredProducts = products.filter((p) => {
    if (sellerFilter && p.sellerId?._id !== sellerFilter && p.sellerId?.businessName?.toLowerCase().indexOf(sellerFilter.toLowerCase()) === -1) {
      return false;
    }
    if (categoryFilter && p.category?._id !== categoryFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="section-heading text-2xl font-bold">Seller Product Approvals</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {products.length} Pending
            </span>
          </div>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Inspect design photographs, variants, verify proposed prices, and assign shipping fees prior to publication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {products.length > 0 && (
            <Button
              variant={batchMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setBatchMode(!batchMode)}
            >
              <Layers size={14} />
              <span>{batchMode ? 'Card Mode' : 'Batch List Mode'}</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchPendingProducts}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      {products.length > 0 && (
        <div className="glass-card p-3 flex flex-wrap items-center gap-3 text-xs">
          <Filter size={15} className="text-charcoal-400" />
          <input
            type="text"
            placeholder="Filter by seller name..."
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="input-field py-1.5 px-3 text-xs w-48"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field py-1.5 px-3 text-xs w-44"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          {(sellerFilter || categoryFilter) && (
            <button
              onClick={() => {
                setSellerFilter('');
                setCategoryFilter('');
              }}
              className="text-xs font-semibold text-burgundy-600 hover:text-burgundy-800"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="font-display text-lg font-bold text-charcoal-700">Approval Queue Empty</h3>
          <p className="text-xs text-charcoal-400 max-w-sm mx-auto">
            All seller-submitted designs have been reviewed. New marketplace submissions will appear here for inspection.
          </p>
        </div>
      ) : batchMode ? (
        /* BATCH LIST MODE (§7) */
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-ivory-200 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-charcoal-800">Batch Review & Fee Assignment</h3>
              <p className="text-xs text-charcoal-400">Review and assign shipping fees to multiple pending products simultaneously.</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={batchProcessing}
              onClick={handleBatchApprove}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check size={14} />
              <span>Approve All ({filteredProducts.length})</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3">Design</th>
                  <th className="p-3">Seller</th>
                  <th className="p-3">Selling Price</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3 w-48">Assigned Shipping Fee (₹)</th>
                  <th className="p-3 text-right">Individual Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {filteredProducts.map((p) => {
                  const seller = p.sellerId;
                  const firstImg = p.images?.[0]?.url || '';
                  const feeValue = shippingFees[p._id] ?? 99;

                  return (
                    <tr key={p._id} className="hover:bg-ivory-50/70">
                      <td className="p-3 flex items-center gap-3">
                        {firstImg && (
                          <img
                            src={firstImg}
                            alt={p.name}
                            className="w-10 h-12 object-cover rounded-lg border border-ivory-300"
                          />
                        )}
                        <div>
                          <p className="font-bold text-charcoal-800 line-clamp-1">{p.name}</p>
                          <p className="text-[10px] text-charcoal-400">{p.category?.name || 'Unassigned'}</p>
                        </div>
                      </td>
                      <td className="p-3 font-medium text-charcoal-700">
                        {seller?.businessName || seller?.name || 'Seller'}
                      </td>
                      <td className="p-3 font-bold text-charcoal-800">{formatPrice(p.price)}</td>
                      <td className="p-3">{p.stock} units</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-charcoal-500">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={feeValue}
                            onChange={(e) => handleShippingFeeChange(p._id, e.target.value)}
                            className="input-field py-1 px-2 text-xs w-28 font-bold text-charcoal-800"
                            placeholder="e.g. 99"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleApprove(p)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Check size={12} />
                            <span>Approve</span>
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => setRejectModal({ isOpen: true, product: p, reason: '' })}
                          >
                            <X size={12} />
                            <span>Reject</span>
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
      ) : (
        /* PRODUCT CARD VIEW (§7) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => {
            const seller = p.sellerId;
            const sellerDisplay = seller?.businessName || seller?.name || 'Independent Seller';
            const images = p.images || [];
            const firstImg = images[0]?.url || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500';
            const feeValue = shippingFees[p._id] ?? 99;

            return (
              <div
                key={p._id}
                className="glass-card overflow-hidden flex flex-col justify-between border-amber-200/80 shadow-sm hover:shadow-md transition-all group"
              >
                {/* Photo Header */}
                <div className="relative aspect-[4/5] bg-ivory-200 overflow-hidden">
                  <img
                    src={firstImg}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-xs flex items-center gap-1">
                      <AlertCircle size={10} /> Pending Review
                    </span>
                  </div>

                  {/* Image Thumbnails & Download buttons */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="bg-charcoal-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-lg text-[10px]">
                      {images.length} Photo{images.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoUrl(firstImg)}
                        className="p-1.5 rounded-lg bg-charcoal-900/80 text-white hover:bg-charcoal-900 transition-colors shadow-xs"
                        title="Enlarge preview"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPhoto(p._id, 0)}
                        className="p-1.5 rounded-lg bg-charcoal-900/80 text-white hover:bg-charcoal-900 transition-colors shadow-xs flex items-center gap-1 text-[10px]"
                        title="Download authorized original photograph (§6)"
                      >
                        <Download size={13} />
                        <span className="hidden sm:inline">Original</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    {/* Seller Banner */}
                    <div className="p-2.5 rounded-xl bg-ivory-100/90 border border-ivory-300 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Store size={14} className="text-burgundy-600 shrink-0" />
                        <span className="font-semibold text-charcoal-800 truncate">{sellerDisplay}</span>
                      </div>
                      <span className="text-[10px] text-charcoal-400 shrink-0">{seller?.email}</span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-charcoal-800 leading-snug">
                        {p.name}
                      </h3>
                      <span className="text-base font-bold text-charcoal-900 whitespace-nowrap">
                        {formatPrice(p.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-charcoal-500">
                      <span className="px-2 py-0.5 rounded bg-ivory-200 font-medium">
                        {p.category?.name || 'Unassigned'}
                      </span>
                      {p.subcategory && <span>· {p.subcategory}</span>}
                      <span>· Stock: <b>{p.stock}</b></span>
                    </div>

                    {p.description && (
                      <p className="text-xs text-charcoal-500 line-clamp-2">{p.description}</p>
                    )}

                    {p.sizes?.length > 0 && (
                      <div className="text-[10px] text-charcoal-500">
                        Sizes: <b>{p.sizes.join(', ')}</b>
                      </div>
                    )}
                  </div>

                  {/* Shipping Fee Input & Approval Controls (§7) */}
                  <div className="pt-3 border-t border-ivory-200 space-y-3">
                    <div className="p-3 rounded-xl bg-ivory-100/70 border border-ivory-300/80 space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal-700 flex items-center gap-1.5">
                        <Truck size={13} className="text-burgundy-600" />
                        <span>Assign Shipping Fee (₹)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={feeValue}
                          onChange={(e) => handleShippingFeeChange(p._id, e.target.value)}
                          className="input-field py-1.5 px-3 text-xs font-bold text-charcoal-800"
                          placeholder="e.g. 99 (0 for Free)"
                        />
                        <span className="text-[10px] text-charcoal-400 whitespace-nowrap">
                          {Number(feeValue) === 0 ? 'Free Shipping' : `+₹${feeValue} to order`}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(p)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs"
                      >
                        <Check size={14} />
                        <span>Approve & Publish</span>
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setRejectModal({ isOpen: true, product: p, reason: '' })}
                        className="px-3 text-xs"
                        title="Reject submission"
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, product: null, reason: '' })}
        title="Reject Seller Product Submission"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-charcoal-500">
            Provide a clear, actionable correction reason so the seller understands what needs to be revised before re-submitting <strong>{rejectModal.product?.name}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
              Correction Reason
            </label>
            <textarea
              rows={4}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Photograph resolution is insufficient; proposed price is higher than standard atelier guidelines; please attach care instructions."
              className="input-field text-xs"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-ivory-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModal({ isOpen: false, product: null, reason: '' })}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRejectConfirm}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Enlarged Photo Modal */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/80 backdrop-blur-xs">
          <div className="relative max-w-3xl w-full bg-white rounded-3xl p-4 overflow-hidden shadow-2xl flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-charcoal-900/70 hover:bg-charcoal-900 text-white transition-colors z-10"
            >
              <X size={20} />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Enlarged design photo"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
