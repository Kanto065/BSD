// Wording on the Pass pages. CLIENT strings come from the client documents or the PM tracker spec (M11-C) and are
// locked by card-labels.test.ts. NEW strings were written by the developer and wait for PM sign-off.

// Client or spec wording.
export const CONSENT = "I agree that shops I show my pass to can see my name, member ID and postcode area.";
export const MOVE_PASS = "Move my pass to this phone";
export const OFFLINE = "You are offline. Go online to show your pass.";
export const CLOCK_DRIFT = "Check your phone clock.";
export const REVEAL = "Reveal Instant Discount Code";
export const COPIED = "Copied to Clipboard!";
export const CONFLICT = "Your pass is open on another device.";
export const RESET_ASK = "Ask the BSD team to reset your pass.";
export const SUSPENDED = "This pass is suspended. Please contact the BSD team.";

// NEW, needs PM sign-off.
export const NEW_LABELS = {
  claimTitle: "Get your Privilege Pass",
  claimBody: "Your pass is free. Show it at partner shops to get their offers.",
  claimButton: "Claim my pass",
  claiming: "Creating your pass...",
  consentError: "Please agree to show your name and member number to shops.",
  signInTitle: "Sign in to see your pass",
  signIn: "Sign in",
  joinTitle: "Join the Privilege Pass",
  joinButton: "Join Pass",
  joining: "Joining...",
  joinFailed: "Could not join. Please try again.",
  memberId: "Member ID",
  postcodeArea: "Postcode area",
  clockLabel: "UK time",
  refreshesIn: "Refreshes in",
  refreshing: "Refreshing your pass...",
  moving: "Moving...",
  conflictBody: "Only one phone can show your pass at a time.",
  retry: "Try again",
  loading: "Loading your pass...",
  loadFailed: "Could not load your pass. Please try again.",
  offersTitle: "Offers from partner shops",
  offersEmpty: "No offers yet. Check back soon.",
  moreOffers: "Show more offers",
  codeValidFor: "Valid for",
  copyCode: "Copy code",
  codeFailed: "Could not make a code. Please try again.",
  savingsLink: "My savings",
  savingsTitle: "Your savings",
  savingsTotal: "Total saved",
  savingsThisYear: "Saved this year",
  savingsCount: "Discounts used",
  savingsShops: "Shops",
  savingsEmpty: "Your savings will show here after a shop confirms a discount.",
  backToPass: "Back to my pass",
} as const;

// M11-D merchant side. CLIENT strings are from layout 2.3 and the tracker spec and are locked by card-labels.test.ts.
export const LIVE_CAMERA = "Live Camera";
export const MANUAL_CODE = "Manual Code";
export const CONFIRM_DISCOUNT = "Confirm discount and complete";
export const SCAN_NEXT = "Scan next customer";
export const ALREADY_SCANNED = "Already scanned recently";
export const OFFER_CHIPS = { PENDING: "Waiting for approval", ACTIVE: "Live", PAUSED: "Paused", REJECTED: "Not approved" } as const;

// NEW, needs PM sign-off.
export const MERCHANT_LABELS = {
  offerTitle: "Privilege Pass offer",
  offerIntro: "Pass holders see this offer on your listing. The BSD team checks every change before it goes live.",
  fieldTitle: "Offer title",
  fieldPercent: "Percent off (optional)",
  fieldTerms: "Terms",
  save: "Save offer",
  saving: "Saving...",
  saved: "Saved. It is waiting for approval.",
  pause: "Pause offer",
  resume: "Resume offer",
  reasonPrefix: "Reason",
  saveFailed: "Could not save the offer. Please try again.",
  openScanner: "Open the scanner",
  scanSignIn: "Sign in to scan passes",
  noListing: "You have no approved listing yet.",
  noLiveOffer: "Your offer must be live before you can scan passes.",
  listing: "Listing",
  cameraDenied: "Camera access is blocked. Allow the camera in your browser settings, or use Manual Code.",
  cameraMissing: "This phone has no camera we can use. Use Manual Code.",
  startCamera: "Start camera",
  torch: "Torch",
  codeLabel: "Customer code",
  checkCode: "Check code",
  backspace: "Delete",
  checking: "Checking...",
  memberId: "Member ID",
  billLabel: "Bill amount in pounds",
  billInvalid: "Enter the bill as pounds, for example 12.50.",
  offerPercentInvalid: "Enter 0.01 to 100.",
  discount: "Discount",
  discountToGive: "Discount to give",
  moreDistricts: "More",
  fewerDistricts: "Fewer",
  validTitle: "Pass valid",
  expiredTitle: "Pass expired",
  expiredHint: "Ask the customer to refresh it.",
  confirmed: "Discount confirmed",
  confirmFailed: "Could not confirm. Please try again.",
  expired: "Pass expired. Ask the customer to refresh it.",
  invalid: "Pass not valid",
  duplicateAgo: "Scanned a moment ago",
  networkError: "No connection. Please try again.",
  todayTitle: "Today",
  todayScans: "Scans",
  todayConfirmed: "Confirmed",
  todaySaved: "Saved by customers",
  soundOn: "Sound on",
  soundOff: "Sound off",
} as const;
