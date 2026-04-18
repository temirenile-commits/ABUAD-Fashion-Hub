async function createTestProduct() {
  const brandId = 'fbd2e1ed-ba5d-495d-bb39-5c04ccd86a48';
  const ownerId = 'f0e6e7d1-9f9e-4c1e-8e3b-2d1c0b9a8f7e'; // Placeholder or actual if known

  try {
    const res = await fetch('https://abuad-fashion-hub.vercel.app/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Escrow System Test (Live)',
        description: 'Temporary item for live payment verification. ₦100.00',
        price: 100,
        originalPrice: 1500,
        category: 'Accessories',
        stockCount: 1,
        mediaUrls: ['https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60'],
        brandId: brandId
      })
    });
    const data = await res.json();
    console.log('Test product created:', data);
  } catch (err) {
    console.error('Error creating test product:', err);
  }
}

createTestProduct();
