'use client';

import { MilesIdentity } from '@/components/MilesConfigurationProvider';

type MilesProfileAvatarProps = { size?: number; className?: string; label?: string };

export default function MilesProfileAvatar({ size = 36, className = '', label }: MilesProfileAvatarProps) {
  return <MilesIdentity size={size} className={className} label={label} />;
}

