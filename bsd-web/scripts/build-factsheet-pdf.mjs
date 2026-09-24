// One-off generator for public/BSD-Regional-Coverage-Factsheet.pdf.
// Content is the client's "BSD - REGIONAL COVERAGE FACTSHEET" doc, reproduced verbatim.
// Run from bsd-web with: node scripts/build-factsheet-pdf.mjs
// The output PDF is committed, so this only needs re-running when the Factsheet changes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const logoPath = path.join(root, "public", "brand", "bsd-logo.png");
const outPath = path.join(root, "public", "BSD-Regional-Coverage-Factsheet.pdf");

const NAVY = "#0C2E42";
const BLUE = "#05669D";
const TEAL = "#167A69";
const GREY = "#475569";

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 48, bottom: 64, left: 54, right: 54 },
  bufferPages: true,
  info: {
    Title: "BSD Regional Coverage Factsheet",
    Author: "BSD (Bangladeshi Business & Service Directory)",
    Subject: "Swansea Bay & South West Wales Edition (SA1-SA34)",
  },
});
doc.pipe(fs.createWriteStream(outPath));

const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

// Start a new page first when the next block would run past the bottom margin. Without this, text drawn at a
// stale Y position after an automatic page break ends up on a different page from its bullet.
function ensure(height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function heading(text) {
  ensure(60);
  doc.moveDown(0.9).font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text(text, { width: W });
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + W, y).lineWidth(1.2).strokeColor(TEAL).stroke();
  doc.moveDown(0.5);
}

function para(text) {
  doc.font("Helvetica").fontSize(10).fillColor(GREY).text(text, { width: W, lineGap: 2 });
  doc.moveDown(0.4);
}

function bullet(label, text) {
  const x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(10);
  const needed = doc.heightOfString(`${label} ${text}`, { width: W - 14, lineGap: 2 }) + 8;
  ensure(needed);
  const startY = doc.y;
  doc.font("Helvetica").fontSize(10).fillColor(GREY).text("•", x, startY, { width: 10, lineBreak: false });
  doc.text("", x + 14, startY);
  if (label) {
    doc.font("Helvetica-Bold").fillColor(NAVY).text(`${label} `, x + 14, startY, { width: W - 14, continued: true, lineGap: 2 });
  }
  doc.font("Helvetica").fillColor(GREY).text(text, { width: W - 14, lineGap: 2 });
  doc.x = x;
  doc.moveDown(0.25);
}

function zoneTitle(text) {
  ensure(70);
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(10.5).fillColor(BLUE).text(text, { width: W });
  doc.moveDown(0.2);
}

// ---- Header: logo left, "Powered by BayConnect" right (no BayConnect logo was supplied)
doc.image(logoPath, doc.page.margins.left, doc.page.margins.top, { width: 200 });
doc.font("Helvetica-Bold").fontSize(9).fillColor(GREY).text("Powered by BayConnect", doc.page.margins.left, doc.page.margins.top + 18, {
  width: W,
  align: "right",
});
doc.y = doc.page.margins.top + 74;

doc.font("Helvetica-Bold").fontSize(15).fillColor(NAVY).text("BANGLADESHI BUSINESS & SERVICE DIRECTORY (BSD)", { width: W, align: "center" });
doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE).text("SWANSEA BAY & SOUTH WEST WALES EDITION (SA1–SA34)", { width: W, align: "center" });
doc.moveDown(0.3).font("Helvetica-Bold").fontSize(13).fillColor(TEAL).text("REGIONAL COVERAGE FACTSHEET", { width: W, align: "center" });

// ---- 1
heading("1. OVERVIEW & COMMUNITY PURPOSE");
para(
  "The Bangladeshi Business & Service Directory (BSD) is an open-access community initiative operating under the umbrella of BayConnect. BSD connects residents, visitors, and regional enterprises with verified Bangladeshi-owned businesses, self-employed professionals, skilled trades, and essential community services across South West Wales."
);
bullet("Digital Portal:", "https://bsd.wales");
bullet("Operational Model:", "100% Free Public Access & Free Standard Listings");
bullet("Governance & GDPR:", "Managed in accordance with UK Data Protection Standards under BayConnect");

// ---- 2
heading("2. REGIONAL COVERAGE ZONES & POSTCODE MAPPING");
para("BSD strategically covers the complete SA Postcode Region (SA1 through SA34), structured into three operational zones:");
zoneTitle("ZONE 1: GREATER SWANSEA & GOWER (POSTCODES: SA1, SA2, SA3, SA4, SA5, SA6, SA7)");
bullet(
  "Key Coverage Areas:",
  "Swansea City Centre, Uplands, Sketty, Brynmill, Saint Thomas, Maritime Quarter, Morriston, Manselton, Hafod, Plasmarl, Winch Wen, Enterprise Park, Mumbles, Gower, Killay, Dunvant, Gorseinon, Pontarddulais, and Loughor."
);
zoneTitle("ZONE 2: NEATH PORT TALBOT & SWANSEA VALLEY (POSTCODES: SA8, SA9, SA10, SA11, SA12, SA13)");
bullet(
  "Key Coverage Areas:",
  "Neath Town Centre, Briton Ferry, Skewen, Port Talbot, Aberavon, Margam, Pontardawe, Alltwen, Rhos, Trebanos, Ystalyfera, Ystradgynlais, Crynant, and Seven Sisters."
);
zoneTitle("ZONE 3: CARMARTHENSHIRE & WEST WALES (POSTCODES: SA14, SA15, SA16, SA17, SA18, SA19, SA20, SA31–SA34)");
bullet(
  "Key Coverage Areas:",
  "Llanelli, Burry Port, Pembrey, Kidwelly, Ferryside, Ammanford, Cross Hands, Tycroes, Llandeilo, Llandovery, Carmarthen Town, Saint Clears, Laugharne, and Whitland."
);

// ---- 3
heading("3. THE 3-TIER COMMUNITY VERIFICATION SYSTEM");
para("To maintain public trust and prevent outdated information, all directory entries undergo a structured 3-tier verification check:");

const tiers = [
  ["Tier 1: Public Submission", "Business details submitted online or via field capture."],
  ["Tier 2: Field Volunteer Audit", "Field representative cross-checks address, phone, & active status."],
  ["Tier 3: Verified Status", "Entry awarded green “Community Verified” badge."],
];
{
  const gap = 22;
  const boxW = (W - gap * 2) / 3;
  const boxH = 72;
  ensure(boxH + 12);
  const top = doc.y + 4;
  tiers.forEach(([title, text], i) => {
    const x = doc.page.margins.left + i * (boxW + gap);
    doc.roundedRect(x, top, boxW, boxH, 6).lineWidth(1).strokeColor("#CBD5E1").stroke();
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(i === 2 ? TEAL : NAVY).text(title, x + 8, top + 8, { width: boxW - 16 });
    doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(text, x + 8, top + 26, { width: boxW - 16, lineGap: 1 });
    if (i < 2) {
      // arrow between boxes
      const ax = x + boxW + 3;
      const ay = top + boxH / 2;
      doc.moveTo(ax, ay).lineTo(ax + gap - 10, ay).lineWidth(1.4).strokeColor(TEAL).stroke();
      doc.polygon([ax + gap - 10, ay - 4], [ax + gap - 10, ay + 4], [ax + gap - 3, ay]).fillColor(TEAL).fill();
    }
  });
  doc.x = doc.page.margins.left;
  doc.y = top + boxH + 6;
}

// ---- 4 (starts a fresh page so the heading, intro and bullets stay together)
doc.addPage();
heading("4. UPCOMING PRINT DIRECTORY & SPONSORSHIP OPPORTUNITIES");
para(
  "In addition to our live portal (bsd.wales), BSD is preparing an annual Print Edition for physical distribution across community centers, business venues, and civic hubs."
);
bullet("Standard Business Listings:", "100% Free (Digital & Print inclusion)");
bullet("Premium Sponsorships & Quarter/Half/Full Page Placements:", "Available for local enterprises");
bullet("Enquiries for Print Sponsorship:", "Email support@bsd.wales for details and rate cards");

// ---- 5
heading("5. DIRECTORY CONTACT & SUPPORT");
bullet("Web Portal:", "https://bsd.wales");
bullet("General Enquiries:", "support@bsd.wales");
bullet("Data Privacy / GDPR:", "compliance@bsd.wales");
bullet("Community Outreach:", "community@bsd.wales");
bullet("Parent Platform:", "BayConnect Operations Team, Swansea Bay Area, United Kingdom");

// ---- Footer on every page
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  const y = doc.page.height - 46;
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0; // stops the footer text from triggering a new page
  doc.moveTo(doc.page.margins.left, y - 6).lineTo(doc.page.margins.left + W, y - 6).lineWidth(0.6).strokeColor("#CBD5E1").stroke();
  doc.font("Helvetica").fontSize(8).fillColor(GREY).text(
    "© 2026 BSD (Bangladeshi Business & Service Directory).",
    doc.page.margins.left,
    y,
    { width: W, align: "center", lineBreak: false }
  );
  doc.text("Powered by BayConnect | Creative Partner: Kanta Bhattacharjee", doc.page.margins.left, y + 11, {
    width: W,
    align: "center",
    lineBreak: false,
  });
  doc.page.margins.bottom = savedBottom;
}

doc.end();
console.log("wrote", path.relative(root, outPath));
