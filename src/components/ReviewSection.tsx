'use client';
import { useState, useEffect } from 'react';
import { Star, Loader2, User, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './ReviewSection.module.css';

function timeAgo(date: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "m";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "min";
  return Math.floor(seconds) + "s";
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user: {
    full_name: string;
    avatar_url: string;
  }
}

export default function ReviewSection({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [user, setUser] = useState<{ id: string } | null>(null);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:users(full_name, avatar_url)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    
    if (!error) setReviews(data as Review[]);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ? { id: session.user.id } : null);
      fetchReviews();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Please login to review!');
    if (!comment.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      user_id: user.id,
      rating,
      comment
    });

    if (error) {
      alert(error.message);
    } else {
      setComment('');
      setRating(5);
      fetchReviews();
    }
    setSubmitting(false);
  };

  if (loading) return <div className="spinner" />;

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Customer Reviews ({reviews.length})</h3>
        {reviews.length > 0 && (
          <div className={styles.avgBadge}>
            <Star size={14} fill="currentColor" />
            <span>{avgRating} / 5</span>
          </div>
        )}
      </div>

      {/* Submission Form */}
      {user ? (
        <form onSubmit={handleSubmit} className={styles.reviewForm}>
          <div className={styles.starPicker}>
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className={s <= rating ? styles.starActive : styles.starInactive}
              >
                <Star size={24} fill={s <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea
            placeholder="Share your experience with this product..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={styles.textarea}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Post Review</>}
          </button>
        </form>
      ) : (
        <div className={styles.loginNotice}>
          <p>Please log in to leave a review.</p>
        </div>
      )}

      {/* Review List */}
      <div className={styles.reviewList}>
        {reviews.map(review => (
          <div key={review.id} className={styles.reviewCard}>
            <div className={styles.reviewHead}>
              <div className={styles.reviewerAvatar}>
                {review.user?.avatar_url ? (
                  <img src={review.user.avatar_url} alt="" />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className={styles.reviewerInfo}>
                <p className={styles.reviewerName}>{review.user?.full_name || 'Anonymous'}</p>
                <div className={styles.cardStars}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={12} fill={s <= review.rating ? "var(--primary)" : "none"} color={s <= review.rating ? "var(--primary)" : "#444"} />
                  ))}
                  <span className={styles.date}>{timeAgo(review.created_at)} ago</span>
                </div>
              </div>
            </div>
            <p className={styles.reviewComment}>{review.comment}</p>
          </div>
        ))}
        {reviews.length === 0 && <p className={styles.emptyText}>No reviews yet. Be the first to review!</p>}
      </div>
    </div>
  );
}
