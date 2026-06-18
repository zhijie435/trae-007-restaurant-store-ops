<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Store;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class OrderController extends Controller
{
    public function index(Request $request, OrderService $orderService): JsonResponse
    {
        $storeId = $request->integer('store_id', 1);
        $date = $request->input('date');
        $page = $request->integer('page', 1);
        $perPage = $request->integer('per_page', 20);

        $result = $orderService->getOrderList($storeId, $date, $page, $perPage);

        $items = $result['items']->map(function (Order $order) {
            return [
                'id' => $order->id,
                'order_no' => $order->order_no,
                'total_amount' => (float) $order->total_amount,
                'discount_rate' => (float) $order->discount_rate,
                'discount_amount' => (float) $order->discount_amount,
                'actual_amount' => (float) $order->actual_amount,
                'status' => $order->status,
                'member_name' => $order->member?->name,
                'item_count' => $order->items->count(),
                'created_at' => $order->created_at->toDateTimeString(),
            ];
        });

        return response()->json([
            'total' => $result['total'],
            'page' => $result['page'],
            'per_page' => $result['per_page'],
            'items' => $items,
        ]);
    }

    public function show(int $id, OrderService $orderService): JsonResponse
    {
        try {
            $order = $orderService->getOrderDetail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => '订单不存在'], 404);
        }

        return response()->json([
            'id' => $order->id,
            'order_no' => $order->order_no,
            'total_amount' => (float) $order->total_amount,
            'discount_rate' => (float) $order->discount_rate,
            'discount_amount' => (float) $order->discount_amount,
            'actual_amount' => (float) $order->actual_amount,
            'status' => $order->status,
            'member_name' => $order->member?->name,
            'created_at' => $order->created_at->toDateTimeString(),
            'items' => $order->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'dish_id' => $item->dish_id,
                    'dish_name' => $item->dish?->name,
                    'quantity' => (int) $item->quantity,
                    'price' => (float) $item->price,
                    'subtotal' => (float) $item->subtotal,
                    'refunded_quantity' => (int) $item->refunded_quantity,
                    'refunded_amount' => (float) $item->refunded_amount,
                ];
            })->values(),
            'returns' => $order->returns->map(function ($ret) {
                return [
                    'id' => $ret->id,
                    'dish_name' => $ret->dish?->name,
                    'quantity' => (int) $ret->quantity,
                    'amount' => (float) $ret->amount,
                    'reason' => $ret->reason,
                    'operator' => $ret->operator,
                    'created_at' => $ret->created_at->toDateTimeString(),
                ];
            })->values(),
        ]);
    }

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
                'discount_rate' => ['nullable', 'numeric', 'min:0', 'max:1'],
                'discount_amount' => ['nullable', 'numeric', 'min:0'],
                'idempotency_key' => ['nullable', 'string', 'max:64'],
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
                (float) ($data['discount_rate'] ?? 1.0),
                isset($data['discount_amount']) ? (float) $data['discount_amount'] : null,
                $data['idempotency_key'] ?? null,
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
                'discount_rate' => (float) $order->discount_rate,
                'discount_amount' => (float) $order->discount_amount,
                'actual_amount' => (float) $order->actual_amount,
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

    public function returnDish(Request $request, int $id, OrderService $orderService): JsonResponse
    {
        try {
            $data = $request->validate([
                'order_item_id' => ['required', 'integer', 'exists:order_items,id'],
                'quantity' => ['required', 'integer', 'min:1'],
                'reason' => ['nullable', 'string', 'max:200'],
                'operator' => ['nullable', 'string', 'max:50'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => '参数校验失败',
                'errors' => $e->errors(),
            ], 422);
        }

        $order = Order::find($id);
        if (!$order) {
            return response()->json(['message' => '订单不存在'], 404);
        }

        try {
            $order = $orderService->returnDish(
                $order,
                (int) $data['order_item_id'],
                (int) $data['quantity'],
                $data['reason'] ?? null,
                $data['operator'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }

        return response()->json([
            'message' => '退菜成功,原料已退回库存',
            'order' => [
                'id' => $order->id,
                'order_no' => $order->order_no,
                'total_amount' => (float) $order->total_amount,
                'discount_rate' => (float) $order->discount_rate,
                'discount_amount' => (float) $order->discount_amount,
                'actual_amount' => (float) $order->actual_amount,
                'status' => $order->status,
                'items' => $order->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'dish_name' => $item->dish?->name,
                        'quantity' => (int) $item->quantity,
                        'price' => (float) $item->price,
                        'subtotal' => (float) $item->subtotal,
                        'refunded_quantity' => (int) $item->refunded_quantity,
                        'refunded_amount' => (float) $item->refunded_amount,
                    ];
                })->values(),
            ],
        ]);
    }
}
