<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dish;
use Illuminate\Http\Request;

class DishController extends Controller
{
    public function index(Request $request)
    {
        $storeId = $request->integer('store_id', 1);
        $dishes = Dish::query()
            ->where('store_id', $storeId)
            ->where('is_active', true)
            ->orderBy('category')
            ->orderBy('id')
            ->with(['ingredients.ingredient:id,name,category,unit,stock_qty,warning_threshold'])
            ->get()
            ->map(function (Dish $dish) {
                return [
                    'id' => $dish->id,
                    'name' => $dish->name,
                    'category' => $dish->category,
                    'price' => (float) $dish->price,
                    'cost' => (float) $dish->cost,
                    'ingredients' => $dish->ingredients->map(function ($rel) {
                        /** @var \App\Models\DishIngredient $rel */
                        $ingredient = $rel->ingredient;

                        return [
                            'id' => $ingredient?->id,
                            'name' => $ingredient?->name,
                            'category' => $ingredient?->category,
                            'unit' => $ingredient?->unit,
                            'stock_qty' => $ingredient ? (float) $ingredient->stock_qty : null,
                            'warning_threshold' => $ingredient ? (float) $ingredient->warning_threshold : null,
                            'quantity' => (float) $rel->quantity,
                        ];
                    })->values(),
                ];
            });

        return response()->json($dishes);
    }
}
