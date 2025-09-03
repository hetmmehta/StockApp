import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StockService } from '../../../stock.service';
import { DatePipe } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, Subscription, interval, Subject, of } from 'rxjs';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, startWith } from 'rxjs/operators';
import * as Highcharts from 'highcharts/highstock';
import { HttpClient } from '@angular/common/http';

interface Quote {
  c: number; 
}

interface Stock {
  symbol: string;
  name: string;
  quantity: number;
  buyPrice: number;
  quote?: Quote;
  currentPrice: number;
  totalCost: number;
  averageCostPerShare: number;
  change: number;
  marketValue: number;
}

interface PortfolioItem {
  _id: string;
  Balance: number;
  Stocks: Stock[];
}

@Component({
  selector: 'app-search-results',
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.css'],
  providers: [DatePipe]
})

export class SearchResultsComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  searchQuery: string = '';
  filteredStocks$!: Observable<any[]>;
  isLoading = false;
  tickerSymbol: string = '';
  marketStatus: string = '';
  marketColor: string = '';
  isStarFilled = false;
  companyProfile: any = null;
  quoteData: any = null;
  companyPeers: any = null;
  companyNews: any[] = []; 
  selectedNewsItem: any;
  closeResult = '';
  insiderSentiment: any = null;
  companyEarnings: any = null;
  recommendationTrends: any = null;
  Highcharts: typeof Highcharts = Highcharts; 
  recommendationChartOptions: any;
  earningsChartOptions: any;
  currentDateTime!: string;
  isMarketOpen: boolean = false;
  private searchTerms = new Subject<string>();
  private updateSubscription!: Subscription;
  historicalData: any;
  historicalChartOptions: any;
  summaryChartOptions: any;
  symbol: string = ''; 
  companyName: string = ''; 
  watchlist: any[] = [];
  showAlert = false;
  alertMessage = '';
  alertType = '';
  errorMessage: string = '';
  portfolio: PortfolioItem[] = [];
  selectedStock: Stock | null = null;
  buyQuantity: number = 0;
  sellQuantity:number=0;
  buyTotal: number = 0;
  sellTotal:number =0;
  modalcontent:any;
  isStockInPortfolio: boolean = false;
  stockQuantity: number = 0;
  searchService: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private stockService: StockService,
    private datePipe: DatePipe,
    private modalService: NgbModal,
    private http: HttpClient
  ) {}
  

  ngOnInit() {
    this.filteredStocks$ = this.searchTerms.pipe(
      debounceTime(300), 
      distinctUntilChanged((prev, curr) => prev.length === curr.length), 
      switchMap(term => {
        this.isLoading = true; 
        return this.stockService.getAutoComplete(term)
          .pipe(
            finalize(() => this.isLoading = false) 
          );
      }),
      catchError(() => {
        this.isLoading = false; 
        return of([]);
      })
    );

    this.route.params.subscribe(params => {
      this.tickerSymbol = params['ticker'];
      if (this.tickerSymbol) {
        this.fetchData(this.tickerSymbol);
        this.checkPortfolio();
        this.checkWatchlist();
      }
    });

    this.updateSubscription = interval(15000).subscribe(() => {
      this.currentDateTime = this.getCurrentDateTime();
      this.fetchQuoteData(this.tickerSymbol); 
    });

    this.route.params.subscribe(params => {
      this.tickerSymbol = params['ticker'];
      if (this.tickerSymbol) {
        this.fetchHistoricalData(this.tickerSymbol); 
      }
    });

    this.route.params.subscribe(params => {
      this.tickerSymbol = params['ticker'];
      if (this.tickerSymbol) {
        this.fetchSummary(this.tickerSymbol); 
      }
    });

    this.fetchPortfolio();

    
  }

  ngOnDestroy() {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }
  }

  // Fetching all the data
  fetchData(symbol: string) {
      this.stockService.getCompanyProfile(symbol).subscribe(
        data => {
          this.companyProfile = data;
        },
        error => console.error('Failed to fetch company profile:', error)
      );
  
      this.stockService.getQuote(symbol).subscribe(
        data => {
          this.quoteData = data; 
        },
        error => console.error('Failed to fetch quote data:', error)
      );
  
      this.stockService.getCompanyPeers(symbol).subscribe(
        data => {
          this.companyPeers = data; 
        },
        error => console.error('Failed to fetch company peers:', error)
      );
  
      this.stockService.getCompanyNews(symbol).subscribe(
        data => {
          this.companyNews = data;
        },
        error => console.error('Failed to fetch company profile:', error)
      );
  
      this.stockService.getInsiderSentiment(this.tickerSymbol).subscribe(
        (response: any) => { 
          this.processInsiderSentimentsData(response.data);
        }, 
        (error: any) => {
          console.error('Failed to fetch insider sentiment data:', error);
        }
      );
  
      this.stockService.getCompanyEarnings(symbol).subscribe(
        data => {
          this.companyEarnings = data;
          this.processEarningsData(this.companyEarnings);
        },
        error => console.error('Failed to fetch company earnings:', error)
      );
  
      this.stockService.getRecommendationTrends(symbol).subscribe(
        data => {
          this.recommendationTrends = data;
          this.processRecommendationTrendsData(this.recommendationTrends);
  
        },
        error => console.error('Failed to fetch recommendation trends:', error)
      );
      this.performSearch(symbol);
  }

  getCurrentDateTime(): string {
    this.currentDate = new Date(); // Update the currentDate to the current moment
    return this.datePipe.transform(this.currentDate, 'yyyy-MM-dd HH:mm:ss') || '';
  }

   // For Search Bar
   search(event: Event): void {
    this.isLoading = true; 
    const value = (event.target as HTMLInputElement).value;
    this.searchTerms.next(value);
  }

  navigateToResults(selectedSymbol?: string): void {
    this.errorMessage = ''; 
    this.searchQuery = selectedSymbol || this.searchQuery.trim();

    if (!this.searchQuery) {
      this.errorMessage = 'Please enter a valid ticker.';
      setTimeout(() => this.errorMessage = '', 5000);
      return;
    }

    this.stockService.getCompanyProfile(this.searchQuery).subscribe((profile: any) => {
      if (profile && Object.keys(profile).length > 0) {
        this.router.navigate(['/search', this.searchQuery]);
      } else {
        this.errorMessage = `No data found. Please enter a valid ticker.`;
        setTimeout(() => this.errorMessage = '', 5000);
      }
    }, (error: any) => {
      console.error('Error checking company profile:', error);
      this.errorMessage = 'An error occurred while searching.';
    });
  }
    
  clearSearch() {
    this.searchQuery = '';
    this.router.navigate(['/search/home']);
  }

  displayFn(stock: any): string {
    return stock && stock.displaySymbol ? `${stock.displaySymbol} ` : '';
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const symbol = event.option.value.displaySymbol;
    if (symbol) {
      this.router.navigate(['/search', symbol]);
    }
  } 

  // For Container 1
  private fetchQuoteData(symbol: string) {
    this.stockService.getQuote(symbol).subscribe(
      data => {
        this.quoteData = data; 
        this.updateMarketStatus(this.quoteData.t);
      },
      error => console.error('Failed to fetch quote data:', error)
    );
  }

  private updateMarketStatus(lastQuoteTimestamp: number) {
    const currentTime = new Date().getTime(); 
    const lastQuoteTime = new Date(lastQuoteTimestamp * 1000); 
    const fiveMinutes = 300000; 

    this.isMarketOpen = (currentTime - lastQuoteTime.getTime()) <= fiveMinutes;
    if (this.isMarketOpen) {
      this.marketStatus = 'Market is open';
      this.marketColor = 'green';
    } else {
      const formattedLastQuoteTime = this.datePipe.transform(lastQuoteTime, 'yyyy-MM-dd HH:mm:ss');
      this.marketStatus = `Market closed on ${formattedLastQuoteTime}`;
      this.marketColor = 'red';
    }
  }

  // Container 1 (Portfolio)
  private fetchPortfolio(): void {
    this.http.get<PortfolioItem[]>('https://stockapp-6m6jkqghca-wl.a.run.app/api/portfolio').subscribe({
      next: (data) => {
        this.portfolio = data.map(portfolio => ({
          ...portfolio,
          Stocks: portfolio.Stocks.map(stock => this.computeStockValues(stock))
        }));

        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching portfolio:', error);
        this.isLoading = false;
      },
    });
  }

  private computeStockValues(stock: Stock): Stock {
    const currentPrice = stock.quote?.c ?? stock.buyPrice;
    const totalCost = stock.quantity * stock.buyPrice;
    const averageCostPerShare = stock.buyPrice;
    const change = currentPrice - averageCostPerShare;
    const marketValue = stock.quantity * currentPrice;

    return {
      ...stock,
      currentPrice,
      totalCost,
      averageCostPerShare,
      change,
      marketValue
    };
  }

  openBuyModal(content: any): void {
    console.log('Current Quote Data:', this.quoteData); 

    if (this.companyProfile && this.quoteData && typeof this.quoteData.c === 'number') {
      this.selectedStock = {
        symbol: this.companyProfile.ticker,
        name: this.companyProfile.name,
        currentPrice: this.quoteData.c, 
        quantity: 0, 
        buyPrice: this.quoteData.c, 
        totalCost: 0, 
        averageCostPerShare: this.quoteData.c, 
        change: 0, 
        marketValue: 0, 
      };
      console.log('aaaa',this.selectedStock.quote)
      this.buyQuantity = 0;
      this.buyTotal = 0;
      this.calculateBuyTotal();
  
      this.modalService.open(content);
    } else {
      console.error('Company profile data is not available.');
    }
  }
  
  calculateBuyTotal(): void {
    if (this.quoteData && typeof this.quoteData.c === 'number') {
      this.buyTotal = this.buyQuantity * this.quoteData.c; 
    } else {
      this.buyTotal = 0; 
    }
  }

  onBuy(stockSymbol: string, buyQuantity: number, buyPrice: number, stockName:string): void {
  
    this.stockService.buyStock(stockSymbol, buyQuantity, buyPrice, stockName).subscribe({
      next: (response) => {
        this.showAlert = true;
        this.alertMessage = `${stockSymbol} bought successfully.`;
        this.alertType = 'success';
        setTimeout(() => this.showAlert = false, 5000); 
        this.fetchPortfolio(); 
        this.modalService.dismissAll(); 
      },
      error: (error) => {
        console.error('Error buying stock:', error);
        this.showAlert = true;
        this.alertMessage = 'Error occurred while purchasing stock.';
        this.alertType = 'danger';
        setTimeout(() => this.showAlert = false, 5000); 
      },
    });
  }

  openSellModal(content: any): void {
    if (this.companyProfile && this.quoteData) {
        this.selectedStock = {
            symbol: this.companyProfile.ticker,
            currentPrice: this.quoteData.c ,

            name: this.companyProfile.name,
            quantity: 0, 
            buyPrice: this.quoteData.c, 
            totalCost: 0, 
            averageCostPerShare: this.quoteData.c, 
            change: 0, 
            marketValue: 0, 
        };
        this.sellQuantity = 0;
        this.sellTotal = 0;
        this.calculateSellTotal(); 
        this.modalService.open(content);
    }
}

  calculateSellTotal(): void {
    if (this.quoteData && typeof this.quoteData.c === 'number') {
        this.sellTotal = this.sellQuantity * this.quoteData.c;
    } else {
        this.sellTotal = 0; 
    }
}
  
  onSell(stockSymbol: string, sellQuantity: number, sellPrice: number): void {
    this.stockService.sellStock(stockSymbol, sellQuantity, sellPrice).subscribe({
      next: (response) => {
        console.log('Stock sold successfully', response);
        this.showAlert = true;
        this.alertMessage = `${stockSymbol} sold successfully.`;
        this.alertType = 'danger';
        setTimeout(() => this.showAlert = false, 5000); 
        this.fetchPortfolio(); 
        this.modalService.dismissAll(); 
      },
      error: (error) => {
        console.error('Error selling stock:', error);
      },
    });
  }

  checkPortfolio() {
    this.http.get<PortfolioItem[]>('https://stockapp-6m6jkqghca-wl.a.run.app/api/portfolio').subscribe({
      next: (portfolio) => {
        const portfolioItem = portfolio[0]; 
        const foundStock = portfolioItem.Stocks.find(stock => stock.symbol === this.companyProfile.ticker);
        
        if (foundStock) {
          this.isStockInPortfolio = true;
          this.stockQuantity = foundStock.quantity;
        } else {
          this.isStockInPortfolio = false;
          this.stockQuantity = 0;
        }
      },
      error: (error) => console.error('Error fetching portfolio:', error),
    });
  }

  // Container 1 (Watchlist)
  checkWatchlist() {
    this.http.get<any[]>('https://stockapp-6m6jkqghca-wl.a.run.app/api/watchlist').subscribe({
      next: (watchlist) => {
        this.isStarFilled = watchlist.some(item => item.stock.some((stock: { symbol: any; }) => stock.symbol === this.companyProfile.ticker));
      },
      error: (error) => console.error('Error fetching watchlist:', error),
    });
  }
    
  fetchwatchlist(){
    this.http.get<any[]>('https://stockapp-6m6jkqghca-wl.a.run.app/api/watchlist').subscribe({
      next: (data) => {
        this.watchlist = data;
      },
      error: (error) => {
        console.error('Error fetching watchlist:', error);
      },
    });
  }

  onStarClick(symbol: string, companyName:string) {
    this.isStarFilled = !this.isStarFilled; 

    if (this.isStarFilled) {
      const payload = {
        symbol,
        companyName
      };
      console.log(payload)

      this.http.post(`https://stockapp-6m6jkqghca-wl.a.run.app/api/watchlist/post`, payload).subscribe({
        next: () => console.log('Stock added to watchlist'),
        error: (error) => console.error('Error adding stock to watchlist:', error)
      });

      this.showAlert = true;
      this.alertMessage = `${symbol} added to Watchlist.`;
      this.alertType = 'success';
      setTimeout(() => this.showAlert = false, 5000);
    } else {

      this.http.delete(`https://stockapp-6m6jkqghca-wl.a.run.app/api/watchlist/${symbol}`).subscribe({
      next: () => {
        this.fetchwatchlist();
      },
      error: (error) => {
        console.error('Error removing stock:', error);
      },
    });

    this.alertMessage = `${symbol} removed from Watchlist.`;
    this.showAlert = true;
    this.alertType = 'danger';
    setTimeout(() => this.showAlert = false, 5000);
    }
  }

 

  // Container 2 (Summary)
  private fetchSummary(symbol: string) {
    this.stockService.getSummaryChart(symbol).subscribe(
      data => {
        this.processSummaryCharts(data);
      },
      error => console.error('Failed to fetch historical data:', error)
    );
  }

  private processSummaryCharts(data: any) {

    const chartData = data.map((datum: { t: any; c: any; }) => [
      datum.t, // 
      datum.c  // 
    ]);
    this.summaryChartOptions = {
      chart: {
        type: 'line',
        backgroundColor: '#f0f0f0'
      },
      title: {
        text: this.tickerSymbol.toUpperCase() + ' Hourly Price Variation',
        style: {
          color: '#8C8C8C',
        }
      },
      xAxis: {
        type: 'datetime',
        tickInterval: 6 * 3600 * 1000,
        dateTimeLabelFormats: {
          hour: '%H:%M' 
        }
      },
      yAxis: {
        title: {
          text: ''
        },
        opposite: true 
      },
      plotOptions: {
        line: {
          marker: {
            enabled: false 
          }
        }
      },
      series: [{
        name: 'Stock Price',
        data: chartData,
        type: 'line',
        color: this.isMarketOpen ? 'green' : 'red', 
        showInLegend: false 
      }]
    }
  }

  // Container 2 (Top News)
  openNewsModal(newsItem: any, content: any) {
    this.selectedNewsItem = newsItem;
    this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title' });
  }

  selectNewsItem(newsItem: any, content: any): void {
    this.selectedNewsItem = newsItem;
    this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title' });
  }

  // Container 2 (Charts)
  private fetchHistoricalData(symbol: string) {
    this.stockService.getHistoricalData(symbol).subscribe(
      data => {
        this.processHistoricalStockData(data);
      },
      error => console.error('Failed to fetch historical data:', error)
    );
  }

  private processHistoricalStockData(data: any[]) {
    const ohlc = data.map(datum => [
      datum.t, 
      datum.o, 
      datum.h, 
      datum.l, 
      datum.c  
    ]);
  
    const volume = data.map(datum => [
      datum.t, 
      datum.v  
    ]);
  
    const groupingUnits = [
      ['week', [1]],
      ['month', [1, 2, 3, 4, 6]]
    ];

    this.historicalChartOptions = {
      title: {
        text: this.tickerSymbol.toUpperCase() + ' Historical',
        style: {
          
          fontSize: '15',
        },
      },
      legend: { enabled: false },
      subtitle: {
        text: 'With SMA and Volume by Price technical indicators',
        style: {
          color: '#9e9e9f',
          fontSize: '12',
        },
      },

      rangeSelector: {
        buttons: [
          {
            type: 'month',
            count: 1,
            text: '1m',
          },
          {
            type: 'month',
            count: 3,
            text: '3m',
          },
          {
            type: 'month',
            count: 6,
            text: '6m',
          },
          {
            type: 'ytd',
            text: 'YTD',
          },
          {
            type: 'year',
            count: 1,
            text: '1y',
          },
          {
            type: 'all',
            text: 'All',
          },
        ],
        selected: 2,
        enabled: true,
        inputEnabled: true,
        
        allButtonsEnabled: true,
      },
      navigator: {
        enabled: true,
      },
      xAxis: {
        ordinal: true,
        

        type: 'datetime',
      },

      yAxis: [
        {
          startOnTick: false,
          endOnTick: false,
          labels: {
            align: 'right',
            x: -3,
          },
          title: {
            text: 'OHLC',
          },
          height: '60%',
          lineWidth: 2,
          resize: {
            enabled: true,
          },
          opposite: true,
        },
        {
          labels: {
            align: 'right',
            x: -3,
          },
          title: {
            text: 'Volume',
          },
          top: '65%',
          height: '35%',
          offset: 0,
          lineWidth: 2,
          opposite: true,
        },
      ],

      tooltip: {
        split: true,
      },

      plotOptions: {
        series: {
          dataGrouping: {
            units: groupingUnits,
          },
        },
      },

      series: [
        {
          type: 'candlestick',
          name: 'AAPL',
          id: 'aapl',
          zIndex: 2,
          data: ohlc,
        },
        {
          type: 'column',
          name: 'Volume',
          id: 'volume',
          data: volume,
          yAxis: 1,
        },
        {
          // type: 'vbp',
          linkedTo: 'aapl',
          params: {
            volumeSeriesID: 'volume',
          },
          dataLabels: {
            enabled: false,
          },
          zoneLines: {
            enabled: false,
          },
        },
        {
          // type: 'sma',
          linkedTo: 'aapl',
          zIndex: 1,
          marker: {
            enabled: false,
          },
        },
      ],
    }
  }

 
  // Container 2 (Insights)
  insiderSentiments: any = {
    totalMSPR: 0,
    positiveMSPR: 0,
    negativeMSPR: 0,
    totalChange: 0,
    positiveChange: 0,
    negativeChange: 0
  };

  private processInsiderSentimentsData(insiderData: any[]) {
    this.insiderSentiments.totalMSPR = parseFloat(insiderData.reduce((sum, record) => sum + record.mspr, 0).toFixed(2));
    this.insiderSentiments.positiveMSPR = parseFloat(insiderData.reduce((sum, record) => record.mspr > 0 ? sum + record.mspr : sum, 0).toFixed(2));
    this.insiderSentiments.negativeMSPR = parseFloat(insiderData.reduce((sum, record) => record.mspr < 0 ? sum + record.mspr : sum, 0).toFixed(2));
    this.insiderSentiments.totalChange = parseFloat(insiderData.reduce((sum, record) => sum + record.change, 0).toFixed(2));
    this.insiderSentiments.positiveChange = parseFloat(insiderData.reduce((sum, record) => record.change > 0 ? sum + record.change : sum, 0).toFixed(2));
    this.insiderSentiments.negativeChange = parseFloat(insiderData.reduce((sum, record) => record.change < 0 ? sum + record.change : sum, 0).toFixed(2));
  }

  private processRecommendationTrendsData(trendsData: any[]) {
    const categories = trendsData.map(trend => trend.period);
    const strongBuyData = trendsData.map(trend => trend.strongBuy);
    const buyData = trendsData.map(trend => trend.buy);
    const holdData = trendsData.map(trend => trend.hold);
    const sellData = trendsData.map(trend => trend.sell);
    const strongSellData = trendsData.map(trend => trend.strongSell);
    
  
    this.recommendationChartOptions = {
      chart:{
        type: 'column',
        backgroundColor: '#f0f0f0'
      },
      title: {
        text: 'Recommendation Trends'
      },
      xAxis: {
        categories: categories
      },
      yAxis: {
        min: 0,
        title: {
          text: '# Analysis'
        },
        stackLabels: {
          enabled: false,
          style: {
            fontWeight: 'bold',
            color: ( // theme
              Highcharts.defaultOptions.title?.style &&
              Highcharts.defaultOptions.title?.style.color
            ) || 'gray'
          }
        }
      },
      tooltip: {
        pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b> ({point.percentage:.0f}%)<br/>',
        shared: true
      },
      plotOptions: {
        column: {
          stacking: 'normal',
          dataLabels: {
            enabled: true
          }
        }
      },
      exporting: {
        enabled: false
      },
      series: [{
        name: 'Strong Buy',
        type: 'column',
        data: strongBuyData,
        color: '#0e9d58' 
      }, {
        name: 'Buy',
        type: 'column',
        data: buyData,
        color: '#57b757' 
      }, {
        name: 'Hold',
        type: 'column',
        data: holdData,
        color: '#bb9733' 
      }, {
        name: 'Sell',
        type: 'column',
        data: sellData,
        color: '#df6e6a' 
      }, {
        name: 'Strong Sell',
        type: 'column',
        data: strongSellData,
        color: '#793e3d' 
      }]
    };
  }
  
  private processEarningsData(earningsData: any[]) {
    const actualData = earningsData.map(earning => ({
      x: Date.parse(earning.period),
      y: earning.actual,
      name: `Actual: ${earning.actual}`
    }));
  
    const estimateData = earningsData.map(earning => ({
      x: Date.parse(earning.period),
      y: earning.estimate,
      name: `Estimate: ${earning.estimate}`
    }));
  
    this.earningsChartOptions = {
      chart: {
        type: 'spline',
        backgroundColor: '#f0f0f0'
      },
      title: {
        text: 'Historical EPS Surprises'
      },
      xAxis: {
        type: 'datetime',
        title: {
          text: 'Date'
        }
      },
      yAxis: {
        title: {
          text: 'EPS'
        }
      },
      tooltip: {
        shared: true,
        pointFormat: '{series.name}: <b>{point.y}</b><br/>',
        valueDecimals: 2 
      },
      plotOptions: {
        series: {
          marker: {
            enabled: true
          }
        }
      },
      series: [{
        name: 'Actual EPS',
        data: actualData,
        color: '#7cb5ec'
      }, {
        name: 'Estimated EPS',
        data: estimateData,
        color: '#434348'
      }]
    };
  }

  performSearch(ticker: string): void {
    const searchUrl = `/search/${ticker}`;
    this.stockService.setLastSearchUrl(searchUrl);
    this.router.navigateByUrl(searchUrl);
  }
 
}




