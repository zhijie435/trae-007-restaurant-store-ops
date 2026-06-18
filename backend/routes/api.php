<?php

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryReportController;
use App\Http\Controllers\Api\MealReportController;
use App\Http\Controllers\Api\MemberReportController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', [DashboardController::class, 'index']);
Route::get('/reports/inventory', [InventoryReportController::class, 'show']);
Route::get('/reports/member', [MemberReportController::class, 'show']);
Route::get('/reports/meal', [MealReportController::class, 'show']);
