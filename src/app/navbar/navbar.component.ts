// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-navbar',
//   templateUrl: './navbar.component.html',
//   styleUrl: './navbar.component.css'
// })
// export class NavbarComponent {

// }

import { Component, NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { StockService } from '../../../stock.service';
@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})


export class NavbarComponent {

  constructor(private router: Router, private searchService:StockService) {}

  isActive(baseRoute: string): boolean {
    return this.router.url.includes(baseRoute);
  }

  navigateToLastSearch(): void {
    const lastSearchUrl = this.searchService.getLastSearchUrl();
    this.router.navigateByUrl(lastSearchUrl);
  }

}
