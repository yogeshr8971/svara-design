import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, X, Trash2, Star, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { formatDate } from '../utils/formatDate';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function ReviewsModerationPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await adminService.getAdminReviews();
      setReviews(res.reviews || []);
    } catch {
      toast.error('Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleModerate = async (review, approve) => {
    const reason = approve ? '' : window.prompt('Specify reason for hiding this review:');
    if (!approve && !reason?.trim()) return;

    try {
      await adminService.moderateReview(review._id, approve, reason);
      setReviews((prev) =>
        prev.map((r) => (r._id === review._id ? { ...r, isApproved: approve } : r))
      );
      toast.success(approve ? 'Review approved and published.' : 'Review hidden from marketplace.');
    } catch (err) {
      toast.error('Failed to moderate review.');
    }
  };

  const handleDelete = async (review) => {
    const reason = window.prompt('Provide reason for permanently deleting this review:');
    if (!reason?.trim()) return;

    try {
      await adminService.deleteReview(review._id, reason);
      setReviews((prev) => prev.filter((r) => r._id !== review._id));
      toast.success('Review permanently removed.');
    } catch {
      toast.error('Failed to delete review.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">Customer Product Reviews Moderation</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Audit customer feedback, verified purchaser ratings, and moderate public review visibility.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchReviews}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <MessageSquare size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No Reviews to Moderate</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r._id}
              className="glass-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-500">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-ivory-300'}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-charcoal-800">{r.title || 'Product Feedback'}</span>
                  <span className="text-charcoal-400">· {formatDate(r.createdAt)}</span>
                </div>
                <p className="text-charcoal-600">{r.comment}</p>
                <div className="text-[11px] text-charcoal-400">
                  By: <strong>{r.userId?.name || 'Customer'}</strong> on style{' '}
                  <strong>{r.productId?.name || 'Garment'}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!r.isApproved ? (
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => handleModerate(r, true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check size={12} />
                    <span>Approve</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleModerate(r, false)}
                    className="text-amber-700 border-amber-300"
                  >
                    <X size={12} />
                    <span>Hide</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleDelete(r)}
                  className="text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
