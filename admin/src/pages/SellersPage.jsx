import React, { useState, useEffect } from 'react';
import {
  Store,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  DollarSign,
  Package,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { formatPrice } from '../utils/formatPrice';
import { formatDate } from '../utils/formatDate';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function SellersPage() {
  const [sellers, setSellers] = useState([]);
  const [profileChanges, setProfileChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected seller inspection / status modal
  const [statusModal, setStatusModal] = useState({ isOpen: false, seller: null, status: 'active', reason: '' });
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const [sellersRes, changesRes] = await Promise.all([
        adminService.getSellers({ limit: 100 }),
        adminService.getSellerProfileChanges({ status: 'pending' }).catch(() => ({ requests: [] })),
      ]);
      setSellers(sellersRes.sellers || []);
      setProfileChanges(changesRes.requests || []);
    } catch {
      toast.error('Failed to load sellers directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    const { seller, status, reason } = statusModal;
    if (!seller) return;
    if ((status === 'rejected' || status === 'suspended') && !reason.trim()) {
      return toast.error('A reason is required when suspending or rejecting a seller.');
    }

    try {
      setActionLoading(true);
      await adminService.updateSellerStatus(seller._id, status, reason.trim());
      setSellers((prev) =>
        prev.map((s) => (s._id === seller._id ? { ...s, sellerStatus: status } : s))
      );
      setStatusModal({ isOpen: false, seller: null, status: 'active', reason: '' });
      toast.success(`Seller status updated to "${status}".`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update seller status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewProfileChange = async (reqId, status) => {
    const reason = status === 'rejected' ? window.prompt('Provide rejection reason:') : '';
    if (status === 'rejected' && !reason?.trim()) return;

    try {
      await adminService.reviewSellerProfileChange(reqId, status, reason);
      setProfileChanges((prev) => prev.filter((r) => r._id !== reqId));
      toast.success(`Profile update request ${status}.`);
      fetchSellers();
    } catch (err) {
      toast.error('Failed to review profile change.');
    }
  };

  const filteredSellers = sellers.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = s.name?.toLowerCase().includes(q) || s.businessName?.toLowerCase().includes(q);
      const matchEmail = s.email?.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    if (statusFilter && s.sellerStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">Seller Accounts Directory</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Administer partner merchant onboarding, store credentials, policy suspensions, and revenue analytics.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchSellers}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Pending Profile Updates Banner */}
      {profileChanges.length > 0 && (
        <div className="glass-card p-4 border-l-4 border-l-amber-500 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h3 className="font-bold text-xs text-charcoal-800">
              {profileChanges.length} Pending Seller Profile Revision Requests
            </h3>
          </div>
          <div className="space-y-2">
            {profileChanges.map((req) => (
              <div key={req._id} className="p-3 rounded-xl bg-ivory-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-charcoal-800">{req.sellerId?.businessName || req.sellerId?.name}</span>
                  <p className="text-[10px] text-charcoal-500 mt-0.5">
                    Requested updates: {Object.keys(req.changes || {}).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="xs" onClick={() => handleReviewProfileChange(req._id, 'approved')} className="bg-emerald-600">
                    Approve
                  </Button>
                  <Button variant="danger" size="xs" onClick={() => handleReviewProfileChange(req._id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <input
            type="text"
            placeholder="Search seller by brand or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-8 text-xs py-2"
          />
          <Search size={14} className="absolute left-2.5 top-3 text-charcoal-400" />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field text-xs py-2"
        >
          <option value="">All Seller States</option>
          <option value="active">Active & Verified</option>
          <option value="pending">Pending Admin Onboarding</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredSellers.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <Store size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No Sellers Match Query</h3>
          <p className="text-xs text-charcoal-400">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3.5">Store / Business Brand</th>
                  <th className="p-3.5">Contact Email</th>
                  <th className="p-3.5">Total Styles</th>
                  <th className="p-3.5">Gross Sales</th>
                  <th className="p-3.5">Seller Revenue</th>
                  <th className="p-3.5">Atelier Status</th>
                  <th className="p-3.5 text-right">Account Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {filteredSellers.map((s) => {
                  const statusColors = {
                    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    pending: 'bg-amber-100 text-amber-800 border-amber-200',
                    suspended: 'bg-rose-100 text-rose-800 border-rose-200',
                    rejected: 'bg-charcoal-100 text-charcoal-600 border-charcoal-200',
                  };

                  return (
                    <tr key={s._id} className="hover:bg-ivory-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-charcoal-900">{s.businessName || s.name}</div>
                        <div className="text-[10px] text-charcoal-400">Owner: {s.name}</div>
                      </td>
                      <td className="p-3.5 text-charcoal-600">{s.email}</td>
                      <td className="p-3.5 font-bold text-charcoal-800">{s.productsCount || 0} items</td>
                      <td className="p-3.5 font-bold text-charcoal-900">{formatPrice(s.totalSales || 0)}</td>
                      <td className="p-3.5 font-bold text-emerald-700">{formatPrice(s.sellerRevenue || 0)}</td>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[s.sellerStatus] || 'bg-ivory-200 text-charcoal-700'}`}>
                            {s.sellerStatus || 'pending'}
                          </span>
                          {s.isBlocked && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                              Blocked Account
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.sellerStatus !== 'active' && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => setStatusModal({ isOpen: true, seller: s, status: 'active', reason: '' })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Approve
                            </Button>
                          )}
                          {s.sellerStatus === 'active' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setStatusModal({ isOpen: true, seller: s, status: 'suspended', reason: '' })}
                              className="text-amber-700 border-amber-300 hover:bg-amber-50"
                            >
                              Suspend
                            </Button>
                          )}
                          {s.sellerStatus === 'pending' && (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => setStatusModal({ isOpen: true, seller: s, status: 'rejected', reason: '' })}
                            >
                              Reject
                            </Button>
                          )}

                          {/* Block / Unblock Seller Account */}
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={async () => {
                              try {
                                if (s.isBlocked) {
                                  await adminService.unblockUser(s._id);
                                  toast.success(`Unblocked seller account for ${s.businessName || s.name}`);
                                } else {
                                  const reason = window.prompt(`Reason for blocking seller ${s.businessName || s.name}:`);
                                  await adminService.blockUser(s._id, reason || 'Admin blocked');
                                  toast.success(`Blocked seller account for ${s.businessName || s.name}`);
                                }
                                fetchSellers();
                              } catch (err) {
                                toast.error(err.response?.data?.message || 'Failed to update block status');
                              }
                            }}
                            className={s.isBlocked ? 'text-emerald-700 border-emerald-300' : 'text-amber-700 border-amber-300'}
                            title={s.isBlocked ? 'Unblock Account' : 'Block Account'}
                          >
                            {s.isBlocked ? 'Unblock' : 'Block'}
                          </Button>

                          {/* Delete Seller Account */}
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={async () => {
                              const confirmDel = window.confirm(`Permanently delete seller account ${s.businessName || s.name}? Products and profile will be deactivated while order and financial history are preserved.`);
                              if (!confirmDel) return;
                              try {
                                await adminService.deleteUser(s._id, 'Admin deleted seller');
                                toast.success(`Seller ${s.businessName || s.name} account deleted`);
                                fetchSellers();
                              } catch (err) {
                                toast.error(err.response?.data?.message || 'Failed to delete seller');
                              }
                            }}
                            title="Delete Seller Account"
                          >
                            Delete
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

      {/* Status Transition Modal */}
      <Modal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal({ isOpen: false, seller: null, status: 'active', reason: '' })}
        title={`Update Merchant Status: ${statusModal.seller?.businessName || statusModal.seller?.name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
              Select New Account Status
            </label>
            <select
              value={statusModal.status}
              onChange={(e) => setStatusModal((prev) => ({ ...prev, status: e.target.value }))}
              className="input-field py-2 text-xs"
            >
              <option value="active">Active (Permit catalogue listing & sales)</option>
              <option value="pending">Pending Verification</option>
              <option value="suspended">Suspended (Hide styles from marketplace)</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {(statusModal.status === 'suspended' || statusModal.status === 'rejected') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
                Reason & Policy Notice
              </label>
              <textarea
                rows={3}
                value={statusModal.reason}
                onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain the policy requirement or documentation needed..."
                className="input-field text-xs"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusModal({ isOpen: false, seller: null, status: 'active', reason: '' })}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={actionLoading}>
              Save Status
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
