import PDFDocument from "pdfkit";

export function calculateTotal(items) {
    return items.reduce((sum, item) => {
        return sum + Number(item.quantity) * Number(item.price);
    }, 0);
}

export function generateInvoicePdfBuffer(items) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(22).text("Invoice", { align: "center" });
        doc.moveDown();

        doc.fontSize(11).text(`Date: ${new Date().toISOString().slice(0, 10)}`);
        doc.moveDown();

        let y = doc.y + 10;

        doc.fontSize(12);
        doc.text("Item", 50, y);
        doc.text("Qty", 280, y);
        doc.text("Price", 360, y);
        doc.text("Total", 440, y);

        y += 20;
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 10;

        for (const item of items) {
            const lineTotal = Number(item.quantity) * Number(item.price);

            doc.text(item.item, 50, y, { width: 230 });
            doc.text(String(item.quantity), 280, y);
            doc.text(Number(item.price).toFixed(2), 360, y);
            doc.text(lineTotal.toFixed(2), 440, y);

            y += 25;
        }

        y += 10;
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 15;

        doc.fontSize(14).text(
            `Total: ${calculateTotal(items).toFixed(2)} KM`,
            50,
            y,
            {
                width: 450,
                align: "right"
            }
        );

        doc.end();
    });
}