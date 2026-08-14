'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import OptimizedImage from '@/components/OptimizedImage';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './MainSlider.module.css';

const DEFAULT_UNIVERSITY_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_AUTOPLAY_MS = 5000;

type BillboardSlide = {
  id: string;
  image?: string;
  title?: string;
  sub?: string;
  link?: string;
};

type MainSliderProps = {
  defaultContent?: ReactNode;
  autoplayMs?: number;
};

export default function MainSlider({ defaultContent, autoplayMs = DEFAULT_AUTOPLAY_MS }: MainSliderProps) {
  const [adminSlides, setAdminSlides] = useState<BillboardSlide[]>([]);
  const [defaultImage, setDefaultImage] = useState<string | undefined>();
  const [current, setCurrent] = useState(0);
  const [timerReset, setTimerReset] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchBillboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let userUniId: string | null = null;

      if (session) {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('university_id')
          .eq('id', session.user.id)
          .single();
        if (profileError) console.error('[MasterCart] Billboard profile lookup failed:', profileError.message);
        userUniId = userProfile?.university_id;
      }

      // The designed hero remains the default slide. Brand imagery is used only
      // as its background so the existing visual treatment is not replaced.
      let brandQuery = supabase
        .from('brands')
        .select('cover_url, social_links, university_id, billboard_boost_expires_at, sales_count')
        .or(`billboard_boost_expires_at.gt.${new Date().toISOString()},sales_count.gt.10`)
        .order('sales_count', { ascending: false })
        .limit(1);

      brandQuery = userUniId
        ? brandQuery.or(`university_id.is.null,university_id.eq.${userUniId}`)
        : brandQuery.or(`university_id.is.null,university_id.eq.${DEFAULT_UNIVERSITY_ID}`);

      const { data: brandData } = await brandQuery;
      const brand = brandData?.[0];
      const brandSocial = (brand?.social_links || {}) as { billboard_image?: string };

      const { data: settingsData, error: settingsError } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'manual_billboards')
        .maybeSingle();
      if (settingsError) console.error('[MasterCart] Manual billboard settings query failed:', settingsError.message);

      const targetUniversityId = userUniId || DEFAULT_UNIVERSITY_ID;
      const rawManualBillboards = Array.isArray(settingsData?.value) ? settingsData.value as Record<string, unknown>[] : [];
      const manualBillboards = rawManualBillboards
        .filter((billboard) => (
          (!billboard.university_id || billboard.university_id === targetUniversityId) &&
          Boolean(billboard.cover_url) &&
          billboard.is_active !== false
        ))
        .sort((a, b) => {
          const aOrder = Number(a.display_order ?? a.sort_order ?? a.order ?? Number.MAX_SAFE_INTEGER);
          const bOrder = Number(b.display_order ?? b.sort_order ?? b.order ?? Number.MAX_SAFE_INTEGER);
          if (aOrder !== bOrder) return aOrder - bOrder;
          return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
        });

      if (cancelled) return;

      setDefaultImage(brandSocial.billboard_image || brand?.cover_url || undefined);
      setAdminSlides(manualBillboards.map((billboard, index) => ({
        id: String(billboard.id || `admin-billboard-${index}-${billboard.cover_url}`),
        image: String(billboard.cover_url),
        title: billboard.title ? String(billboard.title) : undefined,
        sub: billboard.description ? String(billboard.description) : undefined,
        link: billboard.link ? String(billboard.link) : undefined,
      })));
      setCurrent(0);
    };

    fetchBillboard();
    return () => { cancelled = true; };
  }, []);

  const slides = useMemo(() => [
    { id: 'default-designed-billboard', kind: 'default' as const },
    ...adminSlides.map((slide) => ({ ...slide, kind: 'admin' as const })),
  ], [adminSlides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setTimeout(() => {
      setCurrent((previous) => (previous + 1) % slides.length);
    }, autoplayMs);
    return () => window.clearTimeout(timer);
  }, [autoplayMs, current, slides.length, timerReset]);

  const goTo = (index: number) => {
    setCurrent(index);
    setTimerReset((value) => value + 1);
  };

  const next = () => goTo((current + 1) % slides.length);
  const prev = () => goTo((current - 1 + slides.length) % slides.length);

  return (
    <div className={styles.slider} aria-roledescription="carousel" aria-label="Campus billboard">
      <div className={styles.inner} style={{ transform: `translateX(-${current * 100}%)` }}>
        <div className={`${styles.slide} ${styles.defaultSlide}`} aria-label="Default campus billboard">
          {defaultImage && (
            <OptimizedImage
              src={defaultImage}
              alt=""
              fill
              priority
              className={styles.defaultBackground}
              useThumbnail={false}
            />
          )}
          <div className={styles.defaultShade} />
          <div className={styles.defaultContent}>{defaultContent}</div>
        </div>

        {adminSlides.map((slide) => (
          <div
            key={slide.id}
            className={styles.slide}
            onClick={() => { if (slide.link) window.location.href = slide.link; }}
            style={{ cursor: slide.link ? 'pointer' : 'default' }}
            aria-label={slide.title || 'Admin billboard'}
          >
            <OptimizedImage
              src={slide.image!}
              alt={slide.title || 'Billboard'}
              fill
              priority={current === slides.findIndex((item) => item.id === slide.id)}
              className={styles.img}
              useThumbnail={false}
            />
            <div className={styles.overlay}>
              {slide.title && <h2 className={styles.title}>{slide.title}</h2>}
              {slide.sub && <p className={styles.sub}>{slide.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button type="button" className={`${styles.navBtn} ${styles.prev}`} onClick={prev} aria-label="Previous billboard slide">
            <ChevronLeft size={24} />
          </button>
          <button type="button" className={`${styles.navBtn} ${styles.next}`} onClick={next} aria-label="Next billboard slide">
            <ChevronRight size={24} />
          </button>
          <div className={styles.dots} role="tablist" aria-label="Billboard slides">
            {slides.map((slide, index) => (
              <button
                type="button"
                key={slide.id}
                role="tab"
                aria-selected={index === current}
                aria-label={`Show billboard slide ${index + 1}`}
                className={`${styles.dot} ${index === current ? styles.dotActive : ''}`}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
