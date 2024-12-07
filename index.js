require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// In-memory mock database for tracking info
const trackingData = {};

// Shopify webhook verification
function verifyShopifyWebhook(req, res, next) {
  res.send(200);
}

// Webhook endpoint
app.post('/webhook', verifyShopifyWebhook, async (req, res) => {
  const { fulfillment_status, tracking_number, tracking_company, order_id } = req.body;

  if (fulfillment_status === 'fulfilled') {
    try {
      // Store tracking data in mock database
      trackingData[tracking_number] = {
        trackingNumber: tracking_number,
        carrier: tracking_company,
        orderId: order_id,
        status: 'SHIPPED',
      };

      // Send tracking info to PayPal
      const paypalResponse = await axios.post(
        'https://api-m.paypal.com/v1/shipping/trackers-batch',
        {
          trackers: [
            {
              transaction_id: order_id, // Replace with PayPal transaction ID mapping
              tracking_number,
              carrier: tracking_company,
              status: 'SHIPPED',
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getPayPalAccessToken()}`,
          },
        }
      );

      console.log('PayPal response:', paypalResponse.data);
      res.status(200).send('Tracking info sent to PayPal');
    } catch (error) {
      console.error('PayPal API error:', error.response?.data || error.message);
      res.status(500).send('Failed to send tracking info to PayPal');
    }
  } else {
    res.status(200).send('Order not fulfilled');
  }
});

// PayPal access token retrieval
async function getPayPalAccessToken() {
  const response = await axios.post(
    'https://api-m.paypal.com/v1/oauth2/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
        ).toString('base64')}`,
      },
    }
  );
  return response.data.access_token;
}

// Endpoint to track an order
app.get('/apps/track-order', async (req, res) => {
  const { trackingCode } = req.query;

  // Search for the tracking data
  const orderStatus = trackingData[trackingCode];

  if (orderStatus) {
    res.json({
      success: true,
      data: {
        trackingNumber: orderStatus.trackingNumber,
        carrier: orderStatus.carrier,
        status: orderStatus.status,
        orderId: orderStatus.orderId,
      },
    });
  } else {
    res.json({
      success: false,
      message: 'Tracking code not found',
    });
  }
});
app.get('/',(req,res)=>{
  res.send("Hello world! it is success!")
})
// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
