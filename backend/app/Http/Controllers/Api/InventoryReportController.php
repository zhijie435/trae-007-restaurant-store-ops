<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\InventoryRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class InventoryReportController extends Controller
{
    public function show(Request $request)
    {
        $date = Carbon::parse($request->input('date', 'today'));
        $dateStr = $date->toDateString();

        $inbound = (float) InventoryRecord::where('type', '入库')
            ->whereDate('created_at', $dateStr)->sum('quantity');
        $outbound = (float) InventoryRecord::where('type', '出库')
            ->whereDate('created_at', $dateStr)->sum('quantity');

        $warningList = Ingredient::whereColumn('stock_qty', '<', 'warning_threshold')
            ->orderBy('stock_qty')
            ->get()
            ->map(fn ($i) => [
                'id' => $i->id,
                'name' => $i->name,
                'category' => $i->category,
                'stock' => (float) $i->stock_qty,
                'threshold' => (float) $i->warning_threshold,
                'unit' => $i->unit,
                'shortage' => round((float) $i->warning_threshold - (float) $i->stock_qty, 2),
            ]);

        $records = InventoryRecord::with('ingredient')
            ->whereDate('created_at', $dateStr)
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'ingredient' => $r->ingredient?->name ?? '-',
                'type' => $r->type,
                'quantity' => (float) $r->quantity,
                'reason' => $r->reason,
                'operator' => $r->operator,
                'time' => $r->created_at->format('Y-m-d H:i'),
            ]);

        return response()->json([
            'date' => $dateStr,
            'summary' => [
                'inbound' => $inbound,
                'outbound' => $outbound,
                'net' => round($inbound - $outbound, 2),
                'warning_count' => $warningList->count(),
                'total_skus' => Ingredient::count(),
            ],
            'warning_list' => $warningList,
            'records' => $records,
        ]);
    }
}
