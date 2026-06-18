<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dish extends Model
{
    protected $fillable = ['store_id', 'name', 'category', 'price', 'cost', 'is_active'];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function ingredients(): HasMany
    {
        return $this->hasMany(DishIngredient::class);
    }
}
