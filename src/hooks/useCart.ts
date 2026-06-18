import { useState, useMemo, useCallback } from 'react';
import type { Dish, CartRow, IngredientConsumption } from '@/types';

interface UseCartParams {
  dishes: Dish[];
}

interface UseCartReturn {
  cart: Record<number, number>;
  cartRows: CartRow[];
  consumption: IngredientConsumption[];
  lowStock: boolean;
  changeQty: (dishId: number, delta: number) => void;
  setQty: (dishId: number, value: number | null) => void;
  clearCart: () => void;
  removeDish: (dishId: number) => void;
  getQty: (dishId: number) => number;
}

function round4(num: number): number {
  return Number(num.toFixed(4));
}

function useCart({ dishes }: UseCartParams): UseCartReturn {
  const [cart, setCart] = useState<Record<number, number>>({});

  const cartRows: CartRow[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ dish_id: Number(id), quantity })),
    [cart],
  );

  const consumption: IngredientConsumption[] = useMemo(() => {
    const map = new Map<number, IngredientConsumption>();
    cartRows.forEach((row) => {
      const dish = dishes.find((d) => d.id === row.dish_id);
      if (!dish) return;
      dish.ingredients.forEach((recipe) => {
        const existing = map.get(recipe.id);
        const qty = recipe.quantity * row.quantity;
        if (existing) {
          existing.quantity += qty;
        } else {
          map.set(recipe.id, {
            id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            unit: recipe.unit,
            stock_qty: recipe.stock_qty,
            warning_threshold: recipe.warning_threshold,
            quantity: qty,
            after_stock: recipe.stock_qty - qty,
          });
        }
      });
    });
    const list = Array.from(map.values());
    list.forEach((item) => {
      item.after_stock = round4(item.stock_qty - item.quantity);
    });
    return list.sort((a, b) => {
      const aLow = a.after_stock <= a.warning_threshold ? 1 : 0;
      const bLow = b.after_stock <= b.warning_threshold ? 1 : 0;
      return bLow - aLow;
    });
  }, [cartRows, dishes]);

  const lowStock = useMemo(
    () => consumption.some((c) => c.after_stock < 0),
    [consumption],
  );

  const changeQty = useCallback((dishId: number, delta: number) => {
    setCart((prev) => {
      const current = prev[dishId] ?? 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[dishId];
      else copy[dishId] = next;
      return copy;
    });
  }, []);

  const setQty = useCallback((dishId: number, value: number | null) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (!value || value <= 0) delete copy[dishId];
      else copy[dishId] = value;
      return copy;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({});
  }, []);

  const removeDish = useCallback((dishId: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[dishId];
      return copy;
    });
  }, []);

  const getQty = useCallback(
    (dishId: number) => cart[dishId] ?? 0,
    [cart],
  );

  return {
    cart,
    cartRows,
    consumption,
    lowStock,
    changeQty,
    setQty,
    clearCart,
    removeDish,
    getQty,
  };
}

export { useCart };
export type { UseCartReturn };
