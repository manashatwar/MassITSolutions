import { setAuthState, LocalStorage, UserPermission } from '@openmsupply-client/common';

// ---------------------------------------------------------------------------
// Demo-mode bootstrap: pre-seeds localStorage so the app boots as if the
// user has already logged in. This runs BEFORE the React tree renders, so
// RequireAuthentication reads isAuthenticated: true and skips the /login
// redirect. None of this touches the real GraphQL server.
// ---------------------------------------------------------------------------

const DEMO_STORE = {
  __typename: 'UserStoreNode' as const,
  id: 'demo-store-1',
  code: 'DEMO',
  name: 'Demo Store',
  nameId: 'demo-name-1',
  storeMode: 'STORE' as any,
  isDisabled: false,
  createdDate: null,
  homeCurrencyCode: 'USD',
  preferences: {
    id: 'pref-1',
    responseRequisitionRequiresAuthorisation: false,
    requestRequisitionRequiresAuthorisation: false,
    packToOne: false,
    omProgramModule: false,
    vaccineModule: false,
    issueInForeignCurrency: false,
    monthlyConsumptionLookBackPeriod: 3,
    monthsLeadTime: 1,
    monthsOverstock: 2,
    monthsUnderstock: 1,
    monthsItemsExpire: 3,
    stocktakeFrequency: 1,
    extraFieldsInRequisition: false,
    keepRequisitionLinesWithZeroRequestedQuantityOnFinalised: false,
    manuallyLinkInternalOrderToInboundShipment: false,
    useConsumptionAndStockFromCustomersForInternalOrders: false,
    editPrescribedQuantityOnPrescription: false,
  },
};

// Grant all permissions so every nav item and feature is accessible.
const ALL_PERMISSIONS = Object.values(UserPermission);

export const seedDemoState = (): void => {
  // 1. Authenticated user + store — read by useAuthContext()
  setAuthState({
    isAuthenticated: true,
    store: DEMO_STORE,
    user: {
      id: 'demo-user-1',
      name: 'admin',
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@openmsupply.org',
      phoneNumber: null,
      jobTitle: 'Demo Administrator',
      permissions: ALL_PERMISSIONS,
    },
  });

  // 2. Most-recently-used credentials — pre-fills username on login page
  LocalStorage.setItem('/mru/credentials', [
    { username: 'admin', store: DEMO_STORE },
  ]);

  // 3. Clear any stale auth errors that might have been left from a previous run
  LocalStorage.removeItem('/error/auth');

  // 4. Open the app drawer by default for a better first impression
  LocalStorage.setItem('/appdrawer/open', true);

  console.info('[DEMO MODE] Auth state seeded — running without backend.');
};
