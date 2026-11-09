import React, { useState, useEffect } from 'react';
import { FolderTree, ArrowUp, ArrowDown, Save, RefreshCw, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    requiresColor: false,
    requiresSize: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await adminService.getCategories();
      setCategories(res.categories || []);
    } catch {
      toast.error('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const moveCategory = (index, direction) => {
    const nextList = [...categories];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= nextList.length) return;
    const temp = nextList[index];
    nextList[index] = nextList[targetIndex];
    nextList[targetIndex] = temp;
    setCategories(nextList);
  };

  const handleSaveOrder = async () => {
    try {
      setSaving(true);
      const orderList = categories.map((cat, idx) => ({ id: cat._id, order: idx + 1 }));
      await adminService.reorderCategories(orderList);
      toast.success('Shopping stage sequence updated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category order.');
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setActiveCategoryId(null);
    setFormData({
      name: '',
      description: '',
        requiresColor: false,
      requiresSize: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat) => {
    setModalMode('edit');
    setActiveCategoryId(cat._id);
    setFormData({
      name: cat.name || '',
      description: cat.description || '',
      requiresColor: Boolean(cat.curateLook?.rules?.requiresColor),
      requiresSize: Boolean(cat.curateLook?.rules?.requiresSize),
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return toast.error('Category name is required.');
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        curateLook: {
          rules: {
            requiresColor: formData.requiresColor,
            requiresSize: formData.requiresSize,
          },
          displayName: formData.name.trim(),
        },
      };

      if (modalMode === 'add') {
        await adminService.createCategory(payload);
        toast.success(`Category "${payload.name}" created successfully.`);
      } else {
        await adminService.updateCategory(activeCategoryId, payload);
        toast.success(`Category "${payload.name}" updated successfully.`);
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"? If any products exist in this category, deletion will be blocked.`)) {
      return;
    }

    try {
      await adminService.deleteCategory(cat._id);
      toast.success(`Category "${cat.name}" deleted.`);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete category.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">Shopping Stages & Category Sequence</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Manage authoritative categories and Curate Look shopping stages. Changes synchronize instantly across storefront, curate look, and product filters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={openAddModal}>
            <Plus size={14} />
            <span>Add Category</span>
          </Button>
          <Button variant="secondary" size="sm" loading={saving} onClick={handleSaveOrder}>
            <Save size={14} />
            <span>Save Sequence</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCategories}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : categories.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <FolderTree size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No Categories Found</h3>
        </div>
      ) : (
        <div className="glass-card p-6 space-y-4 max-w-4xl">
          <div className="flex items-center justify-between pb-2 border-b border-ivory-200 text-xs text-charcoal-500">
            <span>Authoritative Category List & Curate Look Rules</span>
            <span>Default Selection Rules</span>
          </div>

          <div className="space-y-2.5">
            {categories.map((cat, idx) => (
              <div
                key={cat._id}
                className="p-4 rounded-2xl bg-white border border-ivory-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-burgundy-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-ivory-200 text-charcoal-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-charcoal-800">{cat.name}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-ivory-100 text-charcoal-600 border border-ivory-200">
                        {cat.slug}
                      </span>
                    </div>
                    <div className="text-xs text-charcoal-500 mt-1 flex items-center gap-3">
                      <span>Curate Look Rules:</span>
                      <span className={cat.curateLook?.rules?.requiresColor ? 'text-emerald-700 font-semibold' : 'text-charcoal-400'}>
                        Color: {cat.curateLook?.rules?.requiresColor ? 'Required' : 'None'}
                      </span>
                      <span>•</span>
                      <span className={cat.curateLook?.rules?.requiresSize ? 'text-emerald-700 font-semibold' : 'text-charcoal-400'}>
                        Size: {cat.curateLook?.rules?.requiresSize ? 'Required' : 'None'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCategory(idx, -1)}
                    className="p-1.5 rounded-lg text-charcoal-500 hover:bg-ivory-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === categories.length - 1}
                    onClick={() => moveCategory(idx, 1)}
                    className="p-1.5 rounded-lg text-charcoal-500 hover:bg-ivory-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(cat)}
                    className="p-1.5 rounded-lg text-charcoal-600 hover:bg-ivory-100 ml-1"
                    title="Edit Category & Rules"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    title="Delete Category"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'add' ? 'Add New Category' : `Edit Category: ${formData.name}`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dress, Footwear"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 focus:outline-none focus:border-burgundy-500"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-ivory-200">
            <span className="block text-xs font-bold text-charcoal-700 uppercase tracking-wider">
              Curate Look Selection Rules
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-charcoal-700">
              <input
                type="checkbox"
                checked={formData.requiresColor}
                onChange={(e) => setFormData({ ...formData, requiresColor: e.target.checked })}
                className="rounded border-ivory-300 text-burgundy-600 focus:ring-burgundy-500"
              />
              <span>Requires Color Selection (e.g. Dress, Handbag)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-charcoal-700">
              <input
                type="checkbox"
                checked={formData.requiresSize}
                onChange={(e) => setFormData({ ...formData, requiresSize: e.target.checked })}
                className="rounded border-ivory-300 text-burgundy-600 focus:ring-burgundy-500"
              />
              <span>Requires Size Selection (e.g. Dress, Footwear)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-ivory-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              {modalMode === 'add' ? 'Create Category' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
