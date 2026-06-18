<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\InventoryRecord;
use App\Models\Member;
use App\Models\MemberTransaction;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DailyReportController extends Controller
{
    public function show(Request $request)
    {
        $date = Carbon::parse($request->input('date', 'today'));
        $dateStr = $date->toDateString();

        $orders = Order::whereDate('created_at', $dateStr)->where('status', '已完成');
        $orderCount = (int) $orders->count();
        $revenue = (float) $orders->sum('total_amount');
        $memberOrders = (int) Order::whereDate('created_at', $dateStr)
            ->where('status', '已完成')->whereNotNull('member_id')->count();
        $avgOrderValue = $orderCount > 0 ? round($revenue / $orderCount, 2) : 0;

        $topDishes = OrderItem::whereHas('order', function ($q) use ($dateStr) {
            $q->whereDate('created_at', $dateStr)->where('status', '已完成');
        })
            ->selectRaw('dish_id, sum(quantity) as total_qty, sum(subtotal) as total_amount')
            ->with('dish:id,name,price')
            ->groupBy('dish_id')
            ->orderByDesc('total_qty')
            ->limit(5)
            ->get()
            ->map(fn ($d) => [
                'name' => $d->dish?->name ?? '-',
                'total_qty' => (int) $d->total_qty,
                'total_amount' => (float) $d->total_amount,
            ]);

        $newMembers = (int) Member::whereDate('created_at', $dateStr)->count();
        $totalMembers = (int) Member::count();
        $activeMembers = (int) Member::whereHas('transactions', function ($q) use ($dateStr) {
            $q->whereDate('created_at', $dateStr);
        })->count();
        $consumption = (float) MemberTransaction::whereDate('created_at', $dateStr)
            ->where('type', '消费')->sum('amount');
        $recharge = (float) MemberTransaction::whereDate('created_at', $dateStr)
            ->where('type', '充值')->sum('amount');
        $pointsChange = (int) MemberTransaction::whereDate('created_at', $dateStr)
            ->sum('points_change');

        $inbound = (float) InventoryRecord::whereDate('created_at', $dateStr)
            ->where('type', '入库')->sum('quantity');
        $outbound = (float) InventoryRecord::whereDate('created_at', $dateStr)
            ->where('type', '出库')->sum('quantity');
        $net = $inbound - $outbound;
        $warningCount = (int) Ingredient::whereColumn('stock_qty', '<', 'warning_threshold')->count();
        $totalSkus = (int) Ingredient::count();

        $hourlyRaw = Order::whereDate('created_at', $dateStr)
            ->where('status', '已完成')
            ->selectRaw("strftime('%H', created_at) as hour, count(*) as count, sum(total_amount) as revenue")
            ->groupBy('hour')
            ->get()
            ->keyBy('hour');

        $hourly = [];
        for ($h = 0; $h < 24; $h++) {
            $key = str_pad((string) $h, 2, '0', STR_PAD_LEFT);
            $row = $hourlyRaw->get($key);
            $hourly[] = [
                'hour' => $key.':00',
                'count' => $row ? (int) $row->count : 0,
                'revenue' => $row ? (float) $row->revenue : 0,
            ];
        }

        return response()->json([
            'date' => $dateStr,
            'meal' => [
                'order_count' => $orderCount,
                'revenue' => $revenue,
                'avg_order_value' => $avgOrderValue,
                'member_orders' => $memberOrders,
                'guest_orders' => $orderCount - $memberOrders,
                'top_dishes' => $topDishes,
                'hourly' => $hourly,
            ],
            'member' => [
                'new_members' => $newMembers,
                'active_members' => $activeMembers,
                'consumption' => $consumption,
                'recharge' => $recharge,
                'points_change' => $pointsChange,
                'total_members' => $totalMembers,
            ],
            'inventory' => [
                'inbound' => $inbound,
                'outbound' => $outbound,
                'net' => $net,
                'warning_count' => $warningCount,
                'total_skus' => $totalSkus,
            ],
        ]);
    }
}
