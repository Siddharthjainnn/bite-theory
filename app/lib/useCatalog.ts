'use client';

import { useEffect, useState } from 'react';
import { Category, Product, fetchCatalog } from './bite';

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { products: p, categories: c } = await fetchCatalog();
        if (!alive) return;
        setProducts(p);
        setCategories(c);
      } catch {
        if (alive) setError('Menu load nahi hua. Thodi der baad try karein.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { products, categories, loading, error };
}
