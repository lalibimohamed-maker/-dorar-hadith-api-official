# Hadith Corpus Ingestion

This directory is reserved for source-backed hadith records imported only from datasets whose redistribution status has been verified.

Required record fields:
- hadithId
- sourceId
- book
- reference
- text
- chain
- provenance
- verificationState

No generated hadith text is accepted as corpus content. No scholar verdict is inferred from metadata.

## Import order
1. Sahih al-Bukhari
2. Sahih Muslim
3. Sunan Abi Dawud
4. Jami al-Tirmidhi
5. Sunan al-Nasa'i
6. Sunan Ibn Majah
7. Muwatta Malik
8. Musnad Ahmad

Each source must have a documented provenance and redistribution/licensing decision before bulk text import.
