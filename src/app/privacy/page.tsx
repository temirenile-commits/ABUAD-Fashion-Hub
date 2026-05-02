import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Master Cart',
  description: 'Privacy Policy and Data Handling for Master Cart.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="container" style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-400)', marginBottom: '2rem' }}>Last Updated: {new Date().toLocaleDateString()}</p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>1. Information We Collect</h2>
        <p>
          Master Cart collects information to provide better services to all our users. We collect information in the following ways:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', listStyleType: 'disc' }}>
          <li><strong>Information you give us:</strong> This includes your email address, name, phone number, and campus delivery address provided during registration or checkout.</li>
          <li><strong>Information we get from your use of our services:</strong> We collect information about the products you view, search for, or purchase to improve our recommendations.</li>
          <li><strong>Device Information:</strong> We may collect device-specific information (such as hardware model and operating system version) for optimization.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>2. How We Use Information</h2>
        <p>We use the information we collect from all of our services to provide, maintain, protect and improve them, to develop new ones, and to protect Master Cart and our users.</p>
        <p style={{ marginTop: '0.5rem' }}>Specifically, we use your information to:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', listStyleType: 'disc' }}>
          <li>Process transactions and deliver your orders via our campus agents.</li>
          <li>Send administrative information, such as order confirmations and updates.</li>
          <li>Improve the marketplace safety by monitoring for suspicious activity.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>3. Information Sharing</h2>
        <p>We do not share personal information with companies, organizations and individuals outside of Master Cart unless one of the following circumstances applies:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', listStyleType: 'disc' }}>
          <li><strong>With Vendors and Delivery Agents:</strong> We share your name, phone number, and delivery address with the specific vendor you purchase from and the assigned delivery agent solely for the purpose of fulfilling your order.</li>
          <li><strong>For legal reasons:</strong> We will share personal information if we have a good-faith belief that access, use, preservation or disclosure of the information is reasonably necessary to meet any applicable law, regulation, legal process or enforceable governmental request.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>4. Security</h2>
        <p>We work hard to protect Master Cart and our users from unauthorized access to or unauthorized alteration, disclosure or destruction of information we hold. In particular:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', listStyleType: 'disc' }}>
          <li>We encrypt our services using HTTPS.</li>
          <li>We use secure, enterprise-grade payment gateways (Paystack) to process transactions. We do not store your credit card details.</li>
          <li>We review our information collection, storage and processing practices, including physical security measures, to guard against unauthorized access to systems.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>5. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact our support team through the Help Center or email support@mastercart.com.</p>
      </section>

      <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <Link href="/" className="btn btn-secondary">Return to Home</Link>
      </div>
    </main>
  );
}
