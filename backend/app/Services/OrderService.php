<?php

namespace App\Services;

use App\Models\Dish;
use App\Models\DishIngredient;
use App\Models\Ingredient;
use App\Models\InventoryRecord;
use App\Models\Member;
use App\Models\MemberTransaction;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturn;
use App\Models\Store;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class OrderService
{
    public function createFromDishes(
        Store $store,
        array $items,
        ?int $memberId = null,
        ?string $operator = null,
        float $discountRate = 1.0,
        ?float $discountAmount = null,
        ?string $idempotencyKey = null
    ): Order {
        if ($idempotencyKey !== null && $idempotencyKey !== '') {
            $existing = Order::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing->load('items.dish', 'member', 'returns');
            }
        }

        if (count($items) === 0) {
            throw new InvalidArgumentException('至少提交的菜品不能为空');
        }

        if ($discountRate < 0 || $discountRate > 1) {
            throw new InvalidArgumentException('折扣率必须在 0-1 之间(8折请传 0.8)');
        }

        if ($discountAmount !== null && $discountAmount < 0) {
            throw new InvalidArgumentException('减免金额不能为负数');
        }

        $parsed = collect($items)->map(function ($row) {
            $dishId = (int) ($row['dish_id'] ?? null);
            $qty = (int) ($row['quantity'] ?? 0);
            if (!$dishId || $qty <= 0) {
                throw new InvalidArgumentException('菜品或数量不合法');
            }

            return ['dish_id' => $dishId, 'quantity' => $qty];
        });

        $merged = [];
        foreach ($parsed as $row) {
            $dishId = $row['dish_id'];
            $qty = $row['quantity'];
            if (isset($merged[$dishId])) {
                $merged[$dishId]['quantity'] += $qty;
            } else {
                $merged[$dishId] = ['dish_id' => $dishId, 'quantity' => $qty];
            }
        }
        $parsed = collect(array_values($merged));

        $dishIds = $parsed->pluck('dish_id')->unique()->values()->all();

        /** @var Dish[] $dishes */
        $dishes = Dish::query()
            ->where('store_id', $store->id)
            ->whereIn('id', $dishIds)
            ->where('is_active', true)
            ->with('ingredients')
            ->get()
            ->keyBy('id');

        if ($dishes->count() !== count($dishIds)) {
            throw new InvalidArgumentException('包含无效或已下架的菜品');
        }

        $consumption = collect();
        foreach ($parsed as $row) {
            /** @var Dish $dish */
            $dish = $dishes[$row['dish_id']];
            $qty = $row['quantity'];
            /** @var DishIngredient $recipe */
            foreach ($dish->ingredients as $recipe) {
                $existing = $consumption->get($recipe->ingredient_id);
                $need = round($recipe->quantity * $qty, 4);
                if ($existing) {
                    $existing['quantity'] += $need;
                } else {
                    $consumption->put($recipe->ingredient_id, [
                        'ingredient_id' => $recipe->ingredient_id,
                        'quantity' => $need,
                    ]);
                }
            }
        }

        $ingredientIds = $consumption->pluck('ingredient_id')->all();
        /** @var Ingredient[] $ingredients */
        $ingredients = Ingredient::query()
            ->whereIn('id', $ingredientIds)
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        foreach ($consumption as $row) {
            /** @var Ingredient|null $ingredient */
            $ingredient = $ingredients[$row['ingredient_id']] ?? null;
            if (!$ingredient) {
                throw new InvalidArgumentException('原料不存在');
            }
            if ($ingredient->stock_qty < $row['quantity']) {
                throw new InvalidArgumentException(
                    "原料【{$ingredient->name}】库存不足,需要 {$row['quantity']}{$ingredient->unit},当前仅剩 {$ingredient->stock_qty}{$ingredient->unit}"
                );
            }
        }

        return DB::transaction(function () use ($store, $parsed, $dishes, $ingredients, $consumption, $memberId, $operator, $discountRate, $discountAmount, $idempotencyKey) {
            $now = Carbon::now();
            $totalAmount = 0;

            $order = Order::create([
                'store_id' => $store->id,
                'order_no' => 'NO'.$now->format('YmdHis').str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT),
                'member_id' => $memberId,
                'total_amount' => 0,
                'discount_rate' => $discountRate,
                'discount_amount' => 0,
                'actual_amount' => 0,
                'idempotency_key' => $idempotencyKey,
                'status' => '已完成',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($parsed as $row) {
                /** @var Dish $dish */
                $dish = $dishes[$row['dish_id']];
                $qty = $row['quantity'];
                $subtotal = round($dish->price * $qty, 2);
                $totalAmount += $subtotal;
                OrderItem::create([
                    'order_id' => $order->id,
                    'dish_id' => $dish->id,
                    'quantity' => $qty,
                    'price' => $dish->price,
                    'subtotal' => $subtotal,
                    'refunded_quantity' => 0,
                    'refunded_amount' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $afterRateAmount = round($totalAmount * $discountRate, 2);
            $finalDiscountAmount = $discountAmount ?? 0;
            $actualAmount = max(0, round($afterRateAmount - $finalDiscountAmount, 2));
            $discountTotal = round($totalAmount - $actualAmount, 2);

            $order->update([
                'total_amount' => $totalAmount,
                'discount_amount' => $discountTotal,
                'actual_amount' => $actualAmount,
            ]);

            foreach ($consumption as $row) {
                /** @var Ingredient $ingredient */
                $ingredient = $ingredients[$row['ingredient_id']];
                $ingredient->decrement('stock_qty', $row['quantity']);
                InventoryRecord::create([
                    'ingredient_id' => $ingredient->id,
                    'type' => '出库',
                    'quantity' => round($row['quantity'], 4),
                    'reason' => "出餐消耗(订单 {$order->order_no})",
                    'operator' => $operator ?? '系统',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            if ($memberId) {
                $member = Member::find($memberId);
                if ($member && $member->store_id === $store->id) {
                    $points = (int) round($actualAmount);
                    MemberTransaction::create([
                        'member_id' => $member->id,
                        'type' => '消费',
                        'amount' => $actualAmount,
                        'points_change' => $points,
                        'order_id' => $order->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $member->increment('total_spent', $actualAmount);
                    $member->increment('points', $points);
                }
            }

            return $order->load('items.dish', 'member', 'returns');
        });
    }

    public function returnDish(
        Order $order,
        int $orderItemId,
        int $quantity,
        ?string $reason = null,
        ?string $operator = null
    ): Order {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('退菜数量必须大于 0');
        }

        if ($order->status !== '已完成') {
            throw new InvalidArgumentException('当前订单状态不允许退菜');
        }

        /** @var OrderItem $orderItem */
        $orderItem = OrderItem::where('order_id', $order->id)->find($orderItemId);
        if (!$orderItem) {
            throw new InvalidArgumentException('订单项不存在');
        }

        $remainingQty = $orderItem->quantity - $orderItem->refunded_quantity;
        if ($quantity > $remainingQty) {
            throw new InvalidArgumentException("退菜数量超过可退数量,最多可退 {$remainingQty} 份");
        }

        $dish = Dish::with('ingredients')->find($orderItem->dish_id);
        if (!$dish) {
            throw new InvalidArgumentException('菜品不存在');
        }

        $returnAmount = round($orderItem->price * $quantity, 2);

        return DB::transaction(function () use ($order, $orderItem, $quantity, $returnAmount, $dish, $reason, $operator) {
            $now = Carbon::now();

            OrderReturn::create([
                'order_id' => $order->id,
                'order_item_id' => $orderItem->id,
                'dish_id' => $orderItem->dish_id,
                'quantity' => $quantity,
                'amount' => $returnAmount,
                'reason' => $reason,
                'operator' => $operator ?? '系统',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $orderItem->increment('refunded_quantity', $quantity);
            $orderItem->increment('refunded_amount', $returnAmount);

            $order->refresh()->load('items');

            $newTotalAmount = 0;
            foreach ($order->items as $item) {
                $remainingQty = $item->quantity - $item->refunded_quantity;
                if ($remainingQty > 0) {
                    $newTotalAmount += round($item->price * $remainingQty, 2);
                }
            }
            $newTotalAmount = round($newTotalAmount, 2);

            $rate = (float) $order->discount_rate;
            $afterRateAmount = round($newTotalAmount * $rate, 2);

            $unrefundedItems = $order->items->filter(function ($item) {
                return ($item->quantity - $item->refunded_quantity) > 0;
            });
            $allRefunded = $unrefundedItems->count() === 0;

            $originalTotal = (float) $order->total_amount;
            if ($originalTotal > 0 && $newTotalAmount <= 0) {
                $newActualAmount = 0;
            } elseif ($originalTotal > 0) {
                $originalActual = (float) $order->actual_amount;
                $ratio = $newTotalAmount / $originalTotal;
                $newActualAmount = round($originalActual * $ratio, 2);
            } else {
                $newActualAmount = max(0, $afterRateAmount);
            }

            $newDiscountAmount = round($newTotalAmount - $newActualAmount, 2);

            $order->update([
                'discount_amount' => $newDiscountAmount,
                'actual_amount' => $newActualAmount,
                'status' => $allRefunded ? '已退' : '已完成',
            ]);

            foreach ($dish->ingredients as $recipe) {
                $returnQty = round($recipe->quantity * $quantity, 4);
                /** @var Ingredient $ingredient */
                $ingredient = Ingredient::find($recipe->ingredient_id);
                if ($ingredient) {
                    $ingredient->increment('stock_qty', $returnQty);
                    InventoryRecord::create([
                        'ingredient_id' => $ingredient->id,
                        'type' => '入库',
                        'quantity' => $returnQty,
                        'reason' => "退菜回库(订单 {$order->order_no})",
                        'operator' => $operator ?? '系统',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            if ($order->member_id) {
                $member = Member::find($order->member_id);
                if ($member && $member->store_id === $order->store_id) {
                    $actualReturnAmount = round($returnAmount * $rate, 2);
                    $points = (int) round($actualReturnAmount);

                    MemberTransaction::create([
                        'member_id' => $member->id,
                        'type' => '退款',
                        'amount' => -$actualReturnAmount,
                        'points_change' => -$points,
                        'order_id' => $order->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $member->decrement('total_spent', $actualReturnAmount);
                    $member->decrement('points', $points);
                }
            }

            return $order->load('items.dish', 'member', 'returns');
        });
    }

    public function getOrderList(int $storeId, ?string $date = null, int $page = 1, int $perPage = 20)
    {
        $query = Order::query()
            ->where('store_id', $storeId)
            ->with('items.dish', 'member')
            ->orderBy('created_at', 'desc');

        if ($date) {
            $query->whereDate('created_at', $date);
        }

        $total = $query->count();
        $orders = $query->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'items' => $orders,
        ];
    }

    public function getOrderDetail(int $orderId): Order
    {
        return Order::with('items.dish', 'member', 'returns.dish')
            ->findOrFail($orderId);
    }
}
