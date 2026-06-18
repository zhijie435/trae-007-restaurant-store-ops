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
        $withInactive = $request->boolean('with_inactive', false);

        $query = Dish::query()
            ->where('store_id', $storeId)
            ->orderBy('category')
            ->orderBy('id')
            ->with(['ingredients.ingredient:id,name,category,unit,stock_qty,warning_threshold']);

        if (! $withInactive) {
            $query->where('is_active', true);
        }

        $dishes = $query->get()->map(function (Dish $dish) {
            return [
                'id' => $dish->id,
                'name' => $dish->name,
                'category' => $dish->category,
                'price' => (float) $dish->price,
                'cost' => (float) $dish->cost,
                'is_active' => (bool) $dish->is_active,
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

    public function toggle(Request $request, int $id)
    {
        $dish = Dish::findOrFail($id);
        $dish->is_active = ! $dish->is_active;
        $dish->save();

        return response()->json([
            'id' => $dish->id,
            'is_active' => (bool) $dish->is_active,
        ]);
    }
}
