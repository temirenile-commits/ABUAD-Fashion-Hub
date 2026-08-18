import Link from 'next/link';

export const metadata = {
  title: 'Delete Your MasterCart Account',
  description: 'Request deletion of your MasterCart account and associated personal data.',
};

export default function DeleteAccountPage() {
  return (
    <main className="container" style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Delete Your MasterCart Account</h1>
      <p style={{ color: 'var(--text-400)', marginBottom: '2rem' }}>
        You can request permanent deletion of your MasterCart account and associated personal data from your account settings.
      </p>

      <section style={{ marginBottom: '2rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12 }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>How to request deletion</h2>
        <ol style={{ paddingLeft: '1.5rem', marginTop: 0 }}>
          <li>Sign in to the MasterCart account you want to delete.</li>
          <li>Open <strong>Account Settings</strong>.</li>
          <li>Scroll to <strong>Danger Zone</strong> and select <strong>Delete Account</strong>.</li>
          <li>Review the confirmation message and confirm permanent deletion.</li>
        </ol>
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/auth/login?redirect=/settings" className="btn btn-primary">Sign in to request deletion</Link>
          <Link href="/settings" className="btn btn-secondary">Open Account Settings</Link>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>What deletion does</h2>
        <p>
          After confirmation, MasterCart permanently removes your authentication account and user profile. Directly identifying messages are removed, and customer references in historical business records are anonymized where necessary to preserve transaction records.
        </p>
        <p>
          Account deletion does not change or delete historical orders, payment records, referral records, or other records that MasterCart must retain for legal, security, fraud-prevention, accounting, or operational purposes.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>If you cannot sign in</h2>
        <p>
          Contact MasterCart support from the email address associated with your account and include the account email, your display name, and the reason you cannot access the account. Support may request verification before processing a deletion request.
        </p>
        <p>
          Email: <a href="mailto:support@mastercart.com">support@mastercart.com</a>
        </p>
      </section>

      <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <Link href="/privacy" className="btn btn-secondary">Read Privacy Policy</Link>{' '}
        <Link href="/" className="btn btn-secondary">Return to Home</Link>
      </div>
    </main>
  );
}
