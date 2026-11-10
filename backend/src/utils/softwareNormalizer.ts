export interface RawSoftwareItem {
  name?: string;
  Name?: string;
  version?: string | null;
  Version?: string | null;
  publisher?: string | null;
  Publisher?: string | null;
}

export interface NormalizedSoftwareItem {
  key: string;
  name: string;
  version: string;
  publisher: string;
}

const EXCLUDE_PATTERNS: RegExp[] = [
  /Click-to-Run/i,
  /\bMUI\b/i,
  /\bProofing\b/i,
  /\bLocalization\b/i,
  /\bExtensibility\b/i,
  /Licensing Component/i,
  /Setup Metadata/i,
  /Tools for Office/i,
  /Primary Interop/i,
  /Database Engine/i,
  /Shared (64|32)-bit/i,
  /\bOSM\b/i,
  /^Office 1[56]\b/i,
  /Redistributable/i,
  /Minimum Runtime/i,
  /Additional Runtime/i,
  /Visual C\+\+/i,
  /Edge Update/i,
  /WebView2/i,
  /Google Update/i,
  /Auto Updater/i,
  /Update Helper/i,
  /Language Pack/i,
  /Material Library/i,
  /Content Pack/i,
  /\bDocumentation\b/i,
  /Core Interpreter/i,
  /Development Libraries/i,
  /\bExecutables\b/i,
  /pip Bootstrap/i,
  /Standard Library/i,
  /Tcl\/Tk/i,
  /Test Suite/i,
  /Utility Scripts/i,
  /Python Launcher/i,
  /Software Development Kit/i,
  /\bSDK\b/i,
  /CefSharp/i,
  /Genuine Service/i,
  /\bBonjour\b/i,
  /\bHotfix\b/i,
  /Security Update/i,
  /Service Pack/i,
  /Add-in/i,
  /Meeting Add-in/i,
  /Teams Meeting/i,
  /Add-in for Microsoft/i,
  /Connector/i,
  /Helper/i,
  /Telemetry/i,
  /Diagnostic/i,
];

const inferOfficeTitleFromVersion = (version: string): string => {
  const v = (version || "").trim();
  if (v.startsWith("16.")) return "Microsoft Office 2016/2019/2021";
  if (v.startsWith("15.")) return "Microsoft Office 2013";
  if (v.startsWith("14.")) return "Microsoft Office 2010";
  if (v.startsWith("12.")) return "Microsoft Office 2007";
  return "Microsoft Office";
};

export const normalizeSingleSoftware = (
  rawName: string,
  rawVersion?: string | null,
  rawPublisher?: string | null
): NormalizedSoftwareItem | null => {
  const name = (rawName || "").trim();
  if (!name) return null;

  const version = (rawVersion || "").trim();
  const publisher = (rawPublisher || "").trim();

  // Check if this is an Office sub-component before discarding, in case we need fallback
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(name)) {
      return null;
    }
  }

  // 1. Microsoft Office / Microsoft 365
  if (/^(Microsoft Office|Microsoft 365|Office 365)/i.test(name)) {
    if (/(Project|Visio)/i.test(name)) {
      const cleanPV = name
        .replace(/\s*-\s*[a-z]{2}-[a-z]{2}.*$/i, "")
        .replace(/\s*\(\d+-bit\)/i, "")
        .trim();
      return {
        key: cleanPV.toUpperCase(),
        name: cleanPV,
        version,
        publisher: "Microsoft Corporation",
      };
    }

    if (
      !/(Professional|Standard|Home|Business|Enterprise|Personal|LTSC|365|Apps|2007|2010|2013|2016|2019|2021|2024)/i.test(
        name
      )
    ) {
      return null;
    }

    let cleanOffice = name
      .replace(/\s*-\s*[a-z]{2}-[a-z]{2}.*$/i, "")
      .replace(/\s*\([a-z]+\)\s*/i, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/Microsoft 365|Office 365/i.test(cleanOffice)) {
      cleanOffice = "Microsoft 365 (Office)";
    }

    return {
      key: "MS_OFFICE_SUITE",
      name: cleanOffice,
      version,
      publisher: "Microsoft Corporation",
    };
  }

  // Standalone Word / Excel / Outlook MSI entries -> fold into MS_OFFICE_SUITE fallback
  if (/^Microsoft (Word|Excel|Outlook|PowerPoint|Access)\b/i.test(name)) {
    const yearMatch = name.match(/\b(2007|2010|2013|2016|2019|2021|2024|365)\b/);
    const suiteName = yearMatch
      ? `Microsoft Office ${yearMatch[1]}`
      : inferOfficeTitleFromVersion(version);
    return {
      key: "MS_OFFICE_SUITE_FALLBACK",
      name: suiteName,
      version,
      publisher: "Microsoft Corporation",
    };
  }

  // 2. Visual Studio Code vs Visual Studio
  if (/Visual Studio Code/i.test(name)) {
    return {
      key: "VSCODE",
      name: "Visual Studio Code",
      version,
      publisher: "Microsoft Corporation",
    };
  }
  if (/^(Microsoft\s+)?Visual Studio (Community|Professional|Enterprise|20\d{2})/i.test(name)) {
    const cleanVS = name.replace(/^Microsoft\s+/i, "").trim();
    return {
      key: cleanVS.toUpperCase(),
      name: cleanVS,
      version,
      publisher: "Microsoft Corporation",
    };
  }

  // 3. Python
  const pyMatch = name.match(/^Python (\d+\.\d+)(\.\d+)?(\s*\(\d+-bit\))?$/i);
  if (pyMatch) {
    const majorMinor = pyMatch[1];
    return {
      key: `PYTHON_${majorMinor}`,
      name: `Python ${majorMinor}`,
      version,
      publisher: "Python Software Foundation",
    };
  }

  // 4. CAD / Engineering / Design
  const cadMatch = name.match(/^(Autodesk\s+)?AutoCAD(\s+LT)?\s+\d{4}/i);
  if (cadMatch) {
    const cleanCad = cadMatch[0].replace(/\s+/g, " ").trim();
    return { key: cleanCad.toUpperCase(), name: cleanCad, version, publisher: "Autodesk" };
  }
  const revitMatch = name.match(/^(Autodesk\s+)?Revit\s+\d{4}/i);
  if (revitMatch) {
    const cleanRevit = revitMatch[0].replace(/\s+/g, " ").trim();
    return { key: cleanRevit.toUpperCase(), name: cleanRevit, version, publisher: "Autodesk" };
  }
  const swMatch = name.match(/^SOLIDWORKS\s+\d{4}/i);
  if (swMatch) {
    const cleanSw = swMatch[0].toUpperCase().replace(/\s+/g, " ").trim();
    return { key: cleanSw, name: cleanSw, version, publisher: "Dassault Systemes" };
  }
  const skpMatch = name.match(/^SketchUp(\s+Pro)?\s+\d{4}/i);
  if (skpMatch) {
    const cleanSkp = skpMatch[0].replace(/\s+/g, " ").trim();
    return { key: cleanSkp.toUpperCase(), name: cleanSkp, version, publisher: publisher || "Trimble" };
  }
  const corelMatch = name.match(/^CorelDRAW(\s+Graphics Suite)?(\s+\d{4}|\s+X\d+)?/i);
  if (corelMatch) {
    const cleanCorel = corelMatch[0].replace(/\s+/g, " ").trim();
    return { key: "CORELDRAW", name: cleanCorel, version, publisher: "Corel Corporation" };
  }
  if (/^Adobe Photoshop/i.test(name)) {
    const cleanPs = name.replace(/\s*\(.*\)$/, "").trim();
    return { key: "PHOTOSHOP", name: cleanPs, version, publisher: "Adobe Inc." };
  }
  if (/^Adobe Illustrator/i.test(name)) {
    const cleanAi = name.replace(/\s*\(.*\)$/, "").trim();
    return { key: "ILLUSTRATOR", name: cleanAi, version, publisher: "Adobe Inc." };
  }

  // 5. Browsers & Common Office Tools
  if (/^Google Chrome/i.test(name)) {
    return { key: "CHROME", name: "Google Chrome", version, publisher: "Google LLC" };
  }
  if (/^Mozilla Firefox/i.test(name)) {
    return { key: "FIREFOX", name: "Mozilla Firefox", version, publisher: "Mozilla" };
  }
  if (/^Microsoft Edge$/i.test(name)) {
    return { key: "EDGE", name: "Microsoft Edge", version, publisher: "Microsoft Corporation" };
  }
  if (/Cốc Cốc|CocCoc/i.test(name)) {
    return { key: "COCCOC", name: "Cốc Cốc Browser", version, publisher: "CocCoc" };
  }
  if (/^Zalo/i.test(name)) {
    return { key: "ZALO", name: "Zalo", version, publisher: "VNG Corp." };
  }
  if (/^Telegram/i.test(name)) {
    return { key: "TELEGRAM", name: "Telegram Desktop", version, publisher: publisher || "Telegram FZ-LLC" };
  }
  if (/^Skype/i.test(name)) {
    return { key: "SKYPE", name: "Skype", version, publisher: "Microsoft Corporation" };
  }
  if (/^Viber/i.test(name)) {
    return { key: "VIBER", name: "Viber", version, publisher: publisher || "Viber Media" };
  }
  if (/^WhatsApp/i.test(name)) {
    return { key: "WHATSAPP", name: "WhatsApp", version, publisher: publisher || "WhatsApp" };
  }
  if (/^TeamViewer/i.test(name)) {
    return { key: "TEAMVIEWER", name: "TeamViewer", version, publisher: "TeamViewer" };
  }
  if (/^UltraViewer/i.test(name)) {
    return { key: "ULTRAVIEWER", name: "UltraViewer", version, publisher: "DucFabulous" };
  }
  if (/^AnyDesk/i.test(name)) {
    return { key: "ANYDESK", name: "AnyDesk", version, publisher: "AnyDesk Software" };
  }
  if (/^(UniKey|EVKey)/i.test(name)) {
    const ime = /EVKey/i.test(name) ? "EVKey" : "UniKey";
    return { key: ime.toUpperCase(), name: ime, version, publisher };
  }
  if (/^(Foxit (PDF )?(Reader|Editor)|Adobe Acrobat)/i.test(name)) {
    const cleanPdf = name.replace(/\s*\(.*\)$/, "").replace(/\s*-\s*[A-Za-z]+$/, "").trim();
    return { key: `PDF_${cleanPdf.toUpperCase()}`, name: cleanPdf, version, publisher };
  }
  if (/^WinRAR/i.test(name)) {
    return { key: "WINRAR", name: "WinRAR", version, publisher: "win.rar GmbH" };
  }
  if (/^7-Zip/i.test(name)) {
    return { key: "7ZIP", name: "7-Zip", version, publisher: "Igor Pavlov" };
  }
  if (/^Node\.js/i.test(name)) {
    return { key: "NODEJS", name: "Node.js", version, publisher: "Node.js Foundation" };
  }
  if (/^Java (\d+|SE Development Kit)/i.test(name)) {
    const cleanJava = name.replace(/\s*\(\d+-bit\)/i, "").trim();
    return { key: "JAVA", name: cleanJava, version, publisher: "Oracle Corporation" };
  }

  // 6. Kaspersky & Antivirus Suites
  if (/Kaspersky/i.test(name)) {
    if (/(Network Agent|Administration Kit|Security Center|Plugin|Patch|Updater|Management|Connection)/i.test(name)) {
      return null;
    }
    let cleanKaspersky = name.replace(/\s*\(.*\)$/, "").trim();
    if (/Kaspersky Endpoint Security/i.test(cleanKaspersky)) {
      cleanKaspersky = "Kaspersky Endpoint Security";
    }
    return {
      key: "KASPERSKY_AV",
      name: cleanKaspersky,
      version,
      publisher: "Kaspersky",
    };
  }

  return {
    key: name.toUpperCase(),
    name,
    version,
    publisher,
  };
};

export const normalizeAndDedupeSoftwareList = (
  rawList: RawSoftwareItem[]
): Array<{ name: string; version: string; publisher: string }> => {
  const map = new Map<string, NormalizedSoftwareItem>();
  let officeFallbackFromMUI: NormalizedSoftwareItem | null = null;

  for (const item of rawList) {
    const rawName = (item.Name ?? item.name ?? "").trim();
    const rawVersion = (item.Version ?? item.version ?? "") || "";
    const rawPublisher = (item.Publisher ?? item.publisher ?? "") || "";

    if (!rawName) continue;

    // Detect if there is an Office MUI/Click-to-Run entry in case the machine has no main Office entry
    if (
      !officeFallbackFromMUI &&
      /^(Microsoft Office|Office 1[56])/i.test(rawName) &&
      /(MUI|Proofing|Click-to-Run|Shared|Word|Excel|Outlook)/i.test(rawName)
    ) {
      const yearMatch = rawName.match(/\b(2007|2010|2013|2016|2019|2021|2024|365)\b/);
      const title = yearMatch
        ? `Microsoft Office ${yearMatch[1]}`
        : inferOfficeTitleFromVersion(rawVersion);
      officeFallbackFromMUI = {
        key: "MS_OFFICE_SUITE",
        name: title,
        version: rawVersion,
        publisher: "Microsoft Corporation",
      };
    }

    const normalized = normalizeSingleSoftware(rawName, rawVersion, rawPublisher);
    if (!normalized) continue;

    if (normalized.key === "MS_OFFICE_SUITE_FALLBACK") {
      if (!officeFallbackFromMUI) {
        officeFallbackFromMUI = { ...normalized, key: "MS_OFFICE_SUITE" };
      }
      continue;
    }

    if (!map.has(normalized.key)) {
      map.set(normalized.key, normalized);
    }
  }

  if (!map.has("MS_OFFICE_SUITE") && officeFallbackFromMUI) {
    map.set("MS_OFFICE_SUITE", officeFallbackFromMUI);
  }

  return Array.from(map.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, version, publisher }) => ({ name, version, publisher }));
};

