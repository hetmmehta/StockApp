const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware to parse JSON bodies and handle CORS
app.use(express.json());
app.use(cors());

// Finnhub and Polygon API key
const finnhubApiKey = FINNHUB_API_KEY = 'd2s7i8pr01qiq7a30i4gd2s7i8pr01qiq7a30i50'  ;
const polygonApiKey = 'df5dEFw9XMwSn59Dr1CcLWUiA18EC2dd';


// Helper function to check if the market is open
function isMarketOpen(lastQuoteTimestamp) {
  const currentTime = new Date().getTime();
  const lastQuoteTime = new Date(lastQuoteTimestamp * 1000);
  const fiveMinutes = 300000;
  return (currentTime - lastQuoteTime.getTime()) <= fiveMinutes;
}

// Route to get company profile
app.get('/api/company-profile', async (req, res) => {
  const { symbol } = req.query;
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubApiKey}`;
  
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get quote data
app.get('/api/quote', async (req, res) => {
  const { symbol } = req.query;
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubApiKey}`;
  
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get recommendation trends
app.get('/api/recommendation-trends', async (req, res) => {
  const { symbol } = req.query;
  const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${finnhubApiKey}`;
  
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get insider sentiment
app.get('/api/insider-sentiment', async (req, res) => {
  const { symbol } = req.query;
  const url = `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${symbol}&from=2022-01-01&token=${finnhubApiKey}`;
  
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get company peers
app.get('/api/company-peers', async (req, res) => {
  const { symbol } = req.query;
  const url = `https://finnhub.io/api/v1/stock/peers?symbol=${symbol}&token=${finnhubApiKey}`;
  
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get company earnings
app.get('/api/company-earnings', async (req, res) => {
  const { symbol } = req.query;
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${finnhubApiKey}`;
  
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Route for autocomplete search feature
app.get('/api/search', async (req, res) => {
  const { symbol } = req.query;
  console.log('Received autocomplete request for query:', symbol);
  const url = `https://finnhub.io/api/v1/search?q=${symbol}&token=${finnhubApiKey}`;
  
  console.log(url)
  try {
    const response = await axios.get(url);
    const filteredResult = response.data.result.filter(item => 
      item.type === 'Common Stock' && !item.symbol.includes('.')
    );

    res.json(filteredResult);
    console.log(filteredResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const moment = require('moment');

function formatDate(date) {
  return moment(date).format('YYYY-MM-DD');
}

// Route to get company news
app.get('/api/company-news', async (req, res) => {
  const { symbol } = req.query;
  
  // Calculate 'from' and 'to' dates
  const to = moment().format('YYYY-MM-DD'); // Current date
  const from = moment().subtract(30, 'days').format('YYYY-MM-DD'); // 30 days before the current date
  
  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${finnhubApiKey}`;
  
  try {
    const response = await axios.get(url);
    // Filter news items that have all the required fields
    const filteredNews = response.data.filter(newsItem => 
      newsItem.headline && newsItem.image && newsItem.source && 
      newsItem.datetime && newsItem.summary && newsItem.url
    );
    // Limit the results to the top 20 news items
    const companyNews = filteredNews.slice(0, 20);
    res.json(companyNews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get historical data from Polygon.io
app.get('/api/historical-data', async (req, res) => {
  const { symbol } = req.query;
  
  // Define your date range here
  const toDate = new Date();
  const fromDate = new Date(toDate.getFullYear(), toDate.getMonth() - 6, toDate.getDate() - 2);

  const formattedtodate = toDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  const formattedfromdate = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD format

  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${formattedfromdate}/${formattedtodate}?adjusted=true&sort=asc&apiKey=${polygonApiKey}`;
console.log(url);
  try {
    const response = await axios.get(url);
    res.json(response.data.results);
    console.log(response.data.results)
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get historical data from Polygon.io
app.get('/api/summary-chart', async (req, res) => {
  const { symbol, lastQuoteTimestamp } = req.query;

  try {
    const tooDate = new Date();
    const frommDate = new Date();

    // Determine if market is open based on lastQuoteTimestamp
    const marketOpen = isMarketOpen(lastQuoteTimestamp);

    if (marketOpen) {
      frommDate.setDate(frommDate.getDate() - 1);
    } else {
      frommDate.setDate(frommDate.getDate() - 2);
      tooDate.setDate(tooDate.getDate() - 1);
    }

    
    const fromDateStr = frommDate.toISOString().split('T')[0];
    const toDateStr = tooDate.toISOString().split('T')[0];

    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/hour/${fromDateStr}/${toDateStr}?adjusted=true&sort=asc&apiKey=${polygonApiKey}`;

    const response = await axios.get(url);
    res.json(response.data.results);
    console.log(response.data.results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DATABASE

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://mehtahet01:mongodbhet@hetassignment.nilz0m5.mongodb.net/?retryWrites=true&w=majority&appName=HetAssignment";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

client.connect();
const database = client.db('HW3');

app.get('/api/portfolio', async (req, res) => {
  try {
    const collection = database.collection('portfolio');
    const portfolios = await collection.find({}).toArray();

    for (let portfolio of portfolios) {
      for (let stock of portfolio.Stocks) {
        const quoteResponse = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${finnhubApiKey}`);
        stock.quote = quoteResponse.data;
      }
    }
    console.log(portfolios)
    res.json(portfolios);
  } catch (error) {
    console.error("Error retrieving portfolio from MongoDB", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/api/portfolio/buy', async (req, res) => {
  try {
    const { stockSymbol, buyQuantity, buyPrice,stockName } = req.body;
    const collection = database.collection('portfolio');

    const portfolio = await collection.findOne({});
    console.log(portfolio);

    if (portfolio) {
      let stock = portfolio.Stocks.find(s => s.symbol === stockSymbol);

      if (stock) {
        const totalQuantity = stock.quantity + buyQuantity;
        const totalCost = stock.buyPrice * stock.quantity + buyPrice;
        const averageCostPerShare = totalCost / totalQuantity;

        await collection.updateOne(
          { _id: portfolio._id, "Stocks.symbol": stockSymbol },
          {
            $set: {
              "Stocks.$.quantity": totalQuantity,
              "Stocks.$.buyPrice": averageCostPerShare,
            },
            $inc: {
              "Balance": -(buyPrice)
            }
          }
        );
      } else {
        // Stock doesn't exist, add it
        await collection.updateOne(
          { _id: portfolio._id },
          {
            $push: {
              "Stocks": {
                symbol: stockSymbol,
                quantity: buyQuantity,
                buyPrice: buyPrice/buyQuantity, 
                name: stockName, 
              }
            },
            $inc: {
              "Balance": -(buyPrice)
            }
          }
        );
      }
      res.json({ message: "Portfolio updated successfully" });
    } else {
      // Handle case where no portfolio exists
      res.status(404).json({ error: "Portfolio not found" });
    }
  } catch (error) {
    console.error("Error processing stock purchase", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post('/api/portfolio/sell', async (req, res) => {
  try {
    const { stockSymbol, sellQuantity, sellPrice } = req.body;
    const collection = database.collection('portfolio');

    const portfolio = await collection.findOne({ "Stocks.symbol": stockSymbol });
    console.log(portfolio);

    if (portfolio) {
      let stock = portfolio.Stocks.find(s => s.symbol === stockSymbol);
      if (!stock || stock.quantity < sellQuantity) {
        res.status(400).json({ message: "Not enough stock to sell." });
        return;
      }
      
      const newQuantity = stock.quantity - sellQuantity;
      const sellTotal =  sellPrice;
      
      if (newQuantity > 0) {
        await collection.updateOne(
          { _id: portfolio._id, "Stocks.symbol": stockSymbol },
          {
            $set: { "Stocks.$.quantity": newQuantity },
            $inc: { "Balance": sellTotal }
          }
        );
      } else {
        await collection.updateOne(
          { _id: portfolio._id },
          {
            $pull: { Stocks: { symbol: stockSymbol } },
            $inc: { "Balance": sellTotal }
          }
        );
      }

      res.json({ message: "Stock sold successfully" });
    } else {
      res.status(404).json({ error: "Portfolio not found" });
    }
  } catch (error) {
    console.error("Error selling stock in portfolio", error);
    res.status(500).json({ error: "Internal Server Error" });
  } 
});



app.get('/watchlist', async (req, res) => {
  try {
    const collection = database.collection('watchlist');
    const watchlist = await collection.find({}).toArray();

    for (let item of watchlist) {
      for (let stock of item.stock) {
        const quoteResponse = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${finnhubApiKey}`);
        stock.quote = quoteResponse.data;
      }
    }

    res.json(watchlist);
    console.log(watchlist)
  } catch (error) {
    console.error("Error retrieving watchlist from MongoDB", error);
    res.status(500).json({ error: "Internal Server Error" });
  } 
});

app.delete('/watchlist/:symbol', async (req, res) => {
  const { id, symbol } = req.params;

  try {

    const collection = database.collection('watchlist');

    const result = await collection.updateOne(
      { }, 
      { $pull: { stock: { symbol: symbol } } }
    );

    if (result.modifiedCount === 1) {
      res.json({ message: 'Stock removed from watchlist.' });
    } else {
      res.status(404).json({ message: 'Stock not found in watchlist.' });
    }
  } catch (error) {
    console.error('Error removing stock from watchlist:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } 
});

app.post('/watchlist/post', async (req, res) => {
  const { symbol, companyName } = req.body;

  try {
    const collection = database.collection('watchlist');
    const updateResult = await collection.updateOne(
      { }, 
      { $addToSet: { stock: { symbol, companyName } } }, 
      { upsert: true }
    );

    if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
      res.status(200).send({ message: 'Stock added to watchlist.' });
    } else {
      res.status(304).send({ message: 'No changes made to the watchlist.' });
    }
  } catch (error) {
    console.error('Failed to add stock to watchlist:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
