import { useEffect, useState } from 'react';

/**
 * Observa uma lista de ids de seção e retorna qual delas está
 * atualmente mais próxima do centro da tela — usado para destacar
 * o item correspondente no menu de navegação.
 *
 * @param {string[]} sectionIds
 * @param {string} initialId
 */
export function useActiveSection(sectionIds, initialId) {
  const [activeSection, setActiveSection] = useState(initialId);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIds.join(',')]);

  return activeSection;
}

/**
 * Rola suavemente até a seção com o id informado, compensando a
 * altura do header fixo.
 */
export function scrollToSection(id, offset = 24) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}
