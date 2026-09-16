/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as applicationConfirmation } from './application-confirmation.tsx'
import { template as applicationStatusUpdate } from './application-status-update.tsx'
import { template as newApplicantNotification } from './new-applicant-notification.tsx'
import { template as eventRegistrationConfirmation } from './event-registration-confirmation.tsx'
import { template as onboardingReminder } from './onboarding-reminder.tsx'
import { template as eventReminder } from './event-reminder.tsx'
import { template as thrivefundPledgeConfirmed } from './thrivefund-pledge-confirmed.tsx'
import { template as thrivefundCampaignFunded } from './thrivefund-campaign-funded.tsx'
import { template as thrivefundCampaignFailed } from './thrivefund-campaign-failed.tsx'
import { template as eventBlast } from './event-blast.tsx'
import { template as eventInvite } from './event-invite.tsx'
import { template as day2Engagement } from './day2-engagement.tsx'
import { template as universeScanFindings } from './universe-scan-findings.tsx'
import { template as reEngagement } from './re-engagement.tsx'
import { template as welcome } from './welcome.tsx'
import { template as speedSessionRecap } from './speed-session-recap.tsx'
import { template as speedSessionReminder } from './speed-session-reminder.tsx'
import { template as speedSessionRsvpConfirmed } from './speed-session-rsvp-confirmed.tsx'
import { template as creditChainInvite } from './credit-chain-invite.tsx'
import { template as curatedStageInvite } from './curated-stage-invite.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'universe-scan-findings': universeScanFindings,
  're-engagement': reEngagement,
  'application-confirmation': applicationConfirmation,
  'application-status-update': applicationStatusUpdate,
  'new-applicant-notification': newApplicantNotification,
  'event-registration-confirmation': eventRegistrationConfirmation,
  'onboarding-reminder': onboardingReminder,
  'event-reminder': eventReminder,
  'thrivefund-pledge-confirmed': thrivefundPledgeConfirmed,
  'thrivefund-campaign-funded': thrivefundCampaignFunded,
  'thrivefund-campaign-failed': thrivefundCampaignFailed,
  'event-blast': eventBlast,
  'event-invite': eventInvite,
  'day2-engagement': day2Engagement,
  'speed-session-recap': speedSessionRecap,
  'speed-session-reminder': speedSessionReminder,
  'speed-session-rsvp-confirmed': speedSessionRsvpConfirmed,
  'credit-chain-invite': creditChainInvite,
  'curated-stage-invite': curatedStageInvite,
}
