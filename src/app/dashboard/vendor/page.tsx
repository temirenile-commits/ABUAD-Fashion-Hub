'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Truck, CheckCircle, Wallet, Settings, TrendingUp, AlertTriangle, Loader2, MessageCircle, Video, Upload, Info, ShoppingCart, BarChart3, CreditCard, Star, Scissors, Image as ImageIcon, Clock, Zap, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './dashboard.module.css';

export default function VendorDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    category: 'Clothing',
    stockCount: '10',
    mediaUrls: [] as string[]
  });

  useEffect(() => {
    async function fetchVendorData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/vendor');
        return;
      }

      // Fetch Brand
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('owner_id', session.user.id)
        .single();

      if (brandError || !brandData) {
        // If they don't have a brand yet, maybe redirect to onboarding?
        router.push('/onboarding');
        return;
      }
      setBrand(brandData);

      // Fetch Orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          products (title)
        `)
        .eq('brand_id', brandData.id)
        .order('created_at', { ascending: false });

      setOrders(ordersData || []);

      // Fetch Transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('brand_id', brandData.id)
        .order('created_at', { ascending: false });

      setTransactions(txData || []);
      // Fetch Enquiries
      const { data: enqData } = await supabase
        .from('messages')
        .select('*, sender:sender_id(name)')
        .eq('receiver_id', session.user.id)
        .order('created_at', { ascending: false });

      setEnquiries(enqData || []);

      // Fetch Reels
      const { data: reelData } = await supabase
        .from('brand_reels')
        .select('*')
        .eq('brand_id', brandData.id)
        .order('created_at', { ascending: false });

      setReels(reelData || []);

      setLoading(false);
    }

    fetchVendorData();
  }, [router]);

  const fetchProducts = async (brandId: string) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });
    setProducts(data || []);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    setLoading(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          brandId: brand.id,
          ownerId: brand.owner_id
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsAddingProduct(false);
        setNewProduct({
          title: '',
          description: '',
          price: '',
          originalPrice: '',
          category: 'Clothing',
          stockCount: '10',
          mediaUrls: []
        });
        await fetchProducts(brand.id);
        alert('Product listed successfully!');
      } else {
        alert(data.error || 'Failed to list product');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus, vendorId: session.user.id })
      });
      const data = await res.json();

      if (data.success) {
        // Refresh orders locally
        const refreshed = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
        setOrders(refreshed);
      } else {
        alert(data.error || 'Failed to update order');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating order');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !brand) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 className="anim-spin" size={32} />
      </div>
    );
  }

  return (
    <div className={`container ${styles.page} pb-mobile-nav`}>
      <aside className={styles.sidebar}>
        <div className={styles.brandInfo}>
          <div className={styles.logo}>
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
            ) : brand.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className={styles.brandName}>{brand.name}</h2>
            {brand.verified && <span className={`badge badge-success`}>Verified Vendor</span>}
          </div>
        </div>

        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${activeTab === 'overview' ? styles.navActive : ''}`} onClick={() => setActiveTab('overview')}>
            <TrendingUp size={18} /> Overview
          </button>
          <button className={`${styles.navItem} ${activeTab === 'orders' ? styles.navActive : ''}`} onClick={() => setActiveTab('orders')}>
            <Package size={18} /> Orders & Fulfillment
          </button>
          <button className={`${styles.navItem} ${activeTab === 'inventory' ? styles.navActive : ''}`} onClick={() => setActiveTab('inventory')}>
            <ShoppingCart size={18} /> Listings & Inventory
          </button>
          <button className={`${styles.navItem} ${activeTab === 'wallet' ? styles.navActive : ''}`} onClick={() => setActiveTab('wallet')}>
            <Wallet size={18} /> Wallet & Payouts
          </button>
          <button className={`${styles.navItem} ${activeTab === 'enquiries' ? styles.navActive : ''}`} onClick={() => setActiveTab('enquiries')}>
            <Bell size={18} /> Notifications & Enquiries
          </button>
          <button className={`${styles.navItem} ${activeTab === 'services' ? styles.navActive : ''}`} onClick={() => setActiveTab('services')}>
            <Scissors size={18} /> Services
          </button>
          <button className={`${styles.navItem} ${activeTab === 'reels' ? styles.navActive : ''}`} onClick={() => setActiveTab('reels')}>
            <Video size={18} /> Collection Reels
          </button>
          <button className={`${styles.navItem} ${activeTab === 'promotion' ? styles.navActive : ''}`} onClick={() => setActiveTab('promotion')}>
            <Zap size={18} /> Boost Store
          </button>
          <button className={`${styles.navItem} ${activeTab === 'settings' ? styles.navActive : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={18} /> Store Settings
          </button>
        </nav>
      </aside>

      <main className={styles.main}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Business Overview</h1>
            <div className={`${styles.verificationBanner} ${styles[brand?.verification_status || 'pending']}`}>
              {brand?.verification_status === 'verified' ? (
                <CheckCircle size={16} />
              ) : (
                <AlertTriangle size={16} />
              )}
              <span>Status: {brand?.verification_status?.toUpperCase() || 'NOT SUBMITTED'}</span>
              {brand?.verification_status !== 'verified' && (
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Complete Verification</button>
              )}
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statHead}>
                  <Wallet size={20} color="var(--primary)" />
                  <span>Wallet Balance</span>
                </div>
                <div className={styles.statValue}>{formatPrice(brand?.wallet_balance || 0)}</div>
                <div className={styles.statTrend}>Available for withdrawal</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statHead}>
                  <CreditCard size={20} color="var(--secondary)" />
                  <span>Total Sales</span>
                </div>
                <div className={styles.statValue}>{formatPrice(transactions.filter(t => t.type === 'escrow_release').reduce((acc, curr) => acc + curr.amount, 0))}</div>
                <div className={styles.statTrend}>+12.5% vs last month</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statHead}>
                  <ShoppingCart size={20} color="#3b82f6" />
                  <span>Active Orders</span>
                </div>
                <div className={styles.statValue}>{orders.length}</div>
                <div className={styles.statTrend}>{orders.filter(o => o.status === 'paid').length} pending processing</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statHead}>
                  <TrendingUp size={20} color="#10b981" />
                  <span>Reach</span>
                </div>
                <div className={styles.statValue}>{products.reduce((acc, curr) => acc + (curr.views_count || 0), 0)}</div>
                <div className={styles.statTrend}>Total product views</div>
              </div>
            </div>

            <div className={styles.dashboardSplit}>
              <div className={styles.splitMain}>
                <div className={`${styles.sectionHeader} ${styles.hasAction}`}>
                  <h2>Recent Orders</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('orders')}>View All</button>
                </div>
                <div className={styles.orderListSmall}>
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className={styles.orderItemSmall}>
                      <div className={styles.orderItemIcon}><Package size={16} /></div>
                      <div className={styles.orderItemInfo}>
                        <p>{order.products?.title}</p>
                        <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className={`${styles.statusBadgeSmall} ${styles[order.status]}`}>
                        {order.status}
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && <p className={styles.emptyText}>No orders yet.</p>}
                </div>
              </div>

              <div className={styles.splitSide}>
                <div className={styles.quickActions}>
                  <h3>Quick Actions</h3>
                  <button className={styles.actionBtn} onClick={() => setActiveTab('inventory')}>Add New Product</button>
                  <button className={styles.actionBtn} onClick={() => setActiveTab('services')}>Add Service</button>
                  <button className={styles.actionBtn} onClick={() => setActiveTab('reels')}>Upload Reel</button>
                  <button className={styles.actionBtn} onClick={() => setActiveTab('payments')}>Request Payout</button>
                </div>

                <div className={styles.tipCard}>
                  <Star size={24} color="var(--secondary)" />
                  <h4>Pro Tip</h4>
                  <p>Products with videos get 3x more enquiries. Upload a collection reel to boost your sales!</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Wallet & Escrow Balance</h1>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Available Balance</span>
                <span className={styles.statValue}>{formatPrice(Number(brand.wallet_balance || 0))}</span>
                <button className={`btn btn-primary btn-sm ${styles.withdrawBtn}`} disabled={Number(brand.wallet_balance) <= 0}>Withdraw to Bank</button>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Funds in Escrow</span>
                <span className={styles.statValue} style={{ color: 'var(--text-300)' }}>
                  {formatPrice(orders.filter(o => o.status === 'paid' || o.status === 'ready' || o.status === 'picked_up' || o.status === 'in_transit' || o.status === 'delivered').reduce((acc, curr) => acc + Number(curr.vendor_earning), 0))}
                </span>
                <p className={styles.statSub}>Releases when customer confirms delivery</p>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Sales</span>
                <span className={styles.statValue}>
                  {formatPrice(transactions.filter(tx => tx.type === 'payment_in').reduce((acc, curr) => acc + Number(curr.amount), 0))}
                </span>
                <p className={styles.statSub}>Before platform commissions</p>
              </div>
            </div>

            <div className={styles.activityFeed}>
              <h3>Recent Transactions</h3>
              <div className={styles.transactionList}>
                {transactions.length > 0 ? (
                  transactions.map(tx => (
                    <div key={tx.id} className={styles.txRow}>
                      <div className={styles.txIcon}>
                        {tx.type === 'payment_in' ? <TrendingUp size={16} /> : <Wallet size={16} />}
                      </div>
                      <div className={styles.txInfo}>
                        <h4>{tx.description || tx.type.replace('_', ' ').toUpperCase()}</h4>
                        <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className={tx.type === 'payment_in' || tx.type === 'escrow_release' ? styles.txAmountPos : styles.txAmountNeg}>
                        {tx.type === 'payout' || tx.type === 'refund' ? '-' : '+'}{formatPrice(Number(tx.amount))}
                      </span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-400)', textAlign: 'center', padding: '1rem' }}>No transactions yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Order Management</h1>
            <p className={styles.subtitle}>Process orders quickly to get your escrow funds released faster.</p>

            <div className={styles.orderList}>
              {orders.length > 0 ? (
                orders.map((order) => (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <span className={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className={styles.orderBody}>
                      <div className={styles.orderInfo}>
                        <h3>{order.products?.title || 'Fashion Item'}</h3>
                        <span className={styles.orderPrice}>{formatPrice(Number(order.total_amount))}</span>
                      </div>

                      <div className={styles.statusCol}>
                        {order.status === 'paid' && (
                          <div className={styles.statusBox}>
                            <div className={styles.actionRow}>
                              <button className="btn btn-primary btn-sm" onClick={() => updateOrderStatus(order.id, 'accepted')}>Accept Order</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }} onClick={() => updateOrderStatus(order.id, 'cancelled')}>Reject</button>
                            </div>
                          </div>
                        )}
                        {order.status === 'accepted' && (
                          <div className={styles.statusBox}>
                            <button className="btn btn-secondary btn-sm" onClick={() => updateOrderStatus(order.id, 'processing')}>Start Processing</button>
                          </div>
                        )}
                        {order.status === 'processing' && (
                          <div className={styles.statusBox}>
                            <div className={styles.deliverySelector}>
                              <p>Select Delivery Method:</p>
                              <button className="btn btn-primary btn-sm" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={() => updateOrderStatus(order.id, 'ready')}>Use Platform Delivery</button>
                              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => updateOrderStatus(order.id, 'in_transit')}>I will Deliver Personally</button>
                            </div>
                          </div>
                        )}
                        {order.status === 'in_transit' && (
                          <div className={styles.statusBox}>
                            <button className="btn btn-secondary btn-sm" onClick={() => updateOrderStatus(order.id, 'delivered')}>Mark as Delivered</button>
                          </div>
                        )}
                        {order.status === 'ready' && (
                          <div className={styles.statusBox}>
                            <span className={`${styles.statusBadge} ${styles.statusWarning}`}>
                              <Clock size={14} /> Awaiting Pickup
                            </span>
                          </div>
                        )}
                        {(order.status === 'picked_up' || order.status === 'in_transit') && (
                          <div className={styles.statusBox}>
                            <span className={`${styles.statusBadge} ${styles.statusInfo}`}>
                              <Truck size={14} /> {order.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        )}
                        {(order.status === 'delivered' || order.status === 'confirmed' || order.status === 'completed') && (
                          <div className={styles.statusBox}>
                            <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>
                              <CheckCircle size={14} /> {order.status.toUpperCase()}
                            </span>
                          </div>
                        )}
                        {order.status === 'pending' && (
                          <div className={styles.statusBox}>
                            <span className={`${styles.statusBadge}`} style={{ background: 'var(--bg-200)' }}>
                              Pending Payment
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-400)', textAlign: 'center', padding: '2rem' }}>No orders found.</p>
              )}
            </div>
          </div>
        )}

        {/* Enquiries Tab */}
        {activeTab === 'enquiries' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Notifications & Enquiries</h1>
            <p className={styles.subtitle}>Track product enquiries and system alerts here.</p>

            <div className={styles.enquiryList}>
              {enquiries.length > 0 ? (
                enquiries.map((enq) => (
                  <div key={enq.id} className={styles.enquiryCard}>
                    <div className={styles.enquiryHeader}>
                      <span className={styles.enquirySender}>{enq.sender?.name || 'Customer'}</span>
                      <span className={styles.enquiryDate}>{new Date(enq.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className={styles.enquiryContent}>{enq.content}</p>
                    <div className={styles.enquiryActions}>
                      <button className="btn btn-secondary btn-sm">Reply</button>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-400)', textAlign: 'center', padding: '2rem' }}>No enquiries yet.</p>
              )}
            </div>
          </div>
        )}
        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div>
                <h1 className={styles.title}>Inventory Management</h1>
                <p className={styles.subtitle}>
                  Manage your listings. {products.length >= 5 ? '⚠️ Free limit reached. Next post costs ₦200.' : `You have ${5 - products.length} free listings remaining.`}
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setIsAddingProduct(true)}>
                <Upload size={18} /> Add New Product
              </button>
            </div>

            {isAddingProduct && (
              <div className={styles.formContainer}>
                <div className={styles.formHead}>
                  <h2>List New Product</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setIsAddingProduct(false)}>Cancel</button>
                </div>
                <form onSubmit={handleProductSubmit} className={styles.productForm}>
                  <div className={styles.formRow}>
                    <div className={styles.inputGroup}>
                      <label>Product Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Classic Vintage Denim Jacket"
                        required
                        value={newProduct.title}
                        onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Category</label>
                      <select
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      >
                        <option>Clothing</option>
                        <option>Shoes</option>
                        <option>Accessories</option>
                        <option>Bags</option>
                        <option>Handmade</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.inputGroup}>
                      <label>Price (₦)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        required
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Stock Count</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={newProduct.stockCount}
                        onChange={(e) => setNewProduct({ ...newProduct, stockCount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Description</label>
                    <textarea
                      placeholder="Tell your customers about the material, fit, and style..."
                      rows={4}
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    ></textarea>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Product Image URL</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      required
                      value={newProduct.mediaUrls[0] || ''}
                      onChange={(e) => setNewProduct({ ...newProduct, mediaUrls: [e.target.value] })}
                    />
                  </div>

                  <div className={styles.formFooter}>
                    <div className={styles.billingNote}>
                      {products.length >= 5 ? (
                        <p>Listing Fee: <strong>₦200</strong> (Wallet: {formatPrice(brand?.wallet_balance || 0)})</p>
                      ) : (
                        <p>Listing: <strong>FREE</strong> ({5 - products.length} credits remaining)</p>
                      )}
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                      {loading ? 'Processing...' : 'Post Product to Marketplace'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className={styles.inventoryGrid}>
              {products.map(p => (
                <div key={p.id} className={styles.inventoryCard}>
                  <div className={styles.invImg}>
                    <img src={p.media_urls?.[0]} alt={p.title} />
                    {p.locked && <div className={styles.lockedLabel}>Payment Required</div>}
                  </div>
                  <div className={styles.invInfo}>
                    <h4>{p.title}</h4>
                    <span className={styles.invPrice}>{formatPrice(p.price)}</span>
                    <div className={styles.invStats}>
                      <span><BarChart3 size={12} /> {p.views_count || 0} views</span>
                      <span><ShoppingCart size={12} /> {p.sales_count || 0} sales</span>
                    </div>
                  </div>
                  <div className={styles.invActions}>
                    <button className="btn btn-ghost btn-sm">Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>Delete</button>
                  </div>
                </div>
              ))}
              {products.length === 0 && <p className={styles.emptyText}>No products yet.</p>}
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Payments & Wallet</h1>
            <p className={styles.subtitle}>Manage your earnings and request withdrawals.</p>

            <div className={styles.walletHero}>
              <div className={styles.walletMain}>
                <span>Available Balance</span>
                <h2>{formatPrice(brand?.wallet_balance || 0)}</h2>
                <div className={styles.walletActions}>
                  <button
                    className="btn btn-primary"
                    disabled={!brand?.wallet_balance || brand.wallet_balance < 1000}
                    onClick={() => setIsWithdrawing(true)}
                  >
                    Withdraw Funds
                  </button>
                </div>
                <p className={styles.minWithdrawal}>Minimum withdrawal: ₦1,000</p>
              </div>

              <div className={styles.walletEscrow}>
                <span>Escrow (Pending)</span>
                <h3>{formatPrice(orders.filter(o => ['paid', 'shipped', 'out_for_delivery'].includes(o.status)).reduce((acc, curr) => acc + curr.vendor_earning, 0))}</h3>
                <p>Funds released to wallet after customer confirms delivery.</p>
              </div>
            </div>

            {isWithdrawing && (
              <div className={styles.formContainer} style={{ marginTop: '2rem' }}>
                <div className={styles.formHead}>
                  <h2>Request Payout</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setIsWithdrawing(false)}>Cancel</button>
                </div>
                <div className={styles.productForm}>
                  <div className={styles.inputGroup}>
                    <label>Amount to Withdraw (₦)</label>
                    <input type="number" placeholder="0.00" autoFocus />
                    <p className={styles.formHint}>Available: <strong>{formatPrice(brand?.wallet_balance || 0)}</strong></p>
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Bank Account Details</label>
                    <div className={styles.bankPreview}>
                      <CreditCard size={18} />
                      <div>
                        <p>{brand?.bank_name || 'No Bank Added'}</p>
                        <span>{brand?.bank_account_number || 'Update in settings'}</span>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-lg" disabled={!brand?.bank_account_number}>Confirm Withdrawal Request</button>
                </div>
              </div>
            )}

            <div className={styles.transactionSection}>
              <h3>Transaction History</h3>
              <div className={styles.transactionTable}>
                {transactions.map(tx => (
                  <div key={tx.id} className={styles.txRow}>
                    <div className={styles.txIcon}>
                      {tx.type === 'escrow_release' ? <CheckCircle size={16} color="#10b981" /> : <CreditCard size={16} color="var(--primary)" />}
                    </div>
                    <div className={styles.txInfo}>
                      <p>{tx.description || tx.type.replace('_', ' ')}</p>
                      <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={`${styles.txAmount} ${tx.amount > 0 ? styles.txPos : styles.txNeg}`}>
                      {tx.amount > 0 ? '+' : ''}{formatPrice(tx.amount)}
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && <p className={styles.emptyText}>No transactions yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab (Placeholder) */}
        {activeTab === 'analytics' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Performance Insights</h1>
            <p className={styles.subtitle}>Understand how your brand is growing on campus.</p>

            <div className={styles.analyticsPlaceholder}>
              <BarChart3 size={48} />
              <h3>Visualizing your growth...</h3>
              <p>Custom charts for your daily sales and conversion rates will appear here as you get more orders.</p>
            </div>
          </div>
        )}
        {/* Promotion Tab */}
        {activeTab === 'promotion' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Boost Your Brand</h1>
            <p className={styles.subtitle}>Get more visibility and sales by featuring your best items.</p>

            <div className={styles.promoGrid}>
              <div className={styles.promoOption}>
                <div className={styles.promoIcon}><Zap size={24} color="var(--secondary)" /></div>
                <h3>Product Boost</h3>
                <p>Push your product to the top of the explorer page for 24 hours.</p>
                <div className={styles.promoPrice}>₦500</div>
                <button className="btn btn-primary btn-sm">Select Product</button>
              </div>
              <div className={styles.promoOption}>
                <div className={styles.promoIcon}><TrendingUp size={24} color="#3b82f6" /></div>
                <h3>Featured Listing</h3>
                <p>Get a spotlight slot on the homepage featured mosaic.</p>
                <div className={styles.promoPrice}>₦2,000</div>
                <button className="btn btn-primary btn-sm">Boost Store</button>
              </div>
            </div>

            <div className={styles.boostActive}>
              <h3>Active Promotions</h3>
              <p className={styles.emptyText}>No active promotions at the moment.</p>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Store Settings</h1>
            <p className={styles.subtitle}>Update your brand identity and payout details.</p>

            <div className={styles.settingsForm}>
              <section className={styles.formSection}>
                <h3>Brand Identity</h3>
                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label>Brand Name</label>
                    <input type="text" placeholder={brand?.name} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>WhatsApp Number</label>
                    <input type="text" placeholder={brand?.whatsapp_number} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Instagram Link</label>
                    <input type="text" placeholder="@yourbrand" />
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label>Description</label>
                  <textarea placeholder={brand?.description}></textarea>
                </div>
              </section>

              <section className={styles.formSection}>
                <h3>Payout Details</h3>
                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label>Bank Name</label>
                    <input type="text" placeholder={brand?.bank_name || 'Select Bank'} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Account Number</label>
                    <input type="text" placeholder={brand?.bank_account_number || '0000000000'} />
                  </div>
                </div>
              </section>

              <button className="btn btn-primary">Save Changes</button>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.mobileNav}>
        <button className={`${styles.mobNavItem} ${activeTab === 'overview' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('overview')}>
          <TrendingUp className={styles.mobNavIcon} />
          <span>Home</span>
        </button>
        <button className={`${styles.mobNavItem} ${activeTab === 'orders' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('orders')}>
          <ShoppingCart className={styles.mobNavIcon} />
          <span>Orders</span>
        </button>
        <button className={`${styles.mobNavItem} ${activeTab === 'inventory' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('inventory')}>
          <Package className={styles.mobNavIcon} />
          <span>Inv</span>
        </button>
        <button className={`${styles.mobNavItem} ${activeTab === 'enquiries' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('enquiries')}>
          <Bell className={styles.mobNavIcon} />
          <span>Notifs</span>
        </button>
        <button className={`${styles.mobNavItem} ${activeTab === 'payments' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('payments')}>
          <Wallet className={styles.mobNavIcon} />
          <span>Wallet</span>
        </button>
        <button className={`${styles.mobNavItem} ${activeTab === 'settings' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings className={styles.mobNavIcon} />
          <span>Config</span>
        </button>
      </nav>
    </div>
  );
}
