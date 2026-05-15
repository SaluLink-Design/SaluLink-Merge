import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { PatientCase, TreatmentItem, SelectedMedication } from '@/types';
import { format } from 'date-fns';

export class PDFExportService {
  private doc: jsPDF;
  private yPosition: number;
  private pageHeight: number;
  private margin: number;

  constructor() {
    this.doc = new jsPDF();
    this.yPosition = 20;
    this.pageHeight = this.doc.internal.pageSize.height;
    this.margin = 20;
  }

  private sanitizeFileName(text: string): string {
    return text.replace(/[^a-z0-9]/gi, '_');
  }

  private generateFileName(patientName: string, patientId: string, claimType: string): string {
    const sanitizedName = this.sanitizeFileName(patientName);
    const sanitizedId = this.sanitizeFileName(patientId);
    return `${sanitizedName}_${sanitizedId}_${claimType}`;
  }

  private checkPageBreak(height: number = 10) {
    if (this.yPosition + height > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.yPosition = 20;
    }
  }

  private addTitle(text: string) {
    this.checkPageBreak(15);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(text, this.margin, this.yPosition);
    this.yPosition += 15;
  }

  private addSubtitle(text: string) {
    this.checkPageBreak(12);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(text, this.margin, this.yPosition);
    this.yPosition += 10;
  }

  private addText(text: string, indent: number = 0) {
    this.checkPageBreak(8);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');

    const maxWidth = this.doc.internal.pageSize.width - this.margin * 2 - indent;
    const lines = this.doc.splitTextToSize(text, maxWidth);

    lines.forEach((line: string) => {
      this.checkPageBreak(8);
      this.doc.text(line, this.margin + indent, this.yPosition);
      this.yPosition += 7;
    });
  }

  private addBoldText(label: string, value: string, indent: number = 0) {
    this.checkPageBreak(8);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(label, this.margin + indent, this.yPosition);

    this.doc.setFont('helvetica', 'normal');
    const labelWidth = this.doc.getTextWidth(label);
    this.doc.text(value, this.margin + indent + labelWidth + 2, this.yPosition);
    this.yPosition += 8;
  }

  private addDivider() {
    this.checkPageBreak(5);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.yPosition, this.doc.internal.pageSize.width - this.margin, this.yPosition);
    this.yPosition += 10;
  }

  private async addImage(imageUrl: string, maxWidth: number = 80, maxHeight: number = 80) {
    try {
      this.checkPageBreak(maxHeight + 10);
      this.doc.addImage(imageUrl, 'JPEG', this.margin + 10, this.yPosition, maxWidth, maxHeight);
      this.yPosition += maxHeight + 5;
    } catch (error) {
      console.error('Failed to add image to PDF:', error);
      this.addText('  [Image attachment]', 10);
    }
  }

  async exportInitialClaimWithAttachments(patientCase: PatientCase): Promise<void> {
    const zip = new JSZip();
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Initial_Claim');

    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildInitialClaimPDF(patientCase);
    const pdfBlob = this.doc.output('blob');
    zip.file(`${fileName}.pdf`, pdfBlob);

    const allTreatments = [
      ...patientCase.diagnosticTreatments,
      ...patientCase.ongoingTreatments
    ];

    let fileCounter = 1;
    allTreatments.forEach((treatment) => {
      if (treatment.documentation.images && treatment.documentation.images.length > 0) {
        treatment.documentation.images.forEach((fileData) => {
          try {
            const parsed = JSON.parse(fileData);
            const base64Data = parsed.data.split(',')[1];
            const sanitizedName = parsed.name.replace(/[^a-z0-9.-]/gi, '_');
            zip.file(`attachment-${fileCounter}-${sanitizedName}`, base64Data, { base64: true });
            fileCounter++;
          } catch {
            const base64Data = fileData.split(',')[1];
            if (base64Data) {
              zip.file(`attachment-${fileCounter}.jpg`, base64Data, { base64: true });
              fileCounter++;
            }
          }
        });
      }
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportInitialClaim(patientCase: PatientCase): void {
    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildInitialClaimPDF(patientCase);
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Initial_Claim');
    this.doc.save(`${fileName}.pdf`);
  }

  private buildInitialClaimPDF(patientCase: PatientCase): void {
    this.addTitle('SaluLink Chronic Treatment Claim');
    this.addText(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Patient Information');
    this.addBoldText('Name: ', patientCase.patientName, 5);
    this.addBoldText('Patient ID: ', patientCase.patientId, 5);
    this.addBoldText('Medical Plan: ', patientCase.plan, 5);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Clinical Note');
    this.addText(patientCase.clinicalNote, 5);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Diagnosis');
    this.addBoldText('Condition: ', patientCase.condition, 5);
    this.addBoldText('ICD-10 Code: ', patientCase.icdCode, 5);
    this.addText(`Description: ${patientCase.icdDescription}`, 5);
    this.yPosition += 5;
    this.addDivider();

    if (patientCase.diagnosticTreatments.length > 0) {
      this.addSubtitle('Diagnostic Basket');
      patientCase.diagnosticTreatments.forEach((treatment, index) => {
        this.addText(`${index + 1}. ${treatment.description}`, 5);
        this.addBoldText('  Code: ', treatment.code, 10);
        this.addBoldText('  Times Completed: ', `${treatment.timesCompleted} of ${treatment.maxCovered}`, 10);
        if (treatment.documentation.notes) {
          this.addText(`  Notes: ${treatment.documentation.notes}`, 10);
        }
        if (treatment.documentation.images && treatment.documentation.images.length > 0) {
          this.addText(`  Attachments: ${treatment.documentation.images.length} file(s)`, 10);
        }
        this.yPosition += 3;
      });
      this.addDivider();
    }

    if (patientCase.medications.length > 0) {
      this.addSubtitle('Prescribed Medications');
      patientCase.medications.forEach((med, index) => {
        this.addText(`${index + 1}. ${med.medicineNameAndStrength}`, 5);
        this.addText(`   ${med.activeIngredient}`, 10);
        this.addBoldText('   CDA Amount: ', med.cdaAmount, 10);
        this.yPosition += 3;
      });

      if (patientCase.medicationNote) {
        this.yPosition += 5;
        this.addText('Registration Note:', 5);
        this.addText(patientCase.medicationNote, 10);
      }
      this.addDivider();
    }

    this.yPosition = this.pageHeight - 30;
    this.doc.setFontSize(9);
    this.doc.setTextColor(150);
    this.doc.text('Generated by SaluLink Chronic Treatment App', this.margin, this.yPosition);
    this.doc.text(`Case ID: ${patientCase.id}`, this.margin, this.yPosition + 5);
  }

  async exportOngoingManagementWithAttachments(patientCase: PatientCase): Promise<void> {
    const zip = new JSZip();
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Ongoing_Management');

    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildOngoingManagementPDF(patientCase);
    const pdfBlob = this.doc.output('blob');
    zip.file(`${fileName}.pdf`, pdfBlob);

    let fileCounter = 1;
    patientCase.ongoingTreatments.forEach((treatment) => {
      if (treatment.documentation.images && treatment.documentation.images.length > 0) {
        treatment.documentation.images.forEach((fileData) => {
          try {
            const parsed = JSON.parse(fileData);
            const base64Data = parsed.data.split(',')[1];
            const sanitizedName = parsed.name.replace(/[^a-z0-9.-]/gi, '_');
            zip.file(`attachment-${fileCounter}-${sanitizedName}`, base64Data, { base64: true });
            fileCounter++;
          } catch {
            const base64Data = fileData.split(',')[1];
            if (base64Data) {
              zip.file(`attachment-${fileCounter}.jpg`, base64Data, { base64: true });
              fileCounter++;
            }
          }
        });
      }
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async exportSingleOngoingTreatment(
    patientCase: PatientCase,
    treatmentIndex: number
  ): Promise<void> {
    const treatment = patientCase.ongoingTreatments[treatmentIndex];
    if (!treatment) return;

    const zip = new JSZip();
    const treatmentName = treatment.description.replace(/[^a-z0-9]/gi, '_');
    const fileName = `${patientCase.patientName.replace(/\s+/g, '_')}_${patientCase.patientId}_ongoing_management_${treatmentName}`;

    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildSingleTreatmentPDF(patientCase, treatment);
    const pdfBlob = this.doc.output('blob');
    zip.file(`${fileName}.pdf`, pdfBlob);

    if (treatment.documentation.images && treatment.documentation.images.length > 0) {
      let fileCounter = 1;
      treatment.documentation.images.forEach((fileData) => {
        try {
          const parsed = JSON.parse(fileData);
          const base64Data = parsed.data.split(',')[1];
          const sanitizedName = parsed.name.replace(/[^a-z0-9.-]/gi, '_');
          zip.file(`attachment-${fileCounter}-${sanitizedName}`, base64Data, { base64: true });
          fileCounter++;
        } catch {
          const base64Data = fileData.split(',')[1];
          if (base64Data) {
            zip.file(`attachment-${fileCounter}.jpg`, base64Data, { base64: true });
            fileCounter++;
          }
        }
      });
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportOngoingManagement(patientCase: PatientCase): void {
    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildOngoingManagementPDF(patientCase);
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Ongoing_Management');
    this.doc.save(`${fileName}.pdf`);
  }

  private buildOngoingManagementPDF(patientCase: PatientCase): void {
    this.addTitle('Ongoing Management Report');
    this.addText(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Patient Information');
    this.addBoldText('Name: ', patientCase.patientName, 5);
    this.addBoldText('Patient ID: ', patientCase.patientId, 5);
    this.addBoldText('Condition: ', patientCase.condition, 5);
    this.addBoldText('ICD-10: ', patientCase.icdCode, 5);
    this.yPosition += 5;
    this.addDivider();

    if (patientCase.ongoingTreatments.length > 0) {
      this.addSubtitle('Ongoing Management Basket');
      patientCase.ongoingTreatments.forEach((treatment, index) => {
        this.addText(`${index + 1}. ${treatment.description}`, 5);
        this.addBoldText('  Code: ', treatment.code, 10);
        this.addBoldText('  Times Completed: ', `${treatment.timesCompleted} of ${treatment.maxCovered}`, 10);
        if (treatment.documentation.notes) {
          this.addText(`  Notes: ${treatment.documentation.notes}`, 10);
        }
        if (treatment.documentation.images && treatment.documentation.images.length > 0) {
          this.addText(`  Attachments: ${treatment.documentation.images.length} file(s)`, 10);
        }
        this.yPosition += 3;
      });
    }
  }

  private buildSingleTreatmentPDF(patientCase: PatientCase, treatment: any): void {
    this.addTitle('Ongoing Management Treatment');
    this.addText(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Patient Information');
    this.addBoldText('Name: ', patientCase.patientName, 5);
    this.addBoldText('Patient ID: ', patientCase.patientId, 5);
    this.addBoldText('Condition: ', patientCase.condition, 5);
    this.addBoldText('ICD-10: ', patientCase.icdCode, 5);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Treatment Details');
    this.addBoldText('Treatment: ', treatment.description, 5);
    this.addBoldText('Code: ', treatment.code, 5);
    this.addBoldText('Times Completed: ', `${treatment.timesCompleted} of ${treatment.maxCovered}`, 5);
    this.yPosition += 5;

    if (treatment.documentation.notes) {
      this.addSubtitle('Clinical Notes');
      this.addText(treatment.documentation.notes, 5);
      this.yPosition += 5;
    }

    if (treatment.documentation.images && treatment.documentation.images.length > 0) {
      this.addSubtitle('Attachments');
      this.addText(`${treatment.documentation.images.length} file(s) attached`, 5);
    }
  }

  async exportMedicationReportWithAttachments(
    patientCase: PatientCase,
    followUpNotes: string,
    newMedications?: SelectedMedication[],
    motivationLetter?: string,
    documentation?: { notes: string; images: string[] }
  ): Promise<void> {
    const zip = new JSZip();
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Medication_Report');

    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildMedicationReportPDF(patientCase, followUpNotes, newMedications, motivationLetter);
    const pdfBlob = this.doc.output('blob');
    zip.file(`${fileName}.pdf`, pdfBlob);

    let fileCounter = 1;
    if (documentation && documentation.images && documentation.images.length > 0) {
      documentation.images.forEach((fileData) => {
        try {
          const parsed = JSON.parse(fileData);
          const base64Data = parsed.data.split(',')[1];
          const sanitizedName = parsed.name.replace(/[^a-z0-9.-]/gi, '_');
          zip.file(`attachment-${fileCounter}-${sanitizedName}`, base64Data, { base64: true });
          fileCounter++;
        } catch {
          const base64Data = fileData.split(',')[1];
          if (base64Data) {
            zip.file(`attachment-${fileCounter}.jpg`, base64Data, { base64: true });
            fileCounter++;
          }
        }
      });
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportMedicationReport(
    patientCase: PatientCase,
    followUpNotes: string,
    newMedications?: SelectedMedication[],
    motivationLetter?: string
  ): void {
    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildMedicationReportPDF(patientCase, followUpNotes, newMedications, motivationLetter);
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Medication_Report');
    this.doc.save(`${fileName}.pdf`);
  }

  private buildMedicationReportPDF(
    patientCase: PatientCase,
    followUpNotes: string,
    newMedications?: SelectedMedication[],
    motivationLetter?: string
  ): void {
    this.addTitle('Medication Report');
    this.addText(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Patient Information');
    this.addBoldText('Name: ', patientCase.patientName, 5);
    this.addBoldText('Patient ID: ', patientCase.patientId, 5);
    this.addBoldText('Condition: ', patientCase.condition, 5);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Current Medications');
    patientCase.medications.forEach((med, index) => {
      this.addText(`${index + 1}. ${med.medicineNameAndStrength}`, 5);
      this.addText(`   ${med.activeIngredient}`, 10);
      this.addBoldText('   CDA Amount: ', med.cdaAmount, 10);
      this.yPosition += 3;
    });
    this.addDivider();

    this.addSubtitle('Follow-up Notes');
    this.addText(followUpNotes, 5);
    this.yPosition += 5;
    this.addDivider();

    if (newMedications && newMedications.length > 0) {
      this.addSubtitle('New Prescribed Medications');
      newMedications.forEach((med, index) => {
        this.addText(`${index + 1}. ${med.medicineNameAndStrength}`, 5);
        this.addText(`   ${med.activeIngredient}`, 10);
        this.addBoldText('   CDA Amount: ', med.cdaAmount, 10);
        this.yPosition += 3;
      });
      this.addDivider();

      if (motivationLetter) {
        this.addSubtitle('Motivation for Medication Change');
        this.addText(motivationLetter, 5);
      }
    }
  }

  async exportReferralWithAttachments(
    patientCase: PatientCase,
    urgency: string,
    referralNote: string,
    specialistType: string
  ): Promise<void> {
    const zip = new JSZip();
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Referral');

    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildReferralPDF(patientCase, urgency, referralNote, specialistType);
    const pdfBlob = this.doc.output('blob');
    zip.file(`${fileName}.pdf`, pdfBlob);

    const allTreatments = [
      ...patientCase.diagnosticTreatments,
      ...patientCase.ongoingTreatments
    ];

    let fileCounter = 1;
    allTreatments.forEach((treatment) => {
      if (treatment.documentation.images && treatment.documentation.images.length > 0) {
        treatment.documentation.images.forEach((fileData) => {
          try {
            const parsed = JSON.parse(fileData);
            const base64Data = parsed.data.split(',')[1];
            const sanitizedName = parsed.name.replace(/[^a-z0-9.-]/gi, '_');
            zip.file(`attachment-${fileCounter}-${sanitizedName}`, base64Data, { base64: true });
            fileCounter++;
          } catch {
            const base64Data = fileData.split(',')[1];
            if (base64Data) {
              zip.file(`attachment-${fileCounter}.jpg`, base64Data, { base64: true });
              fileCounter++;
            }
          }
        });
      }
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportReferral(
    patientCase: PatientCase,
    urgency: string,
    referralNote: string,
    specialistType: string
  ): void {
    this.doc = new jsPDF();
    this.yPosition = 20;
    this.buildReferralPDF(patientCase, urgency, referralNote, specialistType);
    const fileName = this.generateFileName(patientCase.patientName, patientCase.patientId, 'Referral');
    this.doc.save(`${fileName}.pdf`);
  }

  private buildReferralPDF(
    patientCase: PatientCase,
    urgency: string,
    referralNote: string,
    specialistType: string
  ): void {
    this.addTitle('Specialist Referral');
    this.addText(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`);
    this.yPosition += 5;

    this.doc.setFillColor(urgency === 'high' ? 220 : urgency === 'medium' ? 255 : 200,
                          urgency === 'high' ? 50 : urgency === 'medium' ? 200 : 255,
                          urgency === 'high' ? 50 : urgency === 'medium' ? 100 : 200);
    this.doc.rect(this.margin, this.yPosition, 40, 8, 'F');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(`Urgency: ${urgency.toUpperCase()}`, this.margin + 2, this.yPosition + 6);
    this.doc.setTextColor(0, 0, 0);
    this.yPosition += 15;
    this.addDivider();

    this.addSubtitle('Patient Information');
    this.addBoldText('Name: ', patientCase.patientName, 5);
    this.addBoldText('Patient ID: ', patientCase.patientId, 5);
    this.addBoldText('Specialist Type: ', specialistType, 5);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Diagnosis');
    this.addBoldText('Condition: ', patientCase.condition, 5);
    this.addBoldText('ICD-10 Code: ', patientCase.icdCode, 5);
    this.addText(`Description: ${patientCase.icdDescription}`, 5);
    this.yPosition += 5;
    this.addDivider();

    this.addSubtitle('Original Clinical Note');
    this.addText(patientCase.clinicalNote, 5);
    this.yPosition += 5;
    this.addDivider();

    if (patientCase.diagnosticTreatments.length > 0) {
      this.addSubtitle('Diagnostic Tests Completed');
      patientCase.diagnosticTreatments.forEach((treatment, index) => {
        this.addText(`${index + 1}. ${treatment.description} (${treatment.code})`, 5);
        this.addBoldText('  Completed: ', `${treatment.timesCompleted}x`, 10);
        if (treatment.documentation.notes) {
          this.addText(`  Findings: ${treatment.documentation.notes}`, 10);
        }
        if (treatment.documentation.images && treatment.documentation.images.length > 0) {
          this.addText(`  Attachments: ${treatment.documentation.images.length} file(s)`, 10);
        }
        this.yPosition += 2;
      });
      this.addDivider();
    }

    if (patientCase.ongoingTreatments.length > 0) {
      this.addSubtitle('Ongoing Management');
      patientCase.ongoingTreatments.forEach((treatment, index) => {
        this.addText(`${index + 1}. ${treatment.description} (${treatment.code})`, 5);
        this.addBoldText('  Frequency: ', `${treatment.timesCompleted}x per year`, 10);
        if (treatment.documentation.notes) {
          this.addText(`  Notes: ${treatment.documentation.notes}`, 10);
        }
        if (treatment.documentation.images && treatment.documentation.images.length > 0) {
          this.addText(`  Attachments: ${treatment.documentation.images.length} file(s)`, 10);
        }
        this.yPosition += 2;
      });
      this.addDivider();
    }

    if (patientCase.medications.length > 0) {
      this.addSubtitle('Current Medications');
      patientCase.medications.forEach((med, index) => {
        this.addText(`${index + 1}. ${med.medicineNameAndStrength}`, 5);
        this.addText(`   ${med.activeIngredient}`, 10);
        this.addBoldText('   CDA Amount: ', med.cdaAmount, 10);
        this.yPosition += 2;
      });

      if (patientCase.medicationNote) {
        this.yPosition += 3;
        this.addText('Registration Note:', 5);
        this.addText(patientCase.medicationNote, 10);
      }
      this.addDivider();
    }

    if (patientCase.medicationReports && patientCase.medicationReports.length > 0) {
      this.addSubtitle('Medication Updates History');
      patientCase.medicationReports.forEach((report, index) => {
        this.addText(`Report #${index + 1} - ${format(new Date(report.createdAt), 'MMM dd, yyyy')}`, 5);
        if (report.followUpNotes) {
          this.addText(`Follow-up: ${report.followUpNotes}`, 10);
        }
        if (report.newMedications.length > 0) {
          this.addText('New Medications Added:', 10);
          report.newMedications.forEach((med) => {
            this.addText(`• ${med.medicineNameAndStrength} (${med.activeIngredient})`, 15);
          });
          if (report.motivationLetter) {
            this.addText(`Reason: ${report.motivationLetter}`, 10);
          }
        }
        this.yPosition += 3;
      });
      this.addDivider();
    }

    this.addSubtitle('Referral Motivation');
    this.addText(referralNote, 5);
  }
}
