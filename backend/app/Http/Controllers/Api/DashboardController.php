<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\Member;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $date = Carbon::parse($request->input('date', 'today'));
        $dateStr = $date->toDateString();

        $revenue = (float) Order::whereDate('created_at', $dateStr)->sum('total_amount');
        $orderCount = (int) Order::whereDate('created_at', $dateStr)->count();
        $newMembers = (int) Member::whereDate('created_at', $dateStr)->count();
        $warningCount = (int) Ingredient::whereColumn('stock_qty', '<', 'warning_threshold')->count();

        $trend = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = $date->copy()->subDays($i)->toDateString();
            $trend[] = [
                'date' => $d,
                'revenue' => (float) Order::whereDate('created_at', $d)->sum('total_amount'),
                'order_count' => (int) Order::whereDate('created_at', $d)->count(),
            ];
        }

        return response()->json([
            'date' => $dateStr,
            'metrics' => [
                'revenue' => $revenue,
                'order_count' => $orderCount,
                'new_members' => $newMembers,
                'warning_count' => $warningCount,
            ],
            'trend' => $trend,
        ]);
    }
}
