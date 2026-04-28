'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Truck, CheckCircle, Wallet, Settings, TrendingUp, AlertTriangle, Loader2, MessageCircle, Video, Upload, Info, ShoppingCart, BarChart3, CreditCard, Star, Scissors, Image as ImageIcon, Clock, Zap, Bell, X, LogOut, ArrowUpRight, ShieldAlert, Tag, Gift, Trash2, Edit3, Plus, ChevronDown, ChevronRight, Share2, ExternalLink, ShieldCheck, ArrowRight, FileText, Store, Crown, Target, Rocket, Home, Camera, MapPin, Navigation } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { uploadFile } from '@/lib/storage';
import { useNotifications } from '@/context/NotificationContext';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import styles from './dashboard.module.css';

// Icons mapper for dynamic rates
const getIcon = (id: string) => {
  switch (id) {
    case 'quarter': return <Target size={24} color="#3b82f6" />;
    case 'half': return <Rocket size={24} color="var(--primary)" />;
    case 'full': return <Crown size={24} color="#f59e0b" />;
    case 'boost_week': return '📣';
    case 'boost_month': return '🔥';
    case 'boost_top': return '🏆';
    default: return <Zap size={24} />;
  }
};

export default function VendorDashboard() {
  const router = useRouter();
  const { unreadCount, permission, requestPermission } = useNotifications();
  const [activeTab, setActiveTab] = useState('overview');
  const [subscriptionRates, setSubscriptionRates] = useState<any[]>([]);
  const [boostRates, setBoostRates] = useState<any[]>([]);
  const [activationFee, setActivationFee] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Subscription & Trial Logic
  const trialDaysLeft = brand?.trial_started_at
    ? Math.max(0, 7 - Math.floor((new Date().getTime() - new Date(brand.trial_started_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Expiration Reminder
  useEffect(() => {
    if (brand?.subscription_expires_at) {
      const expires = new Date(brand.subscription_expires_at).getTime();
      const now = new Date().getTime();
      const threeDays = 3 * 24 * 60 * 60 * 1000;

      if (expires - now > 0 && expires - now < threeDays) {
        // Send a temporary UI notification if not already notified
        const hasNotified = localStorage.getItem(`expire_notif_${brand.id}`);
        if (!hasNotified) {
          alert(`⚠️ Your ${brand.subscription_tier} plan is expiring soon! Upgrade now to keep your store active.`);
          localStorage.setItem(`expire_notif_${brand.id}`, 'true');
        }
      }
    }
  }, [brand]);
  const isTrialActive = trialDaysLeft > 0;

  const isSubActive = brand?.subscription_expires_at
    ? new Date(brand.subscription_expires_at).getTime() > new Date().getTime()
    : false;

  const currentTier = userRole === 'admin' ? 'full' : (isTrialActive ? 'full' : (isSubActive ? (brand?.subscription_tier || 'free') : 'free'));

  const productLimit = (userRole === 'admin' || isTrialActive) ? 999999 : (isSubActive ? (brand?.max_products || 10) : 0);
  const reelLimit = (userRole === 'admin' || isTrialActive) ? 999999 : (isSubActive ? (brand?.max_reels || 1) : 0);

  const canAccessAnalytics = userRole === 'admin' || currentTier !== 'free';
  const canAccessPromoCodes = userRole === 'admin' || ['half', 'full'].includes(currentTier);

  // Real-time states
  const { products: allProducts, orders: allOrders, setOrders: setGlobalOrders, addProduct, updateOrder, updateProduct: updateGlobalProduct } = useMarketplaceStore();

  const products = brand ? allProducts.filter(p => p.brand_id === brand.id && !p.is_draft) : [];
  const orders = brand ? allOrders.filter(o => o.brand_id === brand.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [paying, setPaying] = useState('');
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);

  // New States for Advanced Features
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingReel, setUploadingReel] = useState(false);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [isSettingUpBank, setIsSettingUpBank] = useState(false);

  // AI States
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [showCopilot, setShowCopilot] = useState(false);
  const [copilotMsgs, setCopilotMsgs] = useState<any[]>([{ role: 'assistant', content: "Hi! I'm your AI Copilot. How can I help you grow your store today?" }]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    category: 'Clothing',
    stockCount: '10',
    mediaUrls: [] as string[],
    imageUrl: '',
    videoUrl: '',
    variants: [] as any[],
    isDraft: false
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (brand) setTempName(brand.name);
  }, [brand]);

  useEffect(() => {
    async function fetchVendorData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/vendor');
        return;
      }

      // Fetch Role
      const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).single();
      if (profile) setUserRole(profile.role);

      // Fetch Brand
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('owner_id', session.user.id)
        .single();

      if (brandError || !brandData) {
        setLoading(false);
        setActiveTab('no_brand');
        return;
      }

      // VENDOR ACTIVATION GATE
      if (brandData.verification_status === 'pending') {
        setActiveTab('activation_pending');
        setBrand(brandData);
        setLoading(false);
        return;
      }

      if (brandData.verification_status === 'approved' && !brandData.fee_paid) {
        router.push('/dashboard/vendor/pay-fee');
        return;
      }

      if (brandData.verification_status === 'rejected') {
        setActiveTab('activation_rejected');
        setBrand(brandData);
        setLoading(false);
        return;
      }

      setBrand(brandData);

      // Check for payment status in URL
      const searchParams = new URLSearchParams(window.location.search);
      const payRef = searchParams.get('ref') || searchParams.get('reference');
      if (payRef) {
        // Clear the URL to avoid repeated alerts
        window.history.replaceState({}, '', window.location.pathname);
        
        // Wait for webhook (3s), then re-fetch brand to check status
        setTimeout(async () => {
          const { data: brandUpdate } = await supabase.from('brands').select('subscription_tier, fee_paid').eq('id', brandData.id).single();
          if (brandUpdate?.fee_paid || (brandUpdate?.subscription_tier && brandUpdate.subscription_tier !== 'free')) {
            alert('🎉 Payment Successfully Verified! Your account has been updated.');
          } else {
            alert('⚠️ Payment Incomplete: We couldn\'t verify your payment. If you were debited, please contact support.');
          }
        }, 3000);
      }
      // Fetch Orders initially, then pass to store
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          products (title),
          users:customer_id (id, name, email),
          deliveries (
            id,
            status,
            agent_id,
            delivery_code,
            users:agent_id (id, name, phone)
          )
        `)
        .eq('brand_id', brandData.id)
        .order('created_at', { ascending: false });

      if (ordersData) setGlobalOrders(ordersData);

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

      // Products are heavily fetched by RealtimeProvider so no need to refetch here
      // But we still fetch them to ensure we catch any missed products in edge cases
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', brandData.id);

      setReels(reelData || []);

      // Fetch Payout Requests
      const { data: withdrawData } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setWithdrawalRequests(withdrawData || []);

      // Fetch Promo Codes
      const { data: promoData } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('brand_id', brandData.id);
      setPromoCodes(promoData || []);

      // Fetch Reviews
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('*, user:user_id(name:full_name), product:product_id(title)')
        .in('product_id', productData ? productData.map(p => p.id) : []); 
      setReviews(reviewData || []);

      // Fetch Platform Settings
      const { data: settingsData } = await supabase.from('platform_settings').select('*');
      if (settingsData) {
        setSubscriptionRates(settingsData.find(s => s.key === 'subscription_rates')?.value || []);
        setBoostRates(settingsData.find(s => s.key === 'boost_rates')?.value || []);
        setActivationFee(settingsData.find(s => s.key === 'activation_fee')?.value?.amount || 2000);
      }

      // Fetch Wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('brand_id', brandData.id)
        .single();
      setWallet(walletData);

      // Fetch Banks
      const bankRes = await fetch('/api/paystack/banks');
      const bankDataRes = await bankRes.json();
      if (bankDataRes.success) setBanks(bankDataRes.data);

      // Fetch AI Settings
      const { data: aiData } = await supabase
        .from('vendor_ai_settings')
        .select('*')
        .eq('brand_id', brandData.id)
        .single();
      setAiSettings(aiData || { ai_enabled: true, auto_reply_enabled: false, custom_instructions: '' });

      setLoading(false);
    }

    fetchVendorData();
  }, [router]);

  // Calculate 7-day sales trend
  const getSalesTrend = () => {
    const dailyData = new Array(7).fill(0);
    const now = new Date();

    orders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays < 7 && diffDays >= 0) {
        dailyData[6 - diffDays] += Number(order.total_amount);
      }
    });

    const max = Math.max(...dailyData, 1);
    return dailyData.map(val => (val / max) * 100);
  };

  const calculateGrowth = () => {
    const week1 = orders.filter(o => {
      const diff = (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 3600 * 24);
      return diff < 7;
    }).reduce((acc, c) => acc + Number(c.total_amount), 0);

    const week2 = orders.filter(o => {
      const diff = (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 3600 * 24);
      return diff >= 7 && diff < 14;
    }).reduce((acc, c) => acc + Number(c.total_amount), 0);

    if (week2 === 0) return week1 > 0 ? '+100%' : '0%';
    const growth = ((week1 - week2) / week2) * 100;
    return `${growth > 0 ? '+' : ''}${Math.round(growth)}%`;
  };

  const salesTrendData = getSalesTrend();
  const growthPercent = calculateGrowth();

  const fetchProducts = async (brandId: string) => {
    // Relying on real-time sync, no-op for now.
  };

  const handleProductMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    if (!brand) {
      alert('⚠️ Error: Your Brand profile is not initialized. Please go to "Overview" and complete your store setup first!');
      return;
    }
    setUploadingMedia(true);

    const files = Array.from(e.target.files);
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const bucket = isVideo ? 'product-videos' : 'product-media';

      const { url, error } = await uploadFile(file, bucket, `prod-${brand.id}`);
      if (url) {
        uploadedUrls.push(url);
        if (!isVideo && !newProduct.imageUrl) {
          setNewProduct(prev => ({ ...prev, imageUrl: url }));
        }
        if (isVideo) {
          setNewProduct(prev => ({ ...prev, videoUrl: url }));
        }
        // Affirmation
        alert(`✅ ${isVideo ? 'Video' : 'Picture'} uploaded successfully!`);
      } else {
        alert(`Upload failed for ${file.name}: ${error}`);
      }
    }

    setNewProduct(prev => ({
      ...prev,
      mediaUrls: [...prev.mediaUrls, ...uploadedUrls]
    }));

    if (uploadedUrls.length > 0) {
      alert(`Successfully attached ${uploadedUrls.length} file(s) to your product.`);
    }
    setUploadingMedia(false);
  };

  const handleReelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !brand) return;

    if (reels.length >= reelLimit) {
      alert(`You have reached your limit of ${reelLimit} reels. Upgrade your power level to upload more!`);
      setActiveTab('plans');
      return;
    }

    setUploadingReel(true);

    const file = e.target.files[0];
    const { url, error } = await uploadFile(file, 'brand-reels', `reel-${brand.id}`);

    if (url) {
      alert("✅ Reel uploaded successfully!");
      const { error: dbError } = await supabase
        .from('brand_reels')
        .insert({
          brand_id: brand.id,
          video_url: url,
        });

      if (!dbError) {
        const { data: reelData } = await supabase
          .from('brand_reels')
          .select('*')
          .eq('brand_id', brand.id)
          .order('created_at', { ascending: false });
        setReels(reelData || []);
      } else {
        alert('Database error: ' + dbError.message);
      }
    } else {
      alert('Upload failed: ' + error);
    }
    setUploadingReel(false);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    setLoading(true);

    try {
      if (editingProduct) {
        // Cleanup old media if changed
        const oldImage = editingProduct.image_url;
        const oldVideo = editingProduct.video_url;
        const filesToPurge: string[] = [];
        if (newProduct.imageUrl && oldImage && newProduct.imageUrl !== oldImage) filesToPurge.push(oldImage);
        if (newProduct.videoUrl && oldVideo && newProduct.videoUrl !== oldVideo) filesToPurge.push(oldVideo);
        if (filesToPurge.length > 0) {
          filesToPurge.forEach(url => {
            try {
              const parts = url.split('/public/');
              if (parts.length > 1) {
                const path = parts[1].split('?')[0];
                const bucket = path.split('/')[0];
                const filePath = path.split('/').slice(1).join('/');
                supabase.storage.from(bucket).remove([filePath]);
              }
            } catch (e) { console.error('Cleanup failed:', e); }
          });
        }

        const updates = {
            title: newProduct.title,
            description: newProduct.description,
            price: Number(newProduct.price),
            original_price: newProduct.originalPrice ? Number(newProduct.originalPrice) : undefined,
            category: newProduct.category,
            stock_count: Number(newProduct.stockCount),
            media_urls: newProduct.mediaUrls,
            image_url: newProduct.imageUrl || undefined,
            video_url: newProduct.videoUrl || undefined,
            variants: newProduct.variants,
            is_draft: newProduct.isDraft
        };
        const { error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', editingProduct.id);

        if (!error) {
          setIsAddingProduct(false);
          updateGlobalProduct(editingProduct.id, updates);
          setEditingProduct(null);
          setNewProduct({
            title: '', description: '', price: '', originalPrice: '', category: 'Clothing',
            stockCount: '10', mediaUrls: [], imageUrl: '', videoUrl: '', variants: [], isDraft: false
          });
          alert('Product updated successfully!');
        } else {
          alert('Failed to update product: ' + error.message);
        }
      } else {
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
          // Optimistic UI Update directly into global store
          addProduct({
            ...data.product,
            brands: brand
          });

          setNewProduct({
            title: '',
            description: '',
            price: '',
            originalPrice: '',
            category: 'Clothing',
            stockCount: '10',
            mediaUrls: [],
            imageUrl: '',
            videoUrl: '',
            variants: [],
            isDraft: false
          });
          alert('Product listed successfully!');
        } else {
          alert(data.error || 'Failed to list product');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, extraData: any = {}) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: newStatus,
          vendorId: session.user.id,
          ...extraData
        })
      });
      const data = await res.json();

      if (data.success) {
        // We do not need a local state setOrders here, as RealtimeProvider will catch the DB Postgres update automatically!
        // The store handles it or we can manually mutate it just in case:
        updateOrder(orderId, { status: newStatus, ...extraData });
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

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !wallet) return;
    const amount = (e.target as any).amount.value;

    if (Number(amount) > Number(wallet.available_balance)) {
      alert('Insufficient available balance');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_payout', {
        p_user_id: brand.owner_id,
        p_role: 'vendor',
        p_amount: Number(amount),
        p_bank_details: {
          bankName: brand.bank_name,
          accountNumber: brand.bank_account_number,
          accountName: brand.bank_account_name || brand.account_name
        }
      });
      if (!error) {
        alert(`Withdrawal request submitted successfully! Ref ID: ${data}`);
        setIsWithdrawing(false);
        // Refresh wallet
        const { data: newWallet } = await supabase.from('wallets').select('*').eq('brand_id', brand.id).single();
        setWallet(newWallet);
        // Refresh withdrawals
        const { data: withdrawData } = await supabase.from('payout_requests').select('*').eq('user_id', brand.owner_id).order('created_at', { ascending: false });
        setWithdrawalRequests(withdrawData || []);
      } else {
        alert(error.message || 'Withdrawal failed');
      }
    } catch (err) {
      alert('Error submitting withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBank = async (accountNumber: string, bankCode: string) => {
    if (!accountNumber || !bankCode) return;
    setVerifyingBank(true);
    try {
      const res = await fetch(`/api/paystack/resolve?accountNumber=${accountNumber}&bankCode=${bankCode}`);
      const data = await res.json();
      if (data.success) {
        if (confirm(`Confirm account name: ${data.data.account_name}?`)) {
          // Create Recipient
          const recRes = await fetch('/api/paystack/recipient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandId: brand.id,
              name: data.data.account_name,
              accountNumber,
              bankCode
            })
          });
          const recData = await recRes.json();
          if (recData.success) {
            alert('Bank details verified and saved successfully!');
            setBrand({ ...brand, recipient_code: recData.recipient_code, bank_account_number: accountNumber, bank_code: bankCode, account_name: data.data.account_name });
            setIsSettingUpBank(false);
          } else {
            alert(recData.error);
          }
        }
      } else {
        alert(data.error || 'Could not verify account');
      }
    } catch (err) {
      alert('Error verifying bank');
    } finally {
      setVerifyingBank(false);
    }
  };

  const handleSubscribe = async (tier: any) => {
    setPaying(tier.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/vendor/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          brandId: brand.id,
          tierId: tier.id,
          amount: tier.price
        }),
      });

      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Payment initialization failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error initializing payment');
    } finally {
      setPaying('');
    }
  };

  const handleLogoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brand) return;

    setUploadingLogo(true);
    try {
      const { url, error } = await uploadFile(file, 'brand-logos', `logo-${brand.id}`);
      if (error) throw new Error(error);

      await handleUpdateSettings({ logo_url: url });
    } catch (err: any) {
      alert('Error updating logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleNameUpdate = async () => {
    if (!tempName.trim() || tempName === brand.name) {
      setIsEditingName(false);
      return;
    }
    await handleUpdateSettings({ name: tempName });
    setIsEditingName(false);
  };

  const handleUpdateSettings = async (updates: any) => {
    if (!brand) return;
    setIsSettingsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/vendor/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          ownerId: session?.user.id,
          updates
        })
      });
      const data = await res.json();
      if (data.success) {
        setBrand(data.brand);
        alert('Settings updated successfully!');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error updating settings');
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const handleUpdateAiSettings = async (updates: any) => {
    if (!brand) return;
    setIsSettingsLoading(true);
    try {
      const { error } = await supabase.from('vendor_ai_settings').update(updates).eq('brand_id', brand.id);
      if (!error) {
        setAiSettings({ ...aiSettings, ...updates });
        alert('AI Settings updated successfully!');
      } else {
        alert('Error updating AI settings: ' + error.message);
      }
    } catch (err) {
      alert('Error updating AI settings');
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim() || !brand) return;
    
    const newMsgs = [...copilotMsgs, { role: 'user', content: copilotInput }];
    setCopilotMsgs(newMsgs);
    setCopilotInput('');
    setCopilotLoading(true);

    try {
      const res = await fetch(`/api/ai/copilot?v=3&t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs,
          vendorId: brand.owner_id,
          brandId: brand.id,
          currentTab: activeTab
        })
      });
      const data = await res.json();
      if (data.text) {
        setCopilotMsgs([...newMsgs, { role: 'assistant', content: data.text }]);
      } else if (data.error) {
        setCopilotMsgs([...newMsgs, { role: 'assistant', content: `⚠️ [VER-3] ${data.error}` }]);
      } else {
        setCopilotMsgs([...newMsgs, { role: 'assistant', content: '⚠️ [VER-3] No response received.' }]);
      }
    } catch (err: any) {
      setCopilotMsgs([...newMsgs, { role: 'assistant', content: `⚠️ [VER-3] Connection error: ${err.message}` }]);
    }
    setCopilotLoading(false);
  };

  const addVariant = () => {
    setNewProduct(prev => ({
      ...prev,
      variants: [...prev.variants, { type: 'Size', value: '' }]
    }));
  };

  const removeVariant = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariant = (index: number, val: string) => {
    setNewProduct(prev => {
      const updated = [...prev.variants];
      updated[index].value = val;
      return { ...prev, variants: updated };
    });
  };

  const handleReviewReply = async (reviewId: string, reply: string) => {
    try {
      const { error } = await supabase
        .from('product_reviews')
        .update({ vendor_reply: reply })
        .eq('id', reviewId);
      if (error) throw error;
      setReviews(reviews.map(r => r.id === reviewId ? { ...r, vendor_reply: reply } : r));
      alert('Reply posted!');
    } catch (err) {
      alert('Error posting reply');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;
    const body = {
      brand_id: brand.id,
      product_id: form.product_id?.value || null,
      code: form.code.value.toUpperCase(),
      type: form.type.value,
      value: Number(form.value.value),
      is_active: true
    };

    try {
      const res = await supabase.from('promo_codes').insert(body);
      if (!res.error) {
        alert('Promo code created!');
        setPromoCodes([...promoCodes, { ...body, id: Math.random().toString() }]);
      }
    } catch (err) {
      alert('Error creating promo code');
    }
  };

  const handleShareProduct = async (productId: string) => {
    const url = `${window.location.origin}/product/${productId}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('🚀 Product link copied to clipboard! You can now share it anywhere.');
    } catch (err) {
      alert('Failed to copy link.');
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        setLoading(true);
        for (const row of rows) {
          if (!row.title || !row.price) continue;
          await supabase.from('products').insert({
            brand_id: brand.id,
            title: row.title,
            description: row.description || '',
            price: Number(row.price),
            category: row.category || 'Clothing',
            stock_count: Number(row.stockCount || -1),
            media_urls: row.imageUrls ? row.imageUrls.split(',') : []
          });
        }
        setLoading(false);
        alert(`Bulk upload complete! Processed ${rows.length} rows.`);
        window.location.reload(); // Refresh to show new products
      }
    });
  };

  const handlePrintInvoice = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Invoice - ${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .details { margin: 30px 0; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background: #f5f5f5; }
            .total { text-align: right; margin-top: 30px; font-size: 1.2rem; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 0.8rem; color: #777; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div><h1>INVOICE</h1><p>#${order.id.toUpperCase()}</p></div>
            <div style="text-align:right"><h2>${brand?.name}</h2><p>${new Date().toLocaleDateString()}</p></div>
          </div>
          <div class="details">
            <div><strong>BILL TO:</strong><p>Customer ID: ${order.customer_id}</p><p>${order.shipping_address || 'Campus Hub Pickup'}</p></div>
            <div><strong>ORDER STATUS:</strong><p>${order.status.toUpperCase()}</p></div>
          </div>
          <table>
            <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>
              <tr><td>${order.products?.title}</td><td>1</td><td>₦${Number(order.total_amount).toLocaleString()}</td><td>₦${Number(order.total_amount).toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div class="total">Total: ₦${Number(order.total_amount).toLocaleString()}</div>
          <div class="footer">Thank you for your business! Generated by ABUAD Fashion Hub.</div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
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
      {/* 💳 Payment Processing Overlay */}
      {paying && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContent}>
            <div className={styles.paymentLoader}></div>
            <h3>Processing Payment...</h3>
            <p>Please wait while we secure your transaction with Paystack.</p>
            <div className={styles.redirectText}>Preparing secure redirect...</div>
          </div>
        </div>
      )}

      {brand?.verification_status !== 'verified' && userRole !== 'admin' ? (
        <div className="container" style={{ padding: '4rem 2rem' }}>
          <div className={styles.restrictedView}>
            <div className={styles.restrictedIcon}>
              <ShieldAlert size={48} />
            </div>
            <h2>Dashboard Restricted</h2>
            <p>
              {brand?.verification_status === 'pending' 
                ? "Your brand application is currently being reviewed by our admin team. To maintain platform integrity, your dashboard tools will remain locked until your verification is approved."
                : brand?.verification_status === 'rejected'
                ? "Your brand application was unfortunately declined. Please contact the platform administrator to resolve any issues."
                : "Your vendor account is currently suspended. Please contact support for assistance."}
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <Link href="/" className="btn btn-primary">Return to Hub</Link>
              <a href="https://wa.me/2348012345678" target="_blank" className="btn btn-ghost">Contact Admin</a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <aside className={styles.sidebar}>

        <header className={styles.header}>
          <div className={styles.brandInfo}>
            <div className={`${styles.logo} ${uploadingLogo ? 'anim-pulse' : ''}`} style={{ cursor: 'pointer', overflow: 'hidden', position: 'relative' }} title="Change Logo" onClick={() => document.getElementById('logoInput')?.click()}>
              {brand?.logo_url ? (
                <img src={brand.logo_url} alt={brand?.name || 'Brand'} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
              ) : (brand?.name || 'AF').substring(0, 2).toUpperCase()}
              {uploadingLogo && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={16} className="anim-spin" />
                </div>
              )}
              <input type="file" id="logoInput" hidden accept="image/*" onChange={handleLogoUpdate} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isEditingName ? (
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <input
                      className="input-sm"
                      value={tempName}
                      onChange={e => setTempName(e.target.value)}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleNameUpdate()}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleNameUpdate}><CheckCircle size={14} /></button>
                  </div>
                ) : (
                  <>
                    <h2 className={styles.brandName} style={{ cursor: 'pointer' }} onClick={() => setIsEditingName(true)} title="Change Name">{brand?.name || 'Brand Portal'}</h2>
                    <Edit3 size={14} className={styles.editIcon} onClick={() => setIsEditingName(true)} style={{ cursor: 'pointer', opacity: 0.5 }} />
                  </>
                )}
              </div>
              <div className={styles.brandType}>
                <span className="badge badge-teal">{brand?.brand_type || 'Fashion'}</span>
              </div>
            </div>
          </div>
        </header>

        <nav className={styles.nav}>
          <Link href="/" className={styles.navItem} style={{ marginBottom: '0.5rem', color: 'var(--secondary)' }}>
            <Home size={18} /> Marketplace Hub
          </Link>
          <div className={styles.navDivider} style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '1rem' }} />

          <button className={`${styles.navItem} ${activeTab === 'overview' ? styles.navActive : ''}`} onClick={() => setActiveTab('overview')}>
            <TrendingUp size={18} /> Overview
          </button>
          <button className={`${styles.navItem} ${activeTab === 'orders' ? styles.navActive : ''}`} onClick={() => setActiveTab('orders')}>
            <Package size={18} /> Orders & Fulfillment
          </button>
          <button className={`${styles.navItem} ${activeTab === 'inventory' ? styles.navActive : ''}`} onClick={() => setActiveTab('inventory')}>
            <ShoppingCart size={18} /> My Store & Stocks
          </button>
          <button className={`${styles.navItem} ${activeTab === 'payments' ? styles.navActive : ''}`} onClick={() => setActiveTab('payments')}>
            <Wallet size={18} /> Wallet & Payouts
          </button>
          <button className={`${styles.navItem} ${activeTab === 'enquiries' ? styles.navActive : ''}`} onClick={() => setActiveTab('enquiries')}>
            <Bell size={18} /> Notifications & Enquiries
            {unreadCount > 0 && <span className={styles.navBadge}>{unreadCount}</span>}
          </button>
          <button className={`${styles.navItem} ${activeTab === 'reviews' ? styles.navActive : ''}`} onClick={() => setActiveTab('reviews')}>
            <Star size={18} /> Customer Reviews
          </button>
          <button className={`${styles.navItem} ${activeTab === 'marketing' ? styles.navActive : ''}`} onClick={() => setActiveTab('marketing')}>
            <Tag size={18} /> Marketing & Promos
          </button>
          <button className={`${styles.navItem} ${activeTab === 'services' ? styles.navActive : ''}`} onClick={() => setActiveTab('services')}>
            <Scissors size={18} /> Services
          </button>
          <button className={`${styles.navItem} ${activeTab === 'reels' ? styles.navActive : ''}`} onClick={() => setActiveTab('reels')}>
            <Video size={18} /> Collection Reels
          </button>
          <button className={`${styles.navItem} ${activeTab === 'analytics' ? styles.navActive : ''}`} onClick={() => setActiveTab('analytics')}>
            <BarChart3 size={18} /> Smart Analytics
          </button>
          <button className={`${styles.navItem} ${activeTab === 'settings' ? styles.navActive : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={18} /> Store Settings
          </button>
          <button className={`${styles.navItem} ${activeTab === 'plans' ? styles.navActive : ''}`} onClick={() => setActiveTab('plans')} style={{ color: 'var(--primary)', background: activeTab === 'plans' ? 'var(--primary-soft)' : 'transparent' }}>
            <Crown size={18} /> Plans & Upgrade
          </button>
          <button className={`${styles.navItem} ${activeTab === 'ai' ? styles.navActive : ''}`} onClick={() => setActiveTab('ai')} style={{ color: '#a78bfa', background: activeTab === 'ai' ? 'rgba(167,139,250,0.1)' : 'transparent' }}>
            <Zap size={18} /> AI Assistant
          </button>

          {userRole === 'admin' && (
            <Link href="/admin" className={styles.navItem} style={{ color: 'var(--accent-gold)', marginTop: '0.5rem', background: 'rgba(212, 175, 55, 0.05)' }}>
              <ShieldCheck size={18} /> Admin Control Panel
            </Link>
          )}

          <div className={styles.navDivider} style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '1rem 0' }} />
          <button
            className={styles.navItem}
            style={{ color: '#ef4444' }}
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
          >
            <LogOut size={18} /> Sign Out
          </button>
        </nav>
      </aside>

      <main className={styles.main}>
        {activeTab === 'no_brand' && (
          <div className={styles.activationNotice}>
            <Store size={48} color="var(--primary)" />
            <h2>Welcome to your Vendor Portal</h2>
            <p>You have been granted Vendor access! To start uploading products and tracking orders, you first need to set up your official Brand Profile.</p>
            <Link href="/onboarding" className="btn btn-primary btn-lg mt-4">
              Setup My Store Now <ArrowRight size={18} />
            </Link>
          </div>
        )}

        {activeTab === 'activation_pending' && (
          <div className={styles.activationNotice}>
            <Clock size={48} color="var(--primary)" />
            <h2>Application Under Review</h2>
            <p>Your brand registration is being reviewed by our admin team. This usually takes 24-48 hours. You will be notified once you are approved to pay the ₦2,000 activation fee.</p>
            <Link href="/" className="btn btn-primary">Back to Hub</Link>
          </div>
        )}

        {activeTab === 'activation_rejected' && (
          <div className={styles.activationNotice}>
            <AlertTriangle size={48} color="#ef4444" />
            <h2>Application Declined</h2>
            <p>Unfortunately, your brand application has been rejected at this time. Please contact support via WhatsApp if you believe this is a mistake.</p>
            <Link href="/" className="btn btn-ghost">Contact Support</Link>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Business Overview</h1>

            {isTrialActive && (
              <div className={`${styles.escrowBanner} mb-4`} style={{ background: 'var(--grad-brand-soft)', borderColor: 'var(--primary)', marginBottom: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
                <Zap className={styles.escrowIcon} style={{ color: 'var(--primary)' }} />
                <div className={styles.escrowText}>
                  <h4 style={{ color: 'var(--primary)' }}>"Power Week" Active ⚡</h4>
                  <p>You have UNLIMITED powers for the next <strong>{trialDaysLeft} days</strong>. Enjoy the full ABUAD experience!</p>
                </div>
              </div>
            )}

            {!isTrialActive && isSubActive && (
              <div className={`${styles.escrowBanner} mb-4`} style={{ background: 'var(--bg-200)', borderColor: 'var(--secondary)', marginBottom: '1.5rem' }}>
                <ShieldCheck className={styles.escrowIcon} style={{ color: 'var(--secondary)' }} />
                <div className={styles.escrowText}>
                  <h4 style={{ color: 'var(--secondary)' }}>{currentTier.toUpperCase()} Power Active</h4>
                  <p>Your subscription is active until {new Date(brand.subscription_expires_at).toLocaleDateString()}. <button onClick={() => setActiveTab('plans')} style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upgrade powers →</button></p>
                </div>
              </div>
            )}

            {!isTrialActive && !isSubActive && (
              <div className={`${styles.escrowBanner} mb-4`} style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', marginBottom: '1.5rem' }}>
                <AlertTriangle className={styles.escrowIcon} style={{ color: '#ef4444' }} />
                <div className={styles.escrowText}>
                  <h4 style={{ color: '#ef4444' }}>Low Brand Power</h4>
                  <p>Your trial/subscription has expired. <button onClick={() => setActiveTab('plans')} style={{ color: '#ef4444', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>Activate your powers now</button> to continue selling.</p>
                </div>
              </div>
            )}
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

            {permission === 'default' && (
              <div className={styles.escrowBanner} style={{ cursor: 'pointer', marginBottom: '2rem', borderStyle: 'solid', borderColor: 'var(--primary)', background: 'var(--primary-soft)' }} onClick={requestPermission}>
                <Bell className={styles.escrowIcon} style={{ color: 'var(--primary)' }} />
                <div className={styles.escrowText}>
                  <h4 style={{ color: 'var(--primary)' }}>Enable Real-time Alerts</h4>
                  <p>Get instant notification sounds on your phone/laptop when customers enquire about your products.</p>
                </div>
                <ArrowUpRight size={16} style={{ marginLeft: 'auto', color: 'var(--primary)' }} />
              </div>
            )}
            <div className={styles.statsGrid}>
              <div className={`${styles.statCard} ${styles.statCardVibrant}`}>
                <div className={styles.statHead}>
                  <Wallet size={20} color="var(--primary)" />
                  <span>Available Balance</span>
                </div>
                <div className={styles.statValue}>{formatPrice(wallet?.available_balance || 0)}</div>
                <div className={styles.statTrend}>
                  {wallet?.pending_balance > 0 && <span style={{ color: '#f59e0b' }}>{formatPrice(wallet.pending_balance)} pending</span>}
                </div>
                <div className={styles.growthBadge}><ArrowUpRight size={12} /> Live</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statHead}>
                  <TrendingUp size={20} color="#10b981" />
                  <span>Est. Revenue (30d)</span>
                </div>
                <div className={styles.statValue}>
                  {formatPrice(orders.filter(o => {
                    const diff = (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 3600 * 24);
                    return diff < 30 && ['paid', 'ready', 'picked_up', 'in_transit', 'delivered', 'confirmed', 'completed'].includes(o.status);
                  }).reduce((acc, curr) => acc + Number(curr.vendor_earning), 0))}
                </div>
                <div className={styles.statTrend}>Growth: {growthPercent}</div>
                <div className={styles.growthChart}>
                  {salesTrendData.map((h, i) => (
                    <div key={i} className={`${styles.growthBar} ${i === 6 ? styles.growthBarActive : ''}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statHead}>
                  <ShoppingCart size={20} color="#3b82f6" />
                  <span>Success Rate</span>
                </div>
                <div className={styles.statValue}>
                  {orders.length > 0 ? Math.round((orders.filter(o => o.status === 'completed' || o.status === 'confirmed').length / orders.length) * 100) : 0}%
                </div>
                <div className={styles.statTrend}>{orders.filter(o => o.status === 'cancelled').length} orders cancelled</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statHead}>
                  <Star size={20} color="var(--secondary)" />
                  <span>Avg. Rating</span>
                </div>
                <div className={styles.statValue}>{reviews.length > 0 ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1) : '5.0'}</div>
                <div className={styles.statTrend}>From {reviews.length} customer reviews</div>
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

            {userRole === 'admin' && (
              <div className={styles.adminQuickLink} style={{ marginTop: '2rem', padding: '2rem', borderRadius: '16px', background: 'var(--bg-300)', border: '2px solid var(--accent-gold)', boxShadow: '0 0 30px rgba(212, 175, 55, 0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
                <ShieldCheck size={48} color="var(--accent-gold)" />
                <div>
                  <h2 style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>Global Admin Console</h2>
                  <p style={{ color: 'var(--text-300)', maxWidth: '400px' }}>You have root access to manage all vendors, products, and financial transactions on the platform.</p>
                </div>
                <Link href="/admin" className="btn btn-primary" style={{ background: 'var(--accent-gold)', borderColor: 'var(--accent-gold)', color: '#000', fontWeight: 'bold', padding: '1rem 3rem' }}>ENTER ADMIN DASHBOARD</Link>
              </div>
            )}
          </div>
        )}

        {/* Store Settings Tab */}
        {activeTab === 'settings' && brand && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Store Settings</h1>
            <p className={styles.subtitle}>Manage your brand identity, contact details, and store policies.</p>

            <div className={styles.settingsGrid}>
              <div className={styles.settingsSection}>
                <h3>Brand Identity</h3>

                {/* Store Logo */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-300)' }}>Store Pic (Logo)</label>
                    <div style={{ width: '96px', height: '96px', borderRadius: '12px', background: 'var(--bg-300)', border: '2px solid var(--border)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {brand.logo_url ? <img src={brand.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Store size={28} color="var(--text-400)" />}
                      <label style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'var(--primary)', borderRadius: '50%', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Change logo">
                        {uploadingLogo ? <Loader2 size={12} className="anim-spin" /> : <Camera size={12} />}
                        <input type="file" hidden accept="image/*" onChange={handleLogoUpdate} disabled={uploadingLogo} />
                      </label>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className={styles.inputGroup}>
                      <label>Store Name</label>
                      <input type="text" defaultValue={brand.name} onBlur={(e) => handleUpdateSettings({ name: e.target.value })} />
                    </div>
                    <div className={styles.inputGroup} style={{ marginTop: '0.75rem' }}>
                      <label>WhatsApp Number</label>
                      <input type="text" defaultValue={brand.whatsapp_number} onBlur={(e) => handleUpdateSettings({ whatsapp_number: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Store Background / Cover */}
                <div className={styles.inputGroup}>
                  <label style={{ marginBottom: '0.5rem' }}>Store Background Pic (Cover Banner)</label>
                  <div
                    style={{ width: '100%', height: '160px', borderRadius: '12px', border: '2px dashed var(--border)', backgroundImage: brand.cover_url ? `url(${brand.cover_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', background: brand.cover_url ? undefined : 'var(--bg-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                    onClick={() => document.getElementById('coverBannerInput')?.click()}
                  >
                    {!brand.cover_url && (
                      <div style={{ textAlign: 'center', color: 'var(--text-400)' }}>
                        {uploadingMedia ? <Loader2 size={24} className="anim-spin" /> : <><Camera size={24} style={{ marginBottom: '0.5rem' }} /><p style={{ fontSize: '0.85rem' }}>Click to upload background banner</p></>}
                      </div>
                    )}
                    {brand.cover_url && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className={styles.coverHover}>
                        {uploadingMedia ? <Loader2 size={24} className="anim-spin" color="#fff" /> : <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Camera size={16} /> Change Background</span>}
                      </div>
                    )}
                    <input
                      id="coverBannerInput"
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={async (e) => {
                        if (e.target.files?.[0]) {
                          const { url } = await uploadFile(e.target.files[0], 'brand-assets', `cover-${brand.id}`);
                          if (url) handleUpdateSettings({ cover_url: url });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                  <label>Instagram / Portfolio Link</label>
                  <input
                    type="text"
                    defaultValue={brand.instagram_handle}
                    placeholder="@yourbrand or https://..."
                    onBlur={(e) => handleUpdateSettings({ instagram_handle: e.target.value })}
                  />
                </div>

                <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                  <label>Store Description</label>
                  <textarea
                    rows={4}
                    defaultValue={brand.description}
                    onBlur={(e) => handleUpdateSettings({ description: e.target.value })}
                  />
                </div>

                <div className={styles.settingsSection} style={{ marginTop: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <MapPin size={22} color="var(--primary)" />
                    <h3>Pickup Location</h3>
                  </div>
                  <p className={styles.formHint}>Set where delivery agents should pick up your goods.</p>
                  
                  <div className={styles.inputGroup}>
                    <label>Campus Location Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Afe Babalola Hall, Block A" 
                      defaultValue={brand.location_name}
                      onBlur={(e) => handleUpdateSettings({ location_name: e.target.value })}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.inputGroup}>
                      <label>Latitude (GPS)</label>
                      <input 
                        type="number" 
                        step="0.000001"
                        placeholder="7.612..."
                        defaultValue={brand.latitude}
                        onBlur={(e) => handleUpdateSettings({ latitude: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Longitude (GPS)</label>
                      <input 
                        type="number" 
                        step="0.000001"
                        placeholder="5.234..."
                        defaultValue={brand.longitude}
                        onBlur={(e) => handleUpdateSettings({ longitude: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((pos) => {
                        handleUpdateSettings({ 
                          latitude: pos.coords.latitude, 
                          longitude: pos.coords.longitude 
                        });
                        alert('Live location captured!');
                      });
                    }
                  }}>
                    <Navigation size={14} /> Use My Current Location
                  </button>
                </div>
              </div>

              {/* Payout Settings */}
              <div className={styles.settingsSection}>
                <h3>Payout Bank Details</h3>
                <p className={styles.formHint}>Your earnings will be automatically sent to this account via Paystack.</p>
                
                {brand.recipient_code ? (
                  <div className={styles.bankSuccessCard}>
                    <ShieldCheck size={24} color="var(--success)" />
                    <div>
                      <p><strong>{brand.account_name}</strong></p>
                      <span>{brand.bank_account_number} ({brand.bank_name})</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                       if (confirm('Are you sure you want to change your payout account? This will require re-verification.')) {
                         setBrand({...brand, recipient_code: null});
                       }
                    }}>Change</button>
                  </div>
                ) : (
                  <div className={styles.bankSetupForm}>
                    <div className={styles.inputGroup}>
                      <label>Bank</label>
                      <select id="setupBankCode">
                        <option value="">Select Bank</option>
                        {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Account Number</label>
                      <input id="setupAccNum" type="text" maxLength={10} placeholder="10-digit account number" />
                    </div>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => {
                        const code = (document.getElementById('setupBankCode') as HTMLSelectElement).value;
                        const num = (document.getElementById('setupAccNum') as HTMLInputElement).value;
                        handleVerifyBank(num, code);
                      }}
                      disabled={verifyingBank}
                    >
                      {verifyingBank ? <Loader2 className="anim-spin" size={16} /> : 'Verify & Link Account'}
                    </button>
                  </div>
                )}
                <p className={styles.fieldNote}>* We use Paystack for secure, real-time verification and payouts.</p>
              </div>

              {/* Store Policies */}
              <div className={styles.settingsSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <ShieldCheck size={24} color="var(--primary)" />
                  <h3>Subscription & Brand Power</h3>
                </div>

                <div className={styles.compactPricingGrid}>
                  {subscriptionRates.map((tier) => (
                    <div key={tier.id} className={`${styles.compactPricingCard} ${currentTier === tier.id ? styles.activeTierCard : ''}`}>
                      <div className={styles.tierHeader}>
                        {getIcon(tier.id)}
                        <div>
                          <h4>{tier.name}</h4>
                          <span className={styles.tierPrice}>₦{tier.price.toLocaleString()}/mo</span>
                        </div>
                      </div>
                      <ul className={styles.tierFeaturesMini}>
                        {(tier.features || []).map((f: string, i: number) => <li key={i}><CheckCircle size={12} /> {f}</li>)}
                      </ul>
                      <button
                        className={`btn ${tier.popular ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        style={{ width: '100%', marginTop: 'auto' }}
                        onClick={() => handleSubscribe(tier)}
                        disabled={!!paying || currentTier === tier.id}
                      >
                        {paying === tier.id ? <Loader2 className="anim-spin" size={14} /> : (currentTier === tier.id ? 'Current Plan' : `Activate ${tier.name}`)}
                      </button>
                    </div>
                  ))}
                </div>

                <div className={styles.boostBanner} style={{ marginTop: '2rem' }}>
                  <div className={styles.boostContent}>
                    <Zap size={20} color="#f59e0b" />
                    <div>
                      <h4>Need a temporary Boost?</h4>
                      <p>Get priority placement in searches and discovery for ₦1,000/week.</p>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => alert('Boost system integration coming in next update!')}>Boost Now</button>
                </div>
              </div>
            </div>
            {isSettingsLoading && (
              <div className={styles.settingsSaving}>
                <Loader2 className="anim-spin" size={16} /> Saving changes...
              </div>
            )}
          </div>
        )}
        {activeTab === 'orders' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Order Management</h1>
            <p className={styles.subtitle}>Process orders quickly to get your escrow funds released faster.</p>

            <div className={styles.orderList}>
              {orders.length > 0 ? (
                orders.map((order) => (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <div>
                        <span className={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</span>
                        <span className={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</span>
                        <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-400)' }}>
                          👤 {order.users?.name || order.users?.email || `Customer ${order.customer_id?.slice(0, 6)}`}
                        </span>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => handlePrintInvoice(order)}>
                        <FileText size={14} /> Print Invoice
                      </button>
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
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }} onClick={() => {
                                const reason = prompt('Please provide a reason for rejection:');
                                if (reason) updateOrderStatus(order.id, 'cancelled', { rejectionReason: reason });
                              }}>Reject</button>
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
                              <p>Dispatch Delivery Agent:</p>
                              <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => updateOrderStatus(order.id, 'ready')}>Use Platform Delivery Agent</button>
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
                        {(order.status === 'ready' || order.status === 'picked_up' || order.status === 'in_transit') && order.deliveries?.[0] && (
                          <div className={styles.agentInfo} style={{ marginTop: '0.5rem', background: 'var(--bg-300)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                            <p style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '0.25rem' }}>🚚 Assigned Agent:</p>
                            <p><strong>{order.deliveries[0].users?.name || 'Assigned'}</strong></p>
                            <p>{order.deliveries[0].users?.phone}</p>
                            {order.deliveries[0].status === 'picked_up' && (
                              <p style={{ marginTop: '0.5rem', color: 'var(--success)' }}>Status: In Transit to Customer</p>
                            )}
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
                            {order.expires_at && new Date(order.expires_at) < new Date() ? (
                               <span className={`${styles.statusBadge}`} style={{ background: '#ef4444', color: '#fff' }}>
                                 EXPIRED / CANCELLED
                               </span>
                            ) : (
                               <span className={`${styles.statusBadge}`} style={{ background: 'var(--bg-200)' }}>
                                 Pending Payment
                               </span>
                            )}
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

        {/* Marketing Tab */}
        {activeTab === 'marketing' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Marketing & Promotions</h1>
            <p className={styles.subtitle}>Create promo codes to boost your store's attraction.</p>

            <div className={styles.promoForm}>
              <h3>Create New Promo Code</h3>
              <form onSubmit={handleCreatePromo} className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <input name="code" type="text" placeholder="CODE (e.g. SAVE10)" required />
                </div>
                <div className={styles.inputGroup}>
                  <select name="type">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₦)</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <input name="value" type="number" placeholder="Value" required />
                </div>
                <div className={styles.inputGroup} style={{ flex: '1 1 250px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>Apply To (Optional)</label>
                  <select name="product_id">
                    <option value="">All Products (General)</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">Create Code</button>
              </form>
            </div>

            <div className={styles.promoList} style={{ marginTop: '2rem' }}>
              <h3>Active Promo Codes</h3>
              {promoCodes.length > 0 ? (
                promoCodes.map(promo => (
                  <div key={promo.id} className={styles.promoCard}>
                    <div className={styles.promoInfo}>
                      <span className={styles.promoCodeText}>{promo.code}</span>
                      <span>{promo.type === 'percentage' ? `${promo.value}% Off` : `${formatPrice(promo.value)} Off`}</span>
                    </div>
                    <button 
                      className={styles.removeBtn}
                      onClick={async () => {
                        if (!confirm(`Delete promo code "${promo.code}"?`)) return;
                        const { error } = await supabase.from('promo_codes').delete().eq('id', promo.id);
                        if (!error) {
                          setPromoCodes(prev => prev.filter(p => p.id !== promo.id));
                          alert('Promo code deleted!');
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.emptyText}>No promo codes created yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Customer Reviews</h1>
            <p className={styles.subtitle}>Manage your ratings and respond to customer feedback.</p>

            <div className={styles.reviewList}>
              {reviews.length > 0 ? (
                reviews.map(review => (
                  <div key={review.id} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewMain}>
                        <strong>{review.user?.name || 'Anonymous'}</strong> on <span>{review.product?.title}</span>
                        <div className={styles.stars}>
                          {new Array(5).fill(0).map((_, i) => (
                            <Star key={i} size={14} fill={i < review.rating ? "var(--secondary)" : "none"} stroke={i < review.rating ? "var(--secondary)" : "#ccc"} />
                          ))}
                        </div>
                      </div>
                      <span className={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className={styles.reviewText}>{review.comment}</p>
                    {review.vendor_reply ? (
                      <div className={styles.vendorReply}>
                        <strong>You replied:</strong>
                        <p>{review.vendor_reply}</p>
                      </div>
                    ) : (
                      <div className={styles.replyForm}>
                        <textarea id={`reply-${review.id}`} placeholder="Reply to this review..." rows={2}></textarea>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const reply = (document.getElementById(`reply-${review.id}`) as HTMLTextAreaElement).value;
                            if (reply) handleReviewReply(review.id, reply);
                          }}
                        >
                          Submit Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className={styles.emptyText}>No reviews yet.</p>
              )}
            </div>
          </div>
        )}
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
                  Manage your listings. {isTrialActive ? '⚡ Trial (Unlimited)' : `${products.filter(p => !p.is_draft).length} / ${productLimit} products used.`}
                </p>
              </div>
              <div className={styles.tabActions}>
                <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                  <input type="file" accept=".csv" hidden onChange={handleBulkUpload} />
                  <FileText size={18} /> Bulk Upload (CSV)
                </label>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (products.filter(p => !p.is_draft).length >= productLimit) {
                      alert(`You have reached your limit of ${productLimit} products. Upgrade your power level to list more!`);
                      setActiveTab('plans');
                    } else {
                      setIsAddingProduct(true);
                    }
                  }}
                >
                  <Plus size={18} /> Add New Product
                </button>
              </div>
            </div>

            {isAddingProduct && (
              <div className={styles.formContainer}>
                <div className={styles.formHead}>
                  <h2>{editingProduct ? 'Edit Product' : 'List New Product'}</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }}>Cancel</button>
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
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.inputGroup}>
                      <label>Sale Price (₦) - What customers pay</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        required
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Original Price (₦) - Optional "Discount" tag</label>
                      <input
                        type="number"
                        placeholder="e.g. 15000"
                        value={newProduct.originalPrice}
                        onChange={(e) => setNewProduct({ ...newProduct, originalPrice: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.inputGroup}>
                      <label>Category</label>
                      <select
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      >
                        <option>Clothing</option>
                        <option>Mens-Fashion</option>
                        <option>Womens-Fashion</option>
                        <option>Traditional-Wear</option>
                        <option>Footwear</option>
                        <option>Accessories</option>
                        <option>Bags</option>
                        <option>Handmade</option>
                      </select>
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Total Global Stock</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={newProduct.stockCount}
                        onChange={(e) => setNewProduct({ ...newProduct, stockCount: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Variants Section */}
                  <div className={styles.variantsSection}>
                    <div className={styles.sectionHead}>
                      <label>Product Variants (Sizes, Colors, etc.)</label>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={addVariant}>
                        <Plus size={14} /> Add Variant
                      </button>
                    </div>
                    <div className={styles.variantsGrid}>
                      {newProduct.variants.map((v, i) => (
                        <div key={i} className={styles.variantRow}>
                          <select
                            value={v.type}
                            onChange={(e) => {
                              const updated = [...newProduct.variants];
                              updated[i].type = e.target.value;
                              setNewProduct({ ...newProduct, variants: updated });
                            }}
                          >
                            <option>Size</option>
                            <option>Color</option>
                            <option>Material</option>
                          </select>
                          <input
                            type="text"
                            placeholder="e.g. XL or Maroon"
                            value={v.value}
                            onChange={(e) => updateVariant(i, e.target.value)}
                          />
                          <button type="button" onClick={() => removeVariant(i)} className={styles.removeBtn}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.formRow} style={{ marginTop: '2rem' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setNewProduct({ ...newProduct, isDraft: true });
                        handleProductSubmit(new window.Event('submit') as any);
                      }}
                    >
                      Save as Draft
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ flex: 2 }}
                      onClick={() => setNewProduct({ ...newProduct, isDraft: false })}
                    >
                      List for Sale
                    </button>
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
                    <label>Product Gallery (Vivid Photos)</label>
                    <div className={styles.vividMediaGrid}>
                      {newProduct.mediaUrls.map((url, idx) => (
                        <div key={idx} className={styles.vividMediaItem}>
                          {url.toLowerCase().match(/\.(mp4|webm|mov|ogg)$/) || url.includes('video') ? (
                            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                          ) : (
                            <img src={url} alt={`Preview ${idx}`} />
                          )}
                          <button
                            type="button"
                            className={styles.removeMedia}
                            onClick={() => setNewProduct(prev => ({ ...prev, mediaUrls: prev.mediaUrls.filter((_, i) => i !== idx) }))}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {newProduct.mediaUrls.length < 5 && (
                        <label className={styles.vividUploadTrigger} style={{ opacity: uploadingMedia ? 0.7 : 1, pointerEvents: uploadingMedia ? 'none' : 'auto' }}>
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            hidden
                            disabled={uploadingMedia}
                            onChange={(e) => handleProductMediaUpload(e)}
                          />
                          {uploadingMedia ? (
                            <><span className="spinner" style={{ width: 18, height: 18, display: 'inline-block' }} /></>
                          ) : (
                            <><Upload size={20} /><span>Add Photo</span></>
                          )}
                        </label>
                      )}
                    </div>
                    <p className={styles.formHint}>Upload up to 5 high-quality photos to make your product stand out.</p>
                  </div>

                  <div className={styles.formFooter}>
                    <div className={styles.billingNote}>
                      {products.filter(p => !p.is_draft).length >= 5 ? (
                        <p>Listing Fee: <strong>₦200</strong> (Wallet: {formatPrice(brand?.wallet_balance || 0)})</p>
                      ) : (
                        <p>Listing: <strong>FREE</strong> ({5 - products.filter(p => !p.is_draft).length} credits remaining)</p>
                      )}
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                      {loading ? 'Processing...' : (editingProduct ? 'Update Product' : 'Post Product to Marketplace')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className={styles.inventoryGrid}>
              {products.filter(p => !p.is_draft).map(p => (
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
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setNewProduct({
                        title: p.title || '',
                        description: p.description || '',
                        price: p.price ? p.price.toString() : '',
                        originalPrice: p.original_price ? p.original_price.toString() : '',
                        category: p.category || 'Clothing',
                        stockCount: p.stock_count ? p.stock_count.toString() : '10',
                        mediaUrls: p.media_urls || [],
                        imageUrl: p.image_url || '',
                        videoUrl: p.video_url || '',
                        variants: p.variants || [],
                        isDraft: p.is_draft || false
                      });
                      setEditingProduct(p);
                      setIsAddingProduct(true);
                    }}>Edit</button>
                    <button className={`btn btn-ghost btn-sm ${styles.shareButton}`} onClick={() => handleShareProduct(p.id)}>
                      <Share2 size={14} /> Share
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={async () => {
                         if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
                         
                         // 1. Storage Cleanup (Images & Videos)
                         const filesToDelete: string[] = [];
                         if (p.image_url) filesToDelete.push(p.image_url);
                         if (p.video_url) filesToDelete.push(p.video_url);
                         if (p.media_urls && p.media_urls.length > 0) filesToDelete.push(...p.media_urls);
                         
                         // Extract paths from URLs
                         const paths = filesToDelete.map(url => {
                           try {
                             const parts = url.split('/public/');
                             if (parts.length > 1) return parts[1].split('?')[0];
                             return null;
                           } catch { return null; }
                         }).filter(Boolean) as string[];

                         if (paths.length > 0) {
                           // We don't await this to keep the UI snappy, but we trigger it
                           for (const path of paths) {
                             const bucket = path.split('/')[0];
                             const filePath = path.split('/').slice(1).join('/');
                             supabase.storage.from(bucket).remove([filePath]);
                           }
                         }

                         // 2. DB Deletion
                         const { error } = await supabase.from('products').delete().eq('id', p.id);
                         if (error) {
                           if (error.message.includes('foreign key constraint')) {
                             const { error: softError } = await supabase.from('products').update({ is_draft: true, stock_count: 0 }).eq('id', p.id);
                             if (softError) alert('Delete failed: ' + softError.message);
                             else {
                               alert('Product hidden from buyers because it is tied to existing orders.');
                               updateGlobalProduct(p.id, { is_draft: true, stock_count: 0 });
                             }
                           } else {
                             alert('Delete failed: ' + error.message);
                           }
                         } else {
                            // Immediate UI update for hard delete
                            updateGlobalProduct(p.id, { is_draft: true }); // Using is_draft as a flag to hide it
                         }
                      }}
                    >Delete</button>
                  </div>
                </div>
              ))}
              {products.filter(p => !p.is_draft).length === 0 && <p className={styles.emptyText}>No products yet.</p>}
            </div>
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && brand && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div>
                <h1 className={styles.title}>Service Listings</h1>
                <p className={styles.subtitle}>Manage your fashion services like tailoring, styling, or hair.</p>
              </div>
              <button className="btn btn-primary" onClick={() => alert('Service creation coming in next refinement!')}>
                <Scissors size={18} /> Add Service
              </button>
            </div>

            <div className={styles.inventoryGrid}>
              {brand.brand_type === 'product' && (
                <div className={styles.emptyNotice}>
                  <Info size={32} />
                  <p>You currently have a 'Product-only' account. Update your settings to offer services.</p>
                </div>
              )}
              {brand.brand_type !== 'product' && (
                <p className={styles.emptyText}>No services listed yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Reels Tab */}
        {activeTab === 'reels' && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div>
                <h1 className={styles.title}>Collection Reels</h1>
                <p className={styles.subtitle}>Upload short videos of your latest designs to engage customers vividly.</p>
              </div>
              <label className="btn btn-primary" style={{ opacity: uploadingReel ? 0.7 : 1, pointerEvents: uploadingReel ? 'none' : 'auto' }}>
                <input type="file" accept="video/*" hidden onChange={handleReelUpload} disabled={uploadingReel} />
                {uploadingReel ? <><span className="spinner" style={{ width: 16, height: 16, display: 'inline-block', marginRight: '0.5rem' }} />Uploading...</> : <><Video size={18} /> Upload Reel</>}
              </label>
            </div>

            <div className={styles.reelsGrid}>
              {reels.map(reel => (
                <div key={reel.id} className={styles.reelCard}>
                  <video src={reel.video_url} loop muted onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                  <div className={styles.reelOverlay}>
                    <button className={styles.reelDelete} onClick={async () => {
                      if (confirm('Delete this reel?')) {
                        const { error } = await supabase.from('brand_reels').delete().eq('id', reel.id);
                        if (!error) setReels(prev => prev.filter(r => r.id !== reel.id));
                      }
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {reels.length === 0 && (
                <div className={styles.emptyNotice}>
                  <Video size={48} style={{ opacity: 0.2 }} />
                  <p>No collection reels yet. Videos boost engagement by 300%!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && brand && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Smart Analytics</h1>
            <p className={styles.subtitle}>Data-driven insights to grow your fashion brand.</p>

            <div className={styles.analyticsGrid}>
              <div className={`card ${styles.chartCard}`}>
                <h3>Weekly Revenue Growth</h3>
                <div className={styles.vividChart}>
                  {[45, 78, 52, 91, 63, 85, 95].map((h, i) => (
                    <div key={i} className={styles.chartBarWrap}>
                      <div className={styles.chartBar} style={{ height: `${h}%`, background: i === 6 ? 'var(--primary)' : 'var(--bg-300)' }}>
                        <span className={styles.barVal}>{h}k</span>
                      </div>
                      <span className={styles.barLabel}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.statsCardsMini}>
                <div className={`card ${styles.miniStat}`}>
                  <span>Conversion Rate</span>
                  <h3>3.2%</h3>
                  <p style={{ color: 'var(--success)' }}>+0.4% from last week</p>
                </div>
                <div className={`card ${styles.miniStat}`}>
                  <span>Average Order Value</span>
                  <h3>{formatPrice(4500)}</h3>
                  <p>Steady growth</p>
                </div>
              </div>
            </div>

            <div className={styles.analyticsSection}>
              <h3>Best Selling Products</h3>
              <div className={styles.bestSellersList}>
                {products.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0)).slice(0, 3).map(p => (
                  <div key={p.id} className={styles.bestSellerItem}>
                    <img src={p.media_urls?.[0]} alt="" />
                    <div className={styles.bsInfo}>
                      <h4>{p.title}</h4>
                      <p>{p.sales_count || 0} sales total</p>
                    </div>
                    <div className={styles.bsProgress}>
                      <div className={styles.progressBar} style={{ width: `${Math.min(100, (p.sales_count || 0) * 5)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && brand && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Payments & Wallet</h1>
            <p className={styles.subtitle}>Manage your earnings and request withdrawals.</p>

            <div className={styles.walletHero}>
              <div className={styles.walletMain}>
                <span>Available Balance</span>
                <h2>{formatPrice(wallet?.available_balance || 0)}</h2>
                <div className={styles.walletActions}>
                  <button
                    className="btn btn-primary"
                    disabled={!wallet?.available_balance || wallet.available_balance < 1000 || !brand.bank_account_number}
                    onClick={() => setIsWithdrawing(true)}
                  >
                    Withdraw Funds
                  </button>
                </div>
                {!brand.bank_account_number && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>Update your bank details in Settings to withdraw.</p>}
                <p className={styles.minWithdrawal}>Minimum withdrawal: ₦1,000</p>
              </div>

              <div className={styles.walletEscrow} style={{ width: '100%', maxWidth: 'none', flexDirection: 'row', gap: '2rem', padding: '1.5rem', justifyContent: 'space-around' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Pending (Escrow)</span>
                  <h3 style={{ fontSize: '1.2rem', margin: '0.25rem 0', color: '#f59e0b' }}>{formatPrice(wallet?.pending_balance || 0)}</h3>
                  <p style={{ fontSize: '0.7rem' }}>Held for 24hrs post-delivery</p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                <div>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Lifetime Earnings</span>
                  <h3 style={{ fontSize: '1.2rem', margin: '0.25rem 0', color: 'var(--primary)' }}>
                    {formatPrice(wallet?.total_earnings || 0)}
                  </h3>
                  <p style={{ fontSize: '0.7rem' }}>Total funds earned</p>
                </div>
              </div>
            </div>

            {isWithdrawing && (
              <div className={styles.formContainer} style={{ marginTop: '2rem' }}>
                <div className={styles.formHead}>
                  <h2>Request Payout</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setIsWithdrawing(false)}>Cancel</button>
                </div>
                <form onSubmit={handleWithdrawalRequest} className={styles.productForm}>
                  <div className={styles.inputGroup}>
                    <label>Amount to Withdraw (₦)</label>
                    <input name="amount" type="number" placeholder="0.00" autoFocus required />
                    <p className={styles.formHint}>Available: <strong>{formatPrice(wallet?.available_balance || 0)}</strong></p>
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Bank Account Details</label>
                    <div className={styles.bankPreview}>
                      <CreditCard size={18} />
                      <div>
                        <p>{brand?.bank_account_name || brand?.bank_name || 'No Bank Added'}</p>
                        <span>{brand?.bank_account_number || 'Update in settings'}</span>
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-lg" disabled={!brand?.bank_account_number || loading}>
                    {loading ? <Loader2 className="anim-spin" size={18} /> : 'Confirm Withdrawal Request'}
                  </button>
                </form>
              </div>
            )}

            <div className={styles.transactionSection}>
              <h3>Payout Requests History</h3>
              <div className={styles.transactionTable}>
                {withdrawalRequests.map(req => (
                  <div key={req.id} className={styles.txRow}>
                    <div className={styles.txIcon}>
                      <CreditCard size={16} color="var(--primary)" />
                    </div>
                    <div className={styles.txInfo}>
                      <p>Payout to {req.bank_details?.bankName}</p>
                      <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {new Date(req.created_at).toLocaleDateString()}
                        <span className={`badge badge-${req.status}`}>{req.status}</span>
                      </span>
                    </div>
                    <div className={`${styles.txAmount} ${styles.txNeg}`}>
                      {formatPrice(req.amount_requested)}
                    </div>
                  </div>
                ))}
                {withdrawalRequests.length === 0 && <p className={styles.emptyText}>No payout requests yet.</p>}
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
        {/* Marketing Tab */}
        {activeTab === 'marketing' && brand && (
          <div className={styles.tabContent}>
            <h1 className={styles.title}>Marketing & Promos</h1>
            <p className={styles.subtitle}>Create excitement and drive sales with promo codes and spotlights.</p>

            <div className={styles.promoGrid}>
              <div className={styles.promoOption}>
                <div className={styles.promoIcon}><Tag size={24} color="var(--primary)" /></div>
                <h3>Promo Codes</h3>
                <p>Offer discounts to your loyal campus customers.</p>
                <button className="btn btn-ghost btn-sm" onClick={() => alert('Integrated into Half Power tier!')}>Manage Codes</button>
              </div>
              <div className={styles.promoOption}>
                <div className={styles.promoIcon}><Zap size={24} color="#f59e0b" /></div>
                <h3>Billboard Boost</h3>
                <p>Get featured on the homepage "Gold Collection" for ₦500/week.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('plans')}>Boost Now</button>
              </div>
              <div className={styles.promoOption} style={{ border: '1px solid var(--secondary)' }}>
                <div className={styles.promoIcon}><Bell size={24} color="var(--secondary)" /></div>
                <h3>Campus Nudge</h3>
                <p>Send a real-time smart notification to all your followers.</p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    if (brand.subscription_tier === 'quarter') return alert('Upgrade to Half Power to use Nudges!');
                    const msg = prompt('Enter the message for your followers:');
                    if (msg) {
                      const res = await fetch('/api/vendor/nudge', {
                        method: 'POST',
                        body: JSON.stringify({ brandId: brand.id, ownerId: brand.owner_id, message: msg })
                      });
                      const data = await res.json();
                      if (data.success) alert(`Nudge sent to ${data.count} followers!`);
                      else alert(data.error);
                    }
                  }}
                >
                  Send Nudge 🚀
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PLANS & UPGRADE TAB — Credit Rate Checkout
        ══════════════════════════════════════════════════ */}
        {activeTab === 'plans' && (
          !brand ? (
            <div className={styles.activationNotice}>
              <Store size={48} color="var(--primary)" />
              <h2>No Brand Profile Found</h2>
              <p>You need to set up your official store profile before you can choose a power plan or boost your listings.</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('overview')}>
                Go to Overview & Setup
              </button>
            </div>
          ) : (
            <div className={styles.tabContent}>
              <h1 className={styles.title}>Plans & Upgrade</h1>
              <p style={{ color: 'var(--text-300)', marginBottom: '2rem' }}>
                Choose a credit rate plan that fits your hustle. All plans unlock vendor superpowers instantly upon successful payment via Paystack.
              </p>

              {/* ── Current Status Banner ── */}
              <div style={{ background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1.5rem' }}>
                  {currentTier === 'full' ? '👑' : currentTier === 'half' ? '🚀' : currentTier === 'quarter' ? '🎯' : '🌱'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.25rem' }}>
                    {userRole === 'admin' ? 'Admin — Unlimited Access (No Fees)' :
                      isTrialActive ? `Free Trial Active — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining` :
                        isSubActive ? `Current Plan: ${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Power` :
                          'No Active Plan — Free mode (limited access)'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-400)' }}>
                    {isSubActive && brand?.subscription_expires_at
                      ? `Renews on ${new Date(brand.subscription_expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`
                      : userRole !== 'admin' ? 'Subscribe below to unlock full vendor capabilities' : 'You have root access to all platform features'}
                  </div>
                </div>
              </div>

              {/* ── Credit Rate Plans ── */}
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-100)' }}>
                💳 Credit Rate Plans
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
                {subscriptionRates.map((tier: any) => {
                  const isActive = isSubActive && brand?.subscription_tier === tier.id;
                  return (
                    <div
                      key={tier.id}
                      style={{
                        background: isActive ? 'var(--primary-soft)' : 'var(--bg-300)',
                        border: `2px solid ${isActive ? 'var(--primary)' : tier.popular ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: '16px',
                        padding: '1.75rem',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                    >
                      {tier.popular && !isActive && (
                        <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#000', fontSize: '0.72rem', fontWeight: 800, padding: '0.3rem 1rem', borderRadius: '999px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          MOST POPULAR
                        </div>
                      )}
                      {isActive && (
                        <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#000', fontSize: '0.72rem', fontWeight: 800, padding: '0.3rem 1rem', borderRadius: '999px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          ✓ ACTIVE
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.75rem' }}>{getIcon(tier.id)}</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: tier.color || 'var(--primary)' }}>{tier.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-400)' }}>{tier.tagline}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-100)' }}>
                          ₦{tier.price.toLocaleString()}
                        </span>
                        <span style={{ color: 'var(--text-400)', fontSize: '0.9rem' }}>{tier.period}</span>
                      </div>

                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(tier.features || ['Listing powers', 'Basic Analytics', 'Support']).map((f: string, i: number) => (
                          <li key={i} style={{ fontSize: '0.85rem', color: f.startsWith('✅') ? 'var(--text-200)' : 'var(--text-500)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={14} color="var(--primary)" /> {f}
                          </li>
                        ))}
                      </ul>

                      <button
                        className="btn btn-primary"
                        disabled={paying === tier.id || isActive}
                        onClick={() => handleSubscribe({ id: tier.id, price: tier.price })}
                        style={{
                          marginTop: 'auto',
                          background: isActive ? 'transparent' : `linear-gradient(135deg, ${tier.color || 'var(--primary)'}, ${tier.color || 'var(--primary)'}cc)`,
                          border: isActive ? `1px solid ${tier.color || 'var(--primary)'}` : 'none',
                          color: isActive ? (tier.color || 'var(--primary)') : '#000',
                          fontWeight: 700,
                        }}
                      >
                        {paying === tier.id ? <><Loader2 size={16} className="spin" /> Processing…</> :
                          isActive ? '✓ Current Plan' : `Subscribe — ₦${tier.price.toLocaleString()}/mo`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* ── Boost Store Section ── */}
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-100)' }}>
                ⚡ Viral Boosters
              </h2>
              <p style={{ color: 'var(--text-400)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                One-time boosts to increase your store's visibility on the marketplace.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Billboard Boost */}
                <div style={{ background: 'var(--bg-300)', border: '2px solid var(--accent-gold)', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.5rem', background: 'var(--accent-gold)', color: '#000', fontSize: '0.6rem', fontWeight: 900 }}>TRENDY BOARD</div>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📢</div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--accent-gold)' }}>Campus Billboard</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-400)', marginBottom: '1rem' }}>Get featured on the main homepage "The Gold Collection" billboard for 7 days.</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 900, color: '#fff' }}>₦500 <small>/week</small></span>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSubscribe({ id: 'billboard_boost', price: 500 })}>Activate ⚡</button>
                  </div>
                </div>

                {boostRates.map(boost => (
                  <div key={boost.id} style={{ background: 'var(--bg-300)', border: `1px solid ${boost.popular ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '14px', padding: '1.5rem', position: 'relative' }}>
                    {boost.popular && (
                      <div style={{ position: 'absolute', top: '-12px', right: '1rem', background: 'var(--primary)', color: '#000', fontSize: '0.68rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: '999px' }}>BEST VALUE</div>
                    )}
                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{getIcon(boost.id)}</div>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{boost.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-400)', marginBottom: '0.5rem' }}>{boost.desc}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-500)', marginBottom: '1.25rem' }}>Duration: {boost.duration}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary)' }}>₦{boost.price.toLocaleString()}</span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={paying === boost.id}
                        onClick={() => handleSubscribe({ id: boost.id, price: boost.price })}
                        style={{ fontWeight: 700 }}
                      >
                        {paying === boost.id ? <><Loader2 size={14} className="spin" /> Paying…</> : 'Boost Now →'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Trial & Admin Notes ── */}
              {isTrialActive && (
                <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '12px' }}>
                  <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '0.5rem' }}>🎁 Free Trial Still Active</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-400)' }}>
                    You have <strong style={{ color: '#fff' }}>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong> left on your free Full Power trial.
                    Subscribe before it expires to keep your powers uninterrupted.
                  </p>
                </div>
              )}
            </div>
          )
        )}

        {/* ─── AI Assistant Settings Tab ─── */}
        {activeTab === 'ai' && (
          <div style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>✨ AI Assistant <span style={{ fontSize: '0.7rem', color: 'var(--primary)', verticalAlign: 'middle', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: '4px' }}>v3.1 LIVE</span></h2>
              <p style={{ color: 'var(--text-400)', fontSize: '0.9rem' }}>Your AI Copilot helps you manage your store, guides customers automatically, and keeps your shop running even when you're offline.</p>
            </div>

            {/* Master Toggle */}
            <div style={{ background: 'var(--bg-200)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.25rem', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🤖 Enable AI Copilot</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-400)' }}>Master switch. Turns the AI on or off for your entire store.</div>
                </div>
                <button
                  onClick={() => handleUpdateAiSettings({ ai_enabled: !aiSettings?.ai_enabled })}
                  style={{ width: 52, height: 28, borderRadius: '999px', border: 'none', cursor: 'pointer', transition: 'background 0.3s', background: aiSettings?.ai_enabled ? '#7c3aed' : 'var(--bg-300)', position: 'relative', flexShrink: 0 }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left 0.3s', left: aiSettings?.ai_enabled ? 26 : 4 }} />
                </button>
              </div>
            </div>

            {/* Auto-Reply Toggle */}
            <div style={{ background: 'var(--bg-200)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.25rem', border: '1px solid rgba(167,139,250,0.2)', opacity: aiSettings?.ai_enabled ? 1 : 0.5, pointerEvents: aiSettings?.ai_enabled ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>💬 Auto-Reply to Customers</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-400)' }}>When enabled, the AI automatically answers customer messages about your products — even when you're offline. Replies show a ✨ AI badge.</div>
                </div>
                <button
                  onClick={() => handleUpdateAiSettings({ auto_reply_enabled: !aiSettings?.auto_reply_enabled })}
                  style={{ width: 52, height: 28, borderRadius: '999px', border: 'none', cursor: 'pointer', transition: 'background 0.3s', background: aiSettings?.auto_reply_enabled ? '#7c3aed' : 'var(--bg-300)', position: 'relative', flexShrink: 0 }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left 0.3s', left: aiSettings?.auto_reply_enabled ? 26 : 4 }} />
                </button>
              </div>
            </div>

            {/* Custom Instructions */}
            <div style={{ background: 'var(--bg-200)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid rgba(167,139,250,0.2)', opacity: aiSettings?.ai_enabled ? 1 : 0.5, pointerEvents: aiSettings?.ai_enabled ? 'auto' : 'none' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>📝 Custom AI Instructions</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-400)', marginBottom: '0.75rem' }}>Tell the AI how to represent your brand. E.g. "Always greet customers with 'Hey boss!'", "Never negotiate on prices", "Speak in a friendly, casual tone".</div>
              <textarea
                rows={4}
                value={aiSettings?.custom_instructions || ''}
                onChange={e => setAiSettings({ ...aiSettings, custom_instructions: e.target.value })}
                placeholder="e.g. Always be friendly and end replies with 'Shop now at our store!'"
                style={{ width: '100%', background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.85rem', color: '#fff', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => handleUpdateAiSettings({ custom_instructions: aiSettings?.custom_instructions })}
                disabled={isSettingsLoading}
                className="btn btn-primary"
                style={{ marginTop: '0.75rem' }}
              >
                {isSettingsLoading ? <Loader2 size={14} className="anim-spin" /> : null} Save Instructions
              </button>
            </div>

            {/* Open Copilot CTA */}
            <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(167,139,250,0.08))', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(167,139,250,0.25)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
              <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Talk to your Copilot</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-400)', marginBottom: '1rem' }}>Ask it anything: "What are my earnings?", "How do I add a product?", "Why is my balance pending?"</div>
              <button onClick={() => setShowCopilot(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', border: 'none' }}>
                Open AI Chat ✨
              </button>
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
        <button className={`${styles.mobNavItem} ${activeTab === 'plans' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('plans')}>
          <Crown className={styles.mobNavIcon} />
          <span>Plans</span>
        </button>
        <button className={`${styles.mobNavItem} ${activeTab === 'settings' ? styles.mobNavActive : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings className={styles.mobNavIcon} />
          <span>Config</span>
        </button>
      </nav>

      {/* ─── AI Copilot Floating Widget ─── */}
      {showCopilot && (
        <div style={{
          position: 'fixed', bottom: '6rem', right: '1.5rem', width: '360px', maxHeight: '500px',
          background: 'var(--bg-200)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(167,139,250,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9999,
          backdropFilter: 'blur(24px)'
        }}>
          {/* Header */}
          <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg,rgba(167,139,250,0.2),rgba(139,92,246,0.1))', borderBottom: '1px solid rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>✨</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>AI Copilot</div>
                <div style={{ fontSize: '0.7rem', color: '#a78bfa' }}>Powered by Gemini</div>
              </div>
            </div>
            <button onClick={() => setShowCopilot(false)} style={{ background: 'none', border: 'none', color: 'var(--text-400)', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {copilotMsgs.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '0.65rem 0.9rem', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'var(--bg-300)',
                  fontSize: '0.83rem', lineHeight: 1.5, whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {copilotLoading && (
              <div style={{ display: 'flex', gap: '4px', padding: '0.5rem' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleCopilotSubmit} style={{ padding: '0.75rem', borderTop: '1px solid rgba(167,139,250,0.15)', display: 'flex', gap: '0.5rem' }}>
            <input
              value={copilotInput}
              onChange={e => setCopilotInput(e.target.value)}
              placeholder="Ask your AI anything..."
              disabled={copilotLoading}
              style={{ flex: 1, background: 'var(--bg-300)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '999px', padding: '0.55rem 1rem', fontSize: '0.83rem', color: '#fff', outline: 'none' }}
            />
            <button type="submit" disabled={copilotLoading || !copilotInput.trim()} style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {copilotLoading ? <Loader2 size={14} className="anim-spin" color="#fff" /> : <ArrowRight size={14} color="#fff" />}
            </button>
          </form>
        </div>
      )}

      {/* Floating AI Copilot Button */}
      <button
        onClick={() => setShowCopilot(v => !v)}
        title="Open AI Copilot"
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', width: '56px', height: '56px',
          borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(124,58,237,0.5)', zIndex: 10000,
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >✨</button>
      </>
      )}
    </div>
  );
}
