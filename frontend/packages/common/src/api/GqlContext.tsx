import React, { FC, PropsWithChildren, useRef } from 'react';
import {
  GraphQLClient,
  RequestDocument,
  RequestOptions,
  Variables,
} from 'graphql-request';
import { AuthError } from '../authentication/AuthContext';
import { LocalStorage } from '../localStorage';
import { DocumentNode, OperationDefinitionNode } from 'graphql';
import { RequestConfig } from 'graphql-request/build/esm/types';
import { createRegisteredContext } from 'react-singleton-context';

export type SkipRequest = (documentNode: DocumentNode) => boolean;

// ---------------------------------------------------------------------------
// Demo mode — build-time flag injected by webpack DefinePlugin.
// When true, all GQL requests return mock data locally (no server needed).
// ---------------------------------------------------------------------------
declare const DEMO_MODE: boolean;
const isDemoMode = typeof DEMO_MODE !== 'undefined' && DEMO_MODE;

// ---------------------------------------------------------------------------
// DEMO DATA HELPERS
// ---------------------------------------------------------------------------

/**
 * For any GQL operation we haven't explicitly mocked, return a Proxy.
 * When the calling code does `result.someTopLevelKey`, the Proxy intercepts
 * and returns a safe empty-list shape, preventing "data is undefined" crashes.
 */
const makeDemoProxyResponse = (): object =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol' || prop === 'then') return undefined;
        // Most list queries expect { nodes: [], totalCount: 0 }
        return { __typename: 'Connector', nodes: [], totalCount: 0 };
      },
    }
  );

// ---------------------------------------------------------------------------
// Shared sub-objects used across multiple records
// ---------------------------------------------------------------------------
const DEMO_CURRENCY = { id: 'cur-usd', code: 'USD', rate: 1, isHomeCurrency: true };
const DEMO_USER_STUB = { __typename: 'UserNode', username: 'admin', email: 'demo@openmsupply.org' };
const DEMO_PRICING = (total: number) => ({
  __typename: 'PricingNode',
  totalAfterTax: total,
  totalBeforeTax: total,
  stockTotalBeforeTax: total,
  stockTotalAfterTax: total,
  serviceTotalAfterTax: 0,
  serviceTotalBeforeTax: 0,
  taxPercentage: 0,
  foreignCurrencyTotalAfterTax: null,
});
const EMPTY_LINES = { __typename: 'InvoiceLineConnector', nodes: [], totalCount: 0 };

// ---------------------------------------------------------------------------
// OUTBOUND SHIPMENT demo rows (used by the `invoices` query in outbound context)
// ---------------------------------------------------------------------------
const DEMO_OUTBOUND_NODES = [
  { __typename: 'InvoiceNode', id: 'os-1', invoiceNumber: 1001, otherPartyId: 'p-1', otherPartyName: 'City Health Centre', status: 'SHIPPED', type: 'OUTBOUND_SHIPMENT', colour: null, comment: 'Monthly supply run', createdDatetime: '2026-07-10T08:00:00Z', allocatedDatetime: '2026-07-11T09:00:00Z', deliveredDatetime: '2026-07-15T10:00:00Z', pickedDatetime: '2026-07-13T08:00:00Z', shippedDatetime: '2026-07-14T07:00:00Z', verifiedDatetime: null, theirReference: 'REF-001', transportReference: 'TRK-001', taxPercentage: 0, expectedDeliveryDate: '2026-07-16', customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(2450.00), lines: EMPTY_LINES, shippingMethod: null },
  { __typename: 'InvoiceNode', id: 'os-2', invoiceNumber: 1002, otherPartyId: 'p-2', otherPartyName: 'Riverside Clinic', status: 'PICKED', type: 'OUTBOUND_SHIPMENT', colour: null, comment: 'Emergency order', createdDatetime: '2026-07-18T10:00:00Z', allocatedDatetime: '2026-07-19T11:00:00Z', deliveredDatetime: null, pickedDatetime: '2026-07-20T09:00:00Z', shippedDatetime: null, verifiedDatetime: null, theirReference: 'REF-002', transportReference: null, taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(1800.00), lines: EMPTY_LINES, shippingMethod: null },
  { __typename: 'InvoiceNode', id: 'os-3', invoiceNumber: 1003, otherPartyId: 'p-3', otherPartyName: 'Northern District Hospital', status: 'ALLOCATED', type: 'OUTBOUND_SHIPMENT', colour: null, comment: null, createdDatetime: '2026-07-22T14:00:00Z', allocatedDatetime: '2026-07-23T15:00:00Z', deliveredDatetime: null, pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, theirReference: 'REF-003', transportReference: null, taxPercentage: 0, expectedDeliveryDate: '2026-07-30', customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(3600.00), lines: EMPTY_LINES, shippingMethod: null },
  { __typename: 'InvoiceNode', id: 'os-4', invoiceNumber: 1004, otherPartyId: 'p-4', otherPartyName: 'Westside Pharmacy', status: 'NEW', type: 'OUTBOUND_SHIPMENT', colour: null, comment: 'Routine restock', createdDatetime: '2026-07-28T11:00:00Z', allocatedDatetime: null, deliveredDatetime: null, pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, theirReference: null, transportReference: null, taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(920.00), lines: EMPTY_LINES, shippingMethod: null },
  { __typename: 'InvoiceNode', id: 'os-5', invoiceNumber: 1005, otherPartyId: 'p-1', otherPartyName: 'City Health Centre', status: 'VERIFIED', type: 'OUTBOUND_SHIPMENT', colour: null, comment: 'Quarterly vaccines', createdDatetime: '2026-06-01T08:00:00Z', allocatedDatetime: '2026-06-02T09:00:00Z', deliveredDatetime: '2026-06-10T10:00:00Z', pickedDatetime: '2026-06-08T08:00:00Z', shippedDatetime: '2026-06-09T07:00:00Z', verifiedDatetime: '2026-06-11T12:00:00Z', theirReference: 'REF-005', transportReference: 'TRK-005', taxPercentage: 0, expectedDeliveryDate: '2026-06-10', customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(5200.00), lines: EMPTY_LINES, shippingMethod: null },
  { __typename: 'InvoiceNode', id: 'os-6', invoiceNumber: 1006, otherPartyId: 'p-5', otherPartyName: 'Eastside Medical Post', status: 'SHIPPED', type: 'OUTBOUND_SHIPMENT', colour: null, comment: null, createdDatetime: '2026-06-15T09:00:00Z', allocatedDatetime: '2026-06-16T10:00:00Z', deliveredDatetime: '2026-06-20T11:00:00Z', pickedDatetime: '2026-06-18T08:00:00Z', shippedDatetime: '2026-06-19T07:00:00Z', verifiedDatetime: null, theirReference: 'REF-006', transportReference: 'TRK-006', taxPercentage: 0, expectedDeliveryDate: '2026-06-20', customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(1350.00), lines: EMPTY_LINES, shippingMethod: null },
  { __typename: 'InvoiceNode', id: 'os-7', invoiceNumber: 1007, otherPartyId: 'p-3', otherPartyName: 'Northern District Hospital', status: 'DELIVERED', type: 'OUTBOUND_SHIPMENT', colour: null, comment: 'Surgical supplies', createdDatetime: '2026-05-20T10:00:00Z', allocatedDatetime: '2026-05-21T10:00:00Z', deliveredDatetime: '2026-05-28T10:00:00Z', pickedDatetime: '2026-05-25T08:00:00Z', shippedDatetime: '2026-05-26T07:00:00Z', verifiedDatetime: '2026-05-29T15:00:00Z', theirReference: 'REF-007', transportReference: 'TRK-007', taxPercentage: 0, expectedDeliveryDate: '2026-05-28', customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(7800.00), lines: EMPTY_LINES, shippingMethod: null },
  { __typename: 'InvoiceNode', id: 'os-8', invoiceNumber: 1008, otherPartyId: 'p-2', otherPartyName: 'Riverside Clinic', status: 'NEW', type: 'OUTBOUND_SHIPMENT', colour: null, comment: null, createdDatetime: '2026-08-01T08:00:00Z', allocatedDatetime: null, deliveredDatetime: null, pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, theirReference: null, transportReference: null, taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(640.00), lines: EMPTY_LINES, shippingMethod: null },
];

// ---------------------------------------------------------------------------
// INBOUND SHIPMENT demo rows
// ---------------------------------------------------------------------------
const DEMO_INBOUND_NODES = [
  { __typename: 'InvoiceNode', id: 'is-1', invoiceNumber: 2001, otherPartyId: 's-1', otherPartyName: 'National Medical Supplies', status: 'RECEIVED', type: 'INBOUND_SHIPMENT', colour: null, comment: 'Quarterly resupply', createdDatetime: '2026-07-05T08:00:00Z', deliveredDatetime: '2026-07-12T10:00:00Z', receivedDatetime: '2026-07-12T14:00:00Z', pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, onHold: false, theirReference: 'PO-2001', transportReference: 'CON-001', taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(12500.00), lines: EMPTY_LINES, requisition: null, linkedShipment: null, purchaseOrder: null, inboundType: 'INBOUND_SHIPMENT' },
  { __typename: 'InvoiceNode', id: 'is-2', invoiceNumber: 2002, otherPartyId: 's-2', otherPartyName: 'Global Pharma Distributors', status: 'DELIVERED', type: 'INBOUND_SHIPMENT', colour: null, comment: 'Vaccine batch', createdDatetime: '2026-07-15T09:00:00Z', deliveredDatetime: '2026-07-22T10:00:00Z', receivedDatetime: null, pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, onHold: false, theirReference: 'PO-2002', transportReference: 'CON-002', taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(28000.00), lines: EMPTY_LINES, requisition: null, linkedShipment: null, purchaseOrder: null, inboundType: 'INBOUND_SHIPMENT' },
  { __typename: 'InvoiceNode', id: 'is-3', invoiceNumber: 2003, otherPartyId: 's-1', otherPartyName: 'National Medical Supplies', status: 'NEW', type: 'INBOUND_SHIPMENT', colour: null, comment: null, createdDatetime: '2026-07-25T10:00:00Z', deliveredDatetime: null, receivedDatetime: null, pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, onHold: false, theirReference: 'PO-2003', transportReference: null, taxPercentage: 0, expectedDeliveryDate: '2026-08-10', customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(8900.00), lines: EMPTY_LINES, requisition: null, linkedShipment: null, purchaseOrder: null, inboundType: 'INBOUND_SHIPMENT' },
  { __typename: 'InvoiceNode', id: 'is-4', invoiceNumber: 2004, otherPartyId: 's-3', otherPartyName: 'MedEquip Solutions', status: 'RECEIVED', type: 'INBOUND_SHIPMENT', colour: null, comment: 'PPE supplies', createdDatetime: '2026-06-20T08:00:00Z', deliveredDatetime: '2026-06-28T10:00:00Z', receivedDatetime: '2026-06-28T15:00:00Z', pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, onHold: false, theirReference: 'PO-2004', transportReference: 'CON-004', taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(4300.00), lines: EMPTY_LINES, requisition: null, linkedShipment: null, purchaseOrder: null, inboundType: 'INBOUND_SHIPMENT' },
  { __typename: 'InvoiceNode', id: 'is-5', invoiceNumber: 2005, otherPartyId: 's-2', otherPartyName: 'Global Pharma Distributors', status: 'VERIFIED', type: 'INBOUND_SHIPMENT', colour: null, comment: 'Antibiotics restocking', createdDatetime: '2026-06-05T10:00:00Z', deliveredDatetime: '2026-06-15T10:00:00Z', receivedDatetime: '2026-06-15T14:00:00Z', pickedDatetime: null, shippedDatetime: null, verifiedDatetime: '2026-06-16T09:00:00Z', onHold: false, theirReference: 'PO-2005', transportReference: 'CON-005', taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(18700.00), lines: EMPTY_LINES, requisition: null, linkedShipment: null, purchaseOrder: null, inboundType: 'INBOUND_SHIPMENT' },
  { __typename: 'InvoiceNode', id: 'is-6', invoiceNumber: 2006, otherPartyId: 's-4', otherPartyName: 'RegionalHealth Procurement', status: 'DELIVERED', type: 'INBOUND_SHIPMENT', colour: null, comment: null, createdDatetime: '2026-05-10T09:00:00Z', deliveredDatetime: '2026-05-20T10:00:00Z', receivedDatetime: null, pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, onHold: false, theirReference: 'PO-2006', transportReference: 'CON-006', taxPercentage: 0, expectedDeliveryDate: null, customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(9600.00), lines: EMPTY_LINES, requisition: null, linkedShipment: null, purchaseOrder: null, inboundType: 'INBOUND_SHIPMENT' },
  { __typename: 'InvoiceNode', id: 'is-7', invoiceNumber: 2007, otherPartyId: 's-1', otherPartyName: 'National Medical Supplies', status: 'NEW', type: 'INBOUND_SHIPMENT', colour: null, comment: 'Cold chain supplies', createdDatetime: '2026-08-03T08:00:00Z', deliveredDatetime: null, receivedDatetime: null, pickedDatetime: null, shippedDatetime: null, verifiedDatetime: null, onHold: true, theirReference: 'PO-2007', transportReference: null, taxPercentage: 0, expectedDeliveryDate: '2026-08-15', customFields: null, currencyRate: 1, currency: DEMO_CURRENCY, pricing: DEMO_PRICING(22100.00), lines: EMPTY_LINES, requisition: null, linkedShipment: null, purchaseOrder: null, inboundType: 'INBOUND_SHIPMENT' },
];

// ---------------------------------------------------------------------------
// STOCK LINE demo rows
// ---------------------------------------------------------------------------
const DEMO_STOCK_NODES = [
  { __typename: 'StockLineNode', id: 'sl-1', itemId: 'item-1', itemName: 'Amoxicillin 500mg', itemCode: 'AMX-500', batch: 'BATCH-2024-01', packSize: 100, numberOfPacks: 250, availableNumberOfPacks: 220, totalNumberOfPacks: 250, storeId: 'demo-store-1', expiryDate: '2027-06-30', sellPricePerPack: 18.50, costPricePerPack: 14.00, onHold: false, note: null, locationId: 'loc-1', location: { id: 'loc-1', name: 'Shelf A1', code: 'A1', onHold: false }, item: { id: 'item-1', name: 'Amoxicillin 500mg', code: 'AMX-500', unitName: 'Tablet', isVaccine: false, doses: 1 }, vvmStatusId: null, donor: null },
  { __typename: 'StockLineNode', id: 'sl-2', itemId: 'item-2', itemName: 'Paracetamol 500mg', itemCode: 'PCM-500', batch: 'BATCH-2024-02', packSize: 200, numberOfPacks: 400, availableNumberOfPacks: 380, totalNumberOfPacks: 400, storeId: 'demo-store-1', expiryDate: '2027-12-31', sellPricePerPack: 8.00, costPricePerPack: 5.50, onHold: false, note: null, locationId: 'loc-1', location: { id: 'loc-1', name: 'Shelf A1', code: 'A1', onHold: false }, item: { id: 'item-2', name: 'Paracetamol 500mg', code: 'PCM-500', unitName: 'Tablet', isVaccine: false, doses: 1 }, vvmStatusId: null, donor: null },
  { __typename: 'StockLineNode', id: 'sl-3', itemId: 'item-3', itemName: 'Oral Rehydration Salts', itemCode: 'ORS-001', batch: 'BATCH-2024-03', packSize: 50, numberOfPacks: 120, availableNumberOfPacks: 120, totalNumberOfPacks: 120, storeId: 'demo-store-1', expiryDate: '2026-09-30', sellPricePerPack: 3.20, costPricePerPack: 2.00, onHold: false, note: null, locationId: 'loc-2', location: { id: 'loc-2', name: 'Shelf B3', code: 'B3', onHold: false }, item: { id: 'item-3', name: 'Oral Rehydration Salts', code: 'ORS-001', unitName: 'Sachet', isVaccine: false, doses: 1 }, vvmStatusId: null, donor: null },
  { __typename: 'StockLineNode', id: 'sl-4', itemId: 'item-4', itemName: 'Measles Vaccine', itemCode: 'MMR-VAC', batch: 'VAC-2024-04', packSize: 10, numberOfPacks: 80, availableNumberOfPacks: 75, totalNumberOfPacks: 80, storeId: 'demo-store-1', expiryDate: '2026-12-31', sellPricePerPack: 45.00, costPricePerPack: 38.00, onHold: false, note: 'Cold chain required', locationId: 'loc-3', location: { id: 'loc-3', name: 'Cold Room 1', code: 'CR1', onHold: false }, item: { id: 'item-4', name: 'Measles Vaccine', code: 'MMR-VAC', unitName: 'Dose', isVaccine: true, doses: 1 }, vvmStatusId: null, donor: null },
  { __typename: 'StockLineNode', id: 'sl-5', itemId: 'item-5', itemName: 'Surgical Gloves (Medium)', itemCode: 'GLV-MED', batch: 'BATCH-2024-05', packSize: 100, numberOfPacks: 60, availableNumberOfPacks: 60, totalNumberOfPacks: 60, storeId: 'demo-store-1', expiryDate: '2028-06-30', sellPricePerPack: 12.00, costPricePerPack: 9.50, onHold: false, note: null, locationId: 'loc-2', location: { id: 'loc-2', name: 'Shelf B3', code: 'B3', onHold: false }, item: { id: 'item-5', name: 'Surgical Gloves (Medium)', code: 'GLV-MED', unitName: 'Pair', isVaccine: false, doses: 1 }, vvmStatusId: null, donor: null },
  { __typename: 'StockLineNode', id: 'sl-6', itemId: 'item-6', itemName: 'Metronidazole 400mg', itemCode: 'MTZ-400', batch: 'BATCH-2024-06', packSize: 100, numberOfPacks: 180, availableNumberOfPacks: 160, totalNumberOfPacks: 180, storeId: 'demo-store-1', expiryDate: '2027-03-31', sellPricePerPack: 22.00, costPricePerPack: 16.00, onHold: false, note: null, locationId: 'loc-1', location: { id: 'loc-1', name: 'Shelf A1', code: 'A1', onHold: false }, item: { id: 'item-6', name: 'Metronidazole 400mg', code: 'MTZ-400', unitName: 'Tablet', isVaccine: false, doses: 1 }, vvmStatusId: null, donor: null },
  { __typename: 'StockLineNode', id: 'sl-7', itemId: 'item-7', itemName: 'Ibuprofen 400mg', itemCode: 'IBU-400', batch: 'BATCH-2024-07', packSize: 100, numberOfPacks: 300, availableNumberOfPacks: 290, totalNumberOfPacks: 300, storeId: 'demo-store-1', expiryDate: '2027-09-30', sellPricePerPack: 10.00, costPricePerPack: 7.00, onHold: false, note: null, locationId: 'loc-1', location: { id: 'loc-1', name: 'Shelf A1', code: 'A1', onHold: false }, item: { id: 'item-7', name: 'Ibuprofen 400mg', code: 'IBU-400', unitName: 'Tablet', isVaccine: false, doses: 1 }, vvmStatusId: null, donor: null },
  { __typename: 'StockLineNode', id: 'sl-8', itemId: 'item-8', itemName: 'Chlorhexidine Solution 4%', itemCode: 'CHX-4PCT', batch: 'BATCH-2024-08', packSize: 1, numberOfPacks: 50, availableNumberOfPacks: 48, totalNumberOfPacks: 50, storeId: 'demo-store-1', expiryDate: '2026-06-30', sellPricePerPack: 6.50, costPricePerPack: 4.00, onHold: true, note: 'On hold pending quality check', locationId: 'loc-2', location: { id: 'loc-2', name: 'Shelf B3', code: 'B3', onHold: false }, item: { id: 'item-8', name: 'Chlorhexidine Solution 4%', code: 'CHX-4PCT', unitName: 'Litre', isVaccine: false, doses: 1 }, vvmStatusId: null, donor: null },
];

// ---------------------------------------------------------------------------
// STOCKTAKE demo rows
// ---------------------------------------------------------------------------
const DEMO_STOCKTAKE_NODES = [
  { __typename: 'StocktakeNode', id: 'stk-1', stocktakeNumber: 1, status: 'FINALISED', description: 'Monthly stocktake July 2026', comment: null, createdDatetime: '2026-07-31T08:00:00Z', finalisedDatetime: '2026-07-31T17:00:00Z', isLocked: true, lines: EMPTY_LINES, user: DEMO_USER_STUB },
  { __typename: 'StocktakeNode', id: 'stk-2', stocktakeNumber: 2, status: 'DRAFT', description: 'August stocktake', comment: 'In progress', createdDatetime: '2026-08-01T09:00:00Z', finalisedDatetime: null, isLocked: false, lines: EMPTY_LINES, user: DEMO_USER_STUB },
  { __typename: 'StocktakeNode', id: 'stk-3', stocktakeNumber: 3, status: 'FINALISED', description: 'Monthly stocktake June 2026', comment: null, createdDatetime: '2026-06-30T08:00:00Z', finalisedDatetime: '2026-06-30T16:30:00Z', isLocked: true, lines: EMPTY_LINES, user: DEMO_USER_STUB },
  { __typename: 'StocktakeNode', id: 'stk-4', stocktakeNumber: 4, status: 'FINALISED', description: 'Cold chain spot check', comment: 'Vaccines only', createdDatetime: '2026-07-15T10:00:00Z', finalisedDatetime: '2026-07-15T14:00:00Z', isLocked: true, lines: EMPTY_LINES, user: DEMO_USER_STUB },
  { __typename: 'StocktakeNode', id: 'stk-5', stocktakeNumber: 5, status: 'DRAFT', description: 'PPE quarterly count', comment: null, createdDatetime: '2026-08-05T09:00:00Z', finalisedDatetime: null, isLocked: false, lines: EMPTY_LINES, user: DEMO_USER_STUB },
];

// ---------------------------------------------------------------------------
// REQUISITIONS demo rows (request)
// ---------------------------------------------------------------------------
const DEMO_REQUISITION_NODES = [
  { __typename: 'RequisitionNode', id: 'req-1', requisitionNumber: 501, status: 'FINALISED', type: 'REQUEST', comment: 'Monthly order - July', createdDatetime: '2026-07-01T08:00:00Z', sentDatetime: '2026-07-02T10:00:00Z', finalisedDatetime: '2026-07-10T14:00:00Z', colour: null, theirReference: null, otherPartyId: 's-1', otherPartyName: 'National Medical Supplies', lines: EMPTY_LINES, user: DEMO_USER_STUB, shipments: { __typename: 'InvoiceConnector', nodes: [], totalCount: 0 }, programName: null, periodName: null, orderType: null },
  { __typename: 'RequisitionNode', id: 'req-2', requisitionNumber: 502, status: 'SENT', type: 'REQUEST', comment: 'Vaccine replenishment', createdDatetime: '2026-07-20T10:00:00Z', sentDatetime: '2026-07-21T09:00:00Z', finalisedDatetime: null, colour: null, theirReference: null, otherPartyId: 's-2', otherPartyName: 'Global Pharma Distributors', lines: EMPTY_LINES, user: DEMO_USER_STUB, shipments: { __typename: 'InvoiceConnector', nodes: [], totalCount: 0 }, programName: null, periodName: null, orderType: null },
  { __typename: 'RequisitionNode', id: 'req-3', requisitionNumber: 503, status: 'DRAFT', type: 'REQUEST', comment: null, createdDatetime: '2026-08-01T08:00:00Z', sentDatetime: null, finalisedDatetime: null, colour: null, theirReference: null, otherPartyId: 's-1', otherPartyName: 'National Medical Supplies', lines: EMPTY_LINES, user: DEMO_USER_STUB, shipments: { __typename: 'InvoiceConnector', nodes: [], totalCount: 0 }, programName: null, periodName: null, orderType: null },
  { __typename: 'RequisitionNode', id: 'req-4', requisitionNumber: 504, status: 'FINALISED', type: 'REQUEST', comment: 'Emergency PPE order', createdDatetime: '2026-06-15T09:00:00Z', sentDatetime: '2026-06-15T11:00:00Z', finalisedDatetime: '2026-06-20T14:00:00Z', colour: null, theirReference: null, otherPartyId: 's-3', otherPartyName: 'MedEquip Solutions', lines: EMPTY_LINES, user: DEMO_USER_STUB, shipments: { __typename: 'InvoiceConnector', nodes: [], totalCount: 0 }, programName: null, periodName: null, orderType: null },
  { __typename: 'RequisitionNode', id: 'req-5', requisitionNumber: 505, status: 'SENT', type: 'REQUEST', comment: 'Q3 antibiotics', createdDatetime: '2026-07-28T10:00:00Z', sentDatetime: '2026-07-29T09:00:00Z', finalisedDatetime: null, colour: null, theirReference: null, otherPartyId: 's-2', otherPartyName: 'Global Pharma Distributors', lines: EMPTY_LINES, user: DEMO_USER_STUB, shipments: { __typename: 'InvoiceConnector', nodes: [], totalCount: 0 }, programName: null, periodName: null, orderType: null },
  { __typename: 'RequisitionNode', id: 'req-6', requisitionNumber: 506, status: 'DRAFT', type: 'REQUEST', comment: 'Surgical consumables', createdDatetime: '2026-08-06T11:00:00Z', sentDatetime: null, finalisedDatetime: null, colour: null, theirReference: null, otherPartyId: 's-3', otherPartyName: 'MedEquip Solutions', lines: EMPTY_LINES, user: DEMO_USER_STUB, shipments: { __typename: 'InvoiceConnector', nodes: [], totalCount: 0 }, programName: null, periodName: null, orderType: null },
];

// ---------------------------------------------------------------------------
// REPORTS demo rows
// ---------------------------------------------------------------------------
const DEMO_REPORT_NODES = [
  { __typename: 'ReportNode', id: 'rpt-1', name: 'Monthly Stock Summary', context: 'DISPENSARY', comment: null, subContext: null, isCustom: false, type: 'OM_SUPPLY' },
  { __typename: 'ReportNode', id: 'rpt-2', name: 'Outbound Shipment Report', context: 'STOCK', comment: null, subContext: null, isCustom: false, type: 'OM_SUPPLY' },
  { __typename: 'ReportNode', id: 'rpt-3', name: 'Inbound Shipment Report', context: 'STOCK', comment: null, subContext: null, isCustom: false, type: 'OM_SUPPLY' },
  { __typename: 'ReportNode', id: 'rpt-4', name: 'Expiry Date Report', context: 'DISPENSARY', comment: 'Lists all items expiring within 90 days', subContext: null, isCustom: false, type: 'OM_SUPPLY' },
  { __typename: 'ReportNode', id: 'rpt-5', name: 'Vaccine Stock Coverage', context: 'DISPENSARY', comment: null, subContext: null, isCustom: false, type: 'OM_SUPPLY' },
  { __typename: 'ReportNode', id: 'rpt-6', name: 'Stocktake Discrepancy Report', context: 'STOCK', comment: null, subContext: null, isCustom: false, type: 'OM_SUPPLY' },
  { __typename: 'ReportNode', id: 'rpt-7', name: 'Requisition Status Report', context: 'DISPENSARY', comment: null, subContext: null, isCustom: false, type: 'OM_SUPPLY' },
];

// ---------------------------------------------------------------------------
// LOCATIONS demo rows
// ---------------------------------------------------------------------------
const DEMO_LOCATION_NODES = [
  { __typename: 'LocationNode', id: 'loc-1', name: 'Shelf A1', code: 'A1', onHold: false, stock: { __typename: 'StockLineConnector', totalCount: 12, nodes: [] } },
  { __typename: 'LocationNode', id: 'loc-2', name: 'Shelf B3', code: 'B3', onHold: false, stock: { __typename: 'StockLineConnector', totalCount: 8, nodes: [] } },
  { __typename: 'LocationNode', id: 'loc-3', name: 'Cold Room 1', code: 'CR1', onHold: false, stock: { __typename: 'StockLineConnector', totalCount: 5, nodes: [] } },
  { __typename: 'LocationNode', id: 'loc-4', name: 'Controlled Substances Safe', code: 'CSS', onHold: false, stock: { __typename: 'StockLineConnector', totalCount: 3, nodes: [] } },
  { __typename: 'LocationNode', id: 'loc-5', name: 'Receiving Bay', code: 'RCV', onHold: false, stock: { __typename: 'StockLineConnector', totalCount: 2, nodes: [] } },
];

// ---------------------------------------------------------------------------
// ITEMS demo rows — matches the ItemsWithStats fragment exactly
// ---------------------------------------------------------------------------
const DEMO_ITEM_STATS = (soh: number, amc: number) => ({
  __typename: 'ItemStatsNode',
  averageMonthlyConsumption: amc,
  availableStockOnHand: soh,
  availableMonthsOfStockOnHand: amc > 0 ? Math.round(soh / amc) : null,
  monthsOfStockOnHand: amc > 0 ? Math.round(soh / amc) : null,
  totalConsumption: amc * 3,
  stockOnHand: soh,
});
const DEMO_ITEM_NODES = [
  { __typename: 'ItemNode', id: 'item-1', name: 'Amoxicillin 500mg', code: 'AMX-500', unitName: 'Tablet', isVaccine: false, doses: 1, defaultPackSize: 100, customFields: null, availableStockOnHand: 22000, atcCategory: 'Antibiotics', masterLists: [], stats: DEMO_ITEM_STATS(22000, 3200) },
  { __typename: 'ItemNode', id: 'item-2', name: 'Paracetamol 500mg', code: 'PCM-500', unitName: 'Tablet', isVaccine: false, doses: 1, defaultPackSize: 200, customFields: null, availableStockOnHand: 76000, atcCategory: 'Analgesics', masterLists: [], stats: DEMO_ITEM_STATS(76000, 8500) },
  { __typename: 'ItemNode', id: 'item-3', name: 'Oral Rehydration Salts', code: 'ORS-001', unitName: 'Sachet', isVaccine: false, doses: 1, defaultPackSize: 50, customFields: null, availableStockOnHand: 6000, atcCategory: 'Electrolytes', masterLists: [], stats: DEMO_ITEM_STATS(6000, 900) },
  { __typename: 'ItemNode', id: 'item-4', name: 'Measles Vaccine', code: 'MMR-VAC', unitName: 'Dose', isVaccine: true, doses: 1, defaultPackSize: 10, customFields: null, availableStockOnHand: 750, atcCategory: 'Vaccines', masterLists: [], stats: DEMO_ITEM_STATS(750, 120) },
  { __typename: 'ItemNode', id: 'item-5', name: 'Surgical Gloves (Medium)', code: 'GLV-MED', unitName: 'Pair', isVaccine: false, doses: 1, defaultPackSize: 100, customFields: null, availableStockOnHand: 6000, atcCategory: 'Consumables', masterLists: [], stats: DEMO_ITEM_STATS(6000, 1200) },
  { __typename: 'ItemNode', id: 'item-6', name: 'Metronidazole 400mg', code: 'MTZ-400', unitName: 'Tablet', isVaccine: false, doses: 1, defaultPackSize: 100, customFields: null, availableStockOnHand: 16000, atcCategory: 'Antibiotics', masterLists: [], stats: DEMO_ITEM_STATS(16000, 2100) },
  { __typename: 'ItemNode', id: 'item-7', name: 'Ibuprofen 400mg', code: 'IBU-400', unitName: 'Tablet', isVaccine: false, doses: 1, defaultPackSize: 100, customFields: null, availableStockOnHand: 29000, atcCategory: 'Analgesics', masterLists: [], stats: DEMO_ITEM_STATS(29000, 4800) },
  { __typename: 'ItemNode', id: 'item-8', name: 'Chlorhexidine Solution 4%', code: 'CHX-4PCT', unitName: 'Litre', isVaccine: false, doses: 1, defaultPackSize: 1, customFields: null, availableStockOnHand: 48, atcCategory: 'Antiseptics', masterLists: [], stats: DEMO_ITEM_STATS(48, 8) },
];


// ---------------------------------------------------------------------------
// NAMES (customers / suppliers) demo rows
// ---------------------------------------------------------------------------
const DEMO_NAME_NODES = [
  { __typename: 'NameNode', id: 'p-1', name: 'City Health Centre', code: 'CHC', isCustomer: true, isSupplier: false, isOnHold: false, store: null },
  { __typename: 'NameNode', id: 'p-2', name: 'Riverside Clinic', code: 'RVC', isCustomer: true, isSupplier: false, isOnHold: false, store: null },
  { __typename: 'NameNode', id: 'p-3', name: 'Northern District Hospital', code: 'NDH', isCustomer: true, isSupplier: false, isOnHold: false, store: null },
  { __typename: 'NameNode', id: 'p-4', name: 'Westside Pharmacy', code: 'WSP', isCustomer: true, isSupplier: false, isOnHold: false, store: null },
  { __typename: 'NameNode', id: 'p-5', name: 'Eastside Medical Post', code: 'EMP', isCustomer: true, isSupplier: false, isOnHold: false, store: null },
  { __typename: 'NameNode', id: 's-1', name: 'National Medical Supplies', code: 'NMS', isCustomer: false, isSupplier: true, isOnHold: false, store: null },
  { __typename: 'NameNode', id: 's-2', name: 'Global Pharma Distributors', code: 'GPD', isCustomer: false, isSupplier: true, isOnHold: false, store: null },
  { __typename: 'NameNode', id: 's-3', name: 'MedEquip Solutions', code: 'MES', isCustomer: false, isSupplier: true, isOnHold: false, store: null },
];

// ---------------------------------------------------------------------------
// Helper for connector shape
// ---------------------------------------------------------------------------
const makeConnector = (nodes: object[], typename = 'Connector') => ({
  __typename: typename,
  nodes,
  totalCount: nodes.length,
});

// ---------------------------------------------------------------------------
// ALL DEMO RESPONSES map — keyed by GQL operation name
// ---------------------------------------------------------------------------
const ALL_DEMO_RESPONSES: Record<string, object> = {
  // --- Auth / Boot ---
  initialisationStatus: {
    initialisationStatus: { __typename: 'InitialisationStatusNode', status: 'INITIALISED', siteName: 'Demo Site' },
  },
  authToken: { authToken: { __typename: 'AuthToken', token: 'demo-token' } },
  me: {
    me: {
      __typename: 'UserNode', userId: 'demo-user-1', username: 'admin',
      firstName: 'Demo', lastName: 'User', email: 'demo@openmsupply.org',
      phoneNumber: null, jobTitle: 'Demo Administrator', language: 'ENGLISH',
      defaultStore: null,
      stores: makeConnector([], 'UserStoreConnector'),
    },
  },
  isCentralServer: { isCentralServer: false },
  isCentralStandalone: { isCentralStandalone: false },
  logout: { logout: { __typename: 'Logout', userId: 'demo-user-1' } },
  permissions: { me: { __typename: 'UserNode', username: 'admin', permissions: makeConnector([]) } },
  migrationStatus: { migrationStatus: { __typename: 'MigrationStatusNode', inProgress: false, version: null } },
  preferences: {
    preferences: {
      adjustForNumberOfDaysOutOfStock: false, allowTrackingOfStockByDonor: false,
      authorisePurchaseOrder: false, blindStocktake: false,
      canCreateInternalOrderFromARequisition: false, customTranslations: null,
      daysInMonth: 30, disableManualReturns: false, firstThresholdForExpiringItems: 30,
      genderOptions: null, manageVaccinesInDoses: false, manageVvmStatusForStock: false,
      numberOfMonthsThresholdToShowLowStockAlertsForProducts: 3,
      numberOfMonthsThresholdToShowOverStockAlertsForProducts: 6,
      numberOfMonthsToCheckForConsumptionWhenCalculatingOutOfStockProducts: 3,
      orderInPacks: false, preventTransfersMonthsBeforeInitialisation: 0,
      requisitionAutoFinalise: false, secondThresholdForExpiringItems: 7,
      selectDestinationStoreForAnInternalOrder: false, showContactTracing: false,
      sortByVvmStatusThenExpiry: false, storeCustomColour: null,
      syncRecordsDisplayThreshold: null, useProcurementFunctionality: false,
      useSimplifiedMobileUi: false, expiredStockPreventIssue: false,
      expiredStockIssueThreshold: 0, displayPopulationBasedForecasting: false,
      warnWhenMissingRecentStocktake: null, warningForExcessRequest: false,
      externalInboundShipmentLinesMustBeAuthorised: false, invoiceStatusOptions: null,
      itemMarginOverridesSupplierMargin: false, showIndicativePriceInRequisitions: false,
      isGaps: false, globalTableConfigs: null, backdating: null,
    },
  },
  programSettings: { programSettings: { __typename: 'ProgramSettingConnector', nodes: [], totalCount: 0 } },

  // --- Invoices (outbound + inbound lists share the same operation name "invoices") ---
  // We return all rows; the UI filters by type client-side via the query variables we ignore
  invoices: { invoices: makeConnector([...DEMO_OUTBOUND_NODES, ...DEMO_INBOUND_NODES], 'InvoiceConnector') },

  // --- Stock ---
  stockLines: { stockLines: makeConnector(DEMO_STOCK_NODES, 'StockLineConnector') },
  stockLine: { stockLine: DEMO_STOCK_NODES[0] },

  // --- Stocktakes ---
  stocktakes: { stocktakes: makeConnector(DEMO_STOCKTAKE_NODES, 'StocktakeConnector') },
  stocktake: { stocktake: DEMO_STOCKTAKE_NODES[0] },

  // --- Requisitions ---
  requisitions: { requisitions: makeConnector(DEMO_REQUISITION_NODES, 'RequisitionConnector') },
  requisition: { requisition: DEMO_REQUISITION_NODES[0] },

  // --- Reports ---
  reports: { reports: makeConnector(DEMO_REPORT_NODES, 'ReportConnector') },

  // --- Locations ---
  locations: { locations: makeConnector(DEMO_LOCATION_NODES, 'LocationConnector') },

  // --- Items / Catalogue ---
  items: { items: makeConnector(DEMO_ITEM_NODES, 'ItemConnector') },
  item: { item: DEMO_ITEM_NODES[0] },

  // --- Names (customers / suppliers) ---
  names: { names: makeConnector(DEMO_NAME_NODES, 'NameConnector') },
  name: { name: DEMO_NAME_NODES[0] },

  // --- Dashboard counts — operation names from dashboard/src/api/operations.graphql ---
  // itemCounts: nested shape { itemCounts: { itemCounts: { ... } } }
  itemCounts: {
    itemCounts: {
      itemCounts: {
        lowStock: 1,
        noStock: 0,
        highStock: 3,
        total: 8,
        outOfStockProducts: 0,
        productsAtRiskOfBeingOutOfStock: 1,
        productsOverstocked: 3,
      },
    },
  },
  // inboundInternalCounts → returns inboundShipmentCounts key
  inboundInternalCounts: {
    inboundShipmentCounts: { created: { today: 1, thisWeek: 4 }, notDelivered: 2 },
  },
  // inboundExternalCounts → returns inboundShipmentExternalCounts key
  inboundExternalCounts: {
    inboundShipmentExternalCounts: { created: { today: 0, thisWeek: 2 }, notDelivered: 1 },
  },
  // outboundCounts → returns outboundShipmentCounts key
  outboundCounts: {
    outboundShipmentCounts: { notShipped: 3 },
  },
  // internalOrderCounts → returns requisitionCounts key
  internalOrderCounts: {
    requisitionCounts: { request: { draft: 2 } },
  },
  // requisitionCounts → returns requisitionCounts key (response + emergency)
  requisitionCounts: {
    requisitionCounts: { response: { new: 1 }, emergency: { new: 0 } },
  },
  // stockCounts — all fields from schema
  stockCounts: {
    stockCounts: {
      expired: 2,
      expiringSoon: 5,
      expiringBetweenThresholds: 3,
      expiringInNextThreeMonths: 8,
    },
  },
  // Keep old names as aliases so other pages that use them still work
  outboundShipmentCounts: {
    outboundShipmentCounts: { created: { today: 2, thisWeek: 8 }, notShipped: 3 },
  },
  inboundShipmentCounts: {
    inboundShipmentCounts: { created: { today: 1, thisWeek: 4 }, notDelivered: 2 },
  },
  inboundShipmentExternalCounts: {
    inboundShipmentExternalCounts: { created: { today: 0, thisWeek: 2 }, notDelivered: 1 },
  },


  // --- Clinicians ---
  clinicians: { clinicians: makeConnector([], 'ClinicianConnector') },

  // --- Contacts ---
  contacts: { contacts: makeConnector([], 'ContactConnector') },

  // -----------------------------------------------------------------------
  // REQUISITIONS — The list pages use "requests" and "responses" as the GQL
  // operation name, both of which return { requisitions: { nodes, totalCount } }
  // -----------------------------------------------------------------------
  requests: { requisitions: makeConnector(DEMO_REQUISITION_NODES, 'RequisitionConnector') },
  responses: { requisitions: makeConnector([], 'RequisitionConnector') },
  requestByNumber: { requisition: DEMO_REQUISITION_NODES[0] },
  requestById: { requisition: DEMO_REQUISITION_NODES[0] },
  responseByNumber: { requisition: DEMO_REQUISITION_NODES[0] },
  responseById: { requisition: DEMO_REQUISITION_NODES[0] },
  supplierProgramSettings: { supplierProgramSettings: makeConnector([], 'ProgramSettingConnector') },
  programIndicators: { programIndicators: makeConnector([], 'ProgramIndicatorConnector') },
  hasCustomerProgramRequisitionSettings: { hasCustomerProgramRequisitionSettings: false },
  programRequisitionSettingsByCustomer: { programRequisitionSettingsByCustomer: makeConnector([], 'ProgramSettingConnector') },
  recentStocktakeItems: { stocktakeLines: makeConnector([], 'StocktakeLineConnector') },
  requisitionLineChart: { requisitionLineChart: { __typename: 'RequisitionLineChartNode', calculationDate: null, consumptionHistory: makeConnector([], 'ConsumptionHistoryConnector'), stockEvolution: makeConnector([], 'StockEvolutionConnector'), suggestedQuantityCalculation: null } },
  rnrForms: { rnrForms: makeConnector([], 'RnRFormConnector') },
  schedulesAndPeriods: { schedulesAndPeriods: { __typename: 'ScheduleNode', programs: [] } },
  rAndRFormDetail: { rnrForm: null },

  // -----------------------------------------------------------------------
  // ITEMS — multiple operations all query the items table
  // -----------------------------------------------------------------------
  itemStockOnHand: { items: makeConnector(DEMO_ITEM_NODES, 'ItemConnector') },
  itemsWithStats: { items: makeConnector(DEMO_ITEM_NODES, 'ItemConnector') },
  itemsByStockLineFilter: { items: makeConnector(DEMO_ITEM_NODES, 'ItemConnector') },
  item: { item: DEMO_ITEM_NODES[0] },

  // -----------------------------------------------------------------------
  // RETURNS — supplier returns and customer returns
  // -----------------------------------------------------------------------
  supplierReturns: { invoices: makeConnector([], 'InvoiceConnector') },
  customerReturns: { invoices: makeConnector([], 'InvoiceConnector') },
  generateSupplierReturnLines: { generateSupplierReturnLines: makeConnector([], 'GeneratedSupplierReturnLineConnector') },
  generateCustomerReturnLines: { generateCustomerReturnLines: makeConnector([], 'GeneratedCustomerReturnLineConnector') },
  supplierReturnByNumber: { invoice: null },
  supplierReturnById: { invoice: null },
  customerReturnByNumber: { invoice: null },
  customerReturnById: { invoice: null },

  // -----------------------------------------------------------------------
  // PRESCRIPTIONS / DISPENSARY
  // -----------------------------------------------------------------------
  prescriptions: { invoices: makeConnector([], 'InvoiceConnector') },
  prescriptionsWithLines: { invoices: makeConnector([], 'InvoiceConnector') },
  prescriptionByNumber: { invoice: null },
  prescriptionById: { invoice: null },
  diagnosesActive: { diagnosesActive: makeConnector([], 'DiagnosisConnector') },
  abbreviations: { abbreviations: makeConnector([], 'AbbreviationConnector') },
  labelPrinterSettings: { labelPrinterSettings: null },

  // -----------------------------------------------------------------------
  // STOCK / INVENTORY extras
  // -----------------------------------------------------------------------
  stocktakeCountAfterDate: { stocktakeCountAfterDate: 0 },
  outboundStocktakeCountAfterDate: { outboundStocktakeCountAfterDate: 0 },
  getOutboundEditLines: { invoice: null },
  invoiceCustomFields: { invoiceCustomFields: makeConnector([], 'CustomFieldConnector') },
  barcodeByGtin: { barcodeByGtin: null },
  purchaseOrders: { purchaseOrders: makeConnector([], 'PurchaseOrderConnector') },
  request: { requisition: DEMO_REQUISITION_NODES[0] },
  temperatureNotifications: { temperatureNotifications: makeConnector([], 'TemperatureNotificationConnector') },
};


/** Extract the operation name from a parsed GraphQL DocumentNode. */
const getOperationName = (document: DocumentNode): string | null => {
  const op = document.definitions.find(
    d => d.kind === 'OperationDefinition'
  ) as OperationDefinitionNode | undefined;
  return op?.name?.value ?? null;
};



// these queries are allowed to fail silently with permission denied errors
// as they are for background data fetches only; the user will be notified
// by other, page-level, queries instead. Allowing the exceptions here
// prevents the display of multiple permission denied errors for a single page
const permissionExceptions = [
  'reports',
  'stockCounts',
  'inboundShipmentCounts',
  'inboundShipmentExternalCounts',
  'outboundShipmentCounts',
  'itemCounts',
  'requisitionCounts',
  'temperatureNotifications',
];

interface ResponseError {
  message?: string;
  path?: string[];
  extensions?: { details?: string };
}

export class GraphqlStdError extends Error {
  public stdError?: string | undefined;
  constructor(message: string, stdError: string | undefined) {
    super(message);
    this.stdError = stdError;
  }
}

const hasError = (errors: ResponseError[], error: AuthError) =>
  errors.some(({ message }: { message?: string }) => message === error);

const hasPermissionException = (errors: ResponseError[]) =>
  errors.every(({ path }: { path?: string[] }) =>
    (path || []).every(p => permissionExceptions.includes(p))
  );

const handleResponseError = (errors: ResponseError[]) => {
  if (hasError(errors, AuthError.Unauthenticated)) {
    LocalStorage.setItem('/error/auth', AuthError.Unauthenticated);
    // Throw instead of resolving with emptyData (`{}`), so the query errors
    // cleanly rather than letting undefined cascade into components and crash.
    throw new Error(AuthError.Unauthenticated);
  }

  if (hasError(errors, AuthError.PermissionDenied)) {
    if (hasPermissionException(errors)) {
      throw errors[0];
    }
    LocalStorage.setItem('/error/auth', AuthError.PermissionDenied);
    return;
  }

  const error = errors[0];
  const { extensions } = error || {};
  const { details } = extensions || {};
  throw new GraphqlStdError(
    details || error?.message || 'Unknown error',
    error?.message
  );
};

class GQLClient extends GraphQLClient {
  private emptyData: object;
  private skipRequest: SkipRequest;
  private _url: string;

  constructor(
    url: string,
    options?: RequestConfig | undefined,
    skipRequest?: SkipRequest
  ) {
    super(url, options);
    this._url = url;
    this.emptyData = {};
    this.skipRequest = skipRequest || (() => false);
  }

  public request<T, V extends Variables | undefined>(
    documentOrOptions: RequestDocument | RequestOptions<Variables>,
    variables?: V,
    requestHeaders?: RequestInit['headers']
  ): Promise<T> {
    const options = documentOrOptions as RequestOptions<Variables>;
    const document = (
      typeof documentOrOptions !== 'string' && 'document' in documentOrOptions
        ? options.document
        : documentOrOptions
    ) as DocumentNode;

    // -----------------------------------------------------------------------
    // DEMO MODE: intercept every GQL request and return mock data locally.
    // Known operations get a realistic mock; unknown ones get a Proxy that
    // returns { nodes: [], totalCount: 0 } for any property access, preventing
    // "data is undefined" crashes in list views.
    // -----------------------------------------------------------------------
    if (isDemoMode) {
      const opName = getOperationName(document);
      const mockData = opName ? ALL_DEMO_RESPONSES[opName] : undefined;
      return Promise.resolve((mockData ?? makeDemoProxyResponse()) as T);
    }

    if (this.skipRequest(document)) {
      return new Promise(() => this.emptyData);
    }

    // No Authorization header — the HttpOnly `session_{port}` cookie is sent automatically by
    // the browser thanks to `credentials: 'include'` on the client.
    const response = options.document
      ? super.request(options)
      : super.request(
          documentOrOptions as RequestDocument,
          variables,
          requestHeaders
        );
    // returning an empty object in order to give the caller a stable reference
    // without it, the page will re-render continuously
    return response.then(
      data => (data ?? this.emptyData) as T,
      reason => {
        const { response } = reason;
        if (response && response.errors) {
          handleResponseError(response.errors);
          return this.emptyData as unknown as T;
        } else {
          throw new Error(`Error making API request: ${reason}`);
        }
      }
    );
  }

  public setSkipRequest = (skipRequest: SkipRequest) =>
    (this.skipRequest = skipRequest);
  public getUrl = () => this._url;
  public setUrl = (url: string) => {
    this._url = url;
    this.setEndpoint(url);
  };
}

interface GqlControl {
  client: GQLClient;
  setUrl: (url: string) => void;
  setSkipRequest: (skipRequest: SkipRequest) => void;
}

const GqlContext = createRegisteredContext<GqlControl>(
  'gql-context',
  {} as any
);

const { Provider } = GqlContext;

interface ApiProviderProps {
  url: string;
  skipRequest?: (documentNode: DocumentNode) => boolean;
}

export const GqlProvider: FC<PropsWithChildren<ApiProviderProps>> = ({
  url,
  skipRequest,
  children,
}) => {
  const clientRef = useRef(
    new GQLClient(url, { credentials: 'include' }, skipRequest)
  );

  const setSkipRequest = (
    skipRequest: (documentNode: DocumentNode) => boolean
  ) => {
    clientRef.current.setSkipRequest(skipRequest);
  };

  const setUrl = (url: string) => {
    clientRef.current.setUrl(url);
  };

  const val = {
    setSkipRequest,
    setUrl,
    client: clientRef.current,
  };

  return <Provider value={val}>{children}</Provider>;
};

export const useGql = (): GqlControl => {
  const graphQLClientControl = React.useContext(GqlContext);
  return graphQLClientControl;
};

