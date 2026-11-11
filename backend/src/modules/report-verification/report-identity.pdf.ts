import qrcode from 'qrcode-generator';

type PdfDocument = PDFKit.PDFDocument;

const CODE39: Record<string, string> = {
  '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw',
  '5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
  A:'wnnnnwnnw',B:'nnwnnwnnw',C:'wnwnnwnnn',D:'nnnnwwnnw',E:'wnnnwwnnn',
  F:'nnwnwwnnn',G:'nnnnnwwnw',H:'wnnnnwwnn',I:'nnwnnwwnn',J:'nnnnwwwnn',
  K:'wnnnnnnww',L:'nnwnnnnww',M:'wnwnnnnwn',N:'nnnnwnnww',O:'wnnnwnnwn',
  P:'nnwnwnnwn',Q:'nnnnnnnww',R:'wnnnnnnwn',S:'nnwnnnnwn',T:'nnnnwnnwn',
  U:'wwnnnnnnw',V:'nwwnnnnnw',W:'www nnnnnn'.replace(/ /g,''),X:'nwnnwnnnw',
  Y:'wwnnwnnnn',Z:'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnwnnn',' ':'nwwnnnwnn',
  '$':'nwnwnwnnn','/':'nwnwnnnwn','+':'nwnnnwnwn','%':'nnnwnwnwn','*':'nwnnwnwnn',
};

export function drawReportQr(doc: PdfDocument, value: string, x: number, y: number, size: number): void {
  const code = qrcode(0, 'M');
  code.addData(value, 'Byte');
  code.make();
  const count = code.getModuleCount();
  const quiet = 4;
  const cell = size / (count + quiet * 2);
  doc.save().fillColor('#FFFFFF').rect(x, y, size, size).fill();
  doc.fillColor('#0B1727');
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (code.isDark(row, col)) {
        doc.rect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell + 0.08, cell + 0.08).fill();
      }
    }
  }
  doc.restore();
}

export function drawReportBarcode(doc: PdfDocument, value: string, x: number, y: number, maxWidth: number, barHeight: number): void {
  const normalized = value.toUpperCase().replace(/[^0-9A-Z .\-$/+%]/g, '');
  const encoded = `*${normalized}*`;
  const patterns = [...encoded].map((character) => CODE39[character]).filter(Boolean);
  if (!patterns.length) return;
  const units = patterns.reduce((sum, pattern) => sum + [...pattern].reduce((total, width) => total + (width === 'w' ? 3 : 1), 0), 0) + patterns.length - 1;
  const scale = Math.min(0.9, maxWidth / units);
  let cursor = x;
  patterns.forEach((pattern, index) => {
    [...pattern].forEach((width, elementIndex) => {
      const elementWidth = (width === 'w' ? 3 : 1) * scale;
      if (elementIndex % 2 === 0) doc.rect(cursor, y, elementWidth, barHeight).fill('#111827');
      cursor += elementWidth;
    });
    if (index < patterns.length - 1) cursor += scale;
  });
}
