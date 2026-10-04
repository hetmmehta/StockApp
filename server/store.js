// MongoDB persistence for the (single-user) portfolio and watchlist.
//
// Documents:
//   portfolio: { Balance: number, Stocks: [{ symbol, name, quantity, buyPrice }] }
//   watchlist: { stock: [{ symbol, companyName }] }

function createMongoStore(db) {
  const portfolioCollection = db.collection('portfolio');
  const watchlistCollection = db.collection('watchlist');

  return {
    listPortfolios() {
      return portfolioCollection.find({}).toArray();
    },

    getPortfolio() {
      return portfolioCollection.findOne({});
    },

    // Add `quantity` shares bought for `totalCost` to the portfolio, keeping
    // buyPrice as the average cost per share.
    async buy(portfolio, { symbol, name, quantity, totalCost }) {
      const stock = (portfolio.Stocks || []).find((s) => s.symbol === symbol);

      if (stock) {
        const totalQuantity = stock.quantity + quantity;
        const averageCostPerShare = (stock.buyPrice * stock.quantity + totalCost) / totalQuantity;
        await portfolioCollection.updateOne(
          { _id: portfolio._id, 'Stocks.symbol': symbol },
          {
            $set: {
              'Stocks.$.quantity': totalQuantity,
              'Stocks.$.buyPrice': averageCostPerShare,
            },
            $inc: { Balance: -totalCost },
          }
        );
      } else {
        await portfolioCollection.updateOne(
          { _id: portfolio._id },
          {
            $push: { Stocks: { symbol, quantity, buyPrice: totalCost / quantity, name } },
            $inc: { Balance: -totalCost },
          }
        );
      }
    },

    // Remove `quantity` shares and credit `proceeds` to the wallet.
    async sell(portfolio, { symbol, quantity, proceeds }) {
      const stock = (portfolio.Stocks || []).find((s) => s.symbol === symbol);
      const newQuantity = stock.quantity - quantity;

      if (newQuantity > 0) {
        await portfolioCollection.updateOne(
          { _id: portfolio._id, 'Stocks.symbol': symbol },
          {
            $set: { 'Stocks.$.quantity': newQuantity },
            $inc: { Balance: proceeds },
          }
        );
      } else {
        await portfolioCollection.updateOne(
          { _id: portfolio._id },
          {
            $pull: { Stocks: { symbol } },
            $inc: { Balance: proceeds },
          }
        );
      }
    },

    listWatchlists() {
      return watchlistCollection.find({}).toArray();
    },

    // Returns true if the watchlist changed.
    async addToWatchlist(symbol, companyName) {
      const result = await watchlistCollection.updateOne(
        {},
        { $addToSet: { stock: { symbol, companyName } } },
        { upsert: true }
      );
      return result.modifiedCount > 0 || result.upsertedCount > 0;
    },

    // Returns true if the symbol was removed.
    async removeFromWatchlist(symbol) {
      const result = await watchlistCollection.updateOne({}, { $pull: { stock: { symbol } } });
      return result.modifiedCount === 1;
    },

    // Every symbol currently held in the portfolio or on the watchlist.
    async trackedSymbols() {
      const [portfolios, watchlists] = await Promise.all([
        this.listPortfolios(),
        this.listWatchlists(),
      ]);
      const symbols = new Set();
      for (const p of portfolios) for (const s of p.Stocks || []) symbols.add(s.symbol);
      for (const w of watchlists) for (const s of w.stock || []) symbols.add(s.symbol);
      return [...symbols];
    },
  };
}

module.exports = { createMongoStore };
