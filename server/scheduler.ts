import { storage } from "./storage";
import { generateEmail } from "./openai";
import { sendEmail, isSendGridConfigured } from "./sendgrid";
import type { SequenceStepRecord, ScheduledEmailRecord, ProspectRecord } from "@shared/schema";

const SCHEDULER_INTERVAL_MS = 60000; // Check every minute

let schedulerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export function startScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }

  console.log("[Scheduler] Starting sequence scheduler...");
  
  // Run immediately on start
  processScheduledEmails().catch(console.error);
  
  // Then run on interval
  schedulerInterval = setInterval(() => {
    processScheduledEmails().catch(console.error);
  }, SCHEDULER_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped");
  }
}

async function processScheduledEmails(): Promise<void> {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    const dueEmails = await storage.getDueEmails();
    
    if (dueEmails.length === 0) {
      return;
    }

    console.log(`[Scheduler] Processing ${dueEmails.length} due emails`);

    for (const email of dueEmails) {
      try {
        await processEmail(email);
      } catch (error: any) {
        console.error(`[Scheduler] Error processing email ${email.id}:`, error);
        await storage.updateScheduledEmailStatus(email.id, "failed", error?.message || "Unknown error");
      }
    }
  } finally {
    isProcessing = false;
  }
}

async function processEmail(scheduledEmail: ScheduledEmailRecord): Promise<void> {
  // Mark as sending
  await storage.updateScheduledEmailStatus(scheduledEmail.id, "sending");

  // Check if SendGrid is configured
  if (!isSendGridConfigured()) {
    console.log(`[Scheduler] Email ${scheduledEmail.id} - SendGrid not configured, marking as failed`);
    await storage.updateScheduledEmailStatus(scheduledEmail.id, "failed", "SendGrid not configured");
    return;
  }

  // Get prospect for recipient email
  const prospects = await storage.getAllProspects();
  const prospect = prospects.find(p => p.id === scheduledEmail.prospectId);
  
  if (!prospect) {
    await storage.updateScheduledEmailStatus(scheduledEmail.id, "failed", "Prospect not found");
    return;
  }

  // Get user profile for sender info (using userId from prospect)
  const profile = await storage.getUserProfile(prospect.userId);
  
  if (!profile.senderEmail) {
    await storage.updateScheduledEmailStatus(scheduledEmail.id, "failed", "No sender email configured in profile");
    return;
  }

  // Send the email
  const result = await sendEmail({
    to: prospect.email,
    from: profile.senderEmail,
    subject: scheduledEmail.subject,
    body: scheduledEmail.body,
  });

  if (!result.success) {
    await storage.updateScheduledEmailStatus(scheduledEmail.id, "failed", result.error);
    return;
  }

  // Mark as sent
  await storage.updateScheduledEmailStatus(scheduledEmail.id, "sent");
  console.log(`[Scheduler] Email ${scheduledEmail.id} sent successfully to ${prospect.email}`);

  // Schedule the next step if applicable
  await scheduleNextStep(scheduledEmail.enrollmentId, scheduledEmail.stepId);
}

async function scheduleNextStep(enrollmentId: number, currentStepId: number): Promise<void> {
  // Get enrollment
  const enrollments = await storage.getEnrollments(0); // Get all enrollments
  const enrollment = enrollments.find(e => e.id === enrollmentId);
  
  if (!enrollment || enrollment.status !== "active") {
    return;
  }

  // Get sequence steps
  const steps = await storage.getSequenceSteps(enrollment.sequenceId);
  const currentStepIndex = steps.findIndex(s => s.id === currentStepId);
  
  if (currentStepIndex === -1 || currentStepIndex >= steps.length - 1) {
    // No more steps, mark as completed
    await storage.updateEnrollmentStatus(enrollmentId, "completed");
    return;
  }

  // Get next step
  const nextStep = steps[currentStepIndex + 1];
  
  // Schedule next email
  await scheduleStepEmail(enrollmentId, enrollment.prospectId, enrollment.sequenceId, nextStep);
}

export async function scheduleInitialEmails(
  enrollmentId: number,
  prospectId: number,
  sequenceId: number
): Promise<void> {
  const sequence = await storage.getSequenceById(sequenceId);
  
  if (!sequence || sequence.steps.length === 0) {
    console.log(`[Scheduler] No steps found for sequence ${sequenceId}`);
    return;
  }

  // Schedule the first step
  const firstStep = sequence.steps[0];
  await scheduleStepEmail(enrollmentId, prospectId, sequenceId, firstStep);
}

async function scheduleStepEmail(
  enrollmentId: number,
  prospectId: number,
  sequenceId: number,
  step: SequenceStepRecord
): Promise<void> {
  // Get sequence for tone/length settings (internal use - no userId check)
  const sequence = await storage.getSequenceById(sequenceId);
  if (!sequence) return;

  // Get prospect for email generation
  const prospects = await storage.getAllProspects();
  const prospectRecord = prospects.find(p => p.id === prospectId);
  
  if (!prospectRecord) {
    console.error(`[Scheduler] Prospect ${prospectId} not found`);
    return;
  }

  // Calculate scheduled time
  const now = new Date();
  const scheduledFor = new Date(now);
  scheduledFor.setDate(scheduledFor.getDate() + step.delayDays);
  scheduledFor.setHours(step.sendTimeHour, step.sendTimeMinute, 0, 0);

  // If scheduled time is in the past, schedule for today at the specified time
  // or tomorrow if that time has already passed
  if (scheduledFor <= now) {
    scheduledFor.setDate(now.getDate());
    if (scheduledFor <= now) {
      scheduledFor.setDate(now.getDate() + 1);
    }
  }

  // Generate email content if not using a template
  let subject = step.subjectTemplate || "";
  let body = step.bodyTemplate || "";

  if (!subject || !body) {
    // Generate using AI
    const prospect = {
      firstName: prospectRecord.firstName,
      lastName: prospectRecord.lastName,
      company: prospectRecord.company,
      title: prospectRecord.title,
      email: prospectRecord.email,
      linkedinUrl: prospectRecord.linkedinUrl || undefined,
      notes: prospectRecord.notes || undefined,
    };

    try {
      const generatedEmail = await generateEmail({
        prospect,
        tone: sequence.tone as "casual" | "professional" | "hyper-personal",
        length: sequence.length as "short" | "medium",
        userId: prospectRecord.userId,
      });

      if (!subject) subject = generatedEmail.subject;
      if (!body) body = generatedEmail.body;

      // If it's a follow-up, modify the subject
      if (step.isFollowUp && step.stepNumber > 1) {
        subject = `Re: ${subject}`;
        body = `Following up on my previous email...\n\n${body}`;
      }
    } catch (error: any) {
      console.error(`[Scheduler] Failed to generate email for step ${step.id}:`, error);
      return;
    }
  }

  // Create scheduled email
  await storage.createScheduledEmail({
    enrollmentId,
    stepId: step.id,
    prospectId,
    subject,
    body,
    scheduledFor,
    status: "scheduled",
  });

  console.log(`[Scheduler] Scheduled email for enrollment ${enrollmentId}, step ${step.stepNumber} at ${scheduledFor.toISOString()}`);
}

export function getSchedulerStatus(): { running: boolean; processing: boolean } {
  return {
    running: schedulerInterval !== null,
    processing: isProcessing,
  };
}
