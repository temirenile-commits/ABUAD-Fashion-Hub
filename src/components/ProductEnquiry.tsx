'use client';
import { useState, useEffect } from 'react';
import { MessageCircle, Send, CheckCircle2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './ProductEnquiry.module.css';

interface Props {
  productId: string;
  productTitle: string;
  vendorId: string;
  vendorName: string;
}

export default function ProductEnquiry({ productId, productTitle, vendorId, vendorName }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    async function checkUser() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession) {
        // Fetch history of enquiries for this product
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentSession.user.id},receiver_id.eq.${vendorId}),and(sender_id.eq.${vendorId},receiver_id.eq.${currentSession.user.id})`)
          .like('content', `%[Enquiry about ${productTitle}]%`)
          .order('created_at', { ascending: true });
        
        setHistory(data || []);
      }
    }
    checkUser();
  }, [productId, vendorId, productTitle]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    if (!session) {
      window.location.href = `/auth/login?returnTo=/product/${productId}`;
      return;
    }

    const { data: newMsg, error: sendError } = await supabase.from('messages').insert({
      sender_id: session.user.id,
      receiver_id: vendorId,
      content: `[Enquiry about ${productTitle}]: ${message}`,
      is_read: false
    }).select().single();

    if (sendError) {
      setError('Failed to send enquiry. Please try again.');
    } else {
      // 🔔 Trigger Notification for Vendor
      try {
        await supabase.from('notifications').insert({
          user_id: vendorId,
          type: 'enquiry_reply',
          title: 'New Product Enquiry',
          content: `Someone is interested in your "${productTitle}" product.`,
          link: `/dashboard/vendor`,
          is_read: false
        });
      } catch (err) {
        console.warn('Notifications table not ready yet, skipping notification insert.');
      }

      setSent(true);
      setHistory(prev => [...prev, newMsg]);
      setMessage('');
      setTimeout(() => setSent(false), 3000); // Reset sent state after 3s
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <MessageCircle size={18} />
        Enquire about this product
      </h3>
      
      {history.length > 0 && (
        <div className={styles.historyList}>
          {history.map((h) => (
            <div key={h.id} className={`${styles.historyItem} ${h.sender_id === session?.user.id ? styles.historySent : styles.historyReceived}`}>
              <div className={styles.historyBubble}>
                <p>{h.content.replace(`[Enquiry about ${productTitle}]: `, '')}</p>
                <span className={styles.historyTime}>{new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {sent ? (
        <div className={styles.sentNotification}>
          <CheckCircle2 size={16} /> Enquiry sent to {vendorName}
        </div>
      ) : (
        <p className={styles.subtitle}>Ask {vendorName} for details, availability, or custom sizes.</p>
      )}
      
      <form onSubmit={handleSend} className={styles.form}>
        <textarea
          className={styles.textarea}
          placeholder={`Hi ${vendorName}, I'm interested in this ${productTitle}. Is it...`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
          required
        />
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading || !message.trim()}>
          <Send size={16} />
          {loading ? 'Sending...' : 'Send Enquiry'}
        </button>
      </form>
    </div>
  );
}
