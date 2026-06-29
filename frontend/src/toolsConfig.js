// Central registry of every tool. Drives routing, the Home catalog, and nav.
//
// `kind: 'conversion'` tools render via the shared ConversionTool component and
// only need an endpoint + file settings. `kind: 'custom'` tools have their own
// page component (more inputs) and are wired up explicitly in App.jsx.

const PDF = "application/pdf";
const IMG = "image/*";
const WORD =
  ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPT =
  ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const EXCEL =
  ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const CATEGORIES = [
  "Organize & Edit",
  "Convert from PDF",
  "Convert to PDF",
  "Optimize & Secure",
];

export const tools = [
  // ---- Organize & Edit ----
  {
    kind: "custom",
    path: "/merge",
    icon: "🔗",
    title: "Merge PDFs",
    description: "Combine several PDFs into one document.",
    category: "Organize & Edit",
  },
  {
    kind: "custom",
    path: "/split",
    icon: "✂️",
    title: "Split PDF",
    description: "Extract page ranges into separate files.",
    category: "Organize & Edit",
  },
  {
    kind: "custom",
    path: "/edit",
    icon: "🧩",
    title: "Edit PDF",
    description: "Rotate, delete, reorder, extract pages or add a watermark.",
    category: "Organize & Edit",
  },
  {
    kind: "custom",
    path: "/annotate",
    icon: "✍️",
    title: "Annotate PDF",
    description: "Add text, highlights and boxes directly on the page.",
    category: "Organize & Edit",
  },

  // ---- Convert from PDF ----
  {
    kind: "conversion",
    path: "/pdf-to-word",
    endpoint: "/convert", // existing endpoint defaults target=docx
    icon: "📝",
    title: "PDF → Word",
    description: "Turn a PDF into an editable Word (.docx) document.",
    accept: PDF,
    outName: "converted.docx",
    category: "Convert from PDF",
  },
  {
    kind: "conversion",
    path: "/pdf-to-powerpoint",
    endpoint: "/pdf-to-pptx",
    icon: "📊",
    title: "PDF → PowerPoint",
    description:
      "Place each PDF page as a full-page image on its own slide. Layout is preserved exactly; text is not editable.",
    accept: PDF,
    outName: "converted.pptx",
    category: "Convert from PDF",
  },
  {
    kind: "conversion",
    path: "/pdf-to-excel",
    endpoint: "/pdf-to-excel",
    icon: "📗",
    title: "PDF → Excel",
    description:
      "Extract tables into an Excel workbook. Works best on PDFs with clearly bordered tables; scanned files are read with OCR.",
    accept: PDF,
    outName: "converted.xlsx",
    category: "Convert from PDF",
  },
  {
    kind: "conversion",
    path: "/pdf-to-jpg",
    endpoint: "/pdf-to-jpg",
    icon: "🖼️",
    title: "PDF → JPG",
    description: "Render every page to a JPG image (downloaded as a ZIP).",
    accept: PDF,
    outName: "images.zip",
    category: "Convert from PDF",
    options: [
      {
        name: "dpi",
        label: "Image quality",
        default: "150",
        choices: [
          { value: "150", label: "Screen — 150 DPI (smallest file)" },
          { value: "300", label: "Print — 300 DPI" },
          { value: "600", label: "High detail — 600 DPI (largest file)" },
        ],
      },
    ],
  },

  // ---- Convert to PDF ----
  {
    kind: "conversion",
    path: "/word-to-pdf",
    endpoint: "/office-to-pdf",
    icon: "📄",
    title: "Word → PDF",
    description: "Convert a Word document to PDF.",
    accept: WORD,
    outName: "converted.pdf",
    category: "Convert to PDF",
  },
  {
    kind: "conversion",
    path: "/powerpoint-to-pdf",
    endpoint: "/office-to-pdf",
    icon: "📑",
    title: "PowerPoint → PDF",
    description: "Convert a PowerPoint presentation to PDF.",
    accept: PPT,
    outName: "converted.pdf",
    category: "Convert to PDF",
  },
  {
    kind: "conversion",
    path: "/excel-to-pdf",
    endpoint: "/office-to-pdf",
    icon: "📘",
    title: "Excel → PDF",
    description: "Convert an Excel spreadsheet to PDF.",
    accept: EXCEL,
    outName: "converted.pdf",
    category: "Convert to PDF",
  },
  {
    kind: "conversion",
    path: "/jpg-to-pdf",
    endpoint: "/jpg-to-pdf",
    icon: "🏞️",
    title: "JPG → PDF",
    description: "Combine one or more images into a single PDF.",
    accept: IMG,
    multiple: true,
    outName: "images.pdf",
    category: "Convert to PDF",
  },
  {
    kind: "custom",
    path: "/excalidraw-to-pdf",
    icon: "🎨",
    title: "Excalidraw → PDF",
    description: "Convert an Excalidraw drawing (.excalidraw) into a PDF.",
    category: "Convert to PDF",
  },

  // ---- Optimize & Secure ----
  {
    kind: "custom",
    path: "/compress",
    icon: "🗜️",
    title: "Compress PDF",
    description: "Reduce file size by optimizing the document.",
    category: "Optimize & Secure",
  },
  {
    kind: "custom",
    path: "/protect",
    icon: "🔒",
    title: "Protect / Unlock",
    description: "Add or remove a password with AES-256 encryption.",
    category: "Optimize & Secure",
  },
  {
    kind: "custom",
    path: "/sign",
    icon: "🖊️",
    title: "Sign PDF",
    description: "Apply a digital (certificate-based) signature.",
    category: "Optimize & Secure",
  },
];

export const conversionTools = tools.filter((t) => t.kind === "conversion");
