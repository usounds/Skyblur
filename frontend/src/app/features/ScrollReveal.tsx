"use client";

import { useEffect, useRef, type ReactNode } from 'react';
import classes from './FeaturesPage.module.css';

type ScrollRevealProps = {
  children: ReactNode;
};

export function ScrollReveal({ children }: ScrollRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.dataset.enhanced = 'true';

    const items = Array.from(root.querySelectorAll<HTMLElement>(`.${classes.revealItem}`));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add(classes.revealed);
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.18
      }
    );

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={classes.revealRoot}>
      {children}
    </div>
  );
}
