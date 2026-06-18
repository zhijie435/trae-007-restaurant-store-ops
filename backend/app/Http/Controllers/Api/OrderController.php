<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class OrderController extends Controller
{
    public function store(Request $request, OrderService $orderService): JsonResponse
    {
        try {
            $data = $request->validate([
                'store_id' => ['nullable', 'integer', 'exists:stores,id'],
                'member_id' => ['nullable', 'integer', 'exists:members,id'],
                'operator' => ['nullable', 'string', 'max:50'],
                'items' => ['required', 'array', 'min:1'],
                'items.*.dish_id' => ['required', 'integer', 'exists:dishes,id'],
                'items.*.quantity' => ['required', 'integer', 'min:1'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => '参数校验失败',
                'errors' => $e->errors(),
            ], 422);
        }

        $store = Store::find($data['store_id'] ?? Store::query()->value('id'));
        if (!$store) {
            return response()->json(['message' => '门店不存在'], 404);
        }

        try {
            $order = $orderService->createFromDishes(
                $store,
                $data['items'],
                $data['member_id'] ?? null,
                $data['operator'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }

        return response()->json([
            'message' => '订单创建成功,原料已扣减',
            'order' => [
                'id' => $order->id,
                'order_no' => $order->order_no,
                'total_amount' => (float) $order->total_amount,
                'status' => $order->status,
                'member_name' => $order->member?->name,
                'items' => $order->items->map(function ($item) {
                    return [
                        'dish_name' => $item->dish?->name,
                        'quantity' => (int) $item->quantity,
                        'price' => (float) $item->price,
                        'subtotal' => (float) $item->subtotal,
                    ];
                })->values(),
            ],
        ], 201);
    }
}
