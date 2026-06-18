<?php

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DailyReportController;
use App\Http\Controllers\Api\DishController;
use App\Http\Controllers\Api\InventoryReportController;
use App\Http\Controllers\Api\MealReportController;
use App\Http\Controllers\Api\MemberReportController;
use App\Http\Controllers\Api\OrderController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', [DashboardController::class, 'index']);
Route::get('/reports/daily', [DailyReportController::class, 'show']);
Route::get('/reports/inventory', [InventoryReportController::class, 'show']);
Route::get('/reports/member', [MemberReportController::class, 'show']);
Route::get('/reports/meal', [MealReportController::class, 'show']);

Route::get('/dishes', [DishController::class, 'index']);
Route::patch('/dishes/{id}/toggle', [DishController::class, 'toggle']);
Route::post('/orders', [OrderController::class, 'store']);
