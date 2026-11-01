import type { Rule } from "./types";

/**
 * IRDAI "List of items for which optional cover / no payment is made" (Annexure,
 * Guidelines on Standardization in Health Insurance; carried into the 2024 Master
 * Circular on Health Insurance Business). This file is the source of truth for the
 * `irdai_rules` seed (scripts/gen-seed.ts) and for offline evaluation.
 *
 * Circular references must be re-verified by the rules_admin against the current
 * IRDAI publication before go-live; they are versioned rows in production.
 */
const SOURCE = "IRDAI Master Circular on Health Insurance Business, 2024";
const CIRCULAR = "IRDAI/HLT/CIR/MISC/80/05/2024";
const EFFECTIVE = "2024-05-29";

type Entry = [slug: string, itemName: string, synonyms?: string[]];

const LIST_I: Entry[] = [
  ["BABY_FOOD", "Baby food", ["infant formula", "lactogen", "nan pro"]],
  ["BABY_UTILITIES", "Baby utilities charges"],
  ["BEAUTY_SERVICES", "Beauty services"],
  ["BELTS_BRACES", "Belts / braces", ["brace", "belt"]],
  ["BUDS", "Buds", ["ear buds", "cotton buds"]],
  ["COLD_HOT_PACK", "Cold pack / hot pack", ["hot pack", "cold pack", "ice pack", "hot water bag"]],
  ["CARRY_BAGS", "Carry bags", ["carry bag", "polythene bag"]],
  ["EMAIL_INTERNET", "Email / internet charges", ["wifi", "wi-fi", "internet", "email charges"]],
  ["FOOD_NON_PATIENT", "Food charges (other than patient's diet)", ["attendant food", "attendant meal", "guest meal", "canteen"]],
  ["LEGGINGS", "Leggings", ["stockings", "compression stockings", "ted stockings"]],
  ["LAUNDRY", "Laundry charges", ["laundry", "washing charges"]],
  ["MINERAL_WATER", "Mineral water", ["water bottle", "bisleri", "packaged drinking water"]],
  ["SANITARY_PAD", "Sanitary pad", ["sanitary napkin", "maternity pad"]],
  ["TELEPHONE", "Telephone charges", ["telephone", "phone charges", "std charges"]],
  ["GUEST_SERVICES", "Guest services"],
  ["CREPE_BANDAGE", "Crepe bandage", ["crepe"]],
  ["DIAPER", "Diaper of any type", ["diaper", "adult diaper", "diapers"]],
  ["EYELET_COLLAR", "Eyelet collar"],
  ["SLINGS", "Slings", ["sling"]],
  ["DONOR_BLOOD_GROUPING", "Blood grouping and cross matching of donors samples", ["donor cross match", "donor grouping"]],
  ["SERVICE_CHARGES", "Service charges where nursing charge also charged", ["service charge", "service charges"]],
  ["TELEVISION", "Television charges", ["tv charges", "television"]],
  ["SURCHARGES", "Surcharges", ["surcharge"]],
  ["ATTENDANT", "Attendant charges", ["attendant charges", "attendant bed"]],
  ["EXTRA_DIET", "Extra diet of patient", ["extra diet"]],
  ["BIRTH_CERTIFICATE", "Birth certificate"],
  ["CERTIFICATE", "Certificate charges", ["certificate charges", "fitness certificate"]],
  ["COURIER", "Courier charges", ["courier"]],
  ["CONVEYANCE", "Conveyance charges", ["conveyance", "transport charges"]],
  ["MEDICAL_CERTIFICATE", "Medical certificate"],
  ["MEDICAL_RECORDS", "Medical records", ["mrd charges", "medical record charges"]],
  ["PHOTOCOPIES", "Photocopies charges", ["photocopy", "xerox"]],
  ["MORTUARY", "Mortuary charges", ["mortuary"]],
  ["WALKING_AIDS", "Walking aids charges", ["walker", "walking stick", "crutches"]],
  ["OXYGEN_OUTSIDE", "Oxygen cylinder (for usage outside the hospital)", ["home oxygen"]],
  ["SPACER", "Spacer"],
  ["SPIROMETRE", "Spirometre", ["spirometer", "incentive spirometer"]],
  ["NEBULIZER_KIT", "Nebulizer kit", ["nebuliser kit"]],
  ["STEAM_INHALER", "Steam inhaler", ["vaporiser", "vaporizer"]],
  ["ARMSLING", "Armsling", ["arm sling"]],
  ["THERMOMETER", "Thermometer"],
  ["CERVICAL_COLLAR", "Cervical collar", ["neck collar"]],
  ["SPLINT", "Splint"],
  ["DIABETIC_FOOTWEAR", "Diabetic foot wear", ["diabetic footwear", "diabetic shoes"]],
  ["KNEE_BRACES", "Knee braces (long / short / hinged)", ["knee brace", "knee cap"]],
  ["IMMOBILIZER", "Knee immobilizer / shoulder immobilizer", ["knee immobilizer", "shoulder immobilizer", "immobiliser"]],
  ["LUMBO_SACRAL_BELT", "Lumbo sacral belt", ["ls belt", "lumbar belt"]],
  ["SPECIAL_BED", "Nimbus bed or water or air bed charges", ["air bed", "water bed", "nimbus bed", "air mattress"]],
  ["AMBULANCE_COLLAR", "Ambulance collar"],
  ["AMBULANCE_EQUIPMENT", "Ambulance equipment"],
  ["ABDOMINAL_BINDER", "Abdominal binder", ["binder"]],
  ["PRIVATE_NURSE", "Private nurses charges / special nursing charges", ["special nursing", "private nurse"]],
  ["SUGAR_FREE", "Sugar free tablets", ["sugar free", "sugarfree"]],
  ["TOILETRIES", "Creams, powders, lotions (toiletries are not payable, only prescribed medical pharmaceuticals payable)", ["moisturiser", "body lotion", "talcum powder", "cold cream"]],
  ["ECG_ELECTRODES", "ECG electrodes", ["ecg electrode", "electrodes"]],
  ["GLOVES", "Gloves", ["glove", "examination gloves", "surgical gloves", "sterile gloves"]],
  ["NEBULISATION_KIT", "Nebulisation kit", ["nebulisation mask kit"]],
  ["ANY_KIT", "Any kit with no details mentioned (delivery kit, orthokit, recovery kit, etc.)", ["delivery kit", "ortho kit", "orthokit", "recovery kit"]],
  ["KIDNEY_TRAY", "Kidney tray"],
  ["MASK", "Mask", ["face mask n95", "n95", "surgical mask"]],
  ["OUNCE_GLASS", "Ounce glass", ["measuring glass"]],
  ["OXYGEN_MASK", "Oxygen mask", ["o2 mask"]],
  ["PELVIC_TRACTION_BELT", "Pelvic traction belt"],
  ["PAN_CAN", "Pan can"],
  ["TROLLEY_COVER", "Trolly cover", ["trolley cover"]],
  ["UROMETER", "Urometer, urine jug", ["urine jug", "urometer"]],
  ["VASOFIX_SAFETY", "Vasofix safety", ["vasofix"]],
];

const LIST_II: Entry[] = [
  ["TOWEL", "Towel", ["towels"]],
  ["HAND_WASH", "Hand wash", ["handwash", "hand rub soap", "liquid soap"]],
  ["SHOE_COVER", "Shoe cover", ["shoe covers", "shoecover"]],
  ["CAPS", "Caps", ["cap", "bouffant cap", "head cap"]],
  ["CRADLE", "Cradle charges", ["cradle"]],
  ["COMB", "Comb"],
  ["EAU_DE_COLOGNE", "Eau-de-cologne / room freshners", ["room freshener", "room freshner", "air freshener"]],
  ["FOOT_COVER", "Foot cover"],
  ["GOWN", "Gown", ["patient gown"]],
  ["SLIPPERS", "Slippers", ["slipper", "chappal"]],
  ["TISSUE_PAPER", "Tissue paper", ["tissue", "tissues", "tissue roll"]],
  ["TOOTH_PASTE", "Tooth paste", ["toothpaste"]],
  ["TOOTH_BRUSH", "Tooth brush", ["toothbrush"]],
  ["BED_PAN", "Bed pan", ["bedpan"]],
  ["FACE_MASK", "Face mask", ["facemask"]],
  ["FLEXI_MASK", "Flexi mask"],
  ["HAND_HOLDER", "Hand holder"],
  ["SPUTUM_CUP", "Sputum cup"],
  ["DISINFECTANT_LOTIONS", "Disinfectant lotions", ["dettol", "savlon", "lysol"]],
  ["LUXURY_TAX", "Luxury tax"],
  ["HVAC", "HVAC"],
  ["HOUSE_KEEPING", "House keeping charges", ["housekeeping"]],
  ["AIR_CONDITIONER", "Air conditioner charges", ["ac charges", "air conditioning"]],
  ["IM_IV_INJECTION", "IM IV injection charges", ["injection charges", "iv charges", "im charges"]],
  ["CLEAN_SHEET", "Clean sheet", ["bed sheet", "bedsheet", "linen"]],
  ["BLANKET", "Blanket / warmer blanket", ["blanket", "warmer blanket", "bair hugger"]],
  ["ADMISSION_KIT", "Admission kit"],
  ["DIABETIC_CHART", "Diabetic chart charges", ["diabetic chart"]],
  ["DOCUMENTATION", "Documentation charges / administrative expenses", ["documentation charges", "administrative charges", "admin charges"]],
  ["DISCHARGE_PROCEDURE", "Discharge procedure charges", ["discharge charges"]],
  ["DAILY_CHART", "Daily chart charges", ["daily chart"]],
  ["ENTRANCE_PASS", "Entrance pass / visitors pass charges", ["visitor pass", "visitors pass", "gate pass"]],
  ["DISCHARGE_PRESCRIPTION", "Expenses related to prescription on discharge"],
  ["FILE_OPENING", "File opening charges", ["file charges", "file opening"]],
  ["INCIDENTAL", "Incidental expenses / misc charges (not explained)", ["misc charges", "miscellaneous charges", "incidental charges"]],
  ["ID_BAND", "Patient identification band / name tag", ["id band", "wrist band", "name tag"]],
  ["PULSE_OXIMETER", "Pulseoxymeter charges", ["pulse oximeter", "spo2 probe", "pulseoximeter"]],
];

const LIST_III: Entry[] = [
  ["HAIR_REMOVAL_CREAM", "Hair removal cream", ["veet"]],
  ["RAZOR", "Disposables razors charges (for site preparations)", ["razor", "disposable razor", "shaving"]],
  ["EYE_PAD", "Eye pad", ["eyepad"]],
  ["EYE_SHIELD", "Eye shield"],
  ["CAMERA_COVER", "Camera cover"],
  ["DVD_CD", "DVD, CD charges", ["cd charges", "dvd"]],
  ["GAUZE_SOFT", "Gauze soft"],
  ["GAUZE", "Gauze", ["gauze piece", "gauze swab"]],
  ["WARD_THEATRE_BOOKING", "Ward and theatre booking charges", ["ot booking", "theatre booking"]],
  ["SCOPE_INSTRUMENTS", "Arthroscopy and endoscopy instruments", ["scope charges", "endoscopy instruments"]],
  ["MICROSCOPE_COVER", "Microscope cover", ["microscope drape"]],
  ["SURGICAL_BLADES", "Surgical blades, harmonic scalpel, shaver", ["blade", "surgical blade", "harmonic scalpel", "shaver blade"]],
  ["SURGICAL_DRILL", "Surgical drill", ["drill charges"]],
  ["EYE_KIT", "Eye kit"],
  ["EYE_DRAPE", "Eye drape"],
  ["XRAY_FILM", "X-ray film", ["x ray film", "xray film"]],
  ["BOYLES_APPARATUS", "Boyles apparatus charges", ["boyles", "anaesthesia machine charges"]],
  ["COTTON", "Cotton", ["absorbent cotton", "cotton roll"]],
  ["COTTON_BANDAGE", "Cotton bandage", ["roller bandage"]],
  ["SURGICAL_TAPE", "Surgical tape", ["micropore", "transpore", "dynaplast", "adhesive tape"]],
  ["APRON", "Apron", ["surgical apron", "disposable apron"]],
  ["TOURNIQUET", "Torniquet", ["tourniquet"]],
  ["ORTHO_GYNAEC_BUNDLE", "Orthobundle, gynaec bundle", ["ortho bundle", "gynaec bundle", "gyno bundle"]],
];

const LIST_IV: Entry[] = [
  ["ADMISSION_REGISTRATION", "Admission / registration charges", ["registration charges", "admission charges"]],
  ["EVALUATION_ADMISSION", "Hospitalisation for evaluation / diagnostic purpose"],
  ["URINE_CONTAINER", "Urine container", ["urine pot", "sample container"]],
  ["BLOOD_RESERVATION", "Blood reservation charges and ante natal booking charges", ["blood reservation", "antenatal booking"]],
  ["BIPAP", "Bipap machine", ["bipap"]],
  ["CPAP_CAPD", "CPAP / CAPD equipments", ["cpap", "capd"]],
  ["INFUSION_PUMP", "Infusion pump - cost", ["syringe pump", "infusion pump"]],
  ["ANTISEPTICS", "Hydrogen peroxide / spirit / disinfectants etc", ["hydrogen peroxide", "spirit", "betadine", "povidone iodine"]],
  ["NUTRITION_PLANNING", "Nutrition planning charges - dietician charges - diet charges", ["dietician", "diet charges", "nutrition charges"]],
  ["HIV_KIT", "HIV kit", ["hiv kit"]],
  ["MOUTHWASH", "Antiseptic mouthwash", ["mouthwash", "chlorhexidine mouthwash"]],
  ["LOZENGES", "Lozenges", ["strepsils"]],
  ["MOUTH_PAINT", "Mouth paint"],
  ["VACCINATION", "Vaccination charges"],
  ["ALCOHOL_SWABS", "Alcohol swabs", ["alcohol swab", "spirit swab", "prep pad"]],
  ["SCRUB_SOLUTION", "Scrub solution / sterillium", ["sterillium", "hand rub", "scrub solution"]],
  ["GLUCOMETER", "Glucometer & strips", ["glucometer", "glucose strips", "grbs strips", "glucostrips"]],
  ["URINE_BAG", "Urine bag", ["uro bag", "urobag", "urine collection bag"]],
];

const TEXT = {
  I: {
    en: (n: string) =>
      `"${n}" is an optional / non-medical item under IRDAI List I. It is not payable unless the policy carries a consumables add-on.`,
    hi: (n: string) =>
      `"${n}" IRDAI सूची I के अंतर्गत वैकल्पिक / गैर-चिकित्सा मद है। Consumables Add-on न होने पर यह देय नहीं है।`,
    rebEn: (n: string) =>
      `The policy includes a consumables add-on; "${n}" (IRDAI List I) is therefore payable and the deduction should be reversed.`,
    rebHi: (n: string) =>
      `पॉलिसी में Consumables Add-on शामिल है; अतः "${n}" (IRDAI सूची I) देय है और कटौती वापस ली जाए।`,
  },
  II: {
    en: (n: string) =>
      `"${n}" is subsumed into room charges under IRDAI List II. It cannot be billed separately and must be absorbed into the room-rent line.`,
    hi: (n: string) =>
      `"${n}" IRDAI सूची II के अनुसार कमरे के किराए में समाहित है। इसे अलग से बिल नहीं किया जा सकता; इसे कमरे के किराए में जोड़ा जाए।`,
    rebEn: (n: string) =>
      `"${n}" is a List II item subsumed in room charges. Room charges are within the admissible limit, so no separate deduction is permitted; the amount has been merged into the room-rent line.`,
    rebHi: (n: string) =>
      `"${n}" सूची II की मद है जो कमरे के किराए में समाहित है। कमरे का किराया स्वीकार्य सीमा में है, इसलिए अलग से कटौती अनुमत नहीं है; राशि कमरे के किराए में जोड़ दी गई है।`,
  },
  III: {
    en: (n: string) =>
      `"${n}" is subsumed into procedure charges under IRDAI List III and should be billed within the procedure / OT package.`,
    hi: (n: string) =>
      `"${n}" IRDAI सूची III के अनुसार ऑपरेशन/प्रक्रिया शुल्क में समाहित है और इसे प्रक्रिया पैकेज में ही दिखाया जाना चाहिए।`,
    rebEn: (n: string) =>
      `"${n}" is a List III item forming part of the procedure. It has been re-mapped into procedure charges, which are payable; deducting it as a stand-alone consumable is not permitted.`,
    rebHi: (n: string) =>
      `"${n}" सूची III की मद है और प्रक्रिया का हिस्सा है। इसे प्रक्रिया शुल्क में जोड़ दिया गया है, जो देय है; इसे अलग उपभोज्य मानकर काटना अनुमत नहीं है।`,
  },
  IV: {
    en: (n: string) =>
      `"${n}" is subsumed into the cost of treatment under IRDAI List IV and should be billed within the treatment package.`,
    hi: (n: string) =>
      `"${n}" IRDAI सूची IV के अनुसार इलाज के खर्च में समाहित है और इसे इलाज पैकेज में ही दिखाया जाना चाहिए।`,
    rebEn: (n: string) =>
      `"${n}" is a List IV item forming part of the cost of treatment. It has been re-mapped into treatment charges, which are payable; a stand-alone deduction is not permitted.`,
    rebHi: (n: string) =>
      `"${n}" सूची IV की मद है और इलाज के खर्च का हिस्सा है। इसे इलाज शुल्क में जोड़ दिया गया है, जो देय है; अलग से कटौती अनुमत नहीं है।`,
  },
} as const;

function build(list: Rule["list"], entries: Entry[]): Rule[] {
  const t = TEXT[list];
  return entries.map(([slug, itemName, synonyms = []], i) => ({
    code: `L${list}.${slug}`,
    list,
    itemName,
    synonyms,
    source: SOURCE,
    circularRef: CIRCULAR,
    clause: `Annexure, List ${list}, item ${i + 1}`,
    effectiveFrom: EFFECTIVE,
    explanationEn: t.en(itemName),
    explanationHi: t.hi(itemName),
    rebuttalEn: t.rebEn(itemName),
    rebuttalHi: t.rebHi(itemName),
  }));
}

export const RULES: Rule[] = [
  ...build("I", LIST_I),
  ...build("II", LIST_II),
  ...build("III", LIST_III),
  ...build("IV", LIST_IV),
];

/** Non-list rules the engine cites in rebuttals. */
export const PRORATA_RULE = {
  code: "PRORATA.EXEMPT",
  source: "IRDAI (Insurance Products) Regulations / Health Insurance Regulations",
  circularRef: CIRCULAR,
  clause: "Proportionate deduction — exempted categories",
  rebuttalEn:
    "Proportionate deduction cannot be applied to pharmacy, implants and medical devices, diagnostics or ICU charges. The deduction of {amount} on \"{item}\" is not permitted and must be reversed.",
  rebuttalHi:
    "दवाइयों, इम्प्लांट/चिकित्सा उपकरणों, जांच (Diagnostics) और ICU शुल्क पर अनुपातिक कटौती लागू नहीं की जा सकती। \"{item}\" पर {amount} की कटौती अनुमत नहीं है और वापस ली जाए।",
} as const;

export const NON_DIFFERENTIAL_RULE = {
  code: "PRORATA.NON_DIFFERENTIAL",
  source: SOURCE,
  circularRef: CIRCULAR,
  clause: "Proportionate deduction — non-differential billing / package rate",
  rebuttalEn:
    "The hospital does not follow differential billing by room category (or the treatment is billed at a fixed package rate). Proportionate deduction is therefore not applicable; the deduction of {amount} on \"{item}\" must be reversed.",
  rebuttalHi:
    "अस्पताल कमरे की श्रेणी के अनुसार अलग-अलग शुल्क नहीं लेता (या इलाज तय पैकेज दर पर है)। इसलिए अनुपातिक कटौती लागू नहीं होती; \"{item}\" पर {amount} की कटौती वापस ली जाए।",
} as const;

export const EXCESS_DEDUCTION_RULE = {
  code: "PRORATA.EXCESS",
  source: SOURCE,
  circularRef: CIRCULAR,
  clause: "Proportionate deduction — computation",
  rebuttalEn:
    "Applying the policy room-rent limit, the maximum admissible deduction on \"{item}\" is {allowed}. The TPA has deducted {deducted}; the excess of {amount} must be reversed.",
  rebuttalHi:
    "पॉलिसी की कमरे के किराए की सीमा लागू करने पर \"{item}\" पर अधिकतम स्वीकार्य कटौती {allowed} है। TPA ने {deducted} काटे हैं; अतिरिक्त {amount} वापस किए जाएं।",
} as const;
