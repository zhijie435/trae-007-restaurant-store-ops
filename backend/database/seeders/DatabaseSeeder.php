<?php

namespace Database\Seeders;

use App\Models\Dish;
use App\Models\DishIngredient;
use App\Models\Ingredient;
use App\Models\InventoryRecord;
use App\Models\Member;
use App\Models\MemberTransaction;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $store = Store::create([
            'name' => '老味道餐厅（旗舰店）',
            'address' => '上海市黄浦区南京东路 188 号',
            'phone' => '021-68881234',
        ]);

        $this->seedIngredients($store);
        $this->seedDishes($store);
        $this->seedDishRecipes();
        $this->seedMembers($store);
        $this->seedInventoryRecords();
        $this->seedOrdersAndItems($store);
    }

    private function seedIngredients(Store $store): void
    {
        $items = [
            ['番茄', '蔬菜', 'kg', 80, 15],
            ['土豆', '蔬菜', 'kg', 120, 20],
            ['生菜', '蔬菜', 'kg', 8, 15],
            ['黄瓜', '蔬菜', 'kg', 45, 10],
            ['猪肉', '肉类', 'kg', 60, 25],
            ['牛肉', '肉类', 'kg', 35, 15],
            ['鸡腿', '肉类', 'kg', 5, 12],
            ['鸡蛋', '蛋类', '个', 480, 60],
            ['面粉', '主食', 'kg', 200, 30],
            ['大米', '主食', 'kg', 320, 50],
            ['食用油', '调料', 'L', 90, 10],
            ['酱油', '调料', 'L', 24, 8],
            ['食盐', '调料', 'kg', 6, 5],
            ['白糖', '调料', 'kg', 18, 5],
            ['虾', '海鲜', 'kg', 4, 10],
            ['豆腐', '豆制品', 'kg', 22, 8],
        ];

        foreach ($items as [$name, $cat, $unit, $stock, $threshold]) {
            Ingredient::create([
                'store_id' => $store->id,
                'name' => $name,
                'category' => $cat,
                'unit' => $unit,
                'stock_qty' => $stock,
                'warning_threshold' => $threshold,
            ]);
        }
    }

    private function seedDishes(Store $store): void
    {
        $items = [
            ['宫保鸡丁', '热菜', 38, 14],
            ['鱼香肉丝', '热菜', 32, 11],
            ['麻婆豆腐', '热菜', 22, 6],
            ['回锅肉', '热菜', 36, 13],
            ['番茄炒蛋', '热菜', 18, 5],
            ['红烧牛肉', '热菜', 58, 22],
            ['清蒸鱼', '热菜', 68, 30],
            ['油焖大虾', '热菜', 88, 40],
            ['青椒土豆丝', '素菜', 16, 4],
            ['蒜蓉生菜', '素菜', 14, 3],
            ['凉拌黄瓜', '凉菜', 12, 3],
            ['皮蛋豆腐', '凉菜', 12, 3],
            ['蛋炒饭', '主食', 16, 4],
            ['牛肉面', '主食', 26, 9],
            ['米饭', '主食', 3, 1],
            ['酸梅汤', '饮品', 8, 2],
            ['可乐', '饮品', 6, 2],
            ['例汤', '汤品', 10, 2],
        ];

        foreach ($items as [$name, $cat, $price, $cost]) {
            Dish::create([
                'store_id' => $store->id,
                'name' => $name,
                'category' => $cat,
                'price' => $price,
                'cost' => $cost,
                'is_active' => true,
            ]);
        }
    }

    private function seedDishRecipes(): void
    {
        $recipes = [
            '宫保鸡丁' => [['鸡腿', 0.3], ['食用油', 0.02], ['酱油', 0.01]],
            '鱼香肉丝' => [['猪肉', 0.25], ['食用油', 0.02], ['酱油', 0.01], ['白糖', 0.01]],
            '麻婆豆腐' => [['豆腐', 0.4], ['猪肉', 0.05], ['食用油', 0.01], ['酱油', 0.01]],
            '回锅肉' => [['猪肉', 0.3], ['食用油', 0.01], ['酱油', 0.01]],
            '番茄炒蛋' => [['番茄', 0.3], ['鸡蛋', 2], ['食用油', 0.02], ['食盐', 0.005]],
            '红烧牛肉' => [['牛肉', 0.35], ['食用油', 0.02], ['酱油', 0.02]],
            '清蒸鱼' => [['食用油', 0.02], ['酱油', 0.01], ['食盐', 0.005]],
            '油焖大虾' => [['虾', 0.4], ['食用油', 0.02], ['酱油', 0.01], ['白糖', 0.01]],
            '青椒土豆丝' => [['土豆', 0.35], ['食用油', 0.015], ['食盐', 0.005]],
            '蒜蓉生菜' => [['生菜', 0.3], ['食用油', 0.01], ['食盐', 0.003]],
            '凉拌黄瓜' => [['黄瓜', 0.3], ['食盐', 0.003], ['酱油', 0.005]],
            '皮蛋豆腐' => [['豆腐', 0.2], ['酱油', 0.005]],
            '蛋炒饭' => [['米饭', 1], ['鸡蛋', 1], ['食用油', 0.02], ['食盐', 0.005]],
            '牛肉面' => [['牛肉', 0.15], ['面粉', 0.2], ['食用油', 0.01], ['酱油', 0.01]],
            '米饭' => [['大米', 0.2]],
            '酸梅汤' => [['白糖', 0.01]],
            '可乐' => [],
            '例汤' => [['食盐', 0.002]],
        ];

        $ingredientMap = Ingredient::pluck('id', 'name')->all();
        $dishMap = Dish::pluck('id', 'name')->all();

        foreach ($recipes as $dishName => $items) {
            $dishId = $dishMap[$dishName] ?? null;
            if (!$dishId) {
                continue;
            }
            foreach ($items as [$ingredientName, $qty]) {
                $ingredientId = $ingredientMap[$ingredientName] ?? null;
                if ($ingredientId) {
                    DishIngredient::create([
                        'dish_id' => $dishId,
                        'ingredient_id' => $ingredientId,
                        'quantity' => $qty,
                    ]);
                }
            }
        }
    }

    private function seedMembers(Store $store): void
    {
        $surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'];
        $given = ['伟', '芳', '娜', '敏', '静', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '霞', '平', '刚', '丽'];
        $levels = ['普通会员', '普通会员', '普通会员', '银卡会员', '银卡会员', '金卡会员', '金卡会员', '钻石会员'];

        for ($i = 0; $i < 40; $i++) {
            $name = $surnames[array_rand($surnames)].$given[array_rand($given)];
            $level = $levels[array_rand($levels)];
            $created = Carbon::today()->subDays(rand(0, 60))->setTime(rand(9, 21), rand(0, 59));
            Member::create([
                'store_id' => $store->id,
                'name' => $name,
                'phone' => '13'.str_pad((string) rand(100000000, 999999999), 9, '0', STR_PAD_LEFT),
                'level' => $level,
                'points' => rand(0, 3000),
                'balance' => rand(0, 5000),
                'total_spent' => rand(0, 20000),
                'created_at' => $created,
                'updated_at' => $created,
            ]);
        }

        // Ensure several members registered today
        for ($i = 0; $i < 5; $i++) {
            $created = Carbon::today()->setTime(rand(10, 20), rand(0, 59));
            Member::create([
                'store_id' => $store->id,
                'name' => $surnames[array_rand($surnames)].$given[array_rand($given)],
                'phone' => '13'.str_pad((string) rand(100000000, 999999999), 9, '0', STR_PAD_LEFT),
                'level' => '普通会员',
                'points' => 0,
                'balance' => 0,
                'total_spent' => 0,
                'created_at' => $created,
                'updated_at' => $created,
            ]);
        }
    }

    private function seedInventoryRecords(): void
    {
        $ingredients = Ingredient::all();
        $operators = ['张厨师', '李采购', '王店长', '赵仓管'];
        $inReasons = ['采购入库', '供应商送货', '补货'];
        $outReasons = ['出餐消耗', '损耗报损', '盘点调整'];

        for ($day = 6; $day >= 0; $day--) {
            $date = Carbon::today()->subDays($day);
            $count = $day === 0 ? 12 : rand(4, 8);

            for ($i = 0; $i < $count; $i++) {
                $ingredient = $ingredients->random();
                $isInbound = rand(0, 100) < 45;
                $qty = round(rand(5, 60) / 2, 1);

                $time = $date->copy()->setTime(rand(7, 20), rand(0, 59));
                InventoryRecord::create([
                    'ingredient_id' => $ingredient->id,
                    'type' => $isInbound ? '入库' : '出库',
                    'quantity' => $qty,
                    'reason' => $isInbound ? $inReasons[array_rand($inReasons)] : $outReasons[array_rand($outReasons)],
                    'operator' => $operators[array_rand($operators)],
                    'created_at' => $time,
                    'updated_at' => $time,
                ]);
            }
        }
    }

    private function seedOrdersAndItems(Store $store): void
    {
        $dishes = Dish::all();
        $members = Member::all();

        for ($day = 6; $day >= 0; $day--) {
            $date = Carbon::today()->subDays($day);
            $orderCount = $day === 0 ? 38 : rand(18, 30);

            for ($n = 0; $n < $orderCount; $n++) {
                // Concentrate orders in meal hours
                $hourPool = [11, 11, 12, 12, 12, 13, 13, 17, 18, 18, 19, 19, 19, 20, 20, 21];
                $hour = $hourPool[array_rand($hourPool)];
                $time = $date->copy()->setTime($hour, rand(0, 59), rand(0, 59));

                $useMember = rand(0, 100) < 55;
                $itemCount = rand(1, 5);
                $total = 0;
                $discountRate = rand(0, 100) < 20 ? 0.8 : 1.0;
                $order = Order::create([
                    'store_id' => $store->id,
                    'order_no' => 'NO'.date('Ymd', $time->timestamp).str_pad((string) ($n + 1), 4, '0', STR_PAD_LEFT),
                    'member_id' => $useMember ? $members->random()->id : null,
                    'total_amount' => 0,
                    'discount_rate' => $discountRate,
                    'discount_amount' => 0,
                    'actual_amount' => 0,
                    'status' => '已完成',
                    'created_at' => $time,
                    'updated_at' => $time,
                ]);

                $chosen = $dishes->random($itemCount);
                foreach ($chosen as $dish) {
                    $qty = rand(1, 3);
                    $subtotal = round($dish->price * $qty, 2);
                    $total += $subtotal;
                    OrderItem::create([
                        'order_id' => $order->id,
                        'dish_id' => $dish->id,
                        'quantity' => $qty,
                        'price' => $dish->price,
                        'subtotal' => $subtotal,
                        'refunded_quantity' => 0,
                        'refunded_amount' => 0,
                        'created_at' => $time,
                        'updated_at' => $time,
                    ]);
                }

                $actualAmount = round($total * $discountRate, 2);
                $discountAmount = round($total - $actualAmount, 2);
                $order->update([
                    'total_amount' => $total,
                    'discount_amount' => $discountAmount,
                    'actual_amount' => $actualAmount,
                ]);

                if ($useMember) {
                    $member = $order->member;
                    $points = (int) round($actualAmount);
                    MemberTransaction::create([
                        'member_id' => $member->id,
                        'type' => '消费',
                        'amount' => $actualAmount,
                        'points_change' => $points,
                        'order_id' => $order->id,
                        'created_at' => $time,
                        'updated_at' => $time,
                    ]);
                    $member->increment('total_spent', $actualAmount);
                    $member->increment('points', $points);
                }
            }
        }

        // Add some recharge transactions across the week
        for ($day = 6; $day >= 0; $day--) {
            $date = Carbon::today()->subDays($day);
            $rechargeCount = rand(2, 5);
            for ($i = 0; $i < $rechargeCount; $i++) {
                $member = $members->random();
                $amount = [200, 500, 1000, 1000, 2000][array_rand([200, 500, 1000, 1000, 2000])];
                $gift = (int) round($amount * 0.1);
                $time = $date->copy()->setTime(rand(10, 20), rand(0, 59));
                MemberTransaction::create([
                    'member_id' => $member->id,
                    'type' => '充值',
                    'amount' => $amount,
                    'points_change' => 0,
                    'order_id' => null,
                    'created_at' => $time,
                    'updated_at' => $time,
                ]);
                $member->increment('balance', $amount + $gift);
            }
        }
    }
}
