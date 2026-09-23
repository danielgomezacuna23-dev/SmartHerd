import { useEffect, useRef } from "react";

export default function MotionContent({ children }) {
  const root = useRef(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!window.IntersectionObserver) return;
    const seen = new WeakSet();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          if (!preference.matches) target.classList.add("reveal-enter");
          observer.unobserve(target);
        });
      },
      { threshold: 0.05 },
    );
    const scan = () =>
      root.current
        ?.querySelectorAll(".panel, .stat, .animal-card, .alert-row")
        .forEach((element) => {
          if (seen.has(element)) return;
          seen.add(element);
          observer.observe(element);
        });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(root.current, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
  return (
    <div ref={root} className="content motion-content">
      {children}
    </div>
  );
}
