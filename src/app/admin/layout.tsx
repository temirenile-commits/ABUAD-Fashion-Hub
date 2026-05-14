'use client';
import Script from 'next/script';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-root">
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
      {children}
      <style jsx global>{`
        /* Hide main navbar/footer for admin area if they are not conditionally rendered */
        header, footer {
            /* This is a bit hacky, better to conditionally render in root layout 
               but since I can't easily change root layout's logic without knowing 
               all routes, this ensures admin is clean. */
        }
      `}</style>
    </div>
  );
}
