<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Store extends Model
{
    protected $fillable = ['name', 'address', 'phone'];

    public function ingredients(): HasMany
    {
        return $this->hasMany(Ingredient::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(Member::class);
    }

    public function dishes(): HasMany
    {
        return $this->hasMany(Dish::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
