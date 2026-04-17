'use client';
import { useState, useEffect, useRef } from 'react';
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
  created_at: string;
}

interface ChatPartner {
  id: string;
  name: string;
  role: string;
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const initialPartnerId = searchParams.get('vendorId');
  
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activePartner, setActivePartner] = useState<ChatPartner | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);
      
      // Fetch conversations
      await fetchConversations(session.user.id);
      
      if (initialPartnerId) {
        const { data: p } = await supabase.from('users').select('id, name, role').eq('id', initialPartnerId).single();
        if (p) setActivePartner(p);
      }
      
      setLoading(false);
    }
    init();
  }, [initialPartnerId]);

  useEffect(() => {
    if (!user || !activePartner) return;
    
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
      .select('*, sender:sender_id(id, name), receiver:receiver_id(id, name)')
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
    if (error) console.error(error);
    fetchConversations(user.id);
  };

  if (!user && !loading) return <div className="container" style={{padding: '4rem', textAlign: 'center'}}><h2>Please login to view messages</h2><Link href="/auth/login" className="btn btn-primary">Login</Link></div>;

  return (
    <div className={`container ${styles.page}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Messages</h2>
        </div>
        <div className={styles.chatList}>
          {conversations.map((chat) => (
            <div 
              key={chat.partner.id} 
              className={`${styles.chatItem} ${activePartner?.id === chat.partner.id ? styles.chatActive : ''}`}
              onClick={() => setActivePartner(chat.partner)}
            >
              <div className={styles.chatAvatar}>{chat.partner.name.substring(0, 2).toUpperCase()}</div>
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
        </div>
      </aside>

      <main className={styles.chatArea}>
        {activePartner ? (
          <>
            <div className={styles.chatHeader}>
              <Link href="/dashboard" className={styles.backBtn}><ArrowLeft size={18} /></Link>
              <div className={styles.chatTitleInfo}>
                <h3>{activePartner.name}</h3>
                <span>{activePartner.role === 'vendor' ? 'Verified Brand' : 'Customer'}</span>
              </div>
              <div className={styles.headerActions}>
                <button className="btn btn-ghost btn-sm" title="Call Vendor"><Phone size={15} /></button>
                <button className="btn btn-whatsapp btn-sm" title="WhatsApp Alternative"><MessageCircle size={15} /></button>
              </div>
            </div>

            <div className={styles.messageScroll} ref={scrollRef}>
              {messages.map((msg) => (
                <div key={msg.id} className={`${styles.messageWrapper} ${msg.sender_id === user.id ? styles.messageSent : styles.messageReceived}`}>
                  <div className={styles.messageBubble}>
                    <p>{msg.content}</p>
                    <div className={styles.messageFooter}>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.sender_id === user.id && (
                        msg.is_read ? <CheckCheck size={12} className={styles.readIcon} /> : <Check size={12} className={styles.sentIcon} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form className={styles.inputArea} onSubmit={sendMessage}>
              <button type="button" className={styles.attachBtn}><ImageIcon size={20} /></button>
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
