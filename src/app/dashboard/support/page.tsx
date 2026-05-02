'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, MessageSquare, Phone, Users, Store, ShoppingCart, Plus, Trash2, Loader2, AlertTriangle, UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import styles from '../dashboard.module.css'; // Re-use common dashboard styles if available, or write inline.

type Tab = 'orders' | 'customers' | 'vendors' | 'settings';

export default function SupportDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('orders');
  const [profile, setProfile] = useState<any>(null);
  const [teamRole, setTeamRole] = useState<string>('');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [supportNumbers, setSupportNumbers] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);

  const [numberForm, setNumberForm] = useState({ phone: '', name: 'Support Line', is_whatsapp: true });
  const [agentForm, setAgentForm] = useState({ email: '' });

  const fetchDashboardData = useCallback(async (universityId: string) => {
    try {
      const res = await fetch('/api/support', { method: 'POST', body: JSON.stringify({ action: 'get_dashboard_data', universityId }) });
      const d = await res.json();
      if (d.success) {
        setOrders(d.orders);
        setVendors(d.vendors);
        setCustomers(d.customers);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchSettings = useCallback(async (universityId: string) => {
    try {
      const res = await fetch('/api/support', { method: 'POST', body: JSON.stringify({ action: 'get_settings', universityId }) });
      const d = await res.json();
      if (d.success) {
        setSupportNumbers(d.supportNumbers || []);
        setTeam(d.team || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/auth/login');

      const { data: userProfile } = await supabase.from('users').select('*, universities(*)').eq('id', session.user.id).single();
      setProfile(userProfile);

      if (!userProfile?.university_id && userProfile?.role !== 'admin') {
        alert("You are not assigned to a university.");
        return router.replace('/');
      }

      // Check role
      if (userProfile.role !== 'admin') {
         const { data: teamCheck } = await supabase
           .from('university_teams')
           .select('role')
           .eq('university_id', userProfile.university_id)
           .eq('member_id', session.user.id)
           .single();
         
         if (!teamCheck || !['User Support', 'customer_support_agent', 'Campus Admin'].includes(teamCheck.role)) {
            alert("Unauthorized. You are not a Customer Support Agent.");
            return router.replace('/');
         }
         setTeamRole(teamCheck.role);
      } else {
         setTeamRole('admin');
      }

      const uniId = userProfile.university_id || null;
      if (uniId) {
        await Promise.all([fetchDashboardData(uniId), fetchSettings(uniId)]);
      }
      setLoading(false);
    };
    init();
  }, [router, fetchDashboardData, fetchSettings]);

  const apiAction = async (action: string, payload: any) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        body: JSON.stringify({ action, universityId: profile?.university_id, ...payload })
      });
      const d = await res.json();
      if (!d.success) alert(d.error || 'Action failed');
      else await fetchSettings(profile.university_id);
    } catch (e) {
      alert('Network error');
    }
    setActionLoading(false);
  };

  const isHead = ['User Support', 'Campus Admin', 'admin'].includes(teamRole);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-100)' }}><Loader2 className="anim-spin" size={32} color="var(--primary)" /></div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-100)', color: '#fff' }}>
      <header style={{ padding: '1.5rem 2rem', background: 'var(--bg-200)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.5rem' }}>
            <ShieldCheck color="var(--primary)" /> Customer Service Desk
          </h1>
          <p style={{ color: 'var(--text-300)', margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>{profile?.universities?.name} • Role: {teamRole}</p>
        </div>
        <Link href="/" className="btn btn-ghost"><ArrowLeft size={16} /> Exit Dashboard</Link>
      </header>

      <div style={{ display: 'flex', padding: '2rem', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <aside style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { id: 'orders', label: 'Recent Orders', icon: ShoppingCart },
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'vendors', label: 'Vendors Directory', icon: Store },
            ...(isHead ? [{ id: 'settings', label: 'Queue Settings', icon: Phone }] : [])
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setTab(t.id as Tab)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: tab === t.id ? 'var(--primary)' : 'transparent', color: tab === t.id ? '#000' : 'var(--text-200)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, textAlign: 'left' }}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </aside>

        <main style={{ flex: 1, background: 'var(--bg-200)', borderRadius: '12px', border: '1px solid var(--border)', padding: '2rem' }}>
          
          {tab === 'orders' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>Recent Orders (Dispute Resolution)</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-400)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem 0' }}>Order ID</th>
                    <th>Customer</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem 0', color: 'var(--text-300)' }}>#{o.id.slice(0, 8)}</td>
                      <td>{o.users?.name || o.users?.email}<br/><span style={{fontSize:'0.75rem',color:'var(--text-400)'}}>{o.users?.phone || 'No phone'}</span></td>
                      <td>{o.brands?.name}<br/><span style={{fontSize:'0.75rem',color:'var(--text-400)'}}>{o.brands?.phone || 'No phone'}</span></td>
                      <td><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', background: o.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', color: o.status === 'paid' ? '#10b981' : '#fff' }}>{o.status}</span></td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>₦{Number(o.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-400)' }}>No orders found</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'customers' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>Customer Directory</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-400)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem 0' }}>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem 0', fontWeight: 600 }}>{c.name || 'Anonymous'}</td>
                      <td>{c.email}</td>
                      <td>{c.phone || 'N/A'}</td>
                      <td><span style={{ color: c.status === 'active' ? '#10b981' : '#ef4444' }}>{c.status || 'active'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'vendors' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>Vendor Directory</h2>
              <p style={{ color: 'var(--text-300)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>Read-only view for contacting vendors regarding customer complaints.</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-400)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem 0' }}>Brand Name</th>
                    <th>Owner Email</th>
                    <th>Support Phone (WhatsApp)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem 0', fontWeight: 600 }}>{v.name}</td>
                      <td>{v.users?.email}</td>
                      <td>{v.whatsapp_number || 'N/A'}</td>
                      <td>
                        {v.whatsapp_number && (
                           <a href={`https://wa.me/${v.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#10b981' }}>
                             <MessageSquare size={14} /> Message
                           </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'settings' && isHead && (
            <div>
              <div style={{ marginBottom: '3rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>Support Numbers Queue</h2>
                <p style={{ color: 'var(--text-300)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Configure the phone numbers customers will cycle through when they request support.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {supportNumbers.map((num, i) => (
                     <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-300)', padding: '1rem', borderRadius: '8px' }}>
                        <div>
                           <div style={{ fontWeight: 600 }}>{num.name}</div>
                           <div style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>{num.phone} • {num.is_whatsapp ? 'WhatsApp Enabled' : 'Calls Only'}</div>
                        </div>
                        <button className="btn btn-icon text-red" onClick={() => apiAction('update_numbers', { numbers: supportNumbers.filter((_, idx) => idx !== i) })}><Trash2 size={16} /></button>
                     </div>
                  ))}
                  {supportNumbers.length === 0 && <div style={{ color: 'var(--text-400)' }}>No support numbers configured.</div>}
                </div>

                <div style={{ background: 'var(--bg-300)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)', maxWidth: '500px' }}>
                   <h4 style={{ marginBottom: '1rem' }}>Add New Number</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <input className="form-input" placeholder="Agent Name / Title" value={numberForm.name} onChange={e => setNumberForm({...numberForm, name: e.target.value})} />
                      <input className="form-input" placeholder="Phone Number (e.g. +234...)" value={numberForm.phone} onChange={e => setNumberForm({...numberForm, phone: e.target.value})} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                         <input type="checkbox" checked={numberForm.is_whatsapp} onChange={e => setNumberForm({...numberForm, is_whatsapp: e.target.checked})} />
                         Supports WhatsApp Messages
                      </label>
                      <button className="btn btn-primary" disabled={actionLoading || !numberForm.phone} onClick={() => {
                        apiAction('update_numbers', { numbers: [...supportNumbers, numberForm] });
                        setNumberForm({ phone: '', name: '', is_whatsapp: true });
                      }}>
                         <Plus size={14} /> Add to Queue
                      </button>
                   </div>
                </div>
              </div>

              <div>
                <h2 style={{ marginBottom: '1rem' }}>Customer Support Agents</h2>
                <p style={{ color: 'var(--text-300)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Hire/add users to grant them access to this Customer Service Dashboard.</p>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-400)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem 0' }}>Agent Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem 0', fontWeight: 600 }}>{t.member?.name || 'Unknown'}</td>
                        <td>{t.member?.email}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{t.role === 'customer_support_agent' ? 'Support Agent' : t.role}</span></td>
                        <td>
                          {t.role === 'customer_support_agent' && (
                            <button className="btn btn-ghost text-red" onClick={() => { if(confirm('Fire this agent?')) apiAction('remove_agent', { teamId: t.id }) }}>
                               <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', gap: '1rem', maxWidth: '500px' }}>
                   <input className="form-input" placeholder="User Email Address" value={agentForm.email} onChange={e => setAgentForm({ email: e.target.value })} />
                   <button className="btn btn-primary" disabled={actionLoading || !agentForm.email} onClick={() => {
                      apiAction('add_agent', { email: agentForm.email });
                      setAgentForm({ email: '' });
                   }}>
                      <UserPlus size={14} /> Hire Agent
                   </button>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
