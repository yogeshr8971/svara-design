import React, { useState, useEffect } from 'react';
import {
  Users, Search, Shield, RefreshCw, Ban, CheckCircle, Trash2,
  UserPlus, AlertTriangle, ShieldAlert, History
} from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { formatDate } from '../utils/formatDate';
import * as adminService from '../services/adminService';
import { useAdminAuth } from '../context/AdminAuthContext';
import toast from 'react-hot-toast';

export default function CustomersPage() {
  const { adminUser } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals state
  const [blockModal, setBlockModal] = useState({ isOpen: false, user: null, reason: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, user: null, reason: '' });
  const [createAdminModal, setCreateAdminModal] = useState(false);
  const [auditLogsModal, setAuditLogsModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // New admin form state
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', phone: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminService.getUsers({ limit: 100, search: search || undefined });
      setUsers(res.users || []);
    } catch {
      toast.error('Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleRoleToggle = async (user) => {
    if (!adminUser?.isRootAdmin) {
      return toast.error('Only the Root Administrator can manage admin roles.');
    }

    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change ${user.name}'s role to "${nextRole}"?`)) return;

    try {
      await adminService.updateUserRole(user._id, nextRole);
      setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, role: nextRole } : u)));
      toast.success(`Role updated to "${nextRole}".`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user role.');
    }
  };

  const handleBlockToggle = async (user) => {
    if (user.isBlocked) {
      if (!window.confirm(`Unblock customer ${user.name}? This will restore account access.`)) return;
      try {
        await adminService.unblockUser(user._id);
        setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, isBlocked: false, blockedReason: '' } : u)));
        toast.success(`Account for ${user.name} unblocked.`);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to unblock account.');
      }
    } else {
      setBlockModal({ isOpen: true, user, reason: '' });
    }
  };

  const confirmBlock = async () => {
    if (!blockModal.user) return;
    try {
      setActionLoading(true);
      await adminService.blockUser(blockModal.user._id, blockModal.reason);
      setUsers((prev) =>
        prev.map((u) =>
          u._id === blockModal.user._id ? { ...u, isBlocked: true, blockedReason: blockModal.reason } : u
        )
      );
      toast.success(`Account for ${blockModal.user.name} has been blocked and sessions revoked.`);
      setBlockModal({ isOpen: false, user: null, reason: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block account.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.user) return;
    try {
      setActionLoading(true);
      await adminService.deleteUser(deleteModal.user._id, deleteModal.reason);
      setUsers((prev) => prev.filter((u) => u._id !== deleteModal.user._id));
      toast.success(`Account ${deleteModal.user.name} safely deleted. Order history preserved.`);
      setDeleteModal({ isOpen: false, user: null, reason: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!adminUser?.isRootAdmin) {
      return toast.error('Only the Root Administrator can create new admins.');
    }
    try {
      setActionLoading(true);
      await adminService.createAdminUser(newAdmin);
      toast.success(`Admin account created for ${newAdmin.email}`);
      setCreateAdminModal(false);
      setNewAdmin({ name: '', email: '', password: '', phone: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin.');
    } finally {
      setActionLoading(false);
    }
  };

  const openAuditLogs = async () => {
    setAuditLogsModal(true);
    setAuditLoading(true);
    try {
      const res = await adminService.getAuditLogs({ limit: 50 });
      setAuditLogs(res.auditLogs || []);
    } catch {
      toast.error('Failed to load audit logs.');
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">Customer Directory</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Manage customer accounts, roles, access permissions, and account governance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {adminUser?.isRootAdmin && (
            <Button variant="primary" size="sm" onClick={() => setCreateAdminModal(true)}>
              <UserPlus size={14} />
              <span>Create Admin</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={openAuditLogs}>
            <History size={14} />
            <span>Audit Logs</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="relative max-w-sm">
          <input
            type="text"
            placeholder="Search customer by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-8 text-xs py-2 w-full"
          />
          <Search size={14} className="absolute left-2.5 top-3 text-charcoal-400" />
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <Users size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No Customers Found</h3>
        </div>
      ) : (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Email Address</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">VTO Credits</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5 text-right">Account Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-ivory-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-charcoal-900">
                      <div className="flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {u.isRootAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                            Root Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-charcoal-700">{u.email}</td>
                    <td className="p-3.5 text-charcoal-600">
                      {u.phone || '—'} {u.phoneVerified && <span className="text-emerald-600">✓</span>}
                    </td>
                    <td className="p-3.5 font-bold text-charcoal-800">{u.credits ?? 0}</td>
                    <td className="p-3.5">
                      {u.isBlocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-max">
                          <Ban size={10} /> Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-max">
                          <CheckCircle size={10} /> Active
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-burgundy-100 text-burgundy-800'
                            : 'bg-ivory-200 text-charcoal-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Role Change (Root Admin only) */}
                        {adminUser?.isRootAdmin && !u.isRootAdmin && (
                          <Button
                            variant={u.role === 'admin' ? 'outline' : 'secondary'}
                            size="xs"
                            onClick={() => handleRoleToggle(u)}
                            title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          >
                            <Shield size={12} />
                            <span>{u.role === 'admin' ? 'Demote' : 'Make Admin'}</span>
                          </Button>
                        )}

                        {/* Block / Unblock */}
                        {!u.isRootAdmin && (
                          <Button
                            variant={u.isBlocked ? 'outline' : 'outline'}
                            size="xs"
                            onClick={() => handleBlockToggle(u)}
                            className={u.isBlocked ? 'text-emerald-700 border-emerald-300' : 'text-amber-700 border-amber-300'}
                          >
                            <Ban size={12} />
                            <span>{u.isBlocked ? 'Unblock' : 'Block'}</span>
                          </Button>
                        )}

                        {/* Delete Account */}
                        {!u.isRootAdmin && (
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => setDeleteModal({ isOpen: true, user: u, reason: '' })}
                            title="Safely delete user account"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block Account Modal */}
      <Modal
        isOpen={blockModal.isOpen}
        onClose={() => setBlockModal({ isOpen: false, user: null, reason: '' })}
        title={`Block Account: ${blockModal.user?.name}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              Blocking this account will immediately revoke all active sessions, clear authentication tokens, and prevent sign-ins, orders, and dashboard access.
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-1">
              Reason for Blocking (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Terms violation, suspicious activity"
              value={blockModal.reason}
              onChange={(e) => setBlockModal({ ...blockModal, reason: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 focus:outline-none focus:border-burgundy-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button variant="outline" size="sm" onClick={() => setBlockModal({ isOpen: false, user: null, reason: '' })}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={actionLoading} onClick={confirmBlock}>
              Confirm Block
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, user: null, reason: '' })}
        title={`Delete Account: ${deleteModal.user?.name}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <div>
              Account deletion will immediately revoke all sessions, remove transient carts/wardrobes, and anonymize user access. Past order history, financial records, and audit trails will be preserved safely.
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-1">
              Reason for Deletion (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Requested account deletion"
              value={deleteModal.reason}
              onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 focus:outline-none focus:border-burgundy-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button variant="outline" size="sm" onClick={() => setDeleteModal({ isOpen: false, user: null, reason: '' })}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={actionLoading} onClick={confirmDelete}>
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Admin Modal */}
      <Modal
        isOpen={createAdminModal}
        onClose={() => setCreateAdminModal(false)}
        title="Create New Administrator"
      >
        <form onSubmit={handleCreateAdmin} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={newAdmin.name}
              onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={newAdmin.email}
              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-1">Temporary Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-1">Phone Number (Optional)</label>
            <input
              type="text"
              value={newAdmin.phone}
              onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-ivory-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateAdminModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={actionLoading}>
              Create Administrator
            </Button>
          </div>
        </form>
      </Modal>

      {/* Audit Logs Modal */}
      <Modal
        isOpen={auditLogsModal}
        onClose={() => setAuditLogsModal(false)}
        title="Administrative Audit Trail"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {auditLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8 text-xs text-charcoal-400">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-ivory-200 text-xs">
              {auditLogs.map((log) => (
                <div key={log._id} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-charcoal-800 uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-ivory-100 border border-ivory-200">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-charcoal-400">{formatDate(log.createdAt)}</span>
                  </div>
                  <div className="text-charcoal-700 mt-1">
                    <span className="font-semibold">{log.adminEmail}</span> performed action on target{' '}
                    <span className="font-semibold">{log.targetModel}</span> ({log.targetId})
                  </div>
                  {log.details && (
                    <div className="text-[11px] text-charcoal-500 mt-0.5 bg-ivory-50 p-2 rounded-lg font-mono">
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
