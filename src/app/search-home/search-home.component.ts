import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, startWith, map } from 'rxjs/operators';
import { StockService } from '../../../stock.service';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';


@Component({
  selector: 'app-search-home',
  templateUrl: './search-home.component.html',
  styleUrls: ['./search-home.component.css']
})
export class SearchHomeComponent {
  searchQuery: string = '';
  filteredStocks$!: Observable<any[]>;
  private searchTerms = new Subject<string>();
  isLoading = false; // Track loading state
  errorMessage: string = '';


  constructor(
    private router: Router,
    private stockService: StockService
  ) { }

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


  clearSearch(): void {
    this.searchQuery = '';
    this.router.navigate(['/search-home']);
  }

  ngOnInit(): void {

    this.filteredStocks$ = this.searchTerms.pipe(
      debounceTime(300), // Maintain debounceTime for efficiency
      distinctUntilChanged((prev, curr) => prev.length === curr.length), // Only consider length change
      switchMap(term => {
        this.isLoading = true; // Set loading flag on every search term change
        return this.stockService.getAutoComplete(term)
          .pipe(
            finalize(() => this.isLoading = false) // Hide spinner when results are received (or on error)
          );
      }),
      catchError(() => {
        this.isLoading = false; // Hide spinner on error
        return of([]);
      })
    );

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
}
