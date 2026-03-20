import { Hono } from "hono";
import { z } from "zod";

const labelKindSchema = z.enum(["r", "b"]);

const LABELS_PER_PAGE = 96;
const GRID_COLUMNS = 8;
const GRID_ROWS = 12;
const PAGE_MARGIN = 18;
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const BASE62_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateBase62Id(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => BASE62_ALPHABET[byte % BASE62_ALPHABET.length]).join("");
}

function createLabelValues(kind: "r" | "b") {
  return Array.from({ length: LABELS_PER_PAGE }, () => `${kind}:${generateBase62Id(6)}`);
}

async function createPdfBuffer(values: string[]) {
  const pdfkitModule = await import("pdfkit");
  const bwipModule = await import("bwip-js");

  const PDFDocument = ((pdfkitModule as any).default ?? pdfkitModule) as any;
  const bwipjs = ((bwipModule as any).default ?? bwipModule) as any;

  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, autoFirstPage: false });
  const chunks: Buffer[] = [];

  const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.addPage({ size: "A4", margin: PAGE_MARGIN });

  const pageWidth = A4_WIDTH;
  const pageHeight = A4_HEIGHT;
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const contentHeight = pageHeight - PAGE_MARGIN * 2;
  const cellWidth = contentWidth / GRID_COLUMNS;
  const cellHeight = contentHeight / GRID_ROWS;
  const codeSize = Math.min(cellWidth * 0.78, cellHeight * 0.52);
  const titleHeight = 7;
  const textYGap = 2;
  const textHeight = 8;

  for (let index = 0; index < values.length; index += 1) {
    const row = Math.floor(index / GRID_COLUMNS);
    const column = index % GRID_COLUMNS;
    const code = values[index];
    const codeBuffer = await bwipjs.toBuffer({
      bcid: "datamatrix",
      text: code,
      scale: 2,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
      includetext: false,
    });

    const cellX = PAGE_MARGIN + column * cellWidth;
    const cellY = PAGE_MARGIN + row * cellHeight;
    const codeX = cellX + (cellWidth - codeSize) / 2;
    const titleY = cellY + 1;
    const codeY = cellY + (cellHeight - codeSize - titleHeight - textHeight - textYGap) / 2 + titleHeight;

    doc
      .fontSize(7)
      .fillColor("black")
      .text("Nidhanam", cellX, titleY, {
        width: cellWidth,
        align: "center",
      });

    doc.image(codeBuffer, codeX, codeY, { width: codeSize, height: codeSize });
    doc
      .fontSize(6)
      .fillColor("black")
      .text(code, cellX, codeY + codeSize + textYGap, {
        width: cellWidth,
        align: "center",
      });
  }

  doc.end();
  return pdfBufferPromise;
}

const labelsRoutes = new Hono();

labelsRoutes.get("/:type", async (c) => {
  const parsed = labelKindSchema.safeParse(c.req.param("type"));

  if (!parsed.success) {
    return c.json({ message: "Invalid label type. Use `r` for rack or `b` for book." }, 400);
  }

  const values = createLabelValues(parsed.data);
  const pdfBuffer = await createPdfBuffer(values);
  const fileName = `labels-${parsed.data}.pdf`;
  const pdfBytes = new Uint8Array(pdfBuffer);

  return c.body(pdfBytes, 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${fileName}"`,
  });
});

export default labelsRoutes;