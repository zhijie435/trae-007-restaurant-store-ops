<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use App\Models\MemberTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class MemberReportController extends Controller
{
    public function show(Request $request)
    {
        $date = Carbon::parse($request->input('date', 'today'));
        $dateStr = $date->toDateString();

        $newMembers = (int) Member::whereDate('created_at', $dateStr)->count();
        $activeMembers = (int) MemberTransaction::whereIn('type', ['消费', '退款'])
            ->whereDate('created_at', $dateStr)->distinct('member_id')->count('member_id');
        $consumption = (float) MemberTransaction::whereIn('type', ['消费', '退款'])
            ->whereDate('created_at', $dateStr)->sum('amount');
        $recharge = (float) MemberTransaction::where('type', '充值')
            ->whereDate('created_at', $dateStr)->sum('amount');
        $pointsChange = (int) MemberTransaction::whereDate('created_at', $dateStr)->sum('points_change');

        $levelDistribution = Member::selectRaw('level, count(*) as count')
            ->groupBy('level')
            ->pluck('count', 'level');

        $transactions = MemberTransaction::with('member')
            ->whereDate('created_at', $dateStr)
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'member' => $t->member?->name ?? '-',
                'phone' => $t->member?->phone ?? '-',
                'type' => $t->type,
                'amount' => (float) $t->amount,
                'points_change' => (int) $t->points_change,
                'time' => $t->created_at->format('Y-m-d H:i'),
            ]);

        return response()->json([
            'date' => $dateStr,
            'summary' => [
                'new_members' => $newMembers,
                'active_members' => $activeMembers,
                'consumption' => $consumption,
                'recharge' => $recharge,
                'points_change' => $pointsChange,
                'total_members' => (int) Member::count(),
            ],
            'level_distribution' => $levelDistribution,
            'transactions' => $transactions,
        ]);
    }
}
