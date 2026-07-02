<script setup lang="ts">
// Static user manual page.
// Content mirrors _docs/user-manuals/inspector-user-manual.md and
// _docs/user-manuals/inspector-voc-workflow.md (field-friendly summary).
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import AppBrandWordmark from '../components/layout/AppBrandWordmark.vue'

const figureClass = 'mt-3 overflow-hidden rounded-2xl border border-border-subtle bg-bg-elevated'
const figureMediaClass = 'bg-bg-app p-2 tablet:p-3'
const figureImgClass = 'block h-auto w-full max-w-full'
/** Login has no app shell; show the centered panel at native width instead of stretching a full viewport capture. */
const loginFigureMediaClass = 'bg-bg-app flex justify-center p-2 tablet:p-3'
const loginFigureImgClass =
  'block h-auto w-auto max-w-full rounded-lg border border-border-subtle/60 shadow-sm'
const figureCaptionClass = 'border-t border-border-subtle px-3 py-2 text-xs text-text-dim'

const { isAuthenticated } = useAuth()
const route = useRoute()
const isGuest = computed(() => !isAuthenticated.value)
const signInTo = computed(() => ({
  name: 'login' as const,
  query: { redirect: route.fullPath },
}))
</script>

<template>
  <div class="bg-bg-surface text-text-primary">
    <main class="px-4 pt-3 tablet:px-6 tablet:pt-5">
      <div class="max-w-3xl mx-auto w-full">
        <header class="mb-6 tablet-l:mb-8">
          <AppBrandWordmark size="lg" />
          <h1 class="sr-only">CodeComply Field — User Guide</h1>
          <p class="mt-2 text-sm text-text-dim">
            Practical reference for Safety Codes Officers using CodeComply Field in the field.
          </p>
        </header>

        <div
          v-if="isGuest"
          class="mb-5 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100"
          role="status"
          data-testid="user-manual-guest-banner"
        >
          <p class="font-medium">You can read this guide without signing in.</p>
          <p class="mt-1 text-emerald-900/90 dark:text-emerald-100/90">
            Sign in when you are ready to open permits, run inspections, and sync your work.
          </p>
          <RouterLink
            :to="signInTo"
            class="inline-flex mt-3 items-center justify-center rounded-lg bg-emerald-700 dark:bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            data-testid="user-manual-sign-in-link"
          >
            Sign in
          </RouterLink>
        </div>

        <section class="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 class="text-lg font-semibold mb-2">Summary</h2>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                <span class="font-semibold">Purpose:</span>
                Offline-first PWA for assigned and nearby permits, checklist inspections (Pass /
                Fail / N/A with code on Fail), photos, deficiencies,
                <span class="font-semibold">Verification of Compliance (VoC)</span> for open
                deficiencies, and review / finalize with outcome and signature.
              </li>
              <li>
                <span class="font-semibold">Who should use this:</span>
                Certified Safety Codes Officers (SCO role) using CodeComply Field and field staff
                your organization authorizes.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Getting Started</h2>

            <h3 class="font-semibold mb-1">Install the App</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                <span class="font-semibold">Mobile (recommended):</span>
                Open the CodeComply Field link in your mobile browser. When prompted, choose
                <span class="italic">Add to Home Screen</span>
                (iOS: Share → Add to Home Screen; Android: menu → Add to Home screen). Launch from
                your home screen for the best experience.
              </li>
              <li>
                <span class="font-semibold">Desktop:</span>
                Open in Chrome, Edge, or Safari and follow the browser prompt to install.
              </li>
            </ul>

            <h3 class="font-semibold mb-1">Sign In</h3>
            <ol class="list-decimal pl-5 space-y-1">
              <li>Open CodeComply Field from your home screen or browser.</li>
              <li>
                Enter your <span class="font-semibold">email</span> and
                <span class="font-semibold">password</span>, then tap
                <span class="font-semibold">Sign In</span>. Sign-in needs a network connection; the
                form is disabled while offline.
              </li>
              <li>
                When asked, allow location access for Find Near Me and site-distance features.
              </li>
            </ol>

            <figure :class="figureClass" aria-label="Login screen example">
              <div :class="loginFigureMediaClass">
                <img
                  src="/user-manual/login-screen.png"
                  alt="CodeComply Field login screen showing email and password fields and the Sign in button"
                  :class="loginFigureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                CodeComply Field login (email/password). Sign-in requires network connectivity.
              </figcaption>
            </figure>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Main Screens</h2>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                <span class="font-semibold">Home:</span>
                Shortcuts, offline banner, PWA install hints.
              </li>
              <li>
                <span class="font-semibold">Permits:</span>
                Assigned permits sync when you open the screen;
                <span class="font-semibold">Find Near Me</span> adds nearby permits from the server;
                search / filter / sort applies to permits already saved on the device
                (offline-friendly).
              </li>
              <li>
                <span class="font-semibold">Profile:</span>
                Your name, certification summary, and settings.
              </li>
              <li>
                <span class="font-semibold">Help:</span>
                This guide (bottom navigation on phone).
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Using the App</h2>

            <h3 class="font-semibold mb-1">Permits</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                Open <span class="font-semibold">Permits</span>. Assigned work loads from the server
                when you are online.
              </li>
              <li>
                Use <span class="font-semibold">Find Near Me</span> (GPS) to fetch and add nearby
                permits—requires being online for that fetch.
              </li>
              <li>
                Expand <span class="font-semibold">Search, filter &amp; sort</span> to work with the
                list already on your device (permit number, address, status, scheduled inspection).
              </li>
              <li>
                Tap a permit for details, geofence warning when far from coordinates, scheduled
                inspections, and <span class="font-semibold">Start</span> /
                <span class="font-semibold">Continue inspection</span>.
              </li>
            </ul>

            <figure :class="figureClass" aria-label="Permits screen example">
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/permits-screen.png"
                  alt="Permits screen showing Find Near Me and the Search, filter & sort panel"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Permits: Find Near Me adds permits from the server; Search, filter &amp; sort
                applies to your device list.
              </figcaption>
            </figure>

            <h3 class="font-semibold mb-1">Checklist &amp; deficiencies</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                On each line: <span class="font-semibold">Pass</span>,
                <span class="font-semibold">Fail</span>, or <span class="font-semibold">N/A</span>.
                <span class="font-semibold">Fail</span> requires a
                <span class="font-semibold">code reference</span>.
              </li>
              <li>
                Use <span class="font-semibold">Deficiencies</span> in the header for the inspection
                list; on a failed row use <span class="font-semibold">Record deficiency</span> to
                link a formal deficiency to that line.
              </li>
              <li>
                On deficiency forms, use voice input (press and hold) where supported—often needs
                network and a compatible browser.
              </li>
            </ul>

            <figure :class="figureClass" aria-label="Inspection checklist screen example">
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/checklist-screen.png"
                  alt="Inspection checklist showing filters, Pass Fail N/A buttons, deficiencies panel, and footer actions including Review and submit"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Inspection checklist: filters (All / Failed / Unanswered), Pass all,
                <span class="font-semibold">Deficiencies</span>, item actions, photos, and footer
                <span class="font-semibold">Review &amp; submit</span>.
              </figcaption>
            </figure>

            <figure :class="[figureClass, 'mt-4']" aria-label="Deficiencies list screen example">
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/deficiencies-screen.png"
                  alt="Deficiencies screen showing filters by status and severity, deficiency cards with tags, and Add deficiency button"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Deficiencies list for an inspection: filter by status and severity, open cards for
                detail, use <span class="font-semibold">Add deficiency</span> for a new record.
              </figcaption>
            </figure>

            <h3 class="font-semibold mb-1">Verification of Compliance (VoC)</h3>
            <p class="mb-2 text-text-dim">
              VoC records <span class="font-semibold">how</span> you verified that a
              <span class="font-semibold">specific deficiency</span> has been addressed (site visit,
              written assurance, verbal assurance, or other method). Submit
              <span class="font-semibold">one VoC per deficiency</span>—not one form for every item
              on an order. Admin staff in CodeComply Admin review accept/reject in the back office;
              the full Notice of Compliance PDF is generated there, not in CodeComply Field.
            </p>

            <h4 class="font-semibold mb-1 text-sm">Before you submit</h4>
            <p class="mb-2">
              Review the related compliance on <span class="font-semibold">deficiency detail</span>
              first:
            </p>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                <span class="font-semibold">Code reference</span> (safety code section contravened)
              </li>
              <li>
                <span class="font-semibold">Description</span> and
                <span class="font-semibold">location</span>
              </li>
              <li><span class="font-semibold">Photos</span> (evidence)</li>
              <li>Severity and any <span class="font-semibold">Stop work</span> / unsafe flags</li>
              <li>
                Originating <span class="font-semibold">checklist Fail</span> + code (when the
                deficiency is linked to a checklist line)
              </li>
            </ul>
            <p class="mb-3 text-text-dim text-xs">
              The VoC form pre-fills section title and title from the code reference but does not
              repeat the full deficiency summary—open deficiency detail before
              <span class="font-semibold">Submit VoC</span>.
            </p>

            <h4 class="font-semibold mb-1 text-sm">How to open the VoC form</h4>
            <ol class="list-decimal pl-5 mb-3 space-y-1">
              <li>
                <span class="font-semibold">Permits</span> → permit →
                <span class="font-semibold">Start</span> or
                <span class="font-semibold">Continue inspection</span>
              </li>
              <li>
                Checklist header → <span class="font-semibold">Deficiencies</span> → tap a
                deficiency card
              </li>
              <li>
                On deficiency detail, tap <span class="font-semibold">Submit VoC</span> (violet
                button)
              </li>
              <li>
                Complete <span class="font-semibold">Verification of compliance</span>: verification
                date, section title, title, submitter name, method, optional comments
              </li>
            </ol>

            <figure
              :class="[figureClass, 'mb-4']"
              aria-label="Deficiency detail with code reference and Submit VoC action"
            >
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/deficiency-voc-detail.png"
                  alt="Deficiency detail showing photos, severity and status tags, description, location, code reference, and Submit VoC button with Edit, Mark resolved, and Delete"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Deficiency detail: review <span class="font-semibold">code reference</span>,
                description, and evidence, then tap
                <span class="font-semibold">Submit VoC</span> when the deficiency is open or VOC
                rejected.
              </figcaption>
            </figure>

            <figure
              :class="[figureClass, 'mb-4']"
              aria-label="Verification of compliance VoC submission form"
            >
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/voc-submission-form.png"
                  alt="Verification of compliance form with verification date, section title pre-filled from code reference, title, submitter name, verification method dropdown, comments, and Submit VoC button"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                <span class="font-semibold">Verification of compliance</span> form: section title
                and title are pre-filled from the deficiency code reference; choose a verification
                method and tap <span class="font-semibold">Submit VoC</span>.
              </figcaption>
            </figure>

            <h4 class="font-semibold mb-1 text-sm">When Submit VoC is available</h4>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                <span class="font-semibold">Open</span> or
                <span class="font-semibold">VOC rejected</span> (resubmit after admin feedback)
              </li>
              <li>
                Not shown for VOC submitted (pending review), VOC accepted, or closed deficiencies
              </li>
              <li>
                Not available when the inspection is
                <span class="font-semibold">read-only after finalization sync</span>
              </li>
            </ul>

            <h4 class="font-semibold mb-1 text-sm">Offline and after submit</h4>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                You can submit VoC offline; status becomes
                <span class="font-semibold">VOC submitted</span> locally and sync uploads when
                online (use header <span class="font-semibold">Sync now</span>).
              </li>
              <li>
                After success you return to deficiency detail with a confirmation message. If admin
                rejects the VoC, status becomes <span class="font-semibold">VOC rejected</span> and
                you can submit again.
              </li>
            </ul>

            <h3 class="font-semibold mb-1">Photos</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                Add photos from the checklist item gallery; capture and optional annotation flow to
                local storage, then upload when online and sync runs.
              </li>
              <li>
                Resolve mandatory-photo prompts for failed items (or template rules) before
                completing or finalizing.
              </li>
            </ul>

            <h3 class="font-semibold mb-1">Review &amp; submit (finalize)</h3>
            <ol class="list-decimal pl-5 mb-3 space-y-1">
              <li>
                From the checklist footer, tap
                <span class="font-semibold">Review &amp; submit</span>.
              </li>
              <li>
                Fix any validation issues (checklist, photos). Choose an
                <span class="font-semibold">outcome</span> and capture a
                <span class="font-semibold">digital signature</span>.
              </li>
              <li>
                Confirm <span class="font-semibold">Finalize</span>. Offline: finalization queues;
                online: use header <span class="font-semibold">Sync now</span> /
                <span class="font-semibold">Retry failed</span> until it succeeds.
              </li>
              <li>
                After successful finalization sync, the inspection is
                <span class="font-semibold">read-only</span>.
              </li>
            </ol>

            <figure
              :class="figureClass"
              aria-label="Review and submit — inspection and checklist summary"
            >
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/review-summary.png"
                  alt="Review and submit screen showing inspection summary with permit address and checklist summary with progress and Pass Fail N/A counts"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Top of Review &amp; submit: permit / schedule context and checklist progress. Finish
                all items before finalizing.
              </figcaption>
            </figure>

            <figure
              :class="[figureClass, 'mt-4']"
              aria-label="Review and submit — deficiencies on this inspection"
            >
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/review-deficiencies.png"
                  alt="Deficiencies section on review screen with count badge and deficiency cards"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Review recorded deficiencies before submission.
              </figcaption>
            </figure>

            <figure
              :class="[figureClass, 'mt-4']"
              aria-label="Review and submit — photos and outcome"
            >
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/review-outcome-photos.png"
                  alt="Photos section with Library and Add buttons and Outcome section with Acceptable, Acceptable with Conditions, and Refused options"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Evidence photos and choosing the
                <span class="font-semibold">outcome</span> (Acceptable, Acceptable with conditions,
                or Refused).
              </figcaption>
            </figure>

            <figure
              :class="[figureClass, 'mt-4']"
              aria-label="Review and submit — digital signature"
            >
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/review-signature.png"
                  alt="Signature card with sign area, Clear and Accept buttons"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                Draw your signature, then <span class="font-semibold">Accept</span> to attach it.
              </figcaption>
            </figure>

            <figure
              :class="[figureClass, 'mt-4', 'mb-1']"
              aria-label="Review and submit — validation before submit"
            >
              <div :class="figureMediaClass">
                <img
                  src="/user-manual/review-validation.png"
                  alt="Validation panel listing issues such as incomplete checklist, missing outcome, and missing signature with Go to section buttons"
                  :class="figureImgClass"
                  loading="lazy"
                />
              </div>
              <figcaption :class="figureCaptionClass">
                If something is missing, CodeComply Field lists what to fix. Use
                <span class="font-semibold">Go to section</span> to jump to each item, then use
                <span class="font-semibold">Submit inspection</span> when ready.
              </figcaption>
            </figure>

            <h3 class="font-semibold mb-1">Offline &amp; sync</h3>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                Saved permits, checklists, deficiencies, and photos work offline; changes stay on
                the device until sync.
              </li>
              <li>
                Use the <span class="font-semibold">sync</span> control in the top header: status,
                <span class="font-semibold">Sync now</span>,
                <span class="font-semibold">Retry failed</span> when online.
              </li>
              <li>Home shows a banner when you are offline in CodeComply Field.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Accessibility and Display</h2>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                High-contrast or theme options are available for bright outdoor conditions. Toggle
                this in the header or display settings.
              </li>
              <li>
                Text and buttons are sized for mobile use; rotate the device or use tablet mode for
                more screen space when needed.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Troubleshooting — Common Issues</h2>

            <h3 class="font-semibold mb-1">GPS Location Not Found</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                Ensure location services are enabled on your device and that the app has permission
                to access location.
              </li>
              <li>
                Move a short distance away from buildings or structures that might block GPS and try
                again.
              </li>
              <li>Close and reopen the app if the GPS remains unavailable.</li>
            </ul>

            <h3 class="font-semibold mb-1">App Won’t Install or Launch</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>Make sure you are using a supported browser (Chrome or Safari recommended).</li>
              <li>Check available storage on your device.</li>
              <li>Clear the browser cache and try again.</li>
            </ul>

            <h3 class="font-semibold mb-1">Sync or Upload Delays</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                When online, open the header <span class="font-semibold">sync</span> menu and tap
                <span class="font-semibold">Sync now</span> or
                <span class="font-semibold">Retry failed</span>.
              </li>
              <li>
                Large photo batches and queued finalization upload after connectivity returns; wait
                for pending counts to clear.
              </li>
            </ul>

            <h3 class="font-semibold mb-1">Account and Access Problems</h3>
            <ul class="list-disc pl-5 mb-3 space-y-1">
              <li>
                If you cannot sign in, contact your system administrator to confirm your account and
                credentials.
              </li>
              <li>
                For certification or access questions, speak with your administrator — they manage
                user accounts and permissions.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Data Security and Privacy (For Users)</h2>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                Your account requires valid certification to access inspection features. The app
                enforces access controls.
              </li>
              <li>
                Data you capture (notes, photos, outcomes, signatures) is stored securely and
                synchronized with the back-office system when connected.
              </li>
              <li>
                If your device is lost or stolen, notify your administrator immediately so they can
                protect account access.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Best Practices for Field Use</h2>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                Install CodeComply Field on your primary inspection device and keep it on the home
                screen for quick access.
              </li>
              <li>Grant location permissions so permit discovery works reliably on site.</li>
              <li>Capture clear photos and concise notes for each inspection.</li>
              <li>
                Work offline confidently — CodeComply Field saves your work and uploads it
                automatically when online.
              </li>
              <li>
                Keep your device charged during long inspection days and enable battery-saver modes
                as needed.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Getting Help</h2>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                Contact your local system administrator for account, certification, or access
                issues.
              </li>
              <li>
                Report app errors and unexpected behavior through your organization’s support
                process so the technical team can investigate.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Updates</h2>
            <p>
              Your administrator will tell you about new features (for example organization SSO,
              richer document attachments, or notifications) and training.
            </p>
          </section>

          <section>
            <h2 class="text-lg font-semibold mb-2">Document Information</h2>
            <p>
              This in-app guide mirrors the repository user manuals for SCOs using CodeComply Field,
              including
              <span class="font-semibold">Verification of Compliance (VoC)</span> (
              <span class="italic">inspector-voc-workflow.md</span>). For routing and technical
              workflow detail, your team may publish additional workflow documents.
            </p>
            <p class="mt-2 text-xs text-text-dim">Version: 1.3.0 · Last updated: June 2026</p>
          </section>
        </section>
      </div>
    </main>
  </div>
</template>
