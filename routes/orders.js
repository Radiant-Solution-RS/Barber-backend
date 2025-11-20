const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authMiddleware } = require('../middleware/auth');

// Create Stripe Checkout Session (no auth required for guest checkout)
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, customerInfo } = req.body;
    
    // Optional: Get user ID from token if provided
    let userId = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // Guest checkout - no user ID
      }
    }

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required' });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.email || !customerInfo.phone || !customerInfo.address) {
      return res.status(400).json({ message: 'Customer information is incomplete' });
    }

    // Verify products and calculate total
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.id);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.id} not found` });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      validatedItems.push({
        productId: product._id,
        title: product.title,
        price: product.price,
        quantity: item.quantity,
        imageUrl: product.imageUrl
      });
    }

    // Create order in database
    const order = new Order({
      customerInfo,
      items: validatedItems,
      totalAmount,
      paymentStatus: 'pending',
      userId: userId // Use extracted userId (null for guest checkout)
    });

    await order.save();

    // Create Stripe line items
    const lineItems = validatedItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title,
          images: item.imageUrl ? [item.imageUrl] : []
        },
        unit_amount: Math.round(item.price * 100) // Convert to cents
      },
      quantity: item.quantity
    }));

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout`,
      customer_email: customerInfo.email,
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber
      }
    });

    // Update order with session ID
    order.stripeSessionId = session.id;
    await order.save();

    res.json({ 
      sessionId: session.id, 
      url: session.url,
      orderId: order._id,
      orderNumber: order.orderNumber
    });

  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ message: 'Failed to create checkout session', error: error.message });
  }
});

// Get all orders (Admin only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const orders = await Order.find()
      .populate('items.productId')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Get user's own orders
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching orders for user:', req.user.id);
    const orders = await Order.find({ userId: req.user.id })
      .populate('items.productId')
      .sort({ createdAt: -1 });

    console.log(`Found ${orders.length} orders for user ${req.user.id}`);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Get single order by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user is admin or order owner
    if (req.user.role !== 'admin' && req.user.role !== 'owner' && order.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

// Get order by session ID (for success page)
router.get('/session/:sessionId', async (req, res) => {
  try {
    const order = await Order.findOne({ stripeSessionId: req.params.sessionId })
      .populate('items.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

// Update order status (Admin only)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentStatus = paymentStatus;
    await order.save();

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

module.exports = router;
