<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('discount_rate', 3, 2)->default(1.00);
            $table->decimal('discount_amount', 12, 2)->default(0.00);
            $table->decimal('actual_amount', 12, 2)->default(0.00);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['discount_rate', 'discount_amount', 'actual_amount']);
        });
    }
};
