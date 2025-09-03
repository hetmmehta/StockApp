import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { StockService } from '../../../stock.service';


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
  selector: 'app-portfolio',
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.css']
})
export class PortfolioComponent implements OnInit {
  portfolio: PortfolioItem[] = [];
  selectedStock: Stock | null = null;
  buyQuantity: number = 0;
  sellQuantity:number=0;
  buyTotal: number = 0;
  sellTotal:number =0;
  modalcontent:any;
  isLoading = true;
  showAlert = false;
  alertMessage = '';
  alertType = '';

  constructor(
    private http: HttpClient ,private modalService: NgbModal, private stockService: StockService,

    ) {}

  ngOnInit(): void {
    this.fetchPortfolio();
  }

  fetchPortfolio(): void {
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

  showSuccessAlert(message: string): void {
    this.showAlert = true;
    this.alertMessage = message;
    this.alertType = 'success';
    setTimeout(() => this.showAlert = false, 5000); 
  }
  
  showDangerAlert(message: string): void {
    this.showAlert = true;
    this.alertMessage = message;
    this.alertType = 'danger';
    setTimeout(() => this.showAlert = false, 5000); 
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
 
  // SELL Modal

  openSellModal(content: any, stock: Stock): void {
    this.selectedStock = stock;
    this.calculateSellTotal();
    this.sellQuantity = 0; 
    this.sellTotal = 0;
    this.modalService.open(content); 
  }
  

  calculateSellTotal(): void {
    if (this.selectedStock && this.selectedStock.quote) {
      this.sellTotal = this.sellQuantity * this.selectedStock.quote.c;
    }
  }

  isValidSellQuantity(): boolean {
    if (!this.selectedStock) return false;
    return this.sellQuantity > 0 && this.sellQuantity <= this.selectedStock.quantity;
  }
  

  onSell(stockSymbol: string, sellQuantity: number, sellPrice: number): void {
    this.stockService.sellStock(stockSymbol, sellQuantity, sellPrice).subscribe({
      next: (response) => {
        console.log('Stock sold successfully', response);
        this.showDangerAlert(`${stockSymbol} sold successfully.`);
        this.fetchPortfolio(); 
        this.modalService.dismissAll();
      },
      error: (error) => {
        console.error('Error selling stock:', error);
      },
    });
  }
  

// BUY Modal

  openBuyModal(content: any,stock: Stock): void {
    this.selectedStock = stock;
    this.calculateBuyTotal();
    this.buyQuantity = 0;
    this.buyTotal = 0;
    this.modalService.open(content);
  }

  calculateBuyTotal(): void {
    if (this.selectedStock && this.selectedStock.quote) {
      this.buyTotal = this.buyQuantity * this.selectedStock.quote.c;
    }
  }

  isValidBuyQuantity(): boolean {
    if (!this.selectedStock || !this.selectedStock.quote) return false;
    const totalCost = this.buyQuantity * this.selectedStock.quote.c;
    return this.buyQuantity > 0 && totalCost <= this.portfolio[0].Balance;
  }

  onBuy(stockSymbol: string, buyQuantity: number, buyPrice: number,stockName:string): void {
    this.stockService.buyStock(stockSymbol, buyQuantity, buyPrice,stockName).subscribe({
      next: (response) => {
        console.log('Stock purchased successfully', response);
        this.showSuccessAlert(`${stockSymbol} bought successfully.`);
        this.fetchPortfolio();
        this.modalService.dismissAll();
      },
      error: (error) => {
        console.error('Error buying stock:', error);
      },
    });
  }
}
