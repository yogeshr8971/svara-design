import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, CheckCircle, MessageSquare, ShieldCheck, Edit3, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import * as reviewService from '../../services/reviewService';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatDate';
import toast from 'react-hot-toast';

const MAX_WORDS = 30;
const limitWords = (v) => {
  const w = v.trim().split(/\s+/).filter(Boolean);
  return w.length <= MAX_WORDS ? v : w.slice(0, MAX_WORDS).join(' ');
};

export default function ProductReviews({ productId }) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [userReview, setUserReview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Write / Edit Form state
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const wordCount = (comment || '').trim().split(/\s+/).filter(Boolean).length;

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await reviewService.getProductReviews(productId);
      setReviews(data.reviews || []);
      setSummary(data.ratingsSummary || null);
      setCanReview(Boolean(data.canReview));
      setUserReview(data.userReview || null);

      if (data.userReview) {
        setRating(data.userReview.rating || 5);
        setTitle(data.userReview.title || '');
        setComment(data.userReview.comment || '');
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) fetchReviews();
  }, [productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error('Please select a star rating.');
    if (!comment.trim()) return toast.error('Please share your thoughts in the review comment.');
    if (wordCount > 30) return toast.error('Review must be 30 words or fewer.');

    try {
      setSubmitting(true);
      if (userReview) {
        await reviewService.updateReview(userReview._id, { rating, title, comment });
        toast.success('Your review has been updated!');
      } else {
        await reviewService.createReview(productId, { rating, title, comment });
        toast.success('Thank you for reviewing this piece!');
      }
      setShowForm(false);
      fetchReviews();
    } catch (err) {
      toast.error(err.response?.data?.message || err.readableMessage || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    try {
      await reviewService.deleteReview(reviewId);
      toast.success('Review removed.');
      setUserReview(null);
      setTitle('');
      setComment('');
      fetchReviews();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete review.');
    }
  };

  const handleHelpfulVote = async (reviewId) => {
    if (!user) {
      return toast('Please sign in to vote on reviews.', { icon: '🔒' });
    }
    try {
      const data = await reviewService.voteReviewHelpful(reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r._id === reviewId ? { ...r, helpfulCount: data.helpfulCount } : r
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record vote.');
    }
  };

  const averageRating = summary?.average || 0;
  const totalCount = summary?.count || 0;
  const distribution = summary?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  return (
    <section className="space-y-8 pt-10 border-t border-ivory-300/40">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-champagne-500">
            Patron Feedback
          </span>
          <h2 className="font-display text-2xl font-bold text-charcoal-700">
            Customer Reviews & Ratings
          </h2>
        </div>

        {canReview && !showForm && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <MessageSquare size={14} />
            <span>{userReview ? 'Edit Your Review' : 'Write a Review'}</span>
          </Button>
        )}
      </div>

      {/* Ratings Overview Card */}
      <div className="glass rounded-3xl p-6 sm:p-8 border border-white/60 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Average Score */}
        <div className="text-center md:border-r border-ivory-300/40 md:pr-6 space-y-2">
          <div className="font-display text-5xl font-extrabold text-charcoal-800">
            {averageRating > 0 ? averageRating.toFixed(1) : '—'}
          </div>
          <div className="flex justify-center gap-1 text-amber-400">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={18}
                className={
                  star <= Math.round(averageRating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-ivory-300'
                }
              />
            ))}
          </div>
          <p className="text-xs text-charcoal-400">Based on {totalCount} verified rating{totalCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Rating Bars Breakdown */}
        <div className="md:col-span-2 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars] || 0;
            const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-xs text-charcoal-500">
                <span className="w-12 font-medium flex items-center gap-1">
                  {stars} <Star size={11} className="fill-amber-400 text-amber-400 inline" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-ivory-200 overflow-hidden">
                  <div
                    className="h-full bg-champagne-500 rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-10 text-right text-charcoal-400">{percent}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Form Drawer */}
      {showForm && (
        <div className="glass rounded-3xl p-6 sm:p-8 border border-champagne-300/60 bg-champagne-50/20 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-300/40">
            <h3 className="font-display text-lg font-bold text-charcoal-700">
              {userReview ? 'Update Your Review' : 'Share Your Experience'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-charcoal-400 hover:text-charcoal-600"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Interactive Stars */}
            <div>
              <label className="text-xs uppercase font-bold text-charcoal-500 block mb-1">
                Your Rating
              </label>
              <div className="flex gap-1.5 cursor-pointer">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 focus:outline-none"
                  >
                    <Star
                      size={24}
                      className={
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400 transition-colors'
                          : 'text-ivory-300 transition-colors'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-bold text-charcoal-500 block mb-1">
                Review Headline (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Stunning drape, luxury silk quality"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field py-2 text-xs w-full"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-bold text-charcoal-500 block mb-1">
                Your Review
              </label>
              <textarea
                rows={4}
                placeholder="Describe fit, fabric quality, styling versatility..."
                value={comment}
                onChange={(e) => setComment(limitWords(e.target.value))}
                className="input-field py-2 text-xs w-full"
                required
              />
              <div className="text-[11px] text-charcoal-400 text-right mt-1">
                {wordCount}/30 words
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submitting}>
                Submit Review
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner size="md" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center text-xs text-charcoal-400 space-y-2">
            <MessageSquare size={28} className="mx-auto text-charcoal-300" />
            <p className="font-semibold text-charcoal-600">No reviews yet for this design.</p>
            <p>Be the first verified patron to share your styling feedback.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev) => {
              const isOwner = user && rev.userId?._id === user._id;

              return (
                <div
                  key={rev._id}
                  className="glass rounded-3xl p-6 border border-white/60 space-y-3 shadow-xs"
                >
                  {/* Review Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={13}
                              className={
                                star <= rev.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-ivory-300'
                              }
                            />
                          ))}
                        </div>
                        {rev.title && (
                          <h4 className="font-semibold text-xs text-charcoal-800">
                            {rev.title}
                          </h4>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-charcoal-400">
                        <span className="font-medium text-charcoal-600">
                          {rev.userId?.name || 'Verified Patron'}
                        </span>
                        <span>·</span>
                        <span>{formatDate(rev.createdAt)}</span>
                        {rev.isVerifiedPurchase && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <ShieldCheck size={12} />
                              Verified Purchase
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setShowForm(true);
                            setRating(rev.rating);
                            setTitle(rev.title || '');
                            setComment(rev.comment || '');
                          }}
                          className="p-1.5 rounded-lg text-charcoal-400 hover:text-charcoal-700 hover:bg-white"
                          title="Edit"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteReview(rev._id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Review Comment */}
                  <p className="text-xs text-charcoal-600 leading-relaxed font-light">
                    {rev.comment}
                  </p>

                  {/* Helpful Vote Counter */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-charcoal-400 border-t border-ivory-200/40">
                    <button
                      onClick={() => handleHelpfulVote(rev._id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-white/80 transition-colors"
                    >
                      <ThumbsUp size={12} className="text-champagne-600" />
                      <span>Helpful ({rev.helpfulCount || 0})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
