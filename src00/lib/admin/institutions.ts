import { createCollection } from "./store";
import { paramId, type ParamStatus } from "./parameters";

/**
 * An institution as the Administration portal manages it. Every
 * "choose from a list" field stores the id of a parameter
 * (src/lib/admin/parameters.ts) rather than a free-text label, so renaming
 * a region or an accrediting body updates every institution that uses it.
 *
 * Ids inst-1 … inst-4 deliberately match src/lib/data.ts so the admin view
 * and the applicant/institution portals talk about the same records.
 */
export interface AdminInstitution {
  id: string;
  typeId: string;
  accreditationBodyId: string;
  accreditationCode: string;
  name: string;
  address: string;
  /** GPS coordinates or a landmark description. */
  location: string;
  regionId: string;
  townId: string;
  quarterId: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  status: ParamStatus;
  /** Platform web fee charged per application, in XAF. */
  webFee: number;
  createdAt: string;
  updatedAt: string;
}

type Seed = [
  id: string,
  name: string,
  type: string,
  body: string,
  code: string,
  region: string,
  town: string,
  quarter: string,
  address: string,
  location: string,
  contact: string,
  phone: string,
  domain: string,
  webFee: number,
  status: ParamStatus,
  created: string,
];

const SEEDS: Seed[] = [
  ["inst-1", "Mont Fébé University", "UNI", "MINESUP", "MINESUP/UNI/2009/014", "CE", "YDE", "YDE-02", "BP 1024, Route de Mont Fébé", "3.8912° N, 11.4987° E", "Dr. Solange Abena", "+237 222 20 14 00", "montfebe.example.cm", 2500, "ACTIVE", "2025-11-03"],
  ["inst-2", "Sanaga Polytechnic Institute", "VOC", "MINEFOP", "MINEFOP/IFP/2014/087", "LT", "DLA", "DLA-01", "12 Rue Joss, Bonanjo", "4.0435° N, 9.6889° E", "Eng. Roland Ekwalla", "+237 233 42 18 60", "sanagapoly.example.cm", 2000, "ACTIVE", "2025-11-10"],
  ["inst-3", "Bamenda Professional School of Health", "PRO", "MINSANTE", "MINSANTE/EPS/2011/031", "NW", "BDA", "BDA-02", "Old Station Road, Up Station", "5.9631° N, 10.1591° E", "Mrs. Florence Ngwa", "+237 233 36 21 05", "bpsh.example.cm", 3000, "ACTIVE", "2025-11-18"],
  ["inst-4", "Lycée Général de Bafoussam", "HS", "MINESEC", "MINESEC/LYC/1962/004", "WE", "BFM", "BFM-01", "Avenue de la République, Tamdja", "5.4781° N, 10.4176° E", "M. Jean-Paul Tchoua", "+237 233 44 10 72", "lgbafoussam.example.cm", 1000, "ACTIVE", "2025-12-01"],
  ["inst-5", "Mount Cameroon University", "UNI", "MINESUP", "MINESUP/UNI/2012/022", "SW", "BUE", "BUE-01", "University Road, Molyko", "4.1527° N, 9.2920° E", "Prof. Emmanuel Ayuk", "+237 233 32 25 40", "mcu.example.cm", 2500, "ACTIVE", "2025-12-04"],
  ["inst-6", "Wouri Institute of Commerce", "PRO", "MINESUP", "MINESUP/IPES/2016/109", "LT", "DLA", "DLA-02", "Boulevard de la Liberté, Akwa", "4.0511° N, 9.7008° E", "Mme. Brigitte Ndoumbé", "+237 233 43 77 12", "wouricommerce.example.cm", 2000, "ACTIVE", "2025-12-15"],
  ["inst-7", "Menoua Agricultural College", "VOC", "MINEFOP", "MINEFOP/IFP/2010/044", "WE", "DSC", "DSC-01", "Route de Foto, near the market", "5.4442° N, 10.0535° E", "M. Célestin Fotso", "+237 233 45 12 90", "menouaagri.example.cm", 1500, "ACTIVE", "2026-01-08"],
  ["inst-8", "Lycée Bilingue d'Essos", "HS", "MINESEC", "MINESEC/LYC/1978/019", "CE", "YDE", "YDE-05", "Rue 1.839, Essos", "3.8703° N, 11.5372° E", "Mme. Rachel Owona", "+237 222 21 36 48", "lbessos.example.cm", 1000, "ACTIVE", "2026-01-20"],
  ["inst-9", "Adamawa Technical College", "VOC", "MINEFOP", "MINEFOP/IFP/2015/063", "AD", "NGD", "NGD-01", "Campus de Dang, Route de Meiganga", "7.4214° N, 13.5460° E", "M. Oumarou Bello", "+237 222 25 11 30", "adamawatech.example.cm", 1500, "ACTIVE", "2026-02-02"],
  ["inst-10", "Bénoué Institute of Engineering", "UNI", "MINESUP", "MINESUP/IPES/2018/131", "NO", "GOU", "GOU-02", "Quartier Plateau, BP 214", "9.3014° N, 13.3977° E", "Dr. Aminatou Hayatou", "+237 222 27 30 18", "benoueeng.example.cm", 2500, "INACTIVE", "2026-02-19"],
  ["inst-11", "Kribi Maritime Academy", "PRO", "MINESUP", "MINESUP/IPES/2019/140", "SU", "KRI", "KRI-02", "Route de Campo, Ngoyé", "2.9393° N, 9.9101° E", "Capt. Serge Mvondo", "+237 222 46 15 82", "kribimaritime.example.cm", 3000, "ACTIVE", "2026-03-05"],
  ["inst-12", "Diamaré Secondary School", "SS", "MINESEC", "MINESEC/CES/2003/057", "EN", "MRA", "MRA-01", "Quartier Domayo, BP 88", "10.5956° N, 14.3247° E", "M. Moussa Abdoulaye", "+237 222 29 14 06", "diamare.example.cm", 1000, "ACTIVE", "2026-03-21"],
  ["inst-13", "Limbe Nautical School", "PRO", "MINESUP", "MINESUP/IPES/2020/152", "SW", "LMB", "LMB-01", "Down Beach Road", "4.0122° N, 9.2037° E", "Mr. Peter Esoka", "+237 233 33 20 51", "limbenautical.example.cm", 2500, "INACTIVE", "2026-04-10"],
];

function seedInstitutions(): AdminInstitution[] {
  return SEEDS.map(
    ([id, name, type, body, code, region, town, quarter, address, location, contact, phone, domain, webFee, status, created]) => ({
      id,
      name,
      typeId: paramId("institution-types", type),
      accreditationBodyId: paramId("accreditation-bodies", body),
      accreditationCode: code,
      address,
      location,
      regionId: paramId("regions", region),
      townId: paramId("towns", town),
      quarterId: paramId("quarters", quarter),
      contactName: contact,
      phone,
      email: `admissions@${domain}`,
      website: `https://www.${domain}`,
      status,
      webFee,
      createdAt: `${created}T09:00:00.000Z`,
      updatedAt: `${created}T09:00:00.000Z`,
    })
  );
}

export const institutionStore = createCollection<AdminInstitution>("institutions", seedInstitutions);

/**
 * The seed institutions in the minimal form the mock student generator
 * needs. It must read the seed, never the live store: the generator runs
 * at module load on both server and client, and has to produce identical
 * data on each.
 */
export const SEED_INSTITUTIONS = SEEDS.map((s) => ({ id: s[0], typeCode: s[2], webFee: s[13], status: s[14] }));
