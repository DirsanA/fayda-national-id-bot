export interface EthiopianIdData {
  // Personal Info
  fullNameAmharic: string;
  fullNameEnglish: string;
  dateOfBirthEth: string;
  dateOfBirthGreg: string;
  sexAmharic: string;
  sexEnglish: string;
  dateOfExpiryEth: string;
  dateOfExpiryGreg: string;
  dateOfIssueEth: string;
  dateOfIssueGreg: string;

  // Card & Registration Numbers
  fanNumber: string; // e.g. "8029 5016 4312 4539"
  finNumber: string; // e.g. "2142 7039 0587"
  serialNumber: string; // e.g. "65501482"

  // Contact & Address
  phoneNumber: string;
  nationalityAmharic: string;
  nationalityEnglish: string;
  regionAmharic: string;
  regionEnglish: string;
  subcityAmharic: string;
  subcityEnglish: string;
  woredaAmharic: string;
  woredaEnglish: string;

  // Visual Assets
  photoUrl: string;
  qrCodeUrl: string;
  barcodeUrl?: string;
}

export type RenderedLandscapeCards = {
  frontBlob: Blob;
  frontUrl: string;
  backBlob: Blob;
  backUrl: string;
};
