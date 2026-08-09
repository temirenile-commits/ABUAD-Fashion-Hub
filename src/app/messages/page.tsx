'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, Phone, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './messages.module.css';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  answered_by_ai?: boolean;
  created_at: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio';
}

interface ChatPartner {
  id: string;
  name: string;
  role: string;
  avatar_url?: string;
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialPartnerId = searchParams.get('vendorId');
  
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activePartner, setActivePartner] = useState<ChatPartner | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'customers'>('chats');
  const [myPhone, setMyPhone] = useState<string>('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [partnerPhone, setPartnerPhone] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  async function fetchVendorCustomers(userId: string, existingBrandId?: string) {
    try {
      let brandId = existingBrandId;
      if (!brandId) {
        const { data: brand } = await supabase.from('brands').select('id').eq('owner_id', userId).single();
        if (!brand) return;
        brandId = brand.id;
      }

      // Get unique customer_ids from orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('customer_id, users:customer_id(id, name, role, avatar_url)')
        .eq('brand_id', brandId);

      if (ordersData) {
        const uniqueCustomers: any[] = [];
        const seen = new Set();
        ordersData.forEach(o => {
          const userObj: any = Array.isArray(o.users) ? o.users[0] : o.users;
          if (userObj && userObj.id && !seen.has(userObj.id)) {
            seen.add(userObj.id);
            uniqueCustomers.push(userObj);
          }
        });
        setCustomers(uniqueCustomers);
      }
    } catch (e) {
      console.error('Failed to fetch customers:', e);
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);
      
      // Fetch conversations
      await fetchConversations(session.user.id);
      
      // Check user role, phone and brand ownership
      const { data: profile } = await supabase.from('users').select('role, phone').eq('id', session.user.id).single();
      const { data: brand } = await supabase.from('brands').select('id').eq('owner_id', session.user.id).single();
      
      if (profile?.phone) {
        setMyPhone(profile.phone);
      }
      
      if (brand || profile?.role === 'vendor') {
        setUserRole('vendor');
        await fetchVendorCustomers(session.user.id, brand?.id);
      } else if (profile) {
        setUserRole(profile.role);
      }
      
      if (initialPartnerId) {
        const { data: p } = await supabase.from('users').select('id, name, role, avatar_url').eq('id', initialPartnerId).single();
        if (p) setActivePartner(p as any);
      }
      
      setLoading(false);
    }
    init();
  }, [initialPartnerId]);

  useEffect(() => {
    if (!user || !activePartner) return;
    
    const partnerId = activePartner.id;
    async function fetchPartnerDetails() {
      setPartnerPhone(null);
      const { data: userData } = await supabase.from('users').select('phone, role').eq('id', partnerId).single();
      if (userData?.phone) {
        setPartnerPhone(userData.phone);
      } else if (userData?.role === 'vendor') {
        const { data: brandData } = await supabase.from('brands').select('whatsapp_number').eq('owner_id', partnerId).single();
        if (brandData?.whatsapp_number) {
          setPartnerPhone(brandData.whatsapp_number);
        }
      }
    }

    fetchPartnerDetails();
    fetchMessages();

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${user.id}` 
      }, (payload: any) => {
        if (payload.new.sender_id === activePartner.id) {
          setMessages(prev => [...prev, payload.new as Message]);
        }
        fetchConversations(user.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activePartner]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function fetchConversations(userId: string) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, name, role, avatar_url), receiver:receiver_id(id, name, role, avatar_url)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    const seen = new Set();
    const chats: any[] = [];
    msgs?.forEach((m: any) => {
      const partner = m.sender_id === userId ? m.receiver : m.sender;
      if (!partner) return;
      if (!seen.has(partner.id)) {
        seen.add(partner.id);
        chats.push({ partner, lastMsg: m });
      }
    });
    setConversations(chats);
  }

  async function fetchMessages() {
    if (!user || !activePartner) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activePartner.id}),and(sender_id.eq.${activePartner.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !activePartner) return;

    const newMsg = {
      sender_id: user.id,
      receiver_id: activePartner.id,
      content: input,
    };

    setMessages(prev => [...prev, { ...newMsg, id: 'temp-' + Date.now(), is_read: false, created_at: new Date().toISOString() } as any]);
    setInput('');

    const { error } = await supabase.from('messages').insert(newMsg);
    if (error) {
      console.error(error);
      alert('Error sending message: ' + (error.message.includes('permission') ? 'Unauthorized (Check RLS)' : error.message));
    } else {
      // Create message notification
      const senderName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
      await supabase.from('notifications').insert({
        user_id: activePartner.id,
        title: `💬 New Message from ${senderName}`,
        content: newMsg.content.substring(0, 100),
        type: 'message',
        link: `/messages?vendorId=${user.id}`
      });

      if (activePartner.role === 'vendor') {
        fetch('/api/ai/auto-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiverId: activePartner.id,
            senderId: user.id,
            content: input
          })
        }).catch(err => console.error('Auto-reply trigger failed', err));
      }
    }
    fetchConversations(user.id);
  };

  const handleMediaUpload = async (file: File) => {
    if (!user || !activePartner) return;
    setUploadingMedia(true);
    try {
      const { uploadFile } = await import('@/lib/storage');
      
      let type: 'image' | 'video' | 'audio' = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const pathName = `chat-media-${type}-${user.id}-${activePartner.id}`;
      const { url, error } = await uploadFile(file, 'brand-assets', pathName);
      
      if (error || !url) {
        alert(error || 'Failed to upload media file');
        return;
      }

      // Send message
      const { data: newMsg, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: activePartner.id,
          content: `[Sent a ${type} attachment]`,
          media_url: url,
          media_type: type
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (newMsg) {
        setMessages(prev => [...prev, newMsg as Message]);
        
        // Notify the partner
        const senderName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
        supabase.from('notifications').insert({
          user_id: activePartner.id,
          type: 'enquiry_reply',
          title: `💬 New Media from ${senderName}`,
          content: `Sent a ${type} attachment.`,
          link: `/messages?vendorId=${user.id}`
        }).then(() => {});
      }
    } catch (e: any) {
      console.error('Media upload fail:', e);
      alert('Failed to send media file');
    } finally {
      setUploadingMedia(false);
    }
  };

  if (!user && !loading) return <div className="container" style={{padding: '4rem', textAlign: 'center'}}><h2>Please login to view messages</h2><Link href="/auth/login" className="btn btn-primary">Login</Link></div>;

  return (
    <div className={`container ${styles.page}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h2>Messages</h2>
            <button 
              onClick={() => setShowPhoneInput(!showPhoneInput)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}
            >
              <Phone size={12} /> {myPhone ? 'Update Phone' : 'Add Phone'}
            </button>
          </div>
          
          {showPhoneInput && (
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-200)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: '0.25rem' }}>
              <input 
                type="text" 
                placeholder="e.g. +234..." 
                value={myPhone}
                onChange={(e) => setMyPhone(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', background: 'var(--bg-100)', border: '1px solid var(--border)', color: '#FFFFFF', borderRadius: '4px' }}
              />
              <button 
                type="button"
                onClick={async () => {
                  if (user) {
                    const { error } = await supabase.from('users').update({ phone: myPhone }).eq('id', user.id);
                    if (!error) {
                      const { data: brand } = await supabase.from('brands').select('id').eq('owner_id', user.id).single();
                      if (brand) {
                        await supabase.from('brands').update({ whatsapp_number: myPhone }).eq('id', brand.id);
                      }
                      alert('Phone number saved!');
                      setShowPhoneInput(false);
                    } else {
                      alert('Failed to save phone number');
                    }
                  }
                }}
                className="btn btn-primary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
              >
                Save
              </button>
            </div>
          )}
        </div>
        
        {userRole === 'vendor' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1rem', padding: '0 0.5rem' }}>
            <button 
              className={`${styles.tabBtn} ${sidebarTab === 'chats' ? styles.tabActive : ''}`}
              onClick={() => setSidebarTab('chats')}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'transparent',
                border: 'none',
                color: sidebarTab === 'chats' ? 'var(--primary)' : 'var(--text-400)',
                borderBottom: sidebarTab === 'chats' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Active Chats
            </button>
            <button 
              className={`${styles.tabBtn} ${sidebarTab === 'customers' ? styles.tabActive : ''}`}
              onClick={() => setSidebarTab('customers')}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'transparent',
                border: 'none',
                color: sidebarTab === 'customers' ? 'var(--primary)' : 'var(--text-400)',
                borderBottom: sidebarTab === 'customers' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              My Customers ({customers.length})
            </button>
          </div>
        )}

        <div className={styles.chatList}>
          {sidebarTab === 'chats' ? (
            <>
              {conversations.map((chat) => (
                <div 
                  key={chat.partner.id} 
                  className={`${styles.chatItem} ${activePartner?.id === chat.partner.id ? styles.chatActive : ''}`}
                  onClick={() => setActivePartner(chat.partner)}
                >
                  {chat.partner.avatar_url ? (
                    <img 
                      src={chat.partner.avatar_url} 
                      alt="" 
                      className={styles.chatAvatar} 
                      style={{ objectFit: 'cover', width: '44px', height: '44px', borderRadius: '50%' }} 
                    />
                  ) : (
                    <div className={styles.chatAvatar}>{chat.partner.name.substring(0, 2).toUpperCase()}</div>
                  )}
                  <div className={styles.chatInfo}>
                    <div className={styles.chatNameRow}>
                      <h4>{chat.partner.name}</h4>
                      <span className={styles.chatTime}>{new Date(chat.lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className={styles.chatPreview}>{chat.lastMsg.content}</p>
                  </div>
                </div>
              ))}
              {conversations.length === 0 && <p className={styles.noChats}>No active conversations</p>}
            </>
          ) : (
            <>
              {customers.map((cust) => (
                <div 
                  key={cust.id} 
                  className={`${styles.chatItem} ${activePartner?.id === cust.id ? styles.chatActive : ''}`}
                  onClick={() => {
                    setActivePartner({ ...cust, role: cust.role || 'customer' });
                    setSidebarTab('chats');
                  }}
                >
                  {cust.avatar_url ? (
                    <img 
                      src={cust.avatar_url} 
                      alt="" 
                      className={styles.chatAvatar} 
                      style={{ objectFit: 'cover', width: '44px', height: '44px', borderRadius: '50%' }} 
                    />
                  ) : (
                    <div className={styles.chatAvatar}>{cust.name.substring(0, 2).toUpperCase()}</div>
                  )}
                  <div className={styles.chatInfo}>
                    <div className={styles.chatNameRow}>
                      <h4>{cust.name}</h4>
                    </div>
                    <p className={styles.chatPreview} style={{ color: 'var(--primary)', fontWeight: 600 }}>Tap to chat</p>
                  </div>
                </div>
              ))}
              {customers.length === 0 && <p className={styles.noChats}>No previous customer orders found</p>}
            </>
          )}
        </div>
      </aside>

      <main className={styles.chatArea}>
        {activePartner ? (
          <>
            <div className={styles.chatHeader}>
              <Link href="/dashboard" className={styles.backBtn}><ArrowLeft size={18} /></Link>
              {activePartner.avatar_url ? (
                <img 
                  src={activePartner.avatar_url} 
                  alt="" 
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginRight: '12px', border: '1px solid var(--border)' }} 
                />
              ) : (
                <div className={styles.chatAvatar} style={{ marginRight: '12px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activePartner.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className={styles.chatTitleInfo}>
                <h3>{activePartner.name}</h3>
                <span>{activePartner.role === 'vendor' ? 'Verified Brand' : 'Customer'}</span>
              </div>
              <div className={styles.headerActions}>
                {partnerPhone ? (
                  <>
                    <a href={`tel:${partnerPhone}`} className="btn btn-ghost btn-sm" title={`Call ${activePartner.name}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#18181B', borderRadius: '50%' }}>
                      <Phone size={15} />
                    </a>
                    <a 
                      href={`https://wa.me/${partnerPhone.replace(/[^0-9]/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-whatsapp btn-sm" 
                      title={`WhatsApp ${activePartner.name}`} 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#000000', border: 'none', width: '32px', height: '32px', borderRadius: '50%' }}
                    >
                      <MessageCircle size={15} />
                    </a>
                  </>
                ) : (
                  <button 
                    type="button"
                    className="btn btn-ghost btn-sm" 
                    title="No phone number provided" 
                    onClick={() => alert(`${activePartner.name} has not set a phone number yet.`)}
                    style={{ opacity: 0.5, width: '32px', height: '32px', background: '#18181B', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Phone size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className={styles.messageScroll} ref={scrollRef}>
              {messages.map((msg) => (
                <div key={msg.id} className={`${styles.messageWrapper} ${msg.sender_id === user.id ? styles.messageSent : styles.messageReceived}`}>
                  <div className={styles.messageBubble} style={{ maxWidth: msg.media_type === 'image' ? '300px' : '450px' }}>
                    {msg.media_url && msg.media_type === 'image' && (
                      <div style={{ marginBottom: '8px', borderRadius: '8px', overflow: 'hidden' }}>
                        <img 
                          src={msg.media_url} 
                          alt="Image Attachment" 
                          style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} 
                          onClick={() => window.open(msg.media_url, '_blank')}
                        />
                      </div>
                    )}

                    {msg.media_url && msg.media_type === 'video' && (
                      <div style={{ marginBottom: '8px', borderRadius: '8px', overflow: 'hidden' }}>
                        <video 
                          src={msg.media_url} 
                          controls 
                          style={{ width: '100%', maxHeight: '250px', borderRadius: '8px' }} 
                        />
                      </div>
                    )}

                    {msg.media_url && msg.media_type === 'audio' && (
                      <div style={{ marginBottom: '8px', padding: '4px' }}>
                        <audio 
                          src={msg.media_url} 
                          controls 
                          style={{ width: '100%', maxWidth: '280px' }} 
                        />
                      </div>
                    )}

                    {(!msg.media_url || msg.content !== `[Sent a ${msg.media_type} attachment]`) && (
                      <p>{msg.content}</p>
                    )}

                    <div className={styles.messageFooter}>
                      {msg.answered_by_ai && <span style={{ color: '#FFFFFF', fontSize: '0.7rem', marginRight: '6px', fontWeight: 'bold' }}>✨ AI</span>}
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.sender_id === user.id && (
                        msg.is_read ? <CheckCheck size={12} className={styles.readIcon} /> : <Check size={12} className={styles.sentIcon} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {uploadingMedia && (
              <div style={{ padding: '0.75rem 1.5rem', background: '#1F1F23', color: 'var(--primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border)' }}>
                <span>Uploading your media attachment...</span>
              </div>
            )}

            <form className={styles.inputArea} onSubmit={sendMessage}>
              <label className={styles.attachBtn} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input 
                  type="file" 
                  hidden 
                  accept="image/*,video/*,audio/*"
                  onChange={async (e) => {
                    if (!e.target.files?.[0]) return;
                    const file = e.target.files[0];
                    await handleMediaUpload(file);
                  }}
                />
                <ImageIcon size={20} />
              </label>
              <input 
                type="text" 
                placeholder="Type a message..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className={styles.textField}
              />
              <button type="submit" className={styles.sendBtn} disabled={!input.trim()}>
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div className={styles.emptyChat}>
            <MessageCircle size={48} />
            <h3>Select a conversation to start chatting</h3>
          </div>
        )}
      </main>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="container" style={{padding: '4rem', textAlign: 'center'}}><h2>Loading messages...</h2></div>}>
      <MessagesContent />
    </Suspense>
  );
}
