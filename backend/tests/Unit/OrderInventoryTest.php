<?php

namespace Tests\Unit;

use App\Models\Dish;
use App\Models\DishIngredient;
use App\Models\Ingredient;
use App\Models\InventoryRecord;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class OrderInventoryTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;
    private Ingredient $rice;
    private Ingredient $egg;
    private Dish $eggFriedRice;
    private OrderService $orderService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->store = Store::create([
            'name' => '测试门店',
            'address' => '测试地址',
            'phone' => '13800138000',
        ]);

        $this->rice = Ingredient::create([
            'store_id' => $this->store->id,
            'name' => '大米',
            'category' => '主食',
            'unit' => 'kg',
            'stock_qty' => 50.00,
            'warning_threshold' => 10.00,
        ]);

        $this->egg = Ingredient::create([
            'store_id' => $this->store->id,
            'name' => '鸡蛋',
            'category' => '蛋类',
            'unit' => '个',
            'stock_qty' => 100.00,
            'warning_threshold' => 20.00,
        ]);

        $this->eggFriedRice = Dish::create([
            'store_id' => $this->store->id,
            'name' => '蛋炒饭',
            'category' => '主食',
            'price' => 18.00,
            'cost' => 8.00,
            'is_active' => true,
        ]);

        DishIngredient::create([
            'dish_id' => $this->eggFriedRice->id,
            'ingredient_id' => $this->rice->id,
            'quantity' => 0.3,
        ]);

        DishIngredient::create([
            'dish_id' => $this->eggFriedRice->id,
            'ingredient_id' => $this->egg->id,
            'quantity' => 2,
        ]);

        $this->orderService = app(OrderService::class);
    }

    public function test_create_order_decreases_stock(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 2],
            ],
            operator: '测试员'
        );

        $this->rice->refresh();
        $this->egg->refresh();

        $expectedRice = 50 - 0.3 * 2;
        $expectedEgg = 100 - 2 * 2;

        $this->assertEquals($expectedRice, $this->rice->stock_qty, '大米库存扣减不正确');
        $this->assertEquals($expectedEgg, $this->egg->stock_qty, '鸡蛋库存扣减不正确');
    }

    public function test_create_order_creates_outbound_records(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 3],
            ],
            operator: '测试员'
        );

        $records = InventoryRecord::orderBy('id')->get();

        $this->assertCount(2, $records, '应该生成2条出库记录');

        $riceRecord = $records->firstWhere('ingredient_id', $this->rice->id);
        $this->assertNotNull($riceRecord);
        $this->assertEquals('出库', $riceRecord->type);
        $this->assertEquals(0.9, $riceRecord->quantity);
        $this->assertEquals('测试员', $riceRecord->operator);
        $this->assertStringContainsString("出餐消耗(订单 {$order->order_no})", $riceRecord->reason);

        $eggRecord = $records->firstWhere('ingredient_id', $this->egg->id);
        $this->assertNotNull($eggRecord);
        $this->assertEquals('出库', $eggRecord->type);
        $this->assertEquals(6, $eggRecord->quantity);
    }

    public function test_create_order_insufficient_stock_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('库存不足');

        $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 200],
            ],
        );

        $this->rice->refresh();
        $this->egg->refresh();
        $this->assertEquals(50, $this->rice->stock_qty, '库存不足时不应扣减库存');
        $this->assertEquals(100, $this->egg->stock_qty, '库存不足时不应扣减库存');
    }

    public function test_return_dish_restores_stock(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 5],
            ],
            operator: '测试员'
        );

        $orderItem = $order->items->first();

        $this->orderService->returnDish(
            order: $order,
            orderItemId: $orderItem->id,
            quantity: 2,
            reason: '客人退菜',
            operator: '收银员'
        );

        $this->rice->refresh();
        $this->egg->refresh();

        $expectedRice = 50 - 0.3 * 5 + 0.3 * 2;
        $expectedEgg = 100 - 2 * 5 + 2 * 2;

        $this->assertEquals($expectedRice, $this->rice->stock_qty, '退菜后大米库存回补不正确');
        $this->assertEquals($expectedEgg, $this->egg->stock_qty, '退菜后鸡蛋库存回补不正确');
    }

    public function test_return_dish_creates_inbound_records(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 3],
            ],
            operator: '测试员'
        );

        $orderItem = $order->items->first();

        $this->orderService->returnDish(
            order: $order,
            orderItemId: $orderItem->id,
            quantity: 1,
            reason: '口味不合适',
            operator: '收银员'
        );

        $inboundRecords = InventoryRecord::where('type', '入库')->orderBy('id')->get();

        $this->assertCount(2, $inboundRecords, '退菜应该生成2条入库记录');

        $riceRecord = $inboundRecords->firstWhere('ingredient_id', $this->rice->id);
        $this->assertNotNull($riceRecord);
        $this->assertEquals('入库', $riceRecord->type);
        $this->assertEquals(0.3, $riceRecord->quantity);
        $this->assertEquals('收银员', $riceRecord->operator);
        $this->assertStringContainsString('退菜回库', $riceRecord->reason);
    }

    public function test_partial_return_multiple_times(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 10],
            ],
            operator: '测试员'
        );

        $orderItem = $order->items->first();

        $this->orderService->returnDish($order, $orderItem->id, 3, null, '收银员');
        $this->orderService->returnDish($order->refresh(), $orderItem->id, 2, null, '收银员');

        $this->rice->refresh();
        $this->egg->refresh();

        $expectedRice = 50 - 0.3 * 10 + 0.3 * (3 + 2);
        $expectedEgg = 100 - 2 * 10 + 2 * (3 + 2);

        $this->assertEquals($expectedRice, $this->rice->stock_qty, '多次部分退菜后大米库存不正确');
        $this->assertEquals($expectedEgg, $this->egg->stock_qty, '多次部分退菜后鸡蛋库存不正确');
    }

    public function test_full_return_restores_all_stock(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 4],
            ],
            operator: '测试员'
        );

        $orderItem = $order->items->first();

        $this->orderService->returnDish(
            order: $order,
            orderItemId: $orderItem->id,
            quantity: 4,
            reason: '整单退菜',
            operator: '店长'
        );

        $this->rice->refresh();
        $this->egg->refresh();

        $this->assertEquals(50, $this->rice->stock_qty, '全部退菜后大米库存应恢复初始值');
        $this->assertEquals(100, $this->egg->stock_qty, '全部退菜后鸡蛋库存应恢复初始值');
    }

    public function test_return_more_than_remaining_throws_exception(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 3],
            ],
        );

        $orderItem = $order->items->first();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('退菜数量超过可退数量');

        $this->orderService->returnDish($order, $orderItem->id, 5);

        $this->rice->refresh();
        $this->egg->refresh();
        $expectedRice = 50 - 0.3 * 3;
        $expectedEgg = 100 - 2 * 3;
        $this->assertEquals($expectedRice, $this->rice->stock_qty, '退菜失败时不应改变库存');
        $this->assertEquals($expectedEgg, $this->egg->stock_qty, '退菜失败时不应改变库存');
    }

    public function test_return_order_with_wrong_status_throws_exception(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 2],
            ],
        );

        $orderItem = $order->items->first();

        $order->update(['status' => '已退']);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('当前订单状态不允许退菜');

        $this->orderService->returnDish($order, $orderItem->id, 1);
    }

    public function test_empty_items_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('菜品不能为空');

        $this->orderService->createFromDishes($this->store, []);
    }

    public function test_inactive_dish_throws_exception(): void
    {
        $this->eggFriedRice->update(['is_active' => false]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('无效或已下架');

        $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 1],
            ],
        );
    }

    public function test_inventory_records_count_matches_operations(): void
    {
        $order1 = $this->orderService->createFromDishes(
            store: $this->store,
            items: [['dish_id' => $this->eggFriedRice->id, 'quantity' => 2]],
            operator: 'A'
        );

        $order2 = $this->orderService->createFromDishes(
            store: $this->store,
            items: [['dish_id' => $this->eggFriedRice->id, 'quantity' => 1]],
            operator: 'B'
        );

        $item1 = $order1->items->first();
        $this->orderService->returnDish($order1, $item1->id, 1, null, 'C');

        $outboundCount = InventoryRecord::where('type', '出库')->count();
        $inboundCount = InventoryRecord::where('type', '入库')->count();

        $this->assertEquals(4, $outboundCount, '2个订单 * 2种原料 = 4条出库记录');
        $this->assertEquals(2, $inboundCount, '1次退菜 * 2种原料 = 2条入库记录');

        $this->rice->refresh();
        $expectedRice = 50 - 0.3 * 2 - 0.3 * 1 + 0.3 * 1;
        $this->assertEquals($expectedRice, $this->rice->stock_qty);
    }

    public function test_multiple_dishes_share_ingredient(): void
    {
        $noodles = Dish::create([
            'store_id' => $this->store->id,
            'name' => '鸡蛋面',
            'category' => '主食',
            'price' => 15.00,
            'cost' => 6.00,
            'is_active' => true,
        ]);

        DishIngredient::create([
            'dish_id' => $noodles->id,
            'ingredient_id' => $this->egg->id,
            'quantity' => 1,
        ]);

        $flour = Ingredient::create([
            'store_id' => $this->store->id,
            'name' => '面粉',
            'category' => '主食',
            'unit' => 'kg',
            'stock_qty' => 30.00,
            'warning_threshold' => 5.00,
        ]);

        DishIngredient::create([
            'dish_id' => $noodles->id,
            'ingredient_id' => $flour->id,
            'quantity' => 0.2,
        ]);

        $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 3],
                ['dish_id' => $noodles->id, 'quantity' => 2],
            ],
            operator: '测试员'
        );

        $this->egg->refresh();
        $this->rice->refresh();
        $flour->refresh();

        $expectedEgg = 100 - 2 * 3 - 1 * 2;
        $expectedRice = 50 - 0.3 * 3;
        $expectedFlour = 30 - 0.2 * 2;

        $this->assertEquals($expectedEgg, $this->egg->stock_qty, '共用原料鸡蛋扣减不正确');
        $this->assertEquals($expectedRice, $this->rice->stock_qty, '大米扣减不正确');
        $this->assertEquals($expectedFlour, $flour->stock_qty, '面粉扣减不正确');
    }

    public function test_zero_quantity_item_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->orderService->createFromDishes(
            store: $this->store,
            items: [
                ['dish_id' => $this->eggFriedRice->id, 'quantity' => 0],
            ],
        );
    }

    public function test_return_zero_quantity_throws_exception(): void
    {
        $order = $this->orderService->createFromDishes(
            store: $this->store,
            items: [['dish_id' => $this->eggFriedRice->id, 'quantity' => 2]],
        );

        $orderItem = $order->items->first();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('退菜数量必须大于 0');

        $this->orderService->returnDish($order, $orderItem->id, 0);
    }
}
