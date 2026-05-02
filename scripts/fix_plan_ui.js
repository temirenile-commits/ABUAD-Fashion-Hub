const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// Normalize to LF for processing, then restore
const normalized = content.replace(/\r\n/g, '\n');

// Find and replace the Active Features block with Upload Credits + expanded features
const searchStr = `<label className={styles.subText}>Active Features</label>
                                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      {[
                                        { id: 'listing_unlimited', label: 'Unlimited Listings' },
                                        { id: 'reels_unlimited', label: 'Unlimited Reels' },
                                        { id: 'priority_support', label: 'Priority Support' },
                                        { id: 'analytics_pro', label: 'Adv. Analytics' }
                                      ].map(feat => (
                                        <label key={feat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                           <input 
                                             type="checkbox" 
                                             checked={(planConfig.features || []).includes(feat.id)}
                                             onChange={(e) => {
                                                const currentFeats = planConfig.features || [];
                                                const nextFeats = e.target.checked ? [...currentFeats, feat.id] : currentFeats.filter((f: string) => f !== feat.id);
                                                const next = { ...uniConfig, plans: { ...uniConfig.plans, [tierId]: { ...planConfig, features: nextFeats } } };
                                                setUniConfig(next);
                                             }}
                                           />
                                           {feat.label}
                                        </label>
                                      ))}
                                   </div>`;

const replaceStr = `<label className={styles.subText}>Upload Credits (1 credit = 1 product upload)</label>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      <input
                                        type="number"
                                        className="form-input"
                                        style={{ width: '120px', height: '32px' }}
                                        value={planConfig.upload_credits ?? ''}
                                        placeholder="e.g. 20"
                                        onChange={(e) => {
                                           const next = { ...uniConfig, plans: { ...uniConfig.plans, [tierId]: { ...planConfig, upload_credits: Number(e.target.value) } } };
                                           setUniConfig(next);
                                        }}
                                      />
                                      <span className={styles.subText} style={{ fontSize: '0.75rem' }}>per cycle</span>
                                   </div>
                                   <label className={styles.subText} style={{ marginTop: '0.75rem', display: 'block' }}>Additional Features</label>
                                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      {[
                                        { id: 'reels_upload', label: 'Reels Upload' },
                                        { id: 'priority_support', label: 'Priority Support' },
                                        { id: 'analytics_pro', label: 'Adv. Analytics' },
                                        { id: 'verified_badge', label: 'Verified Badge' },
                                        { id: 'store_customization', label: 'Store Customization' },
                                        { id: 'featured_placement', label: 'Featured Placement' },
                                        { id: 'promo_codes', label: 'Promo Codes' },
                                        { id: 'bulk_upload', label: 'Bulk Upload' }
                                      ].map(feat => (
                                        <label key={feat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                           <input
                                             type="checkbox"
                                             checked={(planConfig.features || []).includes(feat.id)}
                                             onChange={(e) => {
                                                const currentFeats = planConfig.features || [];
                                                const nextFeats = e.target.checked ? [...currentFeats, feat.id] : currentFeats.filter((f) => f !== feat.id);
                                                const next = { ...uniConfig, plans: { ...uniConfig.plans, [tierId]: { ...planConfig, features: nextFeats } } };
                                                setUniConfig(next);
                                             }}
                                           />
                                           {feat.label}
                                        </label>
                                      ))}
                                   </div>`;

if (!normalized.includes(searchStr)) {
  console.error('ERROR: Search string not found in file!');
  // Print a snippet around where we expect it
  const idx = normalized.indexOf('Active Features');
  if (idx !== -1) {
    console.log('Context around Active Features:');
    console.log(JSON.stringify(normalized.substring(idx - 50, idx + 300)));
  }
  process.exit(1);
}

const updated = normalized.replace(searchStr, replaceStr);
// Restore CRLF
fs.writeFileSync('src/app/admin/page.tsx', updated.replace(/\n/g, '\r\n'), 'utf8');
console.log('SUCCESS: File updated successfully.');
