import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface Quote {
  c: number; // Current price
  d: number; // Change in price
  dp: number; // Percentage change in price
}

interface Stock {
  symbol: string;
  companyName: string;
  quote?: Quote; // This property will hold the quote data from the API
}

interface WatchlistItem {
  stock: Stock[];
}

@Component({
  selector: 'app-watchlist',
  templateUrl: './watchlist.component.html',
  styleUrls: ['./watchlist.component.css']
})
export class WatchlistComponent implements OnInit {
  watchlist: any[] = [];
  isLoading: boolean = true;

  constructor(
    private http: HttpClient,
    private router: Router
    ) {}

  ngOnInit(): void {
    this.fetchwatchlist();
  }

  navigateToSearchResult(symbol: string): void {
    this.router.navigateByUrl(`/search/${symbol}`);
  }


  fetchwatchlist(){
    this.http.get<any[]>('https://stockapp-6m6jkqghca-wl.a.run.app/api/watchlist').subscribe({
      next: (data) => {
        this.watchlist = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching watchlist:', error);
      },
    });
  }

  removeStock(symbol: string): void {
    this.http.delete(`https://stockapp-6m6jkqghca-wl.a.run.app/api/watchlist/${symbol}`).subscribe({
      next: () => {
        // Refresh the watchlist after successful removal
        this.fetchwatchlist();
      },
      error: (error) => {
        console.error('Error removing stock:', error);
        this.isLoading = false;
      },
    });
  }

}

