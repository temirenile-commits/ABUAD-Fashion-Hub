import Link from 'next/link';
import { Plus, Package, Edit, Trash2, TrendingUp, DollarSign, Image as ImageIcon } from 'lucide-react';
import styles from './dashboard.module.css';

const MOCK_PRODUCTS = [
  { id: 1, title: 'Vintage Denim Jacket', price: '₦15,000', category: 'Clothing' },
  { id: 2, title: 'Y2K Cargo Pants', price: '₦12,000', category: 'Clothing' },
];

export default function VendorDashboard() {
  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar Navigation */}
      <aside className={`glass-panel ${styles.sidebar}`}>
        <div className={styles.brandInfo}>
          <div className={styles.brandAvatar}>RF</div>
          <div>
            <h3>RetroFits</h3>
            <p className="text-muted">Verified Vendor</p>
          </div>
        </div>
        
        <nav className={styles.sideNav}>
          <a href="#" className={styles.active}><TrendingUp size={18} /> Overview</a>
          <a href="#"><Package size={18} /> My Products</a>
          <a href="#"><DollarSign size={18} /> Orders</a>
          <a href="#"><ImageIcon size={18} /> Brand Profile</a>
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className={styles.mainContent}>
        <header className="flex-between">
          <h2>Dashboard</h2>
          <button className="btn btn-primary">
            <Plus size={18} /> Add Product
          </button>
        </header>

        {/* Stats Row */}
        <div className={styles.statsGrid}>
          <div className={`glass-panel ${styles.statCard}`}>
            <p className="text-muted">Total Products</p>
            <h3>12</h3>
          </div>
          <div className={`glass-panel ${styles.statCard}`}>
            <p className="text-muted">Profile Views</p>
            <h3>1,048</h3>
          </div>
          <div className={`glass-panel ${styles.statCard}`}>
            <p className="text-muted">Messages (Clicks)</p>
            <h3>45</h3>
          </div>
        </div>

        {/* Products Table */}
        <section className={`glass-panel ${styles.contentSection}`}>
          <div className="flex-between">
            <h3>Recent Products</h3>
            <Link href="/dashboard/vendor/products" className="text-gradient">View all</Link>
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product Title</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PRODUCTS.map(product => (
                  <tr key={product.id}>
                    <td>{product.title}</td>
                    <td>{product.price}</td>
                    <td>{product.category}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button className={styles.iconBtn}><Edit size={16} /></button>
                        <button className={`${styles.iconBtn} ${styles.danger}`}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
