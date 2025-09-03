import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private apiUrl = 'https://stockapp-6m6jkqghca-wl.a.run.app//api'; // Use your server URL here
  companyProfileExists: any;

  constructor(private http: HttpClient) {}

  getCompanyProfile(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/company-profile`, { params: { symbol } });
  }

  getQuote(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/quote`, { params: { symbol } });
  }

  getRecommendationTrends(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/recommendation-trends`, { params: { symbol } });
  }

  getInsiderSentiment(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/insider-sentiment`, { params: { symbol } });
  }

  getCompanyPeers(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/company-peers`, { params: { symbol } });
  }

  getCompanyEarnings(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/company-earnings`, { params: { symbol } });
  }

  getCompanyNews(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/company-news`, { params: { symbol } });
  }

  getAutoComplete(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { params: { symbol } });
  }

  getHistoricalData(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/historical-data`, { params: { symbol } });
  }

  getSummaryChart(symbol: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/summary-chart`, { params: { symbol } });
  }

  buyStock(stockSymbol: string, buyQuantity: number, buyPrice: number, stockName: string): Observable<any> {
    const payload = {
      stockSymbol,
      buyQuantity,
      buyPrice,
      stockName,
    };
    return this.http.post('https://stockapp-6m6jkqghca-wl.a.run.app/api/portfolio/buy', payload);
  }

  sellStock(stockSymbol: string, sellQuantity: number, sellPrice: number): Observable<any> {
    const payload = {
      stockSymbol,
      sellQuantity,
      sellPrice,
    };
    return this.http.post('https://stockapp-6m6jkqghca-wl.a.run.app/api/portfolio/sell', payload);
  }

  private lastSearchUrl: string = '/search/home';

  setLastSearchUrl(url: string): void {
    this.lastSearchUrl = url;
    console.log("............VALUE SET ...........")
  }

  getLastSearchUrl(): string {
    return this.lastSearchUrl;
  }

}
