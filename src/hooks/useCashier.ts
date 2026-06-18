import { useState, useMemo } from 'react';
import type { Dish, CartRow } from '@/types';

interface UseCashierParams {
  cartRows: CartRow[];
  dishes: Dish[];
}

interface UseCashierReturn {
  discountRate: number;
  setDiscountRate: (rate: number) => void;
  discountAmount: number;
  setDiscountAmount: (amount: number) => void;
  totalAmount: number;
  actualAmount: number;
  discountTotal: number;
  resetDiscount: () => void;
}

const DISCOUNT_OPTIONS = [
  { value: 1, label: '不打折' },
  { value: 0.95, label: '9.5折' },
  { value: 0.9, label: '9折' },
  { value: 0.85, label: '8.5折' },
  { value: 0.8, label: '8折' },
  { value: 0.75, label: '7.5折' },
  { value: 0.7, label: '7折' },
  { value: 0.6, label: '6折' },
  { value: 0.5, label: '5折' },
];

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

function useCashier({ cartRows, dishes }: UseCashierParams): UseCashierReturn {
  const [discountRate, setDiscountRate] = useState<number>(1);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  const totalAmount = useMemo(() => {
    return cartRows.reduce((sum, row) => {
      const dish = dishes.find((d) => d.id === row.dish_id);
      return sum + (dish ? dish.price * row.quantity : 0);
    }, 0);
  }, [cartRows, dishes]);

  const actualAmount = useMemo(() => {
    const afterRate = round2(totalAmount * discountRate);
    return Math.max(0, round2(afterRate - (discountAmount ?? 0)));
  }, [totalAmount, discountRate, discountAmount]);

  const discountTotal = useMemo(() => {
    return round2(totalAmount - actualAmount);
  }, [totalAmount, actualAmount]);

  const resetDiscount = () => {
    setDiscountRate(1);
    setDiscountAmount(0);
  };

  return {
    discountRate,
    setDiscountRate,
    discountAmount,
    setDiscountAmount,
    totalAmount,
    actualAmount,
    discountTotal,
    resetDiscount,
  };
}

export { useCashier, DISCOUNT_OPTIONS };
export type { UseCashierReturn };
