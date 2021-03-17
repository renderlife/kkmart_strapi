'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const moment = require('moment');
const _ = require("lodash");

const generateOrderCode = (length = 6) => {
    let text = ''
    let possible = '0123456789'
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return moment.utc(new Date).format("YYYYMMDD") + text;
}

const getByOrderCode = async (orderCode) => {
    var order = await strapi.query("order").findOne({
        order_code: orderCode,
    });

    return order;
}

const getByOrdersUserId = async (pageIndex, pageSize, userId) => {
    var dataQuery = {
        _start: (pageIndex - 1) * pageSize,
        _limit: pageSize,
        _sort: "created_at:desc",
    };

    var totalRows = await strapi.query('order').count(dataQuery);
    var entities = await strapi.query("order").find(dataQuery);

    return {
        totalRows,
        entities
    };
}

const processCheckout = async (userId, products, is_expressmart, shipping_prodiver_code, order_via, vouchercode,is_use_coin, currency,shopping_cart_id) => {
    // [
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     },
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     }
    // ]

    let totalAmount = 0;
    let discountAmount = 0;
    
    let kcoin_used = 0;
    let kcoin_earned = 0;    

    for (let index = 0; index < products.length; index++) {
        const cartItem = products[index];

        let product = await strapi.services.product.getProductById(cartItem.product_id);
        if (_.isNil(product)) {
            return {
                success: false,
                message: "Product does not exists"
            };
        }

        let variant = product.product_variants.find(s => s.id == cartItem.product_variant_id);
        if (_.isNil(variant)) {
            return {
                success: false,
                message: "Product variant does not exists"
            };
        }

        totalAmount += variant.selling_price * cartItem.qtty;
        let coin_can_use = 0;
        // calculate kcoin used if is_use_coin = true
        if(is_use_coin){
            
            if((variant.can_use_coin===true) && (variant.coin_can_use > 0 ))
            {
                coin_can_use = variant.coin_can_use;
            }
            else{
                if (!_.isNil(product.can_use_coin) && product.can_use_coin == true) {
                coin_can_use = product.coin_can_use;
                }
            }

            kcoin_used += coin_can_use;
        }
        let kcoin_each_earn = 0;
        // calculate kcoin earn
        if(variant.coin_earn > 0)
        {
            kcoin_each_earn = variant.coin_earn;
        }
        else{
            kcoin_each_earn = product.coin_earn|0;
        }
         kcoin_earned += kcoin_each_earn;                     
         
    }

    // check existing to delete
    // get current checkoutId
    let ordcheckout = await strapi.query("order-checkout").findOne({
        user: userId,
        shopping_cart: shopping_cart_id,
        checkoutstatus: strapi.config.constants.shopping_cart_status.new,
        _sort: "id:desc"
    });
    if (!_.isNil(ordcheckout)) {
       await strapi.query("order-checkout").delete({
           id: ordcheckout.id     
        });
    }
    
    let ckoutEntity = {        
        order_via: order_via,
        checkoutstatus: 1,       
        total_amount: totalAmount,
        currency: currency,
        discount_amount: discountAmount,        
        user: userId,
        coin_earned: kcoin_earned,
        coin_used: kcoin_used,
        vouchercode: vouchercode,
        is_expressmart: is_expressmart,
        shipping_prodiver_code: shipping_prodiver_code,
        shopping_cart: shopping_cart_id,
        is_use_coin: is_use_coin
    };

    var order = await strapi.query("order-checkout").create(ckoutEntity);
    if (_.isNil(order)) {
        return {
            success: false,
            message: "Can not create checkout"
        };
    }

    return {
        success: true,
        message: "Checkout has been successfully",
        checkout_id: order.id,
        total_amount: totalAmount,
        discount_amount: discountAmount
    };
}
const processCreateOrder = async (userId, products, is_expressmart, user_address_id, order_via, vouchercode,is_use_coin, shipping_note,currency) => {
    // [
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     },
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     }
    // ]

    let totalAmount = 0;
    let discountAmount = 0;
    let orderProductEntities = [];
    let kcoin_used = 0;
    let kcoin_earned = 0;
    let shipping_fee = 0;

    for (let index = 0; index < products.length; index++) {
        const cartItem = products[index];

        let product = await strapi.services.product.getProductById(cartItem.product_id);
        if (_.isNil(product)) {
            return {
                success: false,
                message: "Product does not exists"
            };
        }

        let variant = product.product_variants.find(s => s.id == cartItem.product_variant_id);
        if (_.isNil(variant)) {
            return {
                success: false,
                message: "Product variant does not exists"
            };
        }

        totalAmount += variant.selling_price * cartItem.qtty;
        let coin_can_use = 0;
        // calculate kcoin used if is_use_coin = true
        if(is_use_coin){
            
            if((variant.can_use_coin===true) && (variant.coin_can_use > 0 ))
            {
                coin_can_use = variant.coin_can_use;
            }
            else{
                if (!_.isNil(product.can_use_coin) && product.can_use_coin == true) {
                coin_can_use = product.coin_can_use;
                }
            }

            kcoin_used += coin_can_use;
        }
        let kcoin_each_earn = 0;
        // calculate kcoin earn
        if(variant.coin_earn > 0)
        {
            kcoin_each_earn = variant.coin_earn;
        }
        else{
            kcoin_each_earn = product.coin_earn|0;
        }
         kcoin_earned += kcoin_each_earn;
        
        orderProductEntities.push({
            product: product.id,
            product_variant: variant.id,
            qtty: cartItem.qtty,
            origin_price: product.price,
            selling_price: variant.selling_price,
            currency: currency,
            discount_amount: 0,
            note: null,
            coin_earned: kcoin_each_earn,
            coin_used: coin_can_use
        });
    }

    let orderEntity = {
        order_code: generateOrderCode(5),
        order_via: order_via,
        order_status: 1,
        payment_status: 1,
        shipping_status: 1,
        total_amount: totalAmount,
        currency: currency,
        discount_amount: discountAmount,
        order_note: "",
        user: userId,
        coin_earned: kcoin_earned,
        coin_used: kcoin_used,
        vouchercode: vouchercode,
        is_express_delivery: is_expressmart
    };

    var order = await strapi.query("order").create(orderEntity);
    if (_.isNil(order)) {
        return {
            success: false,
            message: "Can not create order"
        };
    }

    for (let i = 0; i < orderProductEntities.length; i++) {
        const product = orderProductEntities[i];
        product.order = order.id;

        await strapi.query("order-product").create(product);
    }

    // get Shipping Info
    var userAddressInf = await strapi.query("user-address").findOne({
        id: user_address_id
    });
    // Add shipping information
    var shipping = {
        order: order.id,
        full_name: userAddressInf.full_name,
        phone_number: userAddressInf.phone_number,
        province: userAddressInf.state,
        city: userAddressInf.city,
        address: userAddressInf.address1,
        note: shipping_note,
        status: 1,
        deliver_date: null,
        actual_deliver_date: null,
        deliver_note: null,
        shipping_provider: null,
        postcode: userAddressInf.postcode,
        shippingfee: shipping_fee
    };

    await strapi.query("order-shipping").create(shipping);

    // Add billing address
    /*
    var billingAddress = {
        order: order.id,
        full_name: billing.full_name,
        phone_number: billing.phone_number,
        province: billing.province_id,
        district: billing.district_id,
        address: billing.address,
        note: billing.note,
        status: 1,
        billing_date: null
    };

    await strapi.query("order-billing").create(billingAddress);
    */

    return {
        success: true,
        message: "Checkout has been successfully",
        order_id: order.id,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        order_code: orderEntity.order_code
    };
}
module.exports = {
    checkOut: async (ctx) => {
        //{
        //   "is_expressmart": false,
        //    "shipping_prodiver_code": "LALAMOVE",
        //    "cart_items_id": [
        //      101,
        //      103
        //    ],
        //    "currency": "MYR",
        //    "order_via": "Web",
        //    "vouchercode": "",
        //    "is_use_coin": true
        //  }

        const params = _.assign({}, ctx.request.body, ctx.params);
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (userId == 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'Invalid Token',
                    message: 'Invalid Token',
                })
            );
        }

        if (_.isNil(params.cart_items_id) || params.cart_items_id.length == 0) {
            ctx.send({
                success: false,
                message: "No product for checkout"
            });

            return;
        }

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Shopping cart does not exists"
            });

            return;
        }

        if (_.isNil(shoppingCart.shopping_cart_products)) {
            ctx.send({
                success: false,
                message: "Shopping cart is empty"
            });

            return;
        }

        let checkOutProducts = shoppingCart.shopping_cart_products.filter(s => params.cart_items_id.includes(s.id));
        if (_.isNil(checkOutProducts) || checkOutProducts.length == 0) {
            ctx.send({
                success: false,
                message: "The checkout product does not have in shopping cart"
            });

            return;
        }

        var products = [];

        for (let index = 0; index < checkOutProducts.length; index++) {
            const cartItem = checkOutProducts[index];
            products.push({                
                product_id: cartItem.product,
                product_variant_id: cartItem.product_variant,
                qtty: cartItem.qtty
            });
        }

        var createOrderRes = await processCheckout(userId,
            products,
            params.is_expressmart,
            params.shipping_prodiver_code,            
            params.order_via,
            params.vouchercode,
            params.is_use_coin,            
            params.currency,
            shoppingCart.id
        );

        // update checkout
        if (createOrderRes.success) {
            for (let index = 0; index < checkOutProducts.length; index++) {
                const cartItem = checkOutProducts[index];
                cartItem.checkoutid = createOrderRes.checkout_id;
                await strapi.query("shopping-cart-product").update({ id: cartItem.id },
                    cartItem
                );                
            }
        }        

        ctx.send(createOrderRes);
    },
    createOrder: async (ctx) => {
       // {
        //     "is_expressmart": false,
        //     "user_address_id": "",
        //     "shipping_note": "",
        //     "cart_items_id": [],
        //     "currency": "MYR",        
        //     "order_via": "Web",
        //     "vouchercode": "",
        //     "is_use_coin": true
        // }

        const params = _.assign({}, ctx.request.body, ctx.params);
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (userId == 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'Invalid Token',
                    message: 'Invalid Token',
                })
            );
        }

        if (_.isNil(params.cart_items_id) || params.cart_items_id.length == 0) {
            ctx.send({
                success: false,
                message: "No product for checkout"
            });

            return;
        }

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Shopping cart does not exists"
            });

            return;
        }

        if (_.isNil(shoppingCart.shopping_cart_products)) {
            ctx.send({
                success: false,
                message: "Shopping cart is empty"
            });

            return;
        }

        let checkOutProducts = shoppingCart.shopping_cart_products.filter(s => params.cart_items_id.includes(s.id));
        if (_.isNil(checkOutProducts) || checkOutProducts.length == 0) {
            ctx.send({
                success: false,
                message: "The checkout product does not have in shopping cart"
            });

            return;
        }

        var products = [];

        for (let index = 0; index < checkOutProducts.length; index++) {
            const cartItem = checkOutProducts[index];
            products.push({
                product_id: cartItem.product,
                product_variant_id: cartItem.product_variant,
                qtty: cartItem.qtty
            });
        }

        var createOrderRes = await processCreateOrder(userId,
            products,
            params.is_expressmart,
            params.user_address_id,
            params.order_via,
            params.vouchercode,
            params.is_use_coin,
            params.shipping_note,
            params.currency
        );

        if (createOrderRes.success) {
            for (let index = 0; index < checkOutProducts.length; index++) {
                const cartItem = checkOutProducts[index];
                strapi.query("shopping-cart-product").delete({ id: cartItem.id });
            }
        }        

        ctx.send(createOrderRes);
    },
    getCheckout: async(ctx)=>{

        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (userId == 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'Invalid Token',
                    message: 'Invalid Token',
                })
            );
        }
        // get shopping cart
        let shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });
        if (_.isNil(shoppingCart.shopping_cart_products)) {
            ctx.send({
                success: false,
                message: "Shopping cart is empty"
            });

            return;
        }
        // get current checkoutId
        let ordcheckout = await strapi.query("order-checkout").findOne({
            user: userId,
            shopping_cart: shoppingCart.id,
            checkoutstatus: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });
        if (_.isNil(ordcheckout)) {
            ctx.send({
                success: false,
                message: "Not have any checkout"
            });

            return;
        }

        // get shoppingcart item checked

        let cartItems = await strapi.query("shopping-cart-product").find({           
            shopping_cart: shoppingCart.id,                     
            _sort: "id:desc"
        });                
     
        var cartItemsCk = [];
        for (let index = 0; index < cartItems.length; index++) {
            const element = cartItems[index];
            if (element.checkoutid == ordcheckout.id)
            {
                cartItemsCk.push(cartItems[index]);
            }
        }
      
        if (cartItemsCk.length==0) {
            ctx.send({
                success: false,
                message: "Not have any cartitem has checked out"
            });
            return;
        }
       
        let cartModel = await strapi.services.common.normalizationResponse(cartItemsCk, ["user"]);
        ctx.send({
            checkout_id: ordcheckout.id,
            currency: ordcheckout.currency,
            vouchercode: ordcheckout.vouchercode,
            is_use_coin: ordcheckout.is_use_coin,
            kkoin_can_use: ordcheckout.coin_used,
            shipping_fee: 0,
            cart: Object.values(cartModel)
        });

    },
    getByOrderCode: async (ctx) => {
        const params = _.assign({}, ctx.request.params, ctx.params);
        var orderCode = params.orderCode;

        if (_.isNil(orderCode)) {
            ctx.send({
                success: false,
                message: "Please input order code"
            });

            return;
        }

        var order = await getByOrderCode(orderCode);
        if (_.isNil(order)) {
            ctx.send({
                success: false,
                message: "Order not found"
            });

            return;
        }

        console.log(`order`, order);

        var res = await strapi.services.common.normalizationResponse(
            order, ["user"]
        );

        ctx.send({
            success: true,
            order: res
        });
    },
    getOrdersByUserId: async (ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });

            return;
        }

        const params = _.assign({}, ctx.request.params, ctx.params);
        let pageIndex = 1,
            pageSize = 10;

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }

        var res = await getByOrdersUserId(pageIndex, pageSize, userId);
        if (_.isNil(res)) {
            ctx.send({
                success: false,
                message: "No data found"
            });

            return;
        }

        let models = await strapi.services.common.normalizationResponse(
            res.entities, ["user"]
        );

        ctx.send({
            success: true,
            totalRows: res.totalRows,
            orders: _.values(models)
        });
    }
};