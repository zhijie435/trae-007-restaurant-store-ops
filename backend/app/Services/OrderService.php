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
use App\Models\Store;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class OrderService
{
    public function createFromDishes(Store $store, array $items, ?int $memberId = null, ?string $operator = null): Order
    {
        if (count($items) === 0) {
            throw new InvalidArgumentException('至少提交的菜品不能为空');
        }

        $parsed = collect($items)->map(function ($row) {
            $dishId = (int) ($row['dish_id'] ?? null);
            $qty = (int) ($row['quantity'] ?? 0);
            if (!$dishId || $qty <= 0) {
                throw new InvalidArgumentException('菜品或数量不合法');
            }

            return ['dish_id' => $dishId, 'quantity' => $qty];
        });

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

        return DB::transaction(function () use ($store, $parsed, $dishes, $ingredients, $consumption, $memberId, $operator) {
            $now = Carbon::now();
            $totalAmount = 0;

            $order = Order::create([
                'store_id' => $store->id,
                'order_no' => 'NO'.$now->format('YmdHis').str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT),
                'member_id' => $memberId,
                'total_amount' => 0,
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
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $order->update(['total_amount' => $totalAmount]);

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
                    $points = (int) round($totalAmount);
                    MemberTransaction::create([
                        'member_id' => $member->id,
                        'type' => '消费',
                        'amount' => $totalAmount,
                        'points_change' => $points,
                        'order_id' => $order->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $member->increment('total_spent', $totalAmount);
                    $member->increment('points', $points);
                }
            }

            return $order->load('items.dish', 'member');
        });
    }
}
