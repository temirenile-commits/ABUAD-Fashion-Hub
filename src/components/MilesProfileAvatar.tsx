'use client';

type MilesProfileAvatarProps = {
  size?: number;
  className?: string;
  label?: string;
};

export default function MilesProfileAvatar({ size = 36, className = '', label = 'Miles profile picture' }: MilesProfileAvatarProps) {
  return <span className={`miles-profile-avatar ${className}`} role="img" aria-label={label} style={{ width: size, height: size, minWidth: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', border: '1px solid rgba(255,255,255,.28)', boxShadow: '0 5px 16px rgba(0,0,0,.24),0 0 12px rgba(37,99,235,.18)', color: '#fff', overflow: 'hidden' }}>
    <span aria-hidden="true" style={{ display: 'inline-block', fontFamily: '"Brush Script MT", "Segoe Script", "URW Chancery L", cursive', fontStyle: 'italic', fontWeight: 700, fontSize: '1.35em', lineHeight: 1, transform: 'translateY(-1px) rotate(-8deg)', textShadow: '1px 2px 0 rgba(15,23,42,.22)' }}>𝓜</span>
  </span>;
}

