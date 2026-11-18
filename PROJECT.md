# Project details

## Purpose

Logrono Waters is a station management application for staff handling water refills, pickup orders, deliveries, customer records, and container inventory. Its AquaFlow dashboard brings those workflows into one operational view.

The application connects three records that must agree during daily operations: what customers ordered, which containers remain available, and which completed orders have been paid.

## Workflows

### Orders and customers

Staff create customer records with contact details and delivery addresses, then record pickup or delivery orders. Order totals use the station's current refill price and delivery fee. Delivery orders require a saved customer address.

Creating an order reserves its filled containers immediately. Orders progress from pending to in progress, completed, or cancelled. Completed and cancelled orders remain final. Customer records can be archived while their order history is retained.

Staff can search orders by ID, customer name, or address, filter by status and date, inspect a customer's order history, export filtered records, and print an order summary.

### Payments and reporting

Staff record whether payment has been collected. Collected revenue includes completed, paid orders and is attributed to the completion date in the station's reporting timezone. Outstanding balance includes completed orders awaiting payment. Open orders include pending and in-progress work.

An administrator can mark a paid order unpaid after a refund has been handled externally. A paid order must be saved as unpaid before cancellation restores stock.

### Stock and refill production

Inventory tracks three categories: filled 5-gallon containers, empty 5-gallon containers, and caps/seals. Each production refill consumes one empty container and one cap/seal and adds one filled container.

Staff record supplier deliveries, empty-container returns, losses, and corrections through stock adjustments. Movement history preserves the quantity change, resulting balance, reason, recording account, and timestamp. Low-stock thresholds surface replenishment needs in the dashboard and notifications.

### Suppliers and maintenance

Administrators maintain supplier contact details and assign preferred suppliers to stock categories. Staff schedule equipment maintenance, mark tasks complete, and reopen them when needed. Due maintenance appears in station alerts.

### Station settings

Administrators manage the station name, address, phone number, refill price, delivery fee, and reporting timezone. Price changes apply to future orders; existing orders retain their original prices.

## Roles

Both roles require a verified email account approved for the station.

| Capability                                         | Staff | Administrator |
| -------------------------------------------------- | ----- | ------------- |
| View dashboard and station records                 | Yes   | Yes           |
| Record customers, orders, and collected payments   | Yes   | Yes           |
| Record stock adjustments and production            | Yes   | Yes           |
| Schedule and complete maintenance                  | Yes   | Yes           |
| Export orders and print summaries                  | Yes   | Yes           |
| Change station settings and pricing                | No    | Yes           |
| Add, edit, or remove suppliers                     | No    | Yes           |
| Configure stock thresholds and preferred suppliers | No    | Yes           |
| Archive or restore customers                       | No    | Yes           |
| Reverse an order's paid status                     | No    | Yes           |

Approved account lists are managed through deployment configuration. See [Deployment](DEPLOYMENT.md) for access setup.

## Scope and operating limits

- One shared station per deployment.
- Five-gallon container refills with a station-wide unit price and delivery fee.
- Manual recording of payments and externally handled refunds.
- Order summaries for operational use; tax invoicing and general accounting are outside the current scope.
- In-app replenishment and maintenance alerts; supplier ordering and external messaging are handled separately.
- Paginated customer, order, stock movement, and maintenance records.
- CSV exports of up to 10,000 orders per filtered export and a supplier directory displaying up to 500 entries.
- Reporting timezones of Asia/Manila or UTC.

## Initial operating state

A new database contains station defaults and stock categories with zero quantities. It contains no sample customers or orders. Before daily use, an administrator configures station details and staff access, and staff record actual opening inventory and customer records.

## Project documentation

- [README](README.md): project introduction, stack, local setup, and quality checks.
- [Architecture](ARCHITECTURE.md): system components, data relationships, and consistency guarantees.
- [Deployment](DEPLOYMENT.md): Vercel and Neon setup, environment configuration, and operations.
