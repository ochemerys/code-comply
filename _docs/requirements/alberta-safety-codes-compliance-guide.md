# CodeComply — Alberta Regulatory Compliance Guide

## 1. Statutory Framework

CodeComply is designed to support workflows under the jurisdiction of:

- **Safety Codes Act (RSA 2000, c S-1)**
- **Administrative Items Regulation (AR 16/2004)**
- **Electronic Transactions Act (RSA 2000, c E-5.5)**
- **FOIP Act (Freedom of Information and Protection of Privacy)**

---

## 2. Technical Compliance Mapping

### [M-01] Authentication & SCO Authority

- **Requirement:** Integration with SCO certification profiles and revocation logic.
- **Legal Context:** Under _Section 42_ of the Act, an inspector must be a certified Safety Codes Officer. The system must verify that the user's "Designation of Powers" is active for the discipline (e.g., Electrical) before allowing a "Pass/Fail" entry.

### [M-05] Section 49 Orders (Stop Work)

- **Requirement:** Mandatory photo capture and code reference for failed items.
- **Legal Context:** A formal Order issued under _Section 49_ must include the specific code contravention. Digital evidence (photos with GPS/Timestamps) serves as the primary record for the Safety Codes Council if an Order is appealed.

### [A-06] Record Integrity & FOIP

- **Requirement:** Append-only records, no deletion, and SHA-256 document hashing.
- **Legal Context:** Under _FOIP_ and the _Administrative Items Regulation_, inspection reports are public-facing legal documents. The "Addendum" mechanism ensures that the original record is never "tampered with," maintaining the legal chain of custody.

### [LSC-A-05] Verification of Compliance (VOC)

- **Requirement:** Linking VOCs to resolved deficiencies.
- **Legal Context:** The _Safety Codes Act_ allows SCOs to accept "Written Assurance" or "Verbal Assurance" (VOC) as proof of correction. The system's ability to track the **Method of Verification** is required for closing out permits legally.

---

## 3. Data Retention Policy

- **Minimum Retention:** 10 Years (Recommended for Municipal Safety Codes Records).
- **Accessibility:** Must be exportable in PDF/Word format for FOIP requests within 30 days of a formal inquiry.

---

# ORDER OF A SAFETY CODES OFFICER

**Issued under Section 49 of the Safety Codes Act (RSA 2000, c S-1)**

---

### **PART 1: ADMINISTRATIVE DETAILS**

**Order Number:** `[Unique_Report_ID]`  
**Date of Issuance:** `[Current_Date]`  
**Permit Number:** `[Permit_Number]`  
**Discipline:** `[Building / Electrical / Gas / Plumbing / Private Sewage]`

**TO (Owner/Contractor/Vendor):** `[Contact_Name]`  
`[Mailing_Address]`  
`[Phone_Number]` / `[Email_Address]`

**LAND LOCATION / SITE ADDRESS:** `[Street_Address]`  
`[Legal_Land_Description_LLD]`

---

### **PART 2: INSPECTION SUMMARY**

On **`[Actual_Inspection_Date]`**, an inspection was conducted at the above location by:
**Inspector Name:** `[Inspector_Name]`  
**Designation of Powers ID:** `[SCO_ID]`  
**Accredited Organization:** `[Municipality_or_Agency_Name]`

---

### **PART 3: NATURE OF THE ORDER**

The Safety Codes Officer has identified conditions that contravene the _Safety Codes Act_. **You are hereby ordered to:**

- [ ] **STOP WORK:** Immediately cease all construction and/or activity related to this permit.
- [ ] **CORRECT DEFICIENCIES:** Rectify the contraventions listed in the table below.
- [ ] **UNSAFE CONDITION:** Render the following equipment/structure safe or remove it from the site.

#### **Contraventions & Required Actions**

| Item # | Code Reference  | Description of Contravention | Required Corrective Action |
| :----- | :-------------- | :--------------------------- | :------------------------- |
| 01     | `[Code_Ref_01]` | `[Deficiency_Notes_01]`      | `[Required_Action_01]`     |
| 02     | `[Code_Ref_02]` | `[Deficiency_Notes_02]`      | `[Required_Action_02]`     |

> **Evidence Note:** Visual evidence (Photos) with timestamps `[Timestamp]` and GPS coordinates `[GPS_Coords]` are attached to this record as Appendix A.

---

### **PART 4: COMPLIANCE DEADLINE**

Full compliance with this Order is required on or before: **`[Due_Date]`**.  
Failure to comply with this Order is an offence under the _Safety Codes Act_ and may result in fines or further legal action.

---

### **PART 5: RIGHT OF APPEAL**

**PLEASE TAKE NOTICE:** Pursuant to Section 49(1) of the _Safety Codes Act_, you have the right to appeal this Order to the **Safety Codes Council**.

- **Timeline:** An appeal must be submitted in writing within **fourteen (14) days** of the date this Order was served upon you.
- **Process:** For information on the appeal process and to obtain the required forms, please contact:
  - **Safety Codes Council**
  - Suite 1000, 10665 Jasper Avenue, Edmonton, AB T5J 3S9
  - Phone: 780-413-0099 | Website: www.safetycodes.ab.ca

---

### **PART 6: SIGNATURE & VERIFICATION**

**Signed:** `[Digital_Signature_Image]`  
**Safety Codes Officer:** `[Inspector_Name]`

**Document Integrity Hash (SHA-256):** `[SHA256_Hash_String]`
