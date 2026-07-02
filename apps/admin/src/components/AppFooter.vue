<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer
    data-testid="app-footer"
    class="shrink-0 border-t border-border-subtle bg-bg-surface py-3 text-sm text-text-dim shadow-[0_-1px_0_0_rgb(0_0_0/0.03)]"
  >
    <div class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-2">
      <div class="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p class="m-0">© {{ year }} CodeComply Admin</p>
        <p class="m-0 text-center sm:text-right">CodeComply — open source inspection management</p>
      </div>
      <p class="m-0 text-xs leading-relaxed text-text-dim">
        CodeComply is an open source inspection management system designed and developed to support
        workflows under the Alberta Safety Codes Act (RSA 2000, c. S-1), the Freedom of Information
        and Protection of Privacy Act (RSA 2000, c. F-25), and Safety Codes Inspection Notice of
        Compliance requirements. This project is independently developed by the community and is not
        endorsed by or affiliated with the Government of Alberta. Implementation, configuration,
        hosting, and operational controls are the responsibility of the deploying organization.
        Deploying agencies are responsible for ensuring their specific deployment meets all
        applicable regulatory and privacy obligations.
      </p>
    </div>
  </footer>
</template>
